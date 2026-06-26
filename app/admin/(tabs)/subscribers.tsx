import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useBarberAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { AppAlert } from "@/components/app-alert";
import { IconSymbol } from "@/components/ui/icon-symbol";

type StatusFilter = "active" | "cancelled" | "expired" | "all";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: "Ativa",     color: "#22C55E" },
  cancelled: { label: "Cancelada", color: "#EF4444" },
  expired:   { label: "Expirada",  color: "#F59E0B" },
  pending:   { label: "Pendente",  color: "#888" },
};

const PAYMENT_LABEL: Record<string, string> = {
  cash:   "Dinheiro",
  credit: "Crédito",
  debit:  "Débito",
  pix:    "Pix",
  other:  "Outro",
};

export default function SubscribersScreen() {
  const { barber } = useBarberAuth();
  const colors = useColors();
  const tenantId = barber?.tenantId ?? 0;
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [selectedSub, setSelectedSub] = useState<any>(null);

  const subsQuery = trpc.subscriptionPlans.listSubscriptions.useQuery(
    { tenantId, status: statusFilter },
    { enabled: !!tenantId }
  );

  const cancelMutation = trpc.subscriptionPlans.cancelSubscription.useMutation({
    onSuccess: () => {
      utils.subscriptionPlans.listSubscriptions.invalidate({ tenantId });
      setSelectedSub(null);
      AppAlert.alert("Assinatura cancelada", "A assinatura foi cancelada com sucesso.");
    },
    onError: (e) => AppAlert.alert("Erro", e.message),
  });

  const subs = subsQuery.data ?? [];

  function formatDate(d: string) {
    if (!d) return "-";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }

  function handleCancel(sub: any) {
    AppAlert.alert(
      "Cancelar assinatura",
      `Tem certeza que deseja cancelar a assinatura de ${sub.clientName} no plano ${sub.planName}?`,
      [
        { text: "Não", style: "cancel" },
        {
          text: "Cancelar assinatura",
          style: "destructive",
          onPress: () => cancelMutation.mutate({ id: sub.id, tenantId }),
        },
      ]
    );
  }

  return (
    <ScreenContainer>
      <AdminHeader title="Assinantes" />

      {/* Filter tabs */}
      <View style={[s.filterRow, { borderBottomColor: colors.border }]}>
        {(["active", "all", "cancelled", "expired"] as StatusFilter[]).map((f) => (
          <Pressable
            key={f}
            style={[s.filterBtn, statusFilter === f && s.filterBtnActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[s.filterText, statusFilter === f && s.filterTextActive]}>
              {f === "active" ? "Ativas" : f === "all" ? "Todas" : f === "cancelled" ? "Canceladas" : "Expiradas"}
            </Text>
          </Pressable>
        ))}
      </View>

      {subsQuery.isLoading ? (
        <View style={s.center}><ActivityIndicator color="#C9A84C" /></View>
      ) : subs.length === 0 ? (
        <View style={s.center}>
          <IconSymbol name="person.badge.clock" size={48} color="#333" />
          <Text style={[s.emptyText, { color: colors.muted }]}>Nenhuma assinatura encontrada</Text>
        </View>
      ) : (
        <FlatList
          data={subs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.active;
            const isSelected = selectedSub?.id === item.id;
            return (
              <Pressable
                style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }, isSelected && { borderColor: "#C9A84C" }]}
                onPress={() => setSelectedSub(isSelected ? null : item)}
              >
                {/* Header */}
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.clientName, { color: colors.foreground }]}>{item.clientName}</Text>
                    <Text style={[s.planName, { color: "#C9A84C" }]}>{item.planName}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: st.color + "22", borderColor: st.color + "55" }]}>
                    <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Info row */}
                <View style={s.infoRow}>
                  <View style={s.infoItem}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>Valor</Text>
                    <Text style={[s.infoValue, { color: colors.foreground }]}>R$ {parseFloat(item.price).toFixed(2)}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>Pagamento</Text>
                    <Text style={[s.infoValue, { color: colors.foreground }]}>{PAYMENT_LABEL[item.paymentMethod] ?? item.paymentMethod}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>Sessões</Text>
                    <Text style={[s.infoValue, { color: colors.foreground }]}>{item.usedRecurrences ?? 0}/{item.planRecurrences}x</Text>
                  </View>
                </View>

                {/* Cycle dates */}
                <View style={[s.cycleRow, { borderTopColor: colors.border }]}>
                  <Text style={[s.cycleText, { color: colors.muted }]}>
                    Ciclo: {formatDate(item.cycleStart)} → {formatDate(item.cycleEnd)}
                  </Text>
                  {item.barberName && (
                    <Text style={[s.cycleText, { color: colors.muted }]}>Barbeiro: {item.barberName}</Text>
                  )}
                </View>

                {/* Expanded actions */}
                {isSelected && (
                  <View style={[s.actions, { borderTopColor: colors.border }]}>
                    {item.clientPhone && (
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: "#25D36618" }]}
                        onPress={() => {
                          const { Linking } = require("react-native");
                          const msg = encodeURIComponent(`Olá ${item.clientName}! Passando para confirmar sua assinatura do plano ${item.planName}.`);
                          Linking.openURL(`https://wa.me/55${item.clientPhone.replace(/\D/g, "")}?text=${msg}`);
                        }}
                      >
                        <Text style={{ color: "#25D366", fontSize: 13, fontWeight: "600" }}>📱 WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                    {item.status === "active" && (
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: "#EF444418" }]}
                        onPress={() => handleCancel(item)}
                        disabled={cancelMutation.isPending}
                      >
                        <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}>Cancelar assinatura</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1A1A1A" },
  filterBtnActive: { backgroundColor: "#C9A84C" },
  filterText: { fontSize: 12, fontWeight: "600", color: "#888" },
  filterTextActive: { color: "#0A0A0A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  clientName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  planName: { fontSize: 12, fontWeight: "600" },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  infoItem: { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 8, padding: 8, alignItems: "center" },
  infoLabel: { fontSize: 10, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: "700" },
  cycleRow: { borderTopWidth: 1, paddingTop: 8, gap: 2 },
  cycleText: { fontSize: 11 },
  actions: { borderTopWidth: 1, marginTop: 10, paddingTop: 10, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
});
