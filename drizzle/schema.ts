import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

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
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  photoUrl: text("photoUrl"),
  role: mysqlEnum("role", ["super_admin", "barber", "receptionist"]).default("barber").notNull(),
  specialties: text("specialties"),
  isActive: boolean("isActive").default(true).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Clientes da Barbearia ────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
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
  categoryId: int("categoryId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: int("stock").default(0).notNull(),
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
  date: varchar("date", { length: 10 }).notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  status: mysqlEnum("status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"])
    .default("scheduled")
    .notNull(),
  notes: text("notes"),
  reminderSent: boolean("reminderSent").default(false).notNull(),
  whatsappConfirmationSent: boolean("whatsappConfirmationSent").default(false).notNull(),
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
  isActive: boolean("isActive").default(false).notNull(),
  pointsPerService: int("pointsPerService").default(10).notNull(),
  pointsPerReal: decimal("pointsPerReal", { precision: 5, scale: 2 }).default("1").notNull(),
  pointsExpireMonths: int("pointsExpireMonths").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Recompensas de Fidelidade ────────────────────────────────────────────────
export const loyaltyRewards = mysqlTable("loyalty_rewards", {
  id: int("id").autoincrement().primaryKey(),
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
  shopName: varchar("shopName", { length: 255 }).default("Barber Pro").notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  logoUrl: text("logoUrl"),
  mercadoPagoAccessToken: text("mercadoPagoAccessToken"),
  mercadoPagoPublicKey: text("mercadoPagoPublicKey"),
  whatsappMessageTemplate: text("whatsappMessageTemplate"),
  reminderMessageTemplate: text("reminderMessageTemplate"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
