/**
 * auto-migrate.ts
 *
 * Migração automática executada no boot do servidor.
 * Cria tabelas e colunas que possam estar faltando no banco de produção
 * sem afetar dados existentes (usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 *
 * IMPORTANTE: Usa sintaxe PostgreSQL com aspas duplas para preservar camelCase.
 * Todas as novas tabelas e colunas devem ser adicionadas aqui para garantir
 * que o banco de produção esteja sempre sincronizado com o schema.
 */

export async function runAutoMigrate(db: any): Promise<void> {
  // Helper para executar SQL ignorando erros de "já existe"
  async function safe(name: string, sql: string): Promise<void> {
    try {
      await db.execute(sql as any);
    } catch (err: any) {
      const msg = (err?.message ?? "").toLowerCase();
      const isAlreadyExists =
        msg.includes("already exists") ||
        msg.includes("duplicate column") ||
        msg.includes("column exists") ||
        msg.includes("42701") || // PostgreSQL: duplicate_column
        msg.includes("42p07");   // PostgreSQL: duplicate_table
      if (!isAlreadyExists) {
        console.warn(`[auto-migrate] ⚠️  ${name}: ${err?.message ?? err}`);
      }
    }
  }

  // ─── Tipos ENUM (PostgreSQL) ──────────────────────────────────────────────
  // Criar tipos ENUM necessários (ignorar se já existem)
  const enumTypes = [
    `DO $$ BEGIN CREATE TYPE tenant_plan AS ENUM ('solo','team','studio'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE tenant_status AS ENUM ('active','trial','suspended','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE barber_role AS ENUM ('super_admin','barber','receptionist'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE product_type AS ENUM ('sale','internal'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE appointment_status AS ENUM ('scheduled','confirmed','in_progress','completed','cancelled','no_show','pending_approval'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE payment_method AS ENUM ('cash','credit_card','debit_card','pix','asaas','other'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'asaas'; EXCEPTION WHEN others THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending','paid','cancelled','refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE loyalty_reward_type AS ENUM ('free_service','discount_percent','discount_fixed','free_product'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE stock_movement_type AS ENUM ('in','out','adjustment'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE order_status AS ENUM ('received','confirmed','preparing','ready','delivered','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE media_entity_type AS ENUM ('service','product'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE media_type AS ENUM ('image','video'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE promotion_audience AS ENUM ('all','inactive_30','inactive_60','birthday_month','specific_client'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE waitlist_status AS ENUM ('waiting','notified','booked','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE online_payment_billing AS ENUM ('BOLETO','CREDIT_CARD','PIX','STORE'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE online_payment_status AS ENUM ('pending','paid','overdue','refunded','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE online_payment_charge AS ENUM ('product','appointment','subscription'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('active','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE subscription_payment AS ENUM ('credit_card','pix','cash','debit_card'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE orbit_source AS ENUM ('link','geo'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE point_type AS ENUM ('earned','redeemed','expired','adjusted'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE coupon_discount_type AS ENUM ('percent','fixed'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE sale_item_type AS ENUM ('service','product'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE commission_entry_type AS ENUM ('service','product'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE whatsapp_direction AS ENUM ('outgoing','incoming'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE whatsapp_status AS ENUM ('sent','delivered','read'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE error_log_source AS ENUM ('browser','server'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  ];

  for (const sql of enumTypes) {
    await safe("enum", sql);
  }

  // ─── Tabelas ──────────────────────────────────────────────────────────────
  const tables: Array<{ name: string; sql: string }> = [
    {
      name: "tenants",
      sql: `CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        cnpj VARCHAR(20),
        address TEXT,
        cep VARCHAR(10),
        "addressNumber" VARCHAR(20),
        "addressComplement" VARCHAR(100),
        city VARCHAR(100),
        state VARCHAR(2),
        plan tenant_plan NOT NULL DEFAULT 'solo',
        status tenant_status NOT NULL DEFAULT 'trial',
        "trialEndsAt" TIMESTAMP,
        "logoUrl" TEXT,
        latitude DECIMAL(10,7),
        longitude DECIMAL(10,7),
        descricao TEXT,
        "fotoCapa" TEXT,
        "visivelMarketplace" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "barbers",
      sql: `CREATE TABLE IF NOT EXISTS barbers (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(320),
        phone VARCHAR(20),
        "photoUrl" TEXT,
        role barber_role NOT NULL DEFAULT 'barber',
        specialties TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "passwordHash" VARCHAR(255),
        "googleId" VARCHAR(128),
        "pushToken" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "clients",
      sql: `CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        "preferredTenantId" INT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(320),
        phone VARCHAR(20) NOT NULL,
        "birthDate" VARCHAR(10),
        "photoUrl" TEXT,
        notes TEXT,
        "totalPoints" INT NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "categories",
      sql: `CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "services",
      sql: `CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        "categoryId" INT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        "durationMinutes" INT NOT NULL DEFAULT 30,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "products",
      sql: `CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        "categoryId" INT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        "costPrice" DECIMAL(10,2),
        stock INT NOT NULL DEFAULT 0,
        "productType" product_type NOT NULL DEFAULT 'sale',
        "stockQuantity" INT NOT NULL DEFAULT 0,
        "minStockAlert" INT NOT NULL DEFAULT 5,
        "supplierId" INT,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "suppliers",
      sql: `CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        "tenantId" INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        contact VARCHAR(255),
        phone VARCHAR(30),
        email VARCHAR(255),
        cnpj VARCHAR(20),
        address TEXT,
        notes TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "media_files",
      sql: `CREATE TABLE IF NOT EXISTS media_files (
        id SERIAL PRIMARY KEY,
        "entityType" media_entity_type NOT NULL,
        "entityId" INT NOT NULL,
        url TEXT NOT NULL,
        type media_type NOT NULL,
        "order" INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "working_hours",
      sql: `CREATE TABLE IF NOT EXISTS working_hours (
        id SERIAL PRIMARY KEY,
        "barberId" INT NOT NULL,
        "dayOfWeek" INT NOT NULL,
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        "lunchStart" TIME,
        "lunchEnd" TIME,
        "isWorking" BOOLEAN NOT NULL DEFAULT TRUE
      )`,
    },
    {
      name: "blocked_slots",
      sql: `CREATE TABLE IF NOT EXISTS blocked_slots (
        id SERIAL PRIMARY KEY,
        "barberId" INT NOT NULL,
        date VARCHAR(10) NOT NULL,
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        reason VARCHAR(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "appointments",
      sql: `CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        "clientId" INT NOT NULL,
        "barberId" INT NOT NULL,
        "serviceId" INT NOT NULL,
        "serviceNames" TEXT,
        date VARCHAR(10) NOT NULL,
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        status appointment_status NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        "cancelReason" TEXT,
        "reminderSent" BOOLEAN NOT NULL DEFAULT FALSE,
        "whatsappConfirmationSent" BOOLEAN NOT NULL DEFAULT FALSE,
        "whatsappReminder24hSent" BOOLEAN NOT NULL DEFAULT FALSE,
        "whatsappReminder1hSent" BOOLEAN NOT NULL DEFAULT FALSE,
        "emailReminder24hSent" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "sales",
      sql: `CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        "clientId" INT,
        "barberId" INT NOT NULL,
        "appointmentId" INT,
        subtotal DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) NOT NULL DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        "paymentMethod" payment_method NOT NULL,
        "paymentStatus" payment_status NOT NULL DEFAULT 'pending',
        "couponId" INT,
        "couponCode" VARCHAR(50),
        notes TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "sale_items",
      sql: `CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        "saleId" INT NOT NULL,
        "itemType" sale_item_type NOT NULL,
        "itemId" INT NOT NULL,
        "itemName" VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        "unitPrice" DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL
      )`,
    },
    {
      name: "expenses",
      sql: `CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        "barberId" INT,
        category VARCHAR(100) NOT NULL,
        description VARCHAR(500) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        date VARCHAR(10) NOT NULL,
        "paymentMethod" VARCHAR(50),
        "receiptUrl" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "loyalty_config",
      sql: `CREATE TABLE IF NOT EXISTS loyalty_config (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
        "pointsPerService" INT NOT NULL DEFAULT 10,
        "pointsPerReal" DECIMAL(5,2) NOT NULL DEFAULT 1,
        "pointsExpireMonths" INT NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "loyalty_rewards",
      sql: `CREATE TABLE IF NOT EXISTS loyalty_rewards (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        "pointsRequired" INT NOT NULL,
        "rewardType" loyalty_reward_type NOT NULL,
        "rewardValue" DECIMAL(10,2),
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "client_points",
      sql: `CREATE TABLE IF NOT EXISTS client_points (
        id SERIAL PRIMARY KEY,
        "clientId" INT NOT NULL,
        points INT NOT NULL,
        type point_type NOT NULL,
        description VARCHAR(255),
        "saleId" INT,
        "rewardId" INT,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "coupons",
      sql: `CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        code VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255),
        "discountType" coupon_discount_type NOT NULL,
        "discountValue" DECIMAL(10,2) NOT NULL,
        "minOrderValue" DECIMAL(10,2) DEFAULT 0,
        "maxUses" INT,
        "usedCount" INT NOT NULL DEFAULT 0,
        "validFrom" VARCHAR(10),
        "validUntil" VARCHAR(10),
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "coupon_uses",
      sql: `CREATE TABLE IF NOT EXISTS coupon_uses (
        id SERIAL PRIMARY KEY,
        "couponId" INT NOT NULL,
        "clientId" INT NOT NULL,
        "saleId" INT,
        "usedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "shop_settings",
      sql: `CREATE TABLE IF NOT EXISTS shop_settings (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        "shopName" VARCHAR(255) NOT NULL DEFAULT 'Barber Pro',
        address TEXT,
        phone VARCHAR(20),
        whatsapp VARCHAR(20),
        "logoUrl" TEXT,
        "whatsappMessageTemplate" TEXT,
        "reminderMessageTemplate" TEXT,
        instagram VARCHAR(100),
        cnpj VARCHAR(20),
        cep VARCHAR(10),
        "addressNumber" VARCHAR(20),
        "addressComplement" VARCHAR(100),
        "googleMapsUrl" TEXT,
        "pixKey" VARCHAR(255),
        "galleryUrls" TEXT,
        "primaryColor" VARCHAR(20) DEFAULT '#C9A84C',
        "bannerUrl" TEXT,
        "customDomain" VARCHAR(255),
        "ga4MeasurementId" VARCHAR(50),
        "facebookPixelId" VARCHAR(50),
        "seoTitle" VARCHAR(100),
        "seoDescription" VARCHAR(300),
        "seoImageUrl" TEXT,
        "fontStyle" VARCHAR(30) DEFAULT 'moderno',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "password_reset_tokens",
      sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        email VARCHAR(320) NOT NULL,
        token VARCHAR(6) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "client_accounts",
      sql: `CREATE TABLE IF NOT EXISTS client_accounts (
        id SERIAL PRIMARY KEY,
        "clientId" INT NOT NULL UNIQUE,
        email VARCHAR(320) NOT NULL UNIQUE,
        "passwordHash" VARCHAR(255) NOT NULL,
        "googleId" VARCHAR(255),
        "pushToken" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "reviews",
      sql: `CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        "tenantId" INT NOT NULL DEFAULT 0,
        "clientId" INT NOT NULL,
        "serviceId" INT,
        "appointmentId" INT,
        "productId" INT,
        "orderId" INT,
        rating INT NOT NULL,
        comment TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "return_message_configs",
      sql: `CREATE TABLE IF NOT EXISTS return_message_configs (
        id SERIAL PRIMARY KEY,
        "serviceId" INT NOT NULL UNIQUE,
        "delayDays" INT NOT NULL DEFAULT 21,
        "messageTemplate" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "promotions",
      sql: `CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        "tenantId" INT,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        "targetAudience" promotion_audience NOT NULL DEFAULT 'all',
        "specificClientId" INT,
        "sentAt" TIMESTAMP,
        "recipientCount" INT NOT NULL DEFAULT 0,
        "createdBy" INT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "superadmin_promotions",
      sql: `CREATE TABLE IF NOT EXISTS superadmin_promotions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(30) NOT NULL DEFAULT 'percent',
        value DECIMAL(10,2) NOT NULL DEFAULT 0,
        "durationMonths" INT NOT NULL DEFAULT 1,
        "maxUses" INT,
        "usedCount" INT NOT NULL DEFAULT 0,
        "targetFilter" VARCHAR(50) NOT NULL DEFAULT 'all',
        "targetPlan" VARCHAR(20),
        "validUntil" DATE,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "notifyEmail" BOOLEAN NOT NULL DEFAULT TRUE,
        "notifyMessage" TEXT,
        "createdBy" VARCHAR(100),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "superadmin_promotion_applications",
      sql: `CREATE TABLE IF NOT EXISTS superadmin_promotion_applications (
        id SERIAL PRIMARY KEY,
        "promotionId" INT NOT NULL,
        "tenantId" INT NOT NULL,
        "appliedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "appliedBy" VARCHAR(100),
        "asaasStatus" VARCHAR(50),
        "asaasDiscountId" VARCHAR(100),
        "emailSent" BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT
      )`,
    },
    {
      name: "products_costPrice_col",
      sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(10,2)`,
    },
    {
      name: "waitlist",
      sql: `CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        "clientId" INT NOT NULL,
        "barberId" INT,
        "serviceId" INT,
        date VARCHAR(10) NOT NULL,
        "notifiedAt" TIMESTAMP,
        status waitlist_status NOT NULL DEFAULT 'waiting',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "commission_configs",
      sql: `CREATE TABLE IF NOT EXISTS commission_configs (
        id SERIAL PRIMARY KEY,
        "barberId" INT NOT NULL UNIQUE,
        "defaultRate" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "commission_entries",
      sql: `CREATE TABLE IF NOT EXISTS commission_entries (
        id SERIAL PRIMARY KEY,
        "barberId" INT NOT NULL,
        "appointmentId" INT,
        "saleId" INT,
        "grossValue" DECIMAL(10,2) NOT NULL,
        "commissionRate" DECIMAL(5,2) NOT NULL,
        "commissionValue" DECIMAL(10,2) NOT NULL,
        type commission_entry_type NOT NULL DEFAULT 'service',
        description VARCHAR(255),
        date VARCHAR(10) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "recurring_appointments",
      sql: `CREATE TABLE IF NOT EXISTS recurring_appointments (
        id SERIAL PRIMARY KEY,
        "clientId" INT NOT NULL,
        "barberId" INT NOT NULL,
        "serviceId" INT NOT NULL,
        "startDate" VARCHAR(10) NOT NULL,
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        "intervalWeeks" INT NOT NULL DEFAULT 4,
        occurrences INT NOT NULL DEFAULT 6,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "stock_movements",
      sql: `CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        "productId" INT NOT NULL,
        type stock_movement_type NOT NULL,
        quantity INT NOT NULL,
        reason VARCHAR(255),
        "barberId" INT,
        "saleId" INT,
        "supplierId" INT,
        date VARCHAR(10) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "whatsapp_messages",
      sql: `CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id SERIAL PRIMARY KEY,
        "tenantId" INT NOT NULL,
        "clientId" INT NOT NULL,
        "barberId" INT NOT NULL,
        direction whatsapp_direction NOT NULL DEFAULT 'outgoing',
        message TEXT NOT NULL,
        "sentAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        status whatsapp_status NOT NULL DEFAULT 'sent'
      )`,
    },
    {
      name: "orbit_leads",
      sql: `CREATE TABLE IF NOT EXISTS orbit_leads (
        id SERIAL PRIMARY KEY,
        "clientId" INT NOT NULL,
        "tenantId" INT NOT NULL,
        "loginAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "convertedAt" TIMESTAMP,
        source orbit_source NOT NULL DEFAULT 'link'
      )`,
    },
    {
      name: "subscription_plans",
      sql: `CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        "tenantId" INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        recurrences INT NOT NULL DEFAULT 4,
        "maxServices" INT NOT NULL DEFAULT 1,
        "maxProducts" INT NOT NULL DEFAULT 0,
        price DECIMAL(10,2) NOT NULL,
        "suggestedPrice" DECIMAL(10,2),
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "subscription_plan_services",
      sql: `CREATE TABLE IF NOT EXISTS subscription_plan_services (
        id SERIAL PRIMARY KEY,
        "planId" INT NOT NULL,
        "serviceId" INT NOT NULL,
        "tenantId" INT NOT NULL
      )`,
    },
    {
      name: "subscription_plan_products",
      sql: `CREATE TABLE IF NOT EXISTS subscription_plan_products (
        id SERIAL PRIMARY KEY,
        "planId" INT NOT NULL,
        "productId" INT NOT NULL,
        "tenantId" INT NOT NULL
      )`,
    },
    {
      name: "client_subscriptions",
      sql: `CREATE TABLE IF NOT EXISTS client_subscriptions (
        id SERIAL PRIMARY KEY,
        "tenantId" INT NOT NULL,
        "planId" INT NOT NULL,
        "clientId" INT NOT NULL,
        "barberId" INT,
        "selectedServiceIds" TEXT,
        "selectedProductIds" TEXT,
        status subscription_status NOT NULL DEFAULT 'active',
        "paymentMethod" subscription_payment NOT NULL DEFAULT 'cash',
        price DECIMAL(10,2) NOT NULL,
        "cycleStart" DATE NOT NULL,
        "cycleEnd" DATE NOT NULL,
        "usedRecurrences" INT NOT NULL DEFAULT 0,
        "cancelledAt" TIMESTAMP,
        "cancelReason" TEXT,
        "autoRenew" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "subscription_appointments",
      sql: `CREATE TABLE IF NOT EXISTS subscription_appointments (
        id SERIAL PRIMARY KEY,
        "subscriptionId" INT NOT NULL,
        "appointmentId" INT NOT NULL,
        "tenantId" INT NOT NULL,
        "recurrenceIndex" INT NOT NULL DEFAULT 1
      )`,
    },
    {
      name: "online_payments",
      sql: `CREATE TABLE IF NOT EXISTS online_payments (
        id SERIAL PRIMARY KEY,
        "tenantId" INT NOT NULL,
        "clientId" INT NOT NULL,
        "chargeType" online_payment_charge NOT NULL,
        "referenceId" INT,
        "asaasPaymentId" VARCHAR(100),
        "asaasSubscriptionId" VARCHAR(100),
        "asaasCustomerId" VARCHAR(100),
        "billingType" online_payment_billing NOT NULL DEFAULT 'PIX',
        amount DECIMAL(10,2) NOT NULL,
        status online_payment_status NOT NULL DEFAULT 'pending',
        "invoiceUrl" TEXT,
        "pixQrCode" TEXT,
        "pixCopyCola" TEXT,
        "dueDate" DATE,
        "paidAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "product_orders",
      sql: `CREATE TABLE IF NOT EXISTS product_orders (
        id SERIAL PRIMARY KEY,
        "tenantId" INT NOT NULL,
        "clientId" INT NOT NULL,
        "productId" INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        note TEXT,
        status order_status NOT NULL DEFAULT 'received',
        "estimatedDays" INT,
        "confirmedAt" TIMESTAMP,
        "cancelledAt" TIMESTAMP,
        "cancelReason" TEXT,
        "deliveredAt" TIMESTAMP,
        "totalPrice" DECIMAL(10,2),
        "paymentMethod" VARCHAR(50),
        "paidAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "error_logs",
      sql: `CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        source VARCHAR(20) NOT NULL DEFAULT 'browser',
        message TEXT NOT NULL,
        stack TEXT,
        url VARCHAR(500),
        "userAgent" VARCHAR(500),
        "tenantId" INT,
        context TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "backoffice_users",
      sql: `CREATE TABLE IF NOT EXISTS backoffice_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        "passwordHash" VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin',
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "client_consents",
      sql: `CREATE TABLE IF NOT EXISTS client_consents (
        id SERIAL PRIMARY KEY,
        "clientId" INT NOT NULL,
        "tenantId" INT NOT NULL,
        "consentType" VARCHAR(50) NOT NULL,
        granted BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "support_tickets",
      sql: `CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        "tenantId" INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'other',
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        "aiHandled" BOOLEAN NOT NULL DEFAULT FALSE,
        "adminNotified" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "support_messages",
      sql: `CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        "ticketId" INT NOT NULL,
        "authorType" VARCHAR(20) NOT NULL,
        "authorName" VARCHAR(255),
        content TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "users",
      sql: `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        "openId" VARCHAR(255),
        "loginMethod" VARCHAR(50),
        "lastSignedIn" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "used_trials",
      sql: `CREATE TABLE IF NOT EXISTS used_trials (
        id SERIAL PRIMARY KEY,
        email VARCHAR(320) NOT NULL,
        "cpfCnpj" VARCHAR(20),
        "usedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "tenantId" INT,
        reason VARCHAR(100) DEFAULT 'trial_expired'
      )`,
    },
  ];

  // ─── ALTER TABLE: adicionar colunas faltantes ────────────────────────────
  // Usa aspas duplas para preservar camelCase no PostgreSQL
  const alterColumns: Array<{ name: string; sql: string }> = [
    // products
    { name: 'products."supplierId"',       sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS "supplierId" INT` },
    { name: 'products."productType"',      sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS "productType" VARCHAR(20) NOT NULL DEFAULT 'sale'` },
    { name: 'products."stockQuantity"',    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockQuantity" INT NOT NULL DEFAULT 0` },
    { name: 'products."minStockAlert"',    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStockAlert" INT NOT NULL DEFAULT 5` },
    // clients
    { name: 'clients."birthDate"',         sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS "birthDate" VARCHAR(10)` },
    { name: 'clients."preferredTenantId"', sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS "preferredTenantId" INT` },
    { name: 'clients."cpf"',               sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS "cpf" VARCHAR(14)` },
    // barbers
    { name: 'barbers."pushToken"',         sql: `ALTER TABLE barbers ADD COLUMN IF NOT EXISTS "pushToken" TEXT` },
    { name: 'barbers."googleId"',          sql: `ALTER TABLE barbers ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(128)` },
    // appointments
    { name: 'appointments."serviceNames"', sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "serviceNames" TEXT` },
    { name: 'appointments."whatsappConfirmationSent"', sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "whatsappConfirmationSent" BOOLEAN NOT NULL DEFAULT FALSE` },
    { name: 'appointments."whatsappReminder24hSent"',  sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "whatsappReminder24hSent" BOOLEAN NOT NULL DEFAULT FALSE` },
    { name: 'appointments."whatsappReminder1hSent"',   sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "whatsappReminder1hSent" BOOLEAN NOT NULL DEFAULT FALSE` },
    { name: 'appointments."emailReminder24hSent"',     sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "emailReminder24hSent" BOOLEAN NOT NULL DEFAULT FALSE` },
    // sales
    { name: 'sales."couponId"',            sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS "couponId" INT` },
    { name: 'sales."couponCode"',          sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS "couponCode" VARCHAR(50)` },
    // shop_settings
    { name: 'shop_settings.instagram',    sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS instagram VARCHAR(100)` },
    { name: 'shop_settings.cnpj',         sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20)` },
    { name: 'shop_settings.cep',          sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS cep VARCHAR(10)` },
    { name: 'shop_settings."addressNumber"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "addressNumber" VARCHAR(20)` },
    { name: 'shop_settings."addressComplement"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "addressComplement" VARCHAR(100)` },
    { name: 'shop_settings."googleMapsUrl"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "googleMapsUrl" TEXT` },
    { name: 'shop_settings."pixKey"',     sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "pixKey" VARCHAR(255)` },
    { name: 'shop_settings."galleryUrls"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "galleryUrls" TEXT` },
    { name: 'shop_settings."primaryColor"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "primaryColor" VARCHAR(20) DEFAULT '#C9A84C'` },
    { name: 'shop_settings."bannerUrl"',  sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT` },
    { name: 'shop_settings."customDomain"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "customDomain" VARCHAR(255)` },
    { name: 'shop_settings."ga4MeasurementId"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "ga4MeasurementId" VARCHAR(50)` },
    { name: 'shop_settings."facebookPixelId"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "facebookPixelId" VARCHAR(50)` },
    { name: 'shop_settings."seoTitle"',   sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "seoTitle" VARCHAR(100)` },
    { name: 'shop_settings."seoDescription"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "seoDescription" VARCHAR(300)` },
    { name: 'shop_settings."seoImageUrl"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "seoImageUrl" TEXT` },
    { name: 'shop_settings."fontStyle"',  sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "fontStyle" VARCHAR(30) DEFAULT 'moderno'` },
    { name: 'shop_settings."backgroundColor"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "backgroundColor" VARCHAR(20) DEFAULT '#0A0A0A'` },
    { name: 'shop_settings."dailyGoal"', sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS "dailyGoal" INTEGER DEFAULT 0` },
    // stock_movements
    { name: 'stock_movements."supplierId"', sql: `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS "supplierId" INT` },
    // reviews
    { name: 'reviews."productId"',        sql: `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "productId" INT` },
    { name: 'reviews."orderId"',          sql: `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "orderId" INT` },
    // client_accounts
    { name: 'client_accounts."googleId"', sql: `ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(255)` },
    { name: 'client_accounts."pushToken"', sql: `ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS "pushToken" TEXT` },
    // product_orders
    { name: 'product_orders."totalPrice"', sql: `ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS "totalPrice" DECIMAL(10,2)` },
    { name: 'product_orders."paymentMethod"', sql: `ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(50)` },
    { name: 'product_orders."paidAt"',    sql: `ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP` },
    // tenants
    { name: 'tenants.descricao',          sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS descricao TEXT` },
    { name: 'tenants."fotoCapa"',         sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "fotoCapa" TEXT` },
    { name: 'tenants."visivelMarketplace"', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "visivelMarketplace" BOOLEAN NOT NULL DEFAULT FALSE` },
    { name: 'tenants.latitude',           sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)` },
    { name: 'tenants.longitude',          sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)` },
    { name: 'tenants.cep',                sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cep VARCHAR(10)` },
    { name: 'tenants."addressNumber"',    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "addressNumber" VARCHAR(20)` },
    { name: 'tenants."addressComplement"', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "addressComplement" VARCHAR(100)` },
    { name: 'tenants.city',               sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city VARCHAR(100)` },
    { name: 'tenants.state',              sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state VARCHAR(2)` },
    // suppliers
    { name: 'suppliers.cnpj',             sql: `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20)` },
    { name: 'suppliers.address',          sql: `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT` },
    { name: 'suppliers.contact',          sql: `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact VARCHAR(255)` },

    // Asaas subconta
    { name: 'tenants."asaasAccountId"',    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "asaasAccountId" VARCHAR(100)` },
    { name: 'tenants."asaasApiKey"',       sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "asaasApiKey" VARCHAR(255)` },
    { name: 'tenants."asaasWalletId"',     sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "asaasWalletId" VARCHAR(100)` },
    { name: 'tenants."asaasAccountStatus"', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "asaasAccountStatus" VARCHAR(30) DEFAULT 'not_configured'` },
    { name: 'tenants."asaasCpfCnpj"',      sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "asaasCpfCnpj" VARCHAR(20)` },
    { name: 'tenants."asaasCompanyType"',   sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "asaasCompanyType" VARCHAR(20)` },
    { name: 'tenants."asaasMobilePhone"',   sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "asaasMobilePhone" VARCHAR(20)` },
    { name: 'tenants."asaasBirthDate"',     sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "asaasBirthDate" VARCHAR(10)` },
    // Assinatura Barber Pro (cobrança recorrente)
    { name: 'tenants."barberproSubscriptionId"',     sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproSubscriptionId" VARCHAR(100)` },
    { name: 'tenants."barberproSubscriptionStatus"', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproSubscriptionStatus" VARCHAR(30) DEFAULT 'trial'` },
    { name: 'tenants."barberproPlanName"',           sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproPlanName" VARCHAR(50) DEFAULT 'starter'` },
    { name: 'tenants."barberproPlanPrice"',          sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproPlanPrice" DECIMAL(10,2) DEFAULT 0` },
    { name: 'tenants."barberproNextDueDate"',        sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproNextDueDate" DATE` },
    { name: 'tenants."barberproAsaasCustomerId"',    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproAsaasCustomerId" VARCHAR(100)` },
    { name: 'tenants."barberproTrialEndsAt"',        sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproTrialEndsAt" DATE` },
  ];

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Executar criação de tabelas
  for (const migration of tables) {
    try {
      await db.execute(migration.sql as any);
      created++;
    } catch (err: any) {
      const msg = (err?.message ?? "").toLowerCase();
      if (msg.includes("already exists") || msg.includes("42p07")) {
        skipped++;
      } else {
        errors++;
        console.warn(`[auto-migrate] ⚠️  ${migration.name}: ${err?.message ?? err}`);
      }
    }
  }

  // Executar ALTER TABLE para colunas faltantes
  for (const col of alterColumns) {
    try {
      await db.execute(col.sql as any);
      created++;
    } catch (err: any) {
      const msg = (err?.message ?? "").toLowerCase();
      if (
        msg.includes("already exists") ||
        msg.includes("42701") ||
        msg.includes("duplicate column") ||
        msg.includes("column exists")
      ) {
        skipped++;
      } else {
        errors++;
        console.warn(`[auto-migrate] ⚠️  ${col.name}: ${err?.message ?? err}`);
      }
    }
  }

  console.log(`[auto-migrate] ✅ Concluído: ${created} executados, ${skipped} já existiam, ${errors} erros`);
}
