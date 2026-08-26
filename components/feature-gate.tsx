import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useBarberAuth } from "@/lib/auth-context";
import { hasFeatureAccess, FEATURE_LABELS, FEATURE_REQUIRED_PLAN, PLAN_PRICING, type FeatureKey } from "@/lib/plan-features";

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

/**
 * Envolve uma tela ou seção com um guard de plano/assinatura.
 * Se o tenant não tiver acesso à feature, exibe uma tela de upgrade.
 * Durante o trial, quase tudo fica liberado (exceto "asaas_settings",
 * que exige assinatura ativa) — ver lib/plan-features.ts.
 *
 * @example
 * export default function ProductsScreen() {
 *   return (
 *     <FeatureGate feature="products">
 *       <ActualProductsContent />
 *     </FeatureGate>
 *   );
 * }
 */
export function FeatureGate({ feature, children }: FeatureGateProps) {
  const { barber } = useBarberAuth();
  const plan = barber?.tenantPlan;
  const status = barber?.bpStatus;

  if (hasFeatureAccess(plan, status, feature)) {
    return <>{children}</>;
  }

  return <UpgradeScreen feature={feature} />;
}

function UpgradeScreen({ feature }: { feature: FeatureKey }) {
  const featureLabel = FEATURE_LABELS[feature];

  // "asaas_settings" não é liberado por plano — depende da assinatura estar
  // ativa (pagando). Mensagem diferente, sem card de "assine o plano X".
  if (feature === "asaas_settings") {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.lockCircle}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
        <Text style={styles.title}>{featureLabel}</Text>
        <Text style={styles.subtitle}>
          A configuração de pagamentos fica disponível assim que sua assinatura estiver ativa. Durante o período de teste, essa área ainda não pode ser configurada.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/admin/(tabs)/settings" as any)}
        >
          <Text style={styles.ctaBtnText}>Ver planos →</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>← Voltar</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const requiredPlan = FEATURE_REQUIRED_PLAN[feature] ?? "team";
  const pricing = PLAN_PRICING[requiredPlan];

  // Features incluídas no plano requerido
  const planFeatureLabels: Record<string, string[]> = {
    team: [
      "Produtos e Estoque",
      "Fornecedores e Encomendas",
      "Cupons de desconto",
      "Planos de assinatura",
      "Relatórios completos + CSV",
      "Até 3 barbeiros",
    ],
    studio: [
      "Tudo do plano Equipe",
      "Comissões automáticas",
      "Radar de Leads (Órbita)",
      "Suporte prioritário",
      "Barbeiros ilimitados",
    ],
  };

  const features = planFeatureLabels[requiredPlan] ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Ícone de cadeado */}
      <View style={styles.lockCircle}>
        <Text style={styles.lockIcon}>🔒</Text>
      </View>

      {/* Título */}
      <Text style={styles.title}>{featureLabel}</Text>
      <Text style={styles.subtitle}>
        Este recurso está disponível a partir do plano{" "}
        <Text style={styles.planName}>{pricing.label}</Text>.
      </Text>

      {/* Card do plano */}
      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <Text style={styles.planLabel}>{pricing.label}</Text>
          <View style={styles.priceBox}>
            <Text style={styles.priceValue}>
              R$ {pricing.monthly.toFixed(2).replace(".", ",")}
            </Text>
            <Text style={styles.pricePer}>/mês</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/admin/(tabs)/settings" as any)}
      >
        <Text style={styles.ctaBtnText}>Ver planos e fazer upgrade →</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.backBtnText}>← Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  content: {
    alignItems: "center",
    padding: 28,
    paddingTop: 48,
    paddingBottom: 48,
  },
  lockCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  lockIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ECEDEE",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#9BA1A6",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  planName: {
    color: "#C9A84C",
    fontWeight: "700",
  },
  planCard: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#C9A84C",
    padding: 20,
    marginBottom: 24,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  planLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#C9A84C",
  },
  priceBox: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ECEDEE",
  },
  pricePer: {
    fontSize: 12,
    color: "#9BA1A6",
  },
  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  checkmark: {
    fontSize: 14,
    color: "#C9A84C",
    fontWeight: "700",
    width: 16,
  },
  featureText: {
    fontSize: 13,
    color: "#9BA1A6",
    flex: 1,
  },
  ctaBtn: {
    width: "100%",
    backgroundColor: "#C9A84C",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
  },
  backBtn: {
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 14,
    color: "#555",
  },
});
