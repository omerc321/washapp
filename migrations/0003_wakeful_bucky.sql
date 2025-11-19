CREATE TYPE "public"."transaction_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TABLE "cleaner_geofence_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"geofence_id" integer,
	"cleaner_id" integer,
	"invitation_id" integer,
	"assign_all" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cleaner_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"cleaner_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"shift_start" timestamp NOT NULL,
	"shift_end" timestamp,
	"duration_minutes" integer,
	"start_latitude" numeric(10, 8),
	"start_longitude" numeric(11, 8),
	"end_latitude" numeric(10, 8),
	"end_longitude" numeric(11, 8),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"customer_id" integer,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"sound_enabled" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."transaction_type";--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('customer_payment', 'admin_payment', 'refund', 'withdrawal');--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE "public"."transaction_type" USING "type"::"public"."transaction_type";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimated_start_time" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimated_finish_time" timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "direction" "transaction_direction" DEFAULT 'debit' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sound_enabled" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cleaner_shifts" ADD CONSTRAINT "cleaner_shifts_cleaner_id_cleaners_id_fk" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaner_shifts" ADD CONSTRAINT "cleaner_shifts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;