import { and, count, desc, eq, gte, inArray, like, lte, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Re-export sql tagged template for use in other modules
export { sql as sqlRaw };
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
  tenants,
  whatsappMessages,
  orbitLeads,
  productOrders,
  suppliers,
  subscriptionPlans,
  subscriptionPlanServices,
  type Supplier,
  type InsertSupplier,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type Tenant,
  type InsertTenant,
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

// Reconexão automática em erros de conexão SSL/timeout
function resetPool() {
  if (_pool) {
    _pool.end().catch(() => {});
    _pool = null;
    _db = null;
  }
}

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;
let _pingInterval: ReturnType<typeof setInterval> | null = null;

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    min: 0,                          // não manter conexões ociosas abertas
    idleTimeoutMillis: 30000,        // liberar conexões ociosas após 30s
    connectionTimeoutMillis: 15000,  // timeout de conexão de 15s
    query_timeout: 30000,            // mata queries travadas após 30s
    statement_timeout: 30000,        // mata statements travados após 30s
    // keepAlive TCP: envia pacotes a cada 30s para manter o proxy do Railway ativo
    // O proxy Railway fecha conexões ociosas após ~5min; keepAlive de 30s previne isso
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });
  // Configurar keepAlive TCP no nível do socket para cada nova conexão
  pool.on('connect', (client: any) => {
    if (client.connection?.stream?.setKeepAlive) {
      client.connection.stream.setKeepAlive(true, 30000); // keepAlive a cada 30s
    }
  });
  pool.on('error', (err: Error) => {
    console.warn('[Database] Pool error, reconectando:', err.message);
    resetPool();
    // Reconectar após 2 segundos
    setTimeout(() => getDb().catch(() => {}), 2000);
  });
  return pool;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createPool();
      _db = drizzle(_pool);
      // Verificar conectividade do pool a cada 2 minutos para evitar conexões mortas
      if (_pingInterval) clearInterval(_pingInterval);
      _pingInterval = setInterval(async () => {
        if (!_pool) return;
        try {
          const client = await _pool.connect();
          await client.query('SELECT 1');
          client.release();
        } catch (pingErr: any) {
          console.warn('[Database] Ping falhou, reconectando:', pingErr?.message);
          resetPool();
          // Reconectar após 3 segundos
          setTimeout(() => getDb().catch(() => {}), 3000);
        }
      }, 90 * 1000); // 90 segundos — bem antes do timeout do proxy Railway (~5min)
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Executa uma query com retry automático em caso de erro de conexão SSL.
 * Tenta até 2 vezes antes de lançar o erro.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = (err?.message ?? "").toLowerCase();
      const isConnectionError = msg.includes("ssl") || msg.includes("connection") || msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("socket");
      if (isConnectionError && attempt < retries) {
        console.warn(`[Database] Erro de conexão (tentativa ${attempt + 1}/${retries}), reconectando...`);
        resetPool();
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        await getDb(); // reconectar
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Executa uma função com o banco de dados.
 * O isolamento multi-tenant é feito via WHERE tenantId nas queries (guard clauses).
 */
export async function runWithTenant<T>(
  tenantId: number | null | undefined,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>,
  retries = 2
): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (!_pool) await getDb();
    if (!_pool || !_db) throw new Error("Database not available");
    const client = await _pool.connect();
    try {
      const tenantDb = drizzle(client as any);
      await client.query('BEGIN');
      if (tenantId != null) {
        try { await client.query('SET LOCAL ROLE barber_app'); } catch { /* role pode não existir */ }
        await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
        await client.query(`SET LOCAL app.is_superadmin = 'false'`);
      } else {
        await client.query(`SET LOCAL app.tenant_id = ''`);
        await client.query(`SET LOCAL app.is_superadmin = 'true'`);
      }
      try {
        const result = await fn(tenantDb);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } catch (err: any) {
      lastErr = err;
      const msg = (err?.message ?? "").toLowerCase();
      const isConnErr = msg.includes("ssl") || msg.includes("connection") || msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("socket");
      if (isConnErr && attempt < retries) {
        console.warn(`[runWithTenant] Erro de conexão (tentativa ${attempt + 1}/${retries}), reconectando...`);
        resetPool();
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        await getDb();
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  throw lastErr;
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

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
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

export async function getBarberByGoogleId(googleId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbers).where(eq(barbers.googleId as any, googleId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBarberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbers).where(eq(barbers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllBarbers(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof barbers.$inferSelect[];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento de dados
  if (tenantId == null) return [] as typeof barbers.$inferSelect[];
  return db.select().from(barbers).where(and(eq(barbers.isActive, true), eq(barbers.tenantId, tenantId))).orderBy(barbers.name).catch(() => [] as typeof barbers.$inferSelect[]);
}
export async function getAllBarbersIncludingInactive(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof barbers.$inferSelect[];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento de dados
  if (tenantId == null) return [] as typeof barbers.$inferSelect[];
  return db.select().from(barbers).where(eq(barbers.tenantId, tenantId)).orderBy(barbers.name).catch(() => [] as typeof barbers.$inferSelect[]);
}
export async function reactivateBarber(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(barbers).set({ isActive: true }).where(eq(barbers.id, id));
}
export async function saveBarberPushToken(barberId: number, pushToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(barbers).set({ pushToken }).where(eq(barbers.id, barberId));
}
export async function getBarberPushToken(barberId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ pushToken: barbers.pushToken }).from(barbers).where(eq(barbers.id, barberId)).limit(1);
  return result[0]?.pushToken ?? null;
}
/**
 * Envia notificação push via Expo Push API (funciona com app fechado).
 * @param options.channelId - Canal Android (ex: "online-booking" para agendamentos online)
 * @param options.badge    - Número a exibir no badge do ícone do app
 */
export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options?: { channelId?: string; badge?: number }
): Promise<boolean> {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken")) return false;
  try {
    const payload: Record<string, unknown> = {
      to: expoPushToken,
      title,
      body,
      data: data ?? {},
      sound: "default",
      priority: "high",
    };
    if (options?.channelId) payload.channelId = options.channelId;
    if (options?.badge !== undefined) payload.badge = options.badge;
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (e) {
    console.warn("[Push] Erro ao enviar notificação:", e);
    return false;
  }
}
export async function createBarber(data: InsertBarber) {
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.insert(barbers).values(data).returning();
    return result[0].id;
  });
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
export async function getAllClients(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof clients.$inferSelect[];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento de dados
  if (tenantId == null) return [] as typeof clients.$inferSelect[];
  return db.select().from(clients).where(and(eq(clients.isActive, true), eq(clients.tenantId, tenantId))).orderBy(clients.name).catch(() => [] as typeof clients.$inferSelect[]);
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createClient(data: InsertClient) {
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.insert(clients).values(data).returning();
    return result[0].id;
  });
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
  const result = await db.insert(categories).values({ name, type }).returning();
  return result[0].id;
}

// ─── Serviços ─────────────────────────────────────────────────────────────────
export async function getAllServices(activeOnly = false, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof services.$inferSelect[];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento de dados
  if (tenantId == null) return [] as typeof services.$inferSelect[];
  try {
    const conditions: any[] = [eq(services.tenantId, tenantId)];
    if (activeOnly) conditions.push(eq(services.isActive, true));
    return await db.select().from(services).where(and(...conditions)).orderBy(services.name);
  } catch { return [] as typeof services.$inferSelect[]; }
}

export async function getAllServicesWithMedia(activeOnly = false, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as (typeof services.$inferSelect & { thumbnailUrl: string | null })[];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento de dados
  if (tenantId == null) return [] as (typeof services.$inferSelect & { thumbnailUrl: string | null })[];
  try {
    const conditions: any[] = [eq(services.tenantId, tenantId)];
    if (activeOnly) conditions.push(eq(services.isActive, true));
    const svcs = await db.select().from(services).where(and(...conditions)).orderBy(services.name);
    const ids = svcs.map((s) => s.id);
    if (ids.length === 0) return svcs.map((s) => ({ ...s, thumbnailUrl: null as string | null }));
    const media = await db.select().from(mediaFiles)
      .where(and(eq(mediaFiles.entityType, "service"), inArray(mediaFiles.entityId, ids), eq(mediaFiles.type, "image")))
      .orderBy(mediaFiles.order);
    return svcs.map((s) => ({
      ...s,
      thumbnailUrl: media.find((m) => m.entityId === s.id)?.url ?? null,
    }));
  } catch { return [] as (typeof services.$inferSelect & { thumbnailUrl: string | null })[]; }
}
export async function getServiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createService(data: InsertService) {
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.insert(services).values(data).returning();
    return result[0].id;
  });
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
export async function getAllProductsWithMedia(activeOnly = false, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as (typeof products.$inferSelect & { thumbnailUrl: string | null; avgRating: number | null; reviewCount: number })[];
  try {
    const conditions: any[] = [];
    if (activeOnly) conditions.push(eq(products.isActive, true));
    conditions.push(eq(products.tenantId, tenantId ?? -1));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const prods = where
      ? await db.select().from(products).where(where).orderBy(products.name)
      : await db.select().from(products).orderBy(products.name);
    const ids = prods.map((p) => p.id);
    if (ids.length === 0) return prods.map((p) => ({ ...p, thumbnailUrl: null as string | null, avgRating: null as number | null, reviewCount: 0 }));
    const media = await db.select().from(mediaFiles)
      .where(and(eq(mediaFiles.entityType, "product"), inArray(mediaFiles.entityId, ids), eq(mediaFiles.type, "image")))
      .orderBy(mediaFiles.order);
    const productReviews = await db.select().from(reviews)
      .where(and(inArray(reviews.productId, ids)));
    return prods.map((p) => {
      const pReviews = productReviews.filter((r) => r.productId === p.id);
      const avgRating = pReviews.length > 0
        ? Math.round((pReviews.reduce((sum, r) => sum + r.rating, 0) / pReviews.length) * 10) / 10
        : null;
      return {
        ...p,
        thumbnailUrl: media.find((m) => m.entityId === p.id)?.url ?? null,
        avgRating,
        reviewCount: pReviews.length,
      };
    });
  } catch { return [] as (typeof products.$inferSelect & { thumbnailUrl: string | null; avgRating: number | null; reviewCount: number })[]; }
}
export async function getAllProducts(activeOnly = false, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof products.$inferSelect[];
  try {
    const conditions: any[] = [];
    if (activeOnly) conditions.push(eq(products.isActive, true));
    conditions.push(eq(products.tenantId, tenantId ?? -1));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return where
      ? db.select().from(products).where(where).orderBy(products.name)
      : db.select().from(products).orderBy(products.name);
  } catch { return [] as typeof products.$inferSelect[]; }
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: InsertProduct) {
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.insert(products).values(data).returning();
    return result[0].id;
  });
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
  const result = await db.insert(mediaFiles).values({ ...data, order: data.order ?? 0 }).returning();
  return result[0].id;
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

export async function getShopOpenStatus(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return { isOpen: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };
  // Usa o fuso de Brasília (UTC-3)
  const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dayOfWeek = nowBrasilia.getUTCDay();
  const currentMinute = nowBrasilia.getUTCHours() * 60 + nowBrasilia.getUTCMinutes();
  const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  // Busca barbeiros do tenant para filtrar working_hours
  let barberIds: number[] = [];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return { isOpen: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };
  if (tenantId != null) {
    const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.tenantId, tenantId), eq(barbers.isActive, true)));
    barberIds = tenantBarbers.map(b => b.id);
    if (barberIds.length === 0) return { isOpen: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };
  }
  // Busca todos os horários de trabalho do dia atual dos barbeiros do tenant
  const whConditions: any[] = [eq(workingHours.dayOfWeek, dayOfWeek), eq(workingHours.isWorking, true)];
  if (barberIds.length > 0) whConditions.push(inArray(workingHours.barberId, barberIds));
  const allHours = await db
    .select({ startTime: workingHours.startTime, endTime: workingHours.endTime, lunchStart: workingHours.lunchStart, lunchEnd: workingHours.lunchEnd })
    .from(workingHours)
    .where(and(...whConditions));
  if (!allHours.length) return { isOpen: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };
  // Horário mais cedo de abertura e mais tarde de fechamento
  const earliestStart = allHours.reduce((min, h) => toMinutes(h.startTime) < toMinutes(min) ? h.startTime : min, allHours[0].startTime);
  const latestEnd = allHours.reduce((max, h) => toMinutes(h.endTime) > toMinutes(max) ? h.endTime : max, allHours[0].endTime);
  const lunchStart = allHours[0].lunchStart ?? null;
  const lunchEnd = allHours[0].lunchEnd ?? null;
  const startMin = toMinutes(earliestStart);
  const endMin = toMinutes(latestEnd);
  const lunchStartMin = lunchStart ? toMinutes(lunchStart) : null;
  const lunchEndMin = lunchEnd ? toMinutes(lunchEnd) : null;
  const inLunch = lunchStartMin !== null && lunchEndMin !== null && currentMinute >= lunchStartMin && currentMinute < lunchEndMin;
  const isOpen = currentMinute >= startMin && currentMinute < endMin && !inLunch;
  // Formatar horas sem segundos (HH:MM)
  const fmt = (t: string | null) => t ? t.slice(0, 5) : null;
  return { isOpen, isLunch: inLunch, opensAt: fmt(earliestStart), closesAt: fmt(latestEnd), lunchStart: fmt(lunchStart), lunchEnd: fmt(lunchEnd) };
}

