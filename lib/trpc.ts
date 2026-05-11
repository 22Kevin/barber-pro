import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl, BARBER_JWT_KEY } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const BARBER_REFRESH_JWT_KEY = "barber_refresh_jwt_token";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Obtém o JWT do barbeiro armazenado no SecureStore (native) ou localStorage (web).
 * Retorna null se não houver token salvo.
 */
export async function getBarberJwt(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof window !== "undefined" ? window.localStorage.getItem(BARBER_JWT_KEY) : null;
    }
    return await SecureStore.getItemAsync(BARBER_JWT_KEY);
  } catch {
    return null;
  }
}

/**
 * Salva o JWT do barbeiro no SecureStore (native) ou localStorage (web).
 */
export async function saveBarberJwt(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.setItem(BARBER_JWT_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(BARBER_JWT_KEY, token);
  } catch {
    // Falha silenciosa — o app continuará funcionando sem JWT
  }
}

/**
 * Remove o JWT do barbeiro do armazenamento seguro.
 */
export async function removeBarberJwt(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(BARBER_JWT_KEY);
        window.localStorage.removeItem(BARBER_REFRESH_JWT_KEY);
      }
      return;
    }
    await SecureStore.deleteItemAsync(BARBER_JWT_KEY);
    await SecureStore.deleteItemAsync(BARBER_REFRESH_JWT_KEY);
  } catch {
    // Falha silenciosa
  }
}

/**
 * Obtém o refresh token armazenado.
 */
export async function getBarberRefreshJwt(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof window !== "undefined" ? window.localStorage.getItem(BARBER_REFRESH_JWT_KEY) : null;
    }
    return await SecureStore.getItemAsync(BARBER_REFRESH_JWT_KEY);
  } catch {
    return null;
  }
}

/**
 * Salva o refresh token no SecureStore.
 */
export async function saveBarberRefreshJwt(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.setItem(BARBER_REFRESH_JWT_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(BARBER_REFRESH_JWT_KEY, token);
  } catch {
    // Falha silenciosa
  }
}

/**
 * Tenta renovar o access token usando o refresh token.
 * Retorna o novo access token ou null se falhar.
 */
export async function tryRefreshBarberToken(): Promise<string | null> {
  try {
    const refreshToken = await getBarberRefreshJwt();
    if (!refreshToken) return null;

    const apiBase = getApiBaseUrl();
    const response = await fetch(`${apiBase}/api/trpc/admin.refreshToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "0": { json: { refreshToken } } }),
      credentials: "include",
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.["0"]?.result?.data?.json;
    if (!result?.token) return null;

    await saveBarberJwt(result.token);
    if (result.refreshToken) await saveBarberRefreshJwt(result.refreshToken);
    return result.token;
  } catch {
    return null;
  }
}

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          // Prioridade: JWT do barbeiro > token de sessão OAuth
          const barberToken = await getBarberJwt();
          if (barberToken) {
            return { Authorization: `Bearer ${barberToken}` };
          }
          const oauthToken = await Auth.getSessionToken();
          return oauthToken ? { Authorization: `Bearer ${oauthToken}` } : {};
        },
        // Custom fetch to include credentials for cookie-based auth
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
