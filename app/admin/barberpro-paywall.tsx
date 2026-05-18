/**
 * Tela de Paywall do Barber Pro
 * Exibida quando o trial expira ou a assinatura é cancelada.
 * Permite o dono da barbearia escolher um plano e assinar via Pix, Crédito ou Débito.
 */
import React, { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cpfCnpjError, validateCPF } from "@/lib/cpf-cnpj";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ─── Planos disponíveis ────────────────────────────────────────────────────────
const PLANS = [
  {
    key: "solo",
    label: "Solo",
    price: 49,
    description: "Para barbearias com 1 profissional",
    features: ["1 barbeiro", "Agendamento online", "Financeiro", "Relatórios"],
    highlight: false,
  },
  {
    key: "team",
    label: "Equipe",
    price: 89,
    description: "Para barbearias com equipe",
    features: ["Até 5 barbeiros", "Tudo do Solo", "Comissões", "Promoções"],
    highlight: true,
  },
  {
    key: "studio",
    label: "Estúdio",
    price: 149,
    description: "Para estúdios e franquias",
    features: ["Barbeiros ilimitados", "Tudo do Equipe", "Multi-unidade", "Suporte prioritário"],
    highlight: false,
  },
] as const;

type PlanKey = "solo" | "team" | "studio";
type BillingType = "PIX" | "CREDIT_CARD" | "UNDEFINED";

// ─── Detecção de bandeira ──────────────────────────────────────────────────────
function detectBrand(num: string): { icon: string; name: string } | null {
  const n = num.replace(/\D/g, "");
  if (/^4011|^4312|^4389|^4514|^4573|^4576|^5041|^5066|^5090|^6277|^6362|^6363|^6504|^6505|^6516|^6550/.test(n)) return { icon: "🟡", name: "Elo" };
  if (/^606282|^3841/.test(n)) return { icon: "🟠", name: "Hipercard" };
  if (/^3[47]/.test(n)) return { icon: "⭐", name: "Amex" };
  if (/^30[0-5]|^36|^38/.test(n)) return { icon: "💳", name: "Diners" };
  if (/^5[1-5]|^2[2-7]/.test(n)) return { icon: "🔴", name: "Mastercard" };
  if (/^4/.test(n)) return { icon: "🟦", name: "Visa" };
  return null;
}

