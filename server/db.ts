import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
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
  saleItems,
  sales,
  services,
  shopSettings,
  workingHours,
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
