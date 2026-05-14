ALTER TABLE "tenants" ADD COLUMN "asaasAccountId" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "asaasApiKey" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "asaasWalletId" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "asaasAccountStatus" varchar(30) DEFAULT 'not_configured';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "asaasCpfCnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "asaasCompanyType" varchar(20);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "asaasMobilePhone" varchar(20);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "asaasBirthDate" varchar(10);