import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import { mkdir } from "fs/promises";
import ExcelJS from "exceljs";
import passport from "./auth";
import { storage } from "./storage";
import { requireAuth, requireRole, optionalAuth } from "./middleware";
import { sendEmail } from "./lib/resend";
import { broadcastJobUpdate } from "./websocket";
import { 
  JobStatus, 
  CleanerStatus, 
  UserRole,
  type Company,
  type Cleaner,
  type Job,
} from "@shared/schema";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
await mkdir(uploadDir, { recursive: true });

const storageConfig = multer.diskStorage({
  destination: async (req, file, cb) => {
    const subDir = file.fieldname === "tradeLicense" ? "licenses" : "proofs";
    const fullPath = path.join(uploadDir, subDir);
    await mkdir(fullPath, { recursive: true });
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage: storageConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed."));
    }
  },
});

// Stripe setup
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadDir));
  
  // ===== FILE UPLOAD ROUTES =====
  
  // Upload trade license document (requires company admin auth)
  app.post("/api/upload/trade-license", requireRole(UserRole.COMPANY_ADMIN), upload.single("tradeLicense"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/licenses/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Upload job completion proof photo (requires cleaner auth)
  app.post("/api/upload/proof-photo", requireRole(UserRole.CLEANER), upload.single("proofPhoto"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/proofs/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // ===== AUTHENTICATION ROUTES =====
  
  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: err.message });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        return res.json({ user });
      });
    })(req, res, next);
  });
  
  // Logout (with auto shift end for cleaners)
  app.post("/api/auth/logout", async (req, res) => {
    try {
      // End active shift if user is a cleaner
      if (req.user && req.user.role === UserRole.CLEANER) {
        const cleaner = await storage.getCleanerByUserId(req.user.id);
        if (cleaner) {
          const activeShift = await storage.getActiveShift(cleaner.id);
          if (activeShift) {
            await storage.endShift(cleaner.id);
          }
        }
      }
      
      req.logout((err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        res.json({ success: true });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get current user
  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.json({ user: null });
    }
  });
  
  // ===== REGISTRATION ROUTES =====
  
  // Register platform admin
  app.post("/api/auth/register/admin", async (req: Request, res: Response) => {
    try {
      const { email, password, displayName } = req.body;
      
      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Create admin user
      const user = await storage.createUser({
        email,
        password,
        displayName,
        role: UserRole.ADMIN,
      });
      
      // Log in the user
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        const { passwordHash, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Register company admin (creates user + company)
  app.post("/api/auth/register/company", async (req: Request, res: Response) => {
    try {
      const { 
        email,
        password,
        displayName, 
        phoneNumber,
        companyName, 
        companyDescription, 
        pricePerWash,
        tradeLicenseNumber,
        tradeLicenseDocumentURL
      } = req.body;
      
      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Use transaction to ensure atomicity
      const result = await storage.createCompanyWithAdmin({
        email,
        password,
        displayName,
        phoneNumber,
        companyName,
        companyDescription,
        pricePerWash: parseFloat(pricePerWash),
        tradeLicenseNumber,
        tradeLicenseDocumentURL,
      });
      
      // Log in the user
      req.login(result.user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        const { passwordHash, ...userWithoutPassword } = result.user;
        res.json({ user: userWithoutPassword, company: result.company });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Validate cleaner phone number (step 1 of registration)
  app.post("/api/auth/validate-cleaner-phone", async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.body;
      
      // Check if phone number has a pending invitation
      const invitation = await storage.getInvitationByPhone(phoneNumber);
      
      if (!invitation) {
        return res.status(400).json({ message: "Phone number not invited" });
      }
      
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation already used or revoked" });
      }
      
      // Get company details
      const company = await storage.getCompany(invitation.companyId);
      if (!company) {
        return res.status(400).json({ message: "Company not found" });
      }
      
      res.json({ 
        valid: true, 
        companyId: invitation.companyId,
        companyName: company.name
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Register cleaner (step 2 - requires valid phone invitation)
  app.post("/api/auth/register/cleaner", async (req: Request, res: Response) => {
    try {
      const { 
        email,
        password,
        displayName, 
        phoneNumber,
      } = req.body;
      
      // Validate phone number invitation again
      const invitation = await storage.getInvitationByPhone(phoneNumber);
      if (!invitation || invitation.status !== "pending") {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }
      
      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Use transaction to ensure atomicity
      const result = await storage.createCleanerWithUser({
        email,
        password,
        displayName,
        phoneNumber,
        companyId: invitation.companyId,
      });
      
      // Consume the invitation
      await storage.consumeInvitation(phoneNumber);
      
      // Log in the user
      req.login(result.user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        const { passwordHash, ...userWithoutPassword } = result.user;
        res.json({ user: userWithoutPassword, cleaner: result.cleaner });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // ===== CUSTOMER ROUTES (ANONYMOUS) =====

  // Customer phone-based login/registration
  app.post("/api/customer/login", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, displayName } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      
      const customer = await storage.createOrGetCustomer(phoneNumber, displayName);
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get customer profile by phone
  app.get("/api/customer/profile/:phoneNumber", async (req: Request, res: Response) => {
    try {
      const customer = await storage.getCustomerByPhone(req.params.phoneNumber);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all companies (for registration dropdown)
  app.get("/api/companies/all", async (req: Request, res: Response) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get nearby companies with on-duty cleaners within 50m radius
  // IMPORTANT: This must come BEFORE /api/companies/:id to avoid route matching issues
  app.get("/api/companies/nearby", async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      
      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ message: "Invalid latitude or longitude" });
      }
      
      const maxDistanceMeters = 50;

      const companiesWithCleaners = await storage.getNearbyCompanies(lat, lon, maxDistanceMeters);
      res.json(companiesWithCleaners);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company by ID
  // IMPORTANT: This parameterized route must come AFTER specific routes like /nearby
  app.get("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompany(parseInt(req.params.id));
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create payment intent and job
  app.post("/api/create-payment-intent", async (req: Request, res: Response) => {
    try {
      const jobData = req.body;
      
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(jobData.price * 100), // Convert to fils (AED subunits)
        currency: "aed",
        metadata: {
          carPlateNumber: jobData.carPlateNumber,
          locationAddress: jobData.locationAddress,
          companyId: jobData.companyId,
        },
      });

      // Create job in database with pending payment status
      const job = await storage.createJob({
        customerId: jobData.customerId ? parseInt(jobData.customerId) : undefined,
        companyId: parseInt(jobData.companyId),
        carPlateNumber: jobData.carPlateNumber,
        locationAddress: jobData.locationAddress,
        locationLatitude: jobData.locationLatitude,
        locationLongitude: jobData.locationLongitude,
        parkingNumber: jobData.parkingNumber,
        customerPhone: jobData.customerPhone,
        price: jobData.price,
        stripePaymentIntentId: paymentIntent.id,
        status: JobStatus.PENDING_PAYMENT,
      });

      res.json({ clientSecret: paymentIntent.client_secret, jobId: job.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Stripe webhook endpoint with signature verification
  app.post("/api/stripe-webhook", express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } else {
        console.warn('No STRIPE_WEBHOOK_SECRET - skipping signature verification');
        event = req.body;
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Find job by payment intent ID
        const job = await storage.getJobByPaymentIntent(paymentIntent.id);

        if (job) {
          // Update job status to PAID (cleaners will accept it themselves)
          await storage.updateJob(job.id, {
            status: JobStatus.PAID,
          });
          
          // Broadcast update to all on-duty cleaners
          const updatedJob = await storage.getJob(job.id);
          if (updatedJob) broadcastJobUpdate(updatedJob);
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Manual payment confirmation endpoint (for development when webhooks don't fire)
  app.post("/api/confirm-payment/:paymentIntentId", async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;
      
      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment not successful" });
      }
      
      // Find job by payment intent ID
      const job = await storage.getJobByPaymentIntent(paymentIntentId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (job.status !== JobStatus.PENDING_PAYMENT) {
        return res.json({ message: "Job already confirmed", job });
      }

      // Update job status to PAID (cleaners will accept it themselves)
      await storage.updateJob(job.id, {
        status: JobStatus.PAID,
      });
      
      // Broadcast update to all on-duty cleaners
      const updatedJob = await storage.getJob(job.id);
      if (updatedJob) broadcastJobUpdate(updatedJob);
      
      return res.json({ message: "Payment confirmed - job available for cleaners", job: updatedJob });
    } catch (error: any) {
      console.error('Payment confirmation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get customer's jobs
  app.get("/api/customer/jobs/:customerId?", async (req: Request, res: Response) => {
    try {
      const customerIdParam = req.params.customerId || req.query.customerId;
      if (!customerIdParam) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      const customerId = parseInt(customerIdParam as string);
      const jobs = await storage.getJobsByCustomer(customerId);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get jobs by car plate number (for tracking)
  app.get("/api/jobs/track/:plateNumber", async (req: Request, res: Response) => {
    try {
      const { plateNumber } = req.params;
      if (!plateNumber) {
        return res.status(400).json({ message: "Plate number is required" });
      }
      const jobs = await storage.getJobsByPlateNumber(plateNumber);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Rate a completed job
  app.post("/api/jobs/:jobId/rate", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { rating, review } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (job.status !== JobStatus.COMPLETED) {
        return res.status(400).json({ message: "Job must be completed before rating" });
      }
      
      if (job.rating) {
        return res.status(400).json({ message: "Job has already been rated" });
      }
      
      await storage.updateJob(jobId, {
        rating: parseFloat(rating),
        review: review || null,
        ratedAt: new Date(),
      });
      
      res.json({ message: "Rating submitted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== CLEANER ROUTES =====

  // Get cleaner profile
  app.get("/api/cleaner/profile", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      res.json(cleaner);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Start shift
  app.post("/api/cleaner/start-shift", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const session = await storage.startShift(cleaner.id);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // End shift
  app.post("/api/cleaner/end-shift", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      await storage.endShift(cleaner.id);
      res.json({ message: "Shift ended successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get active shift
  app.get("/api/cleaner/shift-status", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const activeShift = await storage.getActiveShift(cleaner.id);
      res.json({ activeShift, cleaner });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get shift history
  app.get("/api/cleaner/shift-history", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const history = await storage.getCleanerShiftHistory(cleaner.id, limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept job (single cleaner can accept with locking)
  app.post("/api/cleaner/accept-job/:jobId", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const jobId = parseInt(req.params.jobId);
      const accepted = await storage.acceptJob(jobId, cleaner.id);
      
      if (!accepted) {
        return res.status(409).json({ message: "Job already assigned or not available" });
      }
      
      const job = await storage.getJob(jobId);
      
      // Broadcast update via WebSocket
      if (job) {
        broadcastJobUpdate(job);
      }
      
      res.json({ message: "Job accepted successfully", job });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Toggle cleaner availability
  app.post("/api/cleaner/toggle-status", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (cleaner) {
        await storage.updateCleaner(cleaner.id, { status });
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Cleaner not found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update cleaner location
  app.post("/api/cleaner/update-location", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const { latitude, longitude } = req.body;
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (cleaner) {
        await storage.updateCleaner(cleaner.id, { 
          currentLatitude: latitude.toString(),
          currentLongitude: longitude.toString(),
        });
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Cleaner not found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get available jobs for cleaner
  app.get("/api/cleaner/available-jobs", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (!cleaner) {
        return res.json([]);
      }

      // Get paid jobs for this company without a cleaner assigned
      const jobs = await storage.getJobsByCompany(cleaner.companyId, JobStatus.PAID);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get cleaner's active jobs
  app.get("/api/cleaner/my-jobs", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (!cleaner) {
        return res.json([]);
      }

      const jobs = await storage.getJobsByCleaner(cleaner.id);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept job (uses transactional locking)
  app.post("/api/cleaner/accept-job/:jobId", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const jobId = parseInt(req.params.jobId);
      const accepted = await storage.acceptJob(jobId, cleaner.id);
      
      if (!accepted) {
        return res.status(409).json({ message: "Job already assigned or not available" });
      }
      
      const job = await storage.getJob(jobId);
      
      // Broadcast update via WebSocket
      if (job) {
        broadcastJobUpdate(job);
      }
      
      res.json({ message: "Job accepted successfully", job });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Start job
  app.post("/api/cleaner/start-job/:jobId", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      await storage.updateJob(parseInt(jobId), {
        status: JobStatus.IN_PROGRESS,
        startedAt: new Date(),
      });
      
      // Broadcast job start
      const startedJob = await storage.getJob(parseInt(jobId));
      if (startedJob) broadcastJobUpdate(startedJob);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Complete job with proof
  app.post("/api/cleaner/complete-job/:jobId", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { proofPhotoURL } = req.body;

      const job = await storage.getJob(parseInt(jobId));
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      await storage.updateJob(parseInt(jobId), {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        proofPhotoURL,
      });
      
      // Broadcast job completion
      const completedJob = await storage.getJob(parseInt(jobId));
      if (completedJob) broadcastJobUpdate(completedJob);

      // Update cleaner status back to on-duty
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (cleaner) {
        await storage.updateCleaner(cleaner.id, {
          status: CleanerStatus.ON_DUTY,
          totalJobsCompleted: cleaner.totalJobsCompleted + 1,
        });

        // Update company stats
        const company = await storage.getCompany(job.companyId);
        if (company) {
          await storage.updateCompany(company.id, {
            totalJobsCompleted: company.totalJobsCompleted + 1,
            totalRevenue: (parseFloat(company.totalRevenue as any) + parseFloat(job.price as any)).toString(),
          });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== COMPANY ADMIN ROUTES =====

  // Get company analytics
  app.get("/api/company/analytics", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const analytics = await storage.getCompanyAnalytics(req.user.companyId);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company cleaners
  app.get("/api/company/cleaners", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const cleaners = await storage.getCompanyCleaners(req.user.companyId);
      res.json(cleaners);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company invitations
  app.get("/api/company/invitations", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const invitations = await storage.getCompanyInvitations(req.user.companyId);
      res.json(invitations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Invite cleaner by phone number
  app.post("/api/company/invite-cleaner", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const { phoneNumber } = req.body;

      // Check if phone number already has an invitation
      const existing = await storage.getInvitationByPhone(phoneNumber);
      if (existing) {
        return res.status(400).json({ message: "Phone number already invited" });
      }

      // Create invitation
      const invitation = await storage.createInvitation({
        companyId: req.user.companyId,
        phoneNumber,
        invitedBy: req.user.id,
        status: "pending",
      });

      res.json(invitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== ADMIN ROUTES =====

  // Get platform analytics
  app.get("/api/admin/analytics", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const analytics = await storage.getAdminAnalytics();
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending companies for approval
  app.get("/api/admin/pending-companies", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const companies = await storage.getPendingCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Approve company
  app.post("/api/admin/approve-company/:companyId", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      await storage.approveCompany(parseInt(companyId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reject company
  app.post("/api/admin/reject-company/:companyId", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      await storage.rejectCompany(parseInt(companyId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==== ADMIN FINANCIAL ROUTES ====
  
  // Get all companies financial summary
  app.get("/api/admin/financials/companies", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const summary = await storage.getAllCompaniesFinancialSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get detailed company financials
  app.get("/api/admin/financials/company/:companyId", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const summary = await storage.getCompanyFinancialSummary(parseInt(companyId));
      const jobs = await storage.getCompanyFinancials(parseInt(companyId));
      const withdrawals = await storage.getCompanyWithdrawals(parseInt(companyId));
      
      res.json({
        summary,
        jobs,
        withdrawals,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all withdrawals (admin)
  app.get("/api/admin/financials/withdrawals", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Process withdrawal (update status)
  app.patch("/api/admin/financials/withdrawals/:id", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, referenceNumber, note } = req.body;
      
      const updates: any = { status };
      if (referenceNumber) updates.referenceNumber = referenceNumber;
      if (note) updates.note = note;
      if (status === 'completed') {
        updates.processedAt = new Date();
        updates.processedBy = (req.user as any).id;
      }
      
      await storage.updateWithdrawal(parseInt(id), updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==== COMPANY FINANCIAL ROUTES ====
  
  // Get company financial overview
  app.get("/api/company/financials/overview", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const summary = await storage.getCompanyFinancialSummary(companyId);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company job financials with filters
  app.get("/api/company/financials/jobs", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const { cleanerId, startDate, endDate } = req.query;
      
      const filters: any = {};
      if (cleanerId) filters.cleanerId = parseInt(cleanerId as string);
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const jobs = await storage.getCompanyFinancials(companyId, filters);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company withdrawals
  app.get("/api/company/financials/withdrawals", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const withdrawals = await storage.getCompanyWithdrawals(companyId);
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export financials to Excel
  app.post("/api/company/financials/export", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const { cleanerId, startDate, endDate } = req.body;
      
      const filters: any = {};
      if (cleanerId) filters.cleanerId = parseInt(cleanerId);
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      
      const jobs = await storage.getCompanyFinancials(companyId, filters);
      const summary = await storage.getCompanyFinancialSummary(companyId);
      const company = await storage.getCompany(companyId);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Financial Report');
      
      worksheet.columns = [
        { header: 'Job ID', key: 'jobId', width: 10 },
        { header: 'Paid At', key: 'paidAt', width: 20 },
        { header: 'Cleaner ID', key: 'cleanerId', width: 12 },
        { header: 'Gross Amount', key: 'grossAmount', width: 15 },
        { header: 'Platform Fee', key: 'platformFee', width: 15 },
        { header: 'Processing Fee', key: 'processingFee', width: 15 },
        { header: 'Net Amount', key: 'netAmount', width: 15 },
      ];
      
      jobs.forEach(job => {
        worksheet.addRow({
          jobId: job.jobId,
          paidAt: new Date(job.paidAt).toLocaleString(),
          cleanerId: job.cleanerId || 'N/A',
          grossAmount: Number(job.grossAmount).toFixed(2),
          platformFee: Number(job.platformFeeAmount).toFixed(2),
          processingFee: Number(job.paymentProcessingFeeAmount).toFixed(2),
          netAmount: Number(job.netPayableAmount).toFixed(2),
        });
      });
      
      worksheet.addRow({});
      worksheet.addRow({
        jobId: 'TOTAL',
        grossAmount: summary.totalRevenue.toFixed(2),
        platformFee: summary.platformFees.toFixed(2),
        processingFee: summary.paymentProcessingFees.toFixed(2),
        netAmount: summary.netEarnings.toFixed(2),
      });
      
      const totalRow = worksheet.lastRow;
      if (totalRow) {
        totalRow.font = { bold: true };
      }
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=financials-${company?.name || 'company'}-${Date.now()}.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return createServer(app);
}

// Utility function for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