export async function getWorkingHoursForDay(barberId: number, dayOfWeek: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(workingHours)
    .where(and(eq(workingHours.barberId, barberId), eq(workingHours.dayOfWeek, dayOfWeek), eq(workingHours.isWorking, true))).limit(1);
  return result[0] ?? null;
}

export async function upsertWorkingHours(barberId: number, dayOfWeek: number, data: { startTime: string; endTime: string; lunchStart?: string | null; lunchEnd?: string | null; isWorking: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(workingHours)
    .where(and(eq(workingHours.barberId, barberId), eq(workingHours.dayOfWeek, dayOfWeek))).limit(1);
  if (existing.length > 0) {
    await db.update(workingHours).set(data).where(and(eq(workingHours.barberId, barberId), eq(workingHours.dayOfWeek, dayOfWeek)));
  } else {
    await db.insert(workingHours).values({ barberId, dayOfWeek, ...data }).returning();
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
  const result = await db.insert(blockedSlots).values(data).returning();
  return result[0].id;
}

export async function deleteBlockedSlot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blockedSlots).where(eq(blockedSlots.id, id));
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────
// Campos comuns retornados nas queries de agendamento com JOIN
const appointmentFields = {
  id: appointments.id,
  clientId: appointments.clientId,
  barberId: appointments.barberId,
  serviceId: appointments.serviceId,
  date: appointments.date,
  startTime: appointments.startTime,
  endTime: appointments.endTime,
  status: appointments.status,
  notes: appointments.notes,
  cancelReason: appointments.cancelReason,
  reminderSent: appointments.reminderSent,
  whatsappConfirmationSent: appointments.whatsappConfirmationSent,
  createdAt: appointments.createdAt,
  serviceNames: appointments.serviceNames, // Nomes concatenados de múltiplos serviços
  serviceName: services.name,
  serviceDuration: services.durationMinutes,
  servicePrice: services.price,
  clientName: clients.name,
  clientPhone: clients.phone,
};

export async function getAppointmentsByDate(barberId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select(appointmentFields)
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(eq(appointments.barberId, barberId), eq(appointments.date, date),
      sql`${appointments.status} NOT IN ('cancelled', 'no_show')`))
    .orderBy(appointments.startTime);
}

export async function getAppointmentsByDateRange(barberId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select(appointmentFields)
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(eq(appointments.barberId, barberId),
      gte(appointments.date, startDate), lte(appointments.date, endDate),
      sql`${appointments.status} NOT IN ('cancelled', 'no_show')`))
    .orderBy(appointments.date, appointments.startTime);
}
export async function getAllAppointmentsByDateRange(barberId: number, startDate: string, endDate: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  // Se tenantId fornecido, verificar se o barbeiro pertence ao tenant
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return [];
  if (tenantId != null) {
    const barberRow = await db.select({ id: barbers.id }).from(barbers)
      .where(and(eq(barbers.id, barberId), eq(barbers.tenantId, tenantId)))
      .limit(1);
    if (barberRow.length === 0) return []; // barbeiro não pertence ao tenant
  }
  return db
    .select(appointmentFields)
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(eq(appointments.barberId, barberId),
      gte(appointments.date, startDate), lte(appointments.date, endDate)))
    .orderBy(appointments.date, appointments.startTime);
}

export async function getAllAppointmentsByDateRangeForTenant(startDate: string, endDate: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as string[];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return [] as string[];
  if (tenantId != null) {
    const rows = await db.select({ date: appointments.date })
      .from(appointments)
      .innerJoin(barbers, eq(appointments.barberId, barbers.id))
      .where(and(
        gte(appointments.date, startDate),
        lte(appointments.date, endDate),
        sql`${appointments.status} NOT IN ('cancelled', 'no_show')`,
        eq(barbers.tenantId, tenantId)
      ));
    return rows.map(r => r.date);
  }
  const rows = await db.select({ date: appointments.date })
    .from(appointments)
    .where(and(
      gte(appointments.date, startDate),
      lte(appointments.date, endDate),
      sql`${appointments.status} NOT IN ('cancelled', 'no_show')`
    ));
  return rows.map(r => r.date);
}

export async function getAllAppointmentsByDate(date: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return [];
  if (tenantId != null) {
    // Filtrar via join com barbeiros do tenant
    const rows = await db.select({
      ...appointmentFields,
      updatedAt: appointments.updatedAt,
    })
      .from(appointments)
      .innerJoin(barbers, eq(appointments.barberId, barbers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(and(
        eq(appointments.date, date),
        sql`${appointments.status} NOT IN ('cancelled', 'no_show')`,
        eq(barbers.tenantId, tenantId)
      ));
    return rows;
  }
  return db
    .select({ ...appointmentFields })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(eq(appointments.date, date), sql`${appointments.status} NOT IN ('cancelled', 'no_show')`));
}

export async function getClientAppointments(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      barberId: appointments.barberId,
      serviceId: appointments.serviceId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      cancelReason: appointments.cancelReason,
      createdAt: appointments.createdAt,
      serviceName: services.name,
      price: services.price,
      serviceDuration: services.durationMinutes,
      barberName: barbers.name,
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(barbers, eq(appointments.barberId, barbers.id))
    .where(eq(appointments.clientId, clientId))
    .orderBy(desc(appointments.date), desc(appointments.startTime));
}
export async function getNextClientAppointment(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  // Data atual no fuso de Brasília (UTC-3)
  const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayStr = nowBrasilia.toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      serviceId: appointments.serviceId,
      barberId: appointments.barberId,
      serviceName: services.name,
      servicePrice: services.price,
      barberName: barbers.name,
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(barbers, eq(appointments.barberId, barbers.id))
    .where(
      and(
        eq(appointments.clientId, clientId),
        gte(appointments.date, todayStr),
        sql`${appointments.status} IN ('scheduled', 'confirmed', 'in_progress')`
      )
    )
    .orderBy(appointments.date, appointments.startTime)
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(appointments).values(data).returning();
  return result[0].id;
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
export async function getSalesByDateRange(startDate: string, endDate: string, barberId?: number, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [
    gte(sales.createdAt, new Date(startDate)) as any,
    lte(sales.createdAt, new Date(endDate + "T23:59:59")) as any,
  ];
  if (barberId) conditions.push(eq(sales.barberId, barberId) as any);
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return [];
  if (tenantId != null) {
    // Filtrar via subquery: apenas vendas de barbeiros do tenant
    const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.tenantId, tenantId));
    const barberIds = tenantBarbers.map(b => b.id);
    if (barberIds.length === 0) return [];
    conditions.push(sql`${sales.barberId} IN (${sql.join(barberIds.map(id => sql`${id}`), sql`, `)})` as any);
  }
  const salesResult = await db.select().from(sales).where(and(...conditions)).orderBy(desc(sales.createdAt));
  if (salesResult.length === 0) return [];
  // Buscar os items de todas as vendas em uma única query
  const saleIds = salesResult.map(s => s.id);
  const itemsResult = await db.select().from(saleItems).where(inArray(saleItems.saleId, saleIds));
  const itemsBySaleId: Record<number, typeof itemsResult> = {};
  for (const item of itemsResult) {
    if (!itemsBySaleId[item.saleId]) itemsBySaleId[item.saleId] = [];
    itemsBySaleId[item.saleId].push(item);
  }
  return salesResult.map(s => ({ ...s, items: itemsBySaleId[s.id] ?? [] }));
}
export async function createSale(data: InsertSale, items: Array<{ itemType: "service" | "product"; itemId: number; itemName: string; quantity: number; unitPrice: string; total: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const saleResult = await db.insert(sales).values(data).returning();
  const saleId = saleResult[0].id;
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
export async function getExpensesByDateRange(startDate: string, endDate: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [gte(expenses.date, startDate), lte(expenses.date, endDate)];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return [];
  if (tenantId != null) {
    // Filtrar via subquery: apenas despesas de barbeiros do tenant
    const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.tenantId, tenantId));
    const barberIds = tenantBarbers.map(b => b.id);
    if (barberIds.length === 0) return [];
    conditions.push(sql`(${expenses.barberId} IS NULL OR ${expenses.barberId} IN (${sql.join(barberIds.map(id => sql`${id}`), sql`, `)}))`);
  }
  return db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.date));
}

