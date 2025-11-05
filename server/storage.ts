import { 
  users, 
  companies, 
  cleaners, 
  jobs,
  type User, 
  type InsertUser,
  type Company,
  type InsertCompany,
  type Cleaner,
  type InsertCleaner,
  type Job,
  type InsertJob,
  UserRole,
  JobStatus,
  CleanerStatus,
  type CompanyWithCleaners,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;
  
  // Company operations
  getAllCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, updates: Partial<Company>): Promise<void>;
  getNearbyCompanies(lat: number, lon: number, maxDistanceMeters: number): Promise<CompanyWithCleaners[]>;
  
  // Cleaner operations
  getCleaner(id: number): Promise<Cleaner | undefined>;
  getCleanerByUserId(userId: number): Promise<Cleaner | undefined>;
  createCleaner(cleaner: InsertCleaner): Promise<Cleaner>;
  updateCleaner(id: number, updates: Partial<Cleaner>): Promise<void>;
  getCompanyCleaners(companyId: number, status?: CleanerStatus): Promise<Cleaner[]>;
  
  // Job operations
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  updateJob(id: number, updates: Partial<Job>): Promise<void>;
  getJobsByCustomer(customerId: string): Promise<Job[]>;
  getJobsByCleaner(cleanerId: number): Promise<Job[]>;
  getJobsByCompany(companyId: number, status?: JobStatus): Promise<Job[]>;
  getJobByPaymentIntent(paymentIntentId: string): Promise<Job | undefined>;
  
  // Analytics
  getAdminAnalytics(): Promise<any>;
  getCompanyAnalytics(companyId: number): Promise<any>;
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
  
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
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
    // Get all companies with on-duty cleaners
    const companiesWithCleaners = await db
      .select({
        company: companies,
        cleaner: cleaners,
      })
      .from(companies)
      .innerJoin(cleaners, eq(cleaners.companyId, companies.id))
      .where(eq(cleaners.status, "on_duty"));

    // Calculate distances and filter
    const companyMap = new Map<number, CompanyWithCleaners>();
    
    for (const row of companiesWithCleaners) {
      const { company, cleaner } = row;
      
      if (cleaner.currentLatitude && cleaner.currentLongitude) {
        const distance = this.calculateDistance(
          lat,
          lon,
          parseFloat(cleaner.currentLatitude as any),
          parseFloat(cleaner.currentLongitude as any)
        );
        
        if (distance <= maxDistanceMeters) {
          const existing = companyMap.get(company.id);
          
          if (!existing) {
            companyMap.set(company.id, {
              ...company,
              onDutyCleanersCount: 1,
              distanceInMeters: distance,
            });
          } else {
            existing.onDutyCleanersCount++;
            existing.distanceInMeters = Math.min(existing.distanceInMeters || Infinity, distance);
          }
        }
      }
    }
    
    return Array.from(companyMap.values()).sort((a, b) => 
      (a.distanceInMeters || 0) - (b.distanceInMeters || 0)
    );
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

  async getJobsByCustomer(customerId: string): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.customerId, customerId))
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
    const [totalRevenueResult] = await db.select({ total: sql<number>`sum(${jobs.price})` }).from(jobs)
      .where(eq(jobs.status, "completed"));
    const [revenueThisMonthResult] = await db.select({ total: sql<number>`sum(${jobs.price})` }).from(jobs)
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
    
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    const [activeCleanersResult] = await db.select({ count: sql<number>`count(*)` }).from(cleaners)
      .where(and(
        eq(cleaners.companyId, companyId),
        eq(cleaners.status, "on_duty")
      ));
    const [jobsThisMonthResult] = await db.select({ count: sql<number>`count(*)` }).from(jobs)
      .where(and(
        eq(jobs.companyId, companyId),
        gte(jobs.createdAt, firstDayOfMonth)
      ));
    const [revenueThisMonthResult] = await db.select({ total: sql<number>`sum(${jobs.price})` }).from(jobs)
      .where(and(
        eq(jobs.companyId, companyId),
        eq(jobs.status, "completed"),
        gte(jobs.createdAt, firstDayOfMonth)
      ));
    
    return {
      totalJobsCompleted: company?.totalJobsCompleted || 0,
      totalRevenue: parseFloat(company?.totalRevenue as any) || 0,
      averageRating: parseFloat(company?.rating as any) || 0,
      activeCleaners: activeCleanersResult.count,
      jobsThisMonth: jobsThisMonthResult.count,
      revenueThisMonth: revenueThisMonthResult.total || 0,
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
}

export const storage = new DatabaseStorage();
