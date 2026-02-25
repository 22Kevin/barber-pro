import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { AdminHeader } from "@/components/admin-header";
import {} from "react-native-safe-area-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";

type LoyaltyTab = "config" | "rewards" | "coupons";

const REWARD_TYPES = [
  { key: "free_service",     label: "Serviço Grátis" },
  { key: "discount_percent", label: "Desconto %" },
  { key: "discount_fixed",   label: "Desconto Fixo" },
  { key: "free_product",     label: "Produto Grátis" },
];

export default function LoyaltyScreen() {
  const tabBarHeight = useTabBarHeight();
  const [activeTab, setActiveTab] = useState<LoyaltyTab>("config");
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);

  // Config form
  const [loyaltyActive, setLoyaltyActive] = useState(true);
  const [pointsPerService, setPointsPerService] = useState("10");
  const [pointsPerReal, setPointsPerReal] = useState("1");
  const [pointsExpireMonths, setPointsExpireMonths] = useState("12");
  const [configLoaded, setConfigLoaded] = useState(false);

  // Reward form
  const [rewardName, setRewardName] = useState("");
  const [rewardDesc, setRewardDesc] = useState("");
  const [rewardPoints, setRewardPoints] = useState("");
  const [rewardType, setRewardType] = useState("discount_percent");
  const [rewardValue, setRewardValue] = useState("");

  // Coupon form
  const [couponCode, setCouponCode] = useState("");
  const [couponDesc, setCouponDesc] = useState("");
  const [couponDiscountType, setCouponDiscountType] = useState<"percent" | "fixed">("percent");
  const [couponDiscountValue, setCouponDiscountValue] = useState("");
  const [couponMinOrder, setCouponMinOrder] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState("");
  const [couponValidUntil, setCouponValidUntil] = useState("");

  const utils = trpc.useUtils();

  const configQuery = trpc.loyalty.getConfig.useQuery();

  // Populate form when config loads
  if (configQuery.data && !configLoaded) {
    const data = configQuery.data;
    setLoyaltyActive(data.isActive ?? true);
    setPointsPerService(String(data.pointsPerService ?? 10));
    setPointsPerReal(data.pointsPerReal ?? "1");
    setPointsExpireMonths(String(data.pointsExpireMonths ?? 12));
    setConfigLoaded(true);
  }

  const rewardsQuery = trpc.loyalty.rewards.list.useQuery();
  const couponsQuery = trpc.coupons.list.useQuery();

  const updateConfigMutation = trpc.loyalty.updateConfig.useMutation({
    onSuccess: () => { utils.loyalty.getConfig.invalidate(); Alert.alert("Sucesso", "Configurações salvas!"); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const createRewardMutation = trpc.loyalty.rewards.create.useMutation({
    onSuccess: () => { utils.loyalty.rewards.list.invalidate(); setShowRewardModal(false); resetRewardForm(); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const updateRewardMutation = trpc.loyalty.rewards.update.useMutation({
    onSuccess: () => utils.loyalty.rewards.list.invalidate(),
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const createCouponMutation = trpc.coupons.create.useMutation({
    onSuccess: () => { utils.coupons.list.invalidate(); setShowCouponModal(false); resetCouponForm(); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const updateCouponMutation = trpc.coupons.update.useMutation({
    onSuccess: () => utils.coupons.list.invalidate(),
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  function resetRewardForm() {
    setRewardName(""); setRewardDesc(""); setRewardPoints(""); setRewardType("discount_percent"); setRewardValue("");
  }

  function resetCouponForm() {
    setCouponCode(""); setCouponDesc(""); setCouponDiscountType("percent"); setCouponDiscountValue("");
    setCouponMinOrder(""); setCouponMaxUses(""); setCouponValidUntil("");
  }

  function handleSaveConfig() {
    updateConfigMutation.mutate({
      isActive: loyaltyActive,
      pointsPerService: parseInt(pointsPerService) || 0,
      pointsPerReal: pointsPerReal || "1",
      pointsExpireMonths: parseInt(pointsExpireMonths) || 0,
    });
  }

  function handleCreateReward() {
    if (!rewardName.trim()) { Alert.alert("Atenção", "Informe o nome da recompensa."); return; }
    const pts = parseInt(rewardPoints);
    if (isNaN(pts) || pts <= 0) { Alert.alert("Atenção", "Informe a quantidade de pontos."); return; }
    createRewardMutation.mutate({
      name: rewardName.trim(),
      description: rewardDesc.trim() || undefined,
      pointsRequired: pts,
      rewardType: rewardType as any,
      rewardValue: rewardValue || undefined,
    });
  }

  function handleCreateCoupon() {
    if (!couponCode.trim() || couponCode.length < 3) { Alert.alert("Atenção", "Código deve ter pelo menos 3 caracteres."); return; }
    const val = parseFloat(couponDiscountValue.replace(",", "."));
    if (isNaN(val) || val <= 0) { Alert.alert("Atenção", "Informe o valor do desconto."); return; }
    createCouponMutation.mutate({
      code: couponCode.toUpperCase().trim(),
      description: couponDesc.trim() || undefined,
      discountType: couponDiscountType,
      discountValue: val.toFixed(2),
      minOrderValue: couponMinOrder ? parseFloat(couponMinOrder.replace(",", ".")).toFixed(2) : undefined,
      maxUses: couponMaxUses ? parseInt(couponMaxUses) : undefined,
      validUntil: couponValidUntil || undefined,
    });
  }

  const rewards = rewardsQuery.data ?? [];
  const coupons = couponsQuery.data ?? [];

  return (
    <ScreenContainer containerClassName="bg-background">
      <AdminHeader
        title="Fidelidade"
        rightElement={
          activeTab === "rewards" ? (
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={() => setShowRewardModal(true)}>
              <IconSymbol name="plus" size={18} color="#0A0A0A" />
              <Text style={styles.addBtnText}>Nova</Text>
            </Pressable>
          ) : activeTab === "coupons" ? (
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={() => setShowCouponModal(true)}>
              <IconSymbol name="plus" size={18} color="#0A0A0A" />
              <Text style={styles.addBtnText}>Novo</Text>
            </Pressable>
          ) : <View style={{ width: 40 }} />
        }
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["config", "rewards", "coupons"] as LoyaltyTab[]).map(tab => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "config" ? "Pontos" : tab === "rewards" ? "Recompensas" : "Cupons"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight }}>
        {/* Config de Pontos */}
        {activeTab === "config" && (
          <>
            <View style={styles.infoCard}>
              <IconSymbol name="star.fill" size={20} color="#C9A84C" />
              <Text style={styles.infoText}>Configure as regras do programa de fidelidade. Os clientes acumulam pontos a cada atendimento ou compra.</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.cardLabel}>Programa de Fidelidade</Text>
                  <Text style={styles.cardSubLabel}>Ativar sistema de pontos</Text>
                </View>
                <Switch value={loyaltyActive} onValueChange={setLoyaltyActive} trackColor={{ false: "#2A2A2A", true: "#C9A84C44" }} thumbColor={loyaltyActive ? "#C9A84C" : "#555"} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Regras de Acúmulo</Text>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Pontos por serviço realizado</Text>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { flex: 1 }]} value={pointsPerService} onChangeText={setPointsPerService} keyboardType="number-pad" placeholder="10" placeholderTextColor="#555" />
                <View style={styles.inputUnit}><Text style={styles.inputUnitText}>pontos</Text></View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Pontos por R$ gasto</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputUnit}><Text style={styles.inputUnitText}>R$ 1 =</Text></View>
                <TextInput style={[styles.input, { flex: 1 }]} value={pointsPerReal} onChangeText={setPointsPerReal} keyboardType="decimal-pad" placeholder="1" placeholderTextColor="#555" />
                <View style={styles.inputUnit}><Text style={styles.inputUnitText}>pontos</Text></View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Expiração dos pontos</Text>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { flex: 1 }]} value={pointsExpireMonths} onChangeText={setPointsExpireMonths} keyboardType="number-pad" placeholder="12" placeholderTextColor="#555" />
                <View style={styles.inputUnit}><Text style={styles.inputUnitText}>meses (0 = nunca)</Text></View>
              </View>
            </View>

            <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSaveConfig} disabled={updateConfigMutation.isPending}>
              {updateConfigMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>SALVAR CONFIGURAÇÕES</Text>}
            </Pressable>
          </>
        )}

        {/* Recompensas */}
        {activeTab === "rewards" && (
          <>
            {rewardsQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
            ) : rewards.length === 0 ? (
              <View style={styles.emptyCard}>
                <IconSymbol name="trophy.fill" size={40} color="#2A2A2A" />
                <Text style={styles.emptyText}>Nenhuma recompensa cadastrada</Text>
                <Text style={styles.emptySubText}>Crie recompensas para seus clientes fidelizados</Text>
              </View>
            ) : (
              (rewards as any[]).map((reward: any) => (
                <View key={reward.id} style={styles.rewardCard}>
                  <View style={styles.rewardLeft}>
                    <View style={styles.rewardIconBox}>
                      <IconSymbol name="trophy.fill" size={20} color="#C9A84C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rewardName}>{reward.name}</Text>
                      {reward.description ? <Text style={styles.rewardDesc}>{reward.description}</Text> : null}
                      <View style={styles.rewardMeta}>
                        <View style={styles.pointsBadge}>
                          <IconSymbol name="star.fill" size={11} color="#C9A84C" />
                          <Text style={styles.pointsText}>{reward.pointsRequired} pontos</Text>
                        </View>
                        <Text style={styles.rewardType}>
                          {REWARD_TYPES.find(t => t.key === reward.rewardType)?.label ?? reward.rewardType}
                          {reward.rewardValue ? ` · ${reward.rewardValue}` : ""}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Switch
                    value={reward.isActive}
                    onValueChange={(v) => updateRewardMutation.mutate({ id: reward.id, isActive: v })}
                    trackColor={{ false: "#2A2A2A", true: "#C9A84C44" }}
                    thumbColor={reward.isActive ? "#C9A84C" : "#555"}
                  />
                </View>
              ))
            )}
          </>
        )}

        {/* Cupons */}
        {activeTab === "coupons" && (
          <>
            {couponsQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
            ) : coupons.length === 0 ? (
              <View style={styles.emptyCard}>
                <IconSymbol name="ticket.fill" size={40} color="#2A2A2A" />
                <Text style={styles.emptyText}>Nenhum cupom cadastrado</Text>
                <Text style={styles.emptySubText}>Crie cupons de desconto para seus clientes</Text>
              </View>
            ) : (
              (coupons as any[]).map((coupon: any) => (
                <View key={coupon.id} style={[styles.couponCard, !coupon.isActive && { opacity: 0.5 }]}>
                  <View style={styles.couponLeft}>
                    <View style={styles.couponCode}>
                      <Text style={styles.couponCodeText}>{coupon.code}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      {coupon.description ? <Text style={styles.couponDesc}>{coupon.description}</Text> : null}
                      <View style={styles.couponMeta}>
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>
                            {coupon.discountType === "percent" ? `${coupon.discountValue}% OFF` : `R$ ${coupon.discountValue} OFF`}
                          </Text>
                        </View>
                        {coupon.maxUses !== null && (
                          <Text style={styles.couponMetaText}>{coupon.usedCount}/{coupon.maxUses} usos</Text>
                        )}
                        {coupon.validUntil && (
                          <Text style={styles.couponMetaText}>Até {coupon.validUntil}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <Switch
                    value={coupon.isActive}
                    onValueChange={(v) => updateCouponMutation.mutate({ id: coupon.id, isActive: v })}
                    trackColor={{ false: "#2A2A2A", true: "#C9A84C44" }}
                    thumbColor={coupon.isActive ? "#C9A84C" : "#555"}
                  />
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Modal Nova Recompensa */}
      <Modal visible={showRewardModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Recompensa</Text>
                <Pressable onPress={() => { setShowRewardModal(false); resetRewardForm(); }}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Nome da Recompensa *</Text>
                <TextInput style={styles.input} value={rewardName} onChangeText={setRewardName} placeholder="Ex: Corte Grátis" placeholderTextColor="#555" />

                <Text style={styles.fieldLabel}>Descrição</Text>
                <TextInput style={[styles.input, styles.textarea]} value={rewardDesc} onChangeText={setRewardDesc} placeholder="Descreva a recompensa..." placeholderTextColor="#555" multiline />

                <Text style={styles.fieldLabel}>Pontos Necessários *</Text>
                <TextInput style={styles.input} value={rewardPoints} onChangeText={setRewardPoints} placeholder="Ex: 100" placeholderTextColor="#555" keyboardType="number-pad" />

                <Text style={styles.fieldLabel}>Tipo de Recompensa</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {REWARD_TYPES.map(rt => (
                    <Pressable key={rt.key} style={[styles.typeChip, rewardType === rt.key && styles.typeChipActive]} onPress={() => setRewardType(rt.key)}>
                      <Text style={[styles.typeChipText, rewardType === rt.key && styles.typeChipTextActive]}>{rt.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {(rewardType === "discount_percent" || rewardType === "discount_fixed") && (
                  <>
                    <Text style={styles.fieldLabel}>{rewardType === "discount_percent" ? "Percentual (%)" : "Valor (R$)"}</Text>
                    <TextInput style={styles.input} value={rewardValue} onChangeText={setRewardValue} placeholder={rewardType === "discount_percent" ? "Ex: 20" : "Ex: 15,00"} placeholderTextColor="#555" keyboardType="decimal-pad" />
                  </>
                )}

                <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleCreateReward} disabled={createRewardMutation.isPending}>
                  {createRewardMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>CRIAR RECOMPENSA</Text>}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Novo Cupom */}
      <Modal visible={showCouponModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo Cupom</Text>
                <Pressable onPress={() => { setShowCouponModal(false); resetCouponForm(); }}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Código do Cupom *</Text>
                <TextInput style={[styles.input, { textTransform: "uppercase" }]} value={couponCode} onChangeText={t => setCouponCode(t.toUpperCase())} placeholder="Ex: PROMO20" placeholderTextColor="#555" autoCapitalize="characters" />

                <Text style={styles.fieldLabel}>Descrição</Text>
                <TextInput style={styles.input} value={couponDesc} onChangeText={setCouponDesc} placeholder="Ex: 20% de desconto no corte" placeholderTextColor="#555" />

                <Text style={styles.fieldLabel}>Tipo de Desconto</Text>
                <View style={styles.typeRow}>
                  {(["percent", "fixed"] as const).map(t => (
                    <Pressable key={t} style={[styles.typeChip, couponDiscountType === t && styles.typeChipActive]} onPress={() => setCouponDiscountType(t)}>
                      <Text style={[styles.typeChipText, couponDiscountType === t && styles.typeChipTextActive]}>
                        {t === "percent" ? "Percentual (%)" : "Valor Fixo (R$)"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{couponDiscountType === "percent" ? "Percentual de Desconto *" : "Valor do Desconto (R$) *"}</Text>
                <TextInput style={styles.input} value={couponDiscountValue} onChangeText={setCouponDiscountValue} placeholder={couponDiscountType === "percent" ? "Ex: 20" : "Ex: 15,00"} placeholderTextColor="#555" keyboardType="decimal-pad" />

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Pedido Mínimo (R$)</Text>
                    <TextInput style={styles.input} value={couponMinOrder} onChangeText={setCouponMinOrder} placeholder="Opcional" placeholderTextColor="#555" keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Limite de Usos</Text>
                    <TextInput style={styles.input} value={couponMaxUses} onChangeText={setCouponMaxUses} placeholder="Ilimitado" placeholderTextColor="#555" keyboardType="number-pad" />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Válido até (AAAA-MM-DD)</Text>
                <TextInput style={styles.input} value={couponValidUntil} onChangeText={setCouponValidUntil} placeholder="Ex: 2025-12-31" placeholderTextColor="#555" />

                <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleCreateCoupon} disabled={createCouponMutation.isPending}>
                  {createCouponMutation.isPending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>CRIAR CUPOM</Text>}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#F5F5F0" },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "#141414", borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: "#2A2A2A" },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#C9A84C" },
  tabText: { fontSize: 13, color: "#888880", fontWeight: "600" },
  tabTextActive: { color: "#0A0A0A" },
  infoCard: { flexDirection: "row", gap: 10, backgroundColor: "#C9A84C22", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#C9A84C44", alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, color: "#C9A84C", lineHeight: 18 },
  card: { backgroundColor: "#141414", borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#2A2A2A" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { fontSize: 15, fontWeight: "600", color: "#F5F5F0" },
  cardSubLabel: { fontSize: 12, color: "#888880", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#F5F5F0", marginBottom: 10 },
  fieldLabel: { fontSize: 13, color: "#888880", marginBottom: 6, fontWeight: "500" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 0 },
  input: { backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0", marginBottom: 0 },
  inputUnit: { backgroundColor: "#1E1E1E", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12, borderWidth: 1, borderColor: "#2A2A2A" },
  inputUnitText: { color: "#888880", fontSize: 13 },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  emptyCard: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: "#888880", fontSize: 16, fontWeight: "600" },
  emptySubText: { color: "#555", fontSize: 13, textAlign: "center" },
  rewardCard: { backgroundColor: "#141414", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "center" },
  rewardLeft: { flex: 1, flexDirection: "row", gap: 12 },
  rewardIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center" },
  rewardName: { fontSize: 15, fontWeight: "700", color: "#F5F5F0", marginBottom: 2 },
  rewardDesc: { fontSize: 12, color: "#888880", marginBottom: 6 },
  rewardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  pointsBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#C9A84C22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pointsText: { fontSize: 12, color: "#C9A84C", fontWeight: "600" },
  rewardType: { fontSize: 12, color: "#888880" },
  couponCard: { backgroundColor: "#141414", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "center" },
  couponLeft: { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  couponCode: { backgroundColor: "#C9A84C22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#C9A84C44" },
  couponCodeText: { fontSize: 14, fontWeight: "800", color: "#C9A84C", letterSpacing: 1 },
  couponDesc: { fontSize: 13, color: "#F5F5F0", marginBottom: 6 },
  couponMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  discountBadge: { backgroundColor: "#4CAF5022", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { fontSize: 12, color: "#4CAF50", fontWeight: "700" },
  couponMetaText: { fontSize: 12, color: "#888880" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#141414", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%", borderWidth: 1, borderColor: "#2A2A2A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F0" },
  textarea: { height: 80, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", alignItems: "center" },
  typeChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  typeChipText: { fontSize: 13, color: "#888880", fontWeight: "600" },
  typeChipTextActive: { color: "#C9A84C" },
});
