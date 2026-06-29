/**
 * Router tRPC para Planos de Assinatura e Assinaturas de Clientes
 *
 * IMPORTANTE — Nomes de colunas no PostgreSQL:
 *
 * subscription_plans → criada SEM aspas → colunas em minúsculas:
 *   "tenantId", "isActive", "maxServices", "maxProducts", "suggestedPrice", "createdAt", "updatedAt"
 *
 * subscription_plan_services / subscription_plan_products / client_subscriptions /
 * subscription_appointments → criadas COM aspas → colunas preservadas em camelCase:
 *   planId, serviceId, productId, tenantId, clientId, barberId, paymentMethod,
 *   cycleStart, cycleEnd, selectedServiceIds, selectedProductIds, usedRecurrences,
 *   cancelledAt, cancelReason, autoRenew, createdAt, updatedAt, subscriptionId,
 *   appointmentId, recurrenceIndex
 */
import { assertFeature } from "./plan-features";
import { sql } from "drizzle-orm";
import { assertFeature } from "./plan-features";
import { z } from "zod";
import { assertFeature } from "./plan-features";
import { publicProcedure, router } from "./_core/trpc";
import { assertFeature } from "./plan-features";
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
  return ((result as any).rows as any[]) ?? [];
}

/** SELECT com string raw */
async function selectRaw(queryStr: string): Promise<any[]> {
  const db = await getConn();
  const result = await db.execute(queryStr as any);
  return ((result as any).rows as any[]) ?? [];
}

/** INSERT/UPDATE/DELETE: retorna rowCount */
async function mutateSql(query: ReturnType<typeof sql>): Promise<{ affectedRows: number }> {
  const db = await getConn();
  const result = await db.execute(query);
  return { affectedRows: (result as any).rowCount ?? 0 };
}

/**
 * INSERT com RETURNING id — necessário no PostgreSQL.
 * Retorna o id gerado.
 */
async function insertReturningId(query: ReturnType<typeof sql>): Promise<number> {
  const rows = await selectSql(query);
  return Number(rows[0]?.id ?? 0);
}

