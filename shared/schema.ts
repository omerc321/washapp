import { pgTable, serial, varchar, text, numeric, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// PostgreSQL Enums
export const userRoleEnum = pgEnum("user_role", ["customer", "cleaner", "company_admin", "admin"]);
export const jobStatusEnum = pgEnum("job_status", ["pending_payment", "paid", "assigned", "in_progress", "completed", "cancelled", "refunded"]);
export const cleanerStatusEnum = pgEnum("cleaner_status", ["on_duty", "off_duty", "busy"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "consumed", "revoked"]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "cash", "bank_transfer"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "completed", "cancelled"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["payment", "refund", "withdrawal"]);

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  photoURL: text("photo_url"),
  phoneNumber: varchar("phone_number", { length: 50 }),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  cleaner: one(cleaners, {
    fields: [users.id],
    references: [cleaners.userId],
  }),
}));

// Customers Table (phone-based profiles)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const customersRelations = relations(customers, ({ many }) => ({
  jobs: many(jobs),
}));

// Companies Table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pricePerWash: numeric("price_per_wash", { precision: 10, scale: 2 }).notNull(),
  adminId: integer("admin_id").notNull(),
  tradeLicenseNumber: varchar("trade_license_number", { length: 100 }),
  tradeLicenseDocumentURL: text("trade_license_document_url"),
  isActive: integer("is_active").notNull().default(0),
  totalJobsCompleted: integer("total_jobs_completed").notNull().default(0),
  totalRevenue: numeric("total_revenue", { precision: 10, scale: 2 }).notNull().default("0"),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  totalRatings: integer("total_ratings").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const companiesRelations = relations(companies, ({ one, many }) => ({
  admin: one(users, {
    fields: [companies.adminId],
    references: [users.id],
  }),
  cleaners: many(cleaners),
  jobs: many(jobs),
}));

// Cleaners Table  
export const cleaners = pgTable("cleaners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  companyId: integer("company_id").notNull(),
  status: cleanerStatusEnum("status").notNull().default("off_duty"),
  currentLatitude: numeric("current_latitude", { precision: 10, scale: 8 }),
  currentLongitude: numeric("current_longitude", { precision: 11, scale: 8 }),
  lastLocationUpdate: timestamp("last_location_update"),
  totalJobsCompleted: integer("total_jobs_completed").notNull().default(0),
  averageCompletionTime: integer("average_completion_time").notNull().default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  totalRatings: integer("total_ratings").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cleanersRelations = relations(cleaners, ({ one, many }) => ({
  user: one(users, {
    fields: [cleaners.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [cleaners.companyId],
    references: [companies.id],
  }),
  jobs: many(jobs),
}));

// Cleaner Invitations Table
export const cleanerInvitations = pgTable("cleaner_invitations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull().unique(),
  status: invitationStatusEnum("status").notNull().default("pending"),
  invitedBy: integer("invited_by").notNull(),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  consumedAt: timestamp("consumed_at"),
});

export const cleanerInvitationsRelations = relations(cleanerInvitations, ({ one }) => ({
  company: one(companies, {
    fields: [cleanerInvitations.companyId],
    references: [companies.id],
  }),
  inviter: one(users, {
    fields: [cleanerInvitations.invitedBy],
    references: [users.id],
  }),
}));

// Jobs Table
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  companyId: integer("company_id").notNull(),
  cleanerId: integer("cleaner_id"),
  
  // Car and location details
  carPlateNumber: varchar("car_plate_number", { length: 50 }).notNull(),
  locationAddress: text("location_address").notNull(),
  locationLatitude: numeric("location_latitude", { precision: 10, scale: 8 }).notNull(),
  locationLongitude: numeric("location_longitude", { precision: 11, scale: 8 }).notNull(),
  parkingNumber: varchar("parking_number", { length: 50 }),
  customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
  
  // Payment and pricing
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  tipAmount: numeric("tip_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeRefundId: varchar("stripe_refund_id", { length: 255 }),
  paymentMethod: paymentMethodEnum("payment_method").default("card"),
  refundedAt: timestamp("refunded_at"),
  refundReason: text("refund_reason"),
  
  // Job status and timing
  status: jobStatusEnum("status").notNull().default("pending_payment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  assignedAt: timestamp("assigned_at"),
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Completion proof
  proofPhotoURL: text("proof_photo_url"),
  
  // Rating and review
  rating: numeric("rating", { precision: 3, scale: 2 }),
  review: text("review"),
  ratingRequestedAt: timestamp("rating_requested_at"),
  ratedAt: timestamp("rated_at"),
});

export const jobsRelations = relations(jobs, ({ one }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  cleaner: one(cleaners, {
    fields: [jobs.cleanerId],
    references: [cleaners.id],
  }),
  customer: one(customers, {
    fields: [jobs.customerId],
    references: [customers.id],
  }),
}));

