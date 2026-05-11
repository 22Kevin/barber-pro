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

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Tentar autenticar como barbeiro via JWT
  try {
    const token = extractBarberTokenFromRequest(opts.req as any);
    if (token) {
      barber = await verifyBarberToken(token);
    }
  } catch {
    barber = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    barber,
  };
}
