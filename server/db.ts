import { and, count, desc, eq, gte, inArray, like, lte, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appointments,
  barbers,
  blockedSlots,
  categories,
  clientAccounts,
  clientPoints,
  clients,
  coupons,
  expenses,
  loyaltyConfig,
  loyaltyRewards,
  mediaFiles,
  products,
  reviews,
  passwordResetTokens,
  saleItems,
  sales,
  services,
  shopSettings,
  workingHours,
  returnMessageConfigs,
  promotions,
  waitlist,
  commissionConfigs,
  commissionEntries,
  recurringAppointments,
  stockMovements,
  type InsertAppointment,
  type InsertBarber,
  type InsertClient,
  type InsertExpense,
  type InsertProduct,
  type InsertSale,
  type InsertService,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Barbeiros ────────────────────────────────────────────────────────────────
export async function getBarberByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbers).where(eq(barbers.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBarberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbers).where(eq(barbers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllBarbers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(barbers).where(eq(barbers.isActive, true)).orderBy(barbers.name);
}

export async function createBarber(data: InsertBarber) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(barbers).values(data);
  return result[0].insertId;
}

export async function updateBarber(id: number, data: Partial<InsertBarber>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(barbers).set(data).where(eq(barbers.id, id));
}

export async function deleteBarber(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(barbers).set({ isActive: false }).where(eq(barbers.id, id));
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).where(eq(clients.isActive, true)).orderBy(clients.name);
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  return result[0].insertId;
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(eq(clients.id, id));
}

// ─── Categorias ───────────────────────────────────────────────────────────────
export async function getCategoriesByType(type: "service" | "product") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.type, type)).orderBy(categories.name);
}

export async function createCategory(name: string, type: "service" | "product") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categories).values({ name, type });
  return result[0].insertId;
}

// ─── Serviços ─────────────────────────────────────────────────────────────────
export async function getAllServices(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) return db.select().from(services).where(eq(services.isActive, true)).orderBy(services.name);
  return db.select().from(services).orderBy(services.name);
}

export async function getAllServicesWithMedia(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const svcs = activeOnly
    ? await db.select().from(services).where(eq(services.isActive, true)).orderBy(services.name)
    : await db.select().from(services).orderBy(services.name);
  const ids = svcs.map((s) => s.id);
  if (ids.length === 0) return svcs.map((s) => ({ ...s, thumbnailUrl: null as string | null }));
  const media = await db.select().from(mediaFiles)
    .where(and(eq(mediaFiles.entityType, "service"), inArray(mediaFiles.entityId, ids), eq(mediaFiles.type, "image")))
    .orderBy(mediaFiles.order);
  return svcs.map((s) => ({
    ...s,
    thumbnailUrl: media.find((m) => m.entityId === s.id)?.url ?? null,
  }));
}
export async function getServiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createService(data: InsertService) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(services).values(data);
  return result[0].insertId;
}

export async function updateService(id: number, data: Partial<InsertService>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services).set(data).where(eq(services.id, id));
}

export async function deleteService(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services).set({ isActive: false }).where(eq(services.id, id));
}

// ─── Produtos ─────────────────────────────────────────────────────────────────
export async function getAllProductsWithMedia(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const prods = activeOnly
    ? await db.select().from(products).where(eq(products.isActive, true)).orderBy(products.name)
    : await db.select().from(products).orderBy(products.name);
  const ids = prods.map((p) => p.id);
  if (ids.length === 0) return prods.map((p) => ({ ...p, thumbnailUrl: null as string | null }));
  const media = await db.select().from(mediaFiles)
    .where(and(eq(mediaFiles.entityType, "product"), inArray(mediaFiles.entityId, ids), eq(mediaFiles.type, "image")))
    .orderBy(mediaFiles.order);
  return prods.map((p) => ({
    ...p,
    thumbnailUrl: media.find((m) => m.entityId === p.id)?.url ?? null,
  }));
}
export async function getAllProducts(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) return db.select().from(products).where(eq(products.isActive, true)).orderBy(products.name);
  return db.select().from(products).orderBy(products.name);
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result[0].insertId;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

