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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { exportCsv } from "@/hooks/use-csv-export";
import { useBarberAuth } from "@/lib/auth-context";

type MovementType = "in" | "out" | "adjustment";

const TYPE_LABELS: Record<MovementType, string> = {
  in: "Entrada",
  out: "Saída",
  adjustment: "Ajuste",
};

const TYPE_COLORS: Record<MovementType, string> = {
  in: "#22C55E",
  out: "#EF4444",
  adjustment: "#F59E0B",
};

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function StockScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const utils = trpc.useUtils();

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
    addMovementMutation.mutate({
      productId: selectedProduct.id,
      type: movType,
      quantity: qty,
      reason: movReason || undefined,
      date: today(),
    });
  }

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader
        title="Controle de Estoque"
        rightElement={
          <Pressable
            style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
            onPress={handleExportCsv}
          >
            <Text style={{ fontSize: 14 }}>📥</Text>
          </Pressable>
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
              {(["in", "out", "adjustment"] as MovementType[]).map((t) => (
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
