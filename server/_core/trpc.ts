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
