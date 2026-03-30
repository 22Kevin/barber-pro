import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";
import * as Haptics from "expo-haptics";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Step1Data {
  shopName: string;
  phone: string;
  cnpj: string;
  instagram: string;
}

interface Step2Data {
  cep: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  city: string;
  state: string;
}

interface Step3Data {
  workDays: number[]; // 0=Dom, 1=Seg, ..., 6=Sab
  openTime: string;
  closeTime: string;
  lunchStart: string;
  lunchEnd: string;
  hasLunch: boolean;
}

interface Step4Data {
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminConfirm: string;
}

const DAYS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6]; // Seg-Sab

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function OnboardingRegisterScreen() {
  const router = useRouter();
  const { login } = useBarberAuth();
  const params = useLocalSearchParams<{ plan?: string }>();
  const selectedPlan = (params.plan as "solo" | "team" | "studio") ?? "solo";

  const [currentStep, setCurrentStep] = useState(1);
  const progressAnim = useRef(new Animated.Value(0.25)).current;

  // Dados de cada etapa
  const [step1, setStep1] = useState<Step1Data>({
    shopName: "",
    phone: "",
    cnpj: "",
    instagram: "",
  });
  const [step2, setStep2] = useState<Step2Data>({
    cep: "",
    address: "",
    addressNumber: "",
    addressComplement: "",
    city: "",
    state: "",
  });
  const [step3, setStep3] = useState<Step3Data>({
    workDays: DEFAULT_WORK_DAYS,
    openTime: "09:00",
    closeTime: "19:00",
    lunchStart: "12:00",
    lunchEnd: "13:00",
    hasLunch: true,
  });
  const [step4, setStep4] = useState<Step4Data>({
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    adminConfirm: "",
  });

  const [loadingCep, setLoadingCep] = useState(false);
  const planLabel = selectedPlan === "team" ? "Equipe" : selectedPlan === "studio" ? "Estúdio" : "Solo";
  const planPrice = selectedPlan === "team" ? "R$89" : selectedPlan === "studio" ? "R$149" : "R$49";

  const registerMutation = trpc.onboarding.register.useMutation({
    onSuccess: async (data) => {
      await login(data.admin as any);
      // Navega para a tela de boas-vindas com o slug e nome da barbearia
      router.replace({
        pathname: "/onboarding/welcome" as any,
        params: {
          slug: step1.shopName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          shopName: step1.shopName,
          plan: selectedPlan,
        },
      });
    },
    onError: (err) => {
      Alert.alert("Erro no cadastro", err.message);
    },
  });

  // ─── Navegação entre etapas ────────────────────────────────────────────────

  function goToStep(step: number) {
    setCurrentStep(step);
    Animated.spring(progressAnim, {
      toValue: step * 0.25,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function validateStep1(): boolean {
    if (!step1.shopName.trim()) {
      Alert.alert("Atenção", "Informe o nome da barbearia.");
      return false;
    }
    if (!step1.phone.trim()) {
      Alert.alert("Atenção", "Informe o telefone/WhatsApp.");
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (!step2.address.trim()) {
      Alert.alert("Atenção", "Informe o endereço.");
      return false;
    }
    if (!step2.city.trim() || !step2.state.trim()) {
      Alert.alert("Atenção", "Informe a cidade e o estado.");
      return false;
    }
    return true;
  }

  function validateStep3(): boolean {
    if (step3.workDays.length === 0) {
      Alert.alert("Atenção", "Selecione pelo menos um dia de funcionamento.");
      return false;
    }
    return true;
  }

  function validateStep4(): boolean {
    if (!step4.adminName.trim() || !step4.adminEmail.trim() || !step4.adminPassword) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return false;
    }
    if (step4.adminPassword !== step4.adminConfirm) {
      Alert.alert("Atenção", "As senhas não coincidem.");
      return false;
    }
    if (step4.adminPassword.length < 6) {
      Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres.");
      return false;
    }
    return true;
  }

  // ─── Busca de CEP ──────────────────────────────────────────────────────────

  async function fetchCep(cep: string) {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStep2((prev) => ({
          ...prev,
          address: data.logradouro || prev.address,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // silencioso — usuário preenche manualmente
    } finally {
      setLoadingCep(false);
    }
  }

  // ─── Submit final ──────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!validateStep4()) return;
    registerMutation.mutate({
      plan: selectedPlan,
      shop: {
        name: step1.shopName.trim(),
        phone: step1.phone.trim(),
        cnpj: step1.cnpj.trim() || undefined,
        instagram: step1.instagram.trim() || undefined,
        cep: step2.cep.trim() || undefined,
        address: step2.address.trim() || undefined,
        addressNumber: step2.addressNumber.trim() || undefined,
        addressComplement: step2.addressComplement.trim() || undefined,
        city: step2.city.trim() || undefined,
        state: step2.state.trim() || undefined,
      },
      schedule: {
        workDays: step3.workDays,
        openTime: step3.openTime,
        closeTime: step3.closeTime,
        lunchStart: step3.hasLunch ? step3.lunchStart : undefined,
        lunchEnd: step3.hasLunch ? step3.lunchEnd : undefined,
      },
      admin: {
        name: step4.adminName.trim(),
        email: step4.adminEmail.trim().toLowerCase(),
        password: step4.adminPassword,
      },
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={require("@/assets/images/icon.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandName}>BARBER PRO</Text>
          <View style={styles.planBadgeRow}>
            <Text style={styles.stepLabel}>Etapa {currentStep} de 4</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>Plano {planLabel} · {planPrice}/mês</Text>
            </View>
          </View>
        </View>

        {/* Barra de progresso */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        {/* Títulos das etapas */}
        <View style={styles.stepTitleRow}>
          {["Barbearia", "Endereço", "Horários", "Acesso"].map((label, i) => (
            <View key={label} style={styles.stepTitleItem}>
              <View style={[styles.stepDot, currentStep > i + 1 && styles.stepDotDone, currentStep === i + 1 && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, (currentStep >= i + 1) && styles.stepDotTextActive]}>
                  {currentStep > i + 1 ? "✓" : String(i + 1)}
                </Text>
              </View>
              <Text style={[styles.stepTitleText, currentStep === i + 1 && styles.stepTitleActive]}>{label}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── ETAPA 1: Dados da Barbearia ─────────────────────────────── */}
          {currentStep === 1 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dados da Barbearia</Text>
              <Text style={styles.cardDesc}>Informações básicas que aparecerão para seus clientes.</Text>

              <Field label="Nome da Barbearia *" value={step1.shopName} onChangeText={(v) => setStep1((p) => ({ ...p, shopName: v }))} placeholder="Ex: Barbearia do João" />
              <Field label="Telefone / WhatsApp *" value={step1.phone} onChangeText={(v) => setStep1((p) => ({ ...p, phone: v }))} placeholder="(11) 99999-9999" keyboard="phone-pad" />
              <Field label="CNPJ" value={step1.cnpj} onChangeText={(v) => setStep1((p) => ({ ...p, cnpj: v }))} placeholder="00.000.000/0001-00 (opcional)" />
              <Field label="Instagram" value={step1.instagram} onChangeText={(v) => setStep1((p) => ({ ...p, instagram: v }))} placeholder="@barbearia (opcional)" />

              <Pressable
                style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
                onPress={() => { if (validateStep1()) goToStep(2); }}
              >
                <Text style={styles.btnText}>PRÓXIMO →</Text>
              </Pressable>
            </View>
          )}

          {/* ─── ETAPA 2: Endereço ───────────────────────────────────────── */}
          {currentStep === 2 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Endereço</Text>
              <Text style={styles.cardDesc}>Onde sua barbearia está localizada.</Text>

              <View style={styles.cepRow}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="CEP"
                    value={step2.cep}
                    onChangeText={(v) => {
                      setStep2((p) => ({ ...p, cep: v }));
                      if (v.replace(/\D/g, "").length === 8) fetchCep(v);
                    }}
                    placeholder="00000-000"
                    keyboard="numeric"
                  />
                </View>
                {loadingCep && <ActivityIndicator color="#C9A84C" style={{ marginLeft: 12, marginTop: 28 }} />}
              </View>

              <Field label="Rua / Avenida" value={step2.address} onChangeText={(v) => setStep2((p) => ({ ...p, address: v }))} placeholder="Rua das Flores" />
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Field label="Número" value={step2.addressNumber} onChangeText={(v) => setStep2((p) => ({ ...p, addressNumber: v }))} placeholder="123" keyboard="numeric" />
                </View>
                <View style={{ flex: 2 }}>
                  <Field label="Complemento" value={step2.addressComplement} onChangeText={(v) => setStep2((p) => ({ ...p, addressComplement: v }))} placeholder="Sala 2 (opcional)" />
                </View>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 2, marginRight: 8 }}>
                  <Field label="Cidade *" value={step2.city} onChangeText={(v) => setStep2((p) => ({ ...p, city: v }))} placeholder="São Paulo" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Estado *" value={step2.state} onChangeText={(v) => setStep2((p) => ({ ...p, state: v.toUpperCase().slice(0, 2) }))} placeholder="SP" />
                </View>
              </View>

              <View style={styles.navRow}>
                <Pressable style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]} onPress={() => goToStep(1)}>
                  <Text style={styles.btnSecondaryText}>← VOLTAR</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.btn, styles.btnFlex, pressed && { opacity: 0.8 }]} onPress={() => { if (validateStep2()) goToStep(3); }}>
                  <Text style={styles.btnText}>PRÓXIMO →</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ─── ETAPA 3: Horários ───────────────────────────────────────── */}
          {currentStep === 3 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Horários de Funcionamento</Text>
              <Text style={styles.cardDesc}>Configure os dias e horários padrão da barbearia.</Text>

              <Text style={styles.fieldLabel}>Dias de funcionamento *</Text>
              <View style={styles.daysRow}>
                {DAYS_LABELS.map((day, i) => {
                  const active = step3.workDays.includes(i);
                  return (
                    <Pressable
                      key={day}
                      style={[styles.dayBtn, active && styles.dayBtnActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setStep3((p) => ({
                          ...p,
                          workDays: active ? p.workDays.filter((d) => d !== i) : [...p.workDays, i].sort(),
                        }));
                      }}
                    >
                      <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Field label="Abertura" value={step3.openTime} onChangeText={(v) => setStep3((p) => ({ ...p, openTime: v }))} placeholder="09:00" keyboard="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Fechamento" value={step3.closeTime} onChangeText={(v) => setStep3((p) => ({ ...p, closeTime: v }))} placeholder="19:00" keyboard="numeric" />
                </View>
              </View>

              {/* Toggle almoço */}
              <Pressable
                style={styles.toggleRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep3((p) => ({ ...p, hasLunch: !p.hasLunch }));
                }}
              >
                <View style={[styles.toggle, step3.hasLunch && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, step3.hasLunch && styles.toggleThumbActive]} />
                </View>
                <Text style={styles.toggleLabel}>Intervalo de almoço</Text>
              </Pressable>

              {step3.hasLunch && (
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Field label="Início almoço" value={step3.lunchStart} onChangeText={(v) => setStep3((p) => ({ ...p, lunchStart: v }))} placeholder="12:00" keyboard="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Fim almoço" value={step3.lunchEnd} onChangeText={(v) => setStep3((p) => ({ ...p, lunchEnd: v }))} placeholder="13:00" keyboard="numeric" />
                  </View>
                </View>
              )}

              <View style={styles.navRow}>
                <Pressable style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]} onPress={() => goToStep(2)}>
                  <Text style={styles.btnSecondaryText}>← VOLTAR</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.btn, styles.btnFlex, pressed && { opacity: 0.8 }]} onPress={() => { if (validateStep3()) goToStep(4); }}>
                  <Text style={styles.btnText}>PRÓXIMO →</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ─── ETAPA 4: Conta do Administrador ────────────────────────── */}
          {currentStep === 4 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Conta do Administrador</Text>
              <Text style={styles.cardDesc}>Crie o acesso principal para gerenciar sua barbearia.</Text>

              <Field label="Seu nome *" value={step4.adminName} onChangeText={(v) => setStep4((p) => ({ ...p, adminName: v }))} placeholder="João da Silva" />
              <Field label="E-mail *" value={step4.adminEmail} onChangeText={(v) => setStep4((p) => ({ ...p, adminEmail: v }))} placeholder="joao@barbearia.com" keyboard="email-address" autoCapitalize="none" />
              <Field label="Senha *" value={step4.adminPassword} onChangeText={(v) => setStep4((p) => ({ ...p, adminPassword: v }))} placeholder="Mínimo 6 caracteres" secure />
              <Field label="Confirmar senha *" value={step4.adminConfirm} onChangeText={(v) => setStep4((p) => ({ ...p, adminConfirm: v }))} placeholder="Repita a senha" secure />

              <View style={styles.termsBox}>
                <Text style={styles.termsText}>
                  Ao criar sua conta, você concorda com os{" "}
                  <Text style={styles.termsLink}>Termos de Uso</Text> e a{" "}
                  <Text style={styles.termsLink}>Política de Privacidade</Text> do Barber Pro.
                </Text>
              </View>

              <View style={styles.navRow}>
                <Pressable style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]} onPress={() => goToStep(3)}>
                  <Text style={styles.btnSecondaryText}>← VOLTAR</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.btn, styles.btnFlex, pressed && { opacity: 0.8 }]}
                  onPress={handleSubmit}
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <ActivityIndicator color="#0A0A0A" />
                  ) : (
                    <Text style={styles.btnText}>CRIAR CONTA ✓</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─── Campo de Formulário ──────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboard,
  secure,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboard?: "default" | "email-address" | "numeric" | "phone-pad";
  secure?: boolean;
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#555"
        secureTextEntry={secure}
        keyboardType={keyboard ?? "default"}
        autoCapitalize={autoCapitalize ?? (keyboard === "email-address" ? "none" : "sentences")}
        autoCorrect={false}
        returnKeyType="next"
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 16, paddingBottom: 8 },
  logo: { width: 52, height: 52, borderRadius: 12, marginBottom: 6 },
  brandName: { fontSize: 20, fontWeight: "800", color: "#C9A84C", letterSpacing: 3 },
  stepLabel: { fontSize: 12, color: "#888880", letterSpacing: 1 },
  planBadgeRow: { alignItems: "center", gap: 6, marginTop: 2 },
  planBadge: { backgroundColor: "#1A1500", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: "#C9A84C44" },
  planBadgeText: { fontSize: 11, fontWeight: "700", color: "#C9A84C", letterSpacing: 0.5 },

  progressTrack: { height: 4, backgroundColor: "#1E1E1E", marginHorizontal: 24, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: "#C9A84C", borderRadius: 2 },

  stepTitleRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 12 },
  stepTitleItem: { alignItems: "center", flex: 1 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#1E1E1E", borderWidth: 1.5, borderColor: "#2A2A2A", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  stepDotActive: { borderColor: "#C9A84C", backgroundColor: "#1A1500" },
  stepDotDone: { borderColor: "#C9A84C", backgroundColor: "#C9A84C" },
  stepDotText: { fontSize: 10, fontWeight: "700", color: "#555" },
  stepDotTextActive: { color: "#C9A84C" },
  stepTitleText: { fontSize: 10, color: "#555", fontWeight: "500" },
  stepTitleActive: { color: "#C9A84C" },

  scroll: { flexGrow: 1, padding: 24, paddingTop: 8 },
  card: { backgroundColor: "#141414", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#2A2A2A" },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F0", marginBottom: 6 },
  cardDesc: { fontSize: 13, color: "#888880", marginBottom: 20, lineHeight: 18 },

  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: "#888880", marginBottom: 6, fontWeight: "600", letterSpacing: 0.5 },
  input: { backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0" },

  row: { flexDirection: "row" },
  cepRow: { flexDirection: "row", alignItems: "flex-start" },

  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  dayBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A" },
  dayBtnActive: { backgroundColor: "#1A1500", borderColor: "#C9A84C" },
  dayBtnText: { fontSize: 12, fontWeight: "600", color: "#555" },
  dayBtnTextActive: { color: "#C9A84C" },

  toggleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", justifyContent: "center", paddingHorizontal: 2 },
  toggleActive: { backgroundColor: "#1A1500", borderColor: "#C9A84C" },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#555" },
  toggleThumbActive: { backgroundColor: "#C9A84C", alignSelf: "flex-end" },
  toggleLabel: { fontSize: 14, color: "#888880", marginLeft: 10 },

  termsBox: { backgroundColor: "#0F0F0F", borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#2A2A2A" },
  termsText: { fontSize: 12, color: "#555", lineHeight: 18 },
  termsLink: { color: "#C9A84C" },

  navRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  btnFlex: { flex: 1, marginTop: 0 },
  btnText: { color: "#0A0A0A", fontSize: 14, fontWeight: "800", letterSpacing: 1.5 },
  btnSecondary: { borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16, alignItems: "center", marginTop: 0 },
  btnSecondaryText: { color: "#888880", fontSize: 13, fontWeight: "600" },
});