// ─── Arquivos de Mídia ────────────────────────────────────────────────────────
export async function getMediaByEntity(entityType: "service" | "product", entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaFiles)
    .where(and(eq(mediaFiles.entityType, entityType), eq(mediaFiles.entityId, entityId)))
    .orderBy(mediaFiles.order);
}

export async function addMediaFile(data: { entityType: "service" | "product"; entityId: number; url: string; type: "image" | "video"; order?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mediaFiles).values({ ...data, order: data.order ?? 0 });
  return result[0].insertId;
}

export async function deleteMediaFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
}

// ─── Horários de Trabalho ─────────────────────────────────────────────────────
export async function getWorkingHours(barberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workingHours).where(eq(workingHours.barberId, barberId)).orderBy(workingHours.dayOfWeek);
}

export async function upsertWorkingHours(barberId: number, dayOfWeek: number, data: { startTime: string; endTime: string; lunchStart?: string | null; lunchEnd?: string | null; isWorking: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(workingHours)
    .where(and(eq(workingHours.barberId, barberId), eq(workingHours.dayOfWeek, dayOfWeek))).limit(1);
  if (existing.length > 0) {
    await db.update(workingHours).set(data).where(and(eq(workingHours.barberId, barberId), eq(workingHours.dayOfWeek, dayOfWeek)));
  } else {
    await db.insert(workingHours).values({ barberId, dayOfWeek, ...data });
  }
}

// ─── Horários Bloqueados ──────────────────────────────────────────────────────
export async function getBlockedSlots(barberId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blockedSlots)
    .where(and(eq(blockedSlots.barberId, barberId), eq(blockedSlots.date, date)));
}

export async function createBlockedSlot(data: { barberId: number; date: string; startTime: string; endTime: string; reason?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(blockedSlots).values(data);
  return result[0].insertId;
}

export async function deleteBlockedSlot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blockedSlots).where(eq(blockedSlots.id, id));
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────
export async function getAppointmentsByDate(barberId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appointments)
    .where(and(eq(appointments.barberId, barberId), eq(appointments.date, date),
      sql`${appointments.status} NOT IN ('cancelled', 'no_show')`))
    .orderBy(appointments.startTime);
}

export async function getAppointmentsByDateRange(barberId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appointments)
    .where(and(eq(appointments.barberId, barberId),
      gte(appointments.date, startDate), lte(appointments.date, endDate),
      sql`${appointments.status} NOT IN ('cancelled', 'no_show')`))
    .orderBy(appointments.date, appointments.startTime);
}

export async function getAllAppointmentsByDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appointments)
    .where(and(eq(appointments.date, date), sql`${appointments.status} NOT IN ('cancelled', 'no_show')`));
}

export async function getClientAppointments(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appointments)
    .where(eq(appointments.clientId, clientId))
    .orderBy(desc(appointments.date), desc(appointments.startTime));
}

export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(appointments).values(data);
  return result[0].insertId;
}

export async function updateAppointment(id: number, data: Partial<InsertAppointment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set(data).where(eq(appointments.id, id));
}

export async function checkSlotAvailability(barberId: number, date: string, startTime: string, endTime: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return true;
  const conditions = [
    eq(appointments.barberId, barberId),
    eq(appointments.date, date),
    sql`${appointments.status} NOT IN ('cancelled', 'no_show')`,
    sql`(${appointments.startTime} < ${endTime} AND ${appointments.endTime} > ${startTime})`,
  ];
  if (excludeId) conditions.push(sql`${appointments.id} != ${excludeId}`);
  const conflicts = await db.select().from(appointments).where(and(...conditions));
  return conflicts.length === 0;
}

// ─── Vendas ───────────────────────────────────────────────────────────────────
export async function getSalesByDateRange(startDate: string, endDate: string, barberId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [
    gte(sales.createdAt, new Date(startDate)) as any,
    lte(sales.createdAt, new Date(endDate + "T23:59:59")) as any,
  ];
  if (barberId) conditions.push(eq(sales.barberId, barberId) as any);
  return db.select().from(sales).where(and(...conditions)).orderBy(desc(sales.createdAt));
}

