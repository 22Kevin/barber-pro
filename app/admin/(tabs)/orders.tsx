import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useColors } from "@/hooks/use-colors";

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

const PAYMENT_OPTIONS: { label: string; value: string; icon: string }[] = [
  { label: "Dinheiro", value: "cash", icon: "💵" },
  { label: "Cartão de Crédito", value: "credit_card", icon: "💳" },
  { label: "Cartão de Débito", value: "debit_card", icon: "💳" },
  { label: "Pix", value: "pix", icon: "⚡" },
  { label: "Outro", value: "other", icon: "🔄" },
];

type Order = {
  id: number;
  clientName?: string | null;
  clientPhone?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  quantity: number;
  note?: string | null;
  status: string;
  estimatedDays?: number | null;
  totalPrice?: string | null;
  cancelReason?: string | null;
  createdAt?: string | Date | null;
  confirmedAt?: string | Date | null;
};

/** Retorna os dias restantes até o prazo estimado (negativo = vencido) */
function getDeadlineDays(order: Order): number | null {
  if (!order.confirmedAt || !order.estimatedDays) return null;
  const confirmed = new Date(order.confirmedAt).getTime();
  const deadline = confirmed + order.estimatedDays * 24 * 60 * 60 * 1000;
  const diff = Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));
  return diff;
}

/** Urgency score: menor = mais urgente */
function urgencyScore(order: Order): number {
  const active = ["received", "confirmed", "preparing", "ready"];
  if (!active.includes(order.status)) return 999;
  const days = getDeadlineDays(order);
  if (days === null) return 500; // sem prazo definido, prioridade média
  return days; // negativo = vencido (mais urgente)
}

