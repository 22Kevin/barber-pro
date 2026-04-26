import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { trpc } from "@/lib/trpc";
import { cancelAppointmentReminder } from "@/lib/use-notifications";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:        { label: "Agendado",            color: "#EAB308", bg: "#1F1500" },
  confirmed:        { label: "Confirmado",           color: "#22C55E", bg: "#052e16" },
  in_progress:      { label: "Em andamento",         color: "#3B82F6", bg: "#0c1a2e" },
  completed:        { label: "Concluído",            color: "#9CA3AF", bg: "#111827" },
  cancelled:        { label: "Cancelado",            color: "#EF4444", bg: "#1c0a0a" },
  no_show:          { label: "Não compareceu",       color: "#F97316", bg: "#1c0e00" },
  pending_approval: { label: "⏳ Aguarda aprovação", color: "#FF6B35", bg: "#1A0D00" },
};

// ─── Modal de avaliação ───────────────────────────────────────────────────────
function ReviewModal({ appointment, onClose }: { appointment: any; onClose: () => void }) {
  const { client } = useClientAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const createReview = trpc.reviews.create.useMutation({
    onSuccess: () => { Alert.alert("Obrigado!", "Sua avaliação foi enviada."); onClose(); },
    onError: (err: any) => Alert.alert("Erro", err.message),
  });

  if (!client) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        {/* Handle */}
        <View style={styles.modalHandle} />

        <Text style={styles.modalTitle}>Avaliar serviço</Text>
        <Text style={styles.modalSubtitle}>{appointment.serviceName ?? "Serviço"}</Text>

        <Text style={styles.modalLabel}>Sua nota</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
              <Text style={[styles.starIcon, { color: s <= rating ? "#EAB308" : "#374151" }]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.modalLabel}>Comentário (opcional)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Como foi sua experiência?"
          placeholderTextColor="#4B5563"
          multiline
          numberOfLines={3}
          style={styles.modalInput}
        />

        <View style={styles.modalButtons}>
          <TouchableOpacity onPress={onClose} style={styles.modalBtnCancel}>
            <Text style={styles.modalBtnCancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => createReview.mutate({
              tenantId: client.tenantId ?? 0,
              clientId: client.id,
              serviceId: appointment.serviceId,
              appointmentId: appointment.id,
              rating,
              comment: comment || undefined,
            })}
            disabled={createReview.isPending}
            style={styles.modalBtnConfirm}
          >
            <Text style={styles.modalBtnConfirmText}>
              {createReview.isPending ? "Enviando..." : "Enviar avaliação"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Card de agendamento ──────────────────────────────────────────────────────
function AppointmentCard({
  item,
  tab,
  onReview,
  onCancel,
}: {
  item: any;
  tab: "upcoming" | "past";
  onReview: () => void;
  onCancel: () => void;
}) {
  const status = STATUS_LABELS[item.status] ?? STATUS_LABELS.scheduled;
  const date = new Date(item.date + "T12:00:00");

  return (
    <View style={styles.card}>
      {/* Linha superior: serviço + badge status */}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardService}>{item.serviceName ?? "Serviço"}</Text>
          <Text style={styles.cardBarber}>✂️  {item.barberName ?? "Barbeiro"}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Linha de data e hora */}
      <View style={styles.cardMeta}>
        <View style={styles.cardMetaItem}>
          <Text style={styles.cardMetaIcon}>📅</Text>
          <Text style={styles.cardMetaText}>
            {date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
          </Text>
        </View>
        <View style={styles.cardMetaItem}>
          <Text style={styles.cardMetaIcon}>⏰</Text>
          <Text style={styles.cardMetaText}>{item.startTime}</Text>
        </View>
        {item.price && (
          <View style={styles.cardMetaItem}>
            <Text style={styles.cardMetaIcon}>💰</Text>
            <Text style={styles.cardMetaText}>R$ {parseFloat(item.price).toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Motivo de cancelamento */}
      {item.status === "cancelled" && item.cancelReason && (
        <View style={styles.cancelReasonBox}>
          <Text style={styles.cancelReasonLabel}>Cancelado pelo barbeiro</Text>
          <Text style={styles.cancelReasonText}>{item.cancelReason}</Text>
        </View>
      )}
      {/* Ações */}
      {item.status === "completed" && (
        <TouchableOpacity onPress={onReview} style={styles.cardAction}>
          <Text style={styles.cardActionGold}>⭐  Avaliar este serviço</Text>
        </TouchableOpacity>
      )}
      {(item.status === "scheduled" || item.status === "confirmed") && tab === "upcoming" && (
        <TouchableOpacity onPress={onCancel} style={styles.cardAction}>
          <Text style={styles.cardActionRed}>✕  Cancelar agendamento</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function ClientHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { client, isAuthenticated } = useClientAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [reviewAppt, setReviewAppt] = useState<any>(null);

  // Fade-in de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  const cancelMutation = trpc.appointments.update.useMutation({
    onSuccess: (_data: unknown, variables: any) => {
      cancelAppointmentReminder(variables.id).catch(() => null);
      appointmentsQuery.refetch();
      Alert.alert("Agendamento cancelado", "Seu agendamento foi cancelado com sucesso.");
    },
    onError: (err: any) => Alert.alert("Erro", err.message),
  });

  const handleCancel = (appt: any) => {
    Alert.alert(
      "Cancelar agendamento",
      `Deseja cancelar o agendamento de ${appt.serviceName ?? "serviço"} em ${appt.date} às ${appt.startTime}?`,
      [
        { text: "Não", style: "cancel" },
        { text: "Sim, cancelar", style: "destructive", onPress: () => cancelMutation.mutate({ id: appt.id, status: "cancelled" }) },
      ]
    );
  };

  const appointmentsQuery = trpc.clients.appointments.useQuery(
    { clientId: client?.id ?? 0 },
    { enabled: !!client }
  );

  // ── Não autenticado ──────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
        <Animated.View style={[{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }, { opacity: fadeAnim }]}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>📋</Text>
          <Text style={styles.guestTitle}>Meus Agendamentos</Text>
          <Text style={styles.guestSubtitle}>
            Faça login para ver seus próximos agendamentos e histórico de cortes.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/client/login" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>Fazer login</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    );
  }

  const now = new Date();
  const allAppts = appointmentsQuery.data ?? [];
  const upcoming = allAppts.filter((a: any) => {
    const d = new Date(a.date + "T" + a.startTime);
    return d >= now && a.status !== "cancelled" && a.status !== "no_show";
  });
  const past = allAppts.filter((a: any) => {
    const d = new Date(a.date + "T" + a.startTime);
    return d < now || a.status === "cancelled" || a.status === "no_show" || a.status === "completed";
  });
  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Meus Agendamentos</Text>
            <Text style={styles.headerSubtitle}>Próximos e histórico de cortes</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: "#1F2937", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#374151" }}
            onPress={() => router.push("/client/my-orders" as any)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 11, color: "#EAB308", fontWeight: "700" }}>📦 Encomendas</Text>
          </TouchableOpacity>
        </View>

        {/* ── Toggle próximos / histórico ─────────────────────────────────── */}
        <View style={styles.toggleWrapper}>
          <View style={styles.toggleTrack}>
            {([
              { key: "upcoming", label: `Próximos (${upcoming.length})` },
              { key: "past",     label: `Histórico (${past.length})` },
            ] as const).map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.toggleBtn, tab === t.key && styles.toggleBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleBtnText, tab === t.key && styles.toggleBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Lista ──────────────────────────────────────────────────────── */}
        {appointmentsQuery.isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Carregando...</Text>
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>{tab === "upcoming" ? "📅" : "📋"}</Text>
            <Text style={styles.emptyStateText}>
              {tab === "upcoming"
                ? "Nenhum agendamento próximo."
                : "Nenhum histórico ainda."}
            </Text>
            {tab === "upcoming" && (
              <TouchableOpacity
                style={styles.bookNowButton}
                onPress={() => router.push("/client/book" as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.bookNowText}>✂️  Agendar agora</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <AppointmentCard
                item={item}
                tab={tab}
                onReview={() => setReviewAppt(item)}
                onCancel={() => handleCancel(item)}
              />
            )}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarHeight + 16 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {reviewAppt && <ReviewModal appointment={reviewAppt} onClose={() => setReviewAppt(null)} />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#EAB308",
    fontWeight: "800",
    fontSize: 26,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 2,
  },

  // ── Toggle ───────────────────────────────────────────────────────────────────
  toggleWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  toggleTrack: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#EAB308",
  },
  toggleBtnText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 13,
  },
  toggleBtnTextActive: {
    color: "#000",
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardService: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
  },
  cardBarber: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 3,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardMetaIcon: {
    fontSize: 13,
  },
  cardMetaText: {
    color: "#D1D5DB",
    fontSize: 13,
  },
  cardAction: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
  },
  cardActionGold: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 14,
  },
  cardActionRed: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 14,
  },
  cancelReasonBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
    backgroundColor: "#1c0a0a",
    borderRadius: 10,
    padding: 12,
  },
  cancelReasonLabel: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cancelReasonText: {
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Estado vazio ─────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyStateIcon: {
    fontSize: 52,
  },
  emptyStateText: {
    color: "#6B7280",
    fontSize: 16,
    textAlign: "center",
  },
  bookNowButton: {
    backgroundColor: "#EAB308",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  bookNowText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 15,
  },

  // ── Guest (não autenticado) ───────────────────────────────────────────────────
  guestTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 22,
    textAlign: "center",
    marginBottom: 8,
  },
  guestSubtitle: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  loginButton: {
    backgroundColor: "#EAB308",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 40,
  },
  loginButtonText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
  },

  // ── Modal de avaliação ────────────────────────────────────────────────────────
  modalOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  modalSheet: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: "#1F2937",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#374151",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 20,
    marginBottom: 4,
  },
  modalSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 20,
  },
  modalLabel: {
    color: "#D1D5DB",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  starIcon: {
    fontSize: 38,
  },
  modalInput: {
    backgroundColor: "#1F2937",
    color: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#374151",
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtnCancel: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  modalBtnCancelText: {
    color: "#9CA3AF",
    fontWeight: "600",
    fontSize: 15,
  },
  modalBtnConfirm: {
    flex: 1,
    backgroundColor: "#EAB308",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalBtnConfirmText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 15,
  },
});