export default function BarberProPaywallScreen() {
  const { barber, logout } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("team");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(barber?.email ?? "");
  const [ownerCpfCnpj, setOwnerCpfCnpj] = useState("");
  const [ownerPhone, setOwnerPhone] = useState(barber?.phone ?? "");
  const [step, setStep] = useState<"plans" | "form" | "pending">("plans");
  const [billingType, setBillingType] = useState<BillingType>("PIX");

  // Carregar forma de pagamento preferida
  useEffect(() => {
    AsyncStorage.getItem("@barberpro:preferredBillingType").then((saved) => {
      if (saved === "PIX" || saved === "CREDIT_CARD" || saved === "UNDEFINED") {
        setBillingType(saved as BillingType);
      }
    }).catch(() => {});
  }, []);

  function handleSetBillingType(method: BillingType) {
    setBillingType(method);
    AsyncStorage.setItem("@barberpro:preferredBillingType", method).catch(() => {});
  }
  const [pixCopyCola, setPixCopyCola] = useState<string | null>(null);

  // Dados do cartão
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardCpf, setCardCpf] = useState("");
  const [cardCep, setCardCep] = useState("");
  const [cardAddrNum, setCardAddrNum] = useState("");
  const [cardBrand, setCardBrand] = useState<{ icon: string; name: string } | null>(null);

  const plan = PLANS.find((p) => p.key === selectedPlan)!;
  const isCard = billingType === "CREDIT_CARD" || billingType === "UNDEFINED";

  const utils = trpc.useUtils();

  const createMutation = trpc.asaasPayments.createBarberproSubscription.useMutation({
    onSuccess: async () => {
      setStep("pending");
      try {
        const linkData = await utils.asaasPayments.getBarberproPaymentLink.fetch({ tenantId });
        if (linkData?.paymentLink) {
          Linking.openURL(linkData.paymentLink);
        } else if (linkData?.pixCopyCola) {
          setPixCopyCola(linkData.pixCopyCola);
        }
      } catch (_e) {
        // Silencioso — usuário já está na tela de pending
      }
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  // ─── Máscaras ─────────────────────────────────────────────────────────────
  function formatCardNumber(raw: string) {
    const digits = raw.replace(/\D/g, "").substring(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  function formatExpiry(raw: string) {
    const digits = raw.replace(/\D/g, "").substring(0, 6);
    if (digits.length >= 3) return digits.substring(0, 2) + "/" + digits.substring(2);
    return digits;
  }

  function formatCpf(raw: string) {
    const d = raw.replace(/\D/g, "").substring(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatCep(raw: string) {
    const d = raw.replace(/\D/g, "").substring(0, 8);
    if (d.length > 5) return d.substring(0, 5) + "-" + d.substring(5);
    return d;
  }

  // ─── Submissão ────────────────────────────────────────────────────────────
  function handleContinue() {
    if (step === "plans") {
      setStep("form");
      return;
    }

    if (!ownerName.trim()) { Alert.alert("Atenção", "Informe seu nome completo."); return; }
    if (!ownerEmail.trim()) { Alert.alert("Atenção", "Informe seu e-mail."); return; }
    const cpfCnpjErr = cpfCnpjError(ownerCpfCnpj);
    if (cpfCnpjErr) { Alert.alert("CPF/CNPJ inválido", cpfCnpjErr); return; }
    if (!ownerPhone.trim()) { Alert.alert("Atenção", "Informe seu celular."); return; }

    if (isCard) {
      const rawNum = cardNumber.replace(/\D/g, "");
      if (rawNum.length < 13) { Alert.alert("Atenção", "Número do cartão inválido."); return; }
      const [expM, expY] = cardExpiry.split("/");
      if (!expM || !expY || expY.length < 4) { Alert.alert("Atenção", "Data de validade inválida. Use MM/AAAA."); return; }
      if (!cardCvv.trim()) { Alert.alert("Atenção", "CVV obrigatório."); return; }
      if (!cardHolder.trim()) { Alert.alert("Atenção", "Nome no cartão obrigatório."); return; }
      const cardCpfErr = validateCPF(cardCpf.replace(/\D/g, "")) ? null : "CPF do titular inválido. Verifique os dígitos.";
      if (cardCpfErr) { Alert.alert("CPF inválido", cardCpfErr); return; }
      if (cardCep.replace(/\D/g, "").length < 8) { Alert.alert("Atenção", "CEP obrigatório."); return; }
      if (!cardAddrNum.trim()) { Alert.alert("Atenção", "Número do endereço obrigatório."); return; }
    }

    const [expM, expY] = cardExpiry.split("/");

    createMutation.mutate({
      tenantId,
      planName: plan.label,
      planPrice: plan.price,
      billingType,
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      ownerCpfCnpj: ownerCpfCnpj.replace(/\D/g, ""),
      ownerMobilePhone: ownerPhone.replace(/\D/g, ""),
      ...(isCard ? {
        cardNumber: cardNumber.replace(/\D/g, ""),
        cardExpiryMonth: expM ?? "",
        cardExpiryYear: expY ?? "",
        cardCvv: cardCvv.trim(),
        cardHolder: cardHolder.trim(),
        cardCpf: cardCpf.replace(/\D/g, ""),
        cardCep: cardCep.replace(/\D/g, ""),
        cardAddrNum: cardAddrNum.trim(),
      } : {}),
    });
  }

  // ─── Tela de aguardando pagamento ─────────────────────────────────────────
  if (step === "pending") {
    const isPix = billingType === "PIX";
    return (
      <ScreenContainer containerClassName="bg-background">
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          <View style={styles.header}>
            <Text style={styles.badge}>BARBER PRO</Text>
            <Text style={styles.title}>
              {isCard ? "Assinatura criada!" : "Aguardando pagamento"}
            </Text>
            <Text style={styles.subtitle}>
              {isCard
                ? "Sua assinatura foi criada com cartão. O acesso será liberado automaticamente."
                : "Sua assinatura foi criada! Complete o pagamento Pix para liberar o acesso."}
            </Text>
          </View>

          <View style={styles.pendingCard}>
            <View style={styles.pendingIcon}>
              <IconSymbol name="clock.fill" size={32} color="#C9A84C" />
            </View>
            <Text style={styles.pendingTitle}>Plano {plan.label} — R$ {plan.price}/mês</Text>
            <Text style={styles.pendingDesc}>
              {isCard
                ? "Seu cartão foi registrado. O acesso será liberado após a confirmação do pagamento pelo Asaas."
                : "O link de pagamento foi aberto no navegador. Após confirmar o Pix, seu acesso será liberado automaticamente em até 5 minutos."}
            </Text>
          </View>

          {isPix && pixCopyCola && (
            <View style={styles.pixCard}>
              <Text style={styles.pixLabel}>Pix Copia e Cola</Text>
              <Text style={styles.pixCode} numberOfLines={3}>{pixCopyCola}</Text>
              <Pressable
                style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  import("expo-clipboard").then((Clipboard) => {
                    Clipboard.setStringAsync(pixCopyCola);
                    Alert.alert("Copiado!", "Código Pix copiado para a área de transferência.");
                  });
                }}
              >
                <Text style={styles.copyBtnText}>Copiar código Pix</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              utils.asaasPayments.getBarberproSubscription.invalidate({ tenantId });
              Alert.alert("Verificando...", "Aguarde enquanto verificamos o status do seu pagamento.");
            }}
          >
            <Text style={styles.ctaBtnText}>Verificar acesso</Text>
          </Pressable>

          <Pressable style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutBtnText}>Sair da conta</Text>
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.badge}>BARBER PRO</Text>
          <Text style={styles.title}>
            {step === "plans" ? "Escolha seu plano" : "Dados para assinatura"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "plans"
              ? "Seu período de trial encerrou. Assine agora para continuar usando o Barber Pro."
              : `Plano ${plan.label} — R$ ${plan.price}/mês`}
          </Text>
        </View>

        {step === "plans" ? (
          <>
            {PLANS.map((p) => {
              const active = selectedPlan === p.key;
              return (
                <Pressable
                  key={p.key}
                  style={({ pressed }) => [
                    styles.planCard,
                    active && styles.planCardActive,
                    p.highlight && styles.planCardHighlight,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => setSelectedPlan(p.key)}
                >
                  {p.highlight && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>MAIS POPULAR</Text>
                    </View>
                  )}
                  <View style={styles.planRow}>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planLabel}>{p.label}</Text>
                      <Text style={styles.planDesc}>{p.description}</Text>
                    </View>
                    <View style={styles.priceBox}>
                      <Text style={styles.priceValue}>R$ {p.price}</Text>
                      <Text style={styles.pricePer}>/mês</Text>
                    </View>
                  </View>
                  <View style={styles.featureList}>
                    {p.features.map((f) => (
                      <View key={f} style={styles.featureRow}>
                        <IconSymbol name="checkmark.circle.fill" size={14} color="#C9A84C" />
                        <Text style={styles.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </>
        ) : (
          <>
            {/* Dados pessoais */}
            <View style={styles.formCard}>
              <Text style={[styles.sectionTitle]}>DADOS PESSOAIS</Text>
              <Text style={styles.formLabel}>Nome completo *</Text>
              <TextInput style={styles.input} placeholder="Seu nome completo" placeholderTextColor="#555" value={ownerName} onChangeText={setOwnerName} />
              <Text style={styles.formLabel}>E-mail *</Text>
              <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor="#555" value={ownerEmail} onChangeText={setOwnerEmail} keyboardType="email-address" autoCapitalize="none" />
              <Text style={styles.formLabel}>CPF ou CNPJ *</Text>
              <TextInput style={styles.input} placeholder="000.000.000-00" placeholderTextColor="#555" value={ownerCpfCnpj} onChangeText={setOwnerCpfCnpj} keyboardType="numeric" />
              <Text style={styles.formLabel}>Celular *</Text>
              <TextInput style={styles.input} placeholder="(11) 99999-9999" placeholderTextColor="#555" value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" />
            </View>

            {/* Forma de pagamento */}
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>FORMA DE PAGAMENTO</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {(["PIX", "CREDIT_CARD", "UNDEFINED"] as BillingType[]).map((method) => {
                  const labels: Record<BillingType, string> = { PIX: "Pix", CREDIT_CARD: "Crédito", UNDEFINED: "Débito" };
                  const active = billingType === method;
                  return (
                    <Pressable
                      key={method}
                      style={({ pressed }) => [
                        styles.payMethodBtn,
                        active && styles.payMethodBtnActive,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handleSetBillingType(method)}
                    >
                      <Text style={[styles.payMethodText, active && styles.payMethodTextActive]}>
                        {labels[method]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Formulário de cartão */}
            {isCard && (
              <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>DADOS DO CARTÃO</Text>
                {/* Número com bandeira */}
                <Text style={styles.formLabel}>Número do cartão *</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={[styles.input, { paddingRight: 40 }]}
                    placeholder="0000 0000 0000 0000"
                    placeholderTextColor="#555"
                    value={cardNumber}
                    onChangeText={(t) => {
                      const formatted = formatCardNumber(t);
                      setCardNumber(formatted);
                      setCardBrand(detectBrand(formatted));
                    }}
                    keyboardType="numeric"
                    maxLength={19}
                  />
                  {cardBrand && (
                    <Text style={styles.brandIcon}>{cardBrand.icon}</Text>
                  )}
                </View>
                {cardBrand && (
                  <Text style={styles.brandName}>{cardBrand.name} detectado</Text>
                )}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Validade *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="MM/AAAA"
                      placeholderTextColor="#555"
                      value={cardExpiry}
                      onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                      keyboardType="numeric"
                      maxLength={7}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>CVV *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="000"
                      placeholderTextColor="#555"
                      value={cardCvv}
                      onChangeText={setCardCvv}
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry
                    />
                  </View>
                </View>

                <Text style={styles.formLabel}>Nome no cartão *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Como impresso no cartão"
                  placeholderTextColor="#555"
                  value={cardHolder}
                  onChangeText={setCardHolder}
                  autoCapitalize="characters"
                />

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>DADOS DO TITULAR</Text>
                <Text style={styles.formLabel}>CPF do titular *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="000.000.000-00"
                  placeholderTextColor="#555"
                  value={cardCpf}
                  onChangeText={(t) => setCardCpf(formatCpf(t))}
                  keyboardType="numeric"
                  maxLength={14}
                />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>CEP *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="00000-000"
                      placeholderTextColor="#555"
                      value={cardCep}
                      onChangeText={(t) => setCardCep(formatCep(t))}
                      keyboardType="numeric"
                      maxLength={9}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Número *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="123"
                      placeholderTextColor="#555"
                      value={cardAddrNum}
                      onChangeText={setCardAddrNum}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Text style={styles.secureNote}>🔒 Dados transmitidos com criptografia SSL ao Asaas.</Text>
              </View>
            )}

            <Pressable style={styles.backBtn} onPress={() => setStep("plans")}>
              <Text style={styles.backBtnText}>← Voltar para planos</Text>
            </Pressable>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={handleContinue}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.ctaBtnText}>
              {step === "plans"
                ? `Continuar com o Plano ${plan.label} →`
                : billingType === "PIX"
                  ? "Gerar Pix para pagamento"
                  : billingType === "CREDIT_CARD"
                    ? "Assinar com Cartão de Crédito"
                    : "Assinar com Cartão de Débito"}
            </Text>
          )}
        </Pressable>

        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Sair da conta</Text>
        </Pressable>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 28 },
  badge: { fontSize: 11, fontWeight: "800", color: "#C9A84C", letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: "#ECEDEE", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#9BA1A6", textAlign: "center", lineHeight: 20 },
  planCard: {
    backgroundColor: "#111",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
    padding: 16,
    marginBottom: 12,
  },
  planCardActive: { borderColor: "#C9A84C" },
  planCardHighlight: { borderColor: "#C9A84C44", backgroundColor: "#1A1500" },
  popularBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#C9A84C",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  popularBadgeText: { fontSize: 10, fontWeight: "800", color: "#000", letterSpacing: 1 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#444", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: "#C9A84C" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#C9A84C" },
  planLabel: { fontSize: 16, fontWeight: "700", color: "#ECEDEE" },
  planDesc: { fontSize: 12, color: "#9BA1A6", marginTop: 2 },
  priceBox: { alignItems: "flex-end" },
  priceValue: { fontSize: 20, fontWeight: "800", color: "#C9A84C" },
  pricePer: { fontSize: 11, color: "#9BA1A6" },
  featureList: { gap: 6 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  featureText: { fontSize: 13, color: "#9BA1A6" },
  formCard: {
    backgroundColor: "#111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 20,
    marginBottom: 16,
    gap: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#9BA1A6", letterSpacing: 1, marginBottom: 4 },
  formLabel: { fontSize: 12, fontWeight: "600", color: "#9BA1A6", marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#ECEDEE",
  },
  brandIcon: { position: "absolute", right: 12, top: 12, fontSize: 18 },
  brandName: { fontSize: 11, color: "#C9A84C", marginTop: 4, marginLeft: 2 },
  secureNote: { fontSize: 10, color: "#555", marginTop: 10 },
  ctaBtn: { backgroundColor: "#C9A84C", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  ctaBtnText: { fontSize: 15, fontWeight: "800", color: "#000" },
  backBtn: { alignItems: "center", marginBottom: 12 },
  backBtnText: { fontSize: 13, color: "#9BA1A6" },
  logoutBtn: { alignItems: "center", marginTop: 20 },
  logoutBtnText: { fontSize: 13, color: "#555" },
  // Pending
  pendingCard: {
    backgroundColor: "#111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C9A84C44",
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  pendingIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#1A1500",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  pendingTitle: { fontSize: 18, fontWeight: "700", color: "#ECEDEE", textAlign: "center" },
  pendingDesc: { fontSize: 13, color: "#9BA1A6", textAlign: "center", lineHeight: 20 },
  pixCard: {
    backgroundColor: "#111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 20,
    marginBottom: 16,
    gap: 8,
  },
  pixLabel: { fontSize: 12, fontWeight: "600", color: "#9BA1A6" },
  pixCode: { fontSize: 11, color: "#ECEDEE", fontFamily: "monospace", lineHeight: 18 },
  copyBtn: { backgroundColor: "#1A1A1A", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 4 },
  copyBtnText: { fontSize: 13, fontWeight: "600", color: "#C9A84C" },
  payMethodBtn: { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#2A2A2A" },
  payMethodBtnActive: { borderColor: "#C9A84C", backgroundColor: "#1A1500" },
  payMethodText: { fontSize: 13, fontWeight: "600", color: "#9BA1A6" },
  payMethodTextActive: { color: "#C9A84C" },
});
