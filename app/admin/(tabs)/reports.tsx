import { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { AdminHeader } from "@/components/admin-header";
import { useBarberAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { ErrorBoundary } from "@/components/error-boundary";

type Period = "week" | "month" | "year";
type Tab = "financeiro" | "servicos" | "encomendas" | "barbeiros" | "inadimplencia" | "inativos";

const CAT_COLORS = ["#EF4444", "#F59E0B", "#6366F1", "#10B981", "#EC4899", "#14B8A6", "#8B5CF6", "#F97316"];

// Componente de linha do DRE
function DreRow({ label, value, change, color, bold, invertChange }: {
  label: string; value: number; change: number; color: string; bold?: boolean; invertChange?: boolean;
}) {
  // invertChange: para despesas, subir é ruim (vermelho)
  const isPositive = invertChange ? change <= 0 : change >= 0;
  const changeColor = isPositive ? "#4CAF50" : "#EF4444";
  const arrow = change >= 0 ? "↑" : "↓";
  return (
    <View style={dreRowStyles.row}>
      <Text style={[dreRowStyles.label, bold && dreRowStyles.bold]}>{label}</Text>
      <View style={dreRowStyles.right}>
        <Text style={[dreRowStyles.value, { color }, bold && dreRowStyles.bold]}>
          {formatCurrency(value)}
        </Text>
        {change !== 0 && (
          <Text style={[dreRowStyles.change, { color: changeColor }]}>
            {arrow} {Math.abs(change).toFixed(1)}%
          </Text>
        )}
      </View>
    </View>
  );
}
const dreRowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  label: { fontSize: 14, color: "#888880", flex: 1 },
  bold: { fontWeight: "700", color: "#F5F5F0", fontSize: 15 },
  right: { alignItems: "flex-end" },
  value: { fontSize: 14, fontWeight: "600" },
  change: { fontSize: 11, marginTop: 1 },
});

