import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

// ─── Dados dos planos ─────────────────────────────────────────────────────────
type PlanKey = "solo" | "team" | "studio";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  key: PlanKey;
  name: string;
  price: number;
  description: string;
  badge?: string;
  features: PlanFeature[];
}

// Preços mensais e anuais (por mês)
const PRICES = {
  monthly: { solo: 49.90, team: 99.90, studio: 169.90 },
  annual:  { solo: 39.90, team: 79.90, studio: 135.90 },
  annualTotal: { solo: 478.80, team: 958.80, studio: 1630.80 },
};

const PLANS: Plan[] = [
  {
    key: "solo",
    name: "Solo",
    price: 49.90,
    description: "Para o barbeiro autônomo que trabalha sozinho.",
    features: [
      { text: "1 barbeiro / profissional", included: true },
      { text: "Agendamento online pelo cliente", included: true },
      { text: "Gestão financeira básica", included: true },
      { text: "Sistema de fidelidade", included: true },
      { text: "Notificações push", included: true },
      { text: "Pagamento via Pix e cartão", included: true },
      { text: "Despesas e controle de lucros", included: true },
      { text: "Múltiplos barbeiros", included: false },
      { text: "Produtos e estoque", included: false },
      { text: "Cupons e encomendas", included: false },
      { text: "Relatórios completos + CSV", included: false },
    ],
  },
  {
    key: "team",
    name: "Equipe",
    price: 99.90,
    description: "Para barbearias com até 3 profissionais.",
    badge: "MAIS POPULAR",
    features: [
      { text: "Até 3 barbeiros / profissionais", included: true },
      { text: "Agendamento online pelo cliente", included: true },
      { text: "Gestão financeira completa", included: true },
      { text: "Sistema de fidelidade", included: true },
      { text: "Notificações push", included: true },
      { text: "Pagamento via Pix e cartão", included: true },
      { text: "Produtos, estoque e fornecedores", included: true },
      { text: "Cupons e encomendas", included: true },
      { text: "Planos de assinatura p/ clientes", included: true },
      { text: "Relatórios completos + CSV", included: true },
      { text: "Comissões automáticas", included: false },
      { text: "Radar de Leads", included: false },
    ],
  },
  {
    key: "studio",
    name: "Estúdio",
    price: 169.90,
    description: "Para grandes barbearias e estúdios.",
    features: [
      { text: "Barbeiros ilimitados", included: true },
      { text: "Tudo do plano Equipe", included: true },
      { text: "Comissões automáticas", included: true },
      { text: "Radar de Leads (Órbita)", included: true },
      { text: "Suporte prioritário", included: true },
    ],
  },
];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function PlanSelectionScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("team");
  const [isAnnual, setIsAnnual] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
    ]).start();
  }, []);

  function handleSelectPlan(key: PlanKey) {
    setSelectedPlan(key);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function handleContinue() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push({ pathname: "/onboarding/register", params: { plan: selectedPlan, billing: isAnnual ? "annual" : "monthly" } } as any);
  }

  return (
    <ScreenContainer containerClassName="bg-[#0A0A0A]" edges={["top", "left", "right", "bottom"]}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="arrow.left" size={22} color="#C9A84C" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Escolha seu plano</Text>
          <Text style={styles.headerSub}>14 dias grátis · Cancele quando quiser</Text>
        </View>
      </View>

      {/* Toggle Mensal / Anual */}
      <View style={styles.billingToggleWrap}>
        <Pressable
          style={[styles.billingBtn, !isAnnual && styles.billingBtnActive]}
          onPress={() => setIsAnnual(false)}
        >
          <Text style={[styles.billingBtnText, !isAnnual && styles.billingBtnTextActive]}>Mensal</Text>
        </Pressable>
        <Pressable
          style={[styles.billingBtn, isAnnual && styles.billingBtnActive]}
          onPress={() => { setIsAnnual(true); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Text style={[styles.billingBtnText, isAnnual && styles.billingBtnTextActive]}>Anual</Text>
          <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>-20%</Text></View>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.key;
            const isPopular = !!plan.badge;
            return (
              <Pressable
                key={plan.key}
                style={({ pressed }) => [
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                  isPopular && !isSelected && styles.planCardPopular,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={() => handleSelectPlan(plan.key)}
              >
                {/* Badge */}
                {plan.badge && (
                  <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                    <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                      {plan.badge}
                    </Text>
                  </View>
                )}

                {/* Cabeçalho do plano */}
                <View style={styles.planHeader}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                      {plan.name}
                    </Text>
                    <Text style={[styles.planDesc, isSelected && styles.planDescSelected]}>
                      {plan.description}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={styles.priceBox}>
                      <Text style={[styles.priceCurrency, isSelected && styles.priceSelected]}>R$</Text>
                      <Text style={[styles.priceValue, isSelected && styles.priceSelected]}>
                        {(isAnnual ? PRICES.annual[plan.key] : PRICES.monthly[plan.key]).toFixed(2).replace(".", ",")}
                      </Text>
                      <Text style={[styles.pricePeriod, isSelected && styles.pricePeriodSelected]}>/mês</Text>
                    </View>
                    {isAnnual && (
                      <Text style={{ fontSize: 11, color: isSelected ? "#0A0A0A88" : "#666", marginTop: 2 }}>
                        Total R$ {PRICES.annualTotal[plan.key].toFixed(2).replace(".", ",")}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Divisor */}
                <View style={[styles.planDivider, isSelected && styles.planDividerSelected]} />

                {/* Features */}
                <View style={styles.featureList}>
                  {plan.features.map((feat, idx) => (
                    <View key={idx} style={styles.featureRow}>
                      <IconSymbol
                        name={feat.included ? "checkmark.circle.fill" : "xmark.circle.fill"}
                        size={16}
                        color={feat.included ? (isSelected ? "#0A0A0A" : "#C9A84C") : (isSelected ? "#0A0A0A55" : "#444")}
                      />
                      <Text style={[
                        styles.featureText,
                        !feat.included && styles.featureTextDisabled,
                        isSelected && styles.featureTextSelected,
                        isSelected && !feat.included && styles.featureTextSelectedDisabled,
                      ]}>
                        {feat.text}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Indicador de seleção */}
                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <IconSymbol name="checkmark" size={14} color="#0A0A0A" />
                    <Text style={styles.selectedText}>Selecionado</Text>
                  </View>
                )}
              </Pressable>
            );
          })}

          {/* Nota de trial */}
          <View style={styles.trialNote}>
            <IconSymbol name="info.circle.fill" size={16} color="#C9A84C88" />
            <Text style={styles.trialNoteText}>
              Os primeiros 14 dias são completamente gratuitos. Nenhum cartão necessário para começar.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Botão de continuar fixo no rodapé */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.continueBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>
            Continuar com o plano {PLANS.find((p) => p.key === selectedPlan)?.name}
          </Text>
          <IconSymbol name="arrow.right" size={20} color="#0A0A0A" />
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#F5F5F0", letterSpacing: 0.2 },
  headerSub: { fontSize: 12, color: "#666660", marginTop: 2 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  billingToggleWrap: { flexDirection: "row" as const, backgroundColor: "#1A1A1A", borderRadius: 12, margin: 16, marginTop: 4, padding: 4, borderWidth: 1, borderColor: "#2A2A2A" },
  billingBtn: { flex: 1, paddingVertical: 10, alignItems: "center" as const, borderRadius: 9, flexDirection: "row" as const, justifyContent: "center" as const, gap: 6 },
  billingBtnActive: { backgroundColor: "#C9A84C" },
  billingBtnText: { fontSize: 14, fontWeight: "600" as const, color: "#666" },
  billingBtnTextActive: { color: "#0A0A0A" },
  saveBadge: { backgroundColor: "#22C55E", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText: { fontSize: 10, fontWeight: "800" as const, color: "#fff" },

  // Cards de plano
  planCard: {
    backgroundColor: "#141414",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
    gap: 0,
  },
  planCardSelected: {
    backgroundColor: "#C9A84C",
    borderColor: "#C9A84C",
    shadowColor: "#C9A84C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  planCardPopular: {
    borderColor: "#C9A84C44",
  },

  // Badge "MAIS POPULAR"
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#C9A84C22",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#C9A84C55",
  },
  badgeSelected: { backgroundColor: "#0A0A0A22", borderColor: "#0A0A0A44" },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#C9A84C", letterSpacing: 1.5 },
  badgeTextSelected: { color: "#0A0A0A" },

  // Cabeçalho do plano
  planHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  planName: { fontSize: 20, fontWeight: "800", color: "#F5F5F0", marginBottom: 4 },
  planNameSelected: { color: "#0A0A0A" },
  planDesc: { fontSize: 12, color: "#888880", lineHeight: 18 },
  planDescSelected: { color: "#0A0A0A99" },

  // Preço
  priceBox: { alignItems: "flex-end" },
  priceCurrency: { fontSize: 14, fontWeight: "700", color: "#C9A84C", marginBottom: -2 },
  priceValue: { fontSize: 36, fontWeight: "900", color: "#C9A84C", lineHeight: 40 },
  priceSelected: { color: "#0A0A0A" },
  pricePeriod: { fontSize: 12, color: "#888880" },
  pricePeriodSelected: { color: "#0A0A0A88" },

  // Divisor
  planDivider: { height: 1, backgroundColor: "#2A2A2A", marginBottom: 16 },
  planDividerSelected: { backgroundColor: "#0A0A0A22" },

  // Features
  featureList: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 13, color: "#CCCCCC", flex: 1 },
  featureTextDisabled: { color: "#444" },
  featureTextSelected: { color: "#0A0A0A" },
  featureTextSelectedDisabled: { color: "#0A0A0A55" },

  // Indicador selecionado
  selectedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#0A0A0A22",
  },
  selectedText: { fontSize: 12, fontWeight: "700", color: "#0A0A0A" },

  // Nota de trial
  trialNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#141414",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    marginTop: 4,
  },
  trialNoteText: { fontSize: 12, color: "#888880", flex: 1, lineHeight: 18 },

  // Rodapé com botão
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
    backgroundColor: "#0A0A0A",
  },
  continueBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#C9A84C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  continueBtnText: { fontSize: 16, fontWeight: "800", color: "#0A0A0A", letterSpacing: 0.3 },
});
