import { z } from "zod";

// Enums for user roles and job statuses
export enum UserRole {
  CUSTOMER = "customer",
  CLEANER = "cleaner",
  COMPANY_ADMIN = "company_admin",
  ADMIN = "admin"
}

export enum JobStatus {
  PENDING_PAYMENT = "pending_payment",
  PAID = "paid",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}

export enum CleanerStatus {
  ON_DUTY = "on_duty",
  OFF_DUTY = "off_duty",
  BUSY = "busy"
}

// User Schema
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.nativeEnum(UserRole),
  photoURL: z.string().optional(),
  phoneNumber: z.string().optional(),
  createdAt: z.number(),
  companyId: z.string().optional(), // For company_admin and cleaner
});

export const insertUserSchema = userSchema.omit({ id: true, createdAt: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Company Schema
export const companySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  pricePerWash: z.number(),
  adminId: z.string(),
  tradeLicenseNumber: z.string().optional(),
  tradeLicenseDocumentURL: z.string().optional(),
  totalJobsCompleted: z.number().default(0),
  totalRevenue: z.number().default(0),
  rating: z.number().default(0),
  totalRatings: z.number().default(0),
  createdAt: z.number(),
});

export const insertCompanySchema = companySchema.omit({ 
  id: true, 
  createdAt: true,
  totalJobsCompleted: true,
  totalRevenue: true,
  rating: true,
  totalRatings: true
});

export type Company = z.infer<typeof companySchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

// Cleaner Schema
export const cleanerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  companyId: z.string(),
  status: z.nativeEnum(CleanerStatus),
  currentLatitude: z.number().optional(),
  currentLongitude: z.number().optional(),
  totalJobsCompleted: z.number().default(0),
  averageCompletionTime: z.number().default(0), // in minutes
  rating: z.number().default(0),
  totalRatings: z.number().default(0),
  createdAt: z.number(),
});

export const insertCleanerSchema = cleanerSchema.omit({ 
  id: true, 
  createdAt: true,
  totalJobsCompleted: true,
  averageCompletionTime: true,
  rating: true,
  totalRatings: true
});

export type Cleaner = z.infer<typeof cleanerSchema>;
export type InsertCleaner = z.infer<typeof insertCleanerSchema>;

// Job Schema
export const jobSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  companyId: z.string(),
  cleanerId: z.string().optional(),
  
  // Car and location details
  carPlateNumber: z.string(),
  locationAddress: z.string(),
  locationLatitude: z.number(),
  locationLongitude: z.number(),
  parkingNumber: z.string().optional(),
  customerPhone: z.string(),
  
  // Payment and pricing
  price: z.number(),
  stripePaymentIntentId: z.string().optional(),
  
  // Job status and timing
  status: z.nativeEnum(JobStatus),
  createdAt: z.number(),
  assignedAt: z.number().optional(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  
  // Completion proof
  proofPhotoURL: z.string().optional(),
  
  // Rating and review
  rating: z.number().optional(),
  review: z.string().optional(),
});

export const insertJobSchema = jobSchema.omit({ 
  id: true, 
  createdAt: true,
  assignedAt: true,
  startedAt: true,
  completedAt: true
});

export const createJobSchema = z.object({
  carPlateNumber: z.string().min(1, "Plate number is required"),
  locationAddress: z.string().min(1, "Location is required"),
  locationLatitude: z.number(),
  locationLongitude: z.number(),
  parkingNumber: z.string().optional(),
  customerPhone: z.string().min(10, "Valid phone number required"),
  companyId: z.string(),
});

export type Job = z.infer<typeof jobSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type CreateJob = z.infer<typeof createJobSchema>;

// Analytics Schemas
export const adminAnalyticsSchema = z.object({
  totalCompanies: z.number(),
  totalCleaners: z.number(),
  activeJobs: z.number(),
  completedJobs: z.number(),
  totalRevenue: z.number(),
  revenueThisMonth: z.number(),
});

export const companyAnalyticsSchema = z.object({
  totalJobsCompleted: z.number(),
  totalRevenue: z.number(),
  averageRating: z.number(),
  activeCleaners: z.number(),
  jobsThisMonth: z.number(),
  revenueThisMonth: z.number(),
});

export const cleanerAnalyticsSchema = z.object({
  totalJobsCompleted: z.number(),
  averageCompletionTime: z.number(),
  rating: z.number(),
  totalRatings: z.number(),
  earningsThisMonth: z.number(),
});

export type AdminAnalytics = z.infer<typeof adminAnalyticsSchema>;
export type CompanyAnalytics = z.infer<typeof companyAnalyticsSchema>;
export type CleanerAnalytics = z.infer<typeof cleanerAnalyticsSchema>;

// Company with cleaner count (for customer selection)
export const companyWithCleanersSchema = companySchema.extend({
  onDutyCleanersCount: z.number(),
  distanceInMeters: z.number().optional(),
});

export type CompanyWithCleaners = z.infer<typeof companyWithCleanersSchema>;