function formatCurrency(value: number): string {
  if (value == null || isNaN(value)) return "R$ 0,00";
  try {
    return "R$ " + value.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  } catch { return "R$ 0,00"; }
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function getDateRange(period: Period): { startDate: string; endDate: string } {
  const today = new Date();
  const end = toLocalDateStr(today);
  const start = new Date(today);
  if (period === "week") start.setDate(today.getDate() - 6);
  else if (period === "month") start.setDate(today.getDate() - 29);
  else start.setFullYear(today.getFullYear() - 1);
  return { startDate: toLocalDateStr(start), endDate: end };
}

// ─── Gráfico de barras (View-based, sem react-native-svg) ────────────────────
function BarChart({ labels, data }: { labels: string[]; data: number[] }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.filter(v => !isNaN(v) && v > 0), 1);
  return (
    <View style={{ width: "100%" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 3, paddingHorizontal: 4 }}>
        {data.map((val, i) => {
          const heightPct = Math.max(0, (val / maxVal) * 100);
          const isMax = val === maxVal;
          return (
            <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: 120 }}>
              {val > 0 && (
                <Text style={{ fontSize: 7, color: "#C9A84C88", marginBottom: 2, textAlign: "center" }} numberOfLines={1}>
                  {val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(0)}
                </Text>
              )}
              <View style={{
                width: "100%",
                height: heightPct * 0.9,
                backgroundColor: isMax ? "#C9A84C" : "#C9A84C77",
                borderRadius: 3,
                minHeight: val > 0 ? 3 : 0,
              }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 3, paddingHorizontal: 4, marginTop: 4 }}>
        {labels.map((label, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 8, color: "#666", textAlign: "center" }} numberOfLines={1}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
function ReportsScreenInner() {
  const colors = useColors();
  const styles = createStyles(colors);
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;
  const [period, setPeriod] = useState<Period>("month");
  const [activeTab, setActiveTab] = useState<Tab>("financeiro");
  const [exporting, setExporting] = useState(false);
  const [exportingOrders, setExportingOrders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const utils = trpc.useUtils();

  const onRefresh = async () => {
    setRefreshing(true);
    await utils.reports.revenue.invalidate().catch(() => {});
    await utils.reports.topServices.invalidate().catch(() => {});
    setRefreshing(false);
  };
  const dateRange = useMemo(() => getDateRange(period), [period]);
  const periodDays = period === "week" ? 7 : period === "month" ? 30 : 365;

  // ─── Queries ─────────────────────────────────────────────────────────────
  const revenueQuery = trpc.reports.revenue.useQuery(
    { period, tenantId },
    { enabled: !!tenantId && activeTab === "financeiro" }
  );
  const topServicesQuery = trpc.reports.topServices.useQuery(
    { ...dateRange, tenantId },
    { enabled: !!tenantId && activeTab === "servicos" }
  );
  const topClientsQuery = trpc.reports.topClients.useQuery(
    { ...dateRange, tenantId },
    { enabled: !!tenantId && activeTab === "servicos" }
  );
  const occupancyQuery = trpc.reports.barberOccupancy.useQuery(
    { ...dateRange, tenantId },
    { enabled: !!tenantId && activeTab === "barbeiros" }
  );
  const ordersSummaryQuery = trpc.reports.ordersSummary.useQuery(
    { tenantId, ...dateRange },
    { enabled: !!tenantId && activeTab === "encomendas" }
  );
  const ordersTimelineQuery = trpc.reports.ordersTimeline.useQuery(
    { tenantId, period },
    { enabled: !!tenantId && activeTab === "encomendas" }
  );
  const expensesBySupplierQuery = trpc.reports.expensesBySupplier.useQuery(
    { tenantId, ...dateRange },
    { enabled: !!tenantId && activeTab === "financeiro" }
  );
  const dreQuery = trpc.reports.dreComparative.useQuery(
    { tenantId, ...dateRange },
    { enabled: !!tenantId && activeTab === "financeiro" }
  );
  const expensesByCategoryQuery = trpc.reports.expensesByCategory.useQuery(
    { tenantId, ...dateRange },
    { enabled: !!tenantId && activeTab === "financeiro" }
  );
  const ticketAvgQuery = trpc.reports.ticketAvgTimeline.useQuery(
    { tenantId, period },
    { enabled: !!tenantId && activeTab === "financeiro" }
  );
  const projectionQuery = trpc.reports.revenueProjection.useQuery(
    { tenantId },
    { enabled: !!tenantId && activeTab === "financeiro" }
  );
  
  const exportPdfMutation = trpc.reports.exportPdf.useMutation();
  const exportOrdersPdfMutation = trpc.reports.exportOrdersPdf.useMutation();

  const revenue = revenueQuery.data;
  const topServices = topServicesQuery.data ?? [];
  const topClients = topClientsQuery.data ?? [];
  const occupancy = occupancyQuery.data ?? [];
  const ordersSummary = ordersSummaryQuery.data;
  const ordersTimeline = ordersTimelineQuery.data;
  const expensesBySupplier = expensesBySupplierQuery.data ?? [];
  const dre = dreQuery.data;
  const expensesByCategory = expensesByCategoryQuery.data ?? [];
  const ticketAvgTimeline = ticketAvgQuery.data;
  const projection = projectionQuery.data;

  const PERIODS: { key: Period; label: string }[] = [
    { key: "week", label: "7 dias" },
    { key: "month", label: "30 dias" },
    { key: "year", label: "12 meses" },
  ];

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: "financeiro", label: "Financeiro", emoji: "💰" },
    { key: "servicos", label: "Serviços", emoji: "✂️" },
    { key: "encomendas", label: "Encomendas", emoji: "📦" },
    { key: "barbeiros", label: "Barbeiros", emoji: "👤" },
    { key: "inadimplencia", label: "Inadimplência", emoji: "⚠️" },
    { key: "inativos", label: "Inativos", emoji: "👻" },
  ];

  const inactiveDays = 30;
  const inactiveClientsQuery = trpc.clients.inactive.useQuery(
    { tenantId: tenantId ?? 0, days: inactiveDays },
    { enabled: !!tenantId && activeTab === "inativos", retry: false }
  );

  const overdueQuery = trpc.asaasPayments.listOverdue.useQuery(
    { tenantId: tenantId ?? 0 },
    { enabled: !!tenantId && activeTab === "inadimplencia" }
  );

  async function handleExportCsv() {
    try {
      await Linking.openURL(`${process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://usebarberpro.com"}/admin/export/financeiro`);
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e?.message ?? "Falha na exportação");
    }
  }

  async function handleExportPdf() {
    if (exporting || !tenantId) return;
    setExporting(true);
    try {
      const result = await exportPdfMutation.mutateAsync({ ...dateRange, period, tenantId });
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
        await Linking.openURL(`${process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://usebarberpro.com"}/admin/export/financeiro`);
      }
    } catch (err: any) {
      Alert.alert("Erro ao exportar", err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportOrdersPdf() {
    if (exportingOrders || !tenantId) return;
    setExportingOrders(true);
    try {
      const result = await exportOrdersPdfMutation.mutateAsync({ tenantId, ...dateRange });
      if (!result.pdfBase64) throw new Error("PDF vazio");
      if (Platform.OS === "web") {
        const blob = new Blob([Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0))], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `encomendas-${dateRange.startDate}-${dateRange.endDate}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Linking.openURL(`${process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://usebarberpro.com"}/admin/export/financeiro`);
      }
    } catch (err: any) {
      Alert.alert("Erro ao exportar", err.message);
    } finally {
      setExportingOrders(false);
    }
  }

  // ─── Render por aba ───────────────────────────────────────────────────────

  function renderFinanceiro() {
    const isLoadingDre = dreQuery.isLoading;
    return (
      <>
        {/* ── DRE Simplificado com comparativo ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resultado do Período</Text>
          {isLoadingDre ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
          ) : dre ? (
            <>
              {/* Linha de receita */}
              <DreRow
                label="Receita Bruta"
                value={dre.revenue}
                change={dre.revenueChange}
                color="#4CAF50"
              />
              <DreRow
                label="Despesas"
                value={dre.expenses}
                change={dre.expensesChange}
                color="#EF4444"
                invertChange
              />
              <View style={styles.dreDivider} />
              <DreRow
                label="Lucro Líquido"
                value={dre.netProfit}
                change={dre.netProfitChange}
                color={dre.netProfit >= 0 ? "#C9A84C" : "#EF4444"}
                bold
              />
              {/* Margem e ticket médio */}
              <View style={styles.dreMetaRow}>
                <View style={styles.dreMetaBox}>
                  <Text style={styles.dreMetaLabel}>Margem</Text>
                  <Text style={[styles.dreMetaValue, { color: dre.margin >= 0 ? "#4CAF50" : "#EF4444" }]}>
                    {dre.margin.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.dreMetaBox}>
                  <Text style={styles.dreMetaLabel}>Ticket Médio</Text>
                  <Text style={styles.dreMetaValue}>{formatCurrency(dre.ticketAvg)}</Text>
                  <Text style={styles.dreMetaChange}>
                    {dre.ticketAvgChange >= 0 ? "↑" : "↓"} {Math.abs(dre.ticketAvgChange).toFixed(1)}% vs anterior
                  </Text>
                </View>
                <View style={styles.dreMetaBox}>
                  <Text style={styles.dreMetaLabel}>Vendas</Text>
                  <Text style={styles.dreMetaValue}>{dre.salesCount}</Text>
                  <Text style={styles.dreMetaChange}>vs {dre.prevSalesCount} anterior</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          )}
        </View>

        {/* ── Projeção de receita do mês ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Projeção do Mês</Text>
          {projectionQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
          ) : projection ? (
            <>
              {/* Barra de progresso do mês */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={styles.rankCount}>Dia {projection.dayOfMonth} de {projection.daysInMonth}</Text>
                  <Text style={styles.rankCount}>{projection.progressPct.toFixed(0)}% do mês</Text>
                </View>
                <View style={[styles.barBg, { height: 8 }]}>
                  <View style={[styles.barFill, { width: `${projection.progressPct}%` as any, height: 8, backgroundColor: "#6366F1" }]} />
                </View>
              </View>
              {/* KPIs de projeção */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={[styles.kpiBox, { borderColor: "#4CAF5033" }]}>
                  <Text style={styles.kpiLabel}>Acumulado</Text>
                  <Text style={[styles.kpiValue, { fontSize: 14, color: "#4CAF50" }]}>{formatCurrency(projection.revenueSoFar)}</Text>
                </View>
                <View style={[styles.kpiBox, { borderColor: "#C9A84C33" }]}>
                  <Text style={styles.kpiLabel}>Projeção</Text>
                  <Text style={[styles.kpiValue, { fontSize: 14 }]}>{formatCurrency(projection.projected)}</Text>
                </View>
                <View style={[styles.kpiBox, { borderColor: "#6366F133" }]}>
                  <Text style={styles.kpiLabel}>Média/Dia</Text>
                  <Text style={[styles.kpiValue, { fontSize: 14, color: "#6366F1" }]}>{formatCurrency(projection.dailyAvg)}</Text>
                </View>
              </View>
              {/* Comparativo com mês anterior */}
              <View style={styles.projCompRow}>
                <Text style={styles.rankCount}>Mês anterior: {formatCurrency(projection.revenuePrevMonth)}</Text>
                <Text style={[styles.rankCount, { color: projection.projectionVsPrev >= 0 ? "#4CAF50" : "#EF4444", fontWeight: "700" }]}>
                  {projection.projectionVsPrev >= 0 ? "↑" : "↓"} {Math.abs(projection.projectionVsPrev).toFixed(1)}%
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          )}
        </View>

        {/* ── Faturamento (gráfico) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Evolução do Faturamento</Text>
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
          ) : (
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          )}
        </View>

        {/* ── Ticket Médio (gráfico de tendência) ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ticket Médio por Período</Text>
          {ticketAvgQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
          ) : ticketAvgTimeline && ticketAvgTimeline.data.some(v => v > 0) ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart labels={ticketAvgTimeline.labels} data={ticketAvgTimeline.data} />
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          )}
        </View>

        {/* ── Despesas por Categoria ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Despesas por Categoria</Text>
          {expensesByCategoryQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
          ) : expensesByCategory.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma despesa no período</Text>
          ) : (
            expensesByCategory.map((cat, i) => (
              <View key={cat.category} style={styles.catRow}>
                <View style={styles.catLabelRow}>
                  <Text style={styles.rankName} numberOfLines={1}>{cat.category}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.rankValue, { color: "#EF4444" }]}>{formatCurrency(cat.total)}</Text>
                    <Text style={styles.rankCount}>{cat.pct.toFixed(1)}% · {cat.count} lançamento{cat.count !== 1 ? "s" : ""}</Text>
                  </View>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${cat.pct}%` as any, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Reposições por Fornecedor ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reposições por Fornecedor</Text>
          {expensesBySupplierQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
          ) : expensesBySupplier.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma reposição no período</Text>
          ) : (
            expensesBySupplier.map((sup, i) => {
              const maxVal = expensesBySupplier[0]?.totalReplenishments ?? 1;
              const pct = maxVal > 0 ? (sup.totalReplenishments / maxVal) * 100 : 0;
              return (
                <View key={sup.id} style={styles.rankRow}>
                  <Text style={styles.rankPos}>#{i + 1}</Text>
                  <View style={styles.rankInfo}>
                    <View style={styles.rankLabelRow}>
                      <Text style={styles.rankName} numberOfLines={1}>{sup.name}</Text>
                      <Text style={styles.rankValue}>{formatCurrency(sup.totalReplenishments)}</Text>
                    </View>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: "#6366F1" }]} />
                    </View>
                    <Text style={styles.rankCount}>{sup.replenishmentCount} reposição{sup.replenishmentCount !== 1 ? "ões" : ""}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Botões de exportação */}
        <View style={styles.exportRow}>
          <Pressable
            style={({ pressed }) => [styles.exportBtn, { backgroundColor: "#1A1A1A", opacity: pressed ? 0.7 : 1 }]}
            onPress={handleExportCsv}
          >
            <Text style={styles.exportBtnText}>📥 Exportar CSV</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.exportBtn, { backgroundColor: "#C9A84C22", borderColor: "#C9A84C", opacity: pressed || exporting ? 0.7 : 1 }]}
            onPress={handleExportPdf}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#C9A84C" />
            ) : (
              <Text style={[styles.exportBtnText, { color: "#C9A84C" }]}>📄 Exportar PDF</Text>
            )}
          </Pressable>
        </View>
      </>
    );
  }

  function renderServicos() {
    return (
      <>
        {/* Ranking de serviços */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Serviços Mais Vendidos</Text>
          {topServicesQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
          ) : topServices.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum serviço vendido no período</Text>
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
      </>
    );
  }

  function renderEncomendas() {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Encomendas de Produtos</Text>
            {ordersSummary && ordersSummary.totalRevenue > 0 && (
              <Text style={styles.cardTotal}>{formatCurrency(ordersSummary.totalRevenue)}</Text>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [{
              backgroundColor: "#C9A84C",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              flexDirection: "row" as const,
              alignItems: "center" as const,
              gap: 4,
              opacity: pressed || exportingOrders ? 0.7 : 1,
            }]}
            onPress={handleExportOrdersPdf}
            disabled={exportingOrders}
          >
            {exportingOrders ? (
              <ActivityIndicator size="small" color="#0A0A0A" />
            ) : (
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#0A0A0A" }}>PDF</Text>
            )}
          </Pressable>
        </View>

        {/* Gráfico de evolução */}
        {ordersTimelineQuery.isLoading ? (
          <ActivityIndicator color="#C9A84C" style={{ marginVertical: 12 }} />
        ) : ordersTimeline && ordersTimeline.total > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <BarChart labels={ordersTimeline.labels} data={ordersTimeline.data} />
          </ScrollView>
        ) : null}

        {ordersSummaryQuery.isLoading ? (
          <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
        ) : ordersSummary ? (
          <>
            {/* KPIs */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiValue}>{ordersSummary.total}</Text>
                <Text style={styles.kpiLabel}>Total</Text>
              </View>
              <View style={[styles.kpiBox, { borderColor: "#10B98133" }]}>
                <Text style={[styles.kpiValue, { color: "#10B981" }]}>{ordersSummary.delivered}</Text>
                <Text style={styles.kpiLabel}>Entregues</Text>
              </View>
              <View style={[styles.kpiBox, { borderColor: "#F59E0B33" }]}>
                <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>{ordersSummary.pending}</Text>
                <Text style={styles.kpiLabel}>Em Aberto</Text>
              </View>
              <View style={[styles.kpiBox, { borderColor: "#EF444433" }]}>
                <Text style={[styles.kpiValue, { color: "#EF4444" }]}>{ordersSummary.cancelled}</Text>
                <Text style={styles.kpiLabel}>Cancelados</Text>
              </View>
            </View>
            {/* Produtos mais encomendados */}
            {ordersSummary.topProducts.length > 0 && (
              <>
                <Text style={[styles.cardTitle, { fontSize: 13, marginBottom: 8 }]}>
                  Produtos Mais Encomendados
                </Text>
                {ordersSummary.topProducts.map((p, i) => {
                  const maxCount = ordersSummary.topProducts[0]?.count ?? 1;
                  const pct = (p.count / maxCount) * 100;
                  return (
                    <View key={p.name} style={styles.rankRow}>
                      <Text style={styles.rankPos}>#{i + 1}</Text>
                      <View style={styles.rankInfo}>
                        <View style={styles.rankLabelRow}>
                          <Text style={styles.rankName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.rankValue}>{p.count}x</Text>
                        </View>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: "#C9A84C" }]} />
                        </View>
                        {p.revenue > 0 && (
                          <Text style={styles.rankCount}>{formatCurrency(p.revenue)} em receita</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>Nenhuma encomenda no período</Text>
        )}
      </View>
    );
  }

  function renderBarbeiros() {
    return (
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
                  <View style={styles.rankLabelRow}>
                    <Text style={styles.rankName} numberOfLines={1}>{b.name}</Text>
                    <Text style={styles.rankValue}>{formatCurrency(b.revenue)}</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${revPct}%` as any, backgroundColor: "#C9A84C" }]} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 3 }}>
                    <Text style={[styles.rankCount, { flex: 1 }]}>Taxa de ocupação</Text>
                    <Text style={{ fontSize: 12, color: occColor, fontWeight: "700" }}>{occPct}%</Text>
                  </View>
                  <View style={[styles.barBg, { height: 6 }]}>
                    <View style={[styles.barFill, { width: `${occPct}%` as any, height: 6, backgroundColor: occColor }]} />
                  </View>
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
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A84C" colors={["#C9A84C"]} />}>
        {/* Header */}
        <AdminHeader title="Relatórios" />

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

        {/* Abas */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContainer}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tabBtn,
                activeTab === tab.key && styles.tabBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={styles.tabEmoji}>{tab.emoji}</Text>
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Conteúdo da aba ativa */}
        <View style={{ paddingBottom: 32 }}>
          {activeTab === "financeiro" && renderFinanceiro()}
          {activeTab === "servicos" && renderServicos()}
          {activeTab === "encomendas" && renderEncomendas()}
          {activeTab === "barbeiros" && renderBarbeiros()}
          {activeTab === "inativos" && (
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#F0EEE8" }}>Clientes sem visitar há mais de {inactiveDays} dias</Text>
              </View>
              {inactiveClientsQuery.isLoading ? (
                <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
              ) : !inactiveClientsQuery.data?.length ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🎉</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#F0EEE8", marginBottom: 8 }}>Nenhum cliente inativo</Text>
                  <Text style={{ fontSize: 13, color: "#666", textAlign: "center" }}>Todos os clientes visitaram nos últimos {inactiveDays} dias.</Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>{inactiveClientsQuery.data?.length ?? 0} cliente(s) sem visitar há mais de {inactiveDays} dias</Text>
                  {(inactiveClientsQuery.data ?? []).map((client: any) => (
                    <View key={client.id} style={{ backgroundColor: "#141414", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "center" }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#C9A84C22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: "900", color: "#C9A84C" }}>{client.name?.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#F0EEE8", marginBottom: 2 }}>{client.name}</Text>
                        <Text style={{ fontSize: 12, color: "#666" }}>
                          {client.lastVisit
                            ? `Última visita: ${new Date(client.lastVisit).toLocaleDateString("pt-BR")}`
                            : "Nunca visitou"}
                          {client.daysSince != null ? ` (${client.daysSince} dias atrás)` : ""}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: "#F59E0B22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 11, color: "#F59E0B", fontWeight: "700" }}>👻 Inativo</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {activeTab === "inadimplencia" && (
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 4 }}>⚠️ Cobranças Vencidas</Text>
              <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 16 }}>Clientes com pagamentos Asaas em atraso</Text>
              {overdueQuery.isLoading ? (
                <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
              ) : !overdueQuery.data || overdueQuery.data.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🎉</Text>
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Nenhuma cobrança vencida</Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Todos os pagamentos estão em dia!</Text>
                </View>
              ) : (
                (overdueQuery.data as any[]).map((pmt: any) => {
                  const daysOverdue = pmt.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(pmt.dueDate).getTime()) / 86400000)) : 0;
                  const waMsg = encodeURIComponent(`Olá ${pmt.clientName}! Identificamos uma cobrança vencida de R$ ${pmt.amount?.toFixed(2).replace(".", ",")}. Regularize pelo link: ${pmt.invoiceUrl ?? ""}`);
                  const waPhone = (pmt.clientPhone ?? "").replace(/\D/g, "");
                  return (
                    <View key={pmt.id} style={{ backgroundColor: "#1A1A1A", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EF444433" }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{pmt.clientName}</Text>
                        <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: 15 }}>R$ {pmt.amount?.toFixed(2).replace(".", ",")}</Text>
                      </View>
                      <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 8 }}>
                        Venceu em {pmt.dueDate ? new Date(pmt.dueDate).toLocaleDateString("pt-BR") : "—"} · {daysOverdue} dia(s) em atraso
                      </Text>
                      {waPhone ? (
                        <Pressable
                          onPress={() => Linking.openURL(`https://wa.me/55${waPhone}?text=${waMsg}`)}
                          style={{ backgroundColor: "#064E3B", borderRadius: 8, padding: 10, alignItems: "center" }}
                        >
                          <Text style={{ color: "#4ADE80", fontWeight: "700", fontSize: 13 }}>📲 Cobrar via WhatsApp</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  periodRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: "#C9A84C22",
    borderColor: "#C9A84C",
  },
  periodLabel: { fontSize: 13, color: c.muted, fontWeight: "600" },
  periodLabelActive: { color: "#C9A84C" },
  tabsScroll: { marginBottom: 12 },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabBtnActive: {
    backgroundColor: "#C9A84C22",
    borderColor: "#C9A84C",
  },
  tabEmoji: { fontSize: 14 },
  tabLabel: { fontSize: 13, color: c.muted, fontWeight: "600" },
  tabLabelActive: { color: "#C9A84C" },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.foreground,
    marginBottom: 12,
  },
  cardTotal: { fontSize: 18, fontWeight: "800", color: "#C9A84C" },
  emptyText: { color: c.muted, fontSize: 13, textAlign: "center", paddingVertical: 12 },
  rankRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  rankPos: { fontSize: 13, fontWeight: "700", color: c.muted, width: 28 },
  rankInfo: { flex: 1 },
  rankLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  rankName: { fontSize: 14, fontWeight: "600", color: c.foreground, flex: 1, marginRight: 8 },
  rankValue: { fontSize: 14, fontWeight: "700", color: "#C9A84C" },
  barBg: { height: 6, backgroundColor: c.border, borderRadius: 3, marginBottom: 3 },
  barFill: { height: 6, backgroundColor: "#C9A84C", borderRadius: 3 },
  rankCount: { fontSize: 11, color: c.muted },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.background,
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
  clientName: { fontSize: 14, fontWeight: "600", color: c.foreground },
  clientSub: { fontSize: 12, color: c.muted, marginTop: 2 },
  clientRevenue: { alignItems: "flex-end" },
  clientRevenueText: { fontSize: 14, fontWeight: "700", color: "#4CAF50" },
  clientTicket: { fontSize: 10, color: c.muted, marginTop: 2 },
  kpiBox: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C9A84C33",
    padding: 10,
    alignItems: "center",
  },
  kpiValue: { fontSize: 20, fontWeight: "800", color: "#C9A84C" },
  kpiLabel: { fontSize: 10, color: "#888", marginTop: 2, textAlign: "center" },
  exportRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  exportBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnText: { fontSize: 13, fontWeight: "600", color: c.muted },
  dreDivider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
  dreMetaRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  dreMetaBox: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    padding: 10,
    alignItems: "center",
  },
  dreMetaLabel: { fontSize: 10, color: c.muted, marginBottom: 4, textAlign: "center" },
  dreMetaValue: { fontSize: 14, fontWeight: "700", color: c.foreground },
  dreMetaChange: { fontSize: 10, color: c.muted, marginTop: 2, textAlign: "center" },
  projCompRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  catRow: { marginBottom: 12 },
  catLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
});
}

export default function ReportsScreen() {
  return (
    <ErrorBoundary screenName="Relatórios">
      <ReportsScreenInner />
    </ErrorBoundary>
  );
}
