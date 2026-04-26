import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { trpc } from "@/lib/trpc";

// ─── Status ──────────────────────────────────────────────────────────────────
const STATUS_FLOW = ["received", "confirmed", "in_progress", "ready", "delivered"] as const;
type OrderStatus = (typeof STATUS_FLOW)[number] | "cancelled";

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Recebido",
  confirmed: "Confirmado",
  in_progress: "Em Preparo",
  ready: "Pronto para Retirada",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  received: "#EAB308",
  confirmed: "#3B82F6",
  in_progress: "#F97316",
  ready: "#10B981",
  delivered: "#6B7280",
  cancelled: "#EF4444",
};

const STATUS_ICONS: Record<OrderStatus, string> = {
  received: "📬",
  confirmed: "✅",
  in_progress: "🔧",
  ready: "🎉",
  delivered: "📦",
  cancelled: "❌",
};

// ─── Timeline ─────────────────────────────────────────────────────────────────
function OrderTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_FLOW.indexOf(status as any);
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <View style={tl.row}>
        <View style={[tl.dot, { backgroundColor: "#EF4444" }]} />
        <Text style={[tl.label, { color: "#EF4444" }]}>Cancelado</Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12, marginBottom: 4 }}>
      <View style={tl.track}>
        {STATUS_FLOW.map((s, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <React.Fragment key={s}>
              <View style={[tl.dot, done ? tl.dotDone : tl.dotPending, active && tl.dotActive]}>
                {done && <Text style={tl.dotIcon}>{i < currentIdx ? "✓" : STATUS_ICONS[s]}</Text>}
              </View>
              {i < STATUS_FLOW.length - 1 && (
                <View style={[tl.line, i < currentIdx ? tl.lineDone : tl.linePending]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      <View style={tl.labelsRow}>
        {STATUS_FLOW.map((s, i) => {
          const done = i <= currentIdx;
          return (
            <Text key={s} style={[tl.label, done ? tl.labelDone : tl.labelPending]} numberOfLines={2}>
              {STATUS_LABELS[s]}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const tl = StyleSheet.create({
  track: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", zIndex: 1 },
  dotDone: { backgroundColor: "#C9A84C" },
  dotPending: { backgroundColor: "#1E1E1E", borderWidth: 1.5, borderColor: "#333" },
  dotActive: { borderWidth: 2, borderColor: "#F5F5F0" },
  dotIcon: { fontSize: 13, color: "#0A0A0A" },
  line: { flex: 1, height: 2 },
  lineDone: { backgroundColor: "#C9A84C" },
  linePending: { backgroundColor: "#2A2A2A" },
  labelsRow: { flexDirection: "row", marginTop: 6, paddingHorizontal: 0 },
  label: { flex: 1, fontSize: 9, textAlign: "center" },
  labelDone: { color: "#C9A84C", fontWeight: "600" },
  labelPending: { color: "#444" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
});

// ─── Modal de Avaliação ─────────────────────────────────────────────────────────
function ReviewModal({ visible, order, clientId, tenantId, onClose }: {
  visible: boolean;
  order: any;
  clientId: number;
  tenantId: number;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();

  const createReview = trpc.reviews.create.useMutation({
    onSuccess: () => {
      utils.productOrders.myOrders.invalidate();
      Alert.alert("⭐ Obrigado!", "Sua avaliação foi enviada com sucesso.");
      onClose();
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  function handleSubmit() {
    if (!order) return;
    createReview.mutate({
      tenantId,
      clientId,
      productId: order.productId,
      orderId: order.id,
      rating,
      comment: comment.trim() || undefined,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={rv.overlay} onPress={onClose}>
        <Pressable style={rv.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={rv.handle} />
          <Text style={rv.title}>Avaliar Produto</Text>
          {order && (
            <Text style={rv.productName} numberOfLines={1}>{order.productName ?? "Produto"}</Text>
          )}

          {/* Estrelas */}
          <View style={rv.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                <Text style={[rv.star, s <= rating && rv.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={rv.ratingLabel}>
            {rating === 1 ? "Péssimo" : rating === 2 ? "Ruim" : rating === 3 ? "Regular" : rating === 4 ? "Bom" : "Excelente"}
          </Text>

          {/* Comentário */}
          <TextInput
            style={rv.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Deixe um comentário (opcional)..."
            placeholderTextColor="#555"
            multiline
            numberOfLines={3}
            maxLength={300}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[rv.submitBtn, createReview.isPending && { opacity: 0.6 }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={createReview.isPending}
          >
            {createReview.isPending ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text style={rv.submitBtnText}>⭐ Enviar Avaliação</Text>
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const rv = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: "#1F2937" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#374151", alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "800", color: "#F9FAFB", textAlign: "center", marginBottom: 4 },
  productName: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 20 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 },
  star: { fontSize: 36, color: "#374151" },
  starActive: { color: "#EAB308" },
  ratingLabel: { textAlign: "center", fontSize: 14, color: "#EAB308", fontWeight: "600", marginBottom: 16 },
  input: { backgroundColor: "#1F2937", borderWidth: 1, borderColor: "#374151", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#F9FAFB", height: 80, textAlignVertical: "top", marginBottom: 16 },
  submitBtn: { backgroundColor: "#EAB308", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnText: { fontSize: 15, fontWeight: "800", color: "#0A0A0A" },
});

// ─── Card de encomenda ────────────────────────────────────────────────────────
function OrderCard({ item, onCancel, onReview }: { item: any; onCancel: () => void; onReview: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const status = item.status as OrderStatus;
  const color = STATUS_COLORS[status] ?? "#888";
  const canCancel = status === "received";
  const isReady = status === "ready";
  const isCancelled = status === "cancelled";
  const isDelivered = status === "delivered";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.9}
    >
      {/* Cabeçalho */}
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[status] ?? status}</Text>
        </View>
        <Text style={styles.cardDate}>
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("pt-BR") : ""}
        </Text>
      </View>

      {/* Produto */}
      <View style={styles.productRow}>
        {item.productImageUrl ? (
          <Image source={{ uri: item.productImageUrl }} style={styles.productThumb} />
        ) : (
          <View style={styles.productThumbPlaceholder}>
            <Text style={{ fontSize: 22 }}>📦</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={2}>{item.productName ?? "Produto"}</Text>
          <Text style={styles.productMeta}>
            Qtd: {item.quantity}
            {item.totalPrice ? `  ·  R$ ${parseFloat(item.totalPrice).toFixed(2).replace(".", ",")}` : ""}
          </Text>
        </View>
      </View>

      {/* Observação */}
      {item.note ? (
        <Text style={styles.noteText} numberOfLines={2}>📝 {item.note}</Text>
      ) : null}

      {/* Prazo estimado */}
      {item.estimatedDays && !isCancelled && !isDelivered ? (
        <Text style={styles.estimatedText}>
          ⏱ Prazo estimado: {item.estimatedDays} dia{item.estimatedDays !== 1 ? "s" : ""}
        </Text>
      ) : null}

      {/* Motivo do cancelamento */}
      {isCancelled && item.cancelReason ? (
        <View style={styles.cancelBox}>
          <Text style={styles.cancelBoxLabel}>Motivo do cancelamento:</Text>
          <Text style={styles.cancelBoxText}>{item.cancelReason}</Text>
        </View>
      ) : null}

      {/* Banner pronto para retirada */}
      {isReady ? (
        <View style={styles.readyBanner}>
          <Text style={styles.readyBannerText}>🎉 Seu pedido está pronto! Compareça à barbearia para retirar.</Text>
        </View>
      ) : null}

      {/* Timeline (expandida) */}
      {expanded && !isCancelled && (
        <OrderTimeline status={status} />
      )}

      {/* Ações */}
      {canCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>Cancelar encomenda</Text>
        </TouchableOpacity>
      )}

      {/* Botão Avaliar (apenas quando entregue) */}
      {isDelivered && (
        <TouchableOpacity style={styles.reviewBtn} onPress={onReview} activeOpacity={0.85}>
          <Text style={styles.reviewBtnText}>⭐ Avaliar produto</Text>
        </TouchableOpacity>
      )}

      {/* Indicador de expandir */}
      <Text style={styles.expandHint}>{expanded ? "▲ Fechar" : "▼ Ver timeline"}</Text>
    </TouchableOpacity>
  );
}

// ─── Tela principal ─────────────────────────────────────────────────────────
export default function MyOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { client, isAuthenticated } = useClientAuth();
  const utils = trpc.useUtils();
  const [reviewOrder, setReviewOrder] = useState<any>(null);

  const ordersQuery = trpc.productOrders.myOrders.useQuery(
    { clientId: client?.id ?? 0, tenantId: client?.tenantId ?? client?.preferredTenantId ?? 0 },
    { enabled: !!client }
  );

  const cancelMutation = trpc.productOrders.cancelByClient.useMutation({
    onSuccess: () => {
      utils.productOrders.myOrders.invalidate();
      Alert.alert("Encomenda cancelada", "Sua encomenda foi cancelada com sucesso.");
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  function handleCancel(order: any) {
    Alert.alert(
      "Cancelar encomenda",
      `Deseja cancelar o pedido de "${order.productName ?? "produto"}"?`,
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, cancelar",
          style: "destructive",
          onPress: () => cancelMutation.mutate({ id: order.id, clientId: client!.id }),
        },
      ]
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer containerClassName="bg-black">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📦</Text>
          <Text style={styles.guestTitle}>Minhas Encomendas</Text>
          <Text style={styles.guestSub}>Faça login para ver seus pedidos.</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/client/login" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.loginBtnText}>Fazer login</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const orders = ordersQuery.data ?? [];

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Minhas Encomendas</Text>
          <Text style={styles.headerSub}>{orders.length} pedido{orders.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {ordersQuery.isLoading ? (
        <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>📦</Text>
          <Text style={styles.emptyTitle}>Nenhuma encomenda ainda</Text>
          <Text style={styles.emptySub}>Visite a loja e faça seu primeiro pedido!</Text>
          <TouchableOpacity
            style={styles.shopBtn}
            onPress={() => router.push("/client/(tabs)/shop" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.shopBtnText}>🛍️ Ir para a loja</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <OrderCard
              item={item}
              onCancel={() => handleCancel(item)}
              onReview={() => setReviewOrder(item)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarHeight + 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de Avaliação */}
      <ReviewModal
        visible={!!reviewOrder}
        order={reviewOrder}
        clientId={client?.id ?? 0}
        tenantId={client?.tenantId ?? client?.preferredTenantId ?? 0}
        onClose={() => setReviewOrder(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  backIcon: { fontSize: 22, color: "#C9A84C" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#EAB308" },
  headerSub: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cardDate: { fontSize: 11, color: "#4B5563" },
  productRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  productThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: "#1F2937" },
  productThumbPlaceholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 15, fontWeight: "700", color: "#F9FAFB", marginBottom: 4 },
  productMeta: { fontSize: 12, color: "#6B7280" },
  noteText: { fontSize: 12, color: "#4B5563", fontStyle: "italic", marginBottom: 6 },
  estimatedText: { fontSize: 12, color: "#EAB308", marginBottom: 6 },
  cancelBox: { backgroundColor: "#1C0A0A", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#EF444433" },
  cancelBoxLabel: { fontSize: 11, color: "#EF4444", fontWeight: "700", marginBottom: 2 },
  cancelBoxText: { fontSize: 12, color: "#F87171" },
  readyBanner: { backgroundColor: "#052e16", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#10B98133" },
  readyBannerText: { fontSize: 13, color: "#10B981", fontWeight: "600", textAlign: "center" },
  cancelBtn: { backgroundColor: "#1C0A0A", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: "#EF444433" },
  cancelBtnText: { fontSize: 13, color: "#EF4444", fontWeight: "700" },
  expandHint: { textAlign: "center", color: "#374151", fontSize: 11, marginTop: 8 },
  guestTitle: { fontSize: 22, fontWeight: "800", color: "#F9FAFB", marginBottom: 8, textAlign: "center" },
  guestSub: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24 },
  loginBtn: { backgroundColor: "#EAB308", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30 },
  loginBtnText: { fontSize: 15, fontWeight: "700", color: "#0A0A0A" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#F9FAFB", marginBottom: 8, textAlign: "center" },
  emptySub: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24 },
  shopBtn: { backgroundColor: "#EAB308", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  shopBtnText: { fontSize: 14, fontWeight: "700", color: "#0A0A0A" },
  reviewBtn: { backgroundColor: "#1A1A0A", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: "#EAB30833" },
  reviewBtnText: { fontSize: 13, color: "#EAB308", fontWeight: "700" },
});
