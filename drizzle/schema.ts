import {
  boolean,
  date,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Tenants (Barbearias/Salões) ──────────────────────────────────────────────
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-friendly identifier
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  cnpj: varchar("cnpj", { length: 20 }),
  address: text("address"),
  cep: varchar("cep", { length: 10 }),
  addressNumber: varchar("addressNumber", { length: 20 }),
  addressComplement: varchar("addressComplement", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  plan: mysqlEnum("plan", ["solo", "team", "studio"]).default("solo").notNull(),
  status: mysqlEnum("status", ["active", "trial", "suspended", "cancelled"]).default("trial").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  logoUrl: text("logoUrl"),
  // ─── Campos para suporte futuro a marketplace ─────────────────────────────
  latitude: decimal("latitude", { precision: 10, scale: 7 }),          // ex: -23.5505199
  longitude: decimal("longitude", { precision: 10, scale: 7 }),         // ex: -46.6333094
  descricao: text("descricao"),                                          // apresentação da barbearia no marketplace
  fotoCapa: text("fotoCapa"),                                            // URL da foto de capa para o card do marketplace
  visivelMarketplace: boolean("visivelMarketplace").default(false).notNull(), // opt-in: aparecer na listagem pública
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Usuários do Sistema ───────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ─── Barbeiros / Funcionários ─────────────────────────────────────────────────
export const barbers = mysqlTable("barbers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = instalação single-tenant (legado)
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  photoUrl: text("photoUrl"),
  role: mysqlEnum("role", ["super_admin", "barber", "receptionist"]).default("barber").notNull(),
  specialties: text("specialties"),
  isActive: boolean("isActive").default(true).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  googleId: varchar("googleId", { length: 128 }), // Google Sign-In ID
  pushToken: text("pushToken"), // Expo Push Token para notificações server-side
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Clientes da Barbearia ────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = instalação single-tenant (legado)
  preferredTenantId: int("preferredTenantId"), // barbearia favorita do cliente
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  birthDate: varchar("birthDate", { length: 10 }),
  photoUrl: text("photoUrl"),
  notes: text("notes"),
  totalPoints: int("totalPoints").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Categorias ───────────────────────────────────────────────────────────────
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["service", "product"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Serviços ─────────────────────────────────────────────────────────────────
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = instalação single-tenant (legado)
  categoryId: int("categoryId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  durationMinutes: int("durationMinutes").notNull().default(30),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Produtos ─────────────────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = instalação single-tenant (legado)
  categoryId: int("categoryId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: int("stock").default(0).notNull(),
  productType: mysqlEnum("productType", ["sale", "internal"]).default("sale").notNull(),
  stockQuantity: int("stockQuantity").default(0).notNull(),
  minStockAlert: int("minStockAlert").default(5).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Arquivos de Mídia ────────────────────────────────────────────────────────
export const mediaFiles = mysqlTable("media_files", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["service", "product"]).notNull(),
  entityId: int("entityId").notNull(),
  url: text("url").notNull(),
  type: mysqlEnum("type", ["image", "video"]).notNull(),
  order: int("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Horários de Trabalho ─────────────────────────────────────────────────────
export const workingHours = mysqlTable("working_hours", {
  id: int("id").autoincrement().primaryKey(),
  barberId: int("barberId").notNull(),
  dayOfWeek: int("dayOfWeek").notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  lunchStart: time("lunchStart"),
  lunchEnd: time("lunchEnd"),
  isWorking: boolean("isWorking").default(true).notNull(),
});

// ─── Horários Bloqueados ──────────────────────────────────────────────────────
export const blockedSlots = mysqlTable("blocked_slots", {
  id: int("id").autoincrement().primaryKey(),
  barberId: int("barberId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Agendamentos ─────────────────────────────────────────────────────────────
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  barberId: int("barberId").notNull(),
  serviceId: int("serviceId").notNull(),
  serviceNames: text("serviceNames"), // Nomes concatenados de todos os serviços (ex: "Corte + Barba")
  date: varchar("date", { length: 10 }).notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  status: mysqlEnum("status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show", "pending_approval"])
    .default("scheduled")
    .notNull(),
  notes: text("notes"),
  cancelReason: text("cancelReason"), // Motivo do cancelamento (preenchido pelo barbeiro)
  reminderSent: boolean("reminderSent").default(false).notNull(),
  whatsappConfirmationSent: boolean("whatsappConfirmationSent").default(false).notNull(),
  whatsappReminder24hSent: boolean("whatsappReminder24hSent").default(false).notNull(),
  whatsappReminder1hSent: boolean("whatsappReminder1hSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Vendas ───────────────────────────────────────────────────────────────────
export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId"),
  barberId: int("barberId").notNull(),
  appointmentId: int("appointmentId"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "credit_card", "debit_card", "pix", "mercado_pago", "other"]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "cancelled", "refunded"]).default("pending").notNull(),
  couponId: int("couponId"),
  couponCode: varchar("couponCode", { length: 50 }),
  mercadoPagoPaymentId: varchar("mercadoPagoPaymentId", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Itens de Venda ───────────────────────────────────────────────────────────
export const saleItems = mysqlTable("sale_items", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  itemType: mysqlEnum("itemType", ["service", "product"]).notNull(),
  itemId: int("itemId").notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
});

// ─── Despesas ─────────────────────────────────────────────────────────────────
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  barberId: int("barberId"),
  category: varchar("category", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  receiptUrl: text("receiptUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Configuração de Fidelidade ───────────────────────────────────────────────
export const loyaltyConfig = mysqlTable("loyalty_config", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = single-tenant legado
  isActive: boolean("isActive").default(false).notNull(),
  pointsPerService: int("pointsPerService").default(10).notNull(),
  pointsPerReal: decimal("pointsPerReal", { precision: 5, scale: 2 }).default("1").notNull(),
  pointsExpireMonths: int("pointsExpireMonths").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Recompensas de Fidelidade ────────────────────────────────────────────────
export const loyaltyRewards = mysqlTable("loyalty_rewards", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = single-tenant legado
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pointsRequired: int("pointsRequired").notNull(),
  rewardType: mysqlEnum("rewardType", ["free_service", "discount_percent", "discount_fixed", "free_product"]).notNull(),
  rewardValue: decimal("rewardValue", { precision: 10, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Pontos dos Clientes ──────────────────────────────────────────────────────
export const clientPoints = mysqlTable("client_points", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  points: int("points").notNull(),
  type: mysqlEnum("type", ["earned", "redeemed", "expired", "adjusted"]).notNull(),
  description: varchar("description", { length: 255 }),
  saleId: int("saleId"),
  rewardId: int("rewardId"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Cupons de Desconto ───────────────────────────────────────────────────────
export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = single-tenant legado
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  discountType: mysqlEnum("discountType", ["percent", "fixed"]).notNull(),
  discountValue: decimal("discountValue", { precision: 10, scale: 2 }).notNull(),
  minOrderValue: decimal("minOrderValue", { precision: 10, scale: 2 }).default("0"),
  maxUses: int("maxUses"),
  usedCount: int("usedCount").default(0).notNull(),
  validFrom: varchar("validFrom", { length: 10 }),
  validUntil: varchar("validUntil", { length: 10 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Configurações da Barbearia ───────────────────────────────────────────────
export const shopSettings = mysqlTable("shop_settings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = instalação single-tenant (legado)
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
  customDomain: varchar("customDomain", { length: 255 }),  // domínio personalizado da página pública
  ga4MeasurementId: varchar("ga4MeasurementId", { length: 50 }),  // Google Analytics 4 Measurement ID
  facebookPixelId: varchar("facebookPixelId", { length: 50 }),   // Facebook Pixel ID
  seoTitle: varchar("seoTitle", { length: 100 }),                 // Título SEO da página pública
  seoDescription: varchar("seoDescription", { length: 300 }),     // Meta descrição SEO
  seoImageUrl: text("seoImageUrl"),                               // Imagem Open Graph (OG)
  fontStyle: varchar("fontStyle", { length: 30 }).default("moderno"), // Estilo de fonte da página pública
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
// ─── Tokens de Recuperação de Senha ────────────────────────────────────────
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Contas de Clientes (Área do Cliente) ────────────────────────────────────────
export const clientAccounts = mysqlTable("client_accounts", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  googleId: varchar("googleId", { length: 255 }),
  pushToken: text("pushToken"), // Expo Push Token para notificações ao cliente
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Avaliações de Serviços ───────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(0), // isolamento multi-tenant
  clientId: int("clientId").notNull(),
  serviceId: int("serviceId"), // null para avaliações de produto
  appointmentId: int("appointmentId"),
  productId: int("productId"), // null para avaliações de serviço
  orderId: int("orderId"), // referencia product_orders
  rating: int("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Mensagens de Retorno Automáticas ───────────────────────────────────────
export const returnMessageConfigs = mysqlTable("return_message_configs", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull().unique(),
  delayDays: int("delayDays").notNull().default(21),
  messageTemplate: text("messageTemplate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Promoções e Notícias ─────────────────────────────────────────────────────
export const promotions = mysqlTable("promotions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"), // null = single-tenant legado
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  targetAudience: mysqlEnum("targetAudience", ["all", "inactive_30", "inactive_60", "birthday_month", "specific_client"]).notNull().default("all"),
  specificClientId: int("specificClientId"),
  sentAt: timestamp("sentAt"),
  recipientCount: int("recipientCount").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Lista de Espera ──────────────────────────────────────────────────────────
export const waitlist = mysqlTable("waitlist", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  barberId: int("barberId"),
  serviceId: int("serviceId"),
  date: varchar("date", { length: 10 }).notNull(),
  notifiedAt: timestamp("notifiedAt"),
  status: mysqlEnum("status", ["waiting", "notified", "booked", "cancelled"]).default("waiting").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Configuração de Comissões por Barbeiro ───────────────────────────────────
export const commissionConfigs = mysqlTable("commission_configs", {
  id: int("id").autoincrement().primaryKey(),
  barberId: int("barberId").notNull().unique(),
  defaultRate: decimal("defaultRate", { precision: 5, scale: 2 }).notNull().default("50.00"), // % padrão
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Entradas de Comissão ─────────────────────────────────────────────────────
export const commissionEntries = mysqlTable("commission_entries", {
  id: int("id").autoincrement().primaryKey(),
  barberId: int("barberId").notNull(),
  appointmentId: int("appointmentId"),
  saleId: int("saleId"),
  grossValue: decimal("grossValue", { precision: 10, scale: 2 }).notNull(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).notNull(),
  commissionValue: decimal("commissionValue", { precision: 10, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["service", "product"]).notNull().default("service"),
  description: varchar("description", { length: 255 }),
  date: varchar("date", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Agendamentos Recorrentes ────────────────────────────────────────────────
export const recurringAppointments = mysqlTable("recurring_appointments", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  barberId: int("barberId").notNull(),
  serviceId: int("serviceId").notNull(),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  intervalWeeks: int("intervalWeeks").notNull().default(4),
  occurrences: int("occurrences").notNull().default(6),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: varchar("cancelReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Movimentações de Estoque ────────────────────────────────────────────────
// supplierId adicionado para rastrear o fornecedor de cada reposição
export const stockMovements = mysqlTable("stock_movements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  type: mysqlEnum("type", ["in", "out", "adjustment"]).notNull(),
  quantity: int("quantity").notNull(), // positivo = entrada, negativo = saída
  reason: varchar("reason", { length: 255 }),
  barberId: int("barberId"),
  saleId: int("saleId"),
  supplierId: int("supplierId"),
  date: varchar("date", { length: 10 }).notNull(),
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

// ─── WhatsApp Chat Messages ───────────────────────────────────────────────────
export const whatsappMessages = mysqlTable("whatsapp_messages", {
  id: int("id").primaryKey().autoincrement(),
  tenantId: int("tenantId").notNull(),
  clientId: int("clientId").notNull(),
  barberId: int("barberId").notNull(),
  direction: mysqlEnum("direction", ["outgoing", "incoming"]).notNull().default("outgoing"),
  message: text("message").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["sent", "delivered", "read"]).notNull().default("sent"),
});

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;

// ─── Orbit Leads — Clientes em Órbita ────────────────────────────────────────
export const orbitLeads = mysqlTable("orbit_leads", {
  id: int("id").primaryKey().autoincrement(),
  clientId: int("clientId").notNull(),
  tenantId: int("tenantId").notNull(),
  loginAt: timestamp("loginAt").defaultNow().notNull(),
  convertedAt: timestamp("convertedAt"),
  source: mysqlEnum("source", ["link", "geo"]).notNull().default("link"),
});

export type OrbitLead = typeof orbitLeads.$inferSelect;
export type InsertOrbitLead = typeof orbitLeads.$inferInsert;

// ─── Subscription Plans (Planos de Assinatura) ─────────────────────────────────────────────
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").primaryKey().autoincrement(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  recurrences: int("recurrences").notNull().default(4),
  maxServices: int("maxServices").notNull().default(1),
  maxProducts: int("maxProducts").notNull().default(0),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  suggestedPrice: decimal("suggestedPrice", { precision: 10, scale: 2 }),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// ─── Subscription Plan Services (Serviços disponíveis no plano) ──────────────────
export const subscriptionPlanServices = mysqlTable("subscription_plan_services", {
  id: int("id").primaryKey().autoincrement(),
  planId: int("planId").notNull(),
  serviceId: int("serviceId").notNull(),
  tenantId: int("tenantId").notNull(),
});
export type SubscriptionPlanService = typeof subscriptionPlanServices.$inferSelect;

// ─── Subscription Plan Products (Produtos disponíveis no plano) ──────────────────
export const subscriptionPlanProducts = mysqlTable("subscription_plan_products", {
  id: int("id").primaryKey().autoincrement(),
  planId: int("planId").notNull(),
  productId: int("productId").notNull(),
  tenantId: int("tenantId").notNull(),
});
export type SubscriptionPlanProduct = typeof subscriptionPlanProducts.$inferSelect;

// ─── Client Subscriptions (Assinaturas ativas de clientes) ───────────────────────
export const clientSubscriptions = mysqlTable("client_subscriptions", {
  id: int("id").primaryKey().autoincrement(),
  tenantId: int("tenantId").notNull(),
  planId: int("planId").notNull(),
  clientId: int("clientId").notNull(),
  barberId: int("barberId"),
  selectedServiceIds: text("selectedServiceIds"),
  selectedProductIds: text("selectedProductIds"),
  status: mysqlEnum("status", ["active", "cancelled", "expired"]).notNull().default("active"),
  paymentMethod: mysqlEnum("paymentMethod", ["credit_card", "pix", "cash", "debit_card"]).notNull().default("cash"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cycleStart: date("cycleStart").notNull(),
  cycleEnd: date("cycleEnd").notNull(),
  usedRecurrences: int("usedRecurrences").notNull().default(0),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),
  autoRenew: boolean("autoRenew").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ClientSubscription = typeof clientSubscriptions.$inferSelect;
export type InsertClientSubscription = typeof clientSubscriptions.$inferInsert;

// ─── Subscription Appointments (Agendamentos vinculados a uma assinatura) ────────
export const subscriptionAppointments = mysqlTable("subscription_appointments", {
  id: int("id").primaryKey().autoincrement(),
  subscriptionId: int("subscriptionId").notNull(),
  appointmentId: int("appointmentId").notNull(),
  tenantId: int("tenantId").notNull(),
  recurrenceIndex: int("recurrenceIndex").notNull().default(1),
});
export type SubscriptionAppointment = typeof subscriptionAppointments.$inferSelect;

// ─── Online Payments — Asaas ──────────────────────────────────────────────────
export const onlinePayments = mysqlTable("online_payments", {
  id: int("id").primaryKey().autoincrement(),
  tenantId: int("tenantId").notNull(),
  clientId: int("clientId").notNull(),
  /** Tipo de cobrança: produto avulso, agendamento ou assinatura */
  chargeType: mysqlEnum("chargeType", ["product", "appointment", "subscription"]).notNull(),
  /** ID do recurso relacionado (productId, appointmentId ou subscriptionId) */
  referenceId: int("referenceId"),
  /** ID da cobrança no Asaas */
  asaasPaymentId: varchar("asaasPaymentId", { length: 100 }),
  /** ID da assinatura recorrente no Asaas (apenas para chargeType=subscription) */
  asaasSubscriptionId: varchar("asaasSubscriptionId", { length: 100 }),
  /** ID do cliente no Asaas */
  asaasCustomerId: varchar("asaasCustomerId", { length: 100 }),
  billingType: mysqlEnum("billingType", ["BOLETO", "CREDIT_CARD", "PIX", "STORE"]).notNull().default("PIX"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "paid", "overdue", "refunded", "cancelled"]).notNull().default("pending"),
  /** URL da fatura ou boleto gerada pelo Asaas */
  invoiceUrl: text("invoiceUrl"),
  /** QR Code Pix em base64 */
  pixQrCode: text("pixQrCode"),
  /** Copia e cola Pix */
  pixCopyCola: text("pixCopyCola"),
  dueDate: date("dueDate"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type OnlinePayment = typeof onlinePayments.$inferSelect;
export type InsertOnlinePayment = typeof onlinePayments.$inferInsert;

// ─── Encomendas de Produtos ───────────────────────────────────────────────────
export const productOrders = mysqlTable("product_orders", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  clientId: int("clientId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").default(1).notNull(),
  note: text("note"),
  status: mysqlEnum("status", ["received", "confirmed", "preparing", "ready", "delivered", "cancelled"]).default("received").notNull(),
  estimatedDays: int("estimatedDays"),
  confirmedAt: timestamp("confirmedAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),
  deliveredAt: timestamp("deliveredAt"),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductOrder = typeof productOrders.$inferSelect;
export type InsertProductOrder = typeof productOrders.$inferInsert;

// ─── Fornecedores ───────────────────────────────────────────────────────────────────────────────────
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  contact: varchar("contact", { length: 120 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 120 }),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;
