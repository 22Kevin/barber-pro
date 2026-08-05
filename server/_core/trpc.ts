import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import type { BarberJwtPayload } from "../barber-jwt.js";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * barberProcedure — exige JWT de barbeiro válido no header Authorization.
 * Usado em mutations administrativas do app mobile (delete, update, create).
 * O ctx.barber contém { barberId, tenantId, role } extraído do token verificado.
 */
const requireBarber = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.barber) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Autenticação de barbeiro necessária. Faça login novamente.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      barber: ctx.barber as BarberJwtPayload,
    },
  });
});

export const barberProcedure = t.procedure.use(requireBarber);

/**
 * activeBarberProcedure — exige JWT válido + assinatura Barber Pro ativa.
 *
 * Além da verificação de JWT do barberProcedure, consulta o banco para
 * confirmar que o tenant ainda está em trial válido ou com assinatura ativa.
 * Aplica a mesma lógica de grace period de 48h do painel web.
 *
 * Usado em todas as rotas de dados do app mobile. Rotas de autenticação e
 * pagamento continuam usando barberProcedure ou publicProcedure, para que
 * usuários com trial expirado ainda consigam fazer login e efetuar pagamento.
 *
 * Codes retornados:
 *  - UNAUTHORIZED  → sem JWT ou JWT inválido (herdado de requireBarber)
 *  - FORBIDDEN     → assinatura expirada/cancelada (após grace period)
 */
const requireActiveSubscription = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  // requireBarber já garante ctx.barber não-nulo neste ponto
  const barber = ctx.barber as BarberJwtPayload;
  const tenantId = barber.tenantId;

  // Sem tenantId (não deveria acontecer, mas defensivo)
  if (!tenantId) {
    return next({ ctx: { ...ctx, barber } });
  }

  try {
    // Importação dinâmica para evitar dependência circular com db.ts
    const { getDb } = await import("../db.js");
    const dbConn = await getDb();
    if (!dbConn) {
      // Se o banco não responder, não bloqueamos (fail open para não prejudicar
      // usuários legítimos por falha de infraestrutura)
      return next({ ctx: { ...ctx, barber } });
    }

    const rows = await (dbConn as any).execute(
      `SELECT "barberproSubscriptionStatus", "trialEndsAt" FROM tenants WHERE id = ${tenantId} LIMIT 1`
    );
    const tenant = ((rows as any).rows as any[])?.[0];

    if (!tenant) {
      // Tenant não encontrado — não bloqueamos, pode ser tenant novo
      return next({ ctx: { ...ctx, barber } });
    }

    const status: string = tenant.barberproSubscriptionStatus ?? "trial";
    const trialEndsAt: Date | null = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
    const now = new Date();

    // Grace period de 48h após vencimento — igual ao painel web
    const GRACE_MS = 48 * 60 * 60 * 1000;
    const trialExpiredPastGrace =
      trialEndsAt !== null && now.getTime() - trialEndsAt.getTime() > GRACE_MS;

    const isBlocked =
      status === "expired" ||
      status === "cancelled" ||
      (status === "trial" && trialExpiredPastGrace);

    if (isBlocked) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "SUBSCRIPTION_EXPIRED",
      });
    }
  } catch (err) {
    // Re-lança erros tRPC (FORBIDDEN/UNAUTHORIZED) sem engolir
    if (err instanceof TRPCError) throw err;
    // Erros de banco/infra: fail open — não bloqueamos por instabilidade
    console.error("[activeBarberProcedure] Falha ao verificar assinatura:", err);
  }

  return next({ ctx: { ...ctx, barber } });
});

export const activeBarberProcedure = t.procedure
  .use(requireBarber)
  .use(requireActiveSubscription);

/**
 * assertTenantOwnership — barreira de isolamento multi-tenant para mutations do
 * tRPC que recebem um `id` e alteram/removem um recurso já existente.
 *
 * PROBLEMA QUE RESOLVE: `activeBarberProcedure`/`barberProcedure` só provam que o
 * JWT é válido e pertence a ALGUM barbeiro — nunca que o recurso apontado pelo
 * `id` do input pertence ao MESMO tenant desse barbeiro. Sem essa checagem,
 * qualquer barbeiro autenticado poderia alterar/apagar dados de OUTRA barbearia
 * apenas adivinhando/iterando ids sequenciais (broken access control / IDOR).
 *
 * Uso: chamar no início da mutation, antes de qualquer db.updateX/deleteX,
 * passando a estratégia de resolução de tenant certa pra tabela do recurso:
 *
 *   await assertTenantOwnership(ctx, { kind: "direct", table: "services" }, input.id);
 *
 * Lança TRPCError:
 *  - FORBIDDEN             tenantId do chamador não bate com o do recurso (ou
 *                          o token não tem tenantId)
 *  - NOT_FOUND             o recurso não existe
 *  - INTERNAL_SERVER_ERROR o banco não pôde ser consultado — fail-closed
 *                          (bloqueia por segurança; diferente do
 *                          requireActiveSubscription, que é fail-open por ser
 *                          checagem de billing, não de permissão)
 */
export type OwnershipStrategy =
  | { kind: "direct"; table: "barbers" | "services" | "products" | "expenses" | "coupons" | "loyalty_rewards" }
  | { kind: "viaBarber"; table: "blocked_slots" | "appointments" }
  | { kind: "viaMedia" };

export async function assertTenantOwnership(
  ctx: { barber?: BarberJwtPayload | null },
  strategy: OwnershipStrategy,
  id: number
): Promise<void> {
  const callerTenantId = ctx.barber?.tenantId ?? null;

  if (callerTenantId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Tenant não identificado." });
  }
  if (!Number.isFinite(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Id inválido." });
  }

  let resourceTenantId: number | null | undefined;

  try {
    const db = await import("../db.js");

    if (strategy.kind === "direct") {
      const rows = await db.rawQuery(`SELECT "tenantId" FROM ${strategy.table} WHERE id = $1 LIMIT 1`, [id]);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Recurso não encontrado." });
      resourceTenantId = rows[0].tenantId;
    } else if (strategy.kind === "viaBarber") {
      const rows = await db.rawQuery(
        `SELECT b."tenantId" AS "tenantId" FROM ${strategy.table} t JOIN barbers b ON b.id = t."barberId" WHERE t.id = $1 LIMIT 1`,
        [id]
      );
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Recurso não encontrado." });
      resourceTenantId = rows[0].tenantId;
    } else {
      const mediaRows = await db.rawQuery(`SELECT "entityType", "entityId" FROM media_files WHERE id = $1 LIMIT 1`, [id]);
      if (!mediaRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Recurso não encontrado." });
      const entityTable = mediaRows[0].entityType === "product" ? "products" : "services";
      const rows = await db.rawQuery(`SELECT "tenantId" FROM ${entityTable} WHERE id = $1 LIMIT 1`, [mediaRows[0].entityId]);
      resourceTenantId = rows[0]?.tenantId;
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível validar permissão sobre o recurso." });
  }

  if (resourceTenantId !== callerTenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para acessar este recurso." });
  }
}