export async function createExpense(data: InsertExpense) {
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.insert(expenses).values(data).returning();
    return result[0].id;
  });
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
export async function getAllCoupons(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof coupons.$inferSelect[];
  try {
    const conditions: any[] = [];
    conditions.push(eq(coupons.tenantId, tenantId ?? -1));
    return conditions.length > 0
      ? await db.select().from(coupons).where(and(...conditions)).orderBy(desc(coupons.createdAt))
      : await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  } catch { return [] as typeof coupons.$inferSelect[]; }
}

export async function getCouponByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase())).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCoupon(data: { code: string; description?: string; discountType: "percent" | "fixed"; discountValue: string; minOrderValue?: string; maxUses?: number; validFrom?: string; validUntil?: string; tenantId?: number | null }) {
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() }).returning();
    return result[0].id;
  });
}

export async function updateCoupon(id: number, data: Partial<typeof coupons.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(coupons).set(data).where(eq(coupons.id, id));
}

// ─── Fidelidade ───────────────────────────────────────────────────────────────
export async function getLoyaltyConfig(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = tenantId != null
      ? await db.select().from(loyaltyConfig).where(eq(loyaltyConfig.tenantId, tenantId)).limit(1)
      : await db.select().from(loyaltyConfig).limit(1);
    return result[0] ?? null;
  } catch { return null; }
}

export async function upsertLoyaltyConfig(data: { isActive: boolean; pointsPerService: number; pointsPerReal: string; pointsExpireMonths: number; tenantId?: number | null }) {
  return runWithTenant(data.tenantId, async (db) => {
    const existing = await getLoyaltyConfig(data.tenantId);
    if (existing) {
      await db.update(loyaltyConfig).set(data).where(eq(loyaltyConfig.id, existing.id));
    } else {
      await db.insert(loyaltyConfig).values(data).returning();
    }
  });
}

export async function getLoyaltyRewards(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof loyaltyRewards.$inferSelect[];
  try {
    const conditions: any[] = [eq(loyaltyRewards.isActive, true)];
    conditions.push(eq(loyaltyRewards.tenantId, tenantId ?? -1));
    return await db.select().from(loyaltyRewards).where(and(...conditions)).orderBy(loyaltyRewards.pointsRequired);
  } catch { return [] as typeof loyaltyRewards.$inferSelect[]; }
}

export async function createLoyaltyReward(data: { name: string; description?: string; pointsRequired: number; rewardType: "free_service" | "discount_percent" | "discount_fixed" | "free_product"; rewardValue?: string; tenantId?: number | null }) {
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.insert(loyaltyRewards).values(data).returning();
    return result[0].id;
  });
}

export async function updateLoyaltyReward(id: number, data: Partial<typeof loyaltyRewards.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(loyaltyRewards).set(data).where(eq(loyaltyRewards.id, id));
}

export async function addClientPoints(clientId: number, points: number, type: "earned" | "redeemed" | "expired" | "adjusted", description?: string, saleId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(clientPoints).values({ clientId, points, type, description, saleId }).returning();
  const delta = (type === "earned" || type === "adjusted") ? points : -Math.abs(points);
  await db.update(clients).set({ totalPoints: sql`totalPoints + ${delta}` }).where(eq(clients.id, clientId));
}

// ─── Configurações da Barbearia ───────────────────────────────────────────────
export async function getShopSettings(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = tenantId != null
      ? await db.select().from(shopSettings).where(eq(shopSettings.tenantId, tenantId)).limit(1)
      : await db.select().from(shopSettings).limit(1);
    return result[0] ?? null;
  } catch { return null; }
}
export async function upsertShopSettings(data: Partial<typeof shopSettings.$inferInsert>, tenantId?: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getShopSettings(tenantId);
  if (existing) {
    await db.update(shopSettings).set(data).where(eq(shopSettings.id, existing.id));
  } else {
    await db.insert(shopSettings).values({ shopName: "Barber Pro", ...data, ...(tenantId != null ? { tenantId } : {}) }).returning();
  }
}
// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboardStats(date: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return { appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 };
  // Obter IDs dos barbeiros do tenant para filtrar
  let barberIds: number[] | null = null;
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return { appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 };
  if (tenantId != null) {
    const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.tenantId, tenantId));
    barberIds = tenantBarbers.map(b => b.id);
    if (barberIds.length === 0) return { appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 };
  }
  const apptConditions: any[] = [eq(appointments.date, date), sql`${appointments.status} NOT IN ('cancelled', 'no_show')`];
  if (barberIds) apptConditions.push(sql`${appointments.barberId} IN (${sql.join(barberIds.map(id => sql`${id}`), sql`, `)})`);
  const todayAppointments = await db.select().from(appointments).where(and(...apptConditions));
  const salesConditions: any[] = [
    gte(sales.createdAt, new Date(date)) as any,
    lte(sales.createdAt, new Date(date + "T23:59:59")) as any,
    eq(sales.paymentStatus, "paid") as any,
  ];
  if (barberIds) salesConditions.push(sql`${sales.barberId} IN (${sql.join(barberIds.map(id => sql`${id}`), sql`, `)})`);
  const todaySales = await db.select().from(sales).where(and(...salesConditions));
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
  const result = await db.insert(clientAccounts).values({ ...data, isActive: true }).returning();
  return result[0].id;
}
export async function updateClientAccount(id: number, data: Partial<typeof clientAccounts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clientAccounts).set(data).where(eq(clientAccounts.id, id));
}
export async function saveClientPushToken(clientId: number, pushToken: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(clientAccounts).set({ pushToken }).where(eq(clientAccounts.clientId, clientId));
}
export async function getClientPushToken(clientId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ pushToken: clientAccounts.pushToken }).from(clientAccounts).where(eq(clientAccounts.clientId, clientId)).limit(1);
  return result.length > 0 ? (result[0].pushToken ?? null) : null;
}

// ─── Avaliações ───────────────────────────────────────────────────────────────
export async function getReviewsByService(serviceId: number, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(reviews.serviceId, serviceId)];
  conditions.push(eq(reviews.tenantId, tenantId ?? -1));
  return db.select().from(reviews).where(and(...conditions)).orderBy(desc(reviews.createdAt));
}
export async function getReviewsByProduct(productId: number, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(reviews.productId, productId)];
  conditions.push(eq(reviews.tenantId, tenantId ?? -1));
  const result = await db
    .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, clientId: reviews.clientId })
    .from(reviews)
    .where(and(...conditions))
    .orderBy(desc(reviews.createdAt));
  const clientIds = Array.from(new Set(result.map(r => r.clientId)));
  const clientList = clientIds.length > 0
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientMap = Object.fromEntries(clientList.map(c => [c.id, c.name]));
  return result.map(r => ({ ...r, clientName: clientMap[r.clientId] ?? "Cliente" }));
}
export async function getReviewsByClient(clientId: number, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(reviews.clientId, clientId)];
  conditions.push(eq(reviews.tenantId, tenantId ?? -1));
  return db.select().from(reviews).where(and(...conditions)).orderBy(desc(reviews.createdAt));
}
export async function getRecentReviews(limit = 5, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento de dados entre barbearias
  if (tenantId == null) return [];
  try {
    const result = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        clientId: reviews.clientId,
        serviceId: reviews.serviceId,
      })
      .from(reviews)
      .where(eq(reviews.tenantId, tenantId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
    const clientIds = Array.from(new Set(result.map(r => r.clientId)));
    const serviceIds = Array.from(new Set(result.map(r => r.serviceId).filter((id): id is number => id != null)));
    const [clientList, serviceList] = await Promise.all([
      clientIds.length > 0 ? db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds)) : [],
      serviceIds.length > 0 ? db.select({ id: services.id, name: services.name }).from(services).where(inArray(services.id, serviceIds)) : [],
    ]);
    const clientMap = Object.fromEntries(clientList.map(c => [c.id, c.name]));
    const serviceMap = Object.fromEntries(serviceList.map(s => [s.id, s.name]));
    return result.map(r => ({
      ...r,
      clientName: clientMap[r.clientId] ?? "Cliente",
      serviceName: r.serviceId != null ? (serviceMap[r.serviceId] ?? "Serviço") : "Produto",
    }));
  } catch { return [] as { id: number; rating: number; comment: string | null; createdAt: Date; clientId: number; serviceId: number | null; clientName: string; serviceName: string }[]; }
}

