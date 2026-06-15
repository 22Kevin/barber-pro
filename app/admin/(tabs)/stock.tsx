import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { HeaderBranchTitle } from "@/components/BranchSelector";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { exportCsv } from "@/hooks/use-csv-export";
import { useBarberAuth } from "@/lib/auth-context";
import { useBranch } from "@/components/BranchSelector";


function toLocalDate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

type MovementType = "in" | "out" | "adjustment" | "transfer";

const TYPE_LABELS: Record<MovementType, string> = {
  in: "Entrada",
  out: "Saída",
  adjustment: "Ajuste",
  transfer: "Transferência",
};

const TYPE_COLORS: Record<MovementType, string> = {
  in: "#22C55E",
  out: "#EF4444",
  adjustment: "#F59E0B",
  transfer: "#C9A84C",
};

function today() {
  return toLocalDate(new Date());
}

import { FeatureGate } from "@/components/feature-gate";

function StockScreenInner() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const { current } = useBranch();
  const tenantId = current?.id ?? barber?.tenantId ?? undefined;
  const utils = trpc.useUtils();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); await utils.invalidate(); setRefreshing(false); };

  const exportStockQuery = trpc.export.estoqueCsv.useQuery(
    { tenantId },
    { enabled: false }
  );

  async function handleExportCsv() {
    try {
      const result = await exportStockQuery.refetch();
      if (result.data) {
        await exportCsv(result.data, "estoque.csv");
      }
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e?.message ?? "Falha na exportação");
    }
  }

  const [filterType, setFilterType] = useState<"all" | "sale" | "internal">("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [movType, setMovType] = useState<MovementType>("in");
  const [movQty, setMovQty] = useState("1");
  const [movReason, setMovReason] = useState("");
  const [movSupplierId, setMovSupplierId] = useState<number | null>(null);
  const [targetBranchId, setTargetBranchId] = useState<number | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const suppliersQuery = trpc.suppliers.list.useQuery(
    { tenantId: tenantId ?? 0 },
    { enabled: (tenantId ?? 0) > 0 }
  );
  const suppliersList = (suppliersQuery.data ?? []) as Array<{ id: number; name: string; phone: string | null }>;

  const branchesQuery = trpc.branches.list.useQuery(
    { tenantId: tenantId ?? 0 },
    { enabled: (tenantId ?? 0) > 0 }
  );
  const branchData = branchesQuery.data;
  const networkBranches = branchData?.show ? branchData.branches : [];
  const isStudio = branchData?.show ?? false;

  const transferMutation = trpc.branches.transfer.useMutation({
    onSuccess: (data) => {
      utils.stock.list.invalidate();
      setShowMovementModal(false);
      setMovQty("1"); setMovReason(""); setTargetBranchId(null); setMovType("in");
      Alert.alert("Transferência realizada!", `${data.transferred}x ${data.productName} transferido com sucesso.`);
    },
    onError: (e) => Alert.alert("Erro na transferência", e.message),
  });

  const syncMutation = trpc.branches.syncCatalog.useMutation({
    onSuccess: (data) => {
      utils.stock.list.invalidate();
      setSyncLoading(false);
      Alert.alert("Sincronização concluída!", `${data.syncedServices} serviços, ${data.syncedProducts} produtos, ${data.syncedSuppliers} fornecedores sincronizados.`);
    },
    onError: (e) => { setSyncLoading(false); Alert.alert("Erro", e.message); },
  });

  async function handleSyncCatalog() {
    if (!branchData?.show) return;
    const matrixId = branchData.matrixId;
    const targetId = branchData.isMatrix ? null : tenantId;
    if (!targetId || !matrixId) {
      Alert.alert("Atenção", "Sincronização disponível apenas dentro de uma filial.");
      return;
    }
    setSyncLoading(true);
    syncMutation.mutate({ matrixId, targetBranchId: targetId! });
  }

  const stockQuery = trpc.stock.list.useQuery({ tenantId });
  const movementsQuery = trpc.stock.movements.useQuery(
    { productId: selectedProduct?.id ?? 0 },
    { enabled: !!selectedProduct && showHistoryModal }
  );
  const avgQuery = trpc.stock.consumptionAverage.useQuery(
    { productId: selectedProduct?.id ?? 0 },
    { enabled: !!selectedProduct && showHistoryModal }
  );

  const addMovementMutation = trpc.stock.addMovement.useMutation({
    onSuccess: () => {
      utils.stock.list.invalidate();
      setShowMovementModal(false);
      setMovQty("1");
      setMovReason("");
      setMovSupplierId(null);
      setTargetBranchId(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const allProducts = stockQuery.data ?? [];
  const filtered = filterType === "all"
    ? allProducts
    : allProducts.filter((p: any) => p.productType === filterType);

  const lowStockCount = allProducts.filter((p: any) => p.isLowStock).length;

  function handleAddMovement() {
    if (!selectedProduct) return;
    const qty = parseInt(movQty, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Quantidade inválida", "Informe uma quantidade maior que zero.");
      return;
    }
    // Lógica de transferência entre filiais
    if (movType === "transfer") {
      if (!targetBranchId) { Alert.alert("Atenção", "Selecione a unidade destino."); return; }
      const stock = selectedProduct?.stockQuantity ?? 0;
      if (stock === 0) { Alert.alert("Estoque zerado", "Não é possível transferir. O produto está sem estoque."); return; }
      if (qty > stock) { Alert.alert("Estoque insuficiente", `Quantidade maior que o disponível (${stock} unidades).`); return; }
      const remaining = stock - qty;
      const minAlert = selectedProduct?.minStockAlert ?? 5;
      const doTransfer = () => transferMutation.mutate({
        productId: selectedProduct.id,
        targetBranchId,
        quantity: qty,
        matrixId: branchData?.matrixId ?? tenantId ?? 0,
        sourceTenantId: tenantId ?? 0,
        reason: movReason || undefined,
      });
      if (remaining <= minAlert) {
        Alert.alert(
          "Estoque baixo após transferência",
          `Após a transferência, o estoque ficará em ${remaining} unidade(s), abaixo do alerta mínimo (${minAlert}). Confirma?`,
          [{ text: "Cancelar", style: "cancel" }, { text: "Sim, transferir", style: "destructive", onPress: doTransfer }]
        );
      } else {
        doTransfer();
      }
      return;
    }
    addMovementMutation.mutate({
      productId: selectedProduct.id,
      type: movType,
      quantity: qty,
      reason: movReason || undefined,
      date: today(),
      supplierId: movType === "in" && movSupplierId ? movSupplierId : undefined,
    } as any);
  }

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader
        titleNode={<HeaderBranchTitle />}
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isStudio && !branchData?.isMatrix && (
              <Pressable
                style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(201,168,76,0.1)', borderWidth: 1, borderColor: '#C9A84C', opacity: pressed ? 0.7 : 1 }]}
                onPress={handleSyncCatalog}
                disabled={syncLoading}
              >
                <Text style={{ fontSize: 13, color: '#C9A84C' }}>{syncLoading ? '⏳' : '🔄'}</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
              onPress={handleExportCsv}
            >
              <Text style={{ fontSize: 14 }}>📥</Text>
            </Pressable>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Alerta de estoque baixo */}
        {lowStockCount > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#F59E0B" />
            <Text style={[styles.alertText, { color: "#92400E" }]}>
              {lowStockCount} produto{lowStockCount > 1 ? "s" : ""} com estoque abaixo do mínimo
            </Text>
          </View>
        )}

        {/* Filtros */}
        <View style={styles.filterRow}>
          {(["all", "sale", "internal"] as const).map((f) => (
            <Pressable
              key={f}
              style={({ pressed }) => [
                styles.filterBtn,
                {
                  backgroundColor: filterType === f ? colors.primary : colors.surface,
                  borderColor: filterType === f ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => setFilterType(f)}
            >
              <Text style={{ color: filterType === f ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 13 }}>
                {f === "all" ? "Todos" : f === "sale" ? "Venda" : "Uso Interno"}
              </Text>
            </Pressable>
          ))}
        </View>

        {stockQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="cube.box.fill" size={48} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum produto encontrado</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            {filtered.map((product: any) => (
              <View
                key={product.id}
                style={[
                  styles.productCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: product.isLowStock ? "#F59E0B" : colors.border,
                    borderWidth: product.isLowStock ? 1.5 : 1,
                  },
                ]}
              >
                <View style={styles.productHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.productTitleRow}>
                      <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <View style={[
                        styles.typeBadge,
                        { backgroundColor: product.productType === "sale" ? colors.primary + "22" : "#8B5CF622" }
                      ]}>
                        <Text style={[
                          styles.typeBadgeText,
                          { color: product.productType === "sale" ? colors.primary : "#8B5CF6" }
                        ]}>
                          {product.productType === "sale" ? "Venda" : "Interno"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stockRow}>
                      <Text style={[
                        styles.stockQty,
                        { color: product.isLowStock ? "#F59E0B" : colors.foreground }
                      ]}>
                        {product.stockQuantity} un.
                      </Text>
                      {product.isLowStock && (
                        <View style={styles.lowStockBadge}>
                          <IconSymbol name="exclamationmark.triangle.fill" size={12} color="#F59E0B" />
                          <Text style={styles.lowStockText}>Estoque baixo</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.minStock, { color: colors.muted }]}>
                      Mínimo: {product.minStockAlert} un.
                    </Text>
                  </View>

                  <View style={styles.productActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: "#22C55E22", opacity: pressed ? 0.6 : 1 },
                      ]}
                      onPress={() => {
                        setSelectedProduct(product);
                        setMovType("in");
                        setShowMovementModal(true);
                      }}
                    >
                      <IconSymbol name="plus.circle.fill" size={20} color="#22C55E" />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: "#EF444422", opacity: pressed ? 0.6 : 1 },
                      ]}
                      onPress={() => {
                        setSelectedProduct(product);
                        setMovType("out");
                        setShowMovementModal(true);
                      }}
                    >
                      <IconSymbol name="minus.circle.fill" size={20} color="#EF4444" />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: colors.primary + "22", opacity: pressed ? 0.6 : 1 },
                      ]}
                      onPress={() => {
                        setSelectedProduct(product);
                        setShowHistoryModal(true);
                      }}
                    >
                      <IconSymbol name="clock.arrow.circlepath" size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal de Movimentação */}
      <Modal visible={showMovementModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {selectedProduct?.name}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              Estoque atual: {selectedProduct?.stockQuantity ?? 0} un.
            </Text>

            {/* Tipo de movimentação */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Tipo</Text>
            <View style={styles.typeRow}>
              {(["in", "out", "adjustment", ...(networkBranches.length > 0 ? ["transfer" as MovementType] : [])] as MovementType[]).map((t) => (
                <Pressable
                  key={t}
                  style={({ pressed }) => [
                    styles.typeBtn,
                    {
                      backgroundColor: movType === t ? TYPE_COLORS[t] + "22" : colors.background,
                      borderColor: movType === t ? TYPE_COLORS[t] : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => setMovType(t)}
                >
                  <Text style={{ color: movType === t ? TYPE_COLORS[t] : colors.muted, fontWeight: "700", fontSize: 13 }}>
                    {TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Seletor de unidade destino — só para transferência */}
            {movType === "transfer" && networkBranches.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Transferir para</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {networkBranches.map((b: any) => (
                      <Pressable
                        key={b.id}
                        onPress={() => setTargetBranchId(b.id)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                          backgroundColor: targetBranchId === b.id ? '#C9A84C22' : colors.background,
                          borderWidth: 1, borderColor: targetBranchId === b.id ? '#C9A84C' : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ color: targetBranchId === b.id ? '#C9A84C' : colors.muted, fontSize: 13, fontWeight: targetBranchId === b.id ? '700' : '400' }}>
                          {b.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
            {/* Quantidade */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Quantidade</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={movQty}
              onChangeText={setMovQty}
              keyboardType="numeric"
              placeholder="Ex: 10"
              placeholderTextColor={colors.muted}
            />

            {/* Fornecedor — só para entradas */}
            {movType === "in" && suppliersList.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Fornecedor (opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      style={({ pressed }) => ({
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                        backgroundColor: movSupplierId === null ? colors.primary + "22" : colors.background,
                        borderWidth: 1, borderColor: movSupplierId === null ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      })}
                      onPress={() => setMovSupplierId(null)}
                    >
                      <Text style={{ color: movSupplierId === null ? colors.primary : colors.muted, fontSize: 13, fontWeight: movSupplierId === null ? "700" : "400" }}>Nenhum</Text>
                    </Pressable>
                    {suppliersList.map((s) => (
                      <Pressable
                        key={s.id}
                        style={({ pressed }) => ({
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                          backgroundColor: movSupplierId === s.id ? colors.primary + "22" : colors.background,
                          borderWidth: 1, borderColor: movSupplierId === s.id ? colors.primary : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                        onPress={() => setMovSupplierId(s.id)}
                      >
                        <Text style={{ color: movSupplierId === s.id ? colors.primary : colors.muted, fontSize: 13, fontWeight: movSupplierId === s.id ? "700" : "400" }}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Motivo */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Motivo (opcional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={movReason}
              onChangeText={setMovReason}
              placeholder="Ex: Compra de fornecedor, uso em atendimento..."
              placeholderTextColor={colors.muted}
            />

            <View style={styles.modalBtns}>
              <Pressable
                style={({ pressed }) => [styles.cancelModalBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => setShowMovementModal(false)}
              >
                <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { backgroundColor: TYPE_COLORS[movType], opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={handleAddMovement}
              >
                {addMovementMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Registrar {TYPE_LABELS[movType]}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Histórico */}
      <Modal visible={showHistoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, maxHeight: "85%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.historyHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {selectedProduct?.name}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
                  Estoque atual: {selectedProduct?.stockQuantity ?? 0} un.
                </Text>
              </View>
              <Pressable onPress={() => setShowHistoryModal(false)} style={{ padding: 4 }}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>

            {/* Consumo médio */}
            {avgQuery.data && (
              <View style={[styles.avgCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.avgLabel, { color: colors.muted }]}>Consumo médio mensal</Text>
                  <Text style={[styles.avgValue, { color: colors.foreground }]}>
                    {avgQuery.data.avgMonthly} un./mês
                  </Text>
                </View>
                <View style={[styles.avgDivider, { backgroundColor: colors.border }]} />
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={[styles.avgLabel, { color: colors.muted }]}>Previsão de ruptura</Text>
                  <Text style={[
                    styles.avgValue,
                    { color: avgQuery.data.daysUntilEmpty !== null && avgQuery.data.daysUntilEmpty <= 30 ? "#EF4444" : colors.foreground }
                  ]}>
                    {avgQuery.data.daysUntilEmpty !== null
                      ? `${avgQuery.data.daysUntilEmpty} dias`
                      : "—"}
                  </Text>
                </View>
              </View>
            )}

            {/* Histórico */}
            <Text style={[styles.historyLabel, { color: colors.muted }]}>ÚLTIMAS MOVIMENTAÇÕES</Text>
            {movementsQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (movementsQuery.data ?? []).length === 0 ? (
              <Text style={[{ color: colors.muted, textAlign: "center", marginTop: 20 }]}>
                Nenhuma movimentação registrada.
              </Text>
            ) : (
              <FlatList
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A84C" colors={["#C9A84C"]} />}
                data={movementsQuery.data ?? []}
                keyExtractor={(item) => String(item.id)}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => {
                  const dateStr = item.date
                    ? new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                    : "—";
                  const isOut = item.type === "out";
                  return (
                    <View style={[styles.movItem, { borderBottomColor: colors.border }]}>
                      <View style={[styles.movIcon, { backgroundColor: TYPE_COLORS[item.type as MovementType] + "22" }]}>
                        <IconSymbol
                          name={item.type === "in" ? "arrow.down.circle.fill" : item.type === "out" ? "arrow.up.circle.fill" : "pencil.circle.fill"}
                          size={18}
                          color={TYPE_COLORS[item.type as MovementType]}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.movReason, { color: colors.foreground }]} numberOfLines={1}>
                          {item.reason ?? TYPE_LABELS[item.type as MovementType]}
                        </Text>
                        <Text style={[styles.movDate, { color: colors.muted }]}>{dateStr}</Text>
                      </View>
                      <Text style={[styles.movQty, { color: TYPE_COLORS[item.type as MovementType] }]}>
                        {isOut ? "-" : "+"}{Math.abs(item.quantity)}
                      </Text>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  alertText: { fontSize: 13, fontWeight: "600", flex: 1 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  productCard: { borderRadius: 14, padding: 14 },
  productHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  productTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  productName: { fontSize: 15, fontWeight: "700", flex: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: "700" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stockQty: { fontSize: 20, fontWeight: "800" },
  lowStockBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  lowStockText: { fontSize: 11, fontWeight: "600", color: "#F59E0B" },
  minStock: { fontSize: 12, marginTop: 2 },
  productActions: { flexDirection: "row", gap: 6 },
  actionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalSubtitle: { fontSize: 13, marginTop: -8 },
  fieldLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelModalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  confirmBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  historyHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  avgCard: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center" },
  avgLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  avgValue: { fontSize: 16, fontWeight: "800" },
  avgDivider: { width: 1, height: "100%", marginHorizontal: 14 },
  historyLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  movItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  movIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  movReason: { fontSize: 13, fontWeight: "600" },
  movDate: { fontSize: 12, marginTop: 1 },
  movQty: { fontSize: 16, fontWeight: "800" },
});

export default function StockScreen() {
  return (
    <FeatureGate feature="stock">
      <StockScreenInner />
    </FeatureGate>
  );
}