// Shift Sessions Table (track cleaner work sessions)
export const shiftSessions = pgTable("shift_sessions", {
  id: serial("id").primaryKey(),
  cleanerId: integer("cleaner_id").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  durationMinutes: integer("duration_minutes"),
});

export const shiftSessionsRelations = relations(shiftSessions, ({ one }) => ({
  cleaner: one(cleaners, {
    fields: [shiftSessions.cleanerId],
    references: [cleaners.id],
  }),
}));

// Device Tokens Table (for push notifications)
export const deviceTokens = pgTable("device_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  platform: varchar("platform", { length: 50 }).notNull(), // 'web', 'ios', 'android'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
});

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.userId],
    references: [users.id],
  }),
}));

// Fee Settings Table (platform and payment processing fees)
export const feeSettings = pgTable("fee_settings", {
  id: serial("id").primaryKey(),
  platformFeeRate: numeric("platform_fee_rate", { precision: 5, scale: 4 }).notNull().default("0.10"), // 10% default
  stripePercentRate: numeric("stripe_percent_rate", { precision: 5, scale: 4 }).notNull().default("0.029"), // 2.9%
  stripeFixedFee: numeric("stripe_fixed_fee", { precision: 10, scale: 2 }).notNull().default("0.30"), // $0.30
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Job Financials Table (immutable financial records per job)
export const jobFinancials = pgTable("job_financials", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().unique(),
  companyId: integer("company_id").notNull(),
  cleanerId: integer("cleaner_id"),
  
  // Financial breakdown
  grossAmount: numeric("gross_amount", { precision: 10, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  tipAmount: numeric("tip_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 10, scale: 2 }).notNull(),
  paymentProcessingFeeAmount: numeric("payment_processing_fee_amount", { precision: 10, scale: 2 }).notNull(),
  netPayableAmount: numeric("net_payable_amount", { precision: 10, scale: 2 }).notNull(),
  
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  paidAt: timestamp("paid_at").notNull(),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const jobFinancialsRelations = relations(jobFinancials, ({ one }) => ({
  job: one(jobs, {
    fields: [jobFinancials.jobId],
    references: [jobs.id],
  }),
  company: one(companies, {
    fields: [jobFinancials.companyId],
    references: [companies.id],
  }),
  cleaner: one(cleaners, {
    fields: [jobFinancials.cleanerId],
    references: [cleaners.id],
  }),
}));

// Company Withdrawals Table (track payouts to companies)
export const companyWithdrawals = pgTable("company_withdrawals", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: withdrawalStatusEnum("status").notNull().default("pending"),
  referenceNumber: varchar("reference_number", { length: 255 }), // Bank transfer reference
  note: text("note"),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by"), // Admin user ID who processed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const companyWithdrawalsRelations = relations(companyWithdrawals, ({ one }) => ({
  company: one(companies, {
    fields: [companyWithdrawals.companyId],
    references: [companies.id],
  }),
  processor: one(users, {
    fields: [companyWithdrawals.processedBy],
    references: [users.id],
  }),
}));

// Transactions Table (unified ledger for all financial transactions)
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  referenceNumber: varchar("reference_number", { length: 100 }).notNull().unique(), // Unique transaction reference
  type: transactionTypeEnum("type").notNull(),
  
  // Related entities
  jobId: integer("job_id"),
  companyId: integer("company_id"),
  withdrawalId: integer("withdrawal_id"),
  
  // Financial details
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  
  // External references
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeRefundId: varchar("stripe_refund_id", { length: 255 }),
  
  // Metadata
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  job: one(jobs, {
    fields: [transactions.jobId],
    references: [jobs.id],
  }),
  company: one(companies, {
    fields: [transactions.companyId],
    references: [companies.id],
  }),
  withdrawal: one(companyWithdrawals, {
    fields: [transactions.withdrawalId],
    references: [companyWithdrawals.id],
  }),
}));

// Drizzle Zod Schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const selectUserSchema = createSelectSchema(users);

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  totalJobsCompleted: true,
  totalRevenue: true,
  rating: true,
  totalRatings: true,
});

