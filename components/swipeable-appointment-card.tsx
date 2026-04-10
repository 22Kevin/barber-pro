import { useRef } from "react";
import { Animated, StyleSheet, Text, View, Pressable, Platform, Linking } from "react-native";
import {
  Swipeable,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { cancelReviewNotification } from "@/lib/use-notifications";
import { buildConfirmationMessage } from "@/lib/whatsapp";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:   { label: "Agendado",       color: "#C9A84C" },
  confirmed:   { label: "Confirmado",     color: "#4CAF50" },
  in_progress: { label: "Em andamento",   color: "#2196F3" },
  completed:   { label: "Concluído",      color: "#888880" },
  cancelled:   { label: "Cancelado",      color: "#F44336" },
  no_show:     { label: "Não compareceu", color: "#FF9800" },
};

/**
 * Retorna o próximo status positivo baseado no status atual.
 * scheduled → confirmed → completed
 */
function getNextPositiveStatus(current: string): string | null {
  if (current === "scheduled") return "confirmed";
  if (current === "confirmed") return "completed";
  return null;
}

interface Props {
  appointment: any;
  /** @deprecated Use appointment.clientName e appointment.clientPhone diretamente */
  client?: any;
  /** @deprecated Use appointment.serviceName diretamente */
  service?: any;
  onPress: () => void;
  onStatusChange: (id: number, status: string) => void;
  /** Chamado quando o agendamento é concluído via swipe — abre modal de pagamento */
  onCompleted?: (appointment: any) => void;
  /** Se true, exibe badge de pagamento pendente no card */
  paymentPending?: boolean;
  /** Chamado ao cancelar com motivo (substitui o swipe de cancelar quando fornecido) */
  onCancelWithReason?: (id: number) => void;
}
export function SwipeableAppointmentCard({ appointment, client, service, onPress, onStatusChange, onCompleted, paymentPending, onCancelWithReason }: Props) {
  // Suporta dados via JOIN (apt.clientName) ou via props legadas (client?.name)
  const resolvedClientName = appointment.clientName ?? client?.name ?? "Cliente não encontrado";
  const resolvedClientPhone = appointment.clientPhone ?? client?.phone;
  const resolvedServiceName = appointment.serviceName ?? service?.name ?? "Serviço";
  const swipeRef = useRef<Swipeable>(null);
  const status = STATUS_CONFIG[appointment.status] ?? { label: appointment.status, color: "#888880" };
  const nextPositive = getNextPositiveStatus(appointment.status);

  function handleSwipeRight() {
    if (!nextPositive) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
    }
    swipeRef.current?.close();
    onStatusChange(appointment.id, nextPositive);
    // Se está concluindo (confirmed → completed), abre modal de pagamento
    if (nextPositive === "completed" && onCompleted) {
      // Pequeno delay para o status ser atualizado antes de abrir o modal
      setTimeout(() => onCompleted(appointment), 400);
    }
  }

  function handleSwipeLeft(action: "cancelled" | "no_show") {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => null);
    }
    swipeRef.current?.close();
    if (action === "cancelled") {
      cancelReviewNotification(appointment.id).catch(() => null);
      if (onCancelWithReason) {
        onCancelWithReason(appointment.id);
        return;
      }
    }
    onStatusChange(appointment.id, action);
  }
  function handleWhatsApp() {
    const phone = resolvedClientPhone?.replace(/\D/g, "");
    if (!phone) return;
    const intlPhone = phone.startsWith("55") ? phone : `55${phone}`;
    // Monta mensagem de confirmação com dados do agendamento
    const message = buildConfirmationMessage({
      clientName: resolvedClientName,
      clientPhone: phone,
      serviceName: resolvedServiceName,
      barberName: appointment.barberName ?? "",
      date: appointment.date ?? "",
      startTime: appointment.startTime ?? "",
      endTime: appointment.endTime ?? "",
    });
    const encodedMsg = encodeURIComponent(message);
    Linking.openURL(`https://wa.me/${intlPhone}?text=${encodedMsg}`).catch(() => null);
  }

  // Ação direita (positiva) — só mostra se há próximo status positivo
  const renderRightAction = (progress: Animated.AnimatedInterpolation<number>) => {
    if (!nextPositive) return null;
    const nextCfg = STATUS_CONFIG[nextPositive];
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
    return (
      <Animated.View style={[styles.swipeAction, styles.swipeRight, { transform: [{ scale }] }]}>
        <Pressable style={styles.swipeBtn} onPress={handleSwipeRight}>
          <IconSymbol name="checkmark.circle.fill" size={26} color="#fff" />
          <Text style={styles.swipeLabel}>{nextCfg.label}</Text>
        </Pressable>
      </Animated.View>
    );
  };

  // Ação esquerda (negativa) — Cancelar e Não compareceu
  const renderLeftAction = (progress: Animated.AnimatedInterpolation<number>) => {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
    return (
      <Animated.View style={[styles.swipeLeftContainer, { transform: [{ scale }] }]}>
        <Pressable style={[styles.swipeBtn, styles.swipeNoShow]} onPress={() => handleSwipeLeft("no_show")}>
          <IconSymbol name="person.fill.xmark" size={22} color="#fff" />
          <Text style={styles.swipeLabel}>Não veio</Text>
        </Pressable>
        <Pressable style={[styles.swipeBtn, styles.swipeCancel]} onPress={() => handleSwipeLeft("cancelled")}>
          <IconSymbol name="xmark.circle.fill" size={22} color="#fff" />
          <Text style={styles.swipeLabel}>Cancelar</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const isTerminal = appointment.status === "completed" || appointment.status === "cancelled" || appointment.status === "no_show";

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={!isTerminal ? renderRightAction : undefined}
      renderLeftActions={!isTerminal ? renderLeftAction : undefined}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
    >
      <Pressable
        style={({ pressed }) => [styles.aptCard, pressed && { opacity: 0.85 }]}
        onPress={onPress}
      >
        <View style={[styles.aptStatusBar, { backgroundColor: status.color }]} />
        <View style={styles.aptContent}>
          <View style={styles.aptRow}>
            <Text style={styles.aptTime}>{appointment.startTime} – {appointment.endTime}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color + "22" }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={styles.aptClientName}>{resolvedClientName}</Text>
          <Text style={styles.aptServiceName}>{resolvedServiceName}</Text>
          {appointment.notes ? <Text style={styles.aptNotes}>{appointment.notes}</Text> : null}
          <View style={styles.bottomRow}>
            {!isTerminal && (
              <Text style={styles.swipeHint}>
                {nextPositive ? `← Cancelar  |  ${STATUS_CONFIG[nextPositive].label} →` : "← Cancelar / Não veio"}
              </Text>
            )}
            {resolvedClientPhone && !isTerminal && (
              <Pressable
                onPress={handleWhatsApp}
                style={({ pressed }) => [styles.whatsappBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.whatsappBtnText}>📱 WhatsApp</Text>
              </Pressable>
            )}
            {appointment.status === "completed" && paymentPending && (
              <View style={styles.paymentBadge}>
                <Text style={styles.paymentBadgeText}>⏳ Pagamento pendente</Text>
              </View>
            )}
            {appointment.status === "completed" && !paymentPending && (
              <View style={[styles.paymentBadge, styles.paymentBadgePaid]}>
                <Text style={[styles.paymentBadgeText, { color: "#32BCAD" }]}>✓ Pago</Text>
              </View>
            )}
          </View>
        </View>
        <IconSymbol name="chevron.right" size={16} color="#555" />
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  aptCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  aptStatusBar: { width: 4, alignSelf: "stretch" },
  aptContent: { flex: 1, padding: 14 },
  aptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  aptTime: { fontSize: 15, fontWeight: "700", color: "#F5F5F0" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  aptClientName: { fontSize: 14, fontWeight: "600", color: "#F5F5F0" },
  aptServiceName: { fontSize: 13, color: "#888880" },
  aptNotes: { fontSize: 12, color: "#555", marginTop: 4, fontStyle: "italic" },
  swipeHint: { fontSize: 10, color: "#444", marginTop: 6, fontStyle: "italic" },
  // Swipe actions
  swipeAction: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  swipeRight: {
    backgroundColor: "#4CAF50",
    width: 90,
    marginRight: 16,
  },
  swipeLeftContainer: {
    flexDirection: "row",
    marginLeft: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  swipeBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  swipeNoShow: { backgroundColor: "#FF9800" },
  swipeCancel: { backgroundColor: "#F44336" },
  swipeLabel: { color: "#fff", fontSize: 10, fontWeight: "700" },
  bottomRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 },
  paymentBadge: {
    backgroundColor: "#F59E0B22",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#F59E0B44",
  },
  paymentBadgePaid: {
    backgroundColor: "#32BCAD22",
    borderColor: "#32BCAD44",
  },
  paymentBadgeText: { fontSize: 10, fontWeight: "700", color: "#F59E0B" },
  whatsappBtn: {
    backgroundColor: "#25D36622",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#25D36644",
  },
  whatsappBtnText: { fontSize: 10, fontWeight: "700", color: "#25D366" },
});