export async function createSale(data: InsertSale, items: Array<{ itemType: "service" | "product"; itemId: number; itemName: string; quantity: number; unitPrice: string; total: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const saleResult = await db.insert(sales).values(data);
  const saleId = saleResult[0].insertId;
  if (items.length > 0) {
    await db.insert(saleItems).values(items.map(item => ({ ...item, saleId })));
  }
  return saleId;
}

export async function getSaleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [sale] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  if (!sale) return null;
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id));
  return { ...sale, items };
}

export async function getClientSales(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sales).where(eq(sales.clientId, clientId)).orderBy(desc(sales.createdAt));
}

// ─── Despesas ─────────────────────────────────────────────────────────────────
export async function getExpensesByDateRange(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenses)
    .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)))
    .orderBy(desc(expenses.date));
}

export async function createExpense(data: InsertExpense) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(expenses).values(data);
  return result[0].insertId;
}

export async function updateExpense(id: number, data: Partial<InsertExpense>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(expenses).set(data).where(eq(expenses.id, id));
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(expenses).where(eq(expenses.id, id));
}

// ─── Cupons ───────────────────────────────────────────────────────────────────
export async function getAllCoupons() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function getCouponByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase())).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCoupon(data: { code: string; description?: string; discountType: "percent" | "fixed"; discountValue: string; minOrderValue?: string; maxUses?: number; validFrom?: string; validUntil?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() });
  return result[0].insertId;
}

export async function updateCoupon(id: number, data: Partial<typeof coupons.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(coupons).set(data).where(eq(coupons.id, id));
}

// ─── Fidelidade ───────────────────────────────────────────────────────────────
export async function getLoyaltyConfig() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(loyaltyConfig).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertLoyaltyConfig(data: { isActive: boolean; pointsPerService: number; pointsPerReal: string; pointsExpireMonths: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getLoyaltyConfig();
  if (existing) {
    await db.update(loyaltyConfig).set(data).where(eq(loyaltyConfig.id, existing.id));
  } else {
    await db.insert(loyaltyConfig).values(data);
  }
}

export async function getLoyaltyRewards() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(loyaltyRewards).where(eq(loyaltyRewards.isActive, true)).orderBy(loyaltyRewards.pointsRequired);
}

