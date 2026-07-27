import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { AppAlert } from "@/components/app-alert";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

const GOLD = "#C9A84C";
const BG = "#0A0A0A";
const SURFACE = "#111111";
const BORDER = "#2A2A2A";
const MUTED = "#9BA1A6";
const TEXT = "#ECEDEE";
const PIX_TEAL = "#32BCAD";

function formatMoney(v: number) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function formatTimeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export default function PixPendentesScreen() {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const pendingQuery = trpc.asaasPayments.listPendingDirectPix.useQuery(undefined, {
    refetchInterval: 20000, // atualiza sozinho a cada 20s
  });

  const confirmMutation = trpc.asaasPayments.confirmDirectPix.useMutation({
    onSuccess: () => {
      setConfirmingId(null);
      pendingQuery.refetch();
      AppAlert.alert("Confirmado!", "O agendamento foi confirmado para o cliente.");
    },
    onError: (e) => {
      setConfirmingId(null);
      AppAlert.alert("Erro ao confirmar", e.message ?? "Tente novamente.");
    },
  });

  function handleConfirm(paymentId: number, clientName: string, amount: number) {
    AppAlert.alert(
      "Confirmar recebimento?",
      `Confirma que recebeu ${formatMoney(amount)} de ${clientName || "cliente"} via Pix na sua conta? Isso vai confirmar o agendamento dele automaticamente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => {
            setConfirmingId(paymentId);
            confirmMutation.mutate({ paymentId });
          },
        },
      ]
    );
  }

  const items: any[] = pendingQuery.data ?? [];

  return (
    <ScreenContainer containerClassName="bg-black">
      <AdminHeader title="Confirmar Pix" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={pendingQuery.isFetching} onRefresh={() => pendingQuery.refetch()} tintColor={GOLD} />}
      >
        <View style={styles.infoBox}>
          <IconSymbol name="info.circle.fill" size={16} color={PIX_TEAL} />
          <Text style={styles.infoText}>
            Esses pagamentos foram feitos direto na chave Pix da barbearia (sem passar pelo Asaas, sem taxa). Confirme aqui assim que ver o dinheiro cair na sua conta — isso libera o agendamento do cliente.
          </Text>
        </View>

        {pendingQuery.isLoading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <IconSymbol name="checkmark.circle.fill" size={40} color={MUTED} />
            <Text style={styles.emptyText}>Nenhum pagamento pendente de confirmação</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{item.clientName ?? "Cliente"}</Text>
                  <Text style={styles.timeAgo}>Gerado {formatTimeAgo(item.createdAt)}</Text>
                </View>
                <Text style={styles.amount}>{formatMoney(Number(item.amount))}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }, confirmingId === item.id && { opacity: 0.6 }]}
                disabled={confirmingId === item.id}
                onPress={() => handleConfirm(item.id, item.clientName, Number(item.amount))}
              >
                {confirmingId === item.id ? (
                  <ActivityIndicator color="#0A0A0A" size="small" />
                ) : (
                  <>
                    <IconSymbol name="checkmark" size={16} color="#0A0A0A" />
                    <Text style={styles.confirmBtnText}>Confirmar recebimento</Text>
                  </>
                )}
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  infoBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(50,188,173,0.08)",
    borderWidth: 1,
    borderColor: "rgba(50,188,173,0.3)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 12, color: TEXT, lineHeight: 18 },
  emptyCard: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { color: MUTED, fontSize: 14 },
  card: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  clientName: { fontSize: 15, fontWeight: "700", color: TEXT },
  timeAgo: { fontSize: 11, color: MUTED, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: "800", color: GOLD },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PIX_TEAL,
    borderRadius: 10,
    paddingVertical: 12,
  },
  confirmBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
});