export const selectCompanySchema = createSelectSchema(companies);

export const insertCleanerSchema = createInsertSchema(cleaners).omit({
  id: true,
  createdAt: true,
  totalJobsCompleted: true,
  averageCompletionTime: true,
  rating: true,
  totalRatings: true,
});

export const selectCleanerSchema = createSelectSchema(cleaners);

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  assignedAt: true,
  startedAt: true,
  completedAt: true,
});

export const selectJobSchema = createSelectSchema(jobs);

export const insertCleanerInvitationSchema = createInsertSchema(cleanerInvitations).omit({
  id: true,
  invitedAt: true,
  consumedAt: true,
});

export const selectCleanerInvitationSchema = createSelectSchema(cleanerInvitations);

// TypeScript Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type Cleaner = typeof cleaners.$inferSelect;
export type InsertCleaner = z.infer<typeof insertCleanerSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type CleanerInvitation = typeof cleanerInvitations.$inferSelect;
export type InsertCleanerInvitation = z.infer<typeof insertCleanerInvitationSchema>;

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

export const selectCustomerSchema = createSelectSchema(customers);

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export const insertShiftSessionSchema = createInsertSchema(shiftSessions).omit({
  id: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
});

export const selectShiftSessionSchema = createSelectSchema(shiftSessions);

export type ShiftSession = typeof shiftSessions.$inferSelect;
export type InsertShiftSession = z.infer<typeof insertShiftSessionSchema>;

export const insertDeviceTokenSchema = createInsertSchema(deviceTokens).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const selectDeviceTokenSchema = createSelectSchema(deviceTokens);

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type InsertDeviceToken = z.infer<typeof insertDeviceTokenSchema>;

export const insertFeeSettingsSchema = createInsertSchema(feeSettings).omit({
  id: true,
  createdAt: true,
});

export const selectFeeSettingsSchema = createSelectSchema(feeSettings);

export type FeeSetting = typeof feeSettings.$inferSelect;
export type InsertFeeSetting = z.infer<typeof insertFeeSettingsSchema>;

export const insertJobFinancialsSchema = createInsertSchema(jobFinancials).omit({
  id: true,
  createdAt: true,
});

export const selectJobFinancialsSchema = createSelectSchema(jobFinancials);

export type JobFinancials = typeof jobFinancials.$inferSelect;
export type InsertJobFinancials = z.infer<typeof insertJobFinancialsSchema>;

export const insertCompanyWithdrawalSchema = createInsertSchema(companyWithdrawals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectCompanyWithdrawalSchema = createSelectSchema(companyWithdrawals);

export type CompanyWithdrawal = typeof companyWithdrawals.$inferSelect;
export type InsertCompanyWithdrawal = z.infer<typeof insertCompanyWithdrawalSchema>;

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const selectTransactionSchema = createSelectSchema(transactions);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Additional validation schemas
export const createJobSchema = z.object({
  carPlateNumber: z.string().min(1, "Plate number is required"),
  locationAddress: z.string().min(1, "Location is required"),
  locationLatitude: z.number(),
  locationLongitude: z.number(),
  parkingNumber: z.string().optional(),
  customerPhone: z.string().min(10, "Valid phone number required"),
  companyId: z.number(),
});

export type CreateJob = z.infer<typeof createJobSchema>;

// Analytics Types
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
  shiftRoster: z.array(z.object({
    cleanerId: z.number(),
    cleanerName: z.string(),
    status: z.string(),
    totalJobsCompleted: z.number(),
    rating: z.number(),
    activeShift: z.object({
      startedAt: z.date(),
      duration: z.number(),
    }).nullable(),
  })).optional(),
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
export const companyWithCleanersSchema = selectCompanySchema.extend({
  onDutyCleanersCount: z.number(),
  distanceInMeters: z.number().optional(),
});

export type CompanyWithCleaners = z.infer<typeof companyWithCleanersSchema>;

// Job Financials with Cleaner Details (for company analytics)
export const jobFinancialsWithCleanerSchema = selectJobFinancialsSchema.extend({
  cleanerName: z.string().nullable(),
  cleanerEmail: z.string().nullable(),
  cleanerPhone: z.string().nullable(),
});

export type JobFinancialsWithCleaner = z.infer<typeof jobFinancialsWithCleanerSchema>;

// Enums for TypeScript
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