export async function createLoyaltyReward(data: { name: string; description?: string; pointsRequired: number; rewardType: "free_service" | "discount_percent" | "discount_fixed" | "free_product"; rewardValue?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(loyaltyRewards).values(data);
  return result[0].insertId;
}

export async function updateLoyaltyReward(id: number, data: Partial<typeof loyaltyRewards.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(loyaltyRewards).set(data).where(eq(loyaltyRewards.id, id));
}

export async function addClientPoints(clientId: number, points: number, type: "earned" | "redeemed" | "expired" | "adjusted", description?: string, saleId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(clientPoints).values({ clientId, points, type, description, saleId });
  const delta = (type === "earned" || type === "adjusted") ? points : -Math.abs(points);
  await db.update(clients).set({ totalPoints: sql`totalPoints + ${delta}` }).where(eq(clients.id, clientId));
}

// ─── Configurações da Barbearia ───────────────────────────────────────────────
export async function getShopSettings() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(shopSettings).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertShopSettings(data: Partial<typeof shopSettings.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getShopSettings();
  if (existing) {
    await db.update(shopSettings).set(data).where(eq(shopSettings.id, existing.id));
  } else {
    await db.insert(shopSettings).values({ shopName: "Barber Pro", ...data });
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboardStats(date: string) {
  const db = await getDb();
  if (!db) return { appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 };
  const todayAppointments = await db.select().from(appointments)
    .where(and(eq(appointments.date, date), sql`${appointments.status} NOT IN ('cancelled', 'no_show')`) as any);
  const todaySales = await db.select().from(sales)
    .where(and(
      gte(sales.createdAt, new Date(date)) as any,
      lte(sales.createdAt, new Date(date + "T23:59:59")) as any,
      eq(sales.paymentStatus, "paid") as any
    ));
  const revenueToday = todaySales.reduce((sum, s) => sum + parseFloat(s.total), 0);
  const uniqueClients = new Set(todayAppointments.map((a: any) => a.clientId)).size;
  const pending = todayAppointments.filter((a: any) => a.status === "scheduled").length;
  return { appointmentsToday: todayAppointments.length, revenueToday, clientsToday: uniqueClients, pendingAppointments: pending };
}

// ─── Contas de Clientes (Área do Cliente) ─────────────────────────────────────
export async function getClientAccountByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(clientAccounts).where(eq(clientAccounts.email, email)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function getClientAccountByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(clientAccounts).where(eq(clientAccounts.clientId, clientId)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function createClientAccount(data: { clientId: number; email: string; passwordHash: string; googleId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clientAccounts).values({ ...data, isActive: true });
  return result[0].insertId;
}
export async function updateClientAccount(id: number, data: Partial<typeof clientAccounts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clientAccounts).set(data).where(eq(clientAccounts.id, id));
}

// ─── Avaliações ───────────────────────────────────────────────────────────────
export async function getReviewsByService(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.serviceId, serviceId)).orderBy(desc(reviews.createdAt));
}
export async function getReviewsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.clientId, clientId)).orderBy(desc(reviews.createdAt));
}
export async function createReview(data: { clientId: number; serviceId: number; appointmentId?: number; rating: number; comment?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviews).values(data);
  return result[0].insertId;
}
export async function getClientPointsHistory(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientPoints).where(eq(clientPoints.clientId, clientId)).orderBy(desc(clientPoints.createdAt));
}
export async function getAvailableSlots(barberId: number, date: string, durationMinutes: number): Promise<{ startTime: string; endTime: string }[]> {
  const db = await getDb();
  if (!db) return [];
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const wh = await db.select().from(workingHours)
    .where(and(eq(workingHours.barberId, barberId), eq(workingHours.dayOfWeek, dayOfWeek))).limit(1);
  if (!wh.length || !wh[0].isWorking) return [];
  const hours = wh[0];
  const existingAppts = await db.select().from(appointments)
    .where(and(eq(appointments.barberId, barberId), eq(appointments.date, date), sql`${appointments.status} NOT IN ('cancelled', 'no_show')` as any));
  const blocked = await db.select().from(blockedSlots)
    .where(and(eq(blockedSlots.barberId, barberId), eq(blockedSlots.date, date)));
  const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const startMin = toMinutes(hours.startTime);
  const endMin = toMinutes(hours.endTime);
  const lunchStart = hours.lunchStart ? toMinutes(hours.lunchStart) : null;
  const lunchEnd = hours.lunchEnd ? toMinutes(hours.lunchEnd) : null;
  const busyIntervals = [
    ...existingAppts.map((a: any) => ({ s: toMinutes(a.startTime), e: toMinutes(a.endTime) })),
    ...blocked.map((b: any) => ({ s: toMinutes(b.startTime), e: toMinutes(b.endTime) })),
    ...(lunchStart && lunchEnd ? [{ s: lunchStart, e: lunchEnd }] : []),
  ];
  const slots: { startTime: string; endTime: string }[] = [];
  let cursor = startMin;
  while (cursor + durationMinutes <= endMin) {
    const slotEnd = cursor + durationMinutes;
    const conflict = busyIntervals.some(({ s, e }) => cursor < e && slotEnd > s);
    if (!conflict) slots.push({ startTime: fromMinutes(cursor), endTime: fromMinutes(slotEnd) });
    cursor += 15;
  }
  return slots;
}

// ─── Recuperação de Senha ─────────────────────────────────────────────────────
export async function createPasswordResetToken(email: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const token = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
  // Invalida tokens anteriores
  await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.email, email));
  await db.insert(passwordResetTokens).values({ email, token, expiresAt });
  return token;
}

export async function validatePasswordResetToken(email: string, token: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(passwordResetTokens)
    .where(and(
      eq(passwordResetTokens.email, email),
      eq(passwordResetTokens.token, token),
      eq(passwordResetTokens.used, false),
      sql`${passwordResetTokens.expiresAt} > NOW()` as any
    )).limit(1);
  return result.length > 0;
}

export async function consumePasswordResetToken(email: string, token: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const valid = await validatePasswordResetToken(email, token);
  if (!valid) return false;
  await db.update(passwordResetTokens).set({ used: true })
    .where(and(eq(passwordResetTokens.email, email), eq(passwordResetTokens.token, token)));
  return true;
}

