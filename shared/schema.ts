import { pgTable, serial, varchar, text, numeric, timestamp, pgEnum, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// PostgreSQL Enums
export const userRoleEnum = pgEnum("user_role", ["customer", "cleaner", "company_admin", "admin"]);
export const jobStatusEnum = pgEnum("job_status", ["pending_payment", "paid", "assigned", "in_progress", "completed", "cancelled", "refunded", "refunded_unattended"]);
export const cleanerStatusEnum = pgEnum("cleaner_status", ["on_duty", "off_duty", "busy"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "consumed", "revoked"]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "cash", "bank_transfer"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "completed", "cancelled"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["customer_payment", "admin_payment", "refund", "withdrawal"]);
export const transactionDirectionEnum = pgEnum("transaction_direction", ["credit", "debit"]);
export const assignmentModeEnum = pgEnum("assignment_mode", ["pool", "direct"]);
export const companyPackageTypeEnum = pgEnum("company_package_type", ["pay_per_wash", "subscription"]);
export const feePackageTypeEnum = pgEnum("fee_package_type", ["custom", "package1", "package2"]);
export const complaintTypeEnum = pgEnum("complaint_type", ["refund_request", "general"]);
export const complaintStatusEnum = pgEnum("complaint_status", ["pending", "in_progress", "resolved", "refunded"]);
export const offlineJobStatusEnum = pgEnum("offline_job_status", ["in_progress", "completed"]);

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
  soundEnabled: integer("sound_enabled").notNull().default(1),
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

// Customers Table (email-based profiles)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phoneNumber: varchar("phone_number", { length: 50 }),
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
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull().default("3.00"),
  feePackageType: feePackageTypeEnum("fee_package_type").notNull().default("custom"),
  packageType: companyPackageTypeEnum("package_type").notNull().default("pay_per_wash"),
  subscriptionCleanerSlots: integer("subscription_cleaner_slots"),
  adminId: integer("admin_id").notNull(),
  tradeLicenseNumber: varchar("trade_license_number", { length: 100 }),
  tradeLicenseDocumentURL: text("trade_license_document_url"),
  isActive: integer("is_active").notNull().default(0),
  totalJobsCompleted: integer("total_jobs_completed").notNull().default(0),
  totalRevenue: numeric("total_revenue", { precision: 10, scale: 2 }).notNull().default("0"),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  totalRatings: integer("total_ratings").notNull().default(0),
  geofenceArea: jsonb("geofence_area").$type<Array<[number, number]>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const companiesRelations = relations(companies, ({ one, many }) => ({
  admin: one(users, {
    fields: [companies.adminId],
    references: [users.id],
  }),
  cleaners: many(cleaners),
  jobs: many(jobs),
  geofences: many(companyGeofences),
  subscription: one(companySubscriptions, {
    fields: [companies.id],
    references: [companySubscriptions.companyId],
  }),
}));

// Company Geofences Table
export const companyGeofences = pgTable("company_geofences", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  polygon: jsonb("polygon").$type<Array<[number, number]>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const companyGeofencesRelations = relations(companyGeofences, ({ one }) => ({
  company: one(companies, {
    fields: [companyGeofences.companyId],
    references: [companies.id],
  }),
}));

// Company Subscriptions Table
export const companySubscriptions = pgTable("company_subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().unique().references(() => companies.id, { onDelete: "cascade" }),
  cleanerSlots: integer("cleaner_slots").notNull(),
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).notNull(),
  billingCycleStart: timestamp("billing_cycle_start").notNull(),
  billingCycleEnd: timestamp("billing_cycle_end").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const companySubscriptionsRelations = relations(companySubscriptions, ({ one }) => ({
  company: one(companies, {
    fields: [companySubscriptions.companyId],
    references: [companies.id],
  }),
}));

// Cleaners Table  
export const cleaners = pgTable("cleaners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  companyId: integer("company_id").notNull(),
  status: cleanerStatusEnum("status").notNull().default("off_duty"),
  isActive: integer("is_active").notNull().default(1),
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

// Cleaner Geofence Assignments Table
export const cleanerGeofenceAssignments = pgTable("cleaner_geofence_assignments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  geofenceId: integer("geofence_id"),
  cleanerId: integer("cleaner_id"),
  invitationId: integer("invitation_id"),
  assignAll: integer("assign_all").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cleanerGeofenceAssignmentsRelations = relations(cleanerGeofenceAssignments, ({ one }) => ({
  company: one(companies, {
    fields: [cleanerGeofenceAssignments.companyId],
    references: [companies.id],
  }),
  geofence: one(companyGeofences, {
    fields: [cleanerGeofenceAssignments.geofenceId],
    references: [companyGeofences.id],
  }),
  cleaner: one(cleaners, {
    fields: [cleanerGeofenceAssignments.cleanerId],
    references: [cleaners.id],
  }),
  invitation: one(cleanerInvitations, {
    fields: [cleanerGeofenceAssignments.invitationId],
    references: [cleanerInvitations.id],
  }),
}));

// Cleaner Shifts Table - Track shift start/end times
export const cleanerShifts = pgTable("cleaner_shifts", {
  id: serial("id").primaryKey(),
  cleanerId: integer("cleaner_id").notNull().references(() => cleaners.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  shiftStart: timestamp("shift_start").notNull(),
  shiftEnd: timestamp("shift_end"),
  durationMinutes: integer("duration_minutes"),
  startLatitude: numeric("start_latitude", { precision: 10, scale: 8 }),
  startLongitude: numeric("start_longitude", { precision: 11, scale: 8 }),
  endLatitude: numeric("end_latitude", { precision: 10, scale: 8 }),
  endLongitude: numeric("end_longitude", { precision: 11, scale: 8 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cleanerShiftsRelations = relations(cleanerShifts, ({ one }) => ({
  cleaner: one(cleaners, {
    fields: [cleanerShifts.cleanerId],
    references: [cleaners.id],
  }),
  company: one(companies, {
    fields: [cleanerShifts.companyId],
    references: [companies.id],
  }),
}));

// Cleaner Payment Tokens Table - For QR code payment links
export const cleanerPaymentTokens = pgTable("cleaner_payment_tokens", {
  id: serial("id").primaryKey(),
  cleanerId: integer("cleaner_id").notNull().references(() => cleaners.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  isUsed: integer("is_used").notNull().default(0),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cleanerPaymentTokensRelations = relations(cleanerPaymentTokens, ({ one }) => ({
  cleaner: one(cleaners, {
    fields: [cleanerPaymentTokens.cleanerId],
    references: [cleaners.id],
  }),
  company: one(companies, {
    fields: [cleanerPaymentTokens.companyId],
    references: [companies.id],
  }),
}));

// Offline Jobs Table - For manually entered jobs with offline payment
export const offlineJobs = pgTable("offline_jobs", {
  id: serial("id").primaryKey(),
  cleanerId: integer("cleaner_id").notNull().references(() => cleaners.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  carPlateNumber: varchar("car_plate_number", { length: 50 }).notNull(),
  carPlateEmirate: varchar("car_plate_emirate", { length: 50 }),
  carPlateCode: varchar("car_plate_code", { length: 10 }),
  servicePrice: numeric("service_price", { precision: 10, scale: 2 }).notNull(),
  vatAmount: numeric("vat_amount", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  status: offlineJobStatusEnum("status").notNull().default("in_progress"),
  completionPhotoUrl: text("completion_photo_url"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const offlineJobsRelations = relations(offlineJobs, ({ one }) => ({
  cleaner: one(cleaners, {
    fields: [offlineJobs.cleanerId],
    references: [cleaners.id],
  }),
  company: one(companies, {
    fields: [offlineJobs.companyId],
    references: [companies.id],
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
  carPlateEmirate: varchar("car_plate_emirate", { length: 50 }),
  carPlateCode: varchar("car_plate_code", { length: 10 }),
  locationAddress: text("location_address").notNull(),
  locationLatitude: numeric("location_latitude", { precision: 10, scale: 8 }).notNull(),
  locationLongitude: numeric("location_longitude", { precision: 11, scale: 8 }).notNull(),
  parkingNumber: varchar("parking_number", { length: 50 }),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 50 }),
  
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
  receiptNumber: varchar("receipt_number", { length: 50 }).unique(),
  receiptGeneratedAt: timestamp("receipt_generated_at"),
  
  // Job status and timing
  status: jobStatusEnum("status").notNull().default("pending_payment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  assignedAt: timestamp("assigned_at"),
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedStartTime: timestamp("estimated_start_time"),
  estimatedFinishTime: timestamp("estimated_finish_time"),
  
  // Completion proof
  proofPhotoURL: text("proof_photo_url"),
  
  // Rating and review
  rating: numeric("rating", { precision: 3, scale: 2 }),
  review: text("review"),
  ratingRequestedAt: timestamp("rating_requested_at"),
  ratedAt: timestamp("rated_at"),
  
  // Direct assignment
  requestedCleanerEmail: varchar("requested_cleaner_email", { length: 255 }),
  assignmentMode: assignmentModeEnum("assignment_mode").notNull().default("pool"),
  directAssignmentAt: timestamp("direct_assignment_at"),
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

// Push Subscriptions Table (Web Push Notifications)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // For authenticated users (cleaners, company admins, platform admins)
  customerId: integer("customer_id"), // For anonymous customers
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
  soundEnabled: integer("sound_enabled").notNull().default(0), // 0 = off, 1 = on
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [pushSubscriptions.customerId],
    references: [customers.id],
  }),
}));

// Platform Settings Table (company details for receipts)
export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull().default("Washapp.ae"),
  companyAddress: text("company_address").notNull().default("Dubai, United Arab Emirates"),
  vatRegistrationNumber: varchar("vat_registration_number", { length: 100 }).notNull().default(""),
  logoUrl: text("logo_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  baseJobAmount: numeric("base_job_amount", { precision: 10, scale: 2 }).notNull(),
  baseTax: numeric("base_tax", { precision: 10, scale: 2 }).notNull().default("0"),
  tipAmount: numeric("tip_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  tipTax: numeric("tip_tax", { precision: 10, scale: 2 }).notNull().default("0"),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 10, scale: 2 }).notNull(),
  platformFeeTax: numeric("platform_fee_tax", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentProcessingFeeAmount: numeric("payment_processing_fee_amount", { precision: 10, scale: 2 }).notNull(),
  companyStripeFeeShare: numeric("company_stripe_fee_share", { precision: 10, scale: 2 }).notNull().default("0"),
  cleanerStripeFeeShare: numeric("cleaner_stripe_fee_share", { precision: 10, scale: 2 }).notNull().default("0"),
  remainingTip: numeric("remaining_tip", { precision: 10, scale: 2 }).notNull().default("0"),
  grossAmount: numeric("gross_amount", { precision: 10, scale: 2 }).notNull(),
  netPayableAmount: numeric("net_payable_amount", { precision: 10, scale: 2 }).notNull(),
  
  // Legacy fields (kept for backwards compatibility)
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  platformRevenue: numeric("platform_revenue", { precision: 10, scale: 2 }).notNull().default("0"),
  
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
  
  // Enhanced withdrawal tracking
  invoiceUrl: text("invoice_url"), // Uploaded invoice document
  jobCountRequested: integer("job_count_requested"), // Number of jobs being withdrawn
  tipsRequested: numeric("tips_requested", { precision: 10, scale: 2 }).default("0"), // Tips amount being withdrawn
  baseAmount: numeric("base_amount", { precision: 10, scale: 2 }), // Jobs × price per wash
  vatAmount: numeric("vat_amount", { precision: 10, scale: 2 }), // VAT on base amount (5%)
  
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
  direction: transactionDirectionEnum("direction").notNull().default('debit'),
  
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

// Complaints Table
export const complaints = pgTable("complaints", {
  id: serial("id").primaryKey(),
  referenceNumber: varchar("reference_number", { length: 100 }).notNull().unique(),
  
  // Related entities
  jobId: integer("job_id").notNull(),
  companyId: integer("company_id").notNull(),
  customerId: integer("customer_id"),
  
  // Complaint details
  type: complaintTypeEnum("type").notNull(),
  description: text("description").notNull(),
  status: complaintStatusEnum("status").notNull().default("pending"),
  
  // Resolution
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by"), // Admin or company admin user ID
  
  // Refund tracking
  refundedAt: timestamp("refunded_at"),
  refundedBy: integer("refunded_by"), // Admin or company admin user ID
  stripeRefundId: varchar("stripe_refund_id", { length: 255 }),
  
  // Contact info (copied from job for reference)
  customerEmail: varchar("customer_email", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 50 }),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const complaintsRelations = relations(complaints, ({ one }) => ({
  job: one(jobs, {
    fields: [complaints.jobId],
    references: [jobs.id],
  }),
  company: one(companies, {
    fields: [complaints.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [complaints.customerId],
    references: [customers.id],
  }),
  resolver: one(users, {
    fields: [complaints.resolvedBy],
    references: [users.id],
  }),
  refunder: one(users, {
    fields: [complaints.refundedBy],
    references: [users.id],
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

export const insertCompanyGeofenceSchema = createInsertSchema(companyGeofences).omit({
  id: true,
  createdAt: true,
});

export const selectCompanyGeofenceSchema = createSelectSchema(companyGeofences);

export const insertCompanySubscriptionSchema = createInsertSchema(companySubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectCompanySubscriptionSchema = createSelectSchema(companySubscriptions);

export const insertCleanerGeofenceAssignmentSchema = createInsertSchema(cleanerGeofenceAssignments).omit({
  id: true,
  createdAt: true,
});

export const selectCleanerGeofenceAssignmentSchema = createSelectSchema(cleanerGeofenceAssignments);

export const insertCleanerShiftSchema = createInsertSchema(cleanerShifts).omit({
  id: true,
  createdAt: true,
});

export const selectCleanerShiftSchema = createSelectSchema(cleanerShifts);

export const insertCleanerPaymentTokenSchema = createInsertSchema(cleanerPaymentTokens).omit({
  id: true,
  createdAt: true,
});

export const selectCleanerPaymentTokenSchema = createSelectSchema(cleanerPaymentTokens);

export const insertOfflineJobSchema = createInsertSchema(offlineJobs).omit({
  id: true,
  createdAt: true,
});

export const selectOfflineJobSchema = createSelectSchema(offlineJobs);

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

export type CompanyGeofence = typeof companyGeofences.$inferSelect;
export type InsertCompanyGeofence = z.infer<typeof insertCompanyGeofenceSchema>;

export type CompanySubscription = typeof companySubscriptions.$inferSelect;
export type InsertCompanySubscription = z.infer<typeof insertCompanySubscriptionSchema>;

export type CleanerGeofenceAssignment = typeof cleanerGeofenceAssignments.$inferSelect;
export type InsertCleanerGeofenceAssignment = z.infer<typeof insertCleanerGeofenceAssignmentSchema>;

export type CleanerShift = typeof cleanerShifts.$inferSelect;
export type InsertCleanerShift = z.infer<typeof insertCleanerShiftSchema>;
export type CleanerPaymentToken = typeof cleanerPaymentTokens.$inferSelect;
export type InsertCleanerPaymentToken = z.infer<typeof insertCleanerPaymentTokenSchema>;

export type OfflineJob = typeof offlineJobs.$inferSelect;
export type InsertOfflineJob = z.infer<typeof insertOfflineJobSchema>;

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

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const selectPushSubscriptionSchema = createSelectSchema(pushSubscriptions);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

export const insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectPlatformSettingsSchema = createSelectSchema(platformSettings);

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingsSchema>;

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

export const insertComplaintSchema = createInsertSchema(complaints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  referenceNumber: true,
  resolvedAt: true,
  refundedAt: true,
});

export const selectComplaintSchema = createSelectSchema(complaints);

export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;

// Additional validation schemas
export const createJobSchema = z.object({
  carPlateNumber: z.string().min(1, "Plate number is required"),
  carPlateEmirate: z.string().optional(),
  carPlateCode: z.string().optional(),
  locationAddress: z.string().min(1, "Location is required"),
  locationLatitude: z.number(),
  locationLongitude: z.number(),
  parkingNumber: z.string().optional(),
  customerPhone: z.string().min(10, "Valid phone number required"),
  customerEmail: z.string().email("Valid email required").optional(),
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
  totalNetRevenue: z.number(),
  revenueThisMonth: z.number(),
  netRevenueThisMonth: z.number(),
});

export const companyAnalyticsSchema = z.object({
  totalJobsCompleted: z.number(),
  totalRevenue: z.number(),
  totalNetEarnings: z.number(),
  averageRating: z.number(),
  activeCleaners: z.number(),
  jobsThisMonth: z.number(),
  revenueThisMonth: z.number(),
  netEarningsThisMonth: z.number(),
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
  feePackageType: z.enum(['custom', 'package1', 'package2']).nullable(),
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
  CANCELLED = "cancelled",
  REFUNDED = "refunded"
}

export enum OfflineJobStatus {
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed"
}

export enum CleanerStatus {
  ON_DUTY = "on_duty",
  OFF_DUTY = "off_duty",
  BUSY = "busy"
}

export enum CompanyPackageType {
  PAY_PER_WASH = "pay_per_wash",
  SUBSCRIPTION = "subscription"
}

// Password Reset Tokens Table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const selectPasswordResetTokenSchema = createSelectSchema(passwordResetTokens);
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

// Email OTP Verification Table (for anonymous complaint submission)
export const emailOtpVerifications = pgTable("email_otp_verifications", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: integer("verified").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const selectEmailOtpVerificationSchema = createSelectSchema(emailOtpVerifications);
export const insertEmailOtpVerificationSchema = createInsertSchema(emailOtpVerifications).omit({ id: true, createdAt: true, verified: true });
export type EmailOtpVerification = typeof emailOtpVerifications.$inferSelect;
export type InsertEmailOtpVerification = z.infer<typeof insertEmailOtpVerificationSchema>;
