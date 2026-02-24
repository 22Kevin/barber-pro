import { useCallback, useState } from "react";
import {
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getTodayString() {
  return new Date().toISOString().split("T")[0];
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
  const today = getTodayString();
  const [refreshing, setRefreshing] = useState(false);

  const statsQuery = trpc.dashboard.stats.useQuery({ date: today });
  const appointmentsQuery = trpc.appointments.allByDate.useQuery({ date: today });
  const barbersQuery = trpc.barbers.list.useQuery();
  const pendingPaymentsQuery = trpc.payments.pendingList.useQuery();

  const utils = trpc.useUtils();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      utils.dashboard.stats.invalidate(),
      utils.appointments.allByDate.invalidate(),
      utils.payments.pendingList.invalidate(),
    ]);
    setRefreshing(false);
  }, [utils]);

  const stats = statsQuery.data;
  const appointments = appointmentsQuery.data ?? [];
  const barbers = barbersQuery.data ?? [];

  const getBarberName = (id: number) => barbers.find(b => b.id === id)?.name ?? "—";

  const handleLogout = async () => {
    await logout();
    router.replace("/admin/login" as any);
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Dashboard" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A84C" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Saudação */}
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Olá, {barber?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.date}>{formatDatePT(today)} — Hoje</Text>
        </View>

        {/* Métricas */}
        {statsQuery.isLoading ? (
          <ActivityIndicator color="#C9A84C" style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.metricsGrid}>
            <MetricCard icon="calendar" label="Agendamentos" value={String(stats?.appointmentsToday ?? 0)} color="#C9A84C" />
            <MetricCard icon="dollarsign.circle.fill" label="Receita Hoje" value={formatCurrency(stats?.revenueToday ?? 0)} color="#4CAF50" />
            <MetricCard icon="person.2.fill" label="Clientes" value={String(stats?.clientsToday ?? 0)} color="#2196F3" />
            <MetricCard icon="clock.fill" label="Pendentes" value={String(stats?.pendingAppointments ?? 0)} color="#FF9800" />
          </View>
        )}

        {/* Ações rápidas */}
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.quickActions}>
          <QuickAction icon="calendar.badge.plus" label="Novo Agendamento" onPress={() => router.push("/admin/(tabs)/agenda" as any)} />
          <QuickAction icon="person.badge.plus" label="Novo Cliente" onPress={() => router.push("/admin/(tabs)/clients" as any)} />
          <QuickAction icon="dollarsign.circle.fill" label="Nova Venda" onPress={() => router.push("/admin/(tabs)/financial" as any)} />
          <QuickAction icon="scissors" label="Serviços" onPress={() => router.push("/admin/(tabs)/services" as any)} />
        </View>

        {/* Pagamentos Pendentes MP */}
        {(pendingPaymentsQuery.data?.length ?? 0) > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⏳ Aguardando Pagamento</Text>
              <Pressable onPress={() => router.push("/admin/(tabs)/financial" as any)}>
                <Text style={styles.seeAll}>Ver todos ({pendingPaymentsQuery.data!.length})</Text>
              </Pressable>
            </View>
            {pendingPaymentsQuery.data!.slice(0, 3).map((sale: any) => (
              <View key={sale.id} style={styles.appointmentCard}>
                <View style={[styles.statusBar, { backgroundColor: "#FF9800" }]} />
                <View style={styles.aptContent}>
                  <View style={styles.aptRow}>
                    <Text style={styles.aptTime}>R$ {parseFloat(sale.total).toFixed(2)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: "#FF980022" }]}>
                      <Text style={[styles.statusText, { color: "#FF9800" }]}>Pendente</Text>
                    </View>
                  </View>
                  <Text style={styles.aptBarber}>Mercado Pago</Text>
                  {sale.mercadoPagoPaymentId && (
                    <Text style={styles.aptNotes}>ID: {sale.mercadoPagoPaymentId}</Text>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Agenda do dia */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Agenda de Hoje</Text>
          <Pressable onPress={() => router.push("/admin/(tabs)/agenda" as any)}>
            <Text style={styles.seeAll}>Ver tudo</Text>
          </Pressable>
        </View>

        {appointmentsQuery.isLoading ? (
          <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
        ) : appointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhum agendamento para hoje</Text>
          </View>
        ) : (
          appointments.slice(0, 5).map((apt) => {
            const status = STATUS_LABELS[apt.status] ?? { label: apt.status, color: "#888880" };
            return (
              <View key={apt.id} style={styles.appointmentCard}>
                <View style={[styles.statusBar, { backgroundColor: status.color }]} />
                <View style={styles.aptContent}>
                  <View style={styles.aptRow}>
                    <Text style={styles.aptTime}>{apt.startTime} – {apt.endTime}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.color + "22" }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.aptBarber}>{getBarberName(apt.barberId)}</Text>
                  {apt.notes ? <Text style={styles.aptNotes}>{apt.notes}</Text> : null}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

function MetricCard({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: color + "22" }]}>
        <IconSymbol name={icon} size={22} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickActionBtn, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={styles.quickActionIcon}>
        <IconSymbol name={icon} size={22} color="#C9A84C" />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  greetingRow: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: { fontSize: 22, fontWeight: "700", color: "#F5F5F0" },
  date: { fontSize: 13, color: "#888880", marginTop: 2 },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#141414",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "flex-start",
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  metricValue: { fontSize: 20, fontWeight: "800", color: "#F5F5F0", marginBottom: 2 },
  metricLabel: { fontSize: 12, color: "#888880" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#F5F5F0",
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },
  seeAll: { fontSize: 13, color: "#C9A84C" },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 4,
  },
  quickActionBtn: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#141414",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#C9A84C22",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickActionLabel: { fontSize: 12, color: "#F5F5F0", fontWeight: "600", textAlign: "center" },
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: "#141414",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  emptyText: { color: "#888880", fontSize: 14 },
  appointmentCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    flexDirection: "row",
    overflow: "hidden",
  },
  statusBar: { width: 4 },
  aptContent: { flex: 1, padding: 14 },
  aptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  aptTime: { fontSize: 15, fontWeight: "700", color: "#F5F5F0" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  aptBarber: { fontSize: 13, color: "#888880" },
  aptNotes: { fontSize: 12, color: "#555", marginTop: 4, fontStyle: "italic" },
});
