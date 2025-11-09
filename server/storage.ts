import { 
  users, 
  companies, 
  cleaners, 
  jobs,
  cleanerInvitations,
  customers,
  shiftSessions,
  deviceTokens,
  feeSettings,
  jobFinancials,
  companyWithdrawals,
  type User, 
  type InsertUser,
  type Company,
  type InsertCompany,
  type Cleaner,
  type InsertCleaner,
  type Job,
  type InsertJob,
  type CleanerInvitation,
  type InsertCleanerInvitation,
  type Customer,
  type InsertCustomer,
  type ShiftSession,
  type InsertShiftSession,
  type FeeSetting,
  type InsertFeeSetting,
  type JobFinancials,
  type InsertJobFinancials,
  type JobFinancialsWithCleaner,
  type CompanyWithdrawal,
  type InsertCompanyWithdrawal,
  UserRole,
  JobStatus,
  CleanerStatus,
  type CompanyWithCleaners,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, inArray, isNull, isNotNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { pool } from "./db";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;
  
  // Company operations
  getAllCompanies(): Promise<Company[]>;
  getPendingCompanies(): Promise<Company[]>;
  approveCompany(companyId: number): Promise<void>;
  rejectCompany(companyId: number): Promise<void>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, updates: Partial<Company>): Promise<void>;
  getNearbyCompanies(lat: number, lon: number, maxDistanceMeters: number): Promise<CompanyWithCleaners[]>;
  
  // Transactional company+admin creation
  createCompanyWithAdmin(data: {
    email: string;
    password: string;
    displayName: string;
    phoneNumber?: string;
    companyName: string;
    companyDescription?: string;
    pricePerWash: number;
    tradeLicenseNumber?: string;
    tradeLicenseDocumentURL?: string;
  }): Promise<{ user: User; company: Company }>;
  
  // Cleaner invitation operations
  createInvitation(invitation: InsertCleanerInvitation): Promise<CleanerInvitation>;
  getInvitationByPhone(phoneNumber: string): Promise<CleanerInvitation | undefined>;
  getCompanyInvitations(companyId: number): Promise<CleanerInvitation[]>;
  consumeInvitation(phoneNumber: string): Promise<void>;
  
  // Cleaner operations
  getCleaner(id: number): Promise<Cleaner | undefined>;
  getCleanerByUserId(userId: number): Promise<Cleaner | undefined>;
  createCleaner(cleaner: InsertCleaner): Promise<Cleaner>;
  updateCleaner(id: number, updates: Partial<Cleaner>): Promise<void>;
  getCompanyCleaners(companyId: number, status?: CleanerStatus): Promise<Cleaner[]>;
  
  // Transactional cleaner+user creation
  createCleanerWithUser(data: {
    email: string;
    password: string;
    displayName: string;
    phoneNumber?: string;
    companyId: number;
  }): Promise<{ user: User; cleaner: Cleaner }>;
  
  // Job operations
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  updateJob(id: number, updates: Partial<Job>): Promise<void>;
  getJobsByCustomer(customerId: number): Promise<Job[]>;
  getJobsByPlateNumber(plateNumber: string): Promise<Job[]>;
  getJobsByCleaner(cleanerId: number): Promise<Job[]>;
  getJobsByCompany(companyId: number, status?: JobStatus): Promise<Job[]>;
  getJobByPaymentIntent(paymentIntentId: string): Promise<Job | undefined>;
  acceptJob(jobId: number, cleanerId: number): Promise<boolean>;
  
  // Customer operations
  createOrGetCustomer(phoneNumber: string, displayName?: string): Promise<Customer>;
  getCustomerByPhone(phoneNumber: string): Promise<Customer | undefined>;
  updateCustomerLastLogin(id: number): Promise<void>;
  
  // Shift session operations
  startShift(cleanerId: number): Promise<ShiftSession>;
  endShift(cleanerId: number): Promise<void>;
  getActiveShift(cleanerId: number): Promise<ShiftSession | undefined>;
  getCleanerShiftHistory(cleanerId: number, limit?: number): Promise<ShiftSession[]>;
  
  // Analytics
  getAdminAnalytics(): Promise<any>;
  getCompanyAnalytics(companyId: number): Promise<any>;
  
  // Device token operations (for push notifications)
  registerDeviceToken(userId: number, token: string, platform: string): Promise<void>;
  unregisterDeviceToken(token: string): Promise<void>;
  getUserDeviceTokens(userId: number): Promise<string[]>;
  updateTokenLastUsed(token: string): Promise<void>;
  
  // Financial operations
  getCurrentFeeSettings(): Promise<FeeSetting>;
  createJobFinancials(financials: InsertJobFinancials): Promise<JobFinancials>;
  getJobFinancialsByJobId(jobId: number): Promise<JobFinancials | undefined>;
  getCompanyFinancials(companyId: number, filters?: {
    cleanerId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<JobFinancialsWithCleaner[]>;
  
  // Company withdrawal operations
  createWithdrawal(withdrawal: InsertCompanyWithdrawal): Promise<CompanyWithdrawal>;
  updateWithdrawal(id: number, updates: Partial<CompanyWithdrawal>): Promise<void>;
  getCompanyWithdrawals(companyId: number): Promise<CompanyWithdrawal[]>;
  getAllWithdrawals(): Promise<CompanyWithdrawal[]>;
  
  // Financial aggregations
  getCompanyFinancialSummary(companyId: number): Promise<{
    totalRevenue: number;
    totalRefunds: number;
    platformFees: number;
    paymentProcessingFees: number;
    taxAmount: number;
    netEarnings: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    availableBalance: number;
  }>;
  getAllCompaniesFinancialSummary(): Promise<Array<{
    companyId: number;
    companyName: string;
    totalRevenue: number;
    platformFees: number;
    netEarnings: number;
    totalWithdrawals: number;
    availableBalance: number;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // ===== USER OPERATIONS =====
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = email.toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    return user;
  }

  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    const { password, ...userDataWithoutPassword } = userData;
    const passwordHash = await bcrypt.hash(password, 10);
    
    const [user] = await db
      .insert(users)
      .values({
        ...userDataWithoutPassword,
        passwordHash,
        email: userDataWithoutPassword.email.toLowerCase(),
      })
      .returning();
    
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id));
  }

  // ===== COMPANY OPERATIONS =====
  
  // Transactional company + admin creation
  async createCompanyWithAdmin(data: {
    email: string;
    password: string;
    displayName: string;
    phoneNumber?: string;
    companyName: string;
    companyDescription?: string;
    pricePerWash: number;
    tradeLicenseNumber?: string;
    tradeLicenseDocumentURL?: string;
  }): Promise<{ user: User; company: Company }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create user
      const passwordHash = await bcrypt.hash(data.password, 10);
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, display_name, phone_number, role, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [data.email.toLowerCase(), passwordHash, data.displayName, data.phoneNumber, UserRole.COMPANY_ADMIN]
      );
      const user = userResult.rows[0];
      
      // Create company
      const companyResult = await client.query(
        `INSERT INTO companies (name, description, price_per_wash, admin_id, trade_license_number, trade_license_document_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [data.companyName, data.companyDescription, data.pricePerWash, user.id, data.tradeLicenseNumber, data.tradeLicenseDocumentURL]
      );
      const company = companyResult.rows[0];
      
      // Update user with company_id
      await client.query(
        `UPDATE users SET company_id = $1 WHERE id = $2`,
        [company.id, user.id]
      );
      
      await client.query('COMMIT');
      
      // Fetch updated user
      const updatedUserResult = await client.query('SELECT * FROM users WHERE id = $1', [user.id]);
      const updatedUser = updatedUserResult.rows[0];
      
      return { 
        user: this.mapUserRow(updatedUser), 
        company: this.mapCompanyRow(company) 
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async getPendingCompanies(): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.isActive, 0));
  }

  async approveCompany(companyId: number): Promise<void> {
    await db
      .update(companies)
      .set({ isActive: 1 })
      .where(eq(companies.id, companyId));
  }

  async rejectCompany(companyId: number): Promise<void> {
    // For now, just delete the company. In production, you might want to keep a record
    await db.delete(companies).where(eq(companies.id, companyId));
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(companyData: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values(companyData)
      .returning();
    
    return company;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<void> {
    await db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id));
  }

  async getNearbyCompanies(lat: number, lon: number, maxDistanceMeters: number): Promise<CompanyWithCleaners[]> {
    // Use raw SQL query to avoid Drizzle ORM issues
    const query = `
      SELECT 
        c.id as company_id,
        c.name,
        c.description,
        c.price_per_wash,
        c.total_jobs_completed,
        c.total_revenue,
        c.rating,
        cl.id as cleaner_id,
        cl.current_latitude,
        cl.current_longitude
      FROM companies c
      INNER JOIN cleaners cl ON cl.company_id = c.id
      WHERE cl.status = 'on_duty' 
        AND c.is_active = 1
        AND cl.current_latitude IS NOT NULL
        AND cl.current_longitude IS NOT NULL
        AND cl.last_location_update IS NOT NULL
        AND cl.last_location_update > NOW() - INTERVAL '10 minutes'
    `;
    
    const result = await pool.query(query);
    const rows = result.rows;

    // Calculate distances and filter
    const companyMap = new Map<number, CompanyWithCleaners>();
    
    for (const row of rows) {
      const cleanerLat = parseFloat(row.current_latitude);
      const cleanerLon = parseFloat(row.current_longitude);
      
      const distance = this.calculateDistance(lat, lon, cleanerLat, cleanerLon);
      
      if (distance <= maxDistanceMeters) {
        const companyId = row.company_id;
        const existing = companyMap.get(companyId);
        
        if (!existing) {
          companyMap.set(companyId, {
            id: row.company_id,
            name: row.name,
            description: row.description,
            pricePerWash: row.price_per_wash,
            adminId: 0, // Not needed for nearby companies
            tradeLicenseNumber: null,
            tradeLicenseDocumentURL: null,
            isActive: 1,
            totalJobsCompleted: row.total_jobs_completed,
            totalRevenue: row.total_revenue,
            rating: row.rating,
            totalRatings: 0,
            createdAt: new Date(),
            onDutyCleanersCount: 1,
            distanceInMeters: distance,
          });
        } else {
          existing.onDutyCleanersCount++;
          existing.distanceInMeters = Math.min(existing.distanceInMeters || Infinity, distance);
        }
      }
    }
    
    return Array.from(companyMap.values()).sort((a, b) => 
      (a.distanceInMeters || 0) - (b.distanceInMeters || 0)
    );
  }

  // ===== CLEANER INVITATION OPERATIONS =====
  
  async createInvitation(invitationData: InsertCleanerInvitation): Promise<CleanerInvitation> {
    const [invitation] = await db
      .insert(cleanerInvitations)
      .values(invitationData)
      .returning();
    
    return invitation;
  }

  async getInvitationByPhone(phoneNumber: string): Promise<CleanerInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(cleanerInvitations)
      .where(eq(cleanerInvitations.phoneNumber, phoneNumber));
    
    return invitation;
  }

  async getCompanyInvitations(companyId: number): Promise<CleanerInvitation[]> {
    return await db
      .select()
      .from(cleanerInvitations)
      .where(eq(cleanerInvitations.companyId, companyId))
      .orderBy(desc(cleanerInvitations.invitedAt));
  }

  async consumeInvitation(phoneNumber: string): Promise<void> {
    await db
      .update(cleanerInvitations)
      .set({ 
        status: "consumed",
        consumedAt: new Date()
      })
      .where(eq(cleanerInvitations.phoneNumber, phoneNumber));
  }

  // ===== CLEANER OPERATIONS =====
  
  async getCleaner(id: number): Promise<Cleaner | undefined> {
    const [cleaner] = await db.select().from(cleaners).where(eq(cleaners.id, id));
    return cleaner;
  }

  async getCleanerByUserId(userId: number): Promise<Cleaner | undefined> {
    const [cleaner] = await db.select().from(cleaners).where(eq(cleaners.userId, userId));
    return cleaner;
  }

  async createCleaner(cleanerData: InsertCleaner): Promise<Cleaner> {
    const [cleaner] = await db
      .insert(cleaners)
      .values(cleanerData)
      .returning();
    
    return cleaner;
  }

  async updateCleaner(id: number, updates: Partial<Cleaner>): Promise<void> {
    await db
      .update(cleaners)
      .set(updates)
      .where(eq(cleaners.id, id));
  }

  async getCompanyCleaners(companyId: number, status?: CleanerStatus): Promise<Cleaner[]> {
    if (status) {
      return await db
        .select()
        .from(cleaners)
        .where(and(
          eq(cleaners.companyId, companyId),
          eq(cleaners.status, status)
        ));
    }
    
    return await db
      .select()
      .from(cleaners)
      .where(eq(cleaners.companyId, companyId));
  }
  
  // Transactional cleaner + user creation
  async createCleanerWithUser(data: {
    email: string;
    password: string;
    displayName: string;
    phoneNumber?: string;
    companyId: number;
  }): Promise<{ user: User; cleaner: Cleaner }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create user
      const passwordHash = await bcrypt.hash(data.password, 10);
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, display_name, phone_number, role, company_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [data.email.toLowerCase(), passwordHash, data.displayName, data.phoneNumber, UserRole.CLEANER, data.companyId]
      );
      const user = userResult.rows[0];
      
      // Create cleaner profile
      const cleanerResult = await client.query(
        `INSERT INTO cleaners (user_id, company_id, status, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [user.id, data.companyId, CleanerStatus.OFF_DUTY]
      );
      const cleaner = cleanerResult.rows[0];
      
      await client.query('COMMIT');
      
      return { 
        user: this.mapUserRow(user), 
        cleaner: this.mapCleanerRow(cleaner) 
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ===== JOB OPERATIONS =====
  
  async createJob(jobData: InsertJob): Promise<Job> {
    const [job] = await db
      .insert(jobs)
      .values(jobData)
      .returning();
    
    return job;
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async updateJob(id: number, updates: Partial<Job>): Promise<void> {
    await db
      .update(jobs)
      .set(updates)
      .where(eq(jobs.id, id));
  }

  async getJobsByCustomer(customerId: number): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.customerId, customerId))
      .orderBy(desc(jobs.createdAt));
  }

  async getJobsByPlateNumber(plateNumber: string): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.carPlateNumber, plateNumber.toUpperCase()))
      .orderBy(desc(jobs.createdAt));
  }

  async getJobsByCleaner(cleanerId: number): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.cleanerId, cleanerId))
      .orderBy(desc(jobs.createdAt));
  }

  async getJobsByCompany(companyId: number, status?: JobStatus): Promise<Job[]> {
    if (status) {
      // For PAID status, only return jobs without a cleaner assigned (available jobs)
      if (status === JobStatus.PAID) {
        return await db
          .select()
          .from(jobs)
          .where(and(
            eq(jobs.companyId, companyId),
            eq(jobs.status, status),
            isNull(jobs.cleanerId)
          ))
          .orderBy(desc(jobs.createdAt));
      }
      
      return await db
        .select()
        .from(jobs)
        .where(and(
          eq(jobs.companyId, companyId),
          eq(jobs.status, status)
        ))
        .orderBy(desc(jobs.createdAt));
    }
    
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.companyId, companyId))
      .orderBy(desc(jobs.createdAt));
  }

  async getJobByPaymentIntent(paymentIntentId: string): Promise<Job | undefined> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.stripePaymentIntentId, paymentIntentId));
    
    return job;
  }

  async acceptJob(jobId: number, cleanerId: number): Promise<boolean> {
    const result = await db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(jobs)
        .where(and(
          eq(jobs.id, jobId),
          eq(jobs.status, JobStatus.PAID)
        ))
        .for('update');

      if (!job || job.cleanerId !== null) {
        return false;
      }

      await tx
        .update(jobs)
        .set({
          cleanerId,
          status: JobStatus.ASSIGNED,
          assignedAt: new Date(),
          acceptedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      await tx
        .update(cleaners)
        .set({ status: CleanerStatus.BUSY })
        .where(eq(cleaners.id, cleanerId));

      // Update job_financials with cleanerId
      await tx
        .update(jobFinancials)
        .set({ cleanerId })
        .where(eq(jobFinancials.jobId, jobId));

      return true;
    });

    return result;
  }

  // ===== CUSTOMER OPERATIONS =====

  async createOrGetCustomer(phoneNumber: string, displayName?: string): Promise<Customer> {
    const existing = await this.getCustomerByPhone(phoneNumber);
    if (existing) {
      await this.updateCustomerLastLogin(existing.id);
      return existing;
    }

    const [customer] = await db
      .insert(customers)
      .values({
        phoneNumber,
        displayName,
      })
      .returning();

    return customer;
  }

  async getCustomerByPhone(phoneNumber: string): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.phoneNumber, phoneNumber));
    return customer;
  }

  async updateCustomerLastLogin(id: number): Promise<void> {
    await db
      .update(customers)
      .set({ lastLoginAt: new Date() })
      .where(eq(customers.id, id));
  }

  // ===== SHIFT SESSION OPERATIONS =====

  async startShift(cleanerId: number): Promise<ShiftSession> {
    await this.endShift(cleanerId);

    const [session] = await db
      .insert(shiftSessions)
      .values({ cleanerId })
      .returning();

    await db
      .update(cleaners)
      .set({ 
        status: CleanerStatus.ON_DUTY,
        lastLocationUpdate: new Date(),
      })
      .where(eq(cleaners.id, cleanerId));

    return session;
  }

  async endShift(cleanerId: number): Promise<void> {
    const activeShift = await this.getActiveShift(cleanerId);
    if (!activeShift) return;

    const endedAt = new Date();
    const durationMinutes = Math.floor(
      (endedAt.getTime() - new Date(activeShift.startedAt).getTime()) / (1000 * 60)
    );

    await db
      .update(shiftSessions)
      .set({
        endedAt,
        durationMinutes,
      })
      .where(eq(shiftSessions.id, activeShift.id));

    await db
      .update(cleaners)
      .set({ status: CleanerStatus.OFF_DUTY })
      .where(eq(cleaners.id, cleanerId));
  }

  async getActiveShift(cleanerId: number): Promise<ShiftSession | undefined> {
    const [session] = await db
      .select()
      .from(shiftSessions)
      .where(and(
        eq(shiftSessions.cleanerId, cleanerId),
        sql`${shiftSessions.endedAt} IS NULL`
      ))
      .orderBy(desc(shiftSessions.startedAt))
      .limit(1);
    return session;
  }

  async getCleanerShiftHistory(cleanerId: number, limit: number = 10): Promise<ShiftSession[]> {
    return await db
      .select()
      .from(shiftSessions)
      .where(eq(shiftSessions.cleanerId, cleanerId))
      .orderBy(desc(shiftSessions.startedAt))
      .limit(limit);
  }

  // ===== ANALYTICS =====
  
  async getAdminAnalytics(): Promise<any> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const [totalCompaniesResult] = await db.select({ count: sql<number>`count(*)` }).from(companies);
    const [totalCleanersResult] = await db.select({ count: sql<number>`count(*)` }).from(cleaners);
    const [activeJobsResult] = await db.select({ count: sql<number>`count(*)` }).from(jobs)
      .where(eq(jobs.status, "in_progress"));
    const [completedJobsResult] = await db.select({ count: sql<number>`count(*)` }).from(jobs)
      .where(eq(jobs.status, "completed"));
    // Calculate gross revenue (base + 5% tax + 3 AED platform fee) to match financial reports
    const [totalRevenueResult] = await db.select({ total: sql<number>`sum(${jobs.price} * 1.05 + 3)` }).from(jobs)
      .where(eq(jobs.status, "completed"));
    const [revenueThisMonthResult] = await db.select({ total: sql<number>`sum(${jobs.price} * 1.05 + 3)` }).from(jobs)
      .where(and(
        eq(jobs.status, "completed"),
        gte(jobs.createdAt, firstDayOfMonth)
      ));
    
    return {
      totalCompanies: totalCompaniesResult.count,
      totalCleaners: totalCleanersResult.count,
      activeJobs: activeJobsResult.count,
      completedJobs: completedJobsResult.count,
      totalRevenue: totalRevenueResult.total || 0,
      revenueThisMonth: revenueThisMonthResult.total || 0,
    };
  }

  async getCompanyAnalytics(companyId: number): Promise<any> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    
    // Count active cleaners (on_duty + location update within 10 minutes)
    const [activeCleanersResult] = await db.select({ count: sql<number>`count(*)` }).from(cleaners)
      .where(and(
        eq(cleaners.companyId, companyId),
        eq(cleaners.status, "on_duty"),
        gte(cleaners.lastLocationUpdate, tenMinutesAgo)
      ));
    
    // Count only completed jobs this month (revenue-recognized)
    const [jobsThisMonthResult] = await db.select({ count: sql<number>`count(*)` }).from(jobs)
      .where(and(
        eq(jobs.companyId, companyId),
        eq(jobs.status, "completed"),
        gte(jobs.createdAt, firstDayOfMonth)
      ));
    
    // Use job_financials for accurate revenue tracking
    const [totalRevenueResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(${jobFinancials.grossAmount}), 0)::text` 
    }).from(jobFinancials)
      .where(eq(jobFinancials.companyId, companyId));
    
    const [revenueThisMonthResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(${jobFinancials.grossAmount}), 0)::text` 
    }).from(jobFinancials)
      .where(and(
        eq(jobFinancials.companyId, companyId),
        gte(jobFinancials.paidAt, firstDayOfMonth)
      ));
    
    // Get shift roster with optimized query (joins cleaners + users + active shifts)
    const shiftRosterData = await db
      .select({
        cleanerId: cleaners.id,
        cleanerName: users.displayName,
        status: cleaners.status,
        totalJobsCompleted: cleaners.totalJobsCompleted,
        rating: cleaners.rating,
        userId: cleaners.userId,
      })
      .from(cleaners)
      .leftJoin(users, eq(cleaners.userId, users.id))
      .where(eq(cleaners.companyId, companyId));
    
    // Batch fetch active shifts for all cleaners (skip if no cleaners)
    const cleanerIds = shiftRosterData.map(c => c.cleanerId);
    const activeShifts = cleanerIds.length > 0 
      ? await db
          .select()
          .from(shiftSessions)
          .where(and(
            inArray(shiftSessions.cleanerId, cleanerIds),
            isNull(shiftSessions.endedAt)
          ))
      : [];
    
    // Map active shifts by cleanerId for quick lookup
    const shiftsMap = new Map(activeShifts.map(s => [s.cleanerId, s]));
    
    const shiftRoster = shiftRosterData.map(cleaner => {
      const activeShift = shiftsMap.get(cleaner.cleanerId);
      return {
        cleanerId: cleaner.cleanerId,
        cleanerName: cleaner.cleanerName || 'Unknown',
        status: cleaner.status,
        totalJobsCompleted: cleaner.totalJobsCompleted,
        rating: parseFloat(cleaner.rating as any) || 0,
        activeShift: activeShift ? {
          startedAt: activeShift.startedAt,
          duration: Math.floor((now.getTime() - new Date(activeShift.startedAt).getTime()) / 60000),
        } : null,
      };
    });
    
    return {
      totalJobsCompleted: company?.totalJobsCompleted || 0,
      totalRevenue: parseFloat(totalRevenueResult.total || "0"),
      averageRating: parseFloat(company?.rating as any) || 0,
      activeCleaners: activeCleanersResult.count,
      jobsThisMonth: jobsThisMonthResult.count,
      revenueThisMonth: parseFloat(revenueThisMonthResult.total || "0"),
      shiftRoster,
    };
  }

  // ===== UTILITY METHODS =====
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  
  // Map database rows to TypeScript types
  // ===== DEVICE TOKEN OPERATIONS =====
  
  async registerDeviceToken(userId: number, token: string, platform: string): Promise<void> {
    // Use upsert to update lastUsedAt if token already exists
    await db
      .insert(deviceTokens)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { lastUsedAt: new Date() }
      });
  }

  async unregisterDeviceToken(token: string): Promise<void> {
    await db
      .delete(deviceTokens)
      .where(eq(deviceTokens.token, token));
  }

  async getUserDeviceTokens(userId: number): Promise<string[]> {
    const tokens = await db
      .select({ token: deviceTokens.token })
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId));
    
    return tokens.map(t => t.token);
  }

  async updateTokenLastUsed(token: string): Promise<void> {
    await db
      .update(deviceTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(deviceTokens.token, token));
  }

  // ===== FINANCIAL OPERATIONS =====
  
  async getCurrentFeeSettings(): Promise<FeeSetting> {
    const [settings] = await db
      .select()
      .from(feeSettings)
      .orderBy(desc(feeSettings.effectiveFrom))
      .limit(1);
    
    if (!settings) {
      throw new Error("Fee settings not found");
    }
    
    return settings;
  }

  async createJobFinancials(financials: InsertJobFinancials): Promise<JobFinancials> {
    const [result] = await db
      .insert(jobFinancials)
      .values(financials)
      .returning();
    
    return result;
  }

  async getJobFinancialsByJobId(jobId: number): Promise<JobFinancials | undefined> {
    const [result] = await db
      .select()
      .from(jobFinancials)
      .where(eq(jobFinancials.jobId, jobId));
    
    return result;
  }

  async getCompanyFinancials(
    companyId: number,
    filters?: {
      cleanerId?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<JobFinancialsWithCleaner[]> {
    const conditions = [eq(jobFinancials.companyId, companyId)];

    if (filters?.cleanerId) {
      conditions.push(eq(jobFinancials.cleanerId, filters.cleanerId));
    }

    if (filters?.startDate) {
      conditions.push(gte(jobFinancials.paidAt, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(sql`${jobFinancials.paidAt} <= ${filters.endDate}`);
    }

    // Join with cleaners and users to get cleaner details
    const results = await db
      .select({
        id: jobFinancials.id,
        jobId: jobFinancials.jobId,
        companyId: jobFinancials.companyId,
        cleanerId: jobFinancials.cleanerId,
        baseJobAmount: jobFinancials.baseJobAmount,
        baseTax: jobFinancials.baseTax,
        tipAmount: jobFinancials.tipAmount,
        tipTax: jobFinancials.tipTax,
        platformFeeAmount: jobFinancials.platformFeeAmount,
        platformFeeTax: jobFinancials.platformFeeTax,
        paymentProcessingFeeAmount: jobFinancials.paymentProcessingFeeAmount,
        grossAmount: jobFinancials.grossAmount,
        netPayableAmount: jobFinancials.netPayableAmount,
        taxAmount: jobFinancials.taxAmount,
        platformRevenue: jobFinancials.platformRevenue,
        currency: jobFinancials.currency,
        paidAt: jobFinancials.paidAt,
        refundedAt: jobFinancials.refundedAt,
        createdAt: jobFinancials.createdAt,
        cleanerName: users.displayName,
        cleanerEmail: users.email,
        cleanerPhone: users.phoneNumber,
      })
      .from(jobFinancials)
      .leftJoin(cleaners, eq(jobFinancials.cleanerId, cleaners.id))
      .leftJoin(users, eq(cleaners.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(jobFinancials.paidAt));

    return results;
  }

  // ===== COMPANY WITHDRAWAL OPERATIONS =====

  async createWithdrawal(withdrawal: InsertCompanyWithdrawal): Promise<CompanyWithdrawal> {
    const [result] = await db
      .insert(companyWithdrawals)
      .values(withdrawal)
      .returning();
    
    return result;
  }

  async updateWithdrawal(id: number, updates: Partial<CompanyWithdrawal>): Promise<void> {
    await db
      .update(companyWithdrawals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companyWithdrawals.id, id));
  }

  async getCompanyWithdrawals(companyId: number): Promise<CompanyWithdrawal[]> {
    return await db
      .select()
      .from(companyWithdrawals)
      .where(eq(companyWithdrawals.companyId, companyId))
      .orderBy(desc(companyWithdrawals.createdAt));
  }

  async getAllWithdrawals(): Promise<CompanyWithdrawal[]> {
    return await db
      .select()
      .from(companyWithdrawals)
      .orderBy(desc(companyWithdrawals.createdAt));
  }

  // ===== FINANCIAL AGGREGATIONS =====

  async getCompanyFinancialSummary(companyId: number): Promise<{
    totalRevenue: number;
    totalRefunds: number;
    platformFees: number;
    paymentProcessingFees: number;
    taxAmount: number;
    netEarnings: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    availableBalance: number;
  }> {
    const financialSummary = await db
      .select({
        totalRevenue: sql<string>`COALESCE(SUM(${jobFinancials.grossAmount}), 0)::text`,
        platformFees: sql<string>`COALESCE(SUM(${jobFinancials.platformFeeAmount}::numeric * 1.05), 0)::text`,
        paymentProcessingFees: sql<string>`COALESCE(SUM(${jobFinancials.paymentProcessingFeeAmount}), 0)::text`,
        taxAmount: sql<string>`COALESCE(SUM(${jobFinancials.baseTax}) + SUM(${jobFinancials.tipTax}), 0)::text`,
        netEarnings: sql<string>`COALESCE(SUM(${jobFinancials.netPayableAmount}), 0)::text`,
      })
      .from(jobFinancials)
      .where(eq(jobFinancials.companyId, companyId));

    // Calculate refunds from jobs with status='refunded'
    const refundSummary = await db
      .select({
        totalRefunds: sql<string>`COALESCE(SUM(${jobs.price}), 0)::text`,
      })
      .from(jobs)
      .where(and(
        eq(jobs.companyId, companyId),
        eq(jobs.status, 'refunded')
      ));

    const withdrawalSummary = await db
      .select({
        totalWithdrawals: sql<string>`COALESCE(SUM(CASE WHEN ${companyWithdrawals.status} = 'completed' THEN ${companyWithdrawals.amount} ELSE 0 END), 0)::text`,
        pendingWithdrawals: sql<string>`COALESCE(SUM(CASE WHEN ${companyWithdrawals.status} = 'pending' THEN ${companyWithdrawals.amount} ELSE 0 END), 0)::text`,
      })
      .from(companyWithdrawals)
      .where(eq(companyWithdrawals.companyId, companyId));

    const totalRevenue = Number(financialSummary[0]?.totalRevenue || 0);
    const platformFees = Number(financialSummary[0]?.platformFees || 0);
    const paymentProcessingFees = Number(financialSummary[0]?.paymentProcessingFees || 0);
    const taxAmount = Number(financialSummary[0]?.taxAmount || 0);
    const netEarnings = Number(financialSummary[0]?.netEarnings || 0);
    const totalRefunds = Number(refundSummary[0]?.totalRefunds || 0);
    const totalWithdrawals = Number(withdrawalSummary[0]?.totalWithdrawals || 0);
    const pendingWithdrawals = Number(withdrawalSummary[0]?.pendingWithdrawals || 0);
    const availableBalance = netEarnings - totalWithdrawals - pendingWithdrawals;

    return {
      totalRevenue,
      totalRefunds,
      platformFees,
      paymentProcessingFees,
      taxAmount,
      netEarnings,
      totalWithdrawals,
      pendingWithdrawals,
      availableBalance,
    };
  }

  async getAllCompaniesFinancialSummary(): Promise<Array<{
    companyId: number;
    companyName: string;
    totalRevenue: number;
    platformFees: number;
    netEarnings: number;
    totalWithdrawals: number;
    availableBalance: number;
  }>> {
    const result = await db
      .select({
        companyId: companies.id,
        companyName: companies.name,
        totalRevenue: sql<string>`COALESCE(SUM(${jobFinancials.grossAmount}), 0)::text`,
        platformFees: sql<string>`COALESCE(SUM(${jobFinancials.platformFeeAmount}::numeric * 1.05), 0)::text`,
        netEarnings: sql<string>`COALESCE(SUM(${jobFinancials.netPayableAmount}), 0)::text`,
        totalWithdrawals: sql<string>`COALESCE((
          SELECT SUM(${companyWithdrawals.amount})
          FROM ${companyWithdrawals}
          WHERE ${companyWithdrawals.companyId} = ${companies.id}
          AND ${companyWithdrawals.status} = 'completed'
        ), 0)::text`,
      })
      .from(companies)
      .leftJoin(jobFinancials, eq(jobFinancials.companyId, companies.id))
      .where(eq(companies.isActive, 1))
      .groupBy(companies.id, companies.name);

    return result.map(row => ({
      companyId: row.companyId,
      companyName: row.companyName,
      totalRevenue: Number(row.totalRevenue || 0),
      platformFees: Number(row.platformFees || 0),
      netEarnings: Number(row.netEarnings || 0),
      totalWithdrawals: Number(row.totalWithdrawals || 0),
      availableBalance: Number(row.netEarnings || 0) - Number(row.totalWithdrawals || 0),
    }));
  }

  // ===== HELPER METHODS =====

  private mapUserRow(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      role: row.role,
      photoURL: row.photo_url,
      phoneNumber: row.phone_number,
      companyId: row.company_id,
      createdAt: row.created_at,
    };
  }
  
  private mapCompanyRow(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      pricePerWash: row.price_per_wash,
      adminId: row.admin_id,
      tradeLicenseNumber: row.trade_license_number,
      tradeLicenseDocumentURL: row.trade_license_document_url,
      isActive: row.is_active,
      totalJobsCompleted: row.total_jobs_completed,
      totalRevenue: row.total_revenue,
      rating: row.rating,
      totalRatings: row.total_ratings,
      createdAt: row.created_at,
    };
  }
  
  private mapCleanerRow(row: any): Cleaner {
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      status: row.status,
      currentLatitude: row.current_latitude,
      currentLongitude: row.current_longitude,
      lastLocationUpdate: row.last_location_update,
      totalJobsCompleted: row.total_jobs_completed,
      averageCompletionTime: row.average_completion_time,
      rating: row.rating,
      totalRatings: row.total_ratings,
      createdAt: row.created_at,
    };
  }
}

export const storage = new DatabaseStorage();
