import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function ensureAdminExists() {
  const email = "omer.eldirdieri@gmail.com";
  const password = "Network#123";
  const displayName = "Omer Eldirdieri";
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existing.length > 0) {
      await db.update(users)
        .set({ passwordHash: hashedPassword })
        .where(eq(users.email, email));
      console.log("✓ Admin password updated");
    } else {
      await db.insert(users).values({
        email,
        passwordHash: hashedPassword,
        displayName,
        role: "admin",
      });
      console.log("✓ Admin user created");
    }
  } catch (error) {
    console.error("Failed to ensure admin exists:", error);
  }
}
