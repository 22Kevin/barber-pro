import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { removeBarberJwt } from "@/lib/trpc";

export type BarberRole = "super_admin" | "barber" | "receptionist";

export type TenantPlan = "solo" | "team" | "studio";

export interface AuthBarber {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  role: BarberRole;
  specialties: string | null;
  tenantId?: number | null;
  tenantPlan?: TenantPlan | null;
}

interface AuthContextType {
  barber: AuthBarber | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (barber: AuthBarber) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (requiredRole: BarberRole | BarberRole[]) => boolean;
  updateBarber: (data: Partial<AuthBarber>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ROLE_HIERARCHY: Record<BarberRole, number> = {
  super_admin: 3,
  barber: 2,
  receptionist: 1,
};

const AUTH_STORAGE_KEY = "@barber_pro_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [barber, setBarber] = useState<AuthBarber | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();

    // When app comes back to foreground, silently verify token is still valid
    // This prevents the appearance of being "logged out" after switching apps
    const subscription = AppState.addEventListener("change", async (state: AppStateStatus) => {
      if (state === "active") {
        try {
          const { getBarberJwt, isJwtExpiredOrExpiringSoon, tryRefreshBarberToken } = await import("@/lib/trpc") as any;
          if (getBarberJwt && isJwtExpiredOrExpiringSoon) {
            const token = await getBarberJwt();
            if (token && isJwtExpiredOrExpiringSoon(token)) {
              // Token about to expire — refresh silently
              await tryRefreshBarberToken?.();
            }
          }
        } catch {
          // Ignore errors — user stays logged in with existing token
        }
      }
    });
    return () => subscription?.remove();
  }, []);

  async function loadStoredAuth() {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const barberData = JSON.parse(stored);
        setBarber(barberData);
        // Silently try to refresh token in background
        // This ensures the session stays alive without asking user to login again
        try {
          const { tryRefreshBarberToken, getBarberJwt, isJwtValid } = await import("@/lib/trpc");
          const currentToken = await getBarberJwt?.();
          if (currentToken) {
            // Token exists - let the tRPC client handle refresh automatically
            // No action needed here
          } else {
            // No token but have barber data - try to get a new token via refresh
            const newToken = await tryRefreshBarberToken();
            if (!newToken) {
              // Refresh failed - keep barber data but token will fail on next request
              // tRPC will handle the 401 response
              console.log("[auth] No valid token, will need re-login");
            }
          }
        } catch {
          // Ignore refresh errors on startup
        }
      }
    } catch (error) {
      console.error("Erro ao carregar autenticação:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(barberData: AuthBarber) {
    setBarber(barberData);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(barberData));
  }

  async function logout() {
    setBarber(null);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    await removeBarberJwt();
  }

  async function updateBarber(data: Partial<AuthBarber>) {
    if (!barber) return;
    const updated = { ...barber, ...data };
    setBarber(updated);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  }

  function hasPermission(requiredRole: BarberRole | BarberRole[]): boolean {
    if (!barber) return false;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const barberLevel = ROLE_HIERARCHY[barber.role];
    return roles.some((role) => barberLevel >= ROLE_HIERARCHY[role]);
  }

  return (
    <AuthContext.Provider
      value={{
        barber,
        isAuthenticated: !!barber,
        isLoading,
        login,
        logout,
        hasPermission,
        updateBarber,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useBarberAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useBarberAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
