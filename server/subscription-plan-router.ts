/**
 * Router tRPC para Planos de Assinatura e Assinaturas de Clientes
 * Separado do routers.ts principal para manter o arquivo gerenciável.
 */
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getDbConn() {
  const conn = (db as any).getDb ? await (db as any).getDb() : null;
  return conn;
}

async function execSql(sql: string, params: any[] = []) {
  const conn = await getDbConn();
  if (!conn) throw new Error("DB not available");
  const [rows] = await conn.execute(sql, params);
  return rows as any[];
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const subscriptionPlanRouter = router({
  // ── Planos (CRUD pelo barbeiro) ────────────────────────────────────────────

  listPlans: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const plans = await execSql(
        `SELECT sp.*, 
          (SELECT COUNT(*) FROM subscription_plan_services WHERE planId = sp.id) as serviceCount,
          (SELECT COUNT(*) FROM subscription_plan_products WHERE planId = sp.id) as productCount,
          (SELECT COUNT(*) FROM client_subscriptions WHERE planId = sp.id AND status = 'active') as activeSubscribers
         FROM subscription_plans sp
         WHERE sp.tenantId = ? ORDER BY sp.createdAt DESC`,
        [input.tenantId]
      );

      // Buscar serviços e produtos de cada plano
      for (const plan of plans) {
        const services = await execSql(
          `SELECT sps.serviceId, s.name, s.price, s.duration
           FROM subscription_plan_services sps
           JOIN services s ON s.id = sps.serviceId
           WHERE sps.planId = ?`,
          [plan.id]
        );
        const products = await execSql(
          `SELECT spp.productId, p.name, p.salePrice as price
           FROM subscription_plan_products spp
           JOIN products p ON p.id = spp.productId
           WHERE spp.planId = ?`,
          [plan.id]
        );
        plan.services = services;
        plan.products = products;
      }

      return plans;
    }),

  getPlan: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const [plan] = await execSql(
        `SELECT * FROM subscription_plans WHERE id = ? AND tenantId = ?`,
        [input.id, input.tenantId]
      );
      if (!plan) return null;

      plan.services = await execSql(
        `SELECT sps.serviceId, s.name, s.price, s.duration
         FROM subscription_plan_services sps
         JOIN services s ON s.id = sps.serviceId
         WHERE sps.planId = ?`,
        [plan.id]
      );
      plan.products = await execSql(
        `SELECT spp.productId, p.name, p.salePrice as price
         FROM subscription_plan_products spp
         JOIN products p ON p.id = spp.productId
         WHERE spp.planId = ?`,
        [plan.id]
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
      const conn = await getDbConn();
      if (!conn) throw new Error("DB not available");

      const [result] = await conn.execute(
        `INSERT INTO subscription_plans (tenantId, name, description, recurrences, maxServices, maxProducts, price, suggestedPrice)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.tenantId, input.name, input.description ?? null, input.recurrences,
         input.maxServices, input.maxProducts, input.price, input.suggestedPrice ?? null]
      );
      const planId = (result as any).insertId;

      for (const serviceId of input.serviceIds) {
        await conn.execute(
          `INSERT INTO subscription_plan_services (planId, serviceId, tenantId) VALUES (?, ?, ?)`,
          [planId, serviceId, input.tenantId]
        );
      }
      for (const productId of input.productIds) {
        await conn.execute(
          `INSERT INTO subscription_plan_products (planId, productId, tenantId) VALUES (?, ?, ?)`,
          [planId, productId, input.tenantId]
        );
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
      const conn = await getDbConn();
      if (!conn) throw new Error("DB not available");

      await conn.execute(
        `UPDATE subscription_plans SET name=?, description=?, recurrences=?, maxServices=?, maxProducts=?, price=?, suggestedPrice=?, isActive=?, updatedAt=NOW()
         WHERE id=? AND tenantId=?`,
        [input.name, input.description ?? null, input.recurrences, input.maxServices,
         input.maxProducts, input.price, input.suggestedPrice ?? null,
         input.isActive !== false ? 1 : 0, input.id, input.tenantId]
      );

      // Recriar serviços e produtos
      await conn.execute(`DELETE FROM subscription_plan_services WHERE planId=?`, [input.id]);
      await conn.execute(`DELETE FROM subscription_plan_products WHERE planId=?`, [input.id]);

      for (const serviceId of input.serviceIds) {
        await conn.execute(
          `INSERT INTO subscription_plan_services (planId, serviceId, tenantId) VALUES (?, ?, ?)`,
          [input.id, serviceId, input.tenantId]
        );
      }
      for (const productId of input.productIds) {
        await conn.execute(
          `INSERT INTO subscription_plan_products (planId, productId, tenantId) VALUES (?, ?, ?)`,
          [input.id, productId, input.tenantId]
        );
      }

      return { ok: true };
    }),

  deletePlan: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .mutation(async ({ input }) => {
      const conn = await getDbConn();
      if (!conn) throw new Error("DB not available");

      // Verificar se há assinaturas ativas
      const [active] = await execSql(
        `SELECT COUNT(*) as cnt FROM client_subscriptions WHERE planId=? AND status='active'`,
        [input.id]
      );
      if (active.cnt > 0) {
        throw new Error("Não é possível excluir um plano com assinaturas ativas.");
      }

      await conn.execute(`DELETE FROM subscription_plan_services WHERE planId=?`, [input.id]);
      await conn.execute(`DELETE FROM subscription_plan_products WHERE planId=?`, [input.id]);
      await conn.execute(`DELETE FROM subscription_plans WHERE id=? AND tenantId=?`, [input.id, input.tenantId]);

      return { ok: true };
    }),

  togglePlanActive: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      await execSql(
        `UPDATE subscription_plans SET isActive=?, updatedAt=NOW() WHERE id=? AND tenantId=?`,
        [input.isActive ? 1 : 0, input.id, input.tenantId]
      );
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
      let where = `cs.tenantId = ?`;
      const params: any[] = [input.tenantId];

      if (input.status !== "all") {
        where += ` AND cs.status = ?`;
        params.push(input.status);
      }
      if (input.clientId) {
        where += ` AND cs.clientId = ?`;
        params.push(input.clientId);
      }

      const subs = await execSql(
        `SELECT cs.*, 
          sp.name as planName, sp.recurrences as planRecurrences,
          c.name as clientName, c.phone as clientPhone,
          b.name as barberName
         FROM client_subscriptions cs
         JOIN subscription_plans sp ON sp.id = cs.planId
         JOIN clients c ON c.id = cs.clientId
         LEFT JOIN barbers b ON b.id = cs.barberId
         WHERE ${where}
         ORDER BY cs.createdAt DESC`,
        params
      );

      return subs;
    }),

  getSubscription: publicProcedure
    .input(z.object({ id: z.number(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const [sub] = await execSql(
        `SELECT cs.*, 
          sp.name as planName, sp.recurrences as planRecurrences, sp.maxServices, sp.maxProducts,
          c.name as clientName, c.phone as clientPhone, c.email as clientEmail,
          b.name as barberName
         FROM client_subscriptions cs
         JOIN subscription_plans sp ON sp.id = cs.planId
         JOIN clients c ON c.id = cs.clientId
         LEFT JOIN barbers b ON b.id = cs.barberId
         WHERE cs.id = ? AND cs.tenantId = ?`,
        [input.id, input.tenantId]
      );
      if (!sub) return null;

      // Buscar agendamentos vinculados
      sub.appointments = await execSql(
        `SELECT sa.recurrenceIndex, a.date, a.time, a.status, a.id as appointmentId
         FROM subscription_appointments sa
         JOIN appointments a ON a.id = sa.appointmentId
         WHERE sa.subscriptionId = ?
         ORDER BY sa.recurrenceIndex`,
        [input.id]
      );

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
      // Agendamentos: array de { date, time } com length = plan.recurrences
      appointments: z.array(z.object({
        date: z.string(), // YYYY-MM-DD
        time: z.string(), // HH:MM
        barberId: z.number().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const conn = await getDbConn();
      if (!conn) throw new Error("DB not available");

      // Calcular ciclo mensal
      const now = new Date();
      const cycleStart = now.toISOString().split("T")[0];
      const cycleEndDate = new Date(now);
      cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
      const cycleEnd = cycleEndDate.toISOString().split("T")[0];

      // Criar assinatura
      const [result] = await conn.execute(
        `INSERT INTO client_subscriptions 
         (tenantId, planId, clientId, barberId, selectedServiceIds, selectedProductIds, 
          status, paymentMethod, price, cycleStart, cycleEnd, autoRenew)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
        [
          input.tenantId, input.planId, input.clientId,
          input.barberId ?? null,
          JSON.stringify(input.selectedServiceIds),
          JSON.stringify(input.selectedProductIds),
          input.paymentMethod, input.price, cycleStart, cycleEnd,
          input.autoRenew ? 1 : 0,
        ]
      );
      const subscriptionId = (result as any).insertId;

      // Criar agendamentos vinculados
      const appointmentIds: number[] = [];
      for (let i = 0; i < input.appointments.length; i++) {
        const appt = input.appointments[i];
        const barberId = appt.barberId ?? input.barberId;

        const [apptResult] = await conn.execute(
          `INSERT INTO appointments (tenantId, clientId, barberId, date, time, status, serviceIds, source)
           VALUES (?, ?, ?, ?, ?, 'confirmed', ?, 'subscription')`,
          [
            input.tenantId, input.clientId, barberId ?? null,
            appt.date, appt.time,
            JSON.stringify(input.selectedServiceIds),
          ]
        );
        const appointmentId = (apptResult as any).insertId;
        appointmentIds.push(appointmentId);

        await conn.execute(
          `INSERT INTO subscription_appointments (subscriptionId, appointmentId, tenantId, recurrenceIndex)
           VALUES (?, ?, ?, ?)`,
          [subscriptionId, appointmentId, input.tenantId, i + 1]
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
      await execSql(
        `UPDATE client_subscriptions SET status='cancelled', cancelledAt=NOW(), cancelReason=?, updatedAt=NOW()
         WHERE id=? AND tenantId=?`,
        [input.reason ?? null, input.id, input.tenantId]
      );
      return { ok: true };
    }),

  // ── Stats para o dashboard ─────────────────────────────────────────────────

  stats: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const [active] = await execSql(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(price), 0) as mrr
         FROM client_subscriptions WHERE tenantId=? AND status='active'`,
        [input.tenantId]
      );
      const [cancelled] = await execSql(
        `SELECT COUNT(*) as cnt FROM client_subscriptions WHERE tenantId=? AND status='cancelled'`,
        [input.tenantId]
      );
      const [plans] = await execSql(
        `SELECT COUNT(*) as cnt FROM subscription_plans WHERE tenantId=? AND isActive=1`,
        [input.tenantId]
      );
      const total = (active.cnt || 0) + (cancelled.cnt || 0);
      const churn = total > 0 ? Math.round((cancelled.cnt / total) * 100) : 0;

      return {
        activeSubs: active.cnt || 0,
        mrr: parseFloat(active.mrr || "0"),
        cancelledSubs: cancelled.cnt || 0,
        churnRate: churn,
        activePlans: plans.cnt || 0,
      };
    }),

  // ── Planos públicos (para a página do cliente) ────────────────────────────

  listPublicPlans: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const plans = await execSql(
        `SELECT id, name, description, recurrences, maxServices, maxProducts, price, suggestedPrice
         FROM subscription_plans WHERE tenantId=? AND isActive=1 ORDER BY price ASC`,
        [input.tenantId]
      );

      for (const plan of plans) {
        plan.services = await execSql(
          `SELECT sps.serviceId, s.name, s.price, s.duration
           FROM subscription_plan_services sps
           JOIN services s ON s.id = sps.serviceId
           WHERE sps.planId = ?`,
          [plan.id]
        );
        plan.products = await execSql(
          `SELECT spp.productId, p.name, p.salePrice as price
           FROM subscription_plan_products spp
           JOIN products p ON p.id = spp.productId
           WHERE spp.planId = ?`,
          [plan.id]
        );
      }

      return plans;
    }),
});
