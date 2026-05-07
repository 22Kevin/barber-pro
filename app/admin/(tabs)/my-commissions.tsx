import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useBarberAuth } from "@/lib/auth-context";

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function MyCommissionsScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear] = useState(now.getFullYear());

  const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${lastDay}`;

  const summaryQuery = trpc.commissions.summary.useQuery(
    { startDate, endDate },
    { enabled: !!barber }
  );

  // Filtrar apenas as comissões do barbeiro logado
  const myData = (summaryQuery.data ?? []).find((b) => b.barberId === barber?.id);
  const entries = myData?.entries ?? [];

  const months = Array.from({ length: 12 }, (_, i) => i);

  const dyn = StyleSheet.create({
    statCard: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      alignItems: "center",
      gap: 4,
    },
    statLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
    statValue: { fontSize: 20, fontWeight: "800" },
    entryCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    entryIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    entryDesc: { fontSize: 14, fontWeight: "600", color: colors.foreground },
    entryDate: { fontSize: 12, color: colors.muted, marginTop: 2 },
    entryGross: { fontSize: 13, color: colors.muted, textAlign: "right" },
    entryComm: { fontSize: 15, fontWeight: "700", color: colors.primary, textAlign: "right" },
  });

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Minhas Comissões" />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Seletor de mês */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          {months.map((m) => (
            <Pressable
              key={m}
              style={({ pressed }) => [
                styles.monthBtn,
                {
                  backgroundColor: selectedMonth === m ? "#C9A84C" : "#1A1A1A",
                  borderColor: selectedMonth === m ? "#C9A84C" : "#C9A84C",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => setSelectedMonth(m)}
            >
              <Text style={{ color: selectedMonth === m ? "#0A0A0A" : "#C9A84C", fontWeight: "700", fontSize: 13 }}>
                {MONTH_SHORT[m]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Título do mês */}
        <View style={[styles.monthHeader, { borderColor: colors.border }]}>
          <Text style={[styles.monthTitle, { color: colors.foreground }]}>
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </Text>
          {myData && (
            <View style={[styles.rateBadge, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.rateBadgeText, { color: colors.primary }]}>
                {myData.commissionRate}% comissão
              </Text>
            </View>
          )}
        </View>

        {summaryQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        ) : !myData || myData.entriesCount === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="chart.bar" size={48} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sem comissões neste mês</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Nenhum atendimento registrado em {MONTH_NAMES[selectedMonth].toLowerCase()}.
            </Text>
          </View>
        ) : (
          <>
            {/* Cards de resumo */}
            <View style={styles.statsRow}>
              <View style={[dyn.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[dyn.statLabel, { color: colors.muted }]}>Atendimentos</Text>
                <Text style={[dyn.statValue, { color: colors.foreground }]}>{myData.entriesCount}</Text>
              </View>
              <View style={[dyn.statCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
                <Text style={[dyn.statLabel, { color: colors.primary }]}>A Receber</Text>
                <Text style={[dyn.statValue, { color: colors.primary }]}>{fmt(myData.totalCommission)}</Text>
              </View>
            </View>

            <View style={[styles.grossCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.grossLabel, { color: colors.muted }]}>Total bruto gerado</Text>
                <Text style={[styles.grossValue, { color: colors.foreground }]}>{fmt(myData.totalGross)}</Text>
              </View>
              <View style={styles.grossDivider} />
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={[styles.grossLabel, { color: colors.muted }]}>Ticket médio</Text>
                <Text style={[styles.grossValue, { color: colors.foreground }]}>
                  {fmt(myData.entriesCount > 0 ? myData.totalGross / myData.entriesCount : 0)}
                </Text>
              </View>
            </View>

            {/* Lista de atendimentos */}
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>DETALHAMENTO</Text>
            {entries.map((entry: any) => {
              const dateStr = entry.date ? new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
              return (
                <View key={entry.id} style={dyn.entryCard}>
                  <View style={dyn.entryIcon}>
                    <IconSymbol
                      name={entry.type === "product" ? "cube.box.fill" : "scissors"}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dyn.entryDesc} numberOfLines={1}>{entry.description ?? "Atendimento"}</Text>
                    <Text style={dyn.entryDate}>{dateStr}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={dyn.entryGross}>{fmt(parseFloat(entry.grossValue))}</Text>
                    <Text style={dyn.entryComm}>+{fmt(parseFloat(entry.commissionValue))}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  monthBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, marginRight: 8 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  monthTitle: { fontSize: 17, fontWeight: "700" },
  rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rateBadgeText: { fontSize: 12, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 10, margin: 16, marginBottom: 10 },
  grossCard: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 16 },
  grossLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  grossValue: { fontSize: 18, fontWeight: "800" },
  grossDivider: { width: 1, height: "100%", backgroundColor: "#E5E7EB", marginHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, paddingHorizontal: 16, marginBottom: 8 },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
});
