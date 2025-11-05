// Seed script to create initial data for testing
import { adminDb, adminAuth } from "./lib/firebase-admin";
import { UserRole, CleanerStatus, Company, Cleaner, User } from "@shared/schema";

export async function seedDatabase() {
  try {
    console.log("Seeding database...");

    // Create platform admin user
    const adminEmail = "omer.eldirdieri@gmail.com"; // Store in lowercase for case-insensitive matching
    const adminPassword = "12345678";
    
    try {
      // Try to get existing user first
      let adminUserRecord;
      try {
        adminUserRecord = await adminAuth.getUserByEmail(adminEmail);
        console.log("Admin user already exists:", adminEmail);
      } catch (error) {
        // User doesn't exist, create it
        adminUserRecord = await adminAuth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: "Platform Admin",
        });
        console.log("Created admin user:", adminEmail);
      }

      // Create or update user profile in Firestore
      const adminUserRef = adminDb.collection("users").doc(adminUserRecord.uid);
      const adminUser: User = {
        id: adminUserRecord.uid,
        email: adminEmail,
        displayName: "Platform Admin",
        role: UserRole.ADMIN,
        createdAt: Date.now(),
      };
      await adminUserRef.set(adminUser, { merge: true });
      console.log("Admin profile created/updated in Firestore");
    } catch (adminError) {
      console.error("Error creating admin user:", adminError);
    }

    // Create a company
    const companyRef = adminDb.collection("companies").doc();
    const company: Company = {
      id: companyRef.id,
      name: "Premium Car Wash Co.",
      description: "Professional car washing services",
      pricePerWash: 25,
      adminId: "company-admin-1",
      totalJobsCompleted: 15,
      totalRevenue: 375,
      rating: 4.5,
      totalRatings: 10,
      createdAt: Date.now(),
    };
    await companyRef.set(company);

    // Create another company
    const companyRef2 = adminDb.collection("companies").doc();
    const company2: Company = {
      id: companyRef2.id,
      name: "Quick Shine Auto",
      description: "Fast and reliable car cleaning",
      pricePerWash: 20,
      adminId: "company-admin-2",
      totalJobsCompleted: 28,
      totalRevenue: 560,
      rating: 4.7,
      totalRatings: 18,
      createdAt: Date.now(),
    };
    await companyRef2.set(company2);

    // Create cleaners for first company
    for (let i = 1; i <= 3; i++) {
      const cleanerRef = adminDb.collection("cleaners").doc();
      const cleaner: Cleaner = {
        id: cleanerRef.id,
        userId: `cleaner-${i}`,
        companyId: company.id,
        status: i <= 2 ? CleanerStatus.ON_DUTY : CleanerStatus.OFF_DUTY,
        currentLatitude: 1.3521 + (Math.random() * 0.01),
        currentLongitude: 103.8198 + (Math.random() * 0.01),
        totalJobsCompleted: Math.floor(Math.random() * 20),
        averageCompletionTime: 15 + Math.floor(Math.random() * 10),
        rating: 4 + Math.random(),
        totalRatings: Math.floor(Math.random() * 15),
        createdAt: Date.now(),
      };
      await cleanerRef.set(cleaner);
    }

    // Create cleaners for second company
    for (let i = 4; i <= 5; i++) {
      const cleanerRef = adminDb.collection("cleaners").doc();
      const cleaner: Cleaner = {
        id: cleanerRef.id,
        userId: `cleaner-${i}`,
        companyId: company2.id,
        status: CleanerStatus.ON_DUTY,
        currentLatitude: 1.3521 + (Math.random() * 0.01),
        currentLongitude: 103.8198 + (Math.random() * 0.01),
        totalJobsCompleted: Math.floor(Math.random() * 20),
        averageCompletionTime: 15 + Math.floor(Math.random() * 10),
        rating: 4 + Math.random(),
        totalRatings: Math.floor(Math.random() * 15),
        createdAt: Date.now(),
      };
      await cleanerRef.set(cleaner);
    }

    console.log("Database seeded successfully!");
    console.log(`Created companies: ${company.name}, ${company2.name}`);
    console.log("Created 5 cleaners (3 for first company, 2 for second)");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Run if called directly (ESM compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().then(() => process.exit(0));
}