export async function createReview(data: { tenantId: number; clientId: number; serviceId?: number | null; appointmentId?: number | null; productId?: number | null; orderId?: number | null; rating: number; comment?: string }) {
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.insert(reviews).values(data).returning();
    return result[0].id;
  });
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
  // Calcular o minuto atual no fuso de Brasília (UTC-3) para filtrar horários passados
  // Só aplica o filtro se a data solicitada for o dia de hoje
  const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
  const todayBrasilia = nowBrasilia.toISOString().split("T")[0];
  const isToday = date === todayBrasilia;
  const currentMinute = isToday ? nowBrasilia.getUTCHours() * 60 + nowBrasilia.getUTCMinutes() : 0;
  // Adiciona margem de 5 minutos para não exibir horários que estão prestes a passar
  const minStartMinute = isToday ? currentMinute + 5 : 0;

  // Regra: último slot de início deve ser no máximo 30 min antes do fechamento
  // Ou seja, o início do slot não pode ultrapassar (endMin - 30)
  const lastAllowedStart = endMin - 30;

  const slots: { startTime: string; endTime: string }[] = [];
  let cursor = startMin;
  while (cursor <= lastAllowedStart) {
    const slotEnd = cursor + durationMinutes;
    const conflict = busyIntervals.some(({ s, e }) => cursor < e && slotEnd > s);
    // Ignorar slots que já passaram (apenas para hoje)
    if (!conflict && cursor >= minStartMinute) {
      slots.push({ startTime: fromMinutes(cursor), endTime: fromMinutes(slotEnd) });
    }
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
  await db.insert(passwordResetTokens).values({ email, token, expiresAt }).returning();
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

export async function getAllServicesWithMediaAndRatings(activeOnly = false, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (activeOnly) conditions.push(eq(services.isActive, true));
  conditions.push(eq(services.tenantId, tenantId ?? -1));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const svcs = where
    ? await db.select().from(services).where(where).orderBy(services.name)
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

export async function listReturnMessageConfigs(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof returnMessageConfigs.$inferSelect[];
  try {
    // Filter services by tenantId to get only this tenant's services
    const svcConditions: any[] = [];
    svcConditions.push(eq(services.tenantId, tenantId ?? -1));
    const tenantServices = svcConditions.length > 0
      ? await db.select({ id: services.id }).from(services).where(and(...svcConditions))
      : await db.select({ id: services.id }).from(services);
    const serviceIds = tenantServices.map((s) => s.id);
    if (serviceIds.length === 0) return [] as typeof returnMessageConfigs.$inferSelect[];
    return await db.select().from(returnMessageConfigs).where(inArray(returnMessageConfigs.serviceId, serviceIds)).orderBy(returnMessageConfigs.serviceId);
  } catch { return [] as typeof returnMessageConfigs.$inferSelect[]; }
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
    await db.insert(returnMessageConfigs).values(input).returning();
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

export async function listPromotions(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof promotions.$inferSelect[];
  try {
    const conditions: any[] = [];
    conditions.push(eq(promotions.tenantId, tenantId ?? -1));
    return conditions.length > 0
      ? await db.select().from(promotions).where(and(...conditions)).orderBy(desc(promotions.createdAt))
      : await db.select().from(promotions).orderBy(desc(promotions.createdAt));
  } catch { return [] as typeof promotions.$inferSelect[]; }
}

export async function getPromotionRecipientCount(
  targetAudience: "all" | "inactive_30" | "inactive_60" | "birthday_month" | "specific_client",
  specificClientId?: number,
  tenantId?: number | null
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  if (targetAudience === "all") {
    const conditions = tenantId != null ? and(eq(clients.isActive, true), eq(clients.tenantId, tenantId)) : eq(clients.isActive, true);
    const [row] = await db.select({ count: count() }).from(clients).where(conditions);
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
  if (targetAudience === "specific_client") {
    return specificClientId ? 1 : 0;
  }
  return 0;
}

export async function createPromotion(input: {
  title: string;
  message: string;
  targetAudience: "all" | "inactive_30" | "inactive_60" | "birthday_month" | "specific_client";
  specificClientId?: number | null;
  createdBy: number;
  recipientCount: number;
  tenantId?: number | null;
}) {
  return runWithTenant(input.tenantId, async (db) => {
    await db.insert(promotions).values({ ...input, sentAt: new Date() }).returning();
    return { success: true, recipientCount: input.recipientCount };
  });
}

// ─── Lista de Espera ──────────────────────────────────────────────────────────

export async function listWaitlistByDate(date: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const entries = await db.select().from(waitlist)
    .where(and(eq(waitlist.date, date), eq(waitlist.status, "waiting")))
    .orderBy(waitlist.createdAt);
  if (entries.length === 0) return [];
  const clientIds = Array.from(new Set(entries.map((e) => e.clientId)));
  // Filtrar apenas clientes do tenant
  const clientConditions: any[] = [inArray(clients.id, clientIds)];
  clientConditions.push(eq(clients.tenantId, tenantId ?? -1));
  const clientList = await db.select().from(clients).where(and(...clientConditions));
  // Retornar apenas entradas de clientes do tenant
  const validClientIds = new Set(clientList.map(c => c.id));
  return entries
    .filter(e => validClientIds.has(e.clientId))
    .map((e) => ({
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
  await db.insert(waitlist).values({ ...input, status: "waiting" }).returning();
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

export async function notifyWaitlistOnCancellation(date: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  // Filtrar waitlist por clientes do tenant
  let validClientIds: Set<number> | null = null;
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return null;
  if (tenantId != null) {
    const tenantClients = await db.select({ id: clients.id }).from(clients).where(eq(clients.tenantId, tenantId));
    validClientIds = new Set(tenantClients.map(c => c.id));
  }
  const allWaiting = await db.select().from(waitlist)
    .where(and(eq(waitlist.date, date), eq(waitlist.status, "waiting")))
    .orderBy(waitlist.createdAt);
  const filtered = validClientIds ? allWaiting.filter(w => validClientIds!.has(w.clientId)) : allWaiting;
  const first = filtered[0];
  if (!first) return null;
  // Original: update first entry
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

export async function listCommissionConfigs(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as (typeof barbers.$inferSelect & { commissionRate: number; hasConfig: boolean })[];
  try {
    const barberConditions: any[] = [eq(barbers.isActive, true)];
    barberConditions.push(eq(barbers.tenantId, tenantId ?? -1));
    const barberList = await db.select().from(barbers).where(and(...barberConditions));
    const barberIds = barberList.map((b) => b.id);
    const configs = barberIds.length > 0
      ? await db.select().from(commissionConfigs).where(inArray(commissionConfigs.barberId, barberIds))
      : [];
    return barberList.map((b) => ({
      ...b,
      commissionRate: parseFloat(configs.find((c) => c.barberId === b.id)?.defaultRate ?? "50"),
      hasConfig: configs.some((c) => c.barberId === b.id),
    }));
  } catch {
    return [] as (typeof barbers.$inferSelect & { commissionRate: number; hasConfig: boolean })[];
  }
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
    }).returning();
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
  tenantId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    gte(commissionEntries.date, input.startDate),
    lte(commissionEntries.date, input.endDate),
  ];
  if (input.barberId) conditions.push(eq(commissionEntries.barberId, input.barberId));
  // Buscar barbeiros do tenant para filtrar entradas
  const barberConditions: any[] = [];
  if (input.tenantId != null) barberConditions.push(eq(barbers.tenantId, input.tenantId));
  const barberList = barberConditions.length > 0
    ? await db.select().from(barbers).where(and(...barberConditions))
    : await db.select().from(barbers);
  const barberIds = new Set(barberList.map((b) => b.id));
  // Adicionar filtro de barbeiros do tenant nas condições
  if (input.tenantId != null && barberIds.size > 0) {
    conditions.push(inArray(commissionEntries.barberId, Array.from(barberIds)));
  } else if (input.tenantId != null) {
    return []; // Sem barbeiros no tenant, sem entradas
  }
  const entries = await db.select().from(commissionEntries)
    .where(and(...conditions))
    .orderBy(desc(commissionEntries.date));
  const filteredEntries = entries;
  return filteredEntries.map((e) => ({
    ...e,
    barberName: barberList.find((b) => b.id === e.barberId)?.name ?? "—",
    grossValue: parseFloat(e.grossValue),
    commissionRate: parseFloat(e.commissionRate),
    commissionValue: parseFloat(e.commissionValue),
  }));
}

export async function getCommissionSummary(startDate: string, endDate: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const barberConditions: any[] = [eq(barbers.isActive, true)];
  barberConditions.push(eq(barbers.tenantId, tenantId ?? -1));
  const barberList = await db.select().from(barbers).where(and(...barberConditions));
  const barberIds = barberList.map((b) => b.id);
  // Buscar entradas apenas dos barbeiros do tenant
  const entryConditions: any[] = [
    gte(commissionEntries.date, startDate),
    lte(commissionEntries.date, endDate),
  ];
  if (barberIds.length > 0) entryConditions.push(inArray(commissionEntries.barberId, barberIds));
  const entries = barberIds.length > 0
    ? await db.select().from(commissionEntries).where(and(...entryConditions))
    : [];
  const configs = barberIds.length > 0
    ? await db.select().from(commissionConfigs).where(inArray(commissionConfigs.barberId, barberIds))
    : [];
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
  }).returning();
  const recurringId = recResult[0].id;

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
    }).returning();
    createdIds.push(apptResult[0].id);
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

export async function getAllRecurringAppointments(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as (typeof recurringAppointments.$inferSelect & { clientName: string; barberName: string; serviceName: string })[];
  try {
    // Filter barbers by tenantId
    const bConditions: any[] = [];
    bConditions.push(eq(barbers.tenantId, tenantId ?? -1));
    const tenantBarbers = bConditions.length > 0
      ? await db.select({ id: barbers.id }).from(barbers).where(and(...bConditions))
      : await db.select({ id: barbers.id }).from(barbers);
    const barberIds = tenantBarbers.map((b) => b.id);
    if (barberIds.length === 0) return [] as (typeof recurringAppointments.$inferSelect & { clientName: string; barberName: string; serviceName: string })[];
    const [list, clientList, barberList, svcList] = await Promise.all([
      db.select().from(recurringAppointments).where(and(eq(recurringAppointments.isActive, true), inArray(recurringAppointments.barberId, barberIds))),
      db.select().from(clients),
      db.select().from(barbers),
      db.select().from(services),
    ]);
    return list.map((r) => ({
      ...r,
      clientName: clientList.find((c) => c.id === r.clientId)?.name ?? "—",
      barberName: barberList.find((b) => b.id === r.barberId)?.name ?? "—",
      serviceName: svcList.find((s) => s.id === r.serviceId)?.name ?? "—",
    }));
  } catch { return [] as (typeof recurringAppointments.$inferSelect & { clientName: string; barberName: string; serviceName: string })[]; }
}

// ─── Conversão de Promoções ───────────────────────────────────────────────────
export async function getPromotionConversionReport(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return [];
  const promoConditions = and(sql`${promotions.sentAt} IS NOT NULL`, eq(promotions.tenantId, tenantId));
  const promoList = await db.select().from(promotions).where(promoConditions).orderBy(desc(promotions.sentAt));
  // appointments não tem tenantId diretamente — filtra via barberId (join com barbers)
  const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.tenantId, tenantId));
  const barberIds = tenantBarbers.map((b: any) => b.id);
  const allAppointments: any[] = barberIds.length > 0
    ? await db.select().from(appointments).where(inArray(appointments.barberId, barberIds))
    : [];
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
export async function getStockProducts(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conditions: any[] = [eq(products.isActive, true)];
    conditions.push(eq(products.tenantId, tenantId ?? -1));
    const prods = await db.select().from(products).where(and(...conditions)).orderBy(products.name);
    return prods.map((p) => ({
      ...p,
      price: parseFloat(p.price as any),
      stockQuantity: p.stockQuantity ?? 0,
      minStockAlert: p.minStockAlert ?? 5,
      isLowStock: (p.stockQuantity ?? 0) <= (p.minStockAlert ?? 5),
    }));
  } catch { return [] as (typeof products.$inferSelect & { price: number; stockQuantity: number; minStockAlert: number; isLowStock: boolean })[]; }
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

  await db.insert(stockMovements).values(data).returning();

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

export async function getLowStockProducts(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = tenantId != null
    ? and(eq(products.isActive, true), eq(products.tenantId, tenantId))
    : eq(products.isActive, true);
  const prods = await db.select().from(products).where(conditions);
  return prods.filter((p) => (p.stockQuantity ?? 0) <= (p.minStockAlert ?? 5));
}

// ─── Tenants (Multi-tenant SaaS) ──────────────────────────────────────────────
export async function createTenant(data: InsertTenant): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tenants).values(data).returning();
  return result[0].id;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTenantById(id: number): Promise<Tenant | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllTenants(): Promise<Tenant[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tenants).orderBy(tenants.createdAt);
}

