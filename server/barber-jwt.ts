/**
 * barber-jwt.ts
 *
 * JWT para autenticação de barbeiros no app mobile.
 * Separado do SDK de usuários OAuth para não criar dependência circular.
 *
 * Fluxo:
 *  1. Barbeiro faz login → servidor gera JWT com { barberId, tenantId, role }
 *  2. App armazena o JWT no SecureStore
 *  3. App envia JWT no header Authorization: Bearer <token>
 *  4. barberProcedure valida o JWT e popula ctx.barber
 */

import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env.js";

export interface BarberJwtPayload {
  barberId: number;
  tenantId: number | null;
  role: "super_admin" | "barber" | "receptionist";
}

const BARBER_JWT_ISSUER = "barber-pro-app";
const BARBER_JWT_AUDIENCE = "barber-mobile";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getBarberSecret(): Uint8Array {
  // Usa JWT_SECRET do servidor — mesma chave, namespace diferente via issuer/audience
  const secret = ENV.cookieSecret || "barber-pro-fallback-secret-change-in-production";
  return new TextEncoder().encode(`barber:${secret}`);
}

/**
 * Gera um JWT assinado para um barbeiro autenticado.
 * Retornado pelo endpoint de login e googleLogin.
 */
export async function signBarberToken(payload: BarberJwtPayload): Promise<string> {
  const secretKey = getBarberSecret();
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);

  return new SignJWT({
    barberId: payload.barberId,
    tenantId: payload.tenantId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(BARBER_JWT_ISSUER)
    .setAudience(BARBER_JWT_AUDIENCE)
    .setIssuedAt(Math.floor(issuedAt / 1000))
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

/**
 * Verifica e decodifica um JWT de barbeiro.
 * Retorna null se inválido, expirado ou malformado.
 */
export async function verifyBarberToken(token: string): Promise<BarberJwtPayload | null> {
  try {
    const secretKey = getBarberSecret();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
      issuer: BARBER_JWT_ISSUER,
      audience: BARBER_JWT_AUDIENCE,
    });

    const { barberId, tenantId, role } = payload as Record<string, unknown>;

    if (typeof barberId !== "number" || typeof role !== "string") {
      return null;
    }

    return {
      barberId,
      tenantId: typeof tenantId === "number" ? tenantId : null,
      role: role as BarberJwtPayload["role"],
    };
  } catch {
    return null;
  }
}

/**
 * Extrai o token JWT do header Authorization de uma requisição Express.
 * Suporta: "Authorization: Bearer <token>"
 */
export function extractBarberTokenFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return null;
}
