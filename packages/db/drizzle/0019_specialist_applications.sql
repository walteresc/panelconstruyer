--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "specialist_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"applicant_type" text NOT NULL,
	"company_name" text,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_specialty" text NOT NULL,
	"availability" text NOT NULL,
	"districts" text NOT NULL,
	"years" text NOT NULL,
	"mobility" text NOT NULL,
	"tools" text,
	"experience" text NOT NULL,
	"document" text,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "specialist_applications" ADD CONSTRAINT "specialist_applications_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "specialist_applications_org_status_idx" ON "specialist_applications" ("org_id","status","created_at");
