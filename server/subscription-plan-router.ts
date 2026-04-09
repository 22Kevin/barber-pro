/**
 * Router tRPC para Planos de Assinatura e Assinaturas de Clientes
 * Usa Drizzle ORM sql`` template literals para SQL raw com parâmetros seguros.
 *
 * Padrão Drizzle mysql2 para db.execute(sql`...`):
 *   SELECT → result[0] é o array de rows
 *   INSERT/UPDATE/DELETE → result[0] é ResultSetHeader { insertId, affectedRows, ... }
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getConn() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db;
}

/** SELECT: retorna array de rows */
async function selectSql(query: ReturnType<typeof sql>): Promise<any[]> {
  const db = await getConn();
  const result = await db.execute(query);
  // drizzle-orm/mysql2: execute retorna [RowDataPacket[], FieldPacket[]]
  // result[0] é o array de rows
  const rows = result[0] as unknown as any[];
  return rows ?? [];
}

/** SELECT com string raw (para queries com IDs dinâmicos) */
async function selectRaw(queryStr: string): Promise<any[]> {
  const db = await getConn();
  const result = await db.execute(queryStr as any);
  return (result[0] as unknown as any[]) ?? [];
}

/** INSERT/UPDATE/DELETE: retorna ResultSetHeader */
async function mutateSql(query: ReturnType<typeof sql>): Promise<{ insertId: number; affectedRows: number }> {
  const db = await getConn();
  const result = await db.execute(query);
  return result[0] as any;
}

