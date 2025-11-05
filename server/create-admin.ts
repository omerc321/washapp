import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function createAdmin() {
  const email = "omer.eldirdieri@gmail.com";
  const password = "12345678";
  const displayName = "Omer Eldirdieri";
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (existing.length > 0) {
    console.log("Admin user already exists");
    process.exit(0);
  }
  
  // Create admin user
  await db.insert(users).values({
    email,
    passwordHash: hashedPassword,
    displayName,
    role: "admin",
  });
  
  console.log("Admin user created successfully!");
  console.log("Email:", email);
  console.log("Password:", password);
  
  process.exit(0);
}

createAdmin().catch((error) => {
  console.error("Failed to create admin:", error);
  process.exit(1);
});
