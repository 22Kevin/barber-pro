import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: "Ativa",     color: "#4ADE80" },
  pending:   { label: "Pendente",  color: "#FBBF24" },
  cancelled: { label: "Cancelada", color: "#F87171" },
  overdue:   { label: "Atrasada",  color: "#F97316" },
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

export default function SubscriptionsScreen() {
  const { barber } = useBarberAuth();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();
  const tenantId = barber?.tenantId ?? 0;
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "cancelled">("active");

  const subsQuery = trpc.subscriptions.listByTenant.useQuery(
    { tenantId },
    { enabled: tenantId > 0, staleTime: 60000 }
  );

  const subs = (subsQuery.data ?? []) as any[];
  const filtered = filter === "all" ? subs : subs.filter((s) => s.status === filter);

  const stats = {
    active: subs.filter((s) => s.status === "active").length,
    revenue: subs.filter((s) => s.status === "active").reduce((sum, s) => sum + (Number(s.planPrice) || 0), 0),
    cancelled: subs.filter((s) => s.status === "cancelled").length,
  };

  async function onRefresh() {
    setRefreshing(true);
    await subsQuery.refetch();
    setRefreshing(false);
  }

  const dyn = {
    card: { backgroundColor: colors.surface, borderRadius: 14, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, overflow: "hidden" as const },
    name: { fontSize: 15, fontWeight: "700" as const, color: colors.text },
    plan: { fontSize: 13, color: colors.primary, fontWeight: "600" as const },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    metricCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, alignItems: "center" as const, borderWidth: 1, borderColor: colors.border },
    metricVal: { fontSize: 22, fontWeight: "900" as const, color: colors.primary },
    metricLabel: { fontSize: 11, color: colors.muted, marginTop: 3 },
    filterBtn: (active: boolean) => ({ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.border }),
    filterLabel: (active: boolean) => ({ fontSize: 13, fontWeight: "600" as const, color: active ? "#0A0A0A" : colors.muted }),
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Assinaturas" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Métricas */}
        <View style={{ flexDirection: "row", gap: 10, padding: 16, paddingBottom: 8 }}>
          <View style={dyn.metricCard}>
            <Text style={dyn.metricVal}>{stats.active}</Text>
            <Text style={dyn.metricLabel}>ativas</Text>
          </View>
          <View style={dyn.metricCard}>
            <Text style={dyn.metricVal}>{formatCurrency(stats.revenue)}</Text>
            <Text style={dyn.metricLabel}>MRR</Text>
          </View>
          <View style={dyn.metricCard}>
            <Text style={[dyn.metricVal, { color: "#F87171" }]}>{stats.cancelled}</Text>
            <Text style={dyn.metricLabel}>canceladas</Text>
          </View>
        </View>

        {/* Filtros */}
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
          {(["active", "all", "cancelled"] as const).map((f) => (
            <Pressable key={f} style={dyn.filterBtn(filter === f)} onPress={() => setFilter(f)}>
              <Text style={dyn.filterLabel(filter === f)}>{f === "active" ? "Ativas" : f === "all" ? "Todas" : "Canceladas"}</Text>
            </Pressable>
          ))}
        </View>

        {subsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
            <Text style={{ fontSize: 15, color: colors.muted }}>Nenhuma assinatura encontrada</Text>
          </View>
        ) : (
          filtered.map((sub: any) => {
            const st = STATUS_LABELS[sub.status] ?? { label: sub.status, color: colors.muted };
            return (
              <View key={sub.id} style={dyn.card}>
                <View style={{ padding: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={dyn.name}>{sub.clientName ?? "Cliente"}</Text>
                      <Text style={dyn.plan}>{sub.planName} · {formatCurrency(Number(sub.planPrice))}/mês</Text>
                      <Text style={dyn.sub}>Início: {formatDate(sub.startDate)}</Text>
                      {sub.nextBillingDate ? <Text style={dyn.sub}>Próx. cobrança: {formatDate(sub.nextBillingDate)}</Text> : null}
                    </View>
                    <View style={{ backgroundColor: st.color + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: st.color }}>{st.label}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: tabBarHeight + 16 }} />
      </ScrollView>
    </ScreenContainer>
  );
}
