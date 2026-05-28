import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

type Step = "email" | "code" | "newPassword";
const STEPS: Step[] = ["email", "code", "newPassword"];

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
    ]).start();
  }, []);

  const forgotMutation = trpc.clientAuth.forgotPassword.useMutation({
    onSuccess: (data) => {
      if (data.token) {
        Alert.alert(
          "📧 Código de Recuperação",
          `Seu código de verificação é:\n\n${data.token}\n\n(Em produção este código seria enviado para o seu e-mail)\n\nEle expira em 15 minutos.`,
          [{ text: "Entendido", onPress: () => setStep("code") }]
        );
      } else {
        Alert.alert("📧 Verifique seu e-mail", "Se este e-mail estiver cadastrado, você receberá as instruções de recuperação.", [{ text: "OK" }]);
      }
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const verifyMutation = trpc.clientAuth.verifyResetToken.useMutation({
    onSuccess: () => setStep("newPassword"),
    onError: (err) => Alert.alert("Código inválido", err.message),
  });

  const resetMutation = trpc.clientAuth.resetPassword.useMutation({
    onSuccess: () => {
      Alert.alert("✅ Senha redefinida!", "Sua senha foi alterada com sucesso. Faça login com a nova senha.", [
        { text: "Fazer login", onPress: () => router.replace("/client/login" as any) },
      ]);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const isLoading = forgotMutation.isPending || verifyMutation.isPending || resetMutation.isPending;
  const currentStepIdx = STEPS.indexOf(step);

  const STEP_TITLES: Record<Step, string> = {
    email: "Recuperar Senha",
    code: "Verificar Código",
    newPassword: "Nova Senha",
  };
  const STEP_SUBTITLES: Record<Step, string> = {
    email: "Informe seu e-mail cadastrado para receber o código de recuperação.",
    code: `Digite o código de 6 dígitos enviado para\n${email}`,
    newPassword: "Crie uma nova senha segura para sua conta.",
  };

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Botão voltar */}
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Ícone */}
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>🔐</Text>
            </View>

            <Text style={styles.title}>{STEP_TITLES[step]}</Text>
            <Text style={styles.subtitle}>{STEP_SUBTITLES[step]}</Text>

            {/* Indicador de etapas */}
            <View style={styles.stepsRow}>
              {STEPS.map((s, i) => {
                const done = currentStepIdx > i;
                const active = step === s;
                return (
                  <View key={s} style={styles.stepItem}>
                    <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                      <Text style={[styles.stepNum, (active || done) && { color: "#000" }]}>
                        {done ? "✓" : String(i + 1)}
                      </Text>
                    </View>
                    {i < 2 && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
                  </View>
                );
              })}
            </View>

            {/* Etapa 1 — E-mail */}
            {step === "email" && (
              <View style={styles.form}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor="#4B5563"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => { if (!email.trim()) return; forgotMutation.mutate({ email: email.trim().toLowerCase() }); }}
                />
                <TouchableOpacity
                  style={[styles.btn, isLoading && { opacity: 0.7 }]}
                  onPress={() => { if (!email.trim()) { Alert.alert("Atenção", "Informe seu e-mail."); return; } forgotMutation.mutate({ email: email.trim().toLowerCase() }); }}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnText}>{isLoading ? "Enviando..." : "Enviar Código"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Etapa 2 — Código */}
            {step === "code" && (
              <View style={styles.form}>
                <Text style={styles.label}>Código de 6 dígitos</Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder="000000"
                  placeholderTextColor="#374151"
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={() => { if (code.length !== 6) return; verifyMutation.mutate({ email: email.trim().toLowerCase(), token: code.trim() }); }}
                />
                <TouchableOpacity
                  style={[styles.btn, isLoading && { opacity: 0.7 }]}
                  onPress={() => { if (code.length !== 6) { Alert.alert("Atenção", "O código deve ter 6 dígitos."); return; } verifyMutation.mutate({ email: email.trim().toLowerCase(), token: code.trim() }); }}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnText}>{isLoading ? "Verificando..." : "Verificar Código"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={() => { setCode(""); forgotMutation.mutate({ email: email.trim().toLowerCase() }); }}
                >
                  <Text style={styles.resendText}>Reenviar código</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Etapa 3 — Nova senha */}
            {step === "newPassword" && (
              <View style={styles.form}>
                <Text style={styles.label}>Nova senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#4B5563"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  returnKeyType="next"
                />
                <Text style={[styles.label, { marginTop: 16 }]}>Confirmar nova senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Repita a nova senha"
                  placeholderTextColor="#4B5563"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (newPassword.length < 6) { Alert.alert("Atenção", "A nova senha deve ter pelo menos 6 caracteres."); return; }
                    if (newPassword !== confirmPassword) { Alert.alert("Atenção", "As senhas não coincidem."); return; }
                    resetMutation.mutate({ email: email.trim().toLowerCase(), token: code.trim(), newPassword });
                  }}
                />
                {newPassword.length > 0 && confirmPassword.length > 0 && (
                  <Text style={[styles.matchHint, { color: newPassword === confirmPassword ? "#22C55E" : "#EF4444" }]}>
                    {newPassword === confirmPassword ? "✓ Senhas coincidem" : "✗ Senhas não coincidem"}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.btn, isLoading && { opacity: 0.7 }]}
                  onPress={() => {
                    if (newPassword.length < 6) { Alert.alert("Atenção", "A nova senha deve ter pelo menos 6 caracteres."); return; }
                    if (newPassword !== confirmPassword) { Alert.alert("Atenção", "As senhas não coincidem."); return; }
                    resetMutation.mutate({ email: email.trim().toLowerCase(), token: code.trim(), newPassword });
                  }}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnText}>{isLoading ? "Salvando..." : "Redefinir Senha"}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 2 },
  backText: { color: "#EAB308", fontSize: 16, fontWeight: "600" },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#1A1000", borderWidth: 2, borderColor: "#EAB308",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 24,
  },
  iconText: { fontSize: 36 },
  title: { fontSize: 26, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#9CA3AF", textAlign: "center", lineHeight: 20, marginBottom: 28 },
  stepsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 32 },
  stepItem: { flexDirection: "row", alignItems: "center" },
  stepDot: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#1F2937", borderWidth: 1.5, borderColor: "#374151",
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: "#EAB308", borderColor: "#EAB308" },
  stepDotDone: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  stepNum: { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  stepLine: { width: 40, height: 2, backgroundColor: "#1F2937", marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#22C55E" },
  form: { gap: 8 },
  label: { fontSize: 13, color: "#9CA3AF", fontWeight: "500", marginBottom: 6 },
  input: {
    backgroundColor: "#111827", color: "#fff", borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 16, fontSize: 16,
    borderWidth: 1, borderColor: "#1F2937",
  },
  codeInput: {
    backgroundColor: "#111827", color: "#EAB308", borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 18, fontSize: 34, fontWeight: "800",
    textAlign: "center", letterSpacing: 14, borderWidth: 1.5, borderColor: "#EAB308",
  },
  btn: {
    backgroundColor: "#EAB308", borderRadius: 16,
    paddingVertical: 16, alignItems: "center", marginTop: 16,
  },
  btnText: { color: "#000", fontSize: 16, fontWeight: "800" },
  resendBtn: { alignItems: "center", marginTop: 12, paddingVertical: 8 },
  resendText: { color: "#EAB308", fontSize: 14, fontWeight: "600" },
  matchHint: { fontSize: 13, fontWeight: "600", marginTop: 6 },
});
