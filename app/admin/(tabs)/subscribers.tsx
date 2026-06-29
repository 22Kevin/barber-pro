import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
  cash:        "Dinheiro",
  credit:      "Crédito",
  debit:       "Débito",
  pix:         "Pix",
  credit_card: "Cartão Crédito",
  other:       "Outro",
};

function formatDate(d: string) {
  if (!d) return "-";
  const parts = d.split("-");
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

function parseIds(json: string | null | undefined): number[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export default function SubscribersScreen() {
  const { barber } = useBarberAuth();
  const colors = useColors();
  const tenantId = barber?.tenantId ?? 0;
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [editingSub, setEditingSub] = useState<any>(null);
  const [editSvcIds, setEditSvcIds] = useState<number[]>([]);
  const [editPrdIds, setEditPrdIds] = useState<number[]>([]);

  const subsQuery = trpc.subscriptionPlans.listSubscriptions.useQuery(
    { tenantId, status: statusFilter },
    { enabled: !!tenantId }
  );

  const planItemsQuery = trpc.subscriptionPlans.getPlanItems.useQuery(
    { planId: editingSub?.planId ?? 0 },
    { enabled: !!editingSub?.planId }
  );

  const cancelMutation = trpc.subscriptionPlans.cancelSubscription.useMutation({
    onSuccess: () => {
      utils.subscriptionPlans.listSubscriptions.invalidate({ tenantId });
      setSelectedSub(null);
      AppAlert.alert("Assinatura cancelada", "A assinatura foi cancelada com sucesso.");
    },
    onError: (e: any) => AppAlert.alert("Erro", e.message),
  });

  const updateMutation = trpc.subscriptionPlans.updateSubscription.useMutation({
    onSuccess: () => {
      utils.subscriptionPlans.listSubscriptions.invalidate({ tenantId });
      setEditingSub(null);
      AppAlert.alert("Atualizado!", "Os servicos/produtos foram atualizados.");
    },
    onError: (e: any) => AppAlert.alert("Erro", e.message),
  });

  const subs = subsQuery.data ?? [];

  function handleCancel(sub: any) {
    AppAlert.alert(
      "Cancelar assinatura",
      "Tem certeza que deseja cancelar a assinatura de " + sub.clientName + " no plano " + sub.planName + "?",
      [
        { text: "Nao", style: "cancel" },
        { text: "Cancelar assinatura", style: "destructive", onPress: () => cancelMutation.mutate({ id: sub.id, tenantId }) },
      ]
    );
  }

  function openEdit(sub: any) {
    setEditingSub(sub);
    setEditSvcIds(parseIds(sub.selectedServiceIds));
    setEditPrdIds(parseIds(sub.selectedProductIds));
  }

  function toggleId(arr: number[], id: number) {
    return arr.includes(id) ? arr.filter((x: number) => x !== id) : [...arr, id];
  }

  function handleSaveEdit() {
    updateMutation.mutate({
      id: editingSub.id,
      tenantId,
      selectedServiceIds: editSvcIds,
      selectedProductIds: editPrdIds,
    });
  }

  return (
    <ScreenContainer>
      <AdminHeader title="Assinantes" />
      <View style={[s.filterRow, { borderBottomColor: colors.border }]}>
        {(["active", "all", "cancelled", "expired"] as StatusFilter[]).map((f) => (
          <Pressable key={f} style={[s.filterBtn, statusFilter === f && s.filterBtnActive]} onPress={() => setStatusFilter(f)}>
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
          keyExtractor={(item: any) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }: { item: any }) => {
            const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.active;
            const isSelected = selectedSub?.id === item.id;
            const svcIds = parseIds(item.selectedServiceIds);
            const prdIds = parseIds(item.selectedProductIds);
            return (
              <Pressable
                style={[s.card, { backgroundColor: colors.surface, borderColor: isSelected ? "#C9A84C" : colors.border }]}
                onPress={() => setSelectedSub(isSelected ? null : item)}
              >
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.clientName, { color: colors.foreground }]}>{item.clientName}</Text>
                    <Text style={[s.planName, { color: "#C9A84C" }]}>{item.planName}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: st.color + "22", borderColor: st.color + "55" }]}>
                    <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={s.infoRow}>
                  <View style={s.infoItem}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>Valor</Text>
                    <Text style={[s.infoValue, { color: colors.foreground }]}>{"R$ " + parseFloat(item.price).toFixed(2)}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>Pagamento</Text>
                    <Text style={[s.infoValue, { color: colors.foreground }]}>{PAYMENT_LABEL[item.paymentMethod] ?? item.paymentMethod}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>Sessoes</Text>
                    <Text style={[s.infoValue, { color: colors.foreground }]}>{(item.usedRecurrences ?? 0) + "/" + item.planRecurrences + "x"}</Text>
                  </View>
                </View>

                {svcIds.length > 0 && (
                  <View style={[s.itemsRow, { borderTopColor: colors.border }]}>
                    <Text style={[s.itemsLabel, { color: colors.muted }]}>
                      ✂ {item.selectedServiceNames?.length > 0
                        ? item.selectedServiceNames.join(" · ")
                        : svcIds.length + " serviço(s)"}
                    </Text>
                  </View>
                )}
                {prdIds.length > 0 && (
                  <View style={[s.itemsRow, { borderTopColor: colors.border }]}>
                    <Text style={[s.itemsLabel, { color: colors.muted }]}>
                      📦 {item.selectedProductNames?.length > 0
                        ? item.selectedProductNames.join(" · ")
                        : prdIds.length + " produto(s)"}
                    </Text>
                  </View>
                )}

                <View style={[s.cycleRow, { borderTopColor: colors.border }]}>
                  <Text style={[s.cycleText, { color: colors.muted }]}>{"Ciclo: " + formatDate(item.cycleStart) + " -> " + formatDate(item.cycleEnd)}</Text>
                  {item.barberName && <Text style={[s.cycleText, { color: colors.muted }]}>{"Barbeiro: " + item.barberName}</Text>}
                </View>

                {isSelected && (
                  <View style={[s.actions, { borderTopColor: colors.border }]}>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#C9A84C22", borderColor: "#C9A84C55", borderWidth: 1 }]} onPress={() => openEdit(item)}>
                      <Text style={{ color: "#C9A84C", fontSize: 13, fontWeight: "600" }}>Editar servicos/produtos</Text>
                    </TouchableOpacity>
                    {item.clientPhone && (
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#25D36618" }]} onPress={() => {
                        const { Linking } = require("react-native");
                        const msg = encodeURIComponent("Ola " + item.clientName + "! Passando para confirmar sua assinatura do plano " + item.planName + ".");
                        Linking.openURL("https://wa.me/55" + item.clientPhone.replace(/\D/g, "") + "?text=" + msg);
                      }}>
                        <Text style={{ color: "#25D366", fontSize: 13, fontWeight: "600" }}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                    {item.status === "active" && (
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#EF444418" }]} onPress={() => handleCancel(item)} disabled={cancelMutation.isPending}>
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

      <Modal visible={!!editingSub} transparent animationType="slide" onRequestClose={() => setEditingSub(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: colors.surface }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Editar Servicos e Produtos</Text>
              <TouchableOpacity onPress={() => setEditingSub(null)}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { color: colors.muted }]}>{editingSub?.clientName} - {editingSub?.planName}</Text>

            {planItemsQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {(planItemsQuery.data?.services ?? []).length > 0 && (
                  <>
                    <Text style={[s.sectionLabel, { color: colors.muted }]}>SERVICOS DO PLANO</Text>
                    {(planItemsQuery.data?.services ?? []).map((svc: any) => {
                      const sel = editSvcIds.includes(Number(svc.id));
                      return (
                        <Pressable key={svc.id} style={[s.itemRow, { borderColor: sel ? "#C9A84C" : colors.border, backgroundColor: sel ? "#C9A84C11" : "transparent" }]}
                          onPress={() => setEditSvcIds(toggleId(editSvcIds, Number(svc.id)))}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.itemName, { color: colors.foreground }]}>{svc.name}</Text>
                            <Text style={{ color: colors.muted, fontSize: 12 }}>{svc.duration} min - R$ {parseFloat(svc.price).toFixed(2)}</Text>
                          </View>
                          {sel && <IconSymbol name="checkmark.circle.fill" size={20} color="#C9A84C" />}
                        </Pressable>
                      );
                    })}
                  </>
                )}
                {(planItemsQuery.data?.products ?? []).length > 0 && (
                  <>
                    <Text style={[s.sectionLabel, { color: colors.muted, marginTop: 12 }]}>PRODUTOS DO PLANO</Text>
                    {(planItemsQuery.data?.products ?? []).map((prd: any) => {
                      const sel = editPrdIds.includes(Number(prd.id));
                      return (
                        <Pressable key={prd.id} style={[s.itemRow, { borderColor: sel ? "#C9A84C" : colors.border, backgroundColor: sel ? "#C9A84C11" : "transparent" }]}
                          onPress={() => setEditPrdIds(toggleId(editPrdIds, Number(prd.id)))}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.itemName, { color: colors.foreground }]}>{prd.name}</Text>
                            <Text style={{ color: colors.muted, fontSize: 12 }}>R$ {parseFloat(prd.price).toFixed(2)}</Text>
                          </View>
                          {sel && <IconSymbol name="checkmark.circle.fill" size={20} color="#C9A84C" />}
                        </Pressable>
                      );
                    })}
                  </>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={[s.saveBtn, { opacity: updateMutation.isPending ? 0.6 : 1 }]} onPress={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={s.saveBtnText}>Salvar alteracoes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  itemsRow: { borderTopWidth: 1, paddingTop: 6, marginBottom: 4 },
  itemsLabel: { fontSize: 11 },
  cycleRow: { borderTopWidth: 1, paddingTop: 8, gap: 2 },
  cycleText: { fontSize: 11 },
  actions: { borderTopWidth: 1, marginTop: 10, paddingTop: 10, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  modalSub: { fontSize: 13, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  itemName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "700" },
});