export async function getAllServicesWithMediaAndRatings(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const svcs = activeOnly
    ? await db.select().from(services).where(eq(services.isActive, true)).orderBy(services.name)
    : await db.select().from(services).orderBy(services.name);
  const ids = svcs.map((s) => s.id);
  if (ids.length === 0) return svcs.map((s) => ({ ...s, thumbnailUrl: null as string | null, avgRating: null as number | null, reviewCount: 0 }));
  const media = await db.select().from(mediaFiles)
    .where(and(eq(mediaFiles.entityType, "service"), inArray(mediaFiles.entityId, ids), eq(mediaFiles.type, "image")))
    .orderBy(mediaFiles.order);
  const allReviews = await db.select().from(reviews).where(inArray(reviews.serviceId, ids));
  return svcs.map((s) => {
    const svcReviews = allReviews.filter((r) => r.serviceId === s.id);
    const avgRating = svcReviews.length > 0
      ? Math.round((svcReviews.reduce((sum, r) => sum + r.rating, 0) / svcReviews.length) * 10) / 10
      : null;
    return {
      ...s,
      thumbnailUrl: media.find((m) => m.entityId === s.id)?.url ?? null,
      avgRating,
      reviewCount: svcReviews.length,
    };
  });
}

// ─── Mensagens de Retorno Automáticas ────────────────────────────────────────

export async function listReturnMessageConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(returnMessageConfigs).orderBy(returnMessageConfigs.serviceId);
}

export async function upsertReturnMessageConfig(input: {
  serviceId: number;
  delayDays: number;
  messageTemplate: string;
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(returnMessageConfigs)
    .where(eq(returnMessageConfigs.serviceId, input.serviceId))
    .limit(1);
  if (existing.length > 0) {
    await db.update(returnMessageConfigs)
      .set({ delayDays: input.delayDays, messageTemplate: input.messageTemplate, isActive: input.isActive })
      .where(eq(returnMessageConfigs.serviceId, input.serviceId));
  } else {
    await db.insert(returnMessageConfigs).values(input);
  }
  return { success: true };
}

export async function deleteReturnMessageConfig(serviceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(returnMessageConfigs).where(eq(returnMessageConfigs.serviceId, serviceId));
  return { success: true };
}

// ─── Promoções e Notícias ─────────────────────────────────────────────────────

export async function listPromotions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promotions).orderBy(desc(promotions.createdAt));
}

export async function getPromotionRecipientCount(
  targetAudience: "all" | "inactive_30" | "inactive_60" | "birthday_month"
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  if (targetAudience === "all") {
    const [row] = await db.select({ count: count() }).from(clients).where(eq(clients.isActive, true));
    return row?.count ?? 0;
  }
  if (targetAudience === "inactive_30" || targetAudience === "inactive_60") {
    const days = targetAudience === "inactive_30" ? 30 : 60;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const activeClientIds = await db
      .selectDistinct({ clientId: appointments.clientId })
      .from(appointments)
      .where(gte(appointments.date, cutoffStr));
    const activeIds = activeClientIds.map((r) => r.clientId);
    if (activeIds.length === 0) {
      const [row] = await db.select({ count: count() }).from(clients).where(eq(clients.isActive, true));
      return row?.count ?? 0;
    }
    const [row] = await db.select({ count: count() }).from(clients)
      .where(and(eq(clients.isActive, true), notInArray(clients.id, activeIds)));
    return row?.count ?? 0;
  }
  if (targetAudience === "birthday_month") {
    const monthStr = String(now.getMonth() + 1).padStart(2, "0");
    const [row] = await db.select({ count: count() }).from(clients)
      .where(and(eq(clients.isActive, true), like(clients.birthDate as any, `%-${monthStr}-%`)));
    return row?.count ?? 0;
  }
  return 0;
}

export async function createPromotion(input: {
  title: string;
  message: string;
  targetAudience: "all" | "inactive_30" | "inactive_60" | "birthday_month";
  createdBy: number;
  recipientCount: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(promotions).values({ ...input, sentAt: new Date() });
  return { success: true, recipientCount: input.recipientCount };
}

// ─── Lista de Espera ──────────────────────────────────────────────────────────

export async function listWaitlistByDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  const entries = await db.select().from(waitlist)
    .where(and(eq(waitlist.date, date), eq(waitlist.status, "waiting")))
    .orderBy(waitlist.createdAt);
  if (entries.length === 0) return [];
  const clientIds = [...new Set(entries.map((e) => e.clientId))];
  const clientList = await db.select().from(clients).where(inArray(clients.id, clientIds));
  return entries.map((e) => ({
    ...e,
    client: clientList.find((c) => c.id === e.clientId) ?? null,
  }));
}

