import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";

type OrderStatus = "received" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Recebido",
  confirmed: "Confirmado",
  preparing: "Em Preparo",
  ready: "Pronto para Retirada",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  received: "#F59E0B",
  confirmed: "#3B82F6",
  preparing: "#8B5CF6",
  ready: "#10B981",
  delivered: "#6B7280",
  cancelled: "#EF4444",
};

const STATUS_FLOW: OrderStatus[] = ["received", "confirmed", "preparing", "ready", "delivered"];

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "Todos", value: "all" },
  { label: "Recebido", value: "received" },
  { label: "Confirmado", value: "confirmed" },
  { label: "Em Preparo", value: "preparing" },
  { label: "Pronto", value: "ready" },
  { label: "Entregue", value: "delivered" },
  { label: "Cancelado", value: "cancelled" },
];

type Order = {
  id: number;
  clientName?: string | null;
  clientPhone?: string | null;
  productName?: string | null;
  quantity: number;
  note?: string | null;
  status: string;
  estimatedDays?: number | null;
  totalPrice?: string | null;
  createdAt?: string | Date | null;
};

export default function OrdersScreen() {
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;

  const [filter, setFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [estimatedDays, setEstimatedDays] = useState("");

  const utils = trpc.useUtils();

  const ordersQuery = trpc.productOrders.list.useQuery(
    { tenantId, status: filter === "all" ? undefined : filter },
    { enabled: tenantId > 0 }
  );

  const updateStatusMutation = trpc.productOrders.updateStatus.useMutation({
    onSuccess: () => {
      utils.productOrders.list.invalidate();
      utils.productOrders.pendingCount.invalidate();
      setShowDetailModal(false);
      setSelectedOrder(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const orders = (ordersQuery.data ?? []) as Order[];

  function handleAdvanceStatus(order: Order) {
    const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus);
    if (currentIdx < 0 || currentIdx >= STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[currentIdx + 1];

    if (nextStatus === "confirmed") {
      // Pede prazo estimado ao confirmar
      Alert.prompt(
        "Prazo de Retirada",
        "Em quantos dias o produto estará pronto? (opcional)",
        [
            { text: "Pular", onPress: () => updateStatusMutation.mutate({ id: order.id, status: nextStatus }) },
          {
            text: "Confirmar",
            onPress: (days: string | undefined) => {
              const d = days ? parseInt(days) : undefined;
              updateStatusMutation.mutate({ id: order.id, status: nextStatus, estimatedDays: isNaN(d ?? NaN) ? undefined : d });
            },
          },
        ],
        "plain-text",
        "",
        "numeric"
      );
    } else {
      Alert.alert(
        "Atualizar Status",
        `Avançar para "${STATUS_LABELS[nextStatus]}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: () => updateStatusMutation.mutate({ id: order.id, status: nextStatus }) },
        ]
      );
    }
  }

  function handleCancelOrder(order: Order) {
    Alert.alert(
      "Cancelar Encomenda",
      "Deseja cancelar esta encomenda?",
      [
        { text: "Não", style: "cancel" },
        { text: "Cancelar Encomenda", style: "destructive", onPress: () => updateStatusMutation.mutate({ id: order.id, status: "cancelled" }) },
      ]
    );
  }

  function handleWhatsApp(order: Order) {
    if (!order.clientPhone) return;
    const phone = order.clientPhone.replace(/\D/g, "");
    const statusLabel = STATUS_LABELS[order.status as OrderStatus] ?? order.status;
    const msg = encodeURIComponent(
      `Olá${order.clientName ? ` ${order.clientName}` : ""}! 👋\n\nSua encomenda de *${order.productName ?? "produto"}* (x${order.quantity}) está com o status: *${statusLabel}*.\n${order.estimatedDays ? `\nPrazo estimado: ${order.estimatedDays} dia(s).\n` : ""}Qualquer dúvida, estamos à disposição! ✂️`
    );
    Linking.openURL(`https://wa.me/55${phone}?text=${msg}`);
  }

  function openDetail(order: Order) {
    setSelectedOrder(order);
    setEstimatedDays(order.estimatedDays ? String(order.estimatedDays) : "");
    setShowDetailModal(true);
  }

  const pendingCount = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;

  function renderOrder({ item }: { item: Order }) {
    const status = item.status as OrderStatus;
    const color = STATUS_COLORS[status] ?? "#888";
    const currentIdx = STATUS_FLOW.indexOf(status);
    const canAdvance = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1;
    const canCancel = status !== "delivered" && status !== "cancelled";

    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.85}>
        {/* Header do card */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: color + "22", borderColor: color }]}>
            <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status] ?? status}</Text>
          </View>
          <Text style={styles.cardDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("pt-BR") : ""}
          </Text>
        </View>

        {/* Produto e cliente */}
        <Text style={styles.productName} numberOfLines={1}>{item.productName ?? "Produto"}</Text>
        <View style={styles.cardRow}>
          <IconSymbol name="person.fill" size={13} color="#888" />
          <Text style={styles.cardMeta}>{item.clientName ?? "Cliente"}</Text>
          <Text style={styles.cardMetaSep}>·</Text>
          <Text style={styles.cardMeta}>x{item.quantity}</Text>
          {item.totalPrice ? (
            <>
              <Text style={styles.cardMetaSep}>·</Text>
              <Text style={[styles.cardMeta, { color: "#C9A84C" }]}>R$ {item.totalPrice}</Text>
            </>
          ) : null}
        </View>

        {item.note ? (
          <Text style={styles.noteText} numberOfLines={2}>📝 {item.note}</Text>
        ) : null}

        {/* Ações */}
        <View style={styles.cardActions}>
          {canAdvance && (
            <TouchableOpacity
              style={styles.advanceBtn}
              onPress={() => handleAdvanceStatus(item)}
              activeOpacity={0.8}
            >
              <IconSymbol name="chevron.right" size={13} color="#0A0A0A" />
              <Text style={styles.advanceBtnText}>
                {STATUS_LABELS[STATUS_FLOW[currentIdx + 1]]}
              </Text>
            </TouchableOpacity>
          )}
          {item.clientPhone && (
            <TouchableOpacity style={styles.waBtn} onPress={() => handleWhatsApp(item)} activeOpacity={0.8}>
              <Text style={styles.waBtnText}>📲 WhatsApp</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelOrder(item)} activeOpacity={0.8}>
              <IconSymbol name="xmark" size={12} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#0A0A0A]">
      <AdminHeader
        title="Encomendas"
        rightElement={
          pendingCount > 0 ? (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          ) : undefined
        }
      />

      {/* Filtros */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={FILTER_OPTIONS}
          keyExtractor={(i) => i.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === item.value && styles.filterChipActive]}
              onPress={() => setFilter(item.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, filter === item.value && styles.filterChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {ordersQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C9A84C" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <IconSymbol name="cube.box.fill" size={48} color="#333" />
          <Text style={styles.emptyText}>Nenhuma encomenda encontrada</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 14, paddingBottom: tabBarHeight + 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de detalhe */}
      <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDetailModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {selectedOrder && (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Detalhe da Encomenda #{selectedOrder.id}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Produto</Text>
                  <Text style={styles.detailValue}>{selectedOrder.productName ?? "—"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cliente</Text>
                  <Text style={styles.detailValue}>{selectedOrder.clientName ?? "—"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantidade</Text>
                  <Text style={styles.detailValue}>{selectedOrder.quantity}</Text>
                </View>
                {selectedOrder.totalPrice && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total</Text>
                    <Text style={[styles.detailValue, { color: "#C9A84C" }]}>R$ {selectedOrder.totalPrice}</Text>
                  </View>
                )}
                {selectedOrder.note && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Observação</Text>
                    <Text style={styles.detailValue}>{selectedOrder.note}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[selectedOrder.status as OrderStatus] ?? "#888") + "22", borderColor: STATUS_COLORS[selectedOrder.status as OrderStatus] ?? "#888" }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[selectedOrder.status as OrderStatus] ?? "#888" }]}>
                      {STATUS_LABELS[selectedOrder.status as OrderStatus] ?? selectedOrder.status}
                    </Text>
                  </View>
                </View>

                {/* Timeline */}
                <View style={styles.timeline}>
                  {STATUS_FLOW.map((s, i) => {
                    const currentIdx = STATUS_FLOW.indexOf(selectedOrder.status as OrderStatus);
                    const isDone = i <= currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <View key={s} style={styles.timelineItem}>
                        <View style={[styles.timelineDot, isDone && { backgroundColor: STATUS_COLORS[s] }, isCurrent && { borderColor: STATUS_COLORS[s] }]} />
                        {i < STATUS_FLOW.length - 1 && <View style={[styles.timelineLine, isDone && i < currentIdx && { backgroundColor: "#C9A84C44" }]} />}
                        <Text style={[styles.timelineLabel, isCurrent && { color: "#F5F5F0", fontWeight: "700" }]}>{STATUS_LABELS[s]}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  {selectedOrder.clientPhone && (
                    <TouchableOpacity style={styles.waBtn} onPress={() => handleWhatsApp(selectedOrder)} activeOpacity={0.8}>
                      <Text style={styles.waBtnText}>📲 WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowDetailModal(false)} activeOpacity={0.8}>
                    <Text style={styles.closeModalBtnText}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { color: "#555", fontSize: 14, fontWeight: "600" },
  badgeContainer: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  filterRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#1E1E1E" },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  filterChipActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  filterChipText: { color: "#888", fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: "#0A0A0A" },
  card: {
    backgroundColor: "#141414",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#222",
    gap: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  cardDate: { fontSize: 11, color: "#555" },
  productName: { fontSize: 15, fontWeight: "700", color: "#F5F5F0" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardMeta: { fontSize: 12, color: "#888" },
  cardMetaSep: { fontSize: 12, color: "#444" },
  noteText: { fontSize: 12, color: "#666", fontStyle: "italic" },
  cardActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#C9A84C",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  advanceBtnText: { color: "#0A0A0A", fontSize: 12, fontWeight: "700" },
  waBtn: {
    backgroundColor: "#25D36622",
    borderWidth: 1,
    borderColor: "#25D366",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  waBtnText: { color: "#25D366", fontSize: 12, fontWeight: "700" },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EF444418",
    borderWidth: 1,
    borderColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#333", alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#F5F5F0" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#1E1E1E" },
  detailLabel: { fontSize: 13, color: "#888" },
  detailValue: { fontSize: 13, color: "#F5F5F0", fontWeight: "600", flex: 1, textAlign: "right" },
  timeline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 8 },
  timelineItem: { alignItems: "center", flex: 1, position: "relative" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#333", borderWidth: 1.5, borderColor: "#444" },
  timelineLine: { position: "absolute", top: 4, left: "50%", right: "-50%", height: 2, backgroundColor: "#222" },
  timelineLabel: { fontSize: 9, color: "#555", marginTop: 4, textAlign: "center" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  closeModalBtn: { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#2A2A2A" },
  closeModalBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
});
