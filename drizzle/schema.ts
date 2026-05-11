import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const planEnum = pgEnum("plan", ["solo", "team", "studio"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "trial", "suspended", "cancelled"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const barberRoleEnum = pgEnum("barber_role", ["super_admin", "barber", "receptionist"]);
export const categoryTypeEnum = pgEnum("category_type", ["service", "product"]);
export const productTypeEnum = pgEnum("product_type", ["sale", "internal"]);
export const mediaEntityTypeEnum = pgEnum("media_entity_type", ["service", "product"]);
export const mediaTypeEnum = pgEnum("media_type", ["image", "video"]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show", "pending_approval"
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash", "credit_card", "debit_card", "pix", "mercado_pago", "other"
]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "cancelled", "refunded"]);
export const saleItemTypeEnum = pgEnum("sale_item_type", ["service", "product"]);
export const rewardTypeEnum = pgEnum("reward_type", [
  "free_service", "discount_percent", "discount_fixed", "free_product"
]);
export const clientPointTypeEnum = pgEnum("client_point_type", ["earned", "redeemed", "expired", "adjusted"]);
export const couponDiscountTypeEnum = pgEnum("coupon_discount_type", ["percent", "fixed"]);
export const targetAudienceEnum = pgEnum("target_audience", [
  "all", "inactive_30", "inactive_60", "birthday_month", "specific_client"
]);
export const waitlistStatusEnum = pgEnum("waitlist_status", ["waiting", "notified", "booked", "cancelled"]);
export const commissionTypeEnum = pgEnum("commission_type", ["service", "product"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["in", "out", "adjustment"]);
export const whatsappDirectionEnum = pgEnum("whatsapp_direction", ["outgoing", "incoming"]);
export const whatsappStatusEnum = pgEnum("whatsapp_status", ["sent", "delivered", "read"]);
export const orbitSourceEnum = pgEnum("orbit_source", ["link", "geo"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "cancelled", "expired"]);
export const subscriptionPaymentMethodEnum = pgEnum("subscription_payment_method", [
  "credit_card", "pix", "cash", "debit_card"
]);
export const chargeTypeEnum = pgEnum("charge_type", ["product", "appointment", "subscription"]);
export const billingTypeEnum = pgEnum("billing_type", ["BOLETO", "CREDIT_CARD", "PIX", "STORE"]);
export const onlinePaymentStatusEnum = pgEnum("online_payment_status", [
  "pending", "paid", "overdue", "refunded", "cancelled"
]);
export const productOrderStatusEnum = pgEnum("product_order_status", [
  "received", "confirmed", "preparing", "ready", "delivered", "cancelled"
]);

// ─── Tenants (Barbearias/Salões) ──────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  cnpj: varchar("cnpj", { length: 20 }),
  address: text("address"),
  cep: varchar("cep", { length: 10 }),
  addressNumber: varchar("addressNumber", { length: 20 }),
  addressComplement: varchar("addressComplement", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  plan: planEnum("plan").default("solo").notNull(),
  status: tenantStatusEnum("status").default("trial").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  logoUrl: text("logoUrl"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  descricao: text("descricao"),
  fotoCapa: text("fotoCapa"),
  visivelMarketplace: boolean("visivelMarketplace").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Usuários do Sistema ───────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ─── Barbeiros / Funcionários ─────────────────────────────────────────────────
export const barbers = pgTable("barbers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  photoUrl: text("photoUrl"),
  role: barberRoleEnum("role").default("barber").notNull(),
  specialties: text("specialties"),
  isActive: boolean("isActive").default(true).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  googleId: varchar("googleId", { length: 128 }),
  pushToken: text("pushToken"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Clientes da Barbearia ────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  preferredTenantId: integer("preferredTenantId"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  birthDate: varchar("birthDate", { length: 10 }),
  photoUrl: text("photoUrl"),
  notes: text("notes"),
  totalPoints: integer("totalPoints").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Categorias ───────────────────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: categoryTypeEnum("type").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Serviços ─────────────────────────────────────────────────────────────────
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  categoryId: integer("categoryId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer("durationMinutes").notNull().default(30),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Produtos ─────────────────────────────────────────────────────────────────
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  categoryId: integer("categoryId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").default(0).notNull(),
  productType: productTypeEnum("productType").default("sale").notNull(),
  stockQuantity: integer("stockQuantity").default(0).notNull(),
  minStockAlert: integer("minStockAlert").default(5).notNull(),
  supplierId: integer("supplierId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Fornecedores ────────────────────────────────────────────────────────────
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  cnpj: varchar("cnpj", { length: 20 }),
  address: text("address"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Arquivos de Mídia ────────────────────────────────────────────────────────
export const mediaFiles = pgTable("media_files", {
  id: serial("id").primaryKey(),
  entityType: mediaEntityTypeEnum("entityType").notNull(),
  entityId: integer("entityId").notNull(),
  url: text("url").notNull(),
  type: mediaTypeEnum("type").notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Horários de Trabalho ─────────────────────────────────────────────────────
export const workingHours = pgTable("working_hours", {
  id: serial("id").primaryKey(),
  barberId: integer("barberId").notNull(),
  dayOfWeek: integer("dayOfWeek").notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  lunchStart: time("lunchStart"),
  lunchEnd: time("lunchEnd"),
  isWorking: boolean("isWorking").default(true).notNull(),
});

// ─── Horários Bloqueados ──────────────────────────────────────────────────────
export const blockedSlots = pgTable("blocked_slots", {
  id: serial("id").primaryKey(),
  barberId: integer("barberId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Agendamentos ─────────────────────────────────────────────────────────────
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  barberId: integer("barberId").notNull(),
  serviceId: integer("serviceId").notNull(),
  serviceNames: text("serviceNames"),
  date: varchar("date", { length: 10 }).notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  notes: text("notes"),
  cancelReason: text("cancelReason"),
  reminderSent: boolean("reminderSent").default(false).notNull(),
  whatsappConfirmationSent: boolean("whatsappConfirmationSent").default(false).notNull(),
  whatsappReminder24hSent: boolean("whatsappReminder24hSent").default(false).notNull(),
  whatsappReminder1hSent: boolean("whatsappReminder1hSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_appointments_barber_date_status").on(t.barberId, t.date, t.status),
  index("idx_appointments_client_id").on(t.clientId),
  index("idx_appointments_date").on(t.date),
  index("idx_appointments_status_date").on(t.status, t.date),
]);

// ─── Vendas ───────────────────────────────────────────────────────────────────
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId"),
  barberId: integer("barberId").notNull(),
  appointmentId: integer("appointmentId"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod").notNull(),
  paymentStatus: paymentStatusEnum("paymentStatus").default("pending").notNull(),
  couponId: integer("couponId"),
  couponCode: varchar("couponCode", { length: 50 }),
  mercadoPagoPaymentId: varchar("mercadoPagoPaymentId", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_sales_barber_date").on(t.barberId, t.createdAt),
  index("idx_sales_client_id").on(t.clientId),
  index("idx_sales_payment_status").on(t.paymentStatus),
]);

// ─── Itens de Venda ───────────────────────────────────────────────────────────
export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("saleId").notNull(),
  itemType: saleItemTypeEnum("itemType").notNull(),
  itemId: integer("itemId").notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: numeric("unitPrice", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
});

// ─── Despesas ─────────────────────────────────────────────────────────────────
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  barberId: integer("barberId"),
  category: varchar("category", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  receiptUrl: text("receiptUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Configuração de Fidelidade ───────────────────────────────────────────────
export const loyaltyConfig = pgTable("loyalty_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  isActive: boolean("isActive").default(false).notNull(),
  pointsPerService: integer("pointsPerService").default(10).notNull(),
  pointsPerReal: numeric("pointsPerReal", { precision: 5, scale: 2 }).default("1").notNull(),
  pointsExpireMonths: integer("pointsExpireMonths").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Recompensas de Fidelidade ────────────────────────────────────────────────
export const loyaltyRewards = pgTable("loyalty_rewards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pointsRequired: integer("pointsRequired").notNull(),
  rewardType: rewardTypeEnum("rewardType").notNull(),
  rewardValue: numeric("rewardValue", { precision: 10, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Pontos dos Clientes ──────────────────────────────────────────────────────
export const clientPoints = pgTable("client_points", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  points: integer("points").notNull(),
  type: clientPointTypeEnum("type").notNull(),
  description: varchar("description", { length: 255 }),
  saleId: integer("saleId"),
  rewardId: integer("rewardId"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Cupons de Desconto ───────────────────────────────────────────────────────
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  discountType: couponDiscountTypeEnum("discountType").notNull(),
  discountValue: numeric("discountValue", { precision: 10, scale: 2 }).notNull(),
  minOrderValue: numeric("minOrderValue", { precision: 10, scale: 2 }).default("0"),
  maxUses: integer("maxUses"),
  usedCount: integer("usedCount").default(0).notNull(),
  validFrom: varchar("validFrom", { length: 10 }),
  validUntil: varchar("validUntil", { length: 10 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Configurações da Barbearia ───────────────────────────────────────────────
export const shopSettings = pgTable("shop_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  shopName: varchar("shopName", { length: 255 }).default("Barber Pro").notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  logoUrl: text("logoUrl"),
  mercadoPagoAccessToken: text("mercadoPagoAccessToken"),
  mercadoPagoPublicKey: text("mercadoPagoPublicKey"),
  whatsappMessageTemplate: text("whatsappMessageTemplate"),
  reminderMessageTemplate: text("reminderMessageTemplate"),
  instagram: varchar("instagram", { length: 100 }),
  cnpj: varchar("cnpj", { length: 20 }),
  cep: varchar("cep", { length: 10 }),
  addressNumber: varchar("addressNumber", { length: 20 }),
  addressComplement: varchar("addressComplement", { length: 100 }),
  googleMapsUrl: text("googleMapsUrl"),
  pixKey: varchar("pixKey", { length: 255 }),
  galleryUrls: text("galleryUrls"),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#C9A84C"),
  bannerUrl: text("bannerUrl"),
  customDomain: varchar("customDomain", { length: 255 }),
  ga4MeasurementId: varchar("ga4MeasurementId", { length: 50 }),
  facebookPixelId: varchar("facebookPixelId", { length: 50 }),
  seoTitle: varchar("seoTitle", { length: 100 }),
  seoDescription: varchar("seoDescription", { length: 300 }),
  seoImageUrl: text("seoImageUrl"),
  fontStyle: varchar("fontStyle", { length: 30 }).default("moderno"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Tokens de Recuperação de Senha ────────────────────────────────────────
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Contas de Clientes (Área do Cliente) ────────────────────────────────────────
export const clientAccounts = pgTable("client_accounts", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  googleId: varchar("googleId", { length: 255 }),
  pushToken: text("pushToken"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Avaliações de Serviços ───────────────────────────────────────────────────
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(0),
  clientId: integer("clientId").notNull(),
  serviceId: integer("serviceId"),
  appointmentId: integer("appointmentId"),
  productId: integer("productId"),
  orderId: integer("orderId"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Mensagens de Retorno Automáticas ───────────────────────────────────────
export const returnMessageConfigs = pgTable("return_message_configs", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId").notNull().unique(),
  delayDays: integer("delayDays").notNull().default(21),
  messageTemplate: text("messageTemplate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Promoções e Notícias ─────────────────────────────────────────────────────
export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  targetAudience: targetAudienceEnum("targetAudience").notNull().default("all"),
  specificClientId: integer("specificClientId"),
  sentAt: timestamp("sentAt"),
  recipientCount: integer("recipientCount").default(0).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Lista de Espera ──────────────────────────────────────────────────────────
export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  barberId: integer("barberId"),
  serviceId: integer("serviceId"),
  date: varchar("date", { length: 10 }).notNull(),
  notifiedAt: timestamp("notifiedAt"),
  status: waitlistStatusEnum("status").default("waiting").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Configuração de Comissões por Barbeiro ───────────────────────────────────
export const commissionConfigs = pgTable("commission_configs", {
  id: serial("id").primaryKey(),
  barberId: integer("barberId").notNull().unique(),
  defaultRate: numeric("defaultRate", { precision: 5, scale: 2 }).notNull().default("50.00"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Entradas de Comissão ─────────────────────────────────────────────────────
export const commissionEntries = pgTable("commission_entries", {
  id: serial("id").primaryKey(),
  barberId: integer("barberId").notNull(),
  appointmentId: integer("appointmentId"),
  saleId: integer("saleId"),
  grossValue: numeric("grossValue", { precision: 10, scale: 2 }).notNull(),
  commissionRate: numeric("commissionRate", { precision: 5, scale: 2 }).notNull(),
  commissionValue: numeric("commissionValue", { precision: 10, scale: 2 }).notNull(),
  type: commissionTypeEnum("type").notNull().default("service"),
  description: varchar("description", { length: 255 }),
  date: varchar("date", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Agendamentos Recorrentes ────────────────────────────────────────────────
export const recurringAppointments = pgTable("recurring_appointments", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  barberId: integer("barberId").notNull(),
  serviceId: integer("serviceId").notNull(),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  intervalWeeks: integer("intervalWeeks").notNull().default(4),
  occurrences: integer("occurrences").notNull().default(6),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: varchar("cancelReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Movimentações de Estoque ────────────────────────────────────────────────
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  type: stockMovementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: varchar("reason", { length: 255 }),
  barberId: integer("barberId"),
  saleId: integer("saleId"),
  supplierId: integer("supplierId"),
  date: varchar("date", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── WhatsApp Chat Messages ───────────────────────────────────────────────────
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  clientId: integer("clientId").notNull(),
  barberId: integer("barberId").notNull(),
  direction: whatsappDirectionEnum("direction").notNull().default("outgoing"),
  message: text("message").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  status: whatsappStatusEnum("status").notNull().default("sent"),
});

// ─── Orbit Leads — Clientes em Órbita ────────────────────────────────────────
export const orbitLeads = pgTable("orbit_leads", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  tenantId: integer("tenantId").notNull(),
  loginAt: timestamp("loginAt").defaultNow().notNull(),
  convertedAt: timestamp("convertedAt"),
  source: orbitSourceEnum("source").notNull().default("link"),
});

// ─── Subscription Plans (Planos de Assinatura) ─────────────────────────────────────────────
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  recurrences: integer("recurrences").notNull().default(4),
  maxServices: integer("maxServices").notNull().default(1),
  maxProducts: integer("maxProducts").notNull().default(0),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  suggestedPrice: numeric("suggestedPrice", { precision: 10, scale: 2 }),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Subscription Plan Services (Serviços disponíveis no plano) ──────────────────
export const subscriptionPlanServices = pgTable("subscription_plan_services", {
  id: serial("id").primaryKey(),
  planId: integer("planId").notNull(),
  serviceId: integer("serviceId").notNull(),
  tenantId: integer("tenantId").notNull(),
});

// ─── Subscription Plan Products (Produtos disponíveis no plano) ──────────────────
export const subscriptionPlanProducts = pgTable("subscription_plan_products", {
  id: serial("id").primaryKey(),
  planId: integer("planId").notNull(),
  productId: integer("productId").notNull(),
  tenantId: integer("tenantId").notNull(),
});

// ─── Client Subscriptions (Assinaturas ativas de clientes) ───────────────────────
export const clientSubscriptions = pgTable("client_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  planId: integer("planId").notNull(),
  clientId: integer("clientId").notNull(),
  barberId: integer("barberId"),
  selectedServiceIds: text("selectedServiceIds"),
  selectedProductIds: text("selectedProductIds"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  paymentMethod: subscriptionPaymentMethodEnum("paymentMethod").notNull().default("cash"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  cycleStart: date("cycleStart").notNull(),
  cycleEnd: date("cycleEnd").notNull(),
  usedRecurrences: integer("usedRecurrences").notNull().default(0),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),
  autoRenew: boolean("autoRenew").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Subscription Appointments (Agendamentos vinculados a uma assinatura) ────────
export const subscriptionAppointments = pgTable("subscription_appointments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscriptionId").notNull(),
  appointmentId: integer("appointmentId").notNull(),
  tenantId: integer("tenantId").notNull(),
  recurrenceIndex: integer("recurrenceIndex").notNull().default(1),
});

// ─── Online Payments — Asaas ──────────────────────────────────────────────────
export const onlinePayments = pgTable("online_payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  clientId: integer("clientId").notNull(),
  chargeType: chargeTypeEnum("chargeType").notNull(),
  referenceId: integer("referenceId"),
  asaasPaymentId: varchar("asaasPaymentId", { length: 100 }),
  asaasSubscriptionId: varchar("asaasSubscriptionId", { length: 100 }),
  asaasCustomerId: varchar("asaasCustomerId", { length: 100 }),
  billingType: billingTypeEnum("billingType").notNull().default("PIX"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: onlinePaymentStatusEnum("status").notNull().default("pending"),
  invoiceUrl: text("invoiceUrl"),
  pixQrCode: text("pixQrCode"),
  pixCopyCola: text("pixCopyCola"),
  dueDate: date("dueDate"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Encomendas de Produtos ───────────────────────────────────────────────────
export const productOrders = pgTable("product_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  clientId: integer("clientId").notNull(),
  productId: integer("productId").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  note: text("note"),
  status: productOrderStatusEnum("status").default("received").notNull(),
  estimatedDays: integer("estimatedDays"),
  confirmedAt: timestamp("confirmedAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),
  deliveredAt: timestamp("deliveredAt"),
  totalPrice: numeric("totalPrice", { precision: 10, scale: 2 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
// ─── Error Logs (Monitoramento de Erros) ─────────────────────────────────────
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 20 }).notNull().default("browser"),
  message: text("message").notNull(),
  stack: text("stack"),
  url: varchar("url", { length: 500 }),
  userAgent: varchar("userAgent", { length: 500 }),
  tenantId: integer("tenantId"),
  context: text("context"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Backoffice Users ─────────────────────────────────────────────────────────
export const backofficeUsers = pgTable("backoffice_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 50 }).default("admin"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Client Consents ──────────────────────────────────────────────────────────
export const clientConsents = pgTable("client_consents", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  tenantId: integer("tenantId").notNull(),
  consentType: varchar("consentType", { length: 50 }).notNull(),
  granted: boolean("granted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Support Tickets ────────────────────────────────────────────────────────
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("other"),
  status: varchar("status", { length: 30 }).notNull().default("open"),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  aiHandled: boolean("aiHandled").default(false).notNull(),
  adminNotified: boolean("adminNotified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull(),
  authorType: varchar("authorType", { length: 20 }).notNull(),
  authorName: varchar("authorName", { length: 255 }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Tipos Exportados ─────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Barber = typeof barbers.$inferSelect;
export type InsertBarber = typeof barbers.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;
export type SaleItem = typeof saleItems.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type LoyaltyConfig = typeof loyaltyConfig.$inferSelect;
export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type ShopSettings = typeof shopSettings.$inferSelect;
export type MediaFile = typeof mediaFiles.$inferSelect;
export type WorkingHours = typeof workingHours.$inferSelect;
export type BlockedSlot = typeof blockedSlots.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type ClientAccount = typeof clientAccounts.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type ReturnMessageConfig = typeof returnMessageConfigs.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type WaitlistEntry = typeof waitlist.$inferSelect;
export type CommissionConfig = typeof commissionConfigs.$inferSelect;
export type CommissionEntry = typeof commissionEntries.$inferSelect;
export type RecurringAppointment = typeof recurringAppointments.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;
export type OrbitLead = typeof orbitLeads.$inferSelect;
export type InsertOrbitLead = typeof orbitLeads.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type SubscriptionPlanService = typeof subscriptionPlanServices.$inferSelect;
export type SubscriptionPlanProduct = typeof subscriptionPlanProducts.$inferSelect;
export type ClientSubscription = typeof clientSubscriptions.$inferSelect;
export type InsertClientSubscription = typeof clientSubscriptions.$inferInsert;
export type SubscriptionAppointment = typeof subscriptionAppointments.$inferSelect;
export type OnlinePayment = typeof onlinePayments.$inferSelect;
export type InsertOnlinePayment = typeof onlinePayments.$inferInsert;
export type ProductOrder = typeof productOrders.$inferSelect;
export type InsertProductOrder = typeof productOrders.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = typeof supportMessages.$inferInsert;
