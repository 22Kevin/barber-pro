import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Todos os clientes",
  inactive_30: "Inativos 30 dias",
  inactive_60: "Inativos 60 dias",
  birthday_month: "Aniversariantes",
};

export default function PromotionReportScreen() {
  const colors = useColors();
  const reportQuery = trpc.promotionConversion.report.useQuery();

  const data = reportQuery.data ?? [];
  const totalSent = data.reduce((s, p) => s + (p.recipientCount ?? 0), 0);
  const totalConversions = data.reduce((s, p) => s + ((p as any).conversions ?? 0), 0);
  const avgRate = data.length > 0
    ? Math.round(data.reduce((s, p) => s + ((p as any).conversionRate ?? 0), 0) / data.length)
    : 0;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Conversão de Promoções" />

      {reportQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <>
              {/* Cards de resumo */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.summaryValue, { color: colors.primary }]}>{data.length}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>Campanhas</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{totalSent}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>Enviados</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.summaryValue, { color: "#22C55E" }]}>{totalConversions}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>Agendamentos</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.summaryValue, { color: "#F59E0B" }]}>{avgRate}%</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>Taxa média</Text>
                </View>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.muted }]}>CAMPANHAS ENVIADAS</Text>

              {data.length === 0 && (
                <View style={styles.emptyState}>
                  <IconSymbol name="megaphone.fill" size={48} color={colors.muted} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma campanha enviada</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                    Envie promoções pela tela de Promoções para ver as métricas de conversão aqui.
                  </Text>
                </View>
              )}
            </>
          }
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const conversions = (item as any).conversions ?? 0;
            const rate = (item as any).conversionRate ?? 0;
            const sentDate = item.sentAt
              ? new Date(item.sentAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—";

            const rateColor = rate >= 20 ? "#22C55E" : rate >= 10 ? "#F59E0B" : "#EF4444";

            return (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
                    <IconSymbol name="megaphone.fill" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.cardDate, { color: colors.muted }]}>
                      {AUDIENCE_LABELS[item.targetAudience] ?? item.targetAudience} · {sentDate}
                    </Text>
                  </View>
                </View>

                {/* Barra de conversão */}
                <View style={[styles.progressBg, { backgroundColor: colors.background }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(rate, 100)}%`, backgroundColor: rateColor },
                    ]}
                  />
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: colors.foreground }]}>{item.recipientCount}</Text>
                    <Text style={[styles.metricLabel, { color: colors.muted }]}>Enviados</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: "#22C55E" }]}>{conversions}</Text>
                    <Text style={[styles.metricLabel, { color: colors.muted }]}>Agendamentos</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: rateColor }]}>{rate}%</Text>
                    <Text style={[styles.metricLabel, { color: colors.muted }]}>Conversão</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  summaryCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 22, fontWeight: "800" },
  summaryLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  emptyState: { alignItems: "center", paddingTop: 40, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardDate: { fontSize: 12, marginTop: 2 },
  progressBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  metricsRow: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 18, fontWeight: "800" },
  metricLabel: { fontSize: 11, fontWeight: "600" },
});
