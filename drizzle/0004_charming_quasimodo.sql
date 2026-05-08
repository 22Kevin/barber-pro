CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'pending_approval');--> statement-breakpoint
CREATE TYPE "public"."barber_role" AS ENUM('super_admin', 'barber', 'receptionist');--> statement-breakpoint
CREATE TYPE "public"."billing_type" AS ENUM('BOLETO', 'CREDIT_CARD', 'PIX', 'STORE');--> statement-breakpoint
CREATE TYPE "public"."category_type" AS ENUM('service', 'product');--> statement-breakpoint
CREATE TYPE "public"."charge_type" AS ENUM('product', 'appointment', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."client_point_type" AS ENUM('earned', 'redeemed', 'expired', 'adjusted');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('service', 'product');--> statement-breakpoint
CREATE TYPE "public"."coupon_discount_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."media_entity_type" AS ENUM('service', 'product');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."online_payment_status" AS ENUM('pending', 'paid', 'overdue', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."orbit_source" AS ENUM('link', 'geo');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'credit_card', 'debit_card', 'pix', 'mercado_pago', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('solo', 'team', 'studio');--> statement-breakpoint
CREATE TYPE "public"."product_order_status" AS ENUM('received', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('sale', 'internal');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('free_service', 'discount_percent', 'discount_fixed', 'free_product');--> statement-breakpoint
CREATE TYPE "public"."sale_item_type" AS ENUM('service', 'product');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('in', 'out', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."subscription_payment_method" AS ENUM('credit_card', 'pix', 'cash', 'debit_card');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."target_audience" AS ENUM('all', 'inactive_30', 'inactive_60', 'birthday_month', 'specific_client');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'trial', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'notified', 'booked', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_direction" AS ENUM('outgoing', 'incoming');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"barberId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"serviceNames" text,
	"date" varchar(10) NOT NULL,
	"startTime" time NOT NULL,
	"endTime" time NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"cancelReason" text,
	"reminderSent" boolean DEFAULT false NOT NULL,
	"whatsappConfirmationSent" boolean DEFAULT false NOT NULL,
	"whatsappReminder24hSent" boolean DEFAULT false NOT NULL,
	"whatsappReminder1hSent" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backoffice_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"name" varchar(255),
	"role" varchar(50) DEFAULT 'admin',
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "backoffice_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "barbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"name" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(20),
	"photoUrl" text,
	"role" "barber_role" DEFAULT 'barber' NOT NULL,
	"specialties" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"passwordHash" varchar(255),
	"googleId" varchar(128),
	"pushToken" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"barberId" integer NOT NULL,
	"date" varchar(10) NOT NULL,
	"startTime" time NOT NULL,
	"endTime" time NOT NULL,
	"reason" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "category_type" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"googleId" varchar(255),
	"pushToken" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_accounts_clientId_unique" UNIQUE("clientId"),
	CONSTRAINT "client_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "client_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"consentType" varchar(50) NOT NULL,
	"granted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"points" integer NOT NULL,
	"type" "client_point_type" NOT NULL,
	"description" varchar(255),
	"saleId" integer,
	"rewardId" integer,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"planId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"barberId" integer,
	"selectedServiceIds" text,
	"selectedProductIds" text,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"paymentMethod" "subscription_payment_method" DEFAULT 'cash' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"cycleStart" date NOT NULL,
	"cycleEnd" date NOT NULL,
	"usedRecurrences" integer DEFAULT 0 NOT NULL,
	"cancelledAt" timestamp,
	"cancelReason" text,
	"autoRenew" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"preferredTenantId" integer,
	"name" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(20) NOT NULL,
	"birthDate" varchar(10),
	"photoUrl" text,
	"notes" text,
	"totalPoints" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"barberId" integer NOT NULL,
	"defaultRate" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commission_configs_barberId_unique" UNIQUE("barberId")
);
--> statement-breakpoint
CREATE TABLE "commission_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"barberId" integer NOT NULL,
	"appointmentId" integer,
	"saleId" integer,
	"grossValue" numeric(10, 2) NOT NULL,
	"commissionRate" numeric(5, 2) NOT NULL,
	"commissionValue" numeric(10, 2) NOT NULL,
	"type" "commission_type" DEFAULT 'service' NOT NULL,
	"description" varchar(255),
	"date" varchar(10) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"code" varchar(50) NOT NULL,
	"description" varchar(255),
	"discountType" "coupon_discount_type" NOT NULL,
	"discountValue" numeric(10, 2) NOT NULL,
	"minOrderValue" numeric(10, 2) DEFAULT '0',
	"maxUses" integer,
	"usedCount" integer DEFAULT 0 NOT NULL,
	"validFrom" varchar(10),
	"validUntil" varchar(10),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(20) DEFAULT 'browser' NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"url" varchar(500),
	"userAgent" varchar(500),
	"tenantId" integer,
	"context" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"barberId" integer,
	"category" varchar(100) NOT NULL,
	"description" varchar(500) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"date" varchar(10) NOT NULL,
	"paymentMethod" varchar(50),
	"receiptUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"isActive" boolean DEFAULT false NOT NULL,
	"pointsPerService" integer DEFAULT 10 NOT NULL,
	"pointsPerReal" numeric(5, 2) DEFAULT '1' NOT NULL,
	"pointsExpireMonths" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"pointsRequired" integer NOT NULL,
	"rewardType" "reward_type" NOT NULL,
	"rewardValue" numeric(10, 2),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"entityType" "media_entity_type" NOT NULL,
	"entityId" integer NOT NULL,
	"url" text NOT NULL,
	"type" "media_type" NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"chargeType" charge_type NOT NULL,
	"referenceId" integer,
	"asaasPaymentId" varchar(100),
	"asaasSubscriptionId" varchar(100),
	"asaasCustomerId" varchar(100),
	"billingType" "billing_type" DEFAULT 'PIX' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "online_payment_status" DEFAULT 'pending' NOT NULL,
	"invoiceUrl" text,
	"pixQrCode" text,
	"pixCopyCola" text,
	"dueDate" date,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orbit_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"loginAt" timestamp DEFAULT now() NOT NULL,
	"convertedAt" timestamp,
	"source" "orbit_source" DEFAULT 'link' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"token" varchar(6) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"productId" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"note" text,
	"status" "product_order_status" DEFAULT 'received' NOT NULL,
	"estimatedDays" integer,
	"confirmedAt" timestamp,
	"cancelledAt" timestamp,
	"cancelReason" text,
	"deliveredAt" timestamp,
	"totalPrice" numeric(10, 2),
	"paymentMethod" varchar(50),
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"categoryId" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"productType" "product_type" DEFAULT 'sale' NOT NULL,
	"stockQuantity" integer DEFAULT 0 NOT NULL,
	"minStockAlert" integer DEFAULT 5 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"targetAudience" "target_audience" DEFAULT 'all' NOT NULL,
	"specificClientId" integer,
	"sentAt" timestamp,
	"recipientCount" integer DEFAULT 0 NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"barberId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"startDate" varchar(10) NOT NULL,
	"startTime" time NOT NULL,
	"endTime" time NOT NULL,
	"intervalWeeks" integer DEFAULT 4 NOT NULL,
	"occurrences" integer DEFAULT 6 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"notes" text,
	"cancelledAt" timestamp,
	"cancelReason" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_message_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"delayDays" integer DEFAULT 21 NOT NULL,
	"messageTemplate" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "return_message_configs_serviceId_unique" UNIQUE("serviceId")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 0 NOT NULL,
	"clientId" integer NOT NULL,
	"serviceId" integer,
	"appointmentId" integer,
	"productId" integer,
	"orderId" integer,
	"rating" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"saleId" integer NOT NULL,
	"itemType" "sale_item_type" NOT NULL,
	"itemId" integer NOT NULL,
	"itemName" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer,
	"barberId" integer NOT NULL,
	"appointmentId" integer,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"paymentMethod" "payment_method" NOT NULL,
	"paymentStatus" "payment_status" DEFAULT 'pending' NOT NULL,
	"couponId" integer,
	"couponCode" varchar(50),
	"mercadoPagoPaymentId" varchar(255),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"categoryId" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"durationMinutes" integer DEFAULT 30 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"shopName" varchar(255) DEFAULT 'Barber Pro' NOT NULL,
	"address" text,
	"phone" varchar(20),
	"whatsapp" varchar(20),
	"logoUrl" text,
	"mercadoPagoAccessToken" text,
	"mercadoPagoPublicKey" text,
	"whatsappMessageTemplate" text,
	"reminderMessageTemplate" text,
	"instagram" varchar(100),
	"cnpj" varchar(20),
	"cep" varchar(10),
	"addressNumber" varchar(20),
	"addressComplement" varchar(100),
	"googleMapsUrl" text,
	"pixKey" varchar(255),
	"galleryUrls" text,
	"primaryColor" varchar(20) DEFAULT '#C9A84C',
	"bannerUrl" text,
	"customDomain" varchar(255),
	"ga4MeasurementId" varchar(50),
	"facebookPixelId" varchar(50),
	"seoTitle" varchar(100),
	"seoDescription" varchar(300),
	"seoImageUrl" text,
	"fontStyle" varchar(30) DEFAULT 'moderno',
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"reason" varchar(255),
	"barberId" integer,
	"saleId" integer,
	"supplierId" integer,
	"date" varchar(10) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriptionId" integer NOT NULL,
	"appointmentId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"recurrenceIndex" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plan_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"planId" integer NOT NULL,
	"productId" integer NOT NULL,
	"tenantId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plan_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"planId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"tenantId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"recurrences" integer DEFAULT 4 NOT NULL,
	"maxServices" integer DEFAULT 1 NOT NULL,
	"maxProducts" integer DEFAULT 0 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"suggestedPrice" numeric(10, 2),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"contact" varchar(120),
	"phone" varchar(30),
	"email" varchar(120),
	"notes" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"authorType" varchar(20) NOT NULL,
	"authorName" varchar(255),
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"aiHandled" boolean DEFAULT false NOT NULL,
	"adminNotified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"cnpj" varchar(20),
	"address" text,
	"cep" varchar(10),
	"addressNumber" varchar(20),
	"addressComplement" varchar(100),
	"city" varchar(100),
	"state" varchar(2),
	"plan" "plan" DEFAULT 'solo' NOT NULL,
	"status" "tenant_status" DEFAULT 'trial' NOT NULL,
	"trialEndsAt" timestamp,
	"logoUrl" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"descricao" text,
	"fotoCapa" text,
	"visivelMarketplace" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"barberId" integer,
	"serviceId" integer,
	"date" varchar(10) NOT NULL,
	"notifiedAt" timestamp,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"barberId" integer NOT NULL,
	"direction" "whatsapp_direction" DEFAULT 'outgoing' NOT NULL,
	"message" text NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL,
	"status" "whatsapp_status" DEFAULT 'sent' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"barberId" integer NOT NULL,
	"dayOfWeek" integer NOT NULL,
	"startTime" time NOT NULL,
	"endTime" time NOT NULL,
	"lunchStart" time,
	"lunchEnd" time,
	"isWorking" boolean DEFAULT true NOT NULL
);
