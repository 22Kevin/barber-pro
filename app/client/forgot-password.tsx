import { useState } from "react";
import {
  Alert,
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
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

type Step = "email" | "code" | "newPassword";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = useColors();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const forgotMutation = trpc.clientAuth.forgotPassword.useMutation({
    onSuccess: (data) => {
      // Em produção o token seria enviado por email.
      // Por ora, exibimos o código diretamente para o usuário.
      if (data.token) {
        setGeneratedToken(data.token);
        Alert.alert(
          "📧 Código de Recuperação",
          `Seu código de verificação é:\n\n${data.token}\n\n(Em produção este código seria enviado para o seu e-mail)\n\nEle expira em 15 minutos.`,
          [{ text: "Entendido", onPress: () => setStep("code") }]
        );
      } else {
        // Email não encontrado — mostramos mensagem genérica por segurança
        Alert.alert(
          "📧 Verifique seu e-mail",
          "Se este e-mail estiver cadastrado, você receberá as instruções de recuperação.",
          [{ text: "OK" }]
        );
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

  const handleRequestCode = () => {
    if (!email.trim()) return Alert.alert("Atenção", "Informe seu e-mail.");
    forgotMutation.mutate({ email: email.trim().toLowerCase() });
  };

  const handleVerifyCode = () => {
    if (code.length !== 6) return Alert.alert("Atenção", "O código deve ter 6 dígitos.");
    verifyMutation.mutate({ email: email.trim().toLowerCase(), token: code.trim() });
  };

  const handleResetPassword = () => {
    if (newPassword.length < 6) return Alert.alert("Atenção", "A nova senha deve ter pelo menos 6 caracteres.");
    if (newPassword !== confirmPassword) return Alert.alert("Atenção", "As senhas não coincidem.");
    resetMutation.mutate({ email: email.trim().toLowerCase(), token: code.trim(), newPassword });
  };

  const isLoading = forgotMutation.isPending || verifyMutation.isPending || resetMutation.isPending;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={[styles.backText, { color: colors.primary }]}>← Voltar</Text>
            </TouchableOpacity>
          </View>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {step === "email" && "Recuperar Senha"}
            {step === "code" && "Verificar Código"}
            {step === "newPassword" && "Nova Senha"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {step === "email" && "Informe seu e-mail cadastrado para receber o código de recuperação."}
            {step === "code" && `Digite o código de 6 dígitos enviado para\n${email}`}
            {step === "newPassword" && "Crie uma nova senha segura para sua conta."}
          </Text>

          {/* Step Indicators */}
          <View style={styles.steps}>
            {(["email", "code", "newPassword"] as Step[]).map((s, i) => (
              <View key={s} style={styles.stepRow}>
                <View style={[
                  styles.stepDot,
                  { backgroundColor: step === s ? colors.primary : (["email", "code", "newPassword"].indexOf(step) > i ? colors.success : colors.border) }
                ]}>
                  <Text style={[styles.stepNum, { color: step === s || ["email", "code", "newPassword"].indexOf(step) > i ? "#fff" : colors.muted }]}>
                    {["email", "code", "newPassword"].indexOf(step) > i ? "✓" : String(i + 1)}
                  </Text>
                </View>
                {i < 2 && <View style={[styles.stepLine, { backgroundColor: ["email", "code", "newPassword"].indexOf(step) > i ? colors.success : colors.border }]} />}
              </View>
            ))}
          </View>

          {/* Step 1 — Email */}
          {step === "email" && (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.foreground }]}>E-mail</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]}
                placeholder="seu@email.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleRequestCode}
              />
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
                onPress={handleRequestCode}
                disabled={isLoading}
              >
                <Text style={styles.btnText}>{isLoading ? "Enviando..." : "Enviar Código"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2 — Código */}
          {step === "code" && (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.foreground }]}>Código de 6 dígitos</Text>
              <TextInput
                style={[styles.codeInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]}
                placeholder="000000"
                placeholderTextColor={colors.muted}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
              />
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
                onPress={handleVerifyCode}
                disabled={isLoading}
              >
                <Text style={styles.btnText}>{isLoading ? "Verificando..." : "Verificar Código"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={() => { setCode(""); forgotMutation.mutate({ email: email.trim().toLowerCase() }); }}
              >
                <Text style={[styles.resendText, { color: colors.primary }]}>Reenviar código</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3 — Nova Senha */}
          {step === "newPassword" && (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.foreground }]}>Nova senha</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.muted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                returnKeyType="next"
              />
              <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Confirmar nova senha</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]}
                placeholder="Repita a nova senha"
                placeholderTextColor={colors.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />
              {newPassword.length > 0 && confirmPassword.length > 0 && (
                <Text style={[styles.matchHint, { color: newPassword === confirmPassword ? colors.success : colors.error }]}>
                  {newPassword === confirmPassword ? "✓ Senhas coincidem" : "✗ Senhas não coincidem"}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                <Text style={styles.btnText}>{isLoading ? "Salvando..." : "Redefinir Senha"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24 },
  header: { marginBottom: 8 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: "500" },
  iconContainer: { alignItems: "center", marginVertical: 24 },
  icon: { fontSize: 64 },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 32 },
  steps: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 32 },
  stepRow: { flexDirection: "row", alignItems: "center" },
  stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 13, fontWeight: "700" },
  stepLine: { width: 40, height: 2, marginHorizontal: 4 },
  form: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  codeInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 18, fontSize: 32, fontWeight: "700", textAlign: "center", letterSpacing: 12 },
  btn: { borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resendBtn: { alignItems: "center", marginTop: 12, paddingVertical: 8 },
  resendText: { fontSize: 14, fontWeight: "500" },
  matchHint: { fontSize: 13, fontWeight: "500", marginTop: 4 },
});
