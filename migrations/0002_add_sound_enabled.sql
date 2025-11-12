-- Migration: Add sound_enabled column to push_subscriptions
-- Note: This column was added manually via execute_sql_tool due to drizzle-kit compatibility issues
-- The column already exists in the database with the following definition:
-- ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS sound_enabled integer NOT NULL DEFAULT 0;

-- This file serves as documentation only
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "sound_enabled" integer DEFAULT 0 NOT NULL;
