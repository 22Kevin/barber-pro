/**
 * auto-migrate.ts
 *
 * Migração automática executada no boot do servidor.
 * Cria tabelas e colunas que possam estar faltando no banco de produção
 * sem afetar dados existentes (usa IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS).
 *
 * IMPORTANTE: Todas as novas tabelas e colunas devem ser adicionadas aqui
 * para garantir que o banco de produção esteja sempre sincronizado com o schema.
 */

export async function runAutoMigrate(db: any): Promise<void> {
  const migrations: Array<{ name: string; sql: string }> = [
    // ─── Tabelas base ─────────────────────────────────────────────────────────
    {
      name: "tenants",
      sql: `CREATE TABLE IF NOT EXISTS tenants (id INT PRIMARY KEY AUTO_INCREMENT, slug VARCHAR(100) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, phone VARCHAR(20), cnpj VARCHAR(20), address TEXT, cep VARCHAR(10), addressNumber VARCHAR(20), addressComplement VARCHAR(100), city VARCHAR(100), state VARCHAR(2), plan ENUM('solo','team','studio') NOT NULL DEFAULT 'solo', status ENUM('active','trial','suspended','cancelled') NOT NULL DEFAULT 'trial', trialEndsAt TIMESTAMP NULL, logoUrl TEXT, latitude DECIMAL(10,7), longitude DECIMAL(10,7), descricao TEXT, fotoCapa TEXT, visivelMarketplace BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "barbers",
      sql: `CREATE TABLE IF NOT EXISTS barbers (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, name VARCHAR(255) NOT NULL, email VARCHAR(320), phone VARCHAR(20), photoUrl TEXT, role ENUM('super_admin','barber','receptionist') NOT NULL DEFAULT 'barber', specialties TEXT, isActive BOOLEAN NOT NULL DEFAULT TRUE, passwordHash VARCHAR(255), googleId VARCHAR(128), pushToken TEXT, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "clients",
      sql: `CREATE TABLE IF NOT EXISTS clients (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, preferredTenantId INT, name VARCHAR(255) NOT NULL, email VARCHAR(320), phone VARCHAR(20) NOT NULL, birthDate VARCHAR(10), photoUrl TEXT, notes TEXT, totalPoints INT NOT NULL DEFAULT 0, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "categories",
      sql: `CREATE TABLE IF NOT EXISTS categories (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL, type ENUM('service','product') NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "services",
      sql: `CREATE TABLE IF NOT EXISTS services (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, categoryId INT, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL, durationMinutes INT NOT NULL DEFAULT 30, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "products",
      sql: `CREATE TABLE IF NOT EXISTS products (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, categoryId INT, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL, stock INT NOT NULL DEFAULT 0, productType ENUM('sale','internal') NOT NULL DEFAULT 'sale', stockQuantity INT NOT NULL DEFAULT 0, minStockAlert INT NOT NULL DEFAULT 5, supplierId INT, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "suppliers",
      sql: `CREATE TABLE IF NOT EXISTS suppliers (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, name VARCHAR(255) NOT NULL, phone VARCHAR(30), email VARCHAR(255), cnpj VARCHAR(20), address TEXT, notes TEXT, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "media_files",
      sql: "CREATE TABLE IF NOT EXISTS media_files (id INT PRIMARY KEY AUTO_INCREMENT, entityType ENUM('service','product') NOT NULL, entityId INT NOT NULL, url TEXT NOT NULL, type ENUM('image','video') NOT NULL, `order` INT NOT NULL DEFAULT 0, createdAt TIMESTAMP NOT NULL DEFAULT NOW())",
    },
    {
      name: "working_hours",
      sql: `CREATE TABLE IF NOT EXISTS working_hours (id INT PRIMARY KEY AUTO_INCREMENT, barberId INT NOT NULL, dayOfWeek INT NOT NULL, startTime TIME NOT NULL, endTime TIME NOT NULL, lunchStart TIME, lunchEnd TIME, isWorking BOOLEAN NOT NULL DEFAULT TRUE)`,
    },
    {
      name: "blocked_slots",
      sql: `CREATE TABLE IF NOT EXISTS blocked_slots (id INT PRIMARY KEY AUTO_INCREMENT, barberId INT NOT NULL, date VARCHAR(10) NOT NULL, startTime TIME NOT NULL, endTime TIME NOT NULL, reason VARCHAR(255), createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "appointments",
      sql: `CREATE TABLE IF NOT EXISTS appointments (id INT PRIMARY KEY AUTO_INCREMENT, clientId INT NOT NULL, barberId INT NOT NULL, serviceId INT NOT NULL, serviceNames TEXT, date VARCHAR(10) NOT NULL, startTime TIME NOT NULL, endTime TIME NOT NULL, status ENUM('scheduled','confirmed','in_progress','completed','cancelled','no_show','pending_approval') NOT NULL DEFAULT 'scheduled', notes TEXT, cancelReason TEXT, reminderSent BOOLEAN NOT NULL DEFAULT FALSE, whatsappConfirmationSent BOOLEAN NOT NULL DEFAULT FALSE, whatsappReminder24hSent BOOLEAN NOT NULL DEFAULT FALSE, whatsappReminder1hSent BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "sales",
      sql: `CREATE TABLE IF NOT EXISTS sales (id INT PRIMARY KEY AUTO_INCREMENT, clientId INT, barberId INT NOT NULL, appointmentId INT, subtotal DECIMAL(10,2) NOT NULL, discount DECIMAL(10,2) NOT NULL DEFAULT 0, total DECIMAL(10,2) NOT NULL, paymentMethod ENUM('cash','credit_card','debit_card','pix','mercado_pago','other') NOT NULL, paymentStatus ENUM('pending','paid','cancelled','refunded') NOT NULL DEFAULT 'pending', couponId INT, couponCode VARCHAR(50), mercadoPagoPaymentId VARCHAR(255), notes TEXT, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "sale_items",
      sql: `CREATE TABLE IF NOT EXISTS sale_items (id INT PRIMARY KEY AUTO_INCREMENT, saleId INT NOT NULL, itemType ENUM('service','product') NOT NULL, itemId INT NOT NULL, itemName VARCHAR(255) NOT NULL, quantity INT NOT NULL DEFAULT 1, unitPrice DECIMAL(10,2) NOT NULL, total DECIMAL(10,2) NOT NULL)`,
    },
    {
      name: "expenses",
      sql: `CREATE TABLE IF NOT EXISTS expenses (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, barberId INT, category VARCHAR(100) NOT NULL, description VARCHAR(500) NOT NULL, amount DECIMAL(10,2) NOT NULL, date VARCHAR(10) NOT NULL, paymentMethod VARCHAR(50), receiptUrl TEXT, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "loyalty_config",
      sql: `CREATE TABLE IF NOT EXISTS loyalty_config (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, isActive BOOLEAN NOT NULL DEFAULT FALSE, pointsPerService INT NOT NULL DEFAULT 10, pointsPerReal DECIMAL(5,2) NOT NULL DEFAULT 1, pointsExpireMonths INT NOT NULL DEFAULT 0, updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "loyalty_rewards",
      sql: `CREATE TABLE IF NOT EXISTS loyalty_rewards (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, name VARCHAR(255) NOT NULL, description TEXT, pointsRequired INT NOT NULL, rewardType ENUM('free_service','discount_percent','discount_fixed','free_product') NOT NULL, rewardValue DECIMAL(10,2), isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "client_points",
      sql: `CREATE TABLE IF NOT EXISTS client_points (id INT PRIMARY KEY AUTO_INCREMENT, clientId INT NOT NULL, points INT NOT NULL, type ENUM('earned','redeemed','expired','adjusted') NOT NULL, description VARCHAR(255), saleId INT, rewardId INT, expiresAt TIMESTAMP NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "coupons",
      sql: `CREATE TABLE IF NOT EXISTS coupons (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, code VARCHAR(50) NOT NULL UNIQUE, description VARCHAR(255), discountType ENUM('percent','fixed') NOT NULL, discountValue DECIMAL(10,2) NOT NULL, minOrderValue DECIMAL(10,2) DEFAULT 0, maxUses INT, usedCount INT NOT NULL DEFAULT 0, validFrom VARCHAR(10), validUntil VARCHAR(10), isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "coupon_uses",
      sql: `CREATE TABLE IF NOT EXISTS coupon_uses (id INT PRIMARY KEY AUTO_INCREMENT, couponId INT NOT NULL, clientId INT NOT NULL, saleId INT, usedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "shop_settings",
      sql: `CREATE TABLE IF NOT EXISTS shop_settings (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, shopName VARCHAR(255) NOT NULL DEFAULT 'Barber Pro', address TEXT, phone VARCHAR(20), whatsapp VARCHAR(20), logoUrl TEXT, mercadoPagoAccessToken TEXT, mercadoPagoPublicKey TEXT, whatsappMessageTemplate TEXT, reminderMessageTemplate TEXT, instagram VARCHAR(100), cnpj VARCHAR(20), cep VARCHAR(10), addressNumber VARCHAR(20), addressComplement VARCHAR(100), googleMapsUrl TEXT, pixKey VARCHAR(255), galleryUrls TEXT, primaryColor VARCHAR(20) DEFAULT '#C9A84C', bannerUrl TEXT, customDomain VARCHAR(255), ga4MeasurementId VARCHAR(50), facebookPixelId VARCHAR(50), seoTitle VARCHAR(100), seoDescription VARCHAR(300), seoImageUrl TEXT, fontStyle VARCHAR(30) DEFAULT 'moderno', updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "password_reset_tokens",
      sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(320) NOT NULL, token VARCHAR(6) NOT NULL, expiresAt TIMESTAMP NOT NULL, used BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "client_accounts",
      sql: `CREATE TABLE IF NOT EXISTS client_accounts (id INT PRIMARY KEY AUTO_INCREMENT, clientId INT NOT NULL UNIQUE, email VARCHAR(320) NOT NULL UNIQUE, passwordHash VARCHAR(255) NOT NULL, googleId VARCHAR(255), pushToken TEXT, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "reviews",
      sql: `CREATE TABLE IF NOT EXISTS reviews (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL DEFAULT 0, clientId INT NOT NULL, serviceId INT, appointmentId INT, productId INT, orderId INT, rating INT NOT NULL, comment TEXT, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "return_message_configs",
      sql: `CREATE TABLE IF NOT EXISTS return_message_configs (id INT PRIMARY KEY AUTO_INCREMENT, serviceId INT NOT NULL UNIQUE, delayDays INT NOT NULL DEFAULT 21, messageTemplate TEXT NOT NULL, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "promotions",
      sql: `CREATE TABLE IF NOT EXISTS promotions (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT, title VARCHAR(255) NOT NULL, message TEXT NOT NULL, targetAudience ENUM('all','inactive_30','inactive_60','birthday_month','specific_client') NOT NULL DEFAULT 'all', specificClientId INT, sentAt TIMESTAMP NULL, recipientCount INT NOT NULL DEFAULT 0, createdBy INT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "waitlist",
      sql: `CREATE TABLE IF NOT EXISTS waitlist (id INT PRIMARY KEY AUTO_INCREMENT, clientId INT NOT NULL, barberId INT, serviceId INT, date VARCHAR(10) NOT NULL, notifiedAt TIMESTAMP NULL, status ENUM('waiting','notified','booked','cancelled') NOT NULL DEFAULT 'waiting', createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "commission_configs",
      sql: `CREATE TABLE IF NOT EXISTS commission_configs (id INT PRIMARY KEY AUTO_INCREMENT, barberId INT NOT NULL UNIQUE, defaultRate DECIMAL(5,2) NOT NULL DEFAULT 50.00, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "commission_entries",
      sql: `CREATE TABLE IF NOT EXISTS commission_entries (id INT PRIMARY KEY AUTO_INCREMENT, barberId INT NOT NULL, appointmentId INT, saleId INT, grossValue DECIMAL(10,2) NOT NULL, commissionRate DECIMAL(5,2) NOT NULL, commissionValue DECIMAL(10,2) NOT NULL, type ENUM('service','product') NOT NULL DEFAULT 'service', description VARCHAR(255), date VARCHAR(10) NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "recurring_appointments",
      sql: `CREATE TABLE IF NOT EXISTS recurring_appointments (id INT PRIMARY KEY AUTO_INCREMENT, clientId INT NOT NULL, barberId INT NOT NULL, serviceId INT NOT NULL, startDate VARCHAR(10) NOT NULL, startTime TIME NOT NULL, endTime TIME NOT NULL, intervalWeeks INT NOT NULL DEFAULT 4, occurrences INT NOT NULL DEFAULT 6, isActive BOOLEAN NOT NULL DEFAULT TRUE, notes TEXT, cancelledAt TIMESTAMP NULL, cancelReason VARCHAR(255), createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "stock_movements",
      sql: `CREATE TABLE IF NOT EXISTS stock_movements (id INT PRIMARY KEY AUTO_INCREMENT, productId INT NOT NULL, type ENUM('in','out','adjustment') NOT NULL, quantity INT NOT NULL, reason VARCHAR(255), barberId INT, saleId INT, supplierId INT, date VARCHAR(10) NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "whatsapp_messages",
      sql: `CREATE TABLE IF NOT EXISTS whatsapp_messages (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, clientId INT NOT NULL, barberId INT NOT NULL, direction ENUM('outgoing','incoming') NOT NULL DEFAULT 'outgoing', message TEXT NOT NULL, sentAt TIMESTAMP NOT NULL DEFAULT NOW(), status ENUM('sent','delivered','read') NOT NULL DEFAULT 'sent')`,
    },
    {
      name: "orbit_leads",
      sql: `CREATE TABLE IF NOT EXISTS orbit_leads (id INT PRIMARY KEY AUTO_INCREMENT, clientId INT NOT NULL, tenantId INT NOT NULL, loginAt TIMESTAMP NOT NULL DEFAULT NOW(), convertedAt TIMESTAMP NULL, source ENUM('link','geo') NOT NULL DEFAULT 'link')`,
    },
    {
      name: "subscription_plans",
      sql: `CREATE TABLE IF NOT EXISTS subscription_plans (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, name VARCHAR(100) NOT NULL, description TEXT, recurrences INT NOT NULL DEFAULT 4, maxServices INT NOT NULL DEFAULT 1, maxProducts INT NOT NULL DEFAULT 0, price DECIMAL(10,2) NOT NULL, suggestedPrice DECIMAL(10,2), isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "subscription_plan_services",
      sql: `CREATE TABLE IF NOT EXISTS subscription_plan_services (id INT PRIMARY KEY AUTO_INCREMENT, planId INT NOT NULL, serviceId INT NOT NULL, tenantId INT NOT NULL)`,
    },
    {
      name: "subscription_plan_products",
      sql: `CREATE TABLE IF NOT EXISTS subscription_plan_products (id INT PRIMARY KEY AUTO_INCREMENT, planId INT NOT NULL, productId INT NOT NULL, tenantId INT NOT NULL)`,
    },
    {
      name: "client_subscriptions",
      sql: `CREATE TABLE IF NOT EXISTS client_subscriptions (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, planId INT NOT NULL, clientId INT NOT NULL, barberId INT, selectedServiceIds TEXT, selectedProductIds TEXT, status ENUM('active','cancelled','expired') NOT NULL DEFAULT 'active', paymentMethod ENUM('credit_card','pix','cash','debit_card') NOT NULL DEFAULT 'cash', price DECIMAL(10,2) NOT NULL, cycleStart DATE NOT NULL, cycleEnd DATE NOT NULL, usedRecurrences INT NOT NULL DEFAULT 0, cancelledAt TIMESTAMP NULL, cancelReason TEXT, autoRenew BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "subscription_appointments",
      sql: `CREATE TABLE IF NOT EXISTS subscription_appointments (id INT PRIMARY KEY AUTO_INCREMENT, subscriptionId INT NOT NULL, appointmentId INT NOT NULL, tenantId INT NOT NULL, recurrenceIndex INT NOT NULL DEFAULT 1)`,
    },
    {
      name: "online_payments",
      sql: `CREATE TABLE IF NOT EXISTS online_payments (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, clientId INT NOT NULL, chargeType ENUM('product','appointment','subscription') NOT NULL, referenceId INT, asaasPaymentId VARCHAR(100), asaasSubscriptionId VARCHAR(100), asaasCustomerId VARCHAR(100), billingType ENUM('BOLETO','CREDIT_CARD','PIX','STORE') NOT NULL DEFAULT 'PIX', amount DECIMAL(10,2) NOT NULL, status ENUM('pending','paid','overdue','refunded','cancelled') NOT NULL DEFAULT 'pending', invoiceUrl TEXT, pixQrCode TEXT, pixCopyCola TEXT, dueDate DATE, paidAt TIMESTAMP NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "product_orders",
      sql: `CREATE TABLE IF NOT EXISTS product_orders (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, clientId INT NOT NULL, productId INT NOT NULL, quantity INT NOT NULL DEFAULT 1, note TEXT, status ENUM('received','confirmed','preparing','ready','delivered','cancelled') NOT NULL DEFAULT 'received', estimatedDays INT, confirmedAt TIMESTAMP NULL, cancelledAt TIMESTAMP NULL, cancelReason TEXT, deliveredAt TIMESTAMP NULL, totalPrice DECIMAL(10,2), paymentMethod VARCHAR(50), paidAt TIMESTAMP NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "error_logs",
      sql: `CREATE TABLE IF NOT EXISTS error_logs (id INT PRIMARY KEY AUTO_INCREMENT, source VARCHAR(20) NOT NULL DEFAULT 'browser', message TEXT NOT NULL, stack TEXT, url VARCHAR(500), userAgent VARCHAR(500), tenantId INT, context TEXT, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "backoffice_users",
      sql: `CREATE TABLE IF NOT EXISTS backoffice_users (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(320) NOT NULL UNIQUE, passwordHash VARCHAR(255) NOT NULL, name VARCHAR(255), role VARCHAR(50) DEFAULT 'admin', isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "client_consents",
      sql: `CREATE TABLE IF NOT EXISTS client_consents (id INT PRIMARY KEY AUTO_INCREMENT, clientId INT NOT NULL, tenantId INT NOT NULL, consentType VARCHAR(50) NOT NULL, granted BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "support_tickets",
      sql: `CREATE TABLE IF NOT EXISTS support_tickets (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, title VARCHAR(255) NOT NULL, category VARCHAR(50) NOT NULL DEFAULT 'other', status VARCHAR(30) NOT NULL DEFAULT 'open', priority VARCHAR(20) NOT NULL DEFAULT 'normal', aiHandled BOOLEAN NOT NULL DEFAULT FALSE, adminNotified BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },
    {
      name: "support_messages",
      sql: `CREATE TABLE IF NOT EXISTS support_messages (id INT PRIMARY KEY AUTO_INCREMENT, ticketId INT NOT NULL, authorType VARCHAR(20) NOT NULL, authorName VARCHAR(255), content TEXT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW())`,
    },

    // ─── ALTER TABLE: adicionar colunas que podem estar faltando ─────────────
    // Nota: ADD COLUMN IF NOT EXISTS é suportado no MySQL 8.0+ e TiDB
    { name: "products.supplierId",       sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS supplierId INT NULL` },
    { name: "products.productType",      sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS productType ENUM('sale','internal') NOT NULL DEFAULT 'sale'` },
    { name: "products.stockQuantity",    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS stockQuantity INT NOT NULL DEFAULT 0` },
    { name: "products.minStockAlert",    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS minStockAlert INT NOT NULL DEFAULT 5` },
    { name: "clients.birthDate",         sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthDate VARCHAR(10)` },
    { name: "clients.preferredTenantId", sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferredTenantId INT` },
    { name: "barbers.pushToken",         sql: `ALTER TABLE barbers ADD COLUMN IF NOT EXISTS pushToken TEXT` },
    { name: "barbers.googleId",          sql: `ALTER TABLE barbers ADD COLUMN IF NOT EXISTS googleId VARCHAR(128)` },
    { name: "appointments.serviceNames", sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS serviceNames TEXT` },
    { name: "appointments.whatsappConfirmationSent", sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsappConfirmationSent BOOLEAN NOT NULL DEFAULT FALSE` },
    { name: "appointments.whatsappReminder24hSent",  sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsappReminder24hSent BOOLEAN NOT NULL DEFAULT FALSE` },
    { name: "appointments.whatsappReminder1hSent",   sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsappReminder1hSent BOOLEAN NOT NULL DEFAULT FALSE` },
    { name: "sales.couponId",            sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS couponId INT` },
    { name: "sales.couponCode",          sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS couponCode VARCHAR(50)` },
    { name: "sales.mercadoPagoPaymentId", sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS mercadoPagoPaymentId VARCHAR(255)` },
    { name: "shop_settings.instagram",   sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS instagram VARCHAR(100)` },
    { name: "shop_settings.cnpj",        sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20)` },
    { name: "shop_settings.cep",         sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS cep VARCHAR(10)` },
    { name: "shop_settings.addressNumber", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS addressNumber VARCHAR(20)` },
    { name: "shop_settings.addressComplement", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS addressComplement VARCHAR(100)` },
    { name: "shop_settings.googleMapsUrl", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS googleMapsUrl TEXT` },
    { name: "shop_settings.pixKey",      sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS pixKey VARCHAR(255)` },
    { name: "shop_settings.galleryUrls", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS galleryUrls TEXT` },
    { name: "shop_settings.primaryColor", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS primaryColor VARCHAR(20) DEFAULT '#C9A84C'` },
    { name: "shop_settings.bannerUrl",   sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS bannerUrl TEXT` },
    { name: "shop_settings.customDomain", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS customDomain VARCHAR(255)` },
    { name: "shop_settings.ga4MeasurementId", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS ga4MeasurementId VARCHAR(50)` },
    { name: "shop_settings.facebookPixelId", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS facebookPixelId VARCHAR(50)` },
    { name: "shop_settings.seoTitle",    sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS seoTitle VARCHAR(100)` },
    { name: "shop_settings.seoDescription", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS seoDescription VARCHAR(300)` },
    { name: "shop_settings.seoImageUrl", sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS seoImageUrl TEXT` },
    { name: "shop_settings.fontStyle",   sql: `ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS fontStyle VARCHAR(30) DEFAULT 'moderno'` },
    { name: "stock_movements.supplierId", sql: `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS supplierId INT` },
    { name: "reviews.productId",         sql: `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS productId INT` },
    { name: "reviews.orderId",           sql: `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS orderId INT` },
    { name: "client_accounts.googleId",  sql: `ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS googleId VARCHAR(255)` },
    { name: "client_accounts.pushToken", sql: `ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS pushToken TEXT` },
    { name: "product_orders.totalPrice", sql: `ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS totalPrice DECIMAL(10,2)` },
    { name: "product_orders.paymentMethod", sql: `ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS paymentMethod VARCHAR(50)` },
    { name: "product_orders.paidAt",     sql: `ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS paidAt TIMESTAMP NULL` },
    { name: "tenants.descricao",         sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS descricao TEXT` },
    { name: "tenants.fotoCapa",          sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS fotoCapa TEXT` },
    { name: "tenants.visivelMarketplace", sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS visivelMarketplace BOOLEAN NOT NULL DEFAULT FALSE` },
    { name: "tenants.latitude",          sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)` },
    { name: "tenants.longitude",         sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)` },
    { name: "tenants.cep",               sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cep VARCHAR(10)` },
    { name: "tenants.addressNumber",     sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS addressNumber VARCHAR(20)` },
    { name: "tenants.addressComplement", sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS addressComplement VARCHAR(100)` },
    { name: "tenants.city",              sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city VARCHAR(100)` },
    { name: "tenants.state",             sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state VARCHAR(2)` },
  ];

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const migration of migrations) {
    try {
      await db.execute(migration.sql as any);
      created++;
    } catch (err: any) {
      // Ignorar erros de "column already exists" (1060) e "table already exists" (1050)
      const code = err?.cause?.errno ?? err?.errno ?? 0;
      const msg = (err?.message ?? "").toLowerCase();
      const isAlreadyExists =
        code === 1060 || code === 1050 ||
        msg.includes("duplicate column") ||
        msg.includes("already exists") ||
        msg.includes("column exists");

      if (isAlreadyExists) {
        skipped++;
      } else {
        errors++;
        console.warn(`[auto-migrate] ⚠️  ${migration.name}: ${err?.message ?? err}`);
      }
    }
  }

  console.log(`[auto-migrate] ✅ Concluído: ${created} executados, ${skipped} já existiam, ${errors} erros`);
}
