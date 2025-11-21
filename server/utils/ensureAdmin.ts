import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function ensureAdminExists() {
  const adminAccounts = [
    {
      email: "omer.eldirdiri@gmail.com",
      password: "Network#123",
      displayName: "Omer Eldirdieri"
    },
    {
      email: "test.admin@example.com",
      password: "TestAdmin123!",
      displayName: "Test Admin"
    }
  ];
  
  for (const account of adminAccounts) {
    try {
      const hashedPassword = await bcrypt.hash(account.password, 10);
      
      const existing = await db.select().from(users).where(eq(users.email, account.email)).limit(1);
      
      if (existing.length > 0) {
        await db.update(users)
          .set({ passwordHash: hashedPassword })
          .where(eq(users.email, account.email));
        console.log(`✓ Admin password updated: ${account.email}`);
      } else {
        await db.insert(users).values({
          email: account.email,
          passwordHash: hashedPassword,
          displayName: account.displayName,
          role: "admin",
        });
        console.log(`✓ Admin user created: ${account.email}`);
      }
    } catch (error) {
      console.error(`Failed to ensure admin exists for ${account.email}:`, error);
    }
  }
}
