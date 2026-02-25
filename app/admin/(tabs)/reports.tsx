import { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Rect, Line, Text as SvgText, G } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { AdminHeader } from "@/components/admin-header";

type Period = "week" | "month" | "year";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getDateRange(period: Period): { startDate: string; endDate: string } {
  const today = new Date();
  const end = today.toISOString().split("T")[0];
  const start = new Date(today);
  if (period === "week") start.setDate(today.getDate() - 6);
  else if (period === "month") start.setDate(today.getDate() - 29);
  else start.setFullYear(today.getFullYear() - 1);
  return { startDate: start.toISOString().split("T")[0], endDate: end };
}

// ─── Gráfico de barras SVG ────────────────────────────────────────────────────
function BarChart({ labels, data }: { labels: string[]; data: number[] }) {
  const W = 340;
  const H = 160;
  const PAD = { top: 10, right: 10, bottom: 28, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data, 1);
  const barW = chartW / data.length - 6;

  return (
    <Svg width={W} height={H}>
      {/* Y axis lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = PAD.top + chartH * (1 - frac);
        return (
          <G key={frac}>
            <Line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#2A2A2A" strokeWidth={1} />
            <SvgText x={PAD.left - 4} y={y + 4} fontSize={9} fill="#555" textAnchor="end">
              {frac === 0 ? "0" : `${(maxVal * frac / 1000).toFixed(0)}k`}
            </SvgText>
          </G>
        );
      })}
      {/* Bars */}
      {data.map((val, i) => {
        const barH = (val / maxVal) * chartH;
        const x = PAD.left + i * (chartW / data.length) + 3;
        const y = PAD.top + chartH - barH;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={3} fill="#C9A84C" opacity={0.85} />
            <SvgText
              x={x + barW / 2}
              y={H - PAD.bottom + 14}
              fontSize={9}
              fill="#888880"
              textAnchor="middle"
            >
              {labels[i]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>("month");
  const [exporting, setExporting] = useState(false);
  const dateRange = useMemo(() => getDateRange(period), [period]);

  const revenueQuery = trpc.reports.revenue.useQuery({ period });
  const topServicesQuery = trpc.reports.topServices.useQuery(dateRange);
  const topClientsQuery = trpc.reports.topClients.useQuery(dateRange);
  const occupancyQuery = trpc.reports.barberOccupancy.useQuery(dateRange);
  const exportPdfMutation = trpc.reports.exportPdf.useMutation();

  const revenue = revenueQuery.data;
  const topServices = topServicesQuery.data ?? [];
  const topClients = topClientsQuery.data ?? [];
  const occupancy = occupancyQuery.data ?? [];

  const PERIODS: { key: Period; label: string }[] = [
    { key: "week", label: "7 dias" },
    { key: "month", label: "30 dias" },
    { key: "year", label: "12 meses" },
  ];

  async function handleExportPdf() {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportPdfMutation.mutateAsync({ ...dateRange, period });
      if (!result.pdfBase64) throw new Error("PDF vazio");
      if (Platform.OS === "web") {
        const blob = new Blob([Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0))], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `relatorio-${dateRange.startDate}-${dateRange.endDate}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.cacheDirectory}relatorio-${dateRange.startDate}.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, result.pdfBase64, { encoding: FileSystem.EncodingType.Base64 });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, { mimeType: "application/pdf", dialogTitle: "Exportar Relatório" });
        } else {
          Alert.alert("PDF salvo", `Arquivo salvo em: ${fileUri}`);
        }
      }
    } catch (err: any) {
      Alert.alert("Erro ao exportar", err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <AdminHeader
          title="Relatórios"
          rightElement={
            <Pressable
              style={({ pressed }) => [{
                backgroundColor: "#C9A84C",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                opacity: pressed || exporting ? 0.7 : 1,
              }]}
              onPress={handleExportPdf}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#0A0A0A" />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#0A0A0A" }}>Exportar PDF</Text>
              )}
            </Pressable>
          }
        />

        {/* Seletor de período */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              style={({ pressed }) => [
                styles.periodBtn,
                period === p.key && styles.periodBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodLabel, period === p.key && styles.periodLabelActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Faturamento */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Faturamento</Text>
            {revenue && (
              <Text style={styles.cardTotal}>{formatCurrency(revenue.totalRevenue)}</Text>
            )}
          </View>
          {revenueQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
          ) : revenue ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart labels={revenue.labels} data={revenue.data} />
            </ScrollView>
          ) : null}
        </View>

        {/* Ranking de serviços */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Serviços Mais Vendidos</Text>
          {topServicesQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
          ) : topServices.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          ) : (
            topServices.map((svc, i) => {
              const maxRev = topServices[0]?.revenue ?? 1;
              const pct = (svc.revenue / maxRev) * 100;
              return (
                <View key={svc.name} style={styles.rankRow}>
                  <Text style={styles.rankPos}>#{i + 1}</Text>
                  <View style={styles.rankInfo}>
                    <View style={styles.rankLabelRow}>
                      <Text style={styles.rankName} numberOfLines={1}>{svc.name}</Text>
                      <Text style={styles.rankValue}>{formatCurrency(svc.revenue)}</Text>
                    </View>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${pct}%` as any }]} />
                    </View>
                    <Text style={styles.rankCount}>{svc.count}x realizados</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Clientes VIP */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Clientes com Maior Ticket</Text>
          {topClientsQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
          ) : topClients.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          ) : (
            topClients.map((client, i) => (
              <View key={client.clientId} style={styles.clientRow}>
                <View style={styles.clientRank}>
                  <Text style={styles.clientRankText}>#{i + 1}</Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
                  <Text style={styles.clientSub}>{client.count} visita{client.count !== 1 ? "s" : ""}</Text>
                </View>
                <View style={styles.clientRevenue}>
                  <Text style={styles.clientRevenueText}>{formatCurrency(client.revenue)}</Text>
                  <Text style={styles.clientTicket}>
                    ticket médio {formatCurrency(client.revenue / client.count)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Ocupação dos barbeiros */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Desempenho por Barbeiro</Text>
          {occupancyQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
          ) : occupancy.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          ) : (
            (occupancy as any[]).map((b: any, i: number) => {
              const maxRev = (occupancy as any[])[0]?.revenue ?? 1;
              const revPct = maxRev > 0 ? (b.revenue / maxRev) * 100 : 0;
              const occPct: number = b.occupancyPct ?? 0;
              const occColor = occPct >= 70 ? "#4CAF50" : occPct >= 40 ? "#F59E0B" : "#EF4444";
              return (
                <View key={b.barberId} style={[styles.rankRow, { marginBottom: 20, alignItems: "flex-start" }]}>
                  <Text style={[styles.rankPos, { marginTop: 2 }]}>#{i + 1}</Text>
                  <View style={[styles.rankInfo, { flex: 1 }]}>
                    {/* Nome e receita */}
                    <View style={styles.rankLabelRow}>
                      <Text style={styles.rankName} numberOfLines={1}>{b.name}</Text>
                      <Text style={styles.rankValue}>{formatCurrency(b.revenue)}</Text>
                    </View>
                    {/* Barra de receita */}
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${revPct}%` as any, backgroundColor: "#C9A84C" }]} />
                    </View>
                    {/* Taxa de ocupação */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 3 }}>
                      <Text style={[styles.rankCount, { flex: 1 }]}>Taxa de ocupação</Text>
                      <Text style={{ fontSize: 12, color: occColor, fontWeight: "700" }}>{occPct}%</Text>
                    </View>
                    <View style={[styles.barBg, { height: 6 }]}>
                      <View style={[styles.barFill, { width: `${occPct}%` as any, height: 6, backgroundColor: occColor }]} />
                    </View>
                    {/* Breakdown de status */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CAF50" }} />
                        <Text style={styles.rankCount}>{b.completed ?? 0} concluídos</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
                        <Text style={styles.rankCount}>{b.cancelled ?? 0} cancelados</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B" }} />
                        <Text style={styles.rankCount}>{b.noShow ?? 0} não compareceu</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, paddingTop: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "800", color: "#F5F5F0" },
  periodRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: "#C9A84C22",
    borderColor: "#C9A84C",
  },
  periodLabel: { fontSize: 13, color: "#888880", fontWeight: "600" },
  periodLabelActive: { color: "#C9A84C" },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F5F5F0",
    marginBottom: 12,
  },
  cardTotal: { fontSize: 18, fontWeight: "800", color: "#C9A84C" },
  emptyText: { color: "#555", fontSize: 13, textAlign: "center", paddingVertical: 12 },
  rankRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  rankPos: { fontSize: 13, fontWeight: "700", color: "#555", width: 28 },
  rankInfo: { flex: 1 },
  rankLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  rankName: { fontSize: 14, fontWeight: "600", color: "#F5F5F0", flex: 1, marginRight: 8 },
  rankValue: { fontSize: 14, fontWeight: "700", color: "#C9A84C" },
  barBg: { height: 6, backgroundColor: "#2A2A2A", borderRadius: 3, marginBottom: 3 },
  barFill: { height: 6, backgroundColor: "#C9A84C", borderRadius: 3 },
  rankCount: { fontSize: 11, color: "#555" },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
  },
  clientRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#C9A84C22",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  clientRankText: { fontSize: 12, fontWeight: "700", color: "#C9A84C" },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: "600", color: "#F5F5F0" },
  clientSub: { fontSize: 12, color: "#555", marginTop: 2 },
  clientRevenue: { alignItems: "flex-end" },
  clientRevenueText: { fontSize: 14, fontWeight: "700", color: "#4CAF50" },
  clientTicket: { fontSize: 10, color: "#555", marginTop: 2 },
});
