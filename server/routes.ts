import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import { mkdir } from "fs/promises";
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
  
  // Upload trade license document
  app.post("/api/upload/trade-license", upload.single("tradeLicense"), async (req: Request, res: Response) => {
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
  
  // Upload job completion proof photo
  app.post("/api/upload/proof-photo", upload.single("proofPhoto"), async (req: Request, res: Response) => {
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
  
  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: err.message });
      }
      res.json({ success: true });
    });
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
      
      // Create company admin user first
      const user = await storage.createUser({
        email,
        password,
        displayName,
        phoneNumber,
        role: UserRole.COMPANY_ADMIN,
      });
      
      // Create company
      const company = await storage.createCompany({
        name: companyName,
        description: companyDescription,
        pricePerWash: parseFloat(pricePerWash),
        adminId: user.id,
        tradeLicenseNumber,
        tradeLicenseDocumentURL,
      });
      
      // Update user with companyId
      await storage.updateUser(user.id, { companyId: company.id });
      const updatedUser = await storage.getUser(user.id);
      
      // Log in the user
      req.login(updatedUser!, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        const { passwordHash, ...userWithoutPassword } = updatedUser!;
        res.json({ user: userWithoutPassword, company });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Register cleaner (requires company selection)
  app.post("/api/auth/register/cleaner", async (req: Request, res: Response) => {
    try {
      const { 
        email,
        password,
        displayName, 
        phoneNumber,
        companyId,
      } = req.body;
      
      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Verify company exists
      const company = await storage.getCompany(parseInt(companyId));
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Create cleaner user
      const user = await storage.createUser({
        email,
        password,
        displayName,
        phoneNumber,
        role: UserRole.CLEANER,
        companyId: parseInt(companyId),
      });
      
      // Create cleaner profile
      const cleaner = await storage.createCleaner({
        userId: user.id,
        companyId: parseInt(companyId),
        status: CleanerStatus.OFF_DUTY,
      });
      
      // Log in the user
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        const { passwordHash, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, cleaner });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // ===== CUSTOMER ROUTES (ANONYMOUS) =====
  
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
  app.get("/api/companies/nearby", async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string) || 0;
      const lon = parseFloat(req.query.lon as string) || 0;
      const maxDistanceMeters = 50;

      const companiesWithCleaners = await storage.getNearbyCompanies(lat, lon, maxDistanceMeters);
      res.json(companiesWithCleaners);
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
        amount: Math.round(jobData.price * 100), // Convert to cents
        currency: "usd",
        metadata: {
          carPlateNumber: jobData.carPlateNumber,
          locationAddress: jobData.locationAddress,
          companyId: jobData.companyId,
        },
      });

      // Create job in database with pending payment status
      const job = await storage.createJob({
        customerId: jobData.customerId || "temp-customer",
        companyId: parseInt(jobData.companyId),
        carPlateNumber: jobData.carPlateNumber,
        locationAddress: jobData.locationAddress,
        locationLatitude: parseFloat(jobData.locationLatitude),
        locationLongitude: parseFloat(jobData.locationLongitude),
        parkingNumber: jobData.parkingNumber,
        customerPhone: jobData.customerPhone,
        price: parseFloat(jobData.price),
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
          // Update job status to PAID
          await storage.updateJob(job.id, {
            status: JobStatus.PAID,
          });
          
          // Broadcast update
          const updatedJob = await storage.getJob(job.id);
          if (updatedJob) broadcastJobUpdate(updatedJob);

          // Assign to closest available cleaner within 50m
          const cleaners = await storage.getCompanyCleaners(job.companyId, CleanerStatus.ON_DUTY);

          if (cleaners.length > 0) {
            // Find the closest on-duty cleaner within 50m
            let closestCleaner: { cleaner: Cleaner; distance: number } | null = null;
            
            for (const cleaner of cleaners) {
              if (cleaner.currentLatitude && cleaner.currentLongitude) {
                const distance = calculateDistance(
                  parseFloat(job.locationLatitude as any),
                  parseFloat(job.locationLongitude as any),
                  parseFloat(cleaner.currentLatitude as any),
                  parseFloat(cleaner.currentLongitude as any)
                );
                
                if (distance <= 50 && (!closestCleaner || distance < closestCleaner.distance)) {
                  closestCleaner = { cleaner, distance };
                }
              }
            }

            if (closestCleaner) {
              await storage.updateJob(job.id, {
                cleanerId: closestCleaner.cleaner.id,
                status: JobStatus.ASSIGNED,
                assignedAt: new Date(),
              });
              
              // Broadcast assignment
              const assignedJob = await storage.getJob(job.id);
              if (assignedJob) broadcastJobUpdate(assignedJob);

              // Update cleaner status
              await storage.updateCleaner(closestCleaner.cleaner.id, {
                status: CleanerStatus.BUSY,
              });

              // Send email notification to cleaner
              const user = await storage.getUser(closestCleaner.cleaner.userId);
              if (user?.email) {
                await sendEmail(
                  user.email,
                  "New Job Assigned",
                  `<h2>New Car Wash Job</h2>
                  <p>Car Plate: ${job.carPlateNumber}</p>
                  <p>Location: ${job.locationAddress}</p>
                  <p>Phone: ${job.customerPhone}</p>`
                );
              }
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

  // Get customer's jobs
  app.get("/api/customer/jobs/:customerId?", async (req: Request, res: Response) => {
    try {
      const customerId = req.params.customerId || req.query.customerId || "temp-customer";
      const jobs = await storage.getJobsByCustomer(customerId as string);
      res.json(jobs);
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

  // Accept job
  app.post("/api/cleaner/accept-job/:jobId", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      await storage.updateJob(parseInt(jobId), {
        cleanerId: cleaner.id,
        status: JobStatus.ASSIGNED,
        assignedAt: new Date(),
      });

      await storage.updateCleaner(cleaner.id, {
        status: CleanerStatus.BUSY,
      });
      
      // Broadcast job assignment
      const assignedJob = await storage.getJob(parseInt(jobId));
      if (assignedJob) broadcastJobUpdate(assignedJob);

      res.json({ success: true });
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
