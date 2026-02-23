import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const CLIENT_STORAGE_KEY = "@barber_pro_client_session";

export type ClientUser = {
  id: number;
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
        try { setClient(JSON.parse(data)); } catch { /* ignore */ }
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (user: ClientUser) => {
    setClient(user);
    await AsyncStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(user));
  }, []);

  const logout = useCallback(async () => {
    setClient(null);
    await AsyncStorage.removeItem(CLIENT_STORAGE_KEY);
  }, []);

  const updateClient = useCallback(async (data: Partial<ClientUser>) => {
    setClient((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      AsyncStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(updated));
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
