import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import { mkdir, mkdirSync } from "fs";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import passport from "./auth";
import { storage } from "./storage";
import { sessionStore } from "./session-store";
import { requireAuth, requireRole, optionalAuth, requireActiveCleaner } from "./middleware";
import { sendEmail } from "./lib/resend";
import { broadcastJobUpdate } from "./websocket";
import { createJobFinancialRecord, calculateJobFees } from "./financialUtils";
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

const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = file.fieldname === "tradeLicense" ? "licenses" : "proofs";
    const fullPath = path.join(uploadDir, subDir);
    mkdirSync(fullPath, { recursive: true });
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
  
  // Ensure upload directory exists
  mkdirSync(uploadDir, { recursive: true });
  
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
      
      // Create admin user (password hashing handled by storage layer)
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

  // Lookup cleaner by email (public endpoint for checkout validation)
  app.get("/api/cleaners/lookup", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email parameter is required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user || user.role !== UserRole.CLEANER) {
        return res.status(404).json({ message: "Cleaner not found" });
      }
      
      // Get cleaner profile
      const cleaner = await storage.getCleanerByUserId(user.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      // Check if cleaner is active
      if (cleaner.isActive !== 1) {
        return res.status(403).json({ message: "This cleaner is not active" });
      }
      
      // Get company info
      const company = await storage.getCompany(cleaner.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (company.isActive !== 1) {
        return res.status(403).json({ message: "This cleaner's company is not active" });
      }
      
      res.json({
        cleanerId: cleaner.id,
        email: user.email,
        displayName: user.displayName,
        companyId: company.id,
        companyName: company.name,
        isActive: true,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create payment intent and job
  app.post("/api/create-payment-intent", async (req: Request, res: Response) => {
    try {
      const jobData = req.body;
      const tipAmount = Number(jobData.tipAmount || 0);
      const basePrice = Number(jobData.price);
      const requestedCleanerEmail = jobData.requestedCleanerEmail;
      
      // Security: Validate requested cleaner belongs to selected company
      if (requestedCleanerEmail) {
        const user = await storage.getUserByEmail(requestedCleanerEmail);
        if (!user || user.role !== UserRole.CLEANER) {
          return res.status(400).json({ message: "Invalid cleaner email" });
        }
        
        const cleaner = await storage.getCleanerByUserId(user.id);
        if (!cleaner || cleaner.companyId !== parseInt(jobData.companyId)) {
          return res.status(403).json({ message: "Requested cleaner does not belong to selected company" });
        }
        
        if (cleaner.isActive !== 1) {
          return res.status(403).json({ message: "Requested cleaner is not active" });
        }
      }
      
      // Calculate fees and total amount
      const fees = await calculateJobFees(basePrice, tipAmount);
      
      // Create payment intent with total amount (including tip)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(fees.totalAmount * 100), // Convert to fils (AED subunits)
        currency: "aed",
        metadata: {
          carPlateNumber: jobData.carPlateNumber,
          locationAddress: jobData.locationAddress,
          companyId: jobData.companyId,
          tipAmount: tipAmount.toString(),
          requestedCleanerEmail: requestedCleanerEmail || '',
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
        price: basePrice.toString(),
        tipAmount: tipAmount.toString(),
        totalAmount: fees.totalAmount.toString(),
        stripePaymentIntentId: paymentIntent.id,
        status: JobStatus.PENDING_PAYMENT,
        requestedCleanerEmail: requestedCleanerEmail || null,
        assignmentMode: requestedCleanerEmail ? 'direct' : 'pool',
      });

      res.json({ clientSecret: paymentIntent.client_secret, jobId: job.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update payment intent with new tip amount
  app.patch("/api/payment-intents/:paymentIntentId", async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;
      const { tipAmount } = req.body;
      
      // Find the existing job to get the stored base price (prevent tampering)
      const job = await storage.getJobByPaymentIntent(paymentIntentId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Validate job is still in pending payment state
      if (job.status !== JobStatus.PENDING_PAYMENT) {
        return res.status(400).json({ message: "Payment already processed" });
      }
      
      // Validate tip amount
      const tip = Number(tipAmount || 0);
      if (tip < 0) {
        return res.status(400).json({ message: "Tip amount cannot be negative" });
      }
      if (tip > 1000) {
        return res.status(400).json({ message: "Tip amount too large" });
      }
      
      // Use the stored base price from the job (not from client)
      const basePrice = Number(job.price);
      
      // Recalculate fees with new tip amount
      const fees = await calculateJobFees(basePrice, tip);
      
      // Update the Stripe PaymentIntent with new amount
      const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
        amount: Math.round(fees.totalAmount * 100), // Convert to fils
        metadata: {
          tipAmount: tip.toString(),
        },
      });
      
      // Update the job with new tip and total
      await storage.updateJob(job.id, {
        tipAmount: tip.toString(),
        totalAmount: fees.totalAmount.toString(),
      });
      
      // Return updated fees for frontend display
      res.json({
        ...fees,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error('Payment intent update error:', error);
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
          let assignedCleanerId: number | null = null;
          let finalStatus = JobStatus.PAID;
          let finalAssignmentMode = job.assignmentMode;
          
          // Handle direct assignment if requested
          if (job.assignmentMode === 'direct' && job.requestedCleanerEmail) {
            try {
              // Find the requested cleaner
              const user = await storage.getUserByEmail(job.requestedCleanerEmail);
              if (user && user.role === UserRole.CLEANER) {
                const cleaner = await storage.getCleanerByUserId(user.id);
                
                // Validate cleaner belongs to the job's company and is available
                if (cleaner && 
                    cleaner.isActive === 1 && 
                    cleaner.companyId === job.companyId &&
                    cleaner.status === CleanerStatus.ON_DUTY) {
                  
                  // Directly assign to the cleaner immediately
                  assignedCleanerId = cleaner.id;
                  finalStatus = JobStatus.ASSIGNED;
                  await storage.updateJob(job.id, {
                    status: JobStatus.ASSIGNED,
                    cleanerId: cleaner.id,
                    assignedAt: new Date(),
                    directAssignmentAt: new Date(),
                  });
                  
                  // Update cleaner status to busy
                  await storage.updateCleaner(cleaner.id, {
                    status: CleanerStatus.BUSY,
                  });
                } else {
                  // Fall back to pool if cleaner not available
                  const reason = !cleaner ? 'not found' :
                                cleaner.isActive !== 1 ? 'not active' :
                                cleaner.companyId !== job.companyId ? 'wrong company' :
                                cleaner.status === CleanerStatus.BUSY ? 'already busy' :
                                'off duty';
                  console.log(`Requested cleaner ${reason}, falling back to pool`);
                  finalAssignmentMode = 'pool';
                  await storage.updateJob(job.id, {
                    status: JobStatus.PAID,
                    assignmentMode: 'pool',
                    requestedCleanerEmail: null,
                  });
                }
              } else {
                // Fall back to pool if cleaner not found
                console.log('Requested cleaner not found, falling back to pool');
                finalAssignmentMode = 'pool';
                await storage.updateJob(job.id, {
                  status: JobStatus.PAID,
                  assignmentMode: 'pool',
                  requestedCleanerEmail: null,
                });
              }
            } catch (directAssignError) {
              console.error('Direct assignment error, falling back to pool:', directAssignError);
              finalAssignmentMode = 'pool';
              await storage.updateJob(job.id, {
                status: JobStatus.PAID,
                assignmentMode: 'pool',
                requestedCleanerEmail: null,
              });
            }
          } else {
            // Pool mode - just mark as PAID
            await storage.updateJob(job.id, {
              status: JobStatus.PAID,
            });
          }
          
          // Create financial record for this job
          await createJobFinancialRecord(
            job.id,
            job.companyId,
            assignedCleanerId, // Pass cleaner ID if directly assigned
            Number(job.price),
            Number(job.tipAmount || 0),
            new Date()
          );
          
          // Broadcast update to relevant parties
          const updatedJob = await storage.getJob(job.id);
          if (updatedJob) {
            if (finalStatus === JobStatus.ASSIGNED && assignedCleanerId) {
              // Only broadcast to the assigned cleaner
              broadcastJobUpdate(updatedJob);
            } else {
              // Broadcast to all on-duty cleaners (pool mode)
              broadcastJobUpdate(updatedJob);
            }
          }
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
      
      // Create financial record for this job
      await createJobFinancialRecord(
        job.id,
        job.companyId,
        job.cleanerId, // Pass actual cleaner if assigned
        Number(job.price),
        Number(job.tipAmount || 0),
        new Date()
      );
      
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
        rating: parseFloat(rating).toString(),
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
  app.get("/api/cleaner/profile", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.post("/api/cleaner/start-shift", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.post("/api/cleaner/end-shift", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.get("/api/cleaner/shift-status", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.get("/api/cleaner/shift-history", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.post("/api/cleaner/toggle-status", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.post("/api/cleaner/update-location", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const { latitude, longitude } = req.body;
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (cleaner) {
        await storage.updateCleaner(cleaner.id, { 
          currentLatitude: latitude.toString(),
          currentLongitude: longitude.toString(),
          lastLocationUpdate: new Date(),
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
  app.get("/api/cleaner/available-jobs", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.get("/api/cleaner/my-jobs", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.post("/api/cleaner/accept-job/:jobId", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.post("/api/cleaner/start-job/:jobId", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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
  app.post("/api/cleaner/complete-job/:jobId", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
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

  // Deactivate a cleaner
  app.post("/api/company/cleaners/:cleanerId/deactivate", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const cleanerId = parseInt(req.params.cleanerId);
      if (isNaN(cleanerId)) {
        return res.status(400).json({ message: "Invalid cleaner ID" });
      }

      // Get cleaner to verify it belongs to the company
      const cleaner = await storage.getCleaner(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      if (cleaner.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "You can only deactivate cleaners from your own company" });
      }

      // Deactivate the cleaner and set to off-duty
      await storage.updateCleaner(cleanerId, { isActive: 0, status: "off_duty" });

      // Immediately destroy all sessions for this cleaner to force logout
      // The requireActiveCleaner middleware will also catch them on next request
      if (sessionStore.all) {
        try {
          const sessions = await new Promise<any[]>((resolve, reject) => {
            sessionStore.all!((err: any, sessions: any) => {
              if (err) reject(err);
              else resolve(sessions || []);
            });
          });

          // Find and destroy sessions for this cleaner's user
          for (const session of sessions) {
            if (session.passport?.user?.id === cleaner.userId) {
              sessionStore.destroy(session.sid, (err: any) => {
                if (err) console.error('Failed to destroy session:', err);
              });
            }
          }
        } catch (sessionError) {
          console.error('Failed to destroy sessions:', sessionError);
          // Continue anyway - middleware will catch them on next request
        }
      }
      
      res.json({ success: true, message: "Cleaner deactivated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reactivate a cleaner
  app.post("/api/company/cleaners/:cleanerId/reactivate", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const cleanerId = parseInt(req.params.cleanerId);
      if (isNaN(cleanerId)) {
        return res.status(400).json({ message: "Invalid cleaner ID" });
      }

      // Get cleaner to verify it belongs to the company
      const cleaner = await storage.getCleaner(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      if (cleaner.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "You can only reactivate cleaners from your own company" });
      }

      // Reactivate the cleaner
      await storage.updateCleaner(cleanerId, { isActive: 1 });
      
      res.json({ success: true, message: "Cleaner reactivated successfully" });
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

  // Get company geofence
  app.get("/api/company/geofence", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const company = await storage.getCompany(req.user.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json({ geofenceArea: company.geofenceArea || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update company geofence
  app.put("/api/company/geofence", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const { geofenceArea } = req.body;

      // Validate geofenceArea is an array of coordinate pairs
      if (geofenceArea && (!Array.isArray(geofenceArea) || !geofenceArea.every(coord => 
        Array.isArray(coord) && coord.length === 2 && 
        typeof coord[0] === 'number' && typeof coord[1] === 'number'
      ))) {
        return res.status(400).json({ message: "Invalid geofence format. Expected array of [lat, lng] pairs" });
      }

      await storage.updateCompany(req.user.companyId, { geofenceArea });
      
      res.json({ success: true, geofenceArea });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== COMPANY GEOFENCES ROUTES (Multiple Geofences) =====

  // Get all company geofences
  app.get("/api/company/geofences", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const geofences = await storage.getCompanyGeofences(req.user.companyId);
      res.json(geofences);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new geofence
  app.post("/api/company/geofences", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const { name, polygon } = req.body;

      // Validate name
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Validate polygon is an array of coordinate pairs with at least 3 points
      if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
        return res.status(400).json({ message: "Polygon must have at least 3 points" });
      }

      if (!polygon.every((coord: any) => 
        Array.isArray(coord) && coord.length === 2 && 
        typeof coord[0] === 'number' && typeof coord[1] === 'number'
      )) {
        return res.status(400).json({ message: "Invalid polygon format. Expected array of [lat, lng] pairs" });
      }

      // Check for duplicate name
      const existing = await storage.getGeofenceByCompanyAndName(req.user.companyId, name.trim());
      if (existing) {
        return res.status(409).json({ message: "A geofence with this name already exists" });
      }

      const geofence = await storage.createGeofence({
        companyId: req.user.companyId,
        name: name.trim(),
        polygon,
      });

      res.status(201).json(geofence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a geofence (name or polygon)
  app.patch("/api/company/geofences/:geofenceId", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const geofenceId = parseInt(req.params.geofenceId);
      if (isNaN(geofenceId)) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }

      // Verify geofence exists and belongs to the company
      const geofence = await storage.getGeofence(geofenceId);
      if (!geofence) {
        return res.status(404).json({ message: "Geofence not found" });
      }

      if (geofence.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { name, polygon } = req.body;
      const updates: Partial<Pick<typeof geofence, 'name' | 'polygon'>> = {};

      // Validate and add name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ message: "Name must be a non-empty string" });
        }

        // Check for duplicate name (excluding current geofence)
        const existing = await storage.getGeofenceByCompanyAndName(req.user.companyId, name.trim());
        if (existing && existing.id !== geofenceId) {
          return res.status(409).json({ message: "A geofence with this name already exists" });
        }

        updates.name = name.trim();
      }

      // Validate and add polygon if provided
      if (polygon !== undefined) {
        if (!Array.isArray(polygon) || polygon.length < 3) {
          return res.status(400).json({ message: "Polygon must have at least 3 points" });
        }

        if (!polygon.every((coord: any) => 
          Array.isArray(coord) && coord.length === 2 && 
          typeof coord[0] === 'number' && typeof coord[1] === 'number'
        )) {
          return res.status(400).json({ message: "Invalid polygon format. Expected array of [lat, lng] pairs" });
        }

        updates.polygon = polygon;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      await storage.updateGeofence(geofenceId, updates);

      // Fetch and return updated geofence
      const updatedGeofence = await storage.getGeofence(geofenceId);
      res.json(updatedGeofence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a geofence
  app.delete("/api/company/geofences/:geofenceId", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const geofenceId = parseInt(req.params.geofenceId);
      if (isNaN(geofenceId)) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }

      // Verify geofence exists and belongs to the company
      const geofence = await storage.getGeofence(geofenceId);
      if (!geofence) {
        return res.status(404).json({ message: "Geofence not found" });
      }

      if (geofence.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteGeofence(geofenceId);
      res.json({ success: true, message: "Geofence deleted successfully" });
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
        { header: 'Cleaner Name', key: 'cleanerName', width: 20 },
        { header: 'Base Amount', key: 'baseAmount', width: 12 },
        { header: 'Base Tax', key: 'baseTax', width: 12 },
        { header: 'Tip Amount', key: 'tipAmount', width: 12 },
        { header: 'Tip Tax', key: 'tipTax', width: 12 },
        { header: 'Platform Fee', key: 'platformFee', width: 12 },
        { header: 'Platform Tax', key: 'platformTax', width: 12 },
        { header: 'Stripe Fee', key: 'stripeFee', width: 12 },
        { header: 'Gross Amount', key: 'grossAmount', width: 15 },
        { header: 'Net Amount', key: 'netAmount', width: 15 },
      ];
      
      jobs.forEach(job => {
        worksheet.addRow({
          jobId: job.jobId,
          paidAt: new Date(job.paidAt).toLocaleString(),
          cleanerName: job.cleanerName || 'N/A',
          baseAmount: parseFloat(job.baseJobAmount || "0").toFixed(2),
          baseTax: parseFloat(job.baseTax || "0").toFixed(2),
          tipAmount: parseFloat(job.tipAmount || "0").toFixed(2),
          tipTax: parseFloat(job.tipTax || "0").toFixed(2),
          platformFee: parseFloat(job.platformFeeAmount || "0").toFixed(2),
          platformTax: parseFloat(job.platformFeeTax || "0").toFixed(2),
          stripeFee: parseFloat(job.paymentProcessingFeeAmount || "0").toFixed(2),
          grossAmount: parseFloat(job.grossAmount || "0").toFixed(2),
          netAmount: parseFloat(job.netPayableAmount || "0").toFixed(2),
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

// Utility function to check if cleaner is active (on-duty and location updated within last 10 minutes)
function isCleanerActive(cleaner: Cleaner): boolean {
  if (cleaner.status !== CleanerStatus.ON_DUTY) return false;
  if (!cleaner.lastLocationUpdate) return false;
  
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const lastUpdate = new Date(cleaner.lastLocationUpdate);
  return lastUpdate >= tenMinutesAgo;
}
