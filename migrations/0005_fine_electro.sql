CREATE TYPE "public"."complaint_status" AS ENUM('pending', 'in_progress', 'resolved', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."complaint_type" AS ENUM('refund_request', 'general');--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference_number" varchar(100) NOT NULL,
	"job_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"customer_id" integer,
	"type" "complaint_type" NOT NULL,
	"description" text NOT NULL,
	"status" "complaint_status" DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"refunded_at" timestamp,
	"refunded_by" integer,
	"stripe_refund_id" varchar(255),
	"customer_email" varchar(255),
	"customer_phone" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "complaints_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "email_otp_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "job_financials" ADD COLUMN "company_stripe_fee_share" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_financials" ADD COLUMN "cleaner_stripe_fee_share" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_financials" ADD COLUMN "remaining_tip" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;