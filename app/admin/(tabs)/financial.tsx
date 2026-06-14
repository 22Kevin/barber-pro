import { useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
} from "react-native";
import { useScreenFadeIn } from "@/hooks/useScreenFadeIn";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBarberAuth } from "@/lib/auth-context";
import { AdminHeader } from "@/components/admin-header";
import { HeaderBranchTitle } from "@/components/BranchSelector";
import { trpc } from "@/lib/trpc";
import {} from "react-native-safe-area-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { useColors } from "@/hooks/use-colors";
function toLocalDate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}


type Tab = "overview" | "sales" | "expenses" | "online";

const PAYMENT_METHODS = [
  { key: "cash",         label: "Dinheiro",       icon: "banknote.fill" as const },
  { key: "credit_card",  label: "Crédito",         icon: "creditcard.fill" as const },
  { key: "debit_card",   label: "Débito",          icon: "creditcard.fill" as const },
  { key: "pix",          label: "PIX",             icon: "checkmark.circle.fill" as const },
  { key: "asaas",        label: "Online (Asaas)", icon: "dollarsign.circle.fill" as const },
];

const EXPENSE_CATEGORIES = [
  "Aluguel","Produtos","Equipamentos","Marketing","Salários","Energia","Internet","Outros"
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: toLocalDate(start),
    end: toLocalDate(end),
    label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

export default function FinancialScreen() {
  const { fadeStyle } = useScreenFadeIn();
  const colors = useColors();
  const styles = createStyles(colors);
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [pmtStatusFilter, setPmtStatusFilter] = useState("all");
  const [monthOffset, setMonthOffset] = useState(0);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Sale form
  const [saleDescription, setSaleDescription] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [salePayment, setSalePayment] = useState("cash");
  const [saleType, setSaleType] = useState<"service" | "product">("service");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);

  // Expense form
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Outros");

  const range = getMonthRange(monthOffset);
  const utils = trpc.useUtils();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); await utils.invalidate(); setRefreshing(false); };

  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true, tenantId });
  const productsQuery = trpc.products.list.useQuery({ activeOnly: true, tenantId });
  const salesQuery = trpc.sales.byDateRange.useQuery({ startDate: range.start, endDate: range.end, tenantId: barber?.tenantId ?? null });
  const expensesQuery = trpc.expenses.byDateRange.useQuery({ startDate: range.start, endDate: range.end, tenantId: barber?.tenantId ?? null });
  const statsQuery = trpc.dashboard.stats.useQuery({ date: toLocalDate(new Date()) });

  const createSaleMutation = trpc.sales.create.useMutation({
    onSuccess: () => {
      utils.sales.byDateRange.invalidate();
      utils.dashboard.stats.invalidate();
      closeSaleModal();
    },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const createExpenseMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      utils.expenses.byDateRange.invalidate();
      utils.dashboard.stats.invalidate();
      setShowExpenseModal(false);
      setExpenseDescription(""); setExpenseAmount(""); setExpenseCategory("Outros");
    },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  function closeSaleModal() {
    setShowSaleModal(false);
    setSaleDescription(""); setSaleAmount(""); setSalePayment("cash"); setSaleType("service");
    setSelectedItemId(null); setShowItemPicker(false);
  }

  function handleSelectItem(item: { id: number; name: string; price: string }) {
    setSelectedItemId(item.id);
    setSaleDescription(item.name);
    setSaleAmount(parseFloat(item.price).toFixed(2).replace(".", ","));
    setShowItemPicker(false);
  }

  function handleCreateSale() {
    const amount = parseFloat(saleAmount.replace(",", "."));
    if (!saleDescription.trim()) { Alert.alert("Atenção", "Informe a descrição."); return; }
    if (isNaN(amount) || amount <= 0) { Alert.alert("Atenção", "Informe um valor válido."); return; }
    createSaleMutation.mutate({
      barberId: barber?.id ?? 0,
      subtotal: amount.toFixed(2),
      discount: "0",
      total: amount.toFixed(2),
      paymentMethod: salePayment as any,
      paymentStatus: "paid",
      notes: `${saleType === "service" ? "Serviço" : "Produto"}: ${saleDescription.trim()}`,
      items: [{
        itemType: saleType,
        itemId: 0,
        itemName: saleDescription.trim(),
        quantity: 1,
        unitPrice: amount.toFixed(2),
        total: amount.toFixed(2),
      }],
    });
  }

  function handleCreateExpense() {
    const amount = parseFloat(expenseAmount.replace(",", "."));
    if (!expenseDescription.trim()) { Alert.alert("Atenção", "Informe a descrição."); return; }
    if (isNaN(amount) || amount <= 0) { Alert.alert("Atenção", "Informe um valor válido."); return; }
    createExpenseMutation.mutate({
      description: expenseDescription.trim(),
      amount: amount.toFixed(2),
      category: expenseCategory,
      date: toLocalDate(new Date()),
    });
  }

  const onlinePaymentsQuery = trpc.asaasPayments.listByTenant.useQuery(
    { tenantId: tenantId ?? 0, startDate: range.start, endDate: range.end, status: pmtStatusFilter === "all" ? undefined : pmtStatusFilter },
    { enabled: !!tenantId && activeTab === "online" }
  );
  const cancelChargeMutation = trpc.asaasPayments.cancelCharge.useMutation({
    onSuccess: () => { utils.asaasPayments.listByTenant.invalidate(); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const sales = salesQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  const totalRevenue = sales.reduce((sum: number, s: any) => sum + parseFloat(s.total ?? "0"), 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount ?? "0"), 0);
  const profit = totalRevenue - totalExpenses;
  const profitColor = profit >= 0 ? "#4CAF50" : "#F44336";

  const paymentBreakdown = PAYMENT_METHODS.map(pm => ({
    ...pm,
    total: sales.filter((s: any) => s.paymentMethod === pm.key).reduce((sum: number, s: any) => sum + parseFloat(s.total ?? "0"), 0),
  })).filter(pm => pm.total > 0);

  return (
    <Animated.View style={[{ flex: 1 }, fadeStyle]}>
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader
        titleNode={<HeaderBranchTitle />}
        rightElement={
          <View style={styles.headerActions}>
            <Pressable style={({ pressed }) => [styles.expenseBtn, pressed && { opacity: 0.8 }]} onPress={() => setShowExpenseModal(true)}>
              <IconSymbol name="minus.circle.fill" size={16} color="#F44336" />
              <Text style={styles.expenseBtnText}>Despesa</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={() => setShowSaleModal(true)}>
              <IconSymbol name="plus" size={18} color="#0A0A0A" />
              <Text style={styles.addBtnText}>Venda</Text>
            </Pressable>
          </View>
        }
      />

      {/* Seletor de mês */}
      <View style={styles.monthSelector}>
        <Pressable onPress={() => setMonthOffset(o => o - 1)} style={styles.monthArrow}>
          <IconSymbol name="chevron.left" size={20} color="#C9A84C" />
        </Pressable>
        <Text style={styles.monthLabel}>{range.label}</Text>
        <Pressable onPress={() => setMonthOffset(o => Math.min(o + 1, 0))} style={styles.monthArrow}>
          <IconSymbol name="chevron.right" size={20} color={monthOffset < 0 ? "#C9A84C" : "#2A2A2A"} />
        </Pressable>
      </View>

      {/* Tabs — segmented control style */}
      <View style={styles.tabsWrapper}>
        {([
          { key: "overview",  label: "Resumo",     icon: "📊" },
          { key: "sales",     label: "Receitas",   icon: "💰" },
          { key: "expenses",  label: "Despesas",   icon: "📉" },
          { key: "online",    label: "Online",     icon: "💳" },
        ] as { key: Tab; label: string; icon: string }[]).map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarHeight }}>
        {/* Overview */}
        {activeTab === "overview" && (
          <>
            {salesQuery.isLoading || expensesQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
            ) : (
              <>
                {/* Lucro líquido */}
                <View style={[styles.profitCard]}>
                  <Text style={styles.profitLabel}>Lucro Líquido</Text>
                  <Text style={[styles.profitValue, { color: profitColor }]}>{formatCurrency(profit)}</Text>
                  <View style={styles.profitBar}>
                    <View style={[styles.profitBarFill, {
                      width: `${Math.min(100, totalRevenue > 0 ? Math.max(0, (profit / totalRevenue) * 100) : 0)}%`,
                      backgroundColor: profitColor,
                    }]} />
                  </View>
                </View>

                <View style={styles.metricsGrid}>
                  <MetricCard label="Receita Total" value={formatCurrency(totalRevenue)} color="#4CAF50" icon="chart.line.uptrend.xyaxis" />
                  <MetricCard label="Despesas" value={formatCurrency(totalExpenses)} color="#F44336" icon="minus.circle.fill" />
                  <MetricCard label="Vendas" value={String(sales.length)} color="#C9A84C" icon="cart.fill" />
                  <MetricCard label="Ticket Médio" value={formatCurrency(sales.length > 0 ? totalRevenue / sales.length : 0)} color="#2196F3" icon="dollarsign.circle.fill" />
                </View>

                {paymentBreakdown.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Por Forma de Pagamento</Text>
                    {paymentBreakdown.map(pm => (
                      <View key={pm.key} style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>{pm.label}</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(pm.total)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Sales */}
        {activeTab === "sales" && (
          <>
            <Text style={styles.sectionTitle}>Receitas — {sales.length} registro(s)</Text>
            {salesQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginTop: 20 }} />
            ) : sales.length === 0 ? (
              <EmptyState icon="dollarsign.circle.fill" text="Nenhuma receita registrada" />
            ) : (
              (sales as any[]).map((sale: any) => (
                <View key={sale.id} style={styles.transactionCard}>
                  <View style={[styles.transactionIcon, { backgroundColor: "#4CAF5022" }]}>
                    <IconSymbol name="chart.line.uptrend.xyaxis" size={18} color="#4CAF50" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transactionDesc}>{sale.notes ?? "Venda"}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={styles.transactionMeta}>
                        {PAYMENT_METHODS.find(p => p.key === sale.paymentMethod)?.label ?? sale.paymentMethod} · {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("pt-BR") : "—"}
                      </Text>
                      {(sale.paymentMethod === "asaas") && (
                        <View style={{ backgroundColor: sale.paymentStatus === "paid" ? "#009EE322" : "#F5A62322", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: sale.paymentStatus === "paid" ? "#009EE3" : "#F5A623", fontSize: 10, fontWeight: "700" }}>
                            {sale.paymentStatus === "paid" ? "✓ Pago" : sale.paymentStatus === "pending" ? "⏳ Pendente" : sale.paymentStatus}
                          </Text>
                        </View>
                      )}
                    </View>

                  </View>
                  <Text style={styles.transactionAmount}>+{formatCurrency(parseFloat(sale.total ?? "0"))}</Text>
                </View>
              ))
            )}
          </>
        )}

        {/* Expenses */}
        {activeTab === "expenses" && (
          <>
            <Text style={styles.sectionTitle}>Despesas — {expenses.length} registro(s)</Text>
            {expensesQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginTop: 20 }} />
            ) : expenses.length === 0 ? (
              <EmptyState icon="minus.circle.fill" text="Nenhuma despesa registrada" />
            ) : (
              (expenses as any[]).map((exp: any) => (
                <View key={exp.id} style={styles.transactionCard}>
                  <View style={[styles.transactionIcon, { backgroundColor: "#F4433622" }]}>
                    <IconSymbol name="minus.circle.fill" size={18} color="#F44336" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transactionDesc}>{exp.description}</Text>
                    <Text style={styles.transactionMeta}>{exp.category} · {exp.date}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, { color: "#F44336" }]}>-{formatCurrency(parseFloat(exp.amount ?? "0"))}</Text>
                </View>
              ))
            )}
          </>
        )}

        {/* Pagamentos Online (Asaas) */}
        {activeTab === "online" && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {/* Filtro de status */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                {[
                  { key: "all",       label: "Todos",     color: "#888" },
                  { key: "RECEIVED",  label: "Pago",      color: "#22C55E" },
                  { key: "PENDING",   label: "Pendente",  color: "#F59E0B" },
                  { key: "OVERDUE",   label: "Vencido",   color: "#EF4444" },
                  { key: "CANCELLED", label: "Cancelado", color: "#6B7280" },
                ].map(opt => {
                  const isActive = pmtStatusFilter === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setPmtStatusFilter(opt.key)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 7,
                        borderRadius: 20, borderWidth: 1.5,
                        backgroundColor: isActive ? opt.color + "22" : "#141414",
                        borderColor: isActive ? opt.color : "#2A2A2A",
                      }}
                    >
                      <Text style={{
                        fontSize: 13, fontWeight: "700",
                        color: isActive ? opt.color : "#666",
                      }}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {onlinePaymentsQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
            ) : !onlinePaymentsQuery.data || onlinePaymentsQuery.data.length === 0 ? (
              <EmptyState icon="creditcard.fill" text="Nenhum pagamento online encontrado" />
            ) : (
              <>
                {/* Cards de resumo */}
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                  <View style={[styles.transactionCard, { flex: 1, backgroundColor: "#064E3B22", borderColor: "#4CAF5044" }]}>
                    <Text style={{ color: "#9CA3AF", fontSize: 11, marginBottom: 4 }}>Total Recebido</Text>
                    <Text style={{ color: "#4CAF50", fontWeight: "800", fontSize: 16 }}>
                      {formatCurrency((onlinePaymentsQuery.data as any[]).filter((p: any) => p.status === "RECEIVED" || p.status === "CONFIRMED").reduce((s: number, p: any) => s + p.amount, 0))}
                    </Text>
                  </View>
                  <View style={[styles.transactionCard, { flex: 1, backgroundColor: "#78350F22", borderColor: "#F59E0B44" }]}>
                    <Text style={{ color: "#9CA3AF", fontSize: 11, marginBottom: 4 }}>Pendente</Text>
                    <Text style={{ color: "#F59E0B", fontWeight: "800", fontSize: 16 }}>
                      {formatCurrency((onlinePaymentsQuery.data as any[]).filter((p: any) => p.status === "PENDING").reduce((s: number, p: any) => s + p.amount, 0))}
                    </Text>
                  </View>
                </View>

                {/* Lista de cobranças */}
                {(onlinePaymentsQuery.data as any[]).map((pmt: any) => {
                  const statusColor = pmt.status === "RECEIVED" || pmt.status === "CONFIRMED" ? "#4CAF50" : pmt.status === "PENDING" ? "#F59E0B" : pmt.status === "OVERDUE" ? "#EF4444" : "#6B7280";
                  const statusLabel = pmt.status === "RECEIVED" || pmt.status === "CONFIRMED" ? "Pago" : pmt.status === "PENDING" ? "Pendente" : pmt.status === "OVERDUE" ? "Vencido" : "Cancelado";
                  const methodLabel = pmt.billingType === "PIX" ? "Pix" : pmt.billingType === "CREDIT_CARD" ? "Cartão" : pmt.billingType;
                  return (
                    <View key={pmt.id} style={[styles.transactionCard, { marginBottom: 10 }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <Text style={styles.transactionDesc} numberOfLines={1}>{pmt.clientName}</Text>
                          <Text style={{ color: statusColor, fontSize: 12, fontWeight: "700" }}>{statusLabel}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={styles.transactionMeta}>{methodLabel} · {pmt.createdAt ? new Date(pmt.createdAt).toLocaleDateString("pt-BR") : "—"}</Text>
                          <Text style={{ color: "#EAB308", fontWeight: "800", fontSize: 15 }}>{formatCurrency(pmt.amount)}</Text>
                        </View>
                        {(pmt.status === "PENDING" || pmt.status === "OVERDUE") && (
                          <Pressable
                            onPress={() => Alert.alert("Cancelar cobrança?", "Esta ação não pode ser desfeita.", [
                              { text: "Cancelar", style: "cancel" },
                              { text: "Confirmar", style: "destructive", onPress: () => cancelChargeMutation.mutate({ asaasPaymentId: pmt.asaasPaymentId, tenantId: tenantId ?? 0 }) },
                            ])}
                            style={{ marginTop: 8, backgroundColor: "#1F2937", borderRadius: 8, padding: 8, alignItems: "center" }}
                          >
                            <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "700" }}>✖ Cancelar cobrança</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Nova Venda */}
      <Modal visible={showSaleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Registrar Venda</Text>
                <Pressable onPress={closeSaleModal}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Tipo</Text>
                <View style={styles.typeRow}>
                  {(["service", "product"] as const).map(t => (
                    <Pressable key={t} style={[styles.typeChip, saleType === t && styles.typeChipActive]} onPress={() => { setSaleType(t); setSelectedItemId(null); setSaleDescription(""); setSaleAmount(""); setShowItemPicker(false); }}>
                      <Text style={[styles.typeChipText, saleType === t && styles.typeChipTextActive]}>
                        {t === "service" ? "Serviço" : "Produto"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{saleType === "service" ? "Serviço" : "Produto"} *</Text>
                {/* Seletor de itens cadastrados */}
                <Pressable
                  style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                  onPress={() => setShowItemPicker(v => !v)}
                >
                  <Text style={{ color: saleDescription ? styles.input.color : "#555", fontSize: 15, flex: 1 }}>
                    {saleDescription || (saleType === "service" ? "Selecione um serviço..." : "Selecione um produto...")}
                  </Text>
                  <IconSymbol name={showItemPicker ? "chevron.right" : "chevron.right"} size={16} color="#888880" />
                </Pressable>
                {showItemPicker && (
                  <View style={styles.itemPickerList}>
                    {(saleType === "service" ? (servicesQuery.data ?? []) : (productsQuery.data ?? [])).length === 0 ? (
                      <Text style={{ color: "#888880", fontSize: 13, padding: 12, textAlign: "center" }}>
                        {saleType === "service" ? "Nenhum serviço cadastrado" : "Nenhum produto cadastrado"}
                      </Text>
                    ) : (
                      (saleType === "service" ? (servicesQuery.data ?? []) : (productsQuery.data ?? [])).map((item: any) => (
                        <Pressable
                          key={item.id}
                          style={[styles.itemPickerRow, selectedItemId === item.id && styles.itemPickerRowActive]}
                          onPress={() => handleSelectItem(item)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemPickerName}>{item.name}</Text>
                            {saleType === "service" && item.durationMinutes && (
                              <Text style={styles.itemPickerMeta}>{item.durationMinutes} min</Text>
                            )}
                          </View>
                          <Text style={styles.itemPickerPrice}>R$ {parseFloat(item.price).toFixed(2).replace(".", ",")}</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}

                <Text style={styles.fieldLabel}>Valor (R$) *</Text>
                <TextInput style={styles.input} value={saleAmount} onChangeText={setSaleAmount} placeholder="0,00" placeholderTextColor="#555" keyboardType="decimal-pad" />

                <Text style={styles.fieldLabel}>Forma de Pagamento</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {PAYMENT_METHODS.map(pm => (
                      <Pressable key={pm.key} style={[styles.paymentChip, salePayment === pm.key && styles.paymentChipActive]} onPress={() => setSalePayment(pm.key)}>
                        <IconSymbol name={pm.icon} size={16} color={salePayment === pm.key ? "#C9A84C" : "#888880"} />
                        <Text style={[styles.paymentChipText, salePayment === pm.key && styles.paymentChipTextActive]}>{pm.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleCreateSale} disabled={createSaleMutation.isPending}>
                  {createSaleMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>REGISTRAR VENDA</Text>}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Nova Despesa */}
      <Modal visible={showExpenseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Registrar Despesa</Text>
                <Pressable onPress={() => setShowExpenseModal(false)}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Descrição *</Text>
                <TextInput style={styles.input} value={expenseDescription} onChangeText={setExpenseDescription} placeholder="Ex: Compra de produtos" placeholderTextColor="#555" />

                <Text style={styles.fieldLabel}>Valor (R$) *</Text>
                <TextInput style={styles.input} value={expenseAmount} onChangeText={setExpenseAmount} placeholder="0,00" placeholderTextColor="#555" keyboardType="decimal-pad" />

                <Text style={styles.fieldLabel}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <Pressable key={cat} style={[styles.paymentChip, expenseCategory === cat && styles.paymentChipActive]} onPress={() => setExpenseCategory(cat)}>
                        <Text style={[styles.paymentChipText, expenseCategory === cat && styles.paymentChipTextActive]}>{cat}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Pressable style={({ pressed }) => [styles.saveBtn, { backgroundColor: "#F44336" }, pressed && { opacity: 0.8 }]} onPress={handleCreateExpense} disabled={createExpenseMutation.isPending}>
                  {createExpenseMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: "#fff" }]}>REGISTRAR DESPESA</Text>}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenContainer>
    </Animated.View>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: any }) {
  const colors = useColors();
  const styles = createStyles(colors);
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: color + "22" }]}>
        <IconSymbol name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, text }: { icon: any; text: string }) {
  const colors = useColors();
  const styles = createStyles(colors);
  return (
    <View style={styles.emptyCard}>
      <IconSymbol name={icon} size={36} color="#2A2A2A" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: c.foreground },
  headerActions: { flexDirection: "row", gap: 8 },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  addBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 13 },
  expenseBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#F4433622", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 4, borderWidth: 1, borderColor: "#F4433644" },
  expenseBtnText: { color: "#F44336", fontWeight: "700", fontSize: 13 },
  monthSelector: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 },
  monthArrow: { padding: 8 },
  monthLabel: { fontSize: 15, fontWeight: "700", color: c.foreground, textTransform: "capitalize" },
  tabsWrapper: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#0F0F0B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 4,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 2,
  },
  tabItemActive: {
    backgroundColor: "#C9A84C",
  },
  tabIcon: { fontSize: 14 },
  tabLabel: { fontSize: 10, color: "#666", fontWeight: "700", letterSpacing: 0.3 },
  tabLabelActive: { color: "#0A0A0A" },
  profitCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: c.surface, borderRadius: 14, padding: 20, borderWidth: 0.5, borderColor: "rgba(201,168,76,0.15)" },
  profitLabel: { fontSize: 13, color: c.muted, marginBottom: 4 },
  profitValue: { fontSize: 34, fontWeight: "800", marginBottom: 12 },
  profitBar: { height: 4, backgroundColor: c.border, borderRadius: 2, overflow: "hidden" },
  profitBarFill: { height: "100%", borderRadius: 2 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, marginBottom: 8 },
  metricCard: { flex: 1, minWidth: "45%", backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: "rgba(201,168,76,0.15)" },
  metricIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  metricValue: { fontSize: 18, fontWeight: "800", color: c.foreground, marginBottom: 2 },
  metricLabel: { fontSize: 12, color: c.muted },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.foreground, paddingHorizontal: 20, marginTop: 16, marginBottom: 10 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  breakdownLabel: { fontSize: 14, color: c.muted },
  breakdownValue: { fontSize: 14, color: c.foreground, fontWeight: "600" },
  transactionCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: "rgba(201,168,76,0.15)", gap: 12 },
  transactionIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  transactionDesc: { fontSize: 14, fontWeight: "600", color: c.foreground, marginBottom: 2 },
  transactionMeta: { fontSize: 12, color: c.muted },
  transactionAmount: { fontSize: 15, fontWeight: "700", color: "#4CAF50" },
  emptyCard: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: c.muted, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "85%", borderWidth: 1, borderColor: c.border },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: c.foreground },
  fieldLabel: { fontSize: 13, color: c.muted, marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.foreground, marginBottom: 14 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#C9A84C", alignItems: "center" },
  typeChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  typeChipText: { fontSize: 14, color: "#C9A84C", fontWeight: "600" },
  typeChipTextActive: { color: "#0A0A0A" },
  paymentChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: c.background, borderWidth: 1, borderColor: c.border },
  paymentChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  paymentChipText: { fontSize: 12, color: c.muted, fontWeight: "600" },
  paymentChipTextActive: { color: "#C9A84C" },
  itemPickerList: { borderWidth: 1, borderColor: c.border, borderRadius: 10, marginBottom: 12, overflow: "hidden" },
  itemPickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  itemPickerRowActive: { backgroundColor: "#C9A84C22" },
  itemPickerName: { fontSize: 14, color: c.foreground, fontWeight: "600" },
  itemPickerMeta: { fontSize: 12, color: c.muted, marginTop: 2 },
  itemPickerPrice: { fontSize: 14, color: "#C9A84C", fontWeight: "700" },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
});
}
