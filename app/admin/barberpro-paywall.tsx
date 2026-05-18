/**
 * Tela de Paywall do Barber Pro
 * Exibida quando o trial expira ou a assinatura é cancelada.
 * Permite o dono da barbearia escolher um plano e assinar via Pix, Crédito ou Débito.
 * Pix: exibe QR Code nativo + copia e cola (sem redirecionar para o Asaas).
 */
import React, { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { cpfCnpjError, validateCPF } from "@/lib/cpf-cnpj";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [cpfCnpjTouched, setCpfCnpjTouched] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState(barber?.phone ?? "");
  const [step, setStep] = useState<"plans" | "form" | "pending">("plans");
  const [billingType, setBillingType] = useState<BillingType>("PIX");

  // Dados do QR Code Pix
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopyCola, setPixCopyCola] = useState<string | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pollingCount, setPollingCount] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Contador de expiração do QR Code (30 minutos = 1800 segundos)
  const PIX_EXPIRY_SECONDS = 30 * 60;
  const [pixSecondsLeft, setPixSecondsLeft] = useState(PIX_EXPIRY_SECONDS);
  const [pixExpired, setPixExpired] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tela de sucesso pós-pagamento
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Carregar forma de pagamento preferida
  useEffect(() => {
    AsyncStorage.getItem("@barberpro:preferredBillingType").then((saved) => {
      if (saved === "PIX" || saved === "CREDIT_CARD" || saved === "UNDEFINED") {
        setBillingType(saved as BillingType);
      }
    }).catch(() => {});
  }, []);

  // Polling automático de status do pagamento Pix
  useEffect(() => {
    if (step === "pending" && billingType === "PIX" && pixPaymentId) {
      pollingRef.current = setInterval(() => {
        setPollingCount((c) => c + 1);
      }, 10000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [step, billingType, pixPaymentId]);

  // Contador de expiração do QR Code
  useEffect(() => {
    if (step === "pending" && billingType === "PIX" && pixQrCode) {
      setPixSecondsLeft(PIX_EXPIRY_SECONDS);
      setPixExpired(false);
      countdownRef.current = setInterval(() => {
        setPixSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(countdownRef.current!);
            setPixExpired(true);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [step, billingType, pixQrCode]);

  const utils = trpc.useUtils();

  // Verificar status via polling — detectar pagamento confirmado
  useEffect(() => {
    if (pollingCount > 0 && step === "pending") {
      utils.asaasPayments.getBarberproSubscription.fetch({ tenantId }).then((data) => {
        if (data?.status === "active") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          setPaymentSuccess(true);
          setTimeout(() => {
            utils.asaasPayments.getBarberproSubscription.invalidate({ tenantId });
          }, 3000);
        }
      }).catch(() => {});
    }
  }, [pollingCount]);

  function handleSetBillingType(method: BillingType) {
    setBillingType(method);
    AsyncStorage.setItem("@barberpro:preferredBillingType", method).catch(() => {});
  }

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

  const createMutation = trpc.asaasPayments.createBarberproSubscription.useMutation({
    onSuccess: (data) => {
      setStep("pending");
      // Usar QR Code retornado diretamente pelo servidor
      if (data.pixQrCode) setPixQrCode(data.pixQrCode);
      if (data.pixCopyCola) setPixCopyCola(data.pixCopyCola);
      if (data.pixPaymentId) setPixPaymentId(data.pixPaymentId);
      // Resetar contador
      setPixSecondsLeft(PIX_EXPIRY_SECONDS);
      setPixExpired(false);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  // Mutation para renovar o QR Code (cria nova assinatura/pagamento)
  const renewPixMutation = trpc.asaasPayments.createBarberproSubscription.useMutation({
    onSuccess: (data) => {
      if (data.pixQrCode) setPixQrCode(data.pixQrCode);
      if (data.pixCopyCola) setPixCopyCola(data.pixCopyCola);
      if (data.pixPaymentId) setPixPaymentId(data.pixPaymentId);
      setPixSecondsLeft(PIX_EXPIRY_SECONDS);
      setPixExpired(false);
      setCopied(false);
    },
    onError: (e) => Alert.alert("Erro ao renovar QR Code", e.message),
  });

  function handleRenewQrCode() {
    const [expM, expY] = cardExpiry.split("/");
    renewPixMutation.mutate({
      tenantId,
      planName: plan.label,
      planPrice: plan.price,
      billingType: "PIX",
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      ownerCpfCnpj: ownerCpfCnpj.replace(/\D/g, ""),
      ownerMobilePhone: ownerPhone.replace(/\D/g, ""),
    });
  }

  // Formatar segundos como MM:SS
  function formatCountdown(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

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

  // ─── Copiar código Pix ────────────────────────────────────────────────────
  async function handleCopyPix() {
    if (!pixCopyCola) return;
    await Clipboard.setStringAsync(pixCopyCola);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  // ─── Verificar status manualmente ─────────────────────────────────────────
  function handleCheckStatus() {
    utils.asaasPayments.getBarberproSubscription.fetch({ tenantId }).then((data) => {
      if (data?.status === "active") {
        // Parar todos os timers
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setPaymentSuccess(true);
        // Redirecionar após 3 segundos
        setTimeout(() => {
          utils.asaasPayments.getBarberproSubscription.invalidate({ tenantId });
        }, 3000);
      } else {
        Alert.alert("⏳ Pagamento pendente", "Ainda não identificamos o pagamento. Aguarde alguns instantes e tente novamente.");
      }
    }).catch(() => {
      utils.asaasPayments.getBarberproSubscription.invalidate({ tenantId });
    });
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

  // ─── Tela de sucesso pós-pagamento ─────────────────────────────────────────
  if (paymentSuccess) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          {/* Ícone de sucesso */}
          <View style={{
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: "#C9A84C", alignItems: "center", justifyContent: "center",
            marginBottom: 24,
            shadowColor: "#C9A84C", shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
          }}>
            <IconSymbol name="checkmark.circle.fill" size={56} color="#fff" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#C9A84C", textAlign: "center", marginBottom: 12 }}>
            Pagamento confirmado!
          </Text>
          <Text style={{ fontSize: 16, color: "#ECEDEE", textAlign: "center", lineHeight: 24, marginBottom: 8 }}>
            Bem-vindo ao Barber Pro
          </Text>
          <Text style={{ fontSize: 14, color: "#9BA1A6", textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
            Plano {plan.label} ativado com sucesso.{"\n"}Seu acesso completo está liberado.
          </Text>
          <View style={{
            backgroundColor: "#1e2022", borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: "#C9A84C", width: "100%", alignItems: "center",
          }}>
            <Text style={{ fontSize: 13, color: "#9BA1A6", marginBottom: 4 }}>Plano ativo</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#C9A84C" }}>{plan.label} — R$ {plan.price}/mês</Text>
          </View>
          <Text style={{ fontSize: 12, color: "#687076", textAlign: "center", marginTop: 24 }}>
            Redirecionando automaticamente...
          </Text>
        </View>
      </ScreenContainer>
    );
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
              {isCard ? "Assinatura criada!" : "Pague com Pix"}
            </Text>
            <Text style={styles.subtitle}>
              {isCard
                ? "Sua assinatura foi criada com cartão. O acesso será liberado automaticamente."
                : `Plano ${plan.label} — R$ ${plan.price}/mês`}
            </Text>
          </View>

          {isPix ? (
            <>
              {/* QR Code ou tela de expirado */}
              <View style={styles.qrContainer}>
                {pixExpired ? (
                  <View style={{ alignItems: "center", gap: 12, paddingVertical: 8 }}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={40} color="#F59E0B" />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#F59E0B", textAlign: "center" }}>
                      QR Code expirado
                    </Text>
                    <Text style={{ fontSize: 13, color: "#9BA1A6", textAlign: "center" }}>
                      O código Pix expirou após 30 minutos.
                    </Text>
                    <Pressable
                      style={({ pressed }) => [{
                        backgroundColor: "#C9A84C", borderRadius: 10,
                        paddingVertical: 12, paddingHorizontal: 24,
                        opacity: pressed || renewPixMutation.isPending ? 0.75 : 1,
                      }]}
                      onPress={handleRenewQrCode}
                      disabled={renewPixMutation.isPending}
                    >
                      {renewPixMutation.isPending
                        ? <ActivityIndicator color="#000" size="small" />
                        : <Text style={{ color: "#000", fontWeight: "700", fontSize: 14 }}>Gerar novo QR Code</Text>
                      }
                    </Pressable>
                  </View>
                ) : pixQrCode ? (
                  <>
                    {/* Contador de expiração */}
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: 6,
                      backgroundColor: pixSecondsLeft < 120 ? "#3d1f00" : "#1e2022",
                      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
                      borderWidth: 1, borderColor: pixSecondsLeft < 120 ? "#F59E0B" : "#334155",
                      marginBottom: 8,
                    }}>
                      <IconSymbol name="clock.fill" size={14} color={pixSecondsLeft < 120 ? "#F59E0B" : "#9BA1A6"} />
                      <Text style={{ fontSize: 13, color: pixSecondsLeft < 120 ? "#F59E0B" : "#9BA1A6", fontWeight: "600" }}>
                        Expira em {formatCountdown(pixSecondsLeft)}
                      </Text>
                    </View>
                    <Image
                      source={{ uri: `data:image/png;base64,${pixQrCode}` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrHint}>Abra o app do seu banco e escaneie o QR Code</Text>
                  </>
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <ActivityIndicator color="#C9A84C" size="large" />
                    <Text style={styles.qrHint}>Gerando QR Code...</Text>
                  </View>
                )}
              </View>

              {/* Separador */}
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>ou</Text>
                <View style={styles.orLine} />
              </View>

              {/* Copia e cola */}
              {pixCopyCola ? (
                <View style={styles.pixCard}>
                  <Text style={styles.pixLabel}>Pix Copia e Cola</Text>
                  <Text style={styles.pixCode} numberOfLines={4} selectable>{pixCopyCola}</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.copyBtn,
                      copied && styles.copyBtnSuccess,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={handleCopyPix}
                  >
                    <IconSymbol
                      name={copied ? "checkmark.circle.fill" : "doc.on.doc.fill"}
                      size={16}
                      color={copied ? "#000" : "#C9A84C"}
                    />
                    <Text style={[styles.copyBtnText, copied && { color: "#000" }]}>
                      {copied ? "Código copiado!" : "Copiar código Pix"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Instruções */}
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsTitle}>Como pagar</Text>
                {[
                  "Abra o app do seu banco",
                  "Escolha pagar via Pix",
                  "Escaneie o QR Code ou cole o código",
                  "Confirme o pagamento de R$ " + plan.price,
                  "Seu acesso será liberado automaticamente",
                ].map((step, i) => (
                  <View key={i} style={styles.instructionRow}>
                    <View style={styles.instructionNum}>
                      <Text style={styles.instructionNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.instructionText}>{step}</Text>
                  </View>
                ))}
              </View>

              {/* Botão verificar */}
              <Pressable
                style={({ pressed }) => [styles.ctaBtn, { marginTop: 8 }, pressed && { opacity: 0.85 }]}
                onPress={handleCheckStatus}
              >
                <Text style={styles.ctaBtnText}>Já paguei — verificar status</Text>
              </Pressable>

              <Text style={styles.pollingNote}>
                Verificando automaticamente a cada 10 segundos...
              </Text>
            </>
          ) : (
            <View style={styles.pendingCard}>
              <View style={styles.pendingIcon}>
                <IconSymbol name="checkmark.circle.fill" size={32} color="#C9A84C" />
              </View>
              <Text style={styles.pendingTitle}>Plano {plan.label} — R$ {plan.price}/mês</Text>
              <Text style={styles.pendingDesc}>
                Seu cartão foi registrado. O acesso será liberado após a confirmação do pagamento pelo Asaas.
              </Text>
            </View>
          )}

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
              {(() => {
                const digits = ownerCpfCnpj.replace(/\D/g, '');
                const isComplete = digits.length === 11 || digits.length === 14;
                const errMsg = cpfCnpjTouched && isComplete ? cpfCnpjError(ownerCpfCnpj) : null;
                const isValid = cpfCnpjTouched && isComplete && !errMsg;
                return (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TextInput
                        style={[styles.input, { flex: 1 }, errMsg ? { borderColor: '#F87171', borderWidth: 1.5 } : isValid ? { borderColor: '#4ADE80', borderWidth: 1.5 } : {}]}
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                        placeholderTextColor="#555"
                        value={ownerCpfCnpj}
                        onChangeText={(v) => { setOwnerCpfCnpj(v); if (!cpfCnpjTouched) setCpfCnpjTouched(true); }}
                        onBlur={() => setCpfCnpjTouched(true)}
                        keyboardType="numeric"
                      />
                      {cpfCnpjTouched && isComplete && (
                        <Text style={{ fontSize: 18 }}>{errMsg ? '❌' : '✅'}</Text>
                      )}
                    </View>
                    {errMsg ? <Text style={{ color: '#F87171', fontSize: 12, marginTop: 4 }}>{errMsg}</Text> : null}
                  </>
                );
              })()}
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
              {billingType === "PIX" && (
                <Text style={styles.pixHint}>
                  ✓ QR Code exibido diretamente no app — sem sair do Barber Pro
                </Text>
              )}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator color="#000" size="small" />
              <Text style={styles.ctaBtnText}>
                {billingType === "PIX" ? "Gerando QR Code..." : "Processando..."}
              </Text>
            </View>
          ) : (
            <Text style={styles.ctaBtnText}>
              {step === "plans"
                ? `Continuar com o Plano ${plan.label} →`
                : billingType === "PIX"
                  ? "Gerar QR Code Pix"
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
  pixHint: { fontSize: 11, color: "#4ADE80", marginTop: 8 },
  // QR Code
  qrContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 8,
  },
  qrImage: { width: 220, height: 220 },
  qrPlaceholder: { width: 220, height: 220, alignItems: "center", justifyContent: "center", gap: 12 },
  qrHint: { fontSize: 12, color: "#444", textAlign: "center", marginTop: 12, lineHeight: 18 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: "#2A2A2A" },
  orText: { fontSize: 12, color: "#555" },
  pixCard: {
    backgroundColor: "#111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 20,
    marginBottom: 16,
    gap: 8,
  },
  pixLabel: { fontSize: 11, fontWeight: "700", color: "#9BA1A6", letterSpacing: 1 },
  pixCode: { fontSize: 11, color: "#ECEDEE", fontFamily: "monospace", lineHeight: 18 },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#C9A84C44",
  },
  copyBtnSuccess: { backgroundColor: "#C9A84C" },
  copyBtnText: { fontSize: 13, fontWeight: "600", color: "#C9A84C" },
  instructionsCard: {
    backgroundColor: "#111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 20,
    marginBottom: 16,
    gap: 12,
  },
  instructionsTitle: { fontSize: 13, fontWeight: "700", color: "#ECEDEE", marginBottom: 4 },
  instructionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  instructionNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#C9A84C22",
    alignItems: "center", justifyContent: "center",
  },
  instructionNumText: { fontSize: 12, fontWeight: "700", color: "#C9A84C" },
  instructionText: { fontSize: 13, color: "#9BA1A6", flex: 1 },
  pollingNote: { fontSize: 11, color: "#555", textAlign: "center", marginTop: 8 },
  // Pending (cartão)
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
  payMethodBtn: { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#2A2A2A" },
  payMethodBtnActive: { borderColor: "#C9A84C", backgroundColor: "#1A1500" },
  payMethodText: { fontSize: 13, fontWeight: "600", color: "#9BA1A6" },
  payMethodTextActive: { color: "#C9A84C" },
});
