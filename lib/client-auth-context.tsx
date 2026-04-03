import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { scheduleBirthdayNotification, cancelBirthdayNotification } from "@/lib/use-notifications";

const CLIENT_STORAGE_KEY = "@barber_pro_client_session";

export type ClientUser = {
  id: number;
  tenantId?: number | null;
  preferredTenantId?: number | null;
  name: string;
  email: string;
  phone: string;
  totalPoints: number;
  birthDate?: string | null;
  photoUrl?: string | null;
};

type ClientAuthContextType = {
  client: ClientUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: ClientUser) => Promise<void>;
  logout: () => Promise<void>;
  updateClient: (data: Partial<ClientUser>) => Promise<void>;
};

const ClientAuthContext = createContext<ClientAuthContextType | null>(null);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<ClientUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(CLIENT_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data) as ClientUser;
          setClient(parsed);
          // Reagenda notificação de aniversário ao restaurar sessão
          if (parsed.birthDate) {
            scheduleBirthdayNotification(parsed.id, parsed.name, parsed.birthDate);
          }
        } catch { /* ignore */ }
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (user: ClientUser) => {
    setClient(user);
    await AsyncStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(user));
    // Agenda notificação de aniversário ao fazer login
    if (user.birthDate) {
      await scheduleBirthdayNotification(user.id, user.name, user.birthDate);
    }
  }, []);

  const logout = useCallback(async () => {
    // Cancela notificação de aniversário ao fazer logout
    if (client?.id) {
      await cancelBirthdayNotification(client.id);
    }
    setClient(null);
    await AsyncStorage.removeItem(CLIENT_STORAGE_KEY);
  }, [client]);

  const updateClient = useCallback(async (data: Partial<ClientUser>) => {
    setClient((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      AsyncStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(updated));
      // Reagenda notificação de aniversário se a data foi atualizada
      if (data.birthDate !== undefined) {
        if (data.birthDate) {
          scheduleBirthdayNotification(updated.id, updated.name, data.birthDate);
        } else {
          cancelBirthdayNotification(updated.id);
        }
      }
      return updated;
    });
  }, []);

  return (
    <ClientAuthContext.Provider value={{ client, isLoading, isAuthenticated: !!client, login, logout, updateClient }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error("useClientAuth must be used within ClientAuthProvider");
  return ctx;
}
