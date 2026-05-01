ALTER TABLE "backoffice_users" ADD COLUMN "role" varchar(50) DEFAULT 'admin';--> statement-breakpoint
ALTER TABLE "backoffice_users" ADD COLUMN "isActive" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "backoffice_users" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;