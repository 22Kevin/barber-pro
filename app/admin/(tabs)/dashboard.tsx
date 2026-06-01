import { useCallback, useMemo, useState } from "react";
import { useCountUp } from "@/hooks/use-animated-number";
import { DashboardSkeleton } from "@/components/skeleton";
import {
  Animated,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBarberAuth } from "@/lib/auth-context";
import { AdminHeader } from "@/components/admin-header";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getTodayString() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function formatDatePT(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: "Agendado",    color: "#C9A84C" },
  confirmed:   { label: "Confirmado",  color: "#4CAF50" },
  in_progress: { label: "Em andamento",color: "#2196F3" },
  completed:   { label: "Concluído",   color: "#888880" },
  cancelled:   { label: "Cancelado",   color: "#F44336" },
  no_show:     { label: "Não compareceu", color: "#FF9800" },
};

export default function DashboardScreen() {
  const { barber, logout } = useBarberAuth();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();
  const today = getTodayString();
  const [refreshing, setRefreshing] = useState(false);

  const tenantId = barber?.tenantId ?? undefined;
  const statsQuery = trpc.dashboard.stats.useQuery({ date: today, tenantId });
  const appointmentsQuery = trpc.appointments.allByDate.useQuery({ date: today, tenantId });
  const barbersQuery = trpc.barbers.list.useQuery({ tenantId });
  const pendingPaymentsQuery = trpc.payments.pendingList.useQuery({ tenantId });
  const lowStockQuery = trpc.stock.lowStock.useQuery(
    { tenantId: tenantId ?? undefined },
    { enabled: !!tenantId }
  );
  const lowStockItems = lowStockQuery.data ?? [];

  const utils = trpc.useUtils();

  const dyn = useMemo(() => StyleSheet.create({
    greeting:        { fontSize: 24, fontWeight: "800", color: colors.foreground },
    date:            { fontSize: 12, color: colors.muted, marginTop: 3, letterSpacing: 0.5 },
    metricCard:      { flex: 1, minWidth: "45%", backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, alignItems: "flex-start", borderLeftWidth: 3 },
    metricValue:     { fontSize: 28, fontWeight: "900", color: colors.foreground, marginBottom: 4, lineHeight: 32 },
    metricLabel:     { fontSize: 11, color: colors.muted, letterSpacing: 0.5, textTransform: "uppercase" },
    sectionTitle:    { fontSize: 13, fontWeight: "700", color: colors.muted, paddingHorizontal: 20, marginTop: 20, marginBottom: 10, letterSpacing: 2, textTransform: "uppercase" },
    seeAll:          { fontSize: 13, color: colors.primary },
    quickActionBtn:  { flex: 1, minWidth: "45%", backgroundColor: "#141410", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#C9A84C33" },
    quickActionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary + "18", justifyContent: "center", alignItems: "center", marginBottom: 10 },
    quickActionLabel:{ fontSize: 12, color: colors.foreground, fontWeight: "600", textAlign: "center", lineHeight: 16 },
    emptyCard:       { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    emptyText:       { color: colors.muted, fontSize: 14 },
    appointmentCard: { marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: "row", overflow: "hidden" },
    aptTime:         { fontSize: 15, fontWeight: "700", color: colors.foreground },
    aptBarber:       { fontSize: 13, color: colors.muted },
    aptNotes:        { fontSize: 12, color: colors.muted, marginTop: 4, fontStyle: "italic" },
  }), [colors]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      utils.dashboard.stats.invalidate(),
      utils.appointments.allByDate.invalidate(),
      utils.payments.pendingList.invalidate(),
      utils.stock.lowStock.invalidate(),
    ]);
    setRefreshing(false);
  }, [utils]);

  const stats = statsQuery.data;
  const appointments = appointmentsQuery.data ?? [];
  const barbers = barbersQuery.data ?? [];

  // Animated counters for metrics
  const animAppts    = useCountUp(stats?.appointmentsToday ?? 0);
  const animPending  = useCountUp(stats?.pendingAppointments ?? 0);
  const animClients  = useCountUp(stats?.clientsToday ?? 0);

  const getBarberName = (id: number) => barbers.find(b => b.id === id)?.name ?? "—";

  // Banner de trial
  const tenantQuery = trpc.onboarding.getById.useQuery(
    { id: tenantId! },
    { enabled: !!tenantId }
  );
  const tenant = tenantQuery.data;
  const trialDaysLeft = tenant?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const showTrialBanner = tenant?.status === "trial" && trialDaysLeft !== null && trialDaysLeft <= 14;
  const planLabel = tenant?.plan === "team" ? "Equipe" : tenant?.plan === "studio" ? "Estúdio" : "Solo";

  const isLoadingInitial = statsQuery.isLoading && !statsQuery.data;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Dashboard" />
      {isLoadingInitial ? (
        <DashboardSkeleton />
      ) : (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner de trial */}
        {showTrialBanner && (
          <View style={[styles.trialBanner, trialDaysLeft! <= 3 && styles.trialBannerUrgent]}>
            <Text style={styles.trialBannerIcon}>{trialDaysLeft! <= 3 ? "⚠️" : "⏳"}</Text>
            <Text style={[styles.trialBannerText, trialDaysLeft! <= 3 && styles.trialBannerTextUrgent]}>
              {trialDaysLeft === 0
                ? `Seu trial do plano ${planLabel} expira hoje!`
                : `Trial do plano ${planLabel}: ${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restante${trialDaysLeft !== 1 ? "s" : ""}`}
            </Text>
          </View>
        )}

        {/* Saudação */}
        <View style={styles.greetingRow}>
          <Text style={dyn.greeting}>Olá, {barber?.name?.split(" ")[0]} 👋</Text>
          <Text style={dyn.date}>{formatDatePT(today)} — Hoje</Text>
        </View>

        {/* Métricas */}
        {statsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.metricsGrid}>
            <View style={[dyn.metricCard, { borderLeftColor: "#C9A84C" }]}>
              <View style={[styles.metricIcon, { backgroundColor: colors.primary + "22" }]}>
                <IconSymbol name="calendar" size={22} color={colors.primary} />
              </View>
              <Animated.Text style={dyn.metricValue}>{animAppts.interpolate({ inputRange: [0, stats?.appointmentsToday || 1], outputRange: ["0", String(stats?.appointmentsToday ?? 0)] })}</Animated.Text>
              <Text style={dyn.metricLabel}>Agendamentos</Text>
            </View>
            <View style={[dyn.metricCard, { borderLeftColor: "#4CAF50" }]}>
              <View style={[styles.metricIcon, { backgroundColor: "#4CAF5022" }]}>
                <IconSymbol name="dollarsign.circle.fill" size={22} color="#4CAF50" />
              </View>
              <Text style={dyn.metricValue}>{formatCurrency(stats?.revenueToday ?? 0)}</Text>
              <Text style={dyn.metricLabel}>Receita Hoje</Text>
            </View>
            <View style={[dyn.metricCard, { borderLeftColor: "#2196F3" }]}>
              <View style={[styles.metricIcon, { backgroundColor: "#2196F322" }]}>
                <IconSymbol name="person.2.fill" size={22} color="#2196F3" />
              </View>
              <Animated.Text style={dyn.metricValue}>{animClients.interpolate({ inputRange: [0, stats?.clientsToday || 1], outputRange: ["0", String(stats?.clientsToday ?? 0)] })}</Animated.Text>
              <Text style={dyn.metricLabel}>Clientes</Text>
            </View>
            <View style={[dyn.metricCard, { borderLeftColor: "#FF9800" }]}>
              <View style={[styles.metricIcon, { backgroundColor: "#FF980022" }]}>
                <IconSymbol name="clock.fill" size={22} color="#FF9800" />
              </View>
              <Animated.Text style={dyn.metricValue}>{animPending.interpolate({ inputRange: [0, stats?.pendingAppointments || 1], outputRange: ["0", String(stats?.pendingAppointments ?? 0)] })}</Animated.Text>
              <Text style={dyn.metricLabel}>Pendentes</Text>
            </View>
          </View>
        )}

        {/* Ações rápidas */}
        <Text style={dyn.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.quickActions}>
          <Pressable style={({ pressed }) => [dyn.quickActionBtn, pressed && { opacity: 0.7 }]} onPress={() => router.push("/admin/(tabs)/agenda" as any)}>
            <View style={dyn.quickActionIcon}><IconSymbol name="calendar.badge.plus" size={22} color={colors.primary} /></View>
            <Text style={dyn.quickActionLabel}>Novo Agendamento</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [dyn.quickActionBtn, pressed && { opacity: 0.7 }]} onPress={() => router.push("/admin/(tabs)/clients" as any)}>
            <View style={dyn.quickActionIcon}><IconSymbol name="person.badge.plus" size={22} color={colors.primary} /></View>
            <Text style={dyn.quickActionLabel}>Novo Cliente</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [dyn.quickActionBtn, pressed && { opacity: 0.7 }]} onPress={() => router.push("/admin/(tabs)/financial" as any)}>
            <View style={dyn.quickActionIcon}><IconSymbol name="dollarsign.circle.fill" size={22} color={colors.primary} /></View>
            <Text style={dyn.quickActionLabel}>Nova Venda</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [dyn.quickActionBtn, pressed && { opacity: 0.7 }]} onPress={() => router.push("/admin/(tabs)/services" as any)}>
            <View style={dyn.quickActionIcon}><IconSymbol name="scissors" size={22} color={colors.primary} /></View>
            <Text style={dyn.quickActionLabel}>Serviços</Text>
          </Pressable>
        </View>

        {/* Card Página Pública */}
        {tenant?.slug && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1A1505', borderRadius: 14, borderWidth: 1, borderColor: '#C9A84C33', overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#C9A84C22' }}>
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#C9A84C22', borderWidth: 1, borderColor: '#C9A84C44', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18 }}>✂️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#ECEDEE' }}>{tenant?.name}</Text>
                <Text style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }} numberOfLines={1}>usebarberpro.com/pub/{tenant.slug}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, padding: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#C9A84C22' }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#C9A84C' }}>{appointments.length}</Text>
                <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }}>agendamentos hoje</Text>
              </View>
              <View style={{ flex: 1, padding: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#C9A84C22' }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#C9A84C' }}>{appointments.filter((a: any) => a.source === 'online' || a.source === 'public').length}</Text>
                <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }}>agendados online</Text>
              </View>
              <View style={{ flex: 1, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#C9A84C' }}>{String(stats?.avgRating ?? '—')}</Text>
                <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{(stats?.reviewCount ?? 0) === 1 ? 'avaliação' : 'avaliações'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Alerta de estoque mínimo */}
        {lowStockItems.length > 0 && (
          <Pressable
            style={styles.lowStockBanner}
            onPress={() => router.push("/admin/(tabs)/products" as any)}
          >
            <Text style={styles.lowStockIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lowStockTitle}>
                {lowStockItems.length} produto{lowStockItems.length !== 1 ? "s" : ""} com estoque baixo
              </Text>
              <Text style={styles.lowStockSub} numberOfLines={2}>
                {lowStockItems.slice(0, 3).map((p: any) => `${p.name} (${p.stockQuantity ?? 0})`).join(" · ")}
                {lowStockItems.length > 3 ? " · ..." : ""}
              </Text>
            </View>
            <Text style={styles.lowStockArrow}>›</Text>
          </Pressable>
        )}

        {/* Pagamentos Pendentes */}
        {(pendingPaymentsQuery.data?.length ?? 0) > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={dyn.sectionTitle}>⏳ Aguardando Pagamento</Text>
              <Pressable onPress={() => router.push("/admin/(tabs)/financial" as any)}>
                <Text style={dyn.seeAll}>Ver todos ({pendingPaymentsQuery.data!.length})</Text>
              </Pressable>
            </View>
            {pendingPaymentsQuery.data!.slice(0, 3).map((sale: any) => (
              <View key={sale.id} style={dyn.appointmentCard}>
                <View style={[styles.statusBar, { backgroundColor: "#FF9800" }]} />
                <View style={styles.aptContent}>
                  <View style={styles.aptRow}>
                    <Text style={dyn.aptTime}>R$ {parseFloat(sale.total).toFixed(2)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: "#FF980022" }]}>
                      <Text style={[styles.statusText, { color: "#FF9800" }]}>Pendente</Text>
                    </View>
                  </View>
                  <Text style={dyn.aptBarber}>Pagamento Pendente</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Agenda do dia */}
        <View style={styles.sectionHeader}>
          <Text style={dyn.sectionTitle}>Agenda de Hoje</Text>
          <Pressable onPress={() => router.push("/admin/(tabs)/agenda" as any)}>
            <Text style={dyn.seeAll}>Ver tudo</Text>
          </Pressable>
        </View>

        {appointmentsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : appointments.length === 0 ? (
          <View style={dyn.emptyCard}>
            <Text style={dyn.emptyText}>Nenhum agendamento para hoje</Text>
          </View>
        ) : (
          appointments.slice(0, 5).map((apt) => {
            const status = STATUS_LABELS[apt.status] ?? { label: apt.status, color: colors.muted };
            return (
              <Pressable
                key={apt.id}
                style={({ pressed }) => [dyn.appointmentCard, pressed && { opacity: 0.75 }]}
                onPress={() => router.push("/admin/(tabs)/agenda" as any)}
              >
                <View style={[styles.statusBar, { backgroundColor: status.color }]} />
                <View style={styles.aptContent}>
                  <View style={styles.aptRow}>
                    <Text style={dyn.aptTime}>{apt.startTime} – {apt.endTime}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.color + "22" }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Text style={dyn.aptBarber}>{getBarberName(apt.barberId)}</Text>
                  {apt.notes ? <Text style={dyn.aptNotes}>{apt.notes}</Text> : null}
                </View>
              </Pressable>
            );
          })
        )}

        <View style={{ height: tabBarHeight }} />
      </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greetingRow:  { padding: 20, paddingTop: 16, paddingBottom: 8 },
  metricsGrid:  { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, marginBottom: 8 },
  metricIcon:   { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  sectionHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 16, marginBottom: 10 },
  quickActions: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, marginBottom: 4 },
  statusBar:    { width: 4 },
  aptContent:   { flex: 1, padding: 14 },
  aptRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  statusBadge:  { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:   { fontSize: 11, fontWeight: "600" },
  trialBanner:       { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#C9A84C15", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: "#C9A84C33" },
  trialBannerUrgent: { backgroundColor: "#F8717115", borderColor: "#F8717133" },
  trialBannerIcon:   { fontSize: 14 },
  trialBannerText:   { flex: 1, fontSize: 13, color: "#C9A84C", fontWeight: "600" },
  trialBannerTextUrgent: { color: "#F87171" },
  lowStockBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#1A0D00", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#F9730044" },
  lowStockIcon: { fontSize: 20 },
  lowStockTitle: { fontSize: 13, color: "#F97316", fontWeight: "700", marginBottom: 2 },
  lowStockSub: { fontSize: 11, color: "#9CA3AF" },
  lowStockArrow: { fontSize: 20, color: "#F97316", fontWeight: "700" },
});
