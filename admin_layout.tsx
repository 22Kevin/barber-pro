import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useBarberAuth } from "@/lib/auth-context";
import { AdminDrawerProvider, useAdminDrawer } from "@/lib/admin-drawer-context";
import { AdminDrawer } from "@/components/admin-drawer";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";

// ─── Guard de assinatura ──────────────────────────────────────────────────────
function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { barber, isLoading: authLoading, logout } = useBarberAuth();
  const router = useRouter();
  const segments = useSegments();
  const queryClient = useQueryClient();

  const tenantId = barber?.tenantId ?? 0;
  const isPaywallScreen = segments.includes("barberpro-paywall" as never);
  const isTrialExpiredScreen = segments.includes("trial-expired" as never);
  const isProtectedScreen = !isPaywallScreen && !isTrialExpiredScreen;

  // Buscar status da assinatura apenas quando autenticado
  const { data: subscription, isLoading: subLoading } = trpc.asaasPayments.getBarberproSubscription.useQuery(
    { tenantId },
    {
      enabled: !!barber && tenantId > 0,
      // Revalidar a cada 5 minutos
      staleTime: 5 * 60 * 1000,
      retry: false,
    }
  );

  // Redirecionar para paywall se status bloqueado (verificação proativa)
  useEffect(() => {
    if (authLoading || subLoading) return;
    if (!barber) return;
    if (tenantId === 0) return;

    const status = subscription?.status;
    const blockedStatuses = ["expired", "cancelled"];

    if (status && blockedStatuses.includes(status) && isProtectedScreen) {
      router.replace("/admin/barberpro-paywall");
    }
  }, [authLoading, subLoading, barber, subscription, isProtectedScreen, tenantId]);

  // Interceptar erros globais do servidor via QueryCache
  useEffect(() => {
    if (!barber || !isProtectedScreen) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const error = event.query.state.error as any;
      if (!error) return;
      const code = error?.data?.code ?? error?.shape?.data?.code;
      const message = error?.message ?? error?.shape?.message ?? "";

      // Trial expirado → paywall
      if (code === "FORBIDDEN" && message.includes("SUBSCRIPTION_EXPIRED")) {
        router.replace("/admin/barberpro-paywall");
        return;
      }

      // Token expirado e refresh falhou → logout + tela de login
      if (code === "UNAUTHORIZED") {
        logout().then(() => {
          queryClient.clear();
          router.replace("/admin/login");
        });
      }
    });

    // Interceptar também erros de mutations
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const error = (event.mutation as any)?.state?.error as any;
      if (!error) return;
      const code = error?.data?.code ?? error?.shape?.data?.code;

      if (code === "UNAUTHORIZED") {
        logout().then(() => {
          queryClient.clear();
          router.replace("/admin/login");
        });
      }
    });

    return () => {
      unsubscribe();
      unsubscribeMutations();
    };
  }, [barber, isProtectedScreen, queryClient, router, logout]);

  // Mostrar loading enquanto verifica assinatura (apenas na primeira carga)
  if ((authLoading || (subLoading && !subscription)) && isProtectedScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#C9A84C" />
      </View>
    );
  }

  return <>{children}</>;
}

// ─── Inner layout com drawer ──────────────────────────────────────────────────
function AdminLayoutInner() {
  const { isOpen, closeDrawer } = useAdminDrawer();

  return (
    <View style={{ flex: 1 }}>
      <SubscriptionGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </SubscriptionGuard>
      <AdminDrawer visible={isOpen} onClose={closeDrawer} />
    </View>
  );
}

// ─── Root layout do admin ─────────────────────────────────────────────────────
export default function AdminLayout() {
  return (
    <AuthProvider>
      <AdminDrawerProvider>
        <AdminLayoutInner />
      </AdminDrawerProvider>
    </AuthProvider>
  );
}