/**
 * Busca o tenant cujas shopSettings têm customDomain igual ao domínio informado.
 * Usado pelo middleware de domínio customizado.
 */
export async function getTenantByCustomDomain(domain: string): Promise<{ tenant: Tenant; slug: string } | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ tenant: tenants, slug: tenants.slug })
    .from(tenants)
    .innerJoin(shopSettings, eq(shopSettings.tenantId, tenants.id))
    .where(eq(shopSettings.customDomain, domain))
    .limit(1);
  return result.length > 0 ? { tenant: result[0].tenant, slug: result[0].slug } : undefined;
}

export async function updateTenant(id: number, data: Partial<InsertTenant>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tenants).set(data).where(eq(tenants.id, id));
}

export async function createShopSettingsForTenant(tenantId: number, data: {
  shopName: string;
  phone?: string;
  cnpj?: string;
  instagram?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressComplement?: string;
}): Promise<void> {
  await runWithTenant(tenantId, async (db) => {
    await db.insert(shopSettings).values({
      tenantId,
      shopName: data.shopName,
      phone: data.phone,
      cnpj: data.cnpj,
      instagram: data.instagram,
      cep: data.cep,
      address: data.address,
      addressNumber: data.addressNumber,
      addressComplement: data.addressComplement,
    });
  });
}

export async function getBarberByEmailAndTenant(email: string, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbers)
    .where(and(eq(barbers.email, email), eq(barbers.tenantId, tenantId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getShopSettingsByTenantId(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(shopSettings)
    .where(eq(shopSettings.tenantId, tenantId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateAppointmentStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set({ status } as any).where(eq(appointments.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set({ isActive: false }).where(eq(products.id, id));
}

// ─── Avaliação Pós-Atendimento ────────────────────────────────────────────────
export async function getAppointmentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getReviewByAppointmentId(appointmentId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(reviews).where(eq(reviews.appointmentId, appointmentId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Busca agendamentos concluídos nas últimas N horas que ainda não receberam e-mail de avaliação.
 * Usa o campo `reminderSent` como flag de "e-mail de avaliação enviado" para evitar adicionar
 * nova coluna ao schema (reutilização pragmática — o campo é true após o envio do e-mail de avaliação).
 * 
 * NOTA: Esta função busca agendamentos com status "completed" cuja data/hora de término
 * está entre (agora - maxHoursAgo) e (agora - minHoursAgo).
 */
export async function getCompletedAppointmentsForReview(minHoursAgo = 2, maxHoursAgo = 4) {
  const db = await getDb();
  if (!db) return [];
  // Calcular janela de tempo em UTC-3 (Brasília)
  const nowMs = Date.now() - 3 * 60 * 60 * 1000; // agora em UTC-3
  const minAgo = new Date(nowMs - minHoursAgo * 60 * 60 * 1000);
  const maxAgo = new Date(nowMs - maxHoursAgo * 60 * 60 * 1000);
  const minDate = minAgo.toISOString().slice(0, 10);
  const maxDate = maxAgo.toISOString().slice(0, 10);

  // Buscar agendamentos concluídos recentemente (sem e-mail de avaliação enviado)
  const result = await db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      barberId: appointments.barberId,
      serviceId: appointments.serviceId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.status, "completed"),
        eq(appointments.reminderSent, false), // reutilizado como flag de e-mail de avaliação
        gte(appointments.date, maxDate),
        lte(appointments.date, minDate)
      )
    );

  // Filtrar por hora exata (a query de data é aproximada)
  return result.filter((a) => {
    const apptDateTime = new Date(`${a.date}T${a.endTime}`);
    const apptMs = apptDateTime.getTime();
    return apptMs >= maxAgo.getTime() && apptMs <= minAgo.getTime();
  });
}

export async function markAppointmentReviewEmailSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set({ reminderSent: true }).where(eq(appointments.id, id));
}

// ─── WhatsApp Lembretes ────────────────────────────────────────────────────
/** Busca agendamentos futuros (até 26h) que ainda não receberam lembrete */
export async function getUpcomingAppointmentsForReminder() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db.select().from(appointments)
    .where(
      and(
        gte(appointments.date, todayStr),
        lte(appointments.date, tomorrowStr),
        inArray(appointments.status, ["scheduled", "confirmed"])
      )
    );
  return rows;
}

export async function markWhatsAppReminder24hSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set({ whatsappReminder24hSent: true }).where(eq(appointments.id, id));
}

export async function markWhatsAppReminder1hSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set({ whatsappReminder1hSent: true }).where(eq(appointments.id, id));
}

// ─── WhatsApp Chat ─────────────────────────────────────────────────────
export async function getChatClients(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  // Retorna todos os clientes do tenant com a última mensagem
  const allClients = await db.select().from(clients).where(eq(clients.tenantId, tenantId));
  const msgs = await db.select().from(whatsappMessages).where(eq(whatsappMessages.tenantId, tenantId));
  return allClients.map((c) => {
    const clientMsgs = msgs.filter((m) => m.clientId === c.id).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return { ...c, lastMessage: clientMsgs[0] ?? null, messageCount: clientMsgs.length };
  });
}

export async function getChatHistory(tenantId: number, clientId: number): Promise<WhatsappMessage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappMessages)
    .where(and(eq(whatsappMessages.tenantId, tenantId), eq(whatsappMessages.clientId, clientId)))
    .orderBy(whatsappMessages.sentAt);
}

export async function saveChatMessage(data: InsertWhatsappMessage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(whatsappMessages).values(data).returning();
  return result[0].id;
}

// ─── Marketplace ───────────────────────────────────────────────────────────────
export async function getMarketplaceTenants(search?: string) {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({
    id: tenants.id,
    slug: tenants.slug,
    name: tenants.name,
    city: tenants.city,
    state: tenants.state,
    address: tenants.address,
    phone: tenants.phone,
    logoUrl: tenants.logoUrl,
    fotoCapa: tenants.fotoCapa,
    descricao: tenants.descricao,
    latitude: tenants.latitude,
    longitude: tenants.longitude,
  }).from(tenants).where(and(eq(tenants.visivelMarketplace, true), inArray(tenants.status, ["active", "trial"]))).orderBy(tenants.name);
  if (search) {
    const q = search.toLowerCase();
    return results.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.city ?? "").toLowerCase().includes(q) ||
      (t.state ?? "").toLowerCase().includes(q) ||
      (t.descricao ?? "").toLowerCase().includes(q)
    );
  }
  return results;
}

