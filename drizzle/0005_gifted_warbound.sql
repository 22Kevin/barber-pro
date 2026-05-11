ALTER TABLE "suppliers" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supplierId" integer;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "cnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN "contact";