/** INSERT/UPDATE/DELETE com string raw (para evitar problemas de serialização do Drizzle com JSON/arrays) */
async function mutateRaw(queryStr: string): Promise<{ insertId: number; affectedRows: number }> {
  const db = await getConn();
  const result = await db.execute(queryStr as any);
  return result[0] as any;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const subscriptionPlanRouter = router({
  // ── Planos (CRUD pelo barbeiro) ────────────────────────────────────────────

  listPlans: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const tenantId = input.tenantId;
      // Busca todos os planos do tenant
      const plans = await selectRaw(
        `SELECT sp.*, 
          (SELECT COUNT(*) FROM subscription_plan_services WHERE planId = sp.id) as serviceCount,
          (SELECT COUNT(*) FROM subscription_plan_products WHERE planId = sp.id) as productCount,
          (SELECT COUNT(*) FROM client_subscriptions WHERE planId = sp.id AND status = 'active') as activeSubscribers
        FROM subscription_plans sp
        WHERE sp.tenantId = ${tenantId}
        ORDER BY sp.createdAt DESC`
      );

      if (plans.length === 0) return [];

      // Busca todos os serviços dos planos em uma única query
      const planIds = plans.map((p: any) => parseInt(String(p.id), 10)).join(',');
      const allServices = await selectRaw(
        `SELECT sps.planId, sps.serviceId, s.name, s.price, s.durationMinutes as duration
        FROM subscription_plan_services sps
        JOIN services s ON s.id = sps.serviceId
        WHERE sps.planId IN (${planIds})`
      );

      // Busca todos os produtos dos planos em uma única query
      const allProducts = await selectRaw(
        `SELECT spp.planId, spp.productId, p.name, p.price
        FROM subscription_plan_products spp
        JOIN products p ON p.id = spp.productId
        WHERE spp.planId IN (${planIds})`
      );

      // Agrupa serviços e produtos por planId
      for (const plan of plans) {
        const pid = parseInt(String(plan.id), 10);
        plan.services = allServices.filter((s: any) => parseInt(String(s.planId), 10) === pid);
        plan.products = allProducts.filter((p: any) => parseInt(String(p.planId), 10) === pid);
      }

      return plans;
    }),

  getPlan: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const rows = await selectRaw(
        `SELECT * FROM subscription_plans WHERE id = ${input.id} AND tenantId = ${input.tenantId}`
      );
      const plan = rows[0];
      if (!plan) return null;

      const planIdNum2 = parseInt(String(plan.id), 10);
      plan.services = await selectRaw(
        `SELECT sps.serviceId, s.name, s.price, s.durationMinutes as duration FROM subscription_plan_services sps JOIN services s ON s.id = sps.serviceId WHERE sps.planId = ${planIdNum2}`
      );
      plan.products = await selectRaw(
        `SELECT spp.productId, p.name, p.price FROM subscription_plan_products spp JOIN products p ON p.id = spp.productId WHERE spp.planId = ${planIdNum2}`
      );
      return plan;
    }),

  createPlan: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      recurrences: z.number().min(1).max(31),
      maxServices: z.number().min(0),
      maxProducts: z.number().min(0),
      price: z.number().min(0),
      suggestedPrice: z.number().optional(),
      serviceIds: z.array(z.number()),
      productIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const header = await mutateSql(sql`
        INSERT INTO subscription_plans (tenantId, name, description, recurrences, maxServices, maxProducts, price, suggestedPrice)
        VALUES (
          ${input.tenantId}, ${input.name}, ${input.description ?? null},
          ${input.recurrences}, ${input.maxServices}, ${input.maxProducts},
          ${input.price}, ${input.suggestedPrice ?? null}
        )
      `);
      const planId = header.insertId;

      for (const serviceId of input.serviceIds) {
        await mutateSql(sql`
          INSERT INTO subscription_plan_services (planId, serviceId, tenantId)
          VALUES (${planId}, ${serviceId}, ${input.tenantId})
        `);
      }
      for (const productId of input.productIds) {
        await mutateSql(sql`
          INSERT INTO subscription_plan_products (planId, productId, tenantId)
          VALUES (${planId}, ${productId}, ${input.tenantId})
        `);
      }

      return { ok: true, id: planId };
    }),

  updatePlan: publicProcedure
    .input(z.object({
      id: z.number(),
      tenantId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      recurrences: z.number().min(1).max(31),
      maxServices: z.number().min(0),
      maxProducts: z.number().min(0),
      price: z.number().min(0),
      suggestedPrice: z.number().optional(),
      serviceIds: z.array(z.number()),
      productIds: z.array(z.number()),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const isActive = input.isActive !== false ? 1 : 0;

      await mutateSql(sql`
        UPDATE subscription_plans
        SET name=${input.name}, description=${input.description ?? null},
            recurrences=${input.recurrences}, maxServices=${input.maxServices},
            maxProducts=${input.maxProducts}, price=${input.price},
            suggestedPrice=${input.suggestedPrice ?? null}, isActive=${isActive},
            updatedAt=NOW()
        WHERE id=${input.id} AND tenantId=${input.tenantId}
      `);

      await mutateSql(sql`DELETE FROM subscription_plan_services WHERE planId=${input.id}`);
      await mutateSql(sql`DELETE FROM subscription_plan_products WHERE planId=${input.id}`);

      for (const serviceId of input.serviceIds) {
        await mutateSql(sql`
          INSERT INTO subscription_plan_services (planId, serviceId, tenantId)
          VALUES (${input.id}, ${serviceId}, ${input.tenantId})
        `);
      }
      for (const productId of input.productIds) {
        await mutateSql(sql`
          INSERT INTO subscription_plan_products (planId, productId, tenantId)
          VALUES (${input.id}, ${productId}, ${input.tenantId})
        `);
      }

      return { ok: true };
    }),

  deletePlan: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .mutation(async ({ input }) => {
      const rows = await selectSql(sql`
        SELECT COUNT(*) as cnt FROM client_subscriptions WHERE planId=${input.id} AND status='active'
      `);
      const cnt = Number(rows[0]?.cnt ?? 0);
      if (cnt > 0) {
        throw new Error("Não é possível excluir um plano com assinaturas ativas.");
      }

      await mutateSql(sql`DELETE FROM subscription_plan_services WHERE planId=${input.id}`);
      await mutateSql(sql`DELETE FROM subscription_plan_products WHERE planId=${input.id}`);
      await mutateSql(sql`DELETE FROM subscription_plans WHERE id=${input.id} AND tenantId=${input.tenantId}`);

      return { ok: true };
    }),

  togglePlanActive: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const val = input.isActive ? 1 : 0;
      await mutateSql(sql`
        UPDATE subscription_plans SET isActive=${val}, updatedAt=NOW()
        WHERE id=${input.id} AND tenantId=${input.tenantId}
      `);
      return { ok: true };
    }),

  // ── Assinaturas de Clientes ────────────────────────────────────────────────

  listSubscriptions: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      status: z.enum(["active", "cancelled", "expired", "all"]).default("active"),
      clientId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      // Construir query com condições opcionais
      const baseSelect = sql`
        SELECT cs.*,
          sp.name as planName, sp.recurrences as planRecurrences,
          c.name as clientName, c.phone as clientPhone,
          b.name as barberName
        FROM client_subscriptions cs
        JOIN subscription_plans sp ON sp.id = cs.planId
        JOIN clients c ON c.id = cs.clientId
        LEFT JOIN barbers b ON b.id = cs.barberId
        WHERE cs.tenantId = ${input.tenantId}
      `;

      let finalQuery: ReturnType<typeof sql>;
      if (input.status !== "all" && input.clientId) {
        finalQuery = sql`${baseSelect} AND cs.status = ${input.status} AND cs.clientId = ${input.clientId} ORDER BY cs.createdAt DESC`;
      } else if (input.status !== "all") {
        finalQuery = sql`${baseSelect} AND cs.status = ${input.status} ORDER BY cs.createdAt DESC`;
      } else if (input.clientId) {
        finalQuery = sql`${baseSelect} AND cs.clientId = ${input.clientId} ORDER BY cs.createdAt DESC`;
      } else {
        finalQuery = sql`${baseSelect} ORDER BY cs.createdAt DESC`;
      }

      return selectSql(finalQuery);
    }),

  getSubscription: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const rows = await selectSql(sql`
        SELECT cs.*,
          sp.name as planName, sp.recurrences as planRecurrences, sp.maxServices, sp.maxProducts,
          c.name as clientName, c.phone as clientPhone, c.email as clientEmail,
          b.name as barberName
        FROM client_subscriptions cs
        JOIN subscription_plans sp ON sp.id = cs.planId
        JOIN clients c ON c.id = cs.clientId
        LEFT JOIN barbers b ON b.id = cs.barberId
        WHERE cs.id = ${input.id} AND cs.tenantId = ${input.tenantId}
      `);
      const sub = rows[0];
      if (!sub) return null;

      sub.appointments = await selectSql(sql`
        SELECT sa.recurrenceIndex, a.date, a.time, a.status, a.id as appointmentId
        FROM subscription_appointments sa
        JOIN appointments a ON a.id = sa.appointmentId
        WHERE sa.subscriptionId = ${input.id}
        ORDER BY sa.recurrenceIndex
      `);

      return sub;
    }),

  createSubscription: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      planId: z.number(),
      clientId: z.number(),
      barberId: z.number().optional(),
      selectedServiceIds: z.array(z.number()),
      selectedProductIds: z.array(z.number()),
      paymentMethod: z.enum(["credit_card", "pix", "cash", "debit_card"]),
      price: z.number(),
      autoRenew: z.boolean().default(false),
      appointments: z.array(z.object({
        date: z.string(),
        time: z.string(),
        barberId: z.number().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const now = new Date();
      const cycleStart = now.toISOString().split("T")[0];
      const cycleEndDate = new Date(now);
      cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
      const cycleEnd = cycleEndDate.toISOString().split("T")[0];

      const selectedSvcJson = JSON.stringify(input.selectedServiceIds);
      const selectedProdJson = JSON.stringify(input.selectedProductIds);
      const autoRenewVal = input.autoRenew ? 1 : 0;
      const barberIdVal = input.barberId ?? null;

      const subHeader = await mutateSql(sql`
        INSERT INTO client_subscriptions
          (tenantId, planId, clientId, barberId, selectedServiceIds, selectedProductIds,
           status, paymentMethod, price, cycleStart, cycleEnd, autoRenew)
        VALUES (
          ${input.tenantId}, ${input.planId}, ${input.clientId}, ${barberIdVal},
          ${selectedSvcJson}, ${selectedProdJson},
          'active', ${input.paymentMethod}, ${input.price},
          ${cycleStart}, ${cycleEnd}, ${autoRenewVal}
        )
      `);
      const subscriptionId = subHeader.insertId;

      // Helper para calcular endTime (startTime + 30 min)
      function addMinutes30(t: string): string {
        const [h, m] = t.split(":").map(Number);
        const total = h * 60 + m + 30;
        return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}:00`;
      }

      const appointmentIds: number[] = [];
      // serviceId: usar o primeiro serviço selecionado, ou 0 se nenhum
      const primaryServiceId = input.selectedServiceIds[0] ?? 0;

      for (let i = 0; i < input.appointments.length; i++) {
        const appt = input.appointments[i];
        const apptBarberId = appt.barberId ?? input.barberId ?? null;
        const dateEsc = String(appt.date).replace(/'/g, "''");
        // Garantir formato HH:MM:SS para o campo TIME do MySQL
        const timeRaw = String(appt.time).replace(/'/g, "''");
        const startTimeEsc = timeRaw.includes(":") && timeRaw.split(":").length === 2
          ? timeRaw + ":00"
          : timeRaw;
        const endTimeEsc = addMinutes30(appt.time);
        const barberIdStr = apptBarberId !== null ? String(Number(apptBarberId)) : 'NULL';

        const apptHeader = await mutateRaw(
          `INSERT INTO appointments (clientId, barberId, serviceId, date, startTime, endTime, status) VALUES (${input.clientId}, ${barberIdStr}, ${primaryServiceId}, '${dateEsc}', '${startTimeEsc}', '${endTimeEsc}', 'confirmed')`
        );
        const appointmentId = apptHeader.insertId;
        appointmentIds.push(appointmentId);

        await mutateRaw(
          `INSERT INTO subscription_appointments (subscriptionId, appointmentId, tenantId, recurrenceIndex) VALUES (${subscriptionId}, ${appointmentId}, ${input.tenantId}, ${i + 1})`
        );
      }

      return { ok: true, id: subscriptionId, appointmentIds };
    }),

  cancelSubscription: publicProcedure
    .input(z.object({
      id: z.number(),
      tenantId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const reason = input.reason ?? null;
      await mutateSql(sql`
        UPDATE client_subscriptions
        SET status='cancelled', cancelledAt=NOW(), cancelReason=${reason}, updatedAt=NOW()
        WHERE id=${input.id} AND tenantId=${input.tenantId}
      `);
      return { ok: true };
    }),

  // ── Stats para o dashboard ─────────────────────────────────────────────────

  stats: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const activeRows = await selectSql(sql`
        SELECT COUNT(*) as cnt, COALESCE(SUM(price), 0) as mrr
        FROM client_subscriptions WHERE tenantId=${input.tenantId} AND status='active'
      `);
      const cancelledRows = await selectSql(sql`
        SELECT COUNT(*) as cnt FROM client_subscriptions WHERE tenantId=${input.tenantId} AND status='cancelled'
      `);
      const plansRows = await selectSql(sql`
        SELECT COUNT(*) as cnt FROM subscription_plans WHERE tenantId=${input.tenantId} AND isActive=1
      `);

      const active = activeRows[0] ?? {};
      const cancelled = cancelledRows[0] ?? {};
      const plans = plansRows[0] ?? {};

      const total = Number(active.cnt || 0) + Number(cancelled.cnt || 0);
      const churn = total > 0 ? Math.round((Number(cancelled.cnt) / total) * 100) : 0;

      return {
        activeSubs: Number(active.cnt || 0),
        mrr: parseFloat(active.mrr || "0"),
        cancelledSubs: Number(cancelled.cnt || 0),
        churnRate: churn,
        activePlans: Number(plans.cnt || 0),
      };
    }),

  // ── Planos públicos (para a página do cliente) ────────────────────────────

  listPublicPlans: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const plans = await selectSql(sql`
        SELECT id, name, description, recurrences, maxServices, maxProducts, price, suggestedPrice
        FROM subscription_plans WHERE tenantId=${input.tenantId} AND isActive=1 ORDER BY price ASC
      `);

      for (const plan of plans) {
        const pid = parseInt(String(plan.id), 10);
        plan.services = await selectRaw(
          `SELECT sps.serviceId, s.name, s.price, s.durationMinutes as duration FROM subscription_plan_services sps JOIN services s ON s.id = sps.serviceId WHERE sps.planId = ${pid}`
        );
        plan.products = await selectRaw(
          `SELECT spp.productId, p.name, p.price FROM subscription_plan_products spp JOIN products p ON p.id = spp.productId WHERE spp.planId = ${pid}`
        );
      }

      return plans;
    }),
});
