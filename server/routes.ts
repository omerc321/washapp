import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import Stripe from "stripe";
import { adminDb } from "./lib/firebase-admin";
import { sendEmail } from "./lib/resend";
import { calculateDistance } from "./lib/geo-utils";
import { 
  Job, 
  JobStatus, 
  CleanerStatus, 
  Cleaner, 
  Company,
  CompanyWithCleaners,
  AdminAnalytics,
  UserRole
} from "@shared/schema";

// Stripe setup - from javascript_stripe blueprint
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ===== CUSTOMER ROUTES =====
  
  // Get nearby companies with on-duty cleaners within 50m radius
  app.get("/api/companies/nearby", async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string) || 0;
      const lon = parseFloat(req.query.lon as string) || 0;
      const maxDistanceMeters = 50;

      // Get all companies
      const companiesSnapshot = await adminDb.collection("companies").get();
      const companiesWithCleaners: CompanyWithCleaners[] = [];

      for (const companyDoc of companiesSnapshot.docs) {
        const company = companyDoc.data() as Company;
        
        // Get on-duty cleaners for this company
        const cleanersSnapshot = await adminDb
          .collection("cleaners")
          .where("companyId", "==", company.id)
          .where("status", "==", CleanerStatus.ON_DUTY)
          .get();

        if (cleanersSnapshot.size > 0) {
          // Check if any cleaner is within 50m radius
          let minDistance = Infinity;
          for (const cleanerDoc of cleanersSnapshot.docs) {
            const cleaner = cleanerDoc.data() as Cleaner;
            if (cleaner.currentLatitude && cleaner.currentLongitude) {
              const distance = calculateDistance(
                lat,
                lon,
                cleaner.currentLatitude,
                cleaner.currentLongitude
              );
              minDistance = Math.min(minDistance, distance);
            }
          }

          // Only include company if at least one cleaner is within radius
          if (minDistance <= maxDistanceMeters) {
            companiesWithCleaners.push({
              ...company,
              onDutyCleanersCount: cleanersSnapshot.size,
              distanceInMeters: minDistance,
            });
          }
        }
      }

      // Sort by distance
      companiesWithCleaners.sort((a, b) => (a.distanceInMeters || 0) - (b.distanceInMeters || 0));

      res.json(companiesWithCleaners);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create payment intent and job - from javascript_stripe blueprint
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

      // Create job in Firestore with pending payment status
      const jobRef = adminDb.collection("jobs").doc();
      const job: Job = {
        id: jobRef.id,
        customerId: jobData.customerId || "temp-customer",
        companyId: jobData.companyId,
        carPlateNumber: jobData.carPlateNumber,
        locationAddress: jobData.locationAddress,
        locationLatitude: jobData.locationLatitude || 0,
        locationLongitude: jobData.locationLongitude || 0,
        parkingNumber: jobData.parkingNumber,
        customerPhone: jobData.customerPhone,
        price: jobData.price,
        stripePaymentIntentId: paymentIntent.id,
        status: JobStatus.PENDING_PAYMENT,
        createdAt: Date.now(),
      };

      await jobRef.set(job);

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
        // In development without webhook secret, use the event from body
        console.warn('No STRIPE_WEBHOOK_SECRET - skipping signature verification');
        event = req.body;
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Find job by payment intent ID
        const jobsSnapshot = await adminDb
          .collection("jobs")
          .where("stripePaymentIntentId", "==", paymentIntent.id)
          .get();

        if (!jobsSnapshot.empty) {
          const jobDoc = jobsSnapshot.docs[0];
          const job = jobDoc.data() as Job;

          // Update job status to PAID
          await jobDoc.ref.update({
            status: JobStatus.PAID,
          });

          // Assign to closest available cleaner within 50m
          const cleanersSnapshot = await adminDb
            .collection("cleaners")
            .where("companyId", "==", job.companyId)
            .where("status", "==", CleanerStatus.ON_DUTY)
            .get();

          if (!cleanersSnapshot.empty) {
            // Find the closest on-duty cleaner within 50m
            let closestCleaner: { id: string; userId: string; distance: number } | null = null;
            
            for (const cleanerDoc of cleanersSnapshot.docs) {
              const cleaner = cleanerDoc.data() as Cleaner;
              if (cleaner.currentLatitude && cleaner.currentLongitude) {
                const distance = calculateDistance(
                  job.locationLatitude,
                  job.locationLongitude,
                  cleaner.currentLatitude,
                  cleaner.currentLongitude
                );
                
                if (distance <= 50 && (!closestCleaner || distance < closestCleaner.distance)) {
                  closestCleaner = {
                    id: cleaner.id,
                    userId: cleaner.userId,
                    distance,
                  };
                }
              }
            }

            if (closestCleaner) {
              await jobDoc.ref.update({
                cleanerId: closestCleaner.id,
                status: JobStatus.ASSIGNED,
                assignedAt: Date.now(),
              });

              // Update cleaner status
              await adminDb.collection("cleaners").doc(closestCleaner.id).update({
                status: CleanerStatus.BUSY,
              });

              // Send email notification to cleaner
              const userSnapshot = await adminDb.collection("users").doc(closestCleaner.userId).get();
              const user = userSnapshot.data();
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
      // Get customerId from URL params or query
      const customerId = req.params.customerId || req.query.customerId || "temp-customer";

      const jobsSnapshot = await adminDb
        .collection("jobs")
        .where("customerId", "==", customerId)
        .orderBy("createdAt", "desc")
        .get();

      const jobs = jobsSnapshot.docs.map(doc => doc.data() as Job);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== CLEANER ROUTES =====

  // Get cleaner profile
  app.get("/api/cleaner/profile/:userId?", async (req: Request, res: Response) => {
    try {
      // Get userId from URL params or query
      const userId = req.params.userId || req.query.userId || "temp-cleaner";

      const cleanersSnapshot = await adminDb
        .collection("cleaners")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (cleanersSnapshot.empty) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }

      const cleaner = cleanersSnapshot.docs[0].data() as Cleaner;
      res.json(cleaner);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Toggle cleaner availability
  app.post("/api/cleaner/toggle-status", async (req: Request, res: Response) => {
    try {
      const { status, userId } = req.body;

      const cleanersSnapshot = await adminDb
        .collection("cleaners")
        .where("userId", "==", userId || "temp-cleaner")
        .limit(1)
        .get();

      if (!cleanersSnapshot.empty) {
        await cleanersSnapshot.docs[0].ref.update({ status });
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Cleaner not found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get available jobs for cleaner
  app.get("/api/cleaner/available-jobs", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId || "temp-cleaner";

      // Get cleaner's company
      const cleanersSnapshot = await adminDb
        .collection("cleaners")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (cleanersSnapshot.empty) {
        return res.json([]);
      }

      const cleaner = cleanersSnapshot.docs[0].data() as Cleaner;

      // Get paid jobs for this company without a cleaner assigned
      const jobsSnapshot = await adminDb
        .collection("jobs")
        .where("companyId", "==", cleaner.companyId)
        .where("status", "==", JobStatus.PAID)
        .orderBy("createdAt", "desc")
        .get();

      const jobs = jobsSnapshot.docs.map(doc => doc.data() as Job);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get cleaner's active jobs
  app.get("/api/cleaner/my-jobs", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId || "temp-cleaner";

      const cleanersSnapshot = await adminDb
        .collection("cleaners")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (cleanersSnapshot.empty) {
        return res.json([]);
      }

      const cleaner = cleanersSnapshot.docs[0].data() as Cleaner;

      const jobsSnapshot = await adminDb
        .collection("jobs")
        .where("cleanerId", "==", cleaner.id)
        .orderBy("createdAt", "desc")
        .get();

      const jobs = jobsSnapshot.docs.map(doc => doc.data() as Job);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept job
  app.post("/api/cleaner/accept-job/:jobId", async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.body.userId || "temp-cleaner";

      const cleanersSnapshot = await adminDb
        .collection("cleaners")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (cleanersSnapshot.empty) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      const cleaner = cleanersSnapshot.docs[0].data() as Cleaner;
      const jobRef = adminDb.collection("jobs").doc(jobId);

      await jobRef.update({
        cleanerId: cleaner.id,
        status: JobStatus.ASSIGNED,
        assignedAt: Date.now(),
      });

      await cleanersSnapshot.docs[0].ref.update({
        status: CleanerStatus.BUSY,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Start job
  app.post("/api/cleaner/start-job/:jobId", async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      await adminDb.collection("jobs").doc(jobId).update({
        status: JobStatus.IN_PROGRESS,
        startedAt: Date.now(),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Complete job with proof
  app.post("/api/cleaner/complete-job/:jobId", async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { proofPhotoURL, userId } = req.body;

      const jobRef = adminDb.collection("jobs").doc(jobId);
      const jobDoc = await jobRef.get();
      const job = jobDoc.data() as Job;

      await jobRef.update({
        status: JobStatus.COMPLETED,
        completedAt: Date.now(),
        proofPhotoURL,
      });

      // Update cleaner status back to on-duty
      const cleanersSnapshot = await adminDb
        .collection("cleaners")
        .where("userId", "==", userId || "temp-cleaner")
        .limit(1)
        .get();

      if (!cleanersSnapshot.empty) {
        const cleanerDoc = cleanersSnapshot.docs[0];
        const cleaner = cleanerDoc.data() as Cleaner;
        
        await cleanerDoc.ref.update({
          status: CleanerStatus.ON_DUTY,
          totalJobsCompleted: cleaner.totalJobsCompleted + 1,
        });

        // Update company stats
        const companyRef = adminDb.collection("companies").doc(job.companyId);
        const companyDoc = await companyRef.get();
        const company = companyDoc.data() as Company;

        await companyRef.update({
          totalJobsCompleted: company.totalJobsCompleted + 1,
          totalRevenue: company.totalRevenue + job.price,
        });
      }

      // Send completion email to customer
      const customerDoc = await adminDb.collection("users").doc(job.customerId).get();
      const customer = customerDoc.data();
      if (customer?.email) {
        await sendEmail(
          customer.email,
          "Car Wash Completed",
          `<h2>Your car wash is complete!</h2>
          <p>Car Plate: ${job.carPlateNumber}</p>
          <p>Thank you for using our service.</p>`
        );
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== ADMIN ROUTES =====

  // Get admin analytics
  app.get("/api/admin/analytics", async (req: Request, res: Response) => {
    try {
      const companiesSnapshot = await adminDb.collection("companies").get();
      const cleanersSnapshot = await adminDb.collection("cleaners").get();
      const jobsSnapshot = await adminDb.collection("jobs").get();

      const jobs = jobsSnapshot.docs.map(doc => doc.data() as Job);
      const activeJobs = jobs.filter(j => 
        [JobStatus.PAID, JobStatus.ASSIGNED, JobStatus.IN_PROGRESS].includes(j.status)
      );
      const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED);

      const totalRevenue = completedJobs.reduce((sum, job) => sum + job.price, 0);
      
      const now = Date.now();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const revenueThisMonth = completedJobs
        .filter(j => j.completedAt && j.completedAt >= monthStart)
        .reduce((sum, job) => sum + job.price, 0);

      const analytics: AdminAnalytics = {
        totalCompanies: companiesSnapshot.size,
        totalCleaners: cleanersSnapshot.size,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        totalRevenue,
        revenueThisMonth,
      };

      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company analytics
  app.get("/api/company/analytics/:companyId?", async (req: Request, res: Response) => {
    try {
      const companyId = req.params.companyId || req.query.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }

      const companyDoc = await adminDb.collection("companies").doc(companyId as string).get();
      if (!companyDoc.exists) {
        return res.status(404).json({ message: "Company not found" });
      }

      const company = companyDoc.data() as Company;
      
      // Get active cleaners count
      const activeCleanersSnapshot = await adminDb
        .collection("cleaners")
        .where("companyId", "==", companyId)
        .where("status", "in", [CleanerStatus.ON_DUTY, CleanerStatus.BUSY])
        .get();

      // Get jobs this month
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const jobsSnapshot = await adminDb
        .collection("jobs")
        .where("companyId", "==", companyId)
        .where("createdAt", ">=", monthStart)
        .get();

      const monthJobs = jobsSnapshot.docs.map(doc => doc.data() as Job);
      const completedMonthJobs = monthJobs.filter(j => j.status === JobStatus.COMPLETED);
      const revenueThisMonth = completedMonthJobs.reduce((sum, job) => sum + job.price, 0);

      const analytics = {
        totalJobsCompleted: company.totalJobsCompleted,
        totalRevenue: company.totalRevenue,
        averageRating: company.rating,
        activeCleaners: activeCleanersSnapshot.size,
        jobsThisMonth: completedMonthJobs.length,
        revenueThisMonth,
      };

      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
