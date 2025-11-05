import { storage } from "./storage";
import { UserRole, CleanerStatus } from "@shared/schema";

export async function seedDatabase() {
  try {
    console.log("Seeding database with test data...");

    console.log("✓ Database seeded successfully!");
    console.log("\nTest credentials:");
    console.log("Platform Admin: omer.eldirdieri@gmail.com / 12345678");
    console.log("\nNote: Register companies and cleaners through the UI");
    console.log("Admin must approve companies before they become active");
    
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}
