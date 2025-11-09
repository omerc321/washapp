CREATE TYPE "public"."assignment_mode" AS ENUM('pool', 'direct');--> statement-breakpoint
CREATE TYPE "public"."cleaner_status" AS ENUM('on_duty', 'off_duty', 'busy');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'consumed', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending_payment', 'paid', 'assigned', 'in_progress', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'cash', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('payment', 'refund', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'cleaner', 'company_admin', 'admin');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "cleaner_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" integer NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"consumed_at" timestamp,
	CONSTRAINT "cleaner_invitations_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "cleaners" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"status" "cleaner_status" DEFAULT 'off_duty' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"current_latitude" numeric(10, 8),
	"current_longitude" numeric(11, 8),
	"last_location_update" timestamp,
	"total_jobs_completed" integer DEFAULT 0 NOT NULL,
	"average_completion_time" integer DEFAULT 0 NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"total_ratings" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cleaners_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price_per_wash" numeric(10, 2) NOT NULL,
	"admin_id" integer NOT NULL,
	"trade_license_number" varchar(100),
	"trade_license_document_url" text,
	"is_active" integer DEFAULT 0 NOT NULL,
	"total_jobs_completed" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"total_ratings" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"reference_number" varchar(255),
	"note" text,
	"processed_at" timestamp,
	"processed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"display_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "customers_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "fee_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_fee_rate" numeric(5, 4) DEFAULT '0.10' NOT NULL,
	"stripe_percent_rate" numeric(5, 4) DEFAULT '0.029' NOT NULL,
	"stripe_fixed_fee" numeric(10, 2) DEFAULT '0.30' NOT NULL,
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"effective_from" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_financials" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"cleaner_id" integer,
	"base_job_amount" numeric(10, 2) NOT NULL,
	"base_tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tip_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tip_tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"platform_fee_amount" numeric(10, 2) NOT NULL,
	"platform_fee_tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_processing_fee_amount" numeric(10, 2) NOT NULL,
	"gross_amount" numeric(10, 2) NOT NULL,
	"net_payable_amount" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"platform_revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"paid_at" timestamp NOT NULL,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_financials_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"company_id" integer NOT NULL,
	"cleaner_id" integer,
	"car_plate_number" varchar(50) NOT NULL,
	"location_address" text NOT NULL,
	"location_latitude" numeric(10, 8) NOT NULL,
	"location_longitude" numeric(11, 8) NOT NULL,
	"parking_number" varchar(50),
	"customer_phone" varchar(50) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tip_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_refund_id" varchar(255),
	"payment_method" "payment_method" DEFAULT 'card',
	"refunded_at" timestamp,
	"refund_reason" text,
	"status" "job_status" DEFAULT 'pending_payment' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"assigned_at" timestamp,
	"accepted_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"proof_photo_url" text,
	"rating" numeric(3, 2),
	"review" text,
	"rating_requested_at" timestamp,
	"rated_at" timestamp,
	"requested_cleaner_email" varchar(255),
	"assignment_mode" "assignment_mode" DEFAULT 'pool' NOT NULL,
	"direct_assignment_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shift_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"cleaner_id" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference_number" varchar(100) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"job_id" integer,
	"company_id" integer,
	"withdrawal_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_refund_id" varchar(255),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"photo_url" text,
	"phone_number" varchar(50),
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
