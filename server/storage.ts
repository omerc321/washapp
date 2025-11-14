import { 
  users, 
  companies, 
  cleaners, 
  jobs,
  cleanerInvitations,
  customers,
  shiftSessions,
  cleanerShifts,
  deviceTokens,
  pushSubscriptions,
  feeSettings,
  jobFinancials,
  companyWithdrawals,
  companyGeofences,
  cleanerGeofenceAssignments,
  transactions,
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
  type CleanerShift,
  type InsertCleanerShift,
  type FeeSetting,
  type InsertFeeSetting,
  type JobFinancials,
  type InsertJobFinancials,
  type JobFinancialsWithCleaner,
  type CompanyWithdrawal,
  type InsertCompanyWithdrawal,
  type CompanyGeofence,
  type InsertCompanyGeofence,
  type CleanerGeofenceAssignment,
  type InsertCleanerGeofenceAssignment,
  type Transaction,
  type InsertTransaction,
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
  createUser(user: Omit<InsertUser, 'passwordHash'> & { password: string }): Promise<User>;
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
  startShift(cleanerId: number, latitude?: number, longitude?: number): Promise<CleanerShift>;
  endShift(cleanerId: number, latitude?: number, longitude?: number): Promise<void>;
  getActiveShift(cleanerId: number): Promise<CleanerShift | undefined>;
  getCleanerShiftHistory(cleanerId: number, filters?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<CleanerShift[]>;
  getCompanyShiftHistory(companyId: number, filters?: {
    cleanerId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Array<CleanerShift & { cleanerName: string }>>;
  
  // Analytics
  getAdminAnalytics(): Promise<any>;
  getCompanyAnalytics(companyId: number): Promise<any>;
  
  // Device token operations (for push notifications)
  registerDeviceToken(userId: number, token: string, platform: string): Promise<void>;
  unregisterDeviceToken(token: string): Promise<void>;
  getUserDeviceTokens(userId: number): Promise<string[]>;
  
  // Push subscription operations (for web push notifications)
  createPushSubscription(data: { userId?: number; customerId?: number; endpoint: string; keys: { p256dh: string; auth: string }; soundEnabled?: number }): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
  updatePushSubscriptionSound(endpoint: string, soundEnabled: number): Promise<void>;
  getPushSubscriptionByEndpoint(endpoint: string): Promise<{ soundEnabled: number } | undefined>;
  getUserPushSubscriptions(userId: number): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string }; soundEnabled: number }>>;
  getCustomerPushSubscriptions(customerId: number): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string }; soundEnabled: number }>>;
  getAllPushSubscriptionsByRole(role: string): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string }; soundEnabled: number }>>;  
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
  
  // Transaction operations
  getCompanyTransactions(companyId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
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
  
  // Company geofence operations
  getCompanyGeofences(companyId: number): Promise<CompanyGeofence[]>;
  getGeofence(id: number): Promise<CompanyGeofence | undefined>;
  createGeofence(geofence: InsertCompanyGeofence): Promise<CompanyGeofence>;
  updateGeofence(id: number, updates: Partial<Pick<CompanyGeofence, 'name' | 'polygon'>>): Promise<void>;
  deleteGeofence(id: number): Promise<void>;
  getGeofenceByCompanyAndName(companyId: number, name: string): Promise<CompanyGeofence | undefined>;
  
  // Cleaner geofence assignment operations
  assignGeofencesToInvitation(invitationId: number, companyId: number, geofenceIds: number[], assignAll: boolean): Promise<void>;
  assignGeofencesToCleaner(cleanerId: number, companyId: number, geofenceIds: number[], assignAll: boolean): Promise<void>;
  transferInvitationGeofencesToCleaner(invitationId: number, cleanerId: number): Promise<void>;
  getCleanerGeofenceAssignments(cleanerId: number): Promise<CompanyGeofence[]>;
  getInvitationGeofenceAssignments(invitationId: number): Promise<CompanyGeofence[]>;
  isCleanerAssignedToGeofence(cleanerId: number, geofenceId: number): Promise<boolean>;
  isCleanerAssignedToAllGeofences(cleanerId: number): Promise<boolean>;
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

  async createUser(userData: Omit<InsertUser, 'passwordHash'> & { password: string }): Promise<User> {
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
      .values([companyData as any])
      .returning();
    
    return company;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<void> {
    await db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id));
  }

  async getNearbyCompanies(lat: number, lon: number): Promise<CompanyWithCleaners[]> {
    console.log(`[Geofence] Customer location: lat=${lat}, lon=${lon}`);
    
    // Get companies with geofences and their on-duty cleaners
    const query = `
      SELECT 
        c.id as company_id,
        c.name,
        c.description,
        c.price_per_wash,
        c.total_jobs_completed,
        c.total_revenue,
        c.rating,
        cg.id as geofence_id,
        cg.polygon,
        COUNT(DISTINCT cl.id) as cleaner_count
      FROM companies c
      INNER JOIN company_geofences cg ON cg.company_id = c.id
      LEFT JOIN cleaners cl ON cl.company_id = c.id 
        AND cl.status = 'on_duty'
        AND cl.last_location_update > NOW() - INTERVAL '10 minutes'
      WHERE c.is_active = 1
      GROUP BY c.id, c.name, c.description, c.price_per_wash, c.total_jobs_completed, 
               c.total_revenue, c.rating, cg.id, cg.polygon
    `;
    
    const result = await pool.query(query);
    const rows = result.rows;
    console.log(`[Geofence] Found ${rows.length} company-geofence combinations from SQL`);

    // Filter companies whose geofences contain the customer location
    const companyMap = new Map<number, CompanyWithCleaners>();
    
    for (const row of rows) {
      const polygon = row.polygon as Array<[number, number]>;
      const cleanerCount = parseInt(row.cleaner_count || '0');
      
      console.log(`[Geofence] Company ${row.company_id} "${row.name}" geofence ${row.geofence_id}: ${cleanerCount} cleaners, ${polygon?.length || 0} vertices`);
      
      // Skip if no on-duty cleaners
      if (cleanerCount === 0) {
        console.log(`[Geofence] ❌ Skip: No on-duty cleaners`);
        continue;
      }
      
      // Validate polygon before checking (minimum 3 vertices)
      if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
        console.warn(`[Geofence] ❌ Skip: Invalid polygon (${polygon?.length || 0} vertices, need 3+)`);
        continue;
      }
      
      // Check if point is inside polygon using ray casting algorithm
      const isInside = this.isPointInPolygon(lat, lon, polygon);
      console.log(`[Geofence] Point-in-polygon check: ${isInside ? '✅ INSIDE' : '❌ OUTSIDE'}`);
      
      if (isInside) {
        const companyId = row.company_id;
        const existing = companyMap.get(companyId);
        
        if (!existing) {
          companyMap.set(companyId, {
            id: row.company_id,
            name: row.name,
            description: row.description,
            pricePerWash: row.price_per_wash,
            adminId: 0,
            tradeLicenseNumber: null,
            tradeLicenseDocumentURL: null,
            isActive: 1,
            totalJobsCompleted: row.total_jobs_completed,
            totalRevenue: row.total_revenue,
            rating: row.rating,
            totalRatings: 0,
            geofenceArea: null,
            createdAt: new Date(),
            onDutyCleanersCount: cleanerCount,
          });
        }
      }
    }
    
    // Sort by rating and total jobs completed
    return Array.from(companyMap.values()).sort((a, b) => {
      // Companies with higher ratings first
      const ratingA = parseFloat(a.rating || '0');
      const ratingB = parseFloat(b.rating || '0');
      if (ratingB !== ratingA) {
        return ratingB - ratingA;
      }
      // Then by total jobs completed
      return (b.totalJobsCompleted || 0) - (a.totalJobsCompleted || 0);
    });
  }

  // Point in polygon algorithm (ray casting)
  private isPointInPolygon(lat: number, lon: number, polygon: Array<[number, number]>): boolean {
    let inside = false;
    const n = polygon.length;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [lat1, lon1] = polygon[i];
      const [lat2, lon2] = polygon[j];
      
      const intersect = ((lon1 > lon) !== (lon2 > lon)) &&
        (lat < (lat2 - lat1) * (lon - lon1) / (lon2 - lon1) + lat1);
      
      if (intersect) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  // Check if location is within any of company's geofences
  async isLocationInCompanyGeofence(companyId: number, lat: number, lon: number): Promise<boolean> {
    const geofences = await this.getCompanyGeofences(companyId);
    
    // Check if location is inside any of the company's geofences
    for (const geofence of geofences) {
      const polygon = geofence.polygon as Array<[number, number]>;
      
      // Validate polygon
      if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
        continue;
      }
      
      if (this.isPointInPolygon(lat, lon, polygon)) {
        return true;
      }
    }
    
    return false;
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

  async getCompanyCleaners(companyId: number, status?: CleanerStatus): Promise<any[]> {
    const conditions = [eq(cleaners.companyId, companyId)];
    
    if (status) {
      conditions.push(eq(cleaners.status, status));
    }
    
    const results = await db
      .select({
        id: cleaners.id,
        userId: cleaners.userId,
        companyId: cleaners.companyId,
        status: cleaners.status,
        isActive: cleaners.isActive,
        currentLatitude: cleaners.currentLatitude,
        currentLongitude: cleaners.currentLongitude,
        lastLocationUpdate: cleaners.lastLocationUpdate,
        totalJobsCompleted: cleaners.totalJobsCompleted,
        averageCompletionTime: cleaners.averageCompletionTime,
        rating: cleaners.rating,
        totalRatings: cleaners.totalRatings,
        createdAt: cleaners.createdAt,
        displayName: users.displayName,
        phoneNumber: users.phoneNumber,
        email: users.email,
      })
      .from(cleaners)
      .leftJoin(users, eq(cleaners.userId, users.id))
      .where(and(...conditions));
    
    return results;
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

  async startShift(cleanerId: number, latitude?: number, longitude?: number): Promise<CleanerShift> {
    // Close any existing open shifts first
    await this.endShift(cleanerId);

    // Get cleaner's company ID
    const cleaner = await this.getCleaner(cleanerId);
    if (!cleaner) {
      throw new Error("Cleaner not found");
    }

    const [shift] = await db
      .insert(cleanerShifts)
      .values({ 
        cleanerId,
        companyId: cleaner.companyId,
        shiftStart: new Date(),
        startLatitude: latitude?.toString(),
        startLongitude: longitude?.toString(),
      })
      .returning();

    await db
      .update(cleaners)
      .set({ 
        status: CleanerStatus.ON_DUTY,
        lastLocationUpdate: new Date(),
      })
      .where(eq(cleaners.id, cleanerId));

    return shift;
  }

  async endShift(cleanerId: number, latitude?: number, longitude?: number): Promise<void> {
    const activeShift = await this.getActiveShift(cleanerId);
    if (!activeShift) return;

    const shiftEnd = new Date();
    const durationMinutes = Math.floor(
      (shiftEnd.getTime() - new Date(activeShift.shiftStart).getTime()) / (1000 * 60)
    );

    await db
      .update(cleanerShifts)
      .set({ 
        shiftEnd, 
        durationMinutes,
        endLatitude: latitude?.toString(),
        endLongitude: longitude?.toString(),
      })
      .where(eq(cleanerShifts.id, activeShift.id));

    await db
      .update(cleaners)
      .set({ status: CleanerStatus.OFF_DUTY })
      .where(eq(cleaners.id, cleanerId));
  }

  async getActiveShift(cleanerId: number): Promise<CleanerShift | undefined> {
    const [shift] = await db
      .select()
      .from(cleanerShifts)
      .where(and(
        eq(cleanerShifts.cleanerId, cleanerId),
        sql`${cleanerShifts.shiftEnd} IS NULL`
      ))
      .orderBy(desc(cleanerShifts.shiftStart))
      .limit(1);
    return shift;
  }

  async getCleanerShiftHistory(cleanerId: number, filters?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<CleanerShift[]> {
    const conditions = [eq(cleanerShifts.cleanerId, cleanerId)];
    
    if (filters?.startDate) {
      conditions.push(gte(cleanerShifts.shiftStart, filters.startDate));
    }
    
    if (filters?.endDate) {
      // Add 1 day to endDate to include the entire day
      const endOfDay = new Date(filters.endDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      conditions.push(sql`${cleanerShifts.shiftStart} < ${endOfDay}`);
    }
    
    return await db
      .select()
      .from(cleanerShifts)
      .where(and(...conditions))
      .orderBy(desc(cleanerShifts.shiftStart))
      .limit(filters?.limit || 100);
  }

  async getCompanyShiftHistory(companyId: number, filters?: {
    cleanerId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Array<CleanerShift & { cleanerName: string }>> {
    const conditions = [eq(cleanerShifts.companyId, companyId)];
    
    if (filters?.cleanerId) {
      conditions.push(eq(cleanerShifts.cleanerId, filters.cleanerId));
    }
    
    if (filters?.startDate) {
      conditions.push(gte(cleanerShifts.shiftStart, filters.startDate));
    }
    
    if (filters?.endDate) {
      // Add 1 day to endDate to include the entire day
      const endOfDay = new Date(filters.endDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      conditions.push(sql`${cleanerShifts.shiftStart} < ${endOfDay}`);
    }

    const results = await db
      .select({
        id: cleanerShifts.id,
        cleanerId: cleanerShifts.cleanerId,
        companyId: cleanerShifts.companyId,
        shiftStart: cleanerShifts.shiftStart,
        shiftEnd: cleanerShifts.shiftEnd,
        durationMinutes: cleanerShifts.durationMinutes,
        startLatitude: cleanerShifts.startLatitude,
        startLongitude: cleanerShifts.startLongitude,
        endLatitude: cleanerShifts.endLatitude,
        endLongitude: cleanerShifts.endLongitude,
        createdAt: cleanerShifts.createdAt,
        cleanerName: users.displayName,
      })
      .from(cleanerShifts)
      .leftJoin(cleaners, eq(cleanerShifts.cleanerId, cleaners.id))
      .leftJoin(users, eq(cleaners.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(cleanerShifts.shiftStart))
      .limit(filters?.limit || 100);

    return results.map(r => ({
      ...r,
      cleanerName: r.cleanerName || 'Unknown',
    }));
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

  // ===== PUSH SUBSCRIPTION OPERATIONS =====
  
  async createPushSubscription(data: { 
    userId?: number; 
    customerId?: number; 
    endpoint: string; 
    keys: { p256dh: string; auth: string };
    soundEnabled?: number;
  }): Promise<void> {
    await db
      .insert(pushSubscriptions)
      .values({
        userId: data.userId || null,
        customerId: data.customerId || null,
        endpoint: data.endpoint,
        keys: data.keys,
        soundEnabled: data.soundEnabled || 0,
      })
      .onConflictDoNothing();
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async updatePushSubscriptionSound(endpoint: string, soundEnabled: number): Promise<void> {
    await db
      .update(pushSubscriptions)
      .set({ soundEnabled })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<{ soundEnabled: number } | undefined> {
    const [sub] = await db
      .select({ soundEnabled: pushSubscriptions.soundEnabled })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    
    return sub ? { soundEnabled: sub.soundEnabled || 0 } : undefined;
  }

  async getUserPushSubscriptions(userId: number): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string }; soundEnabled: number }>> {
    const subs = await db
      .select({
        endpoint: pushSubscriptions.endpoint,
        keys: pushSubscriptions.keys,
        soundEnabled: pushSubscriptions.soundEnabled,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    
    return subs.map(s => ({
      endpoint: s.endpoint,
      keys: s.keys as { p256dh: string; auth: string },
      soundEnabled: s.soundEnabled || 0,
    }));
  }

  async getCustomerPushSubscriptions(customerId: number): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string }; soundEnabled: number }>> {
    const subs = await db
      .select({
        endpoint: pushSubscriptions.endpoint,
        keys: pushSubscriptions.keys,
        soundEnabled: pushSubscriptions.soundEnabled,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.customerId, customerId));
    
    return subs.map(s => ({
      endpoint: s.endpoint,
      keys: s.keys as { p256dh: string; auth: string },
      soundEnabled: s.soundEnabled || 0,
    }));
  }

  async getAllPushSubscriptionsByRole(role: string): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string }; soundEnabled: number }>> {
    const subs = await db
      .select({
        endpoint: pushSubscriptions.endpoint,
        keys: pushSubscriptions.keys,
        soundEnabled: pushSubscriptions.soundEnabled,
      })
      .from(pushSubscriptions)
      .innerJoin(users, eq(pushSubscriptions.userId, users.id))
      .where(eq(users.role, role as any));
    
    return subs.map(s => ({
      endpoint: s.endpoint,
      keys: s.keys as { p256dh: string; auth: string },
      soundEnabled: s.soundEnabled || 0,
    }));
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

  // ===== TRANSACTION OPERATIONS =====

  async getCompanyTransactions(companyId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.companyId, companyId))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [result] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    
    return result;
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

    const paymentSummary = await db
      .select({
        totalPayments: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.companyId, companyId),
        eq(transactions.type, 'payment')
      ));

    const totalRevenue = Number(financialSummary[0]?.totalRevenue || 0);
    const platformFees = Number(financialSummary[0]?.platformFees || 0);
    const paymentProcessingFees = Number(financialSummary[0]?.paymentProcessingFees || 0);
    const taxAmount = Number(financialSummary[0]?.taxAmount || 0);
    const netEarnings = Number(financialSummary[0]?.netEarnings || 0);
    const totalRefunds = Number(refundSummary[0]?.totalRefunds || 0);
    const totalWithdrawals = Number(withdrawalSummary[0]?.totalWithdrawals || 0);
    const pendingWithdrawals = Number(withdrawalSummary[0]?.pendingWithdrawals || 0);
    const totalPayments = Number(paymentSummary[0]?.totalPayments || 0);
    
    // DUAL-LEDGER DESIGN NOTE:
    // This calculation assumes withdrawals (companyWithdrawals table) and payment transactions
    // (transactions table with type='payment') are tracked separately with NO overlap.
    // If withdrawals are migrated to also create transaction records (type='withdrawal'),
    // this will double-count and cause incorrect negative balances.
    // TODO: Future migration to unified signed-amount ledger requires backfill and API updates.
    const availableBalance = netEarnings - totalWithdrawals - pendingWithdrawals - totalPayments;

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
        totalPayments: sql<string>`COALESCE((
          SELECT SUM(${transactions.amount})
          FROM ${transactions}
          WHERE ${transactions.companyId} = ${companies.id}
          AND ${transactions.type} = 'payment'
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
      availableBalance: Number(row.netEarnings || 0) - Number(row.totalWithdrawals || 0) - Number(row.totalPayments || 0),
    }));
  }

  // ===== COMPANY GEOFENCE OPERATIONS =====

  async getCompanyGeofences(companyId: number): Promise<CompanyGeofence[]> {
    const geofences = await db
      .select()
      .from(companyGeofences)
      .where(eq(companyGeofences.companyId, companyId))
      .orderBy(desc(companyGeofences.createdAt));
    return geofences;
  }

  async getGeofence(id: number): Promise<CompanyGeofence | undefined> {
    const [geofence] = await db
      .select()
      .from(companyGeofences)
      .where(eq(companyGeofences.id, id));
    return geofence;
  }

  async createGeofence(geofence: InsertCompanyGeofence): Promise<CompanyGeofence> {
    const [newGeofence] = await db
      .insert(companyGeofences)
      .values([geofence as any])
      .returning();
    return newGeofence;
  }

  async updateGeofence(id: number, updates: Partial<Pick<CompanyGeofence, 'name' | 'polygon'>>): Promise<void> {
    await db
      .update(companyGeofences)
      .set(updates)
      .where(eq(companyGeofences.id, id));
  }

  async deleteGeofence(id: number): Promise<void> {
    await db
      .delete(companyGeofences)
      .where(eq(companyGeofences.id, id));
  }

  async getGeofenceByCompanyAndName(companyId: number, name: string): Promise<CompanyGeofence | undefined> {
    const [geofence] = await db
      .select()
      .from(companyGeofences)
      .where(
        and(
          eq(companyGeofences.companyId, companyId),
          eq(companyGeofences.name, name)
        )
      );
    return geofence;
  }

  // ===== CLEANER GEOFENCE ASSIGNMENT OPERATIONS =====

  async assignGeofencesToInvitation(invitationId: number, companyId: number, geofenceIds: number[], assignAll: boolean): Promise<void> {
    await db
      .delete(cleanerGeofenceAssignments)
      .where(eq(cleanerGeofenceAssignments.invitationId, invitationId));

    if (assignAll) {
      await db
        .insert(cleanerGeofenceAssignments)
        .values({
          invitationId,
          companyId,
          geofenceId: null,
          cleanerId: null,
          assignAll: 1,
        });
    } else if (geofenceIds.length > 0) {
      const values = geofenceIds.map(geofenceId => ({
        invitationId,
        companyId,
        geofenceId,
        cleanerId: null,
        assignAll: 0,
      }));
      await db
        .insert(cleanerGeofenceAssignments)
        .values(values);
    }
  }

  async assignGeofencesToCleaner(cleanerId: number, companyId: number, geofenceIds: number[], assignAll: boolean): Promise<void> {
    await db
      .delete(cleanerGeofenceAssignments)
      .where(eq(cleanerGeofenceAssignments.cleanerId, cleanerId));

    if (assignAll) {
      await db
        .insert(cleanerGeofenceAssignments)
        .values({
          cleanerId,
          companyId,
          geofenceId: null,
          invitationId: null,
          assignAll: 1,
        });
    } else if (geofenceIds.length > 0) {
      const values = geofenceIds.map(geofenceId => ({
        cleanerId,
        companyId,
        geofenceId,
        invitationId: null,
        assignAll: 0,
      }));
      await db
        .insert(cleanerGeofenceAssignments)
        .values(values);
    }
  }

  async transferInvitationGeofencesToCleaner(invitationId: number, cleanerId: number): Promise<void> {
    const invitationAssignments = await db
      .select()
      .from(cleanerGeofenceAssignments)
      .where(eq(cleanerGeofenceAssignments.invitationId, invitationId));

    if (invitationAssignments.length > 0) {
      const cleaner = await this.getCleaner(cleanerId);
      if (!cleaner) return;

      const values = invitationAssignments.map(assignment => ({
        cleanerId,
        companyId: assignment.companyId,
        geofenceId: assignment.geofenceId,
        invitationId: null,
        assignAll: assignment.assignAll,
      }));

      await db
        .insert(cleanerGeofenceAssignments)
        .values(values);

      await db
        .delete(cleanerGeofenceAssignments)
        .where(eq(cleanerGeofenceAssignments.invitationId, invitationId));
    }
  }

  async getCleanerGeofenceAssignments(cleanerId: number): Promise<CompanyGeofence[]> {
    const isAssignedAll = await this.isCleanerAssignedToAllGeofences(cleanerId);
    
    if (isAssignedAll) {
      const cleaner = await this.getCleaner(cleanerId);
      if (!cleaner) return [];
      return await this.getCompanyGeofences(cleaner.companyId);
    }

    const assignments = await db
      .select({
        geofence: companyGeofences,
      })
      .from(cleanerGeofenceAssignments)
      .innerJoin(companyGeofences, eq(cleanerGeofenceAssignments.geofenceId, companyGeofences.id))
      .where(eq(cleanerGeofenceAssignments.cleanerId, cleanerId));

    return assignments.map(a => a.geofence);
  }

  async getInvitationGeofenceAssignments(invitationId: number): Promise<CompanyGeofence[]> {
    const [assignment] = await db
      .select()
      .from(cleanerGeofenceAssignments)
      .where(
        and(
          eq(cleanerGeofenceAssignments.invitationId, invitationId),
          eq(cleanerGeofenceAssignments.assignAll, 1)
        )
      );

    if (assignment) {
      return await this.getCompanyGeofences(assignment.companyId);
    }

    const assignments = await db
      .select({
        geofence: companyGeofences,
      })
      .from(cleanerGeofenceAssignments)
      .innerJoin(companyGeofences, eq(cleanerGeofenceAssignments.geofenceId, companyGeofences.id))
      .where(eq(cleanerGeofenceAssignments.invitationId, invitationId));

    return assignments.map(a => a.geofence);
  }

  async isCleanerAssignedToGeofence(cleanerId: number, geofenceId: number): Promise<boolean> {
    const isAssignedAll = await this.isCleanerAssignedToAllGeofences(cleanerId);
    if (isAssignedAll) return true;

    const [assignment] = await db
      .select()
      .from(cleanerGeofenceAssignments)
      .where(
        and(
          eq(cleanerGeofenceAssignments.cleanerId, cleanerId),
          eq(cleanerGeofenceAssignments.geofenceId, geofenceId)
        )
      );

    return !!assignment;
  }

  async isCleanerAssignedToAllGeofences(cleanerId: number): Promise<boolean> {
    const [assignment] = await db
      .select()
      .from(cleanerGeofenceAssignments)
      .where(
        and(
          eq(cleanerGeofenceAssignments.cleanerId, cleanerId),
          eq(cleanerGeofenceAssignments.assignAll, 1)
        )
      );

    return !!assignment;
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
      soundEnabled: row.sound_enabled || 0,
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
      geofenceArea: row.geofence_area || null,
      createdAt: row.created_at,
    };
  }
  
  private mapCleanerRow(row: any): Cleaner {
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      status: row.status,
      isActive: row.is_active,
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