/** INSERT raw com RETURNING id */
async function insertRawReturningId(queryStr: string): Promise<number> {
  const db = await getConn();
  const result = await db.execute(queryStr as any);
  const rows = ((result as any).rows as any[]) ?? [];
  return Number(rows[0]?.id ?? 0);
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const subscriptionPlanRouter = router({
  // ── Planos (CRUD pelo barbeiro) ────────────────────────────────────────────

  listPlans: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const tenantId = input.tenantId;
      // subscription_plans: colunas em minúsculas (criada sem aspas)
      // subscription_plan_services/products: colunas camelCase (criadas com aspas)
      // client_subscriptions: colunas camelCase (criada com aspas)
      const plans = await selectSql(sql`
        SELECT sp.*,
          (SELECT COUNT(*) FROM subscription_plan_services WHERE "planId" = sp.id) as "serviceCount",
          (SELECT COUNT(*) FROM subscription_plan_products WHERE "planId" = sp.id) as "productCount",
          (SELECT COUNT(*) FROM client_subscriptions WHERE "planId" = sp.id AND status = 'active') as "activeSubscribers"
        FROM subscription_plans sp
        WHERE sp."tenantId" = ${tenantId}
        ORDER BY sp."createdAt" DESC
      `);

      if (plans.length === 0) return [];

      // Normaliza nomes de coluna para camelCase
      const normalized = plans.map((p: any) => ({
        id: Number(p.id),
        tenantId: Number(p["tenantId"] ?? p["tenantid"] ?? 0),
        name: p.name,
        description: p.description ?? null,
        recurrences: Number(p.recurrences ?? 4),
        maxServices: Number(p["maxServices"] ?? 1),
        maxProducts: Number(p["maxProducts"] ?? 0),
        price: p.price,
        suggestedPrice: p["suggestedPrice"] ?? null,
        isActive: p["isActive"] === true || p["isActive"] === 1 || p["isActive"] === "1" || p["isActive"] === "true",
        createdAt: p["createdAt"],
        updatedAt: p["updatedAt"],
        serviceCount: Number(p.serviceCount ?? 0),
        productCount: Number(p.productCount ?? 0),
        activeSubscribers: Number(p.activeSubscribers ?? 0),
        services: [] as any[],
        products: [] as any[],
      }));

      const planIds = normalized.map((p) => p.id).join(',');

      // subscription_plan_services: colunas camelCase
      const allServices = planIds.length > 0 ? await selectSql(sql`
        SELECT sps."planId", sps."serviceId", s.name, s.price, s."durationMinutes" as duration
        FROM subscription_plan_services sps
        JOIN services s ON s.id = sps."serviceId"
        WHERE sps."planId" = ANY(ARRAY[${sql.raw(planIds)}]::int[])
      `) : [];

      // subscription_plan_products: colunas camelCase
      const allProducts = planIds.length > 0 ? await selectSql(sql`
        SELECT spp."planId", spp."productId", p.name, p.price
        FROM subscription_plan_products spp
        JOIN products p ON p.id = spp."productId"
        WHERE spp."planId" = ANY(ARRAY[${sql.raw(planIds)}]::int[])
      `) : [];

      for (const plan of normalized) {
        plan.services = allServices.filter((s: any) => Number(s.planId) === plan.id);
        plan.products = allProducts.filter((p: any) => Number(p.planId) === plan.id);
      }

      return normalized;
    }),

  getPlan: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const rows = await selectSql(sql`SELECT * FROM subscription_plans WHERE id = ${input.id} AND "tenantId" = ${input.tenantId}`);
      const p = rows[0];
      if (!p) return null;

      const pid = Number(p.id);
      const plan = {
        id: pid,
        tenantId: Number(p["tenantId"] ?? p["tenantid"] ?? 0),
        name: p.name,
        description: p.description ?? null,
        recurrences: Number(p.recurrences ?? 4),
        maxServices: Number(p["maxServices"] ?? 1),
        maxProducts: Number(p["maxProducts"] ?? 0),
        price: p.price,
        suggestedPrice: p["suggestedPrice"] ?? null,
        isActive: p["isActive"] === true || p["isActive"] === 1 || p["isActive"] === "1" || p["isActive"] === "true",
        createdAt: p["createdAt"],
        updatedAt: p["updatedAt"],
        services: [] as any[],
        products: [] as any[],
      };

      plan.services = await selectSql(sql`
        SELECT sps."serviceId", s.name, s.price, s."durationMinutes" as duration
        FROM subscription_plan_services sps
        JOIN services s ON s.id = sps."serviceId"
        WHERE sps."planId" = ${pid}
      `);
      plan.products = await selectSql(sql`
        SELECT spp."productId", p.name, p.price
        FROM subscription_plan_products spp
        JOIN products p ON p.id = spp."productId"
        WHERE spp."planId" = ${pid}
      `);
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
      const { getDb, getTenantById } = await import("./db");
      const tenantForGuard = await getTenantById(input.tenantId);
      assertFeature(tenantForGuard?.plan, "subscription_plans");
      // subscription_plans: colunas minúsculas, usar RETURNING id para PostgreSQL
      const planId = await insertReturningId(sql`
        INSERT INTO subscription_plans ("tenantId", name, description, recurrences, "maxServices", "maxProducts", price, "suggestedPrice")
        VALUES (
          ${input.tenantId}, ${input.name}, ${input.description ?? null},
          ${input.recurrences}, ${input.maxServices}, ${input.maxProducts},
          ${input.price}, ${input.suggestedPrice ?? null}
        )
        RETURNING id
      `);

      // subscription_plan_services: colunas camelCase
      for (const serviceId of input.serviceIds) {
        await mutateSql(sql`
          INSERT INTO subscription_plan_services ("planId", "serviceId", "tenantId")
          VALUES (${planId}, ${serviceId}, ${input.tenantId})
        `);
      }
      for (const productId of input.productIds) {
        await mutateSql(sql`
          INSERT INTO subscription_plan_products ("planId", "productId", "tenantId")
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
      const isActiveVal = input.isActive !== false;

      // subscription_plans: colunas minúsculas
      await mutateSql(sql`
        UPDATE subscription_plans
        SET name=${input.name}, description=${input.description ?? null},
            recurrences=${input.recurrences}, "maxServices"=${input.maxServices},
            "maxProducts"=${input.maxProducts}, price=${input.price},
            "suggestedPrice"=${input.suggestedPrice ?? null}, "isActive"=${isActiveVal},
            "updatedAt"=NOW()
        WHERE id=${input.id} AND "tenantId"=${input.tenantId}
      `);

      // subscription_plan_services/products: colunas camelCase
      await mutateSql(sql`DELETE FROM subscription_plan_services WHERE "planId"=${input.id}`);
      await mutateSql(sql`DELETE FROM subscription_plan_products WHERE "planId"=${input.id}`);

      for (const serviceId of input.serviceIds) {
        await mutateSql(sql`
          INSERT INTO subscription_plan_services ("planId", "serviceId", "tenantId")
          VALUES (${input.id}, ${serviceId}, ${input.tenantId})
        `);
      }
      for (const productId of input.productIds) {
        await mutateSql(sql`
          INSERT INTO subscription_plan_products ("planId", "productId", "tenantId")
          VALUES (${input.id}, ${productId}, ${input.tenantId})
        `);
      }

      return { ok: true };
    }),

  deletePlan: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .mutation(async ({ input }) => {
      // client_subscriptions: colunas camelCase
      const rows = await selectSql(sql`
        SELECT COUNT(*) as cnt FROM client_subscriptions WHERE "planId"=${input.id} AND status='active'
      `);
      const cnt = Number(rows[0]?.cnt ?? 0);
      if (cnt > 0) {
        throw new Error("Não é possível excluir um plano com assinaturas ativas.");
      }

      await mutateSql(sql`DELETE FROM subscription_plan_services WHERE "planId"=${input.id}`);
      await mutateSql(sql`DELETE FROM subscription_plan_products WHERE "planId"=${input.id}`);
      await mutateSql(sql`DELETE FROM subscription_plans WHERE id=${input.id} AND "tenantId"=${input.tenantId}`);

      return { ok: true };
    }),

  togglePlanActive: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      // subscription_plans: colunas minúsculas
      await mutateSql(sql`
        UPDATE subscription_plans SET "isActive"=${input.isActive}, "updatedAt"=NOW()
        WHERE id=${input.id} AND "tenantId"=${input.tenantId}
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
      const baseSelect = sql`
        SELECT cs.*,
          sp.name as "planName", sp.recurrences as "planRecurrences",
          c.name as "clientName", c.phone as "clientPhone",
          b.name as "barberName"
        FROM client_subscriptions cs
        JOIN subscription_plans sp ON sp.id = cs."planId"
        JOIN clients c ON c.id = cs."clientId"
        LEFT JOIN barbers b ON b.id = cs."barberId"
        WHERE cs."tenantId" = ${input.tenantId}
      `;

      let finalQuery: ReturnType<typeof sql>;
      if (input.status !== "all" && input.clientId) {
        finalQuery = sql`${baseSelect} AND cs.status = ${input.status} AND cs."clientId" = ${input.clientId} ORDER BY cs."createdAt" DESC`;
      } else if (input.status !== "all") {
        finalQuery = sql`${baseSelect} AND cs.status = ${input.status} ORDER BY cs."createdAt" DESC`;
      } else if (input.clientId) {
        finalQuery = sql`${baseSelect} AND cs."clientId" = ${input.clientId} ORDER BY cs."createdAt" DESC`;
      } else {
        finalQuery = sql`${baseSelect} ORDER BY cs."createdAt" DESC`;
      }

      const rows = await selectSql(finalQuery) as any[];

      // Enriquecer com nomes dos serviços e produtos selecionados
      for (const row of rows) {
        const svcIds: number[] = row.selectedServiceIds ? JSON.parse(row.selectedServiceIds) : [];
        const prdIds: number[] = row.selectedProductIds ? JSON.parse(row.selectedProductIds) : [];

        if (svcIds.length > 0) {
          const svcs = await selectSql(sql`SELECT id, name FROM services WHERE id = ANY(ARRAY[${sql.raw(svcIds.join(","))}]::int[])`) as { id: number; name: string }[];
          row.selectedServiceNames = svcs.map(s => s.name);
        } else {
          row.selectedServiceNames = [];
        }

        if (prdIds.length > 0) {
          const prds = await selectSql(sql`SELECT id, name FROM products WHERE id = ANY(ARRAY[${sql.raw(prdIds.join(","))}]::int[])`) as { id: number; name: string }[];
          row.selectedProductNames = prds.map(p => p.name);
        } else {
          row.selectedProductNames = [];
        }
      }

      return rows;
    }),

  getSubscription: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const rows = await selectSql(sql`
        SELECT cs.*,
          sp.name as "planName", sp.recurrences as "planRecurrences",
          sp"maxServices" as "maxServices", sp"maxProducts" as "maxProducts",
          c.name as "clientName", c.phone as "clientPhone", c.email as "clientEmail",
          b.name as "barberName"
        FROM client_subscriptions cs
        JOIN subscription_plans sp ON sp.id = cs."planId"
        JOIN clients c ON c.id = cs."clientId"
        LEFT JOIN barbers b ON b.id = cs."barberId"
        WHERE cs.id = ${input.id} AND cs."tenantId" = ${input.tenantId}
      `);
      const sub = rows[0];
      if (!sub) return null;

      // subscription_appointments: colunas camelCase
      sub.appointments = await selectSql(sql`
        SELECT sa."recurrenceIndex", a.date, a."startTime" as time, a.status, a.id as "appointmentId"
        FROM subscription_appointments sa
        JOIN appointments a ON a.id = sa."appointmentId"
        WHERE sa."subscriptionId" = ${input.id}
        ORDER BY sa."recurrenceIndex"
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
      const barberIdVal = input.barberId ?? null;

      // client_subscriptions: colunas camelCase, RETURNING id para PostgreSQL
      const subscriptionId = await insertReturningId(sql`
        INSERT INTO client_subscriptions
          ("tenantId", "planId", "clientId", "barberId", "selectedServiceIds", "selectedProductIds",
           status, "paymentMethod", price, "cycleStart", "cycleEnd", "autoRenew")
        VALUES (
          ${input.tenantId}, ${input.planId}, ${input.clientId}, ${barberIdVal},
          ${selectedSvcJson}, ${selectedProdJson},
          'active', ${input.paymentMethod}, ${input.price},
          ${cycleStart}, ${cycleEnd}, ${input.autoRenew}
        )
        RETURNING id
      `);

      function addMinutes(t: string, minutes: number): string {
        const [h, m] = t.split(":").map(Number);
        const total = h * 60 + m + minutes;
        return `${Math.floor(total / 60).toString().padStart(2, "00")}:${(total % 60).toString().padStart(2, "00")}:00`;
      }

      const appointmentIds: number[] = [];
      const primaryServiceId = input.selectedServiceIds[0] ?? 0;

      let serviceDurationMinutes = 30;
      if (primaryServiceId > 0) {
        try {
          const svcRows = await selectSql(sql`SELECT "durationMinutes" FROM services WHERE id = ${primaryServiceId} LIMIT 1`) as { durationMinutes: number }[];
          if (svcRows.length > 0 && svcRows[0].durationMinutes > 0) {
            serviceDurationMinutes = svcRows[0].durationMinutes;
          }
        } catch {
          // manter padrão
        }
      }

      for (let i = 0; i < input.appointments.length; i++) {
        const appt = input.appointments[i];
        const apptBarberId = appt.barberId ?? input.barberId ?? null;
        const dateEsc = String(appt.date).replace(/'/g, "''");
        const timeRaw = String(appt.time).replace(/'/g, "''");
        const startTimeEsc = timeRaw.includes(":") && timeRaw.split(":").length === 2
          ? timeRaw + ":00"
          : timeRaw;
        const endTimeEsc = addMinutes(appt.time, serviceDurationMinutes);

        // Verificar duplicata dentro do mesmo plano
        const isDuplicate = input.appointments.slice(0, i).some(
          (prev) => prev.date === appt.date && prev.time === appt.time
        );
        if (isDuplicate) {
          throw new Error(`Horário duplicado: ${appt.date} às ${appt.time}. Cada sessão do plano deve ter um horário único.`);
        }

        // Verificar conflito com agendamentos existentes no banco
        if (apptBarberId) {
          const conflicts = await selectSql(sql`
            SELECT id FROM appointments
            WHERE "barberId" = ${apptBarberId}
              AND date = ${dateEsc}
              AND status NOT IN ('cancelled', 'no_show')
              AND "startTime" < ${endTimeEsc}
              AND "endTime" > ${startTimeEsc}
            LIMIT 1
          `) as { id: number }[];
          if (conflicts.length > 0) {
            throw new Error(`Conflito de horário: ${appt.date} às ${appt.time} já está ocupado.`);
          }
        }

        const barberIdStr = apptBarberId !== null ? String(Number(apptBarberId)) : 'NULL';

        const appointmentId = await insertRawReturningId(
          `INSERT INTO appointments ("clientId", "barberId", "serviceId", date, "startTime", "endTime", status) VALUES (${input.clientId}, ${barberIdStr}, ${primaryServiceId}, '${dateEsc}', '${startTimeEsc}', '${endTimeEsc}', 'confirmed') RETURNING id`
        );
        appointmentIds.push(appointmentId);

        await insertRawReturningId(
          `INSERT INTO subscription_appointments ("subscriptionId", "appointmentId", "tenantId", "recurrenceIndex") VALUES (${subscriptionId}, ${appointmentId}, ${input.tenantId}, ${i + 1}) RETURNING id`
        );
      }

      // Registrar venda na tabela sales para aparecer no faturamento
      try {
        const paymentMethodMap: Record<string, string> = {
          cash: "cash", pix: "pix",
          credit: "credit_card", credit_card: "credit_card",
          debit: "debit_card", debit_card: "debit_card",
        };
        const saleMethod = paymentMethodMap[input.paymentMethod] ?? "cash";
        const planNameRow = await selectSql(sql`SELECT name FROM subscription_plans WHERE id = ${input.planId} LIMIT 1`) as { name: string }[];
        const planName = planNameRow[0]?.name ?? "Plano de Assinatura";
        const clientNameRow = await selectSql(sql`SELECT name FROM clients WHERE id = ${input.clientId} LIMIT 1`) as { name: string }[];
        const clientName = clientNameRow[0]?.name ?? "Cliente";
        // barberId obrigatório na tabela sales — usar barbeiro do input ou primeiro do tenant
        let saleBarberIdVal = input.barberId;
        if (!saleBarberIdVal) {
          const firstBarber = await selectSql(sql`SELECT id FROM barbers WHERE "tenantId" = ${input.tenantId} AND "isActive" = true ORDER BY id LIMIT 1`) as { id: number }[];
          saleBarberIdVal = firstBarber[0]?.id ?? null;
        }
        if (saleBarberIdVal) {
          await mutateSql(sql`
            INSERT INTO sales ("barberId", "clientId", date, subtotal, total, "paymentMethod", "paymentStatus", notes)
            VALUES (
              ${saleBarberIdVal}, ${input.clientId},
              ${cycleStart}, ${input.price}, ${input.price}, ${saleMethod}, 'paid',
              ${"[subscription] " + planName + " - " + clientName}
            )
          `);
        }
      } catch (e: any) {
        console.warn("[createSubscription] Erro ao registrar venda:", e.message);
      }

      return { ok: true, id: subscriptionId, appointmentIds };
    }),

  updateSubscription: publicProcedure
    .input(z.object({
      id: z.number(),
      tenantId: z.number(),
      selectedServiceIds: z.array(z.number()),
      selectedProductIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const svcJson = JSON.stringify(input.selectedServiceIds);
      const prdJson = JSON.stringify(input.selectedProductIds);
      await mutateSql(sql`
        UPDATE client_subscriptions
        SET "selectedServiceIds" = ${svcJson},
            "selectedProductIds" = ${prdJson},
            "updatedAt" = NOW()
        WHERE id = ${input.id} AND "tenantId" = ${input.tenantId}
      `);
      return { ok: true };
    }),

  getPlanItems: publicProcedure
    .input(z.object({ planId: z.number() }))
    .query(async ({ input }) => {
      const services = await selectSql(sql`
        SELECT sps."serviceId" as id, s.name, s.price, s."durationMinutes" as duration
        FROM subscription_plan_services sps
        JOIN services s ON s.id = sps."serviceId"
        WHERE sps."planId" = ${input.planId}
      `);
      const products = await selectSql(sql`
        SELECT spp."productId" as id, p.name, p.price
        FROM subscription_plan_products spp
        JOIN products p ON p.id = spp."productId"
        WHERE spp."planId" = ${input.planId}
      `);
      return { services, products };
    }),

  cancelSubscription: publicProcedure
    .input(z.object({
      id: z.number(),
      tenantId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const reason = input.reason ?? null;
      // client_subscriptions: colunas camelCase
      await mutateSql(sql`
        UPDATE client_subscriptions
        SET status='cancelled', "cancelledAt"=NOW(), "cancelReason"=${reason}, "updatedAt"=NOW()
        WHERE id=${input.id} AND "tenantId"=${input.tenantId}
      `);
      return { ok: true };
    }),

  // ── Stats para o dashboard ─────────────────────────────────────────────────

  stats: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      // client_subscriptions: colunas camelCase
      const activeRows = await selectSql(sql`
        SELECT COUNT(*) as cnt, COALESCE(SUM(price), 0) as mrr
        FROM client_subscriptions WHERE "tenantId"=${input.tenantId} AND status='active'
      `);
      const cancelledRows = await selectSql(sql`
        SELECT COUNT(*) as cnt FROM client_subscriptions WHERE "tenantId"=${input.tenantId} AND status='cancelled'
      `);
      // subscription_plans: colunas minúsculas
      const plansRows = await selectSql(sql`
        SELECT COUNT(*) as cnt FROM subscription_plans WHERE "tenantId"=${input.tenantId} AND "isActive"=true
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
      // subscription_plans: colunas minúsculas com alias camelCase
      const plans = await selectSql(sql`
        SELECT id, name, description, recurrences,
          "maxServices" as "maxServices", "maxProducts" as "maxProducts",
          price, "suggestedPrice" as "suggestedPrice"
        FROM subscription_plans
        WHERE "tenantId"=${input.tenantId} AND "isActive"=true
        ORDER BY price ASC
      `);

      for (const plan of plans) {
        const pid = parseInt(String(plan.id), 10);
        plan.services = await selectSql(sql`
          SELECT sps."serviceId", s.name, s.price, s."durationMinutes" as duration
          FROM subscription_plan_services sps
          JOIN services s ON s.id = sps."serviceId"
          WHERE sps."planId" = ${pid}
        `);
        plan.products = await selectSql(sql`
          SELECT spp."productId", p.name, p.price
          FROM subscription_plan_products spp
          JOIN products p ON p.id = spp."productId"
          WHERE spp."planId" = ${pid}
        `);
      }

      return plans;
    }),
});