export async function joinWaitlist(input: {
  clientId: number;
  date: string;
  barberId?: number;
  serviceId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(waitlist)
    .where(and(
      eq(waitlist.clientId, input.clientId),
      eq(waitlist.date, input.date),
      eq(waitlist.status, "waiting")
    ))
    .limit(1);
  if (existing.length > 0) return { success: true, alreadyInQueue: true };
  await db.insert(waitlist).values({ ...input, status: "waiting" });
  return { success: true, alreadyInQueue: false };
}

export async function leaveWaitlist(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(waitlist).set({ status: "cancelled" }).where(eq(waitlist.id, id));
  return { success: true };
}

export async function getWaitlistEntry(clientId: number, date: string) {
  const db = await getDb();
  if (!db) return null;
  const [entry] = await db.select().from(waitlist)
    .where(and(
      eq(waitlist.clientId, clientId),
      eq(waitlist.date, date),
      eq(waitlist.status, "waiting")
    ))
    .limit(1);
  return entry ?? null;
}

export async function notifyWaitlistOnCancellation(date: string) {
  const db = await getDb();
  if (!db) return null;
  const [first] = await db.select().from(waitlist)
    .where(and(eq(waitlist.date, date), eq(waitlist.status, "waiting")))
    .orderBy(waitlist.createdAt)
    .limit(1);
  if (!first) return null;
  await db.update(waitlist)
    .set({ status: "notified", notifiedAt: new Date() })
    .where(eq(waitlist.id, first.id));
  return first;
}

// ─── Comissões ────────────────────────────────────────────────────────────────

export async function getCommissionConfig(barberId: number) {
  const db = await getDb();
  if (!db) return null;
  const [config] = await db.select().from(commissionConfigs)
    .where(eq(commissionConfigs.barberId, barberId))
    .limit(1);
  return config ?? null;
}

export async function listCommissionConfigs() {
  const db = await getDb();
  if (!db) return [];
  const configs = await db.select().from(commissionConfigs);
  const barberList = await db.select().from(barbers).where(eq(barbers.isActive, true));
  return barberList.map((b) => ({
    ...b,
    commissionRate: parseFloat(configs.find((c) => c.barberId === b.id)?.defaultRate ?? "50"),
    hasConfig: configs.some((c) => c.barberId === b.id),
  }));
}

export async function upsertCommissionConfig(input: { barberId: number; defaultRate: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(commissionConfigs)
    .where(eq(commissionConfigs.barberId, input.barberId))
    .limit(1);
  if (existing.length > 0) {
    await db.update(commissionConfigs)
      .set({ defaultRate: String(input.defaultRate) })
      .where(eq(commissionConfigs.barberId, input.barberId));
  } else {
    await db.insert(commissionConfigs).values({
      barberId: input.barberId,
      defaultRate: String(input.defaultRate),
    });
  }
  return { success: true };
}

export async function createCommissionEntry(input: {
  barberId: number;
  appointmentId?: number;
  saleId?: number;
  grossValue: number;
  commissionRate: number;
  type: "service" | "product";
  description?: string;
  date: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const commissionValue = (input.grossValue * input.commissionRate) / 100;
  await db.insert(commissionEntries).values({
    ...input,
    grossValue: String(input.grossValue),
    commissionRate: String(input.commissionRate),
    commissionValue: String(commissionValue),
  });
  return { success: true };
}

export async function listCommissionEntries(input: {
  barberId?: number;
  startDate: string;
  endDate: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    gte(commissionEntries.date, input.startDate),
    lte(commissionEntries.date, input.endDate),
  ];
  if (input.barberId) conditions.push(eq(commissionEntries.barberId, input.barberId));
  const entries = await db.select().from(commissionEntries)
    .where(and(...conditions))
    .orderBy(desc(commissionEntries.date));
  const barberList = await db.select().from(barbers);
  return entries.map((e) => ({
    ...e,
    barberName: barberList.find((b) => b.id === e.barberId)?.name ?? "—",
    grossValue: parseFloat(e.grossValue),
    commissionRate: parseFloat(e.commissionRate),
    commissionValue: parseFloat(e.commissionValue),
  }));
}

export async function getCommissionSummary(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  const entries = await db.select().from(commissionEntries)
    .where(and(gte(commissionEntries.date, startDate), lte(commissionEntries.date, endDate)));
  const barberList = await db.select().from(barbers).where(eq(barbers.isActive, true));
  const configs = await db.select().from(commissionConfigs);
  return barberList.map((b) => {
    const barberEntries = entries.filter((e) => e.barberId === b.id);
    const totalGross = barberEntries.reduce((s, e) => s + parseFloat(e.grossValue), 0);
    const totalCommission = barberEntries.reduce((s, e) => s + parseFloat(e.commissionValue), 0);
    const rate = parseFloat(configs.find((c) => c.barberId === b.id)?.defaultRate ?? "50");
    return {
      barberId: b.id,
      barberName: b.name,
      commissionRate: rate,
      totalGross,
      totalCommission,
      totalNet: totalGross - totalCommission,
      entriesCount: barberEntries.length,
      entries: barberEntries.map((e) => ({
        ...e,
        grossValue: parseFloat(e.grossValue as any),
        commissionRate: parseFloat(e.commissionRate as any),
        commissionValue: parseFloat(e.commissionValue as any),
      })),
    };
  });
}

// ─── Agendamentos Recorrentes ─────────────────────────────────────────────────
export async function createRecurringAppointments(data: {
  clientId: number;
  barberId: number;
  serviceId: number;
  startDate: string;
  startTime: string;
  endTime: string;
  intervalWeeks: number;
  occurrences: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Salvar configuração recorrente
  const recResult = await db.insert(recurringAppointments).values({
    clientId: data.clientId,
    barberId: data.barberId,
    serviceId: data.serviceId,
    startDate: data.startDate,
    startTime: data.startTime,
    endTime: data.endTime,
    intervalWeeks: data.intervalWeeks,
    occurrences: data.occurrences,
    notes: data.notes,
    isActive: true,
  });
  const recurringId = recResult[0].insertId;

  // Gerar os N agendamentos futuros
  const createdIds: number[] = [];
  for (let i = 0; i < data.occurrences; i++) {
    const date = new Date(data.startDate + "T12:00:00");
    date.setDate(date.getDate() + i * data.intervalWeeks * 7);
    const dateStr = date.toISOString().split("T")[0];

    // Verificar disponibilidade
    const available = await checkSlotAvailability(data.barberId, dateStr, data.startTime, data.endTime);
    if (!available) continue;

    const apptResult = await db.insert(appointments).values({
      clientId: data.clientId,
      barberId: data.barberId,
      serviceId: data.serviceId,
      date: dateStr,
      startTime: data.startTime,
      endTime: data.endTime,
      status: "scheduled",
      notes: data.notes ? `[Recorrente] ${data.notes}` : "[Recorrente]",
    });
    createdIds.push(apptResult[0].insertId);
  }

  return { recurringId, createdCount: createdIds.length, appointmentIds: createdIds };
}

export async function getRecurringAppointments(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  const list = await db.select().from(recurringAppointments)
    .where(and(eq(recurringAppointments.clientId, clientId), eq(recurringAppointments.isActive, true)))
    .orderBy(desc(recurringAppointments.createdAt));
  const barberList = await db.select().from(barbers);
  const svcList = await db.select().from(services);
  return list.map((r) => ({
    ...r,
    barberName: barberList.find((b) => b.id === r.barberId)?.name ?? "—",
    serviceName: svcList.find((s) => s.id === r.serviceId)?.name ?? "—",
  }));
}

export async function cancelRecurring(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recurringAppointments).set({ isActive: false }).where(eq(recurringAppointments.id, id));
}

export async function getAllRecurringAppointments() {
  const db = await getDb();
  if (!db) return [];
  const list = await db.select().from(recurringAppointments).where(eq(recurringAppointments.isActive, true));
  const clientList = await db.select().from(clients);
  const barberList = await db.select().from(barbers);
  const svcList = await db.select().from(services);
  return list.map((r) => ({
    ...r,
    clientName: clientList.find((c) => c.id === r.clientId)?.name ?? "—",
    barberName: barberList.find((b) => b.id === r.barberId)?.name ?? "—",
    serviceName: svcList.find((s) => s.id === r.serviceId)?.name ?? "—",
  }));
}

// ─── Conversão de Promoções ───────────────────────────────────────────────────
export async function getPromotionConversionReport() {
  const db = await getDb();
  if (!db) return [];
  const promoList = await db.select().from(promotions).where(sql`${promotions.sentAt} IS NOT NULL`).orderBy(desc(promotions.sentAt));
  const allClients = await db.select().from(clients);
  const allAppointments = await db.select().from(appointments);

  return promoList.map((p) => {
    if (!p.sentAt) return { ...p, conversions: 0, conversionRate: 0 };
    const sentDate = new Date(p.sentAt);
    const windowEnd = new Date(sentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const windowEndStr = windowEnd.toISOString().split("T")[0];
    const sentDateStr = sentDate.toISOString().split("T")[0];

    // Contar agendamentos criados nos 7 dias após o envio
    const conversions = allAppointments.filter((a) => {
      return a.date >= sentDateStr && a.date <= windowEndStr;
    }).length;

    const rate = p.recipientCount > 0 ? Math.round((conversions / p.recipientCount) * 100) : 0;
    return { ...p, conversions, conversionRate: rate };
  });
}

// ─── Controle de Estoque ──────────────────────────────────────────────────────
export async function getStockProducts() {
  const db = await getDb();
  if (!db) return [];
  const prods = await db.select().from(products).where(eq(products.isActive, true)).orderBy(products.name);
  return prods.map((p) => ({
    ...p,
    price: parseFloat(p.price as any),
    stockQuantity: p.stockQuantity ?? 0,
    minStockAlert: p.minStockAlert ?? 5,
    isLowStock: (p.stockQuantity ?? 0) <= (p.minStockAlert ?? 5),
  }));
}

export async function addStockMovement(data: {
  productId: number;
  type: "in" | "out" | "adjustment";
  quantity: number;
  reason?: string;
  barberId?: number;
  saleId?: number;
  date: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(stockMovements).values(data);

  // Atualizar stockQuantity do produto
  const prod = await db.select().from(products).where(eq(products.id, data.productId)).limit(1);
  if (prod.length > 0) {
    const current = prod[0].stockQuantity ?? 0;
    const delta = data.type === "out" ? -Math.abs(data.quantity) : Math.abs(data.quantity);
    const newQty = Math.max(0, current + delta);
    await db.update(products).set({ stockQuantity: newQty }).where(eq(products.id, data.productId));
  }
}

export async function getStockMovements(productId: number) {
  const db = await getDb();
  if (!db) return [];
  const moves = await db.select().from(stockMovements)
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(50);
  const barberList = await db.select().from(barbers);
  return moves.map((m) => ({
    ...m,
    barberName: m.barberId ? barberList.find((b) => b.id === m.barberId)?.name ?? "—" : null,
  }));
}

export async function getStockConsumptionAverage(productId: number) {
  const db = await getDb();
  if (!db) return { avgMonthly: 0, daysUntilEmpty: null as number | null };

  // Buscar saídas dos últimos 3 meses
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const fromDate = threeMonthsAgo.toISOString().split("T")[0];

  const outMoves = await db.select().from(stockMovements)
    .where(and(
      eq(stockMovements.productId, productId),
      eq(stockMovements.type, "out"),
      gte(stockMovements.date, fromDate)
    ));

  const totalOut = outMoves.reduce((s, m) => s + Math.abs(m.quantity), 0);
  const avgMonthly = Math.round(totalOut / 3);

  const prod = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const currentStock = prod[0]?.stockQuantity ?? 0;

  const daysUntilEmpty = avgMonthly > 0
    ? Math.round((currentStock / avgMonthly) * 30)
    : null;

  return { avgMonthly, daysUntilEmpty };
}

export async function getLowStockProducts() {
  const db = await getDb();
  if (!db) return [];
  const prods = await db.select().from(products).where(eq(products.isActive, true));
  return prods.filter((p) => (p.stockQuantity ?? 0) <= (p.minStockAlert ?? 5));
}
