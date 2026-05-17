ALTER TABLE "tenants" ADD COLUMN "barberproSubscriptionId" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "barberproSubscriptionStatus" varchar(30) DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "barberproPlanName" varchar(50) DEFAULT 'starter';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "barberproPlanPrice" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "barberproNextDueDate" varchar(10);