export async function updateTenantMarketplace(tenantId: number, data: {
  visivelMarketplace?: boolean;
  descricao?: string | null;
  fotoCapa?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(tenants).set(data).where(eq(tenants.id, tenantId));
}

// Busca itens de venda (servicos/produtos) agrupados por nome para DRE detalhado
export async function getSaleItemsByDateRange(startDate: string, endDate: string, tenantId?: number | null): Promise<Array<{ itemName: string; itemType: string; quantity: number; total: number }>> {
  const db = await getDb();
  if (!db) return [];
  const salesInPeriod = await getSalesByDateRange(startDate, endDate, undefined, tenantId);
  if (salesInPeriod.length === 0) return [];
  const saleIds = salesInPeriod.map((s: any) => s.id);
  const items = await db
    .select()
    .from(saleItems)
    .where(sql`${saleItems.saleId} IN (${sql.join(saleIds.map((id: number) => sql`${id}`), sql`, `)})`);
  const grouped: Record<string, { itemName: string; itemType: string; quantity: number; total: number }> = {};
  items.forEach((item: any) => {
    const key = `${item.itemType}::${item.itemName}`;
    if (!grouped[key]) {
      grouped[key] = { itemName: item.itemName, itemType: item.itemType, quantity: 0, total: 0 };
    }
    grouped[key].quantity += item.quantity ?? 1;
    grouped[key].total += parseFloat(item.total ?? "0");
  });
  return Object.values(grouped).sort((a, b) => b.total - a.total);
}

// Salvar consentimento LGPD do cliente (compartilhamento de contato com barbearia)
export async function saveClientConsent(data: {
  clientId: number;
  tenantId: number;
  consentType?: string;
  termsVersion?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`
      INSERT INTO client_consents (client_id, tenant_id, consent_type, terms_version, ip_address, user_agent)
      VALUES (${data.clientId}, ${data.tenantId}, ${data.consentType ?? "lgpd_contact_sharing"}, ${data.termsVersion ?? "1.0"}, ${data.ipAddress ?? null}, ${data.userAgent ?? null})
      ON DUPLICATE KEY UPDATE consented_at = CURRENT_TIMESTAMP, ip_address = VALUES(ip_address), user_agent = VALUES(user_agent)
    `);
  } catch (err) {
    // Ignorar erro silenciosamente — consentimento é best-effort
    console.error("[saveClientConsent] erro:", err);
  }
}

// ─── Orbit Leads — Clientes em Órbita ────────────────────────────────────────

/** Registra ou atualiza o lead quando o cliente faz login em uma barbearia. */
export async function upsertOrbitLead(clientId: number, tenantId: number, source: "link" | "geo"): Promise<void> {
  try {
    await runWithTenant(tenantId, async (db) => {
      // Verificar se já existe um lead não convertido para este par cliente/tenant
      const existing = await db
        .select({ id: orbitLeads.id })
        .from(orbitLeads)
        .where(and(eq(orbitLeads.clientId, clientId), eq(orbitLeads.tenantId, tenantId)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(orbitLeads).values({ clientId, tenantId, source, loginAt: new Date() }).returning();
      }
      // Se já existe, não atualiza (preserva o loginAt original)
    });
  } catch (err) {
    console.error("[orbitLead] upsertOrbitLead error:", err);
  }
}

/** Marca um lead como convertido (cliente agendou). */
export async function markOrbitLeadConverted(clientId: number, tenantId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .update(orbitLeads)
      .set({ convertedAt: new Date() })
      .where(and(eq(orbitLeads.clientId, clientId), eq(orbitLeads.tenantId, tenantId)));
  } catch (err) {
    console.error("[orbitLead] markOrbitLeadConverted error:", err);
  }
}

/** Lista leads de uma barbearia com filtro de período e status. */
export async function listOrbitLeads(
  tenantId: number,
  filter: "today" | "week" | "month" = "week",
  converted?: boolean
) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const from = new Date(now);
  if (filter === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (filter === "week") {
    from.setDate(now.getDate() - 7);
  } else {
    from.setDate(now.getDate() - 30);
  }
  const conditions = [eq(orbitLeads.tenantId, tenantId), gte(orbitLeads.loginAt, from)];
  if (converted === true) conditions.push(sql`${orbitLeads.convertedAt} IS NOT NULL`);
  if (converted === false) conditions.push(sql`${orbitLeads.convertedAt} IS NULL`);

  const rows = await db
    .select({
      id: orbitLeads.id,
      clientId: orbitLeads.clientId,
      loginAt: orbitLeads.loginAt,
      convertedAt: orbitLeads.convertedAt,
      source: orbitLeads.source,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientAvatarUrl: clients.photoUrl,
    })
    .from(orbitLeads)
    .leftJoin(clients, eq(clients.id, orbitLeads.clientId))
    .where(and(...conditions))
    .orderBy(desc(orbitLeads.loginAt));
  return rows;
}

/** Retorna estatísticas de órbita para uma barbearia. */
export async function getOrbitStats(tenantId: number) {
  const db = await getDb();
  if (!db) return { todayCount: 0, weekConverted: 0, conversionRate: 0, newLast24h: 0 };
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const last24h = new Date(now); last24h.setHours(now.getHours() - 24);

  const [todayRows, weekRows, newRows] = await Promise.all([
    db.select({ c: count() }).from(orbitLeads)
      .where(and(eq(orbitLeads.tenantId, tenantId), gte(orbitLeads.loginAt, todayStart))),
    db.select({ c: count(), converted: orbitLeads.convertedAt }).from(orbitLeads)
      .where(and(eq(orbitLeads.tenantId, tenantId), gte(orbitLeads.loginAt, weekAgo))),
    db.select({ c: count() }).from(orbitLeads)
      .where(and(eq(orbitLeads.tenantId, tenantId), gte(orbitLeads.loginAt, last24h))),
  ]);

  const todayCount = Number(todayRows[0]?.c ?? 0);
  const newLast24h = Number(newRows[0]?.c ?? 0);
  const weekTotal = weekRows.length;
  const weekConverted = weekRows.filter((r) => r.converted != null).length;
  const conversionRate = weekTotal > 0 ? Math.round((weekConverted / weekTotal) * 100) : 0;

  return { todayCount, weekConverted, conversionRate, newLast24h };
}

/** Retorna dados diários de leads e conversões para o gráfico (últimos N dias). */
export async function getOrbitDailyChart(tenantId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const from = new Date(); from.setDate(from.getDate() - days);
  const rows = await db
    .select({
      loginAt: orbitLeads.loginAt,
      convertedAt: orbitLeads.convertedAt,
    })
    .from(orbitLeads)
    .where(and(eq(orbitLeads.tenantId, tenantId), gte(orbitLeads.loginAt, from)));

  // Agrupa por dia
  const map: Record<string, { date: string; leads: number; conversions: number }> = {};
  for (const row of rows) {
    const d = row.loginAt.toISOString().slice(0, 10);
    if (!map[d]) map[d] = { date: d, leads: 0, conversions: 0 };
    map[d].leads++;
    if (row.convertedAt) map[d].conversions++;
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

/** Retorna barbearias próximas ordenadas por distância (Haversine). */
export async function getNearbyTenants(lat: number, lng: number, radiusKm = 50) {
  const db = await getDb();
  if (!db) return [];
  // Fórmula de Haversine via SQL
  const rows = await db.execute(sql`
    SELECT
      t.id, t.name, t.slug, t.address, t.city, t.state, t.latitude, t.longitude,
      ss.logoUrl, ss.shopName,
      (
        6371 * ACOS(
          COS(RADIANS(${lat})) * COS(RADIANS(t.latitude)) *
          COS(RADIANS(t.longitude) - RADIANS(${lng})) +
          SIN(RADIANS(${lat})) * SIN(RADIANS(t.latitude))
        )
      ) AS distanceKm
    FROM tenants t
    LEFT JOIN shop_settings ss ON ss.tenantId = t.id
    WHERE t.latitude IS NOT NULL AND t.longitude IS NOT NULL
      AND t.status IN ('active', 'trial')
    HAVING (6371 * ACOS(COS(RADIANS(${lat})) * COS(RADIANS(t.latitude)) * COS(RADIANS(t.longitude) - RADIANS(${lng})) + SIN(RADIANS(${lat})) * SIN(RADIANS(t.latitude)))) <= ${radiusKm}
    ORDER BY distanceKm ASC
    LIMIT 30
  `);
  return ((rows as any).rows).map((r: any) => ({
    id: Number(r.id),
    name: String(r.shopName || r.name),
    slug: String(r.slug),
    address: r.address ? String(r.address) : null,
    city: r.city ? String(r.city) : null,
    state: r.state ? String(r.state) : null,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    logoUrl: r.logoUrl ? String(r.logoUrl) : null,
    distanceKm: Math.round(Number(r.distanceKm) * 10) / 10,
  }));
}

// ─── Assinaturas — Cancelamento com motivo ──────────────────────────────────
export async function cancelRecurringWithReason(id: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recurringAppointments).set({
    isActive: false,
    cancelledAt: new Date(),
    cancelReason: reason ?? null,
  }).where(eq(recurringAppointments.id, id));
}

// ─── Assinaturas — Listar encerradas ────────────────────────────────────────
export async function getCancelledRecurringAppointments(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  let list;
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return [];
  if (tenantId != null) {
    const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.tenantId, tenantId));
    const barberIds = tenantBarbers.map((b) => b.id);
    if (barberIds.length === 0) return [];
    list = await db.select().from(recurringAppointments)
      .where(and(eq(recurringAppointments.isActive, false), inArray(recurringAppointments.barberId, barberIds)))
      .orderBy(desc(recurringAppointments.createdAt));
  } else {
    list = await db.select().from(recurringAppointments)
      .where(eq(recurringAppointments.isActive, false))
      .orderBy(desc(recurringAppointments.createdAt));
  }
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

// ─── Assinaturas — Estatísticas / Dashboard ─────────────────────────────────
export async function getSubscriptionStats(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return { totalActive: 0, totalCancelled: 0, cancelRate: 0, estimatedMRR: 0 };

  let allRec;
  // SEGURANÇA: sem tenantId, retorna vazio para evitar vazamento
  if (tenantId == null) return { totalActive: 0, totalCancelled: 0, cancelRate: 0, estimatedMRR: 0 };
  if (tenantId != null) {
    const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.tenantId, tenantId));
    const barberIds = tenantBarbers.map((b) => b.id);
    if (barberIds.length === 0) return { totalActive: 0, totalCancelled: 0, cancelRate: 0, estimatedMRR: 0 };
    allRec = await db.select().from(recurringAppointments).where(inArray(recurringAppointments.barberId, barberIds));
  } else {
    return { totalActive: 0, totalCancelled: 0, cancelRate: 0, estimatedMRR: 0 };
  }
  const active = allRec.filter((r) => r.isActive);
  const cancelled = allRec.filter((r) => !r.isActive);

  // Calcular MRR estimado: para cada assinatura ativa, buscar preço do serviço
  const svcList = await db.select().from(services);
  let totalMonthlyRevenue = 0;
  for (const rec of active) {
    const svc = svcList.find((s) => s.id === rec.serviceId);
    if (svc) {
      // Converter intervalo em semanas para frequência mensal
      const monthlyFreq = 4.33 / rec.intervalWeeks;
      totalMonthlyRevenue += Number(svc.price) * monthlyFreq;
    }
  }

  const total = allRec.length;
  const cancelRate = total > 0 ? (cancelled.length / total) * 100 : 0;

  return {
    totalActive: active.length,
    totalCancelled: cancelled.length,
    cancelRate: Math.round(cancelRate * 10) / 10,
    estimatedMRR: Math.round(totalMonthlyRevenue * 100) / 100,
  };
}

// ─── Assinaturas — Próximas ocorrências (para reminder job) ─────────────────
export async function getUpcomingSubscriptionReminders(daysAhead: number = 3) {
  const db = await getDb();
  if (!db) return [];

  const active = await db.select().from(recurringAppointments)
    .where(eq(recurringAppointments.isActive, true));

  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysAhead);
  const targetStr = targetDate.toISOString().split("T")[0];

  const reminders: Array<{
    recurringId: number;
    clientId: number;
    barberId: number;
    serviceId: number;
    nextDate: string;
    startTime: string;
  }> = [];

  for (const rec of active) {
    // Calcular todas as datas futuras e verificar se alguma cai no targetDate
    for (let i = 0; i < rec.occurrences; i++) {
      const date = new Date(rec.startDate + "T12:00:00");
      date.setDate(date.getDate() + i * rec.intervalWeeks * 7);
      const dateStr = date.toISOString().split("T")[0];
      if (dateStr === targetStr) {
        reminders.push({
          recurringId: rec.id,
          clientId: rec.clientId,
          barberId: rec.barberId,
          serviceId: rec.serviceId,
          nextDate: dateStr,
          startTime: rec.startTime,
        });
        break;
      }
    }
  }

  return reminders;
}

// ─── Encomendas de Produtos ───────────────────────────────────────────────────
export async function createProductOrder(data: {
  tenantId: number;
  clientId: number;
  productId: number;
  quantity: number;
  note?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(productOrders).values({
    tenantId: data.tenantId,
    clientId: data.clientId,
    productId: data.productId,
    quantity: data.quantity,
    note: data.note ?? null,
    status: "received",
  });
}

export async function getProductOrdersByTenant(tenantId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conds: any[] = [eq(productOrders.tenantId, tenantId)];
  if (status && status !== "all") conds.push(eq(productOrders.status, status as any));
  const rows = await db
    .select({
      id: productOrders.id,
      tenantId: productOrders.tenantId,
      clientId: productOrders.clientId,
      productId: productOrders.productId,
      quantity: productOrders.quantity,
      note: productOrders.note,
      status: productOrders.status,
      estimatedDays: productOrders.estimatedDays,
      confirmedAt: productOrders.confirmedAt,
      cancelledAt: productOrders.cancelledAt,
      cancelReason: productOrders.cancelReason,
      deliveredAt: productOrders.deliveredAt,
      createdAt: productOrders.createdAt,
      updatedAt: productOrders.updatedAt,
      clientName: clients.name,
      clientPhone: clients.phone,
      productName: products.name,
      totalPrice: sql<string>`(${products.price} * ${productOrders.quantity})::text`,
      productImageUrl: sql<string | null>`(SELECT url FROM media_files WHERE "entityType" = 'product' AND "entityId" = ${productOrders.productId} AND type = 'image' ORDER BY "order" ASC LIMIT 1)`,
    })
    .from(productOrders)
    .leftJoin(clients, eq(productOrders.clientId, clients.id))
    .leftJoin(products, eq(productOrders.productId, products.id))
    .where(and(...conds))
    .orderBy(desc(productOrders.createdAt));
  return rows;
}

export async function getProductOrdersByClient(clientId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: productOrders.id,
      tenantId: productOrders.tenantId,
      clientId: productOrders.clientId,
      productId: productOrders.productId,
      quantity: productOrders.quantity,
      note: productOrders.note,
      status: productOrders.status,
      estimatedDays: productOrders.estimatedDays,
      cancelledAt: productOrders.cancelledAt,
      cancelReason: productOrders.cancelReason,
      deliveredAt: productOrders.deliveredAt,
      createdAt: productOrders.createdAt,
      updatedAt: productOrders.updatedAt,
      productName: products.name,
      productPrice: products.price,
      totalPrice: sql<string>`(${products.price} * ${productOrders.quantity})::text`,
      productImageUrl: sql<string | null>`(SELECT url FROM media_files WHERE "entityType" = 'product' AND "entityId" = ${productOrders.productId} AND type = 'image' ORDER BY "order" ASC LIMIT 1)`,
    })
    .from(productOrders)
    .leftJoin(products, eq(productOrders.productId, products.id))
    .where(and(eq(productOrders.clientId, clientId), eq(productOrders.tenantId, tenantId)))
    .orderBy(desc(productOrders.createdAt));
}

export async function updateProductOrderStatus(
  id: number,
  status: "received" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled",
  extra?: { estimatedDays?: number; cancelReason?: string; paymentMethod?: string; barberId?: number }
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, any> = { status };
  if (status === "delivered") updateData.deliveredAt = new Date();
  if (status === "cancelled") updateData.cancelledAt = new Date();
  if (extra?.estimatedDays) updateData.estimatedDays = extra.estimatedDays;
  if (extra?.cancelReason) updateData.cancelReason = extra.cancelReason;
  if (extra?.paymentMethod) {
    updateData.paymentMethod = extra.paymentMethod;
    updateData.paidAt = new Date();
  }
  await db.update(productOrders).set(updateData).where(eq(productOrders.id, id));

  // Se marcando como entregue com pagamento, registrar no financeiro
  if (status === "delivered" && extra?.paymentMethod && extra?.barberId) {
    const order = await getProductOrderById(id);
    if (order) {
      const unitPrice = order.totalPrice
        ? (parseFloat(order.totalPrice) / order.quantity).toFixed(2)
        : "0.00";
      const total = order.totalPrice ? parseFloat(order.totalPrice).toFixed(2) : "0.00";
      const pmMap: Record<string, string> = {
        cash: "cash", credit_card: "credit_card", debit_card: "debit_card",
        pix: "pix", other: "other",
      };
      const pm = (pmMap[extra.paymentMethod] ?? "other") as "cash" | "credit_card" | "debit_card" | "pix" | "asaas" | "other";
      await createSale(
        {
          clientId: order.clientId ?? undefined,
          barberId: extra.barberId,
          subtotal: total,
          discount: "0",
          total,
          paymentMethod: pm,
          paymentStatus: "paid",
          notes: `Encomenda #${id}`,
        } as any,
        [
          {
            itemType: "product",
            itemId: order.productId,
            itemName: order.productName ?? "Produto",
            quantity: order.quantity,
            unitPrice,
            total,
          },
        ]
      );
    }
  }
}

export async function getProductOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({
      id: productOrders.id,
      tenantId: productOrders.tenantId,
      clientId: productOrders.clientId,
      productId: productOrders.productId,
      quantity: productOrders.quantity,
      note: productOrders.note,
      status: productOrders.status,
      estimatedDays: productOrders.estimatedDays,
      confirmedAt: productOrders.confirmedAt,
      cancelledAt: productOrders.cancelledAt,
      cancelReason: productOrders.cancelReason,
      deliveredAt: productOrders.deliveredAt,
      createdAt: productOrders.createdAt,
      updatedAt: productOrders.updatedAt,
      clientName: clients.name,
      clientPhone: clients.phone,
      productName: products.name,
      totalPrice: sql<string>`(${products.price} * ${productOrders.quantity})::text`,
      productImageUrl: sql<string | null>`(SELECT url FROM media_files WHERE "entityType" = 'product' AND "entityId" = ${productOrders.productId} AND type = 'image' ORDER BY "order" ASC LIMIT 1)`,
    })
    .from(productOrders)
    .leftJoin(clients, eq(productOrders.clientId, clients.id))
    .leftJoin(products, eq(productOrders.productId, products.id))
    .where(eq(productOrders.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// ─── Despesas por Fornecedor ─────────────────────────────────────────────────
export async function getExpensesBySupplier(tenantId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  // Buscar barbeiros do tenant para filtrar despesas
  const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.tenantId, tenantId));
  const barberIds = tenantBarbers.map(b => b.id);
  if (barberIds.length === 0) return [];
  // Buscar movimentações de estoque com supplierId no período (reposições)
  const moves = await db
    .select({
      supplierId: stockMovements.supplierId,
      productId: stockMovements.productId,
      quantity: stockMovements.quantity,
      date: stockMovements.date,
    })
    .from(stockMovements)
    .where(and(
      sql`${stockMovements.supplierId} IS NOT NULL`,
      eq(stockMovements.type, "in"),
      gte(stockMovements.date, startDate),
      lte(stockMovements.date, endDate)
    ));
  // Filtrar apenas movimentações de produtos do tenant
  const tenantProducts = await db.select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(eq(products.tenantId, tenantId));
  const tenantProductIds = new Set(tenantProducts.map(p => p.id));
  const filteredMoves = moves.filter(m => tenantProductIds.has(m.productId));
  // Buscar despesas do período filtradas por barbeiros do tenant
  const expList = await db.select().from(expenses)
    .where(and(
      gte(expenses.date, startDate),
      lte(expenses.date, endDate),
      sql`(${expenses.barberId} IS NULL OR ${expenses.barberId} IN (${sql.join(barberIds.map(id => sql`${id}`), sql`, `)}))`
    ));
  // Buscar fornecedores do tenant
  const supplierList = await db.select().from(suppliers).where(eq(suppliers.tenantId, tenantId));
  const supplierMap: Record<number, { id: number; name: string; totalExpenses: number; totalReplenishments: number; replenishmentCount: number }> = {};
  // Agrupar despesas por fornecedor (via categoria/descrição que mencione fornecedor)
  // Agrupar reposições de estoque por fornecedor
  for (const move of filteredMoves) {
    if (!move.supplierId) continue;
    const sup = supplierList.find(s => s.id === move.supplierId);
    if (!sup) continue;
    if (!supplierMap[sup.id]) supplierMap[sup.id] = { id: sup.id, name: sup.name, totalExpenses: 0, totalReplenishments: 0, replenishmentCount: 0 };
    const prod = tenantProducts.find(p => p.id === move.productId);
    const cost = prod ? parseFloat(prod.price) * move.quantity : 0;
    supplierMap[sup.id].totalReplenishments += cost;
    supplierMap[sup.id].replenishmentCount += 1;
  }
  // Adicionar fornecedores sem movimentações (com total 0)
  for (const sup of supplierList) {
    if (!supplierMap[sup.id]) supplierMap[sup.id] = { id: sup.id, name: sup.name, totalExpenses: 0, totalReplenishments: 0, replenishmentCount: 0 };
  }
  return Object.values(supplierMap).sort((a, b) => b.totalReplenishments - a.totalReplenishments);
}

// ─── Fornecedores ─────────────────────────────────────────────────────────────
export async function getSuppliersByTenant(tenantId: number): Promise<Supplier[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers)
    .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.isActive, true)))
    .orderBy(suppliers.name);
}

export async function getSupplierById(id: number): Promise<Supplier | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createSupplier(data: InsertSupplier): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data).returning();
  return result[0].id;
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ ...data, updatedAt: new Date() }).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ isActive: false, updatedAt: new Date() }).where(eq(suppliers.id, id));
}

export async function getProductsBySupplier(supplierId: number, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(products.supplierId, supplierId)];
  if (tenantId) conditions.push(eq(products.tenantId, tenantId));
  return db.select().from(products)
    .where(and(...conditions))
    .orderBy(products.name);
}

export async function getStockMovementsBySupplier(
  supplierId: number,
  tenantId: number,
  limit = 50
) {
  const db = await getDb();
  if (!db) return [];
  // Buscar movimentações de entrada (type='in') vinculadas a este fornecedor
  const moves = await db.select().from(stockMovements)
    .where(and(
      eq(stockMovements.supplierId, supplierId),
      eq(stockMovements.type, "in")
    ))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
  if (moves.length === 0) return [];
  // Enriquecer com nome do produto
  const productIds = [...new Set(moves.map((m) => m.productId))];
  const productList = await db.select({ id: products.id, name: products.name, tenantId: products.tenantId })
    .from(products)
    .where(and(
      inArray(products.id, productIds),
      eq(products.tenantId, tenantId)
    ));
  const barberList = await db.select({ id: barbers.id, name: barbers.name }).from(barbers);
  return moves
    .filter((m) => productList.some((p) => p.id === m.productId))
    .map((m) => ({
      ...m,
      productName: productList.find((p) => p.id === m.productId)?.name ?? "—",
      barberName: m.barberId ? barberList.find((b) => b.id === m.barberId)?.name ?? "—" : null,
    }));
}

// ─── Error Logs ───────────────────────────────────────────────────────────────
export async function insertErrorLog(data: {
  source?: string;
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  tenantId?: number;
  context?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return; // silently skip if no DB
  await db.execute(sql`
    INSERT INTO error_logs (source, message, stack, url, userAgent, tenantId, context)
    VALUES (
      ${data.source ?? "browser"},
      ${data.message},
      ${data.stack ?? null},
      ${data.url ?? null},
      ${data.userAgent ?? null},
      ${data.tenantId ?? null},
      ${data.context ?? null}
    )
  `);
}

export async function getErrorLogs(limit = 100): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT id, source, message, stack, url, userAgent, tenantId, context, createdAt
    FROM error_logs
    ORDER BY createdAt DESC
    LIMIT ${limit}
  `);
  return ((rows as any).rows);
}

export async function clearErrorLogs(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM error_logs WHERE "createdAt" < NOW() - INTERVAL '30 days'`);
}

// ─── Suporte Interno ──────────────────────────────────────────────────────────
export async function createSupportTicket(data: {
  tenantId: number;
  title: string;
  category: string;
  priority?: string;
  firstMessage: string;
  authorName?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return runWithTenant(data.tenantId, async (db) => {
    const result = await db.execute(sql`
      INSERT INTO support_tickets ("tenantId", title, category, priority, "aiHandled", "adminNotified", "createdAt", "updatedAt")
      VALUES (${data.tenantId}, ${data.title}, ${data.category}, ${data.priority || 'normal'}, FALSE, FALSE, NOW(), NOW())
      RETURNING id
    `);
    const ticketId = (result as any).rows[0].id as number;
    await db.execute(sql`
      INSERT INTO support_messages ("ticketId", "authorType", "authorName", content, "createdAt")
      VALUES (${ticketId}, 'client', ${data.authorName || null}, ${data.firstMessage}, NOW())
    `);
    return ticketId;
  });
}

export async function getSupportTicketsByTenant(tenantId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT t.id, t.title, t.category, t.status, t.priority, t."aiHandled", t."adminNotified",
           t."createdAt", t."updatedAt",
           (SELECT COUNT(*) FROM support_messages m WHERE m."ticketId" = t.id) AS "messageCount",
           (SELECT content FROM support_messages m WHERE m."ticketId" = t.id ORDER BY m."createdAt" DESC LIMIT 1) AS "lastMessage",
           (SELECT "createdAt" FROM support_messages m WHERE m."ticketId" = t.id ORDER BY m."createdAt" DESC LIMIT 1) AS "lastMessageAt"
    FROM support_tickets t
    WHERE t."tenantId" = ${tenantId}
    ORDER BY t."updatedAt" DESC
  `);
  return (result as any).rows;
}

export async function getSupportTicketById(id: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.execute(sql`
    SELECT t.*, ten.name AS "tenantName"
    FROM support_tickets t
    LEFT JOIN tenants ten ON ten.id = t."tenantId"
    WHERE t.id = ${id}
  `);
  return (result as any).rows[0] || null;
}

export async function getSupportMessages(ticketId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT * FROM support_messages WHERE "ticketId" = ${ticketId} ORDER BY "createdAt" ASC
  `);
  return (result as any).rows;
}

export async function addSupportMessage(data: {
  ticketId: number;
  authorType: 'client' | 'admin' | 'ai';
  authorName?: string;
  content: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.execute(sql`
    INSERT INTO support_messages ("ticketId", "authorType", "authorName", content, "createdAt")
    VALUES (${data.ticketId}, ${data.authorType}, ${data.authorName || null}, ${data.content}, NOW())
  `);
  await db.execute(sql`
    UPDATE support_tickets SET "updatedAt" = NOW() WHERE id = ${data.ticketId}
  `);
}

export async function updateTicketStatus(id: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE support_tickets SET status = ${status}, "updatedAt" = NOW() WHERE id = ${id}
  `);
}

export async function markTicketAdminNotified(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE support_tickets SET "adminNotified" = TRUE, "updatedAt" = NOW() WHERE id = ${id}
  `);
}

export async function markTicketAiHandled(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE support_tickets SET "aiHandled" = TRUE, "updatedAt" = NOW() WHERE id = ${id}
  `);
}

export async function getAllSupportTickets(filters?: {
  status?: string;
  priority?: string;
  tenantId?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;
  if (filters?.status) { conditions.push(`t.status = $${paramIdx++}`); params.push(filters.status); }
  if (filters?.priority) { conditions.push(`t.priority = $${paramIdx++}`); params.push(filters.priority); }
  if (filters?.tenantId) { conditions.push(`t."tenantId" = $${paramIdx++}`); params.push(filters.tenantId); }
  const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  // Construir query com sql template para suportar parâmetros dinamicamente
  let queryStr = `
    SELECT t.id, t."tenantId", t.title, t.category, t.status, t.priority,
           t."aiHandled", t."adminNotified", t."createdAt", t."updatedAt",
           ten.name AS "tenantName",
           (SELECT COUNT(*) FROM support_messages m WHERE m."ticketId" = t.id) AS "messageCount",
           (SELECT content FROM support_messages m WHERE m."ticketId" = t.id ORDER BY m."createdAt" DESC LIMIT 1) AS "lastMessage",
           (SELECT "createdAt" FROM support_messages m WHERE m."ticketId" = t.id ORDER BY m."createdAt" DESC LIMIT 1) AS "lastMessageAt"
    FROM support_tickets t
    LEFT JOIN tenants ten ON ten.id = t."tenantId"
    WHERE 1=1 ${where}
    ORDER BY t."updatedAt" DESC
  `;
  // Substituir $1, $2... pelos valores reais para compatibilidade
  params.forEach((p, i) => {
    queryStr = queryStr.replace(`$${i + 1}`, typeof p === 'string' ? `'${p.replace(/'/g, "''")}'` : String(p));
  });
  const result = await db.execute(sql.raw(queryStr));
  return (result as any).rows;
}

export async function countOpenSupportTickets(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM support_tickets WHERE status IN ('open', 'waiting_admin')
  `);
  return parseInt((result as any).rows[0]?.cnt || '0', 10);
}

// ─── Planos de Assinatura ─────────────────────────────────────────────────────
export async function getSubscriptionPlansByTenantId(tenantId: number) {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.tenantId, tenantId), eq(subscriptionPlans.isActive, true)))
      .orderBy(subscriptionPlans.price);
  });
}

export async function getSubscriptionPlanServices(planId: number) {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        serviceId: subscriptionPlanServices.serviceId,
        serviceName: services.name,
        servicePrice: services.price,
      })
      .from(subscriptionPlanServices)
      .leftJoin(services, eq(services.id, subscriptionPlanServices.serviceId))
      .where(eq(subscriptionPlanServices.planId, planId));
    return rows;
  });
}
