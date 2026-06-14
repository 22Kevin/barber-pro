import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyBarberToken, extractBarberTokenFromRequest, type BarberJwtPayload } from "../barber-jwt.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  barber: BarberJwtPayload | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  let barber: BarberJwtPayload | null = null;

  const bearerToken = extractBarberTokenFromRequest(opts.req as any);

  if (bearerToken) {
    // Bearer token presente — tentar como barber JWT primeiro.
    // Não chamar sdk.authenticateRequest aqui: o barber JWT é assinado com
    // "barber:<JWT_SECRET>", enquanto verifySession usa só "<JWT_SECRET>".
    // Chamar os dois causaria JWSSignatureVerificationFailed em todo request mobile.
    barber = await verifyBarberToken(bearerToken).catch(() => null);
  } else {
    // Sem Bearer token — tentar autenticação via session cookie (fluxo web OAuth)
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    barber,
  };
}