export default function OrdersScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;

  const [filter, setFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all"); // "all" | "today" | "week" | "month"
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Modal de prazo estimado (ao confirmar)
  const [showDaysModal, setShowDaysModal] = useState(false);
  const [pendingAdvanceOrder, setPendingAdvanceOrder] = useState<Order | null>(null);
  const [daysInput, setDaysInput] = useState("");

  // Modal de cancelamento com motivo
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Modal de pagamento (ao marcar como Entregue)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingDeliverOrder, setPendingDeliverOrder] = useState<Order | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>("");

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
      setShowDaysModal(false);
      setPendingAdvanceOrder(null);
      setDaysInput("");
      setShowPaymentModal(false);
      setPendingDeliverOrder(null);
      setSelectedPayment("");
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const rawOrders = (ordersQuery.data ?? []) as Order[];
  // Filtrar por período
  const periodFiltered = rawOrders.filter((o) => {
    if (periodFilter === "all") return true;
    if (!o.createdAt) return false;
    const created = new Date(o.createdAt);
    const now = new Date();
    if (periodFilter === "today") {
      return created.toDateString() === now.toDateString();
    }
    if (periodFilter === "week") {
      const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
      return created >= weekAgo;
    }
    if (periodFilter === "month") {
      const monthAgo = new Date(); monthAgo.setDate(now.getDate() - 30);
      return created >= monthAgo;
    }
    return true;
  });
  // Ordenar: ativos com prazo vencido/próximo no topo, depois por data de criação
  const orders = [...periodFiltered].sort((a, b) => urgencyScore(a) - urgencyScore(b));

  function handleAdvanceStatus(order: Order) {
    const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus);
    if (currentIdx < 0 || currentIdx >= STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[currentIdx + 1];

    if (nextStatus === "confirmed") {
      // Modal de prazo estimado
      setPendingAdvanceOrder(order);
      setDaysInput("");
      setShowDaysModal(true);
    } else if (nextStatus === "delivered") {
      // Modal de pagamento
      setPendingDeliverOrder(order);
      setSelectedPayment("");
      setShowPaymentModal(true);
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

  function confirmDaysModal() {
    if (!pendingAdvanceOrder) return;
    const d = daysInput ? parseInt(daysInput) : undefined;
    updateStatusMutation.mutate({
      id: pendingAdvanceOrder.id,
      status: "confirmed",
      estimatedDays: d && !isNaN(d) ? d : undefined,
    });
  }

  function confirmPaymentModal() {
    if (!pendingDeliverOrder || !selectedPayment) return;
    updateStatusMutation.mutate({
      id: pendingDeliverOrder.id,
      status: "delivered",
      paymentMethod: selectedPayment,
      barberId: barber?.id ?? undefined,
    });
  }

  function handleCancelOrder(order: Order) {
    setCancelOrder(order);
    setCancelReason("");
    setShowCancelModal(true);
  }

  function confirmCancel() {
    if (!cancelOrder) return;
    updateStatusMutation.mutate(
      { id: cancelOrder.id, status: "cancelled", cancelReason: cancelReason.trim() || undefined },
      {
        onSuccess: () => {
          const order = cancelOrder;
          setShowCancelModal(false);
          setCancelOrder(null);
          setCancelReason("");

          if (order.clientPhone) {
            const reason = cancelReason.trim();
            const phone = order.clientPhone.replace(/\D/g, "");
            const msg = encodeURIComponent(
              `Olá${order.clientName ? ` ${order.clientName}` : ""}! 👋\n\nInfelizmente precisamos *cancelar* sua encomenda de *${order.productName ?? "produto"}* (x${order.quantity}).${reason ? `\n\n*Motivo:* ${reason}` : ""}\n\nSentimos muito pelo inconveniente. Qualquer dúvida, estamos à disposição! ✂️`
            );
            Alert.alert(
              "Encomenda Cancelada",
              "Deseja enviar uma mensagem WhatsApp ao cliente explicando o cancelamento?",
              [
                { text: "Não", style: "cancel" },
                { text: "Enviar WhatsApp", onPress: () => Linking.openURL(`https://wa.me/55${phone}?text=${msg}`) },
              ]
            );
          }
        },
      }
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
    setShowDetailModal(true);
  }

  const pendingCount = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;

  function renderOrder({ item }: { item: Order }) {
    const status = item.status as OrderStatus;
    const color = STATUS_COLORS[status] ?? "#888";
    const currentIdx = STATUS_FLOW.indexOf(status);
    const canAdvance = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1;
    const canCancel = status !== "delivered" && status !== "cancelled";
    const isCancelled = status === "cancelled";

    const deadlineDays = getDeadlineDays(item);
    const isOverdue = deadlineDays !== null && deadlineDays < 0 && !isCancelled && status !== "delivered";
    const isUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 1 && !isCancelled && status !== "delivered";

    return (
      <TouchableOpacity
        style={[styles.card, isOverdue && styles.cardOverdue, isUrgent && styles.cardUrgent]}
        onPress={() => openDetail(item)}
        activeOpacity={0.85}
      >
        {/* Header do card */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: color + "22", borderColor: color }]}>
            <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status] ?? status}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {isOverdue && (
              <View style={styles.urgencyBadge}>
                <Text style={styles.urgencyBadgeText}>🔴 Vencido</Text>
              </View>
            )}
            {isUrgent && !isOverdue && (
              <View style={[styles.urgencyBadge, { backgroundColor: "#F5920022" }]}>
                <Text style={[styles.urgencyBadgeText, { color: "#F59200" }]}>⚠️ Urgente</Text>
              </View>
            )}
            <Text style={styles.cardDate}>
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString("pt-BR") : ""}
            </Text>
          </View>
        </View>

        {/* Produto e cliente */}
        <View style={styles.productRow}>
          {item.productImageUrl ? (
            <Image source={{ uri: item.productImageUrl }} style={styles.productThumb} />
          ) : (
            <View style={styles.productThumbPlaceholder}>
              <Text style={{ fontSize: 18 }}>📦</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={1}>{item.productName ?? "Produto"}</Text>
          </View>
        </View>
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

        {/* Motivo do cancelamento */}
        {isCancelled && item.cancelReason ? (
          <View style={styles.cancelReasonCard}>
            <Text style={styles.cancelReasonCardLabel}>Motivo do cancelamento:</Text>
            <Text style={styles.cancelReasonCardText} numberOfLines={2}>{item.cancelReason}</Text>
          </View>
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

      {/* Filtros de status */}
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

      {/* Filtro de período */}
      <View style={styles.periodRow}>
        {(["all", "today", "week", "month"] as const).map((p) => {
          const labels = { all: "Todos os períodos", today: "Hoje", week: "7 dias", month: "30 dias" };
          return (
            <TouchableOpacity
              key={p}
              style={[styles.periodChip, periodFilter === p && styles.periodChipActive]}
              onPress={() => setPeriodFilter(p)}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodChipText, periodFilter === p && styles.periodChipTextActive]}>
                {labels[p]}
              </Text>
            </TouchableOpacity>
          );
        })}
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
                {selectedOrder.cancelReason && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Motivo Cancelamento</Text>
                    <Text style={[styles.detailValue, { color: "#EF4444" }]}>{selectedOrder.cancelReason}</Text>
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

      {/* Modal de prazo estimado */}
      <Modal visible={showDaysModal} transparent animationType="fade" onRequestClose={() => setShowDaysModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.centeredOverlay}>
          <Pressable style={styles.centeredOverlay} onPress={() => setShowDaysModal(false)}>
            <Pressable style={styles.floatModalSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.floatModalTitle}>Prazo de Retirada</Text>
              <Text style={styles.floatModalSubtitle}>Em quantos dias o produto estará pronto? (opcional)</Text>
              <TextInput
                style={styles.floatInput}
                value={daysInput}
                onChangeText={setDaysInput}
                placeholder="Ex: 3"
                placeholderTextColor="#555"
                keyboardType="numeric"
                maxLength={3}
                autoFocus
              />
              <View style={styles.floatModalActions}>
                <TouchableOpacity style={styles.floatSkipBtn} onPress={() => { setDaysInput(""); confirmDaysModal(); }} activeOpacity={0.8}>
                  <Text style={styles.floatSkipBtnText}>Pular</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.floatConfirmBtn, updateStatusMutation.isPending && { opacity: 0.6 }]}
                  onPress={confirmDaysModal}
                  disabled={updateStatusMutation.isPending}
                  activeOpacity={0.8}
                >
                  {updateStatusMutation.isPending ? <ActivityIndicator size="small" color="#0A0A0A" /> : <Text style={styles.floatConfirmBtnText}>Confirmar</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de pagamento (ao marcar como Entregue) */}
      <Modal visible={showPaymentModal} transparent animationType="fade" onRequestClose={() => setShowPaymentModal(false)}>
        <Pressable style={styles.centeredOverlay} onPress={() => setShowPaymentModal(false)}>
          <Pressable style={styles.floatModalSheet} onPress={(e) => e.stopPropagation()}>
            {/* Ícone */}
            <View style={styles.paymentIconWrap}>
              <Text style={styles.paymentIconText}>💰</Text>
            </View>
            <Text style={styles.floatModalTitle}>Registrar Pagamento</Text>
            {pendingDeliverOrder && (
              <Text style={styles.floatModalSubtitle}>
                {pendingDeliverOrder.productName} · {pendingDeliverOrder.clientName}
                {pendingDeliverOrder.totalPrice ? `  ·  R$ ${pendingDeliverOrder.totalPrice}` : ""}
              </Text>
            )}
            <Text style={styles.paymentLabel}>Forma de pagamento</Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.paymentOption, selectedPayment === opt.value && styles.paymentOptionSelected]}
                  onPress={() => setSelectedPayment(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.paymentOptionIcon}>{opt.icon}</Text>
                  <Text style={[styles.paymentOptionText, selectedPayment === opt.value && styles.paymentOptionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.floatModalActions}>
              <TouchableOpacity style={styles.floatSkipBtn} onPress={() => setShowPaymentModal(false)} activeOpacity={0.8}>
                <Text style={styles.floatSkipBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.floatConfirmBtn, (!selectedPayment || updateStatusMutation.isPending) && { opacity: 0.5 }]}
                onPress={confirmPaymentModal}
                disabled={!selectedPayment || updateStatusMutation.isPending}
                activeOpacity={0.8}
              >
                {updateStatusMutation.isPending ? (
                  <ActivityIndicator size="small" color="#0A0A0A" />
                ) : (
                  <Text style={styles.floatConfirmBtnText}>Confirmar Entrega</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de cancelamento com motivo */}
      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.centeredOverlay}>
          <Pressable style={styles.centeredOverlay} onPress={() => setShowCancelModal(false)}>
            <Pressable style={styles.floatModalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.cancelIconWrap}>
                <Text style={styles.cancelIconText}>✕</Text>
              </View>
              <Text style={styles.floatModalTitle}>Cancelar Encomenda</Text>
              {cancelOrder && (
                <Text style={styles.floatModalSubtitle}>
                  {cancelOrder.productName ?? "Produto"} · {cancelOrder.clientName ?? "Cliente"}
                </Text>
              )}
              <Text style={styles.cancelReasonLabel}>Motivo do cancelamento (opcional)</Text>
              <TextInput
                style={[styles.floatInput, styles.cancelReasonInput]}
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Ex: produto fora de estoque, pedido duplicado..."
                placeholderTextColor="#555"
                multiline
                numberOfLines={3}
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={styles.cancelHint}>
                💬 Após cancelar, você poderá enviar uma mensagem WhatsApp ao cliente com o motivo.
              </Text>
              <View style={styles.floatModalActions}>
                <TouchableOpacity style={styles.floatSkipBtn} onPress={() => setShowCancelModal(false)} activeOpacity={0.8}>
                  <Text style={styles.floatSkipBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelConfirmBtn, updateStatusMutation.isPending && { opacity: 0.6 }]}
                  onPress={confirmCancel}
                  disabled={updateStatusMutation.isPending}
                  activeOpacity={0.8}
                >
                  {updateStatusMutation.isPending ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.cancelConfirmBtnText}>Cancelar Encomenda</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { color: c.muted, fontSize: 14, fontWeight: "600" },
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
  filterRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: c.background },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#C9A84C",
  },
  filterChipActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  filterChipText: { color: "#C9A84C", fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: "#0A0A0A" },
  card: {
    backgroundColor: c.surface,
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
  cardDate: { fontSize: 11, color: c.muted },
  productRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  productThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: c.background },
  productThumbPlaceholder: { width: 44, height: 44, borderRadius: 8, backgroundColor: c.background, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 15, fontWeight: "700", color: c.foreground },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardMeta: { fontSize: 12, color: "#888" },
  cardMetaSep: { fontSize: 12, color: "#444" },
  noteText: { fontSize: 12, color: "#666", fontStyle: "italic" },
  cancelReasonCard: {
    backgroundColor: "#EF444410",
    borderWidth: 1,
    borderColor: "#EF444430",
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  cancelReasonCardLabel: { fontSize: 11, color: "#EF4444", fontWeight: "700" },
  cancelReasonCardText: { fontSize: 12, color: "#EF4444AA" },
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
  // Modal de detalhe (bottom sheet)
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#333", alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: c.foreground },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: c.background },
  detailLabel: { fontSize: 13, color: "#888" },
  detailValue: { fontSize: 13, color: c.foreground, fontWeight: "600", flex: 1, textAlign: "right" },
  timeline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 8 },
  timelineItem: { alignItems: "center", flex: 1, position: "relative" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#333", borderWidth: 1.5, borderColor: "#444" },
  timelineLine: { position: "absolute", top: 4, left: "50%", right: "-50%", height: 2, backgroundColor: "#222" },
  timelineLabel: { fontSize: 9, color: c.muted, marginTop: 4, textAlign: "center" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  closeModalBtn: { flex: 1, backgroundColor: c.surface, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: c.border },
  closeModalBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
  // Modais flutuantes centralizados
  centeredOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center" },
  floatModalSheet: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
    width: "88%",
  },
  floatModalTitle: { fontSize: 17, fontWeight: "800", color: c.foreground, textAlign: "center" },
  floatModalSubtitle: { fontSize: 13, color: "#888", textAlign: "center" },
  floatInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: c.foreground,
    fontSize: 15,
    textAlign: "center",
  },
  floatModalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  floatSkipBtn: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  floatSkipBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
  floatConfirmBtn: {
    flex: 2,
    backgroundColor: "#C9A84C",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  floatConfirmBtnText: { color: "#0A0A0A", fontSize: 14, fontWeight: "700" },
  // Modal de pagamento
  paymentIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#C9A84C20",
    borderWidth: 1.5,
    borderColor: "#C9A84C",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 2,
  },
  paymentIconText: { fontSize: 24 },
  paymentLabel: { fontSize: 13, color: "#888", fontWeight: "600" },
  paymentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: "45%",
    flex: 1,
  },
  paymentOptionSelected: { backgroundColor: "#C9A84C20", borderColor: "#C9A84C" },
  paymentOptionIcon: { fontSize: 16 },
  paymentOptionText: { fontSize: 12, color: "#888", fontWeight: "600" },
  paymentOptionTextSelected: { color: "#C9A84C" },
  // Modal de cancelamento
  cancelIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EF444420",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 2,
  },
  cancelIconText: { fontSize: 20, color: "#EF4444", fontWeight: "800" },
  cancelReasonLabel: { fontSize: 13, color: "#888", fontWeight: "600" },
  cancelReasonInput: {
    textAlign: "left",
    minHeight: 80,
    paddingTop: 12,
  },
  cancelHint: { fontSize: 12, color: c.muted, lineHeight: 18 },
  cancelConfirmBtn: {
    flex: 2,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelConfirmBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  cardOverdue: { borderColor: "#EF444466", borderWidth: 1.5 },
  cardUrgent: { borderColor: "#F5920066", borderWidth: 1.5 },
  urgencyBadge: { backgroundColor: "#EF444422", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  urgencyBadgeText: { fontSize: 10, fontWeight: "700", color: "#EF4444" },
  periodRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 8, gap: 8, borderBottomWidth: 0.5, borderBottomColor: c.background },
  periodChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  periodChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  periodChipText: { fontSize: 12, color: "#666" },
  periodChipTextActive: { color: "#C9A84C", fontWeight: "700" },
});
}
