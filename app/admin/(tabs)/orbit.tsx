import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Image,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";

type FilterPeriod = "today" | "week" | "month";
type FilterStatus = "all" | "pending" | "converted";

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  today: "Hoje",
  week: "7 dias",
  month: "30 dias",
};

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: "Todos",
  pending: "Não convertidos",
  converted: "Convertidos",
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function timeSince(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
}

export default function OrbitScreen() {
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;

  const [period, setPeriod] = useState<FilterPeriod>("week");
  const [status, setStatus] = useState<FilterStatus>("all");

  const statsQuery = trpc.orbit.stats.useQuery({ tenantId }, { enabled: tenantId > 0 });
  const listQuery = trpc.orbit.list.useQuery(
    {
      tenantId,
      filter: period,
      converted: status === "all" ? undefined : status === "converted",
    },
    { enabled: tenantId > 0 }
  );

  const stats = statsQuery.data;
  const leads = listQuery.data ?? [];

  const handleWhatsApp = (phone: string | null | undefined, name: string | null | undefined) => {
    if (!phone) return;
    const clean = phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${name ?? ""}! Vi que você visitou nossa barbearia. Que tal agendar um horário? 😊`
    );
    Linking.openURL(`https://wa.me/55${clean}?text=${msg}`);
  };

  const renderLead = ({ item }: { item: any }) => {
    const isConverted = !!item.convertedAt;
    return (
      <View style={[styles.card, isConverted && styles.cardConverted]}>
        <View style={styles.cardLeft}>
          {item.clientAvatarUrl ? (
            <Image source={{ uri: item.clientAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.clientName ?? "Cliente"}
            </Text>
            {isConverted ? (
              <View style={styles.convertedBadge}>
                <Text style={styles.convertedBadgeText}>✓ Convertido</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Em órbita</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardMeta}>
            {item.source === "geo" ? "📍 Geolocalização" : "🔗 Link direto"} · {timeSince(item.loginAt)}
          </Text>
          {item.clientPhone ? (
            <Text style={styles.cardPhone}>{item.clientPhone}</Text>
          ) : null}
        </View>
        {!isConverted && item.clientPhone ? (
          <TouchableOpacity
            style={styles.waBtn}
            onPress={() => handleWhatsApp(item.clientPhone, item.clientName)}
            activeOpacity={0.8}
          >
            <Text style={styles.waBtnText}>💬</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="bg-background">
      <AdminHeader title="Clientes em Órbita" />
      {/* Subtítulo */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>Visitantes que ainda não agendaram</Text>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.todayCount}</Text>
            <Text style={styles.statLabel}>Hoje</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.newLast24h}</Text>
            <Text style={styles.statLabel}>Últ. 24h</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={[styles.statValue, styles.statValueHighlight]}>{stats.conversionRate}%</Text>
            <Text style={[styles.statLabel, styles.statLabelHighlight]}>Conversão</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.weekConverted}</Text>
            <Text style={styles.statLabel}>Convertidos</Text>
          </View>
        </View>
      )}

      {/* Filtros de período */}
      <View style={styles.filterRow}>
        {(Object.keys(PERIOD_LABELS) as FilterPeriod[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.filterBtn, period === p && styles.filterBtnActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterBtnText, period === p && styles.filterBtnTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtros de status */}
      <View style={styles.filterRow}>
        {(Object.keys(STATUS_LABELS) as FilterStatus[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, status === s && styles.filterBtnActive]}
            onPress={() => setStatus(s)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterBtnText, status === s && styles.filterBtnTextActive]}>
              {STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {listQuery.isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#EAB308" />
        </View>
      ) : leads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛸</Text>
          <Text style={styles.emptyTitle}>Nenhum cliente em órbita</Text>
          <Text style={styles.emptyText}>
            Quando clientes visitarem sua página sem agendar, eles aparecerão aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLead}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#EAB308",
  },
  subtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  statCardHighlight: {
    backgroundColor: "#EAB308",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F9FAFB",
  },
  statValueHighlight: {
    color: "#0A0A0A",
  },
  statLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statLabelHighlight: {
    color: "#0A0A0A",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 6,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#1F2937",
    alignItems: "center",
  },
  filterBtnActive: {
    backgroundColor: "#374151",
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  filterBtnText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  filterBtnTextActive: {
    color: "#EAB308",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#C9A84C",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  cardConverted: {
    borderColor: "#16A34A30",
    backgroundColor: "#16A34A08",
  },
  cardLeft: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#374151",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 20,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clientName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F9FAFB",
    flex: 1,
  },
  convertedBadge: {
    backgroundColor: "#16A34A20",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  convertedBadgeText: {
    fontSize: 10,
    color: "#4ADE80",
    fontWeight: "700",
  },
  pendingBadge: {
    backgroundColor: "#EAB30820",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 10,
    color: "#EAB308",
    fontWeight: "700",
  },
  cardMeta: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  cardPhone: {
    fontSize: 12,
    color: "#6B7280",
  },
  waBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  waBtnText: {
    fontSize: 18,
  },
});
