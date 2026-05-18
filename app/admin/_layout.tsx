import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useBarberAuth } from "@/lib/auth-context";
import { AdminDrawerProvider, useAdminDrawer } from "@/lib/admin-drawer-context";
import { AdminDrawer } from "@/components/admin-drawer";
import { trpc } from "@/lib/trpc";

// ─── Guard de assinatura ──────────────────────────────────────────────────────
function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { barber, isLoading: authLoading } = useBarberAuth();
  const router = useRouter();
  const segments = useSegments();

  const tenantId = barber?.tenantId ?? 0;
  const isPaywallScreen = segments.includes("barberpro-paywall" as never);

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

  useEffect(() => {
    if (authLoading || subLoading) return;
    if (!barber) return;
    if (tenantId === 0) return;

    const status = subscription?.status;
    const blockedStatuses = ["expired", "cancelled"];

    if (status && blockedStatuses.includes(status) && !isPaywallScreen) {
      router.replace("/admin/barberpro-paywall");
    }
  }, [authLoading, subLoading, barber, subscription, isPaywallScreen, tenantId]);

  // Mostrar loading enquanto verifica assinatura (apenas na primeira carga)
  if ((authLoading || (subLoading && !subscription)) && !isPaywallScreen) {
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
