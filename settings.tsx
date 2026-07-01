import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KeyboardAwareForm } from "@/components/keyboard-aware-form";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { useColors } from "@/hooks/use-colors";
import { useBarberAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";

type PlanKey = "solo" | "team" | "studio";

const PLANS: { key: PlanKey; label: string; price: number; features: string[] }[] = [
  { key: "solo", label: "Solo", price: 49, features: ["1 barbeiro", "Agendamento online", "Financeiro"] },
  { key: "team", label: "Equipe", price: 89, features: ["Até 5 barbeiros", "Comissões", "Promoções"] },
  { key: "studio", label: "Estúdio", price: 149, features: ["Ilimitado", "Multi-unidade", "Suporte prioritário"] },
];

const PLAN_KEY_MAP: Record<string, PlanKey> = {
  Solo: "solo", Equipe: "team", "Estúdio": "studio",
  solo: "solo", team: "team", studio: "studio",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Ativa", color: "#4ADE80", bg: "#4ADE8022" },
  trial: { label: "Trial gratuito", color: "#FBBF24", bg: "#FBBF2422" },
  pending: { label: "Pendente", color: "#C9A84C", bg: "#C9A84C26" },
  expired: { label: "Expirado", color: "#F87171", bg: "#F8717122" },
  cancelled: { label: "Cancelado", color: "#888", bg: "#44444422" },
  overdue: { label: "Em atraso", color: "#F87171", bg: "#F8717122" },
};

// ─── Modal de Upgrade ─────────────────────────────────────────────────────────
function UpgradeModal({
  visible,
  currentPlan,
  tenantId,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  currentPlan: PlanKey | null;
  tenantId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selected, setSelected] = useState<PlanKey | null>(null);
  const utils = trpc.useUtils();

  const upgradeMutation = trpc.asaasPayments.upgradeBarberproSubscription.useMutation({
    onSuccess: async (data) => {
      utils.asaasPayments.getBarberproSubscription.invalidate({ tenantId });
      onSuccess();
      onClose();
      if (data?.paymentLink) {
        Linking.openURL(data.paymentLink);
      } else if (data?.pixCopyCola) {
        Alert.alert("Pix Copia e Cola", data.pixCopyCola, [{ text: "OK" }]);
      } else {
        Alert.alert("Plano atualizado!", "Seu plano foi alterado. Complete o pagamento Pix para ativar.");
      }
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const availablePlans = PLANS.filter((p) => p.key !== currentPlan);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={upgradeStyles.overlay}>
        <View style={upgradeStyles.sheet}>
          <View style={upgradeStyles.handle} />
          <Text style={upgradeStyles.title}>Alterar plano</Text>
          <Text style={upgradeStyles.subtitle}>Escolha o novo plano para sua barbearia</Text>

          {availablePlans.map((p) => {
            const isSelected = selected === p.key;
            return (
              <Pressable
                key={p.key}
                style={({ pressed }) => [
                  upgradeStyles.planCard,
                  isSelected && upgradeStyles.planCardActive,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => setSelected(p.key)}
              >
                <View style={[upgradeStyles.radio, isSelected && upgradeStyles.radioActive]}>
                  {isSelected && <View style={upgradeStyles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={upgradeStyles.planLabel}>{p.label}</Text>
                  <Text style={upgradeStyles.planFeatures}>{p.features.join(" · ")}</Text>
                </View>
                <Text style={upgradeStyles.planPrice}>R$ {p.price}/mês</Text>
              </Pressable>
            );
          })}

          <Pressable
            style={({ pressed }) => [
              upgradeStyles.confirmBtn,
              !selected && upgradeStyles.confirmBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => {
              if (!selected) return;
              Alert.alert(
                "Confirmar upgrade",
                `Alterar para o Plano ${PLANS.find((p) => p.key === selected)?.label}? Sua assinatura atual será cancelada e uma nova cobrança Pix será gerada.`,
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Confirmar",
                    onPress: () => upgradeMutation.mutate({ tenantId, newPlan: selected }),
                  },
                ]
              );
            }}
            disabled={!selected || upgradeMutation.isPending}
          >
            {upgradeMutation.isPending ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={upgradeStyles.confirmBtnText}>Confirmar upgrade</Text>
            )}
          </Pressable>

          <Pressable style={upgradeStyles.cancelBtn} onPress={onClose}>
            <Text style={upgradeStyles.cancelBtnText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const upgradeStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: "#333", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "800", color: "#ECEDEE", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#9BA1A6", marginBottom: 20 },
  planCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1A1A1A", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: "#2A2A2A" },
  planCardActive: { borderColor: "#C9A84C", backgroundColor: "#1A1500" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#444", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: "#C9A84C" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#C9A84C" },
  planLabel: { fontSize: 15, fontWeight: "700", color: "#ECEDEE" },
  planFeatures: { fontSize: 11, color: "#9BA1A6", marginTop: 2 },
  planPrice: { fontSize: 14, fontWeight: "700", color: "#C9A84C" },
  confirmBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 15, fontWeight: "800", color: "#000" },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontSize: 13, color: "#9BA1A6" },
});

// ─── Seção de Assinatura ──────────────────────────────────────────────────────
function SubscriptionSection() {
  const { barber } = useBarberAuth();
  const router = useRouter();
  const tenantId = barber?.tenantId ?? 0;
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: sub, isLoading, refetch } = trpc.asaasPayments.getBarberproSubscription.useQuery(
    { tenantId },
    { enabled: tenantId > 0, staleTime: 2 * 60 * 1000 }
  );

  const syncMutation = trpc.asaasPayments.syncBarberproSubscription.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const paymentLinkQuery = trpc.asaasPayments.getBarberproPaymentLink.useQuery(
    { tenantId },
    { enabled: false }
  );

  async function handlePayNow() {
    const result = await paymentLinkQuery.refetch();
    const data = result.data;
    if (data?.paymentLink) {
      Linking.openURL(data.paymentLink);
    } else if (data?.pixCopyCola) {
      Alert.alert("Pix Copia e Cola", data.pixCopyCola, [{ text: "OK" }]);
    } else {
      Alert.alert("Atenção", "Link de pagamento não disponível. Acesse o painel web para pagar.");
    }
  }

  if (tenantId === 0) return null;

  const statusInfo = STATUS_CONFIG[sub?.status ?? "trial"] ?? STATUS_CONFIG.trial;
  const planKey = sub?.planName ? PLAN_KEY_MAP[sub.planName] ?? null : null;
  const planLabel = PLANS.find((p) => p.key === planKey)?.label ?? sub?.planName ?? "—";
  const planPrice = sub?.planPrice ? `R$ ${sub.planPrice.toFixed(2).replace(".", ",")}/mês` : "—";
  const nextDue = sub?.nextDueDate ? new Date(sub.nextDueDate).toLocaleDateString("pt-BR") : null;
  const trialEnds = sub?.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString("pt-BR") : null;

  const isActive = sub?.status === "active";
  const isExpiredOrCancelled = sub?.status === "expired" || sub?.status === "cancelled";
  const isPending = sub?.status === "pending";
  const isTrial = sub?.status === "trial";

  return (
    <>
      <View style={subStyles.section}>
        <View style={subStyles.sectionHeader}>
          <IconSymbol name="creditcard.fill" size={18} color="#C9A84C" />
          <Text style={subStyles.sectionTitle}>Minha Assinatura</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
        ) : (
          <>
            {/* Status badge */}
            <View style={[subStyles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <View style={[subStyles.statusDot, { backgroundColor: statusInfo.color }]} />
              <Text style={[subStyles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>

            {/* Detalhes do plano */}
            {sub?.planName && sub.planName !== "starter" && (
              <View style={subStyles.detailsCard}>
                <View style={subStyles.detailRow}>
                  <Text style={subStyles.detailLabel}>Plano</Text>
                  <Text style={subStyles.detailValue}>{planLabel}</Text>
                </View>
                <View style={subStyles.divider} />
                <View style={subStyles.detailRow}>
                  <Text style={subStyles.detailLabel}>Valor</Text>
                  <Text style={subStyles.detailValue}>{planPrice}</Text>
                </View>
                {nextDue && (
                  <>
                    <View style={subStyles.divider} />
                    <View style={subStyles.detailRow}>
                      <Text style={subStyles.detailLabel}>Próximo vencimento</Text>
                      <Text style={subStyles.detailValue}>{nextDue}</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Trial info */}
            {isTrial && trialEnds && (
              <View style={subStyles.trialCard}>
                <IconSymbol name="clock.fill" size={14} color="#FBBF24" />
                <Text style={subStyles.trialText}>
                  Trial gratuito até{" "}
                  <Text style={{ fontWeight: "700", color: "#FBBF24" }}>{trialEnds}</Text>
                </Text>
              </View>
            )}

            {/* Ações */}
            <View style={subStyles.actions}>
              {(isExpiredOrCancelled || isTrial) && (
                <Pressable
                  style={({ pressed }) => [subStyles.ctaBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push("/admin/barberpro-paywall")}
                >
                  <Text style={subStyles.ctaBtnText}>
                    {isExpiredOrCancelled ? "Reativar assinatura" : "Assinar agora"}
                  </Text>
                </Pressable>
              )}

              {isPending && (
                <Pressable
                  style={({ pressed }) => [subStyles.ctaBtn, pressed && { opacity: 0.85 }]}
                  onPress={handlePayNow}
                  disabled={paymentLinkQuery.isFetching}
                >
                  {paymentLinkQuery.isFetching ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={subStyles.ctaBtnText}>Pagar via Pix</Text>
                  )}
                </Pressable>
              )}

              {isActive && planKey && (
                <Pressable
                  style={({ pressed }) => [subStyles.upgradeBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => setShowUpgrade(true)}
                >
                  <IconSymbol name="arrow.up.circle.fill" size={16} color="#C9A84C" />
                  <Text style={subStyles.upgradeBtnText}>Alterar plano</Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [subStyles.syncBtn, pressed && { opacity: 0.7 }]}
                onPress={() => syncMutation.mutate({ tenantId })}
                disabled={syncMutation.isPending || !sub?.subscriptionId}
              >
                {syncMutation.isPending ? (
                  <ActivityIndicator color="#9BA1A6" size="small" />
                ) : (
                  <Text style={subStyles.syncBtnText}>Atualizar status</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>

      <UpgradeModal
        visible={showUpgrade}
        currentPlan={planKey}
        tenantId={tenantId}
        onClose={() => setShowUpgrade(false)}
        onSuccess={() => refetch()}
      />
    </>
  );
}

const subStyles = StyleSheet.create({
  section: { backgroundColor: "#111", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#2A2A2A" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#ECEDEE" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  detailsCard: { backgroundColor: "#1A1A1A", borderRadius: 12, borderWidth: 1, borderColor: "#2A2A2A", marginBottom: 12, overflow: "hidden" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11 },
  detailLabel: { fontSize: 13, color: "#9BA1A6" },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#ECEDEE" },
  divider: { height: 1, backgroundColor: "#2A2A2A" },
  trialCard: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FBBF2411", borderRadius: 10, padding: 10, marginBottom: 12 },
  trialText: { fontSize: 12, color: "#9BA1A6", flex: 1 },
  actions: { gap: 8 },
  ctaBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  ctaBtnText: { fontSize: 14, fontWeight: "800", color: "#000" },
  upgradeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#1A1500", borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: "#C9A84C44" },
  upgradeBtnText: { fontSize: 14, fontWeight: "700", color: "#C9A84C" },
  syncBtn: { alignItems: "center", paddingVertical: 8 },
  syncBtnText: { fontSize: 12, color: "#9BA1A6" },
});

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const tabBarHeight = useTabBarHeight();

  return (
    <ScreenContainer containerClassName="bg-background">
      <AdminHeader title="Configurações" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight }} keyboardShouldPersistTaps="handled">

        {/* Minha Assinatura */}
        <SubscriptionSection />

        {/* Versão */}
        <View style={styles.versionCard}>
          <IconSymbol name="info.circle.fill" size={16} color="#555" />
          <Text style={styles.versionText}>Barber Pro · Versão 3.6</Text>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  section: { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.foreground },
  sectionSubtitle: { fontSize: 13, color: c.muted, marginBottom: 16, lineHeight: 18 },
  themeGrid: { gap: 10 },
  themeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border },
  themeCardActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  themeIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.border, justifyContent: "center", alignItems: "center" },
  themeIconBoxActive: { backgroundColor: "#0A0A0A22" },
  themeLabel: { fontSize: 15, fontWeight: "700", color: c.foreground, flex: 1 },
  themeLabelActive: { color: "#0A0A0A" },
  themeDescription: { fontSize: 11, color: c.muted, position: "absolute", bottom: 10, right: 50, maxWidth: 120, textAlign: "right" },
  themeCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#0A0A0A33", justifyContent: "center", alignItems: "center" },
  versionCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 20 },
  versionText: { fontSize: 12, color: "#444" },
});
}
