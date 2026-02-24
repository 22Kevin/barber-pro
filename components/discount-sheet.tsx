import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export type AppliedDiscount =
  | { type: "coupon"; code: string; discountAmount: number; couponId: number; description: string }
  | { type: "reward"; rewardId: number; pointsRequired: number; discountAmount: number; rewardName: string; rewardType: string; rewardValue: string };

interface DiscountSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (discount: AppliedDiscount) => void;
  orderValue: number;
  clientId?: number | null;
  currentDiscount?: AppliedDiscount | null;
}

export function DiscountSheet({
  visible,
  onClose,
  onApply,
  orderValue,
  clientId,
  currentDiscount,
}: DiscountSheetProps) {
  const colors = useColors();
  const [couponCode, setCouponCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(400)).current;

  const availableQuery = trpc.coupons.getAvailableForClient.useQuery(
    { clientId: clientId ?? null, orderValue },
    { enabled: visible }
  );

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const validateMutation = trpc.coupons.validate.useQuery(
    { code: couponCode.toUpperCase().trim(), orderValue },
    { enabled: false }
  );

  async function handleValidateCoupon() {
    const code = couponCode.toUpperCase().trim();
    if (!code) return;
    Keyboard.dismiss();
    setValidating(true);
    setValidationMsg(null);
    try {
      const result = await (validateMutation as any).refetch();
      const data = result.data;
      if (data?.valid && data.coupon) {
        setValidationMsg({ ok: true, text: `✓ Cupom válido! Desconto de R$ ${data.discountAmount.toFixed(2).replace(".", ",")}` });
        onApply({
          type: "coupon",
          code: data.coupon.code,
          discountAmount: data.discountAmount,
          couponId: data.coupon.id,
          description: data.coupon.description ?? code,
        });
      } else {
        setValidationMsg({ ok: false, text: data?.message ?? "Cupom inválido" });
      }
    } catch {
      setValidationMsg({ ok: false, text: "Erro ao validar cupom" });
    } finally {
      setValidating(false);
    }
  }

  function handleSelectCoupon(coupon: any) {
    const discount =
      coupon.discountType === "percent"
        ? (orderValue * parseFloat(coupon.discountValue)) / 100
        : parseFloat(coupon.discountValue);
    onApply({
      type: "coupon",
      code: coupon.code,
      discountAmount: discount,
      couponId: coupon.id,
      description: coupon.description ?? coupon.code,
    });
    onClose();
  }

  function handleSelectReward(reward: any) {
    let discountAmount = 0;
    if (reward.rewardType === "discount_percent") {
      discountAmount = (orderValue * parseFloat(reward.rewardValue ?? "0")) / 100;
    } else if (reward.rewardType === "discount_fixed") {
      discountAmount = parseFloat(reward.rewardValue ?? "0");
    } else if (reward.rewardType === "free_service") {
      discountAmount = orderValue; // serviço grátis = 100% de desconto
    }
    onApply({
      type: "reward",
      rewardId: reward.id,
      pointsRequired: reward.pointsRequired,
      discountAmount,
      rewardName: reward.name,
      rewardType: reward.rewardType,
      rewardValue: reward.rewardValue ?? "0",
    });
    onClose();
  }

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingBottom: 36,
      maxHeight: "80%",
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center", marginBottom: 16,
    },
    title: { color: colors.foreground, fontSize: 18, fontWeight: "700", paddingHorizontal: 20, marginBottom: 16 },
    sectionLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 8, marginTop: 16 },
    inputRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, alignItems: "center" },
    input: {
      flex: 1, backgroundColor: colors.background,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: colors.foreground, fontSize: 15, fontWeight: "600",
      borderWidth: 1, borderColor: colors.border,
      letterSpacing: 1,
    },
    applyBtn: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 12,
    },
    applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    validMsg: { paddingHorizontal: 20, marginTop: 8, fontSize: 13 },
    couponCard: {
      marginHorizontal: 20, marginBottom: 10,
      backgroundColor: colors.background,
      borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    },
    couponCardSelected: { borderColor: colors.primary },
    couponCode: { color: colors.primary, fontWeight: "800", fontSize: 15, letterSpacing: 1 },
    couponDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
    couponDiscount: { color: colors.foreground, fontWeight: "700", fontSize: 14 },
    rewardCard: {
      marginHorizontal: 20, marginBottom: 10,
      backgroundColor: colors.background,
      borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: "#EAB308",
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    },
    rewardName: { color: colors.foreground, fontWeight: "700", fontSize: 14 },
    rewardPoints: { color: "#EAB308", fontWeight: "700", fontSize: 13 },
    emptyText: { color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: 16, paddingHorizontal: 20 },
    closeBtn: {
      marginHorizontal: 20, marginTop: 16,
      borderRadius: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: colors.border,
      alignItems: "center",
    },
    closeBtnText: { color: colors.muted, fontWeight: "600", fontSize: 15 },
  });

  const coupons = availableQuery.data?.coupons ?? [];
  const rewards = availableQuery.data?.redeemableRewards ?? [];
  const hasSomething = coupons.length > 0 || rewards.length > 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.handle} />
            <Text style={styles.title}>Aplicar desconto</Text>

            {/* Campo de código manual */}
            <Text style={styles.sectionLabel}>Código do cupom</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ex: PROMO10"
                placeholderTextColor={colors.muted}
                value={couponCode}
                onChangeText={(t) => { setCouponCode(t.toUpperCase()); setValidationMsg(null); }}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleValidateCoupon}
              />
              <TouchableOpacity style={styles.applyBtn} onPress={handleValidateCoupon} disabled={validating || !couponCode.trim()}>
                {validating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.applyBtnText}>Aplicar</Text>}
              </TouchableOpacity>
            </View>
            {validationMsg && (
              <Text style={[styles.validMsg, { color: validationMsg.ok ? colors.success : colors.error }]}>
                {validationMsg.text}
              </Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Cupons disponíveis */}
              {availableQuery.isLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
              ) : (
                <>
                  {coupons.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Seus cupons disponíveis</Text>
                      {coupons.map((c: any) => {
                        const discount =
                          c.discountType === "percent"
                            ? (orderValue * parseFloat(c.discountValue)) / 100
                            : parseFloat(c.discountValue);
                        const isSelected = currentDiscount?.type === "coupon" && currentDiscount.code === c.code;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[styles.couponCard, isSelected && styles.couponCardSelected]}
                            onPress={() => handleSelectCoupon(c)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.couponCode}>{c.code}</Text>
                              {c.description ? <Text style={styles.couponDesc}>{c.description}</Text> : null}
                            </View>
                            <Text style={styles.couponDiscount}>
                              {c.discountType === "percent" ? `${c.discountValue}% OFF` : `R$ ${parseFloat(c.discountValue).toFixed(2).replace(".", ",")} OFF`}
                              {"\n"}
                              <Text style={{ color: colors.success, fontSize: 12 }}>
                                − R$ {discount.toFixed(2).replace(".", ",")}
                              </Text>
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}

                  {/* Recompensas de pontos */}
                  {rewards.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Resgatar com pontos</Text>
                      {rewards.map((r: any) => {
                        const isSelected = currentDiscount?.type === "reward" && (currentDiscount as any).rewardId === r.id;
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.rewardCard, isSelected && { borderColor: colors.primary }]}
                            onPress={() => handleSelectReward(r)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.rewardName}>{r.name}</Text>
                              {r.description ? <Text style={styles.couponDesc}>{r.description}</Text> : null}
                            </View>
                            <Text style={styles.rewardPoints}>{r.pointsRequired} pts</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}

                  {!hasSomething && !availableQuery.isLoading && (
                    <Text style={styles.emptyText}>
                      {clientId
                        ? "Nenhum cupom ou recompensa disponível para este valor."
                        : "Faça login para ver seus cupons e recompensas disponíveis."}
                    </Text>
                  )}
                </>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}
