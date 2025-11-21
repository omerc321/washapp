CREATE TYPE "public"."company_package_type" AS ENUM('pay_per_wash', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."fee_package_type" AS ENUM('custom', 'package1', 'package2');--> statement-breakpoint
CREATE TABLE "company_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"cleaner_slots" integer NOT NULL,
	"monthly_fee" numeric(10, 2) NOT NULL,
	"billing_cycle_start" timestamp NOT NULL,
	"billing_cycle_end" timestamp NOT NULL,
	"stripe_subscription_id" varchar(255),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_subscriptions_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) DEFAULT 'Washapp.ae' NOT NULL,
	"company_address" text DEFAULT 'Dubai, United Arab Emirates' NOT NULL,
	"vat_registration_number" varchar(100) DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "platform_fee" numeric(10, 2) DEFAULT '3.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "fee_package_type" "fee_package_type" DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "package_type" "company_package_type" DEFAULT 'pay_per_wash' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "subscription_cleaner_slots" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "car_plate_emirate" varchar(50);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "car_plate_code" varchar(10);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "customer_email" varchar(255);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "receipt_number" varchar(50);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "receipt_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_receipt_number_unique" UNIQUE("receipt_number");