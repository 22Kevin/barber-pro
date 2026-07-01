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
