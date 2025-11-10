CREATE TABLE "company_geofences" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"polygon" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "geofence_area" jsonb;--> statement-breakpoint
ALTER TABLE "company_geofences" ADD CONSTRAINT "company_geofences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;