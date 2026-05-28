import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

type Step = "email" | "code" | "newPassword";

export default function AdminForgotPasswordScreen() {
  const colors = useColors();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
    ]).start();
  };

  useEffect(() => { animateIn(); }, []);

  const forgotMutation = trpc.admin.forgotPassword.useMutation({
    onSuccess: () => {
      setStep("code");
      animateIn();
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const verifyMutation = trpc.admin.verifyResetToken.useMutation({
    onSuccess: () => {
      setStep("newPassword");
      animateIn();
    },
    onError: (err) => Alert.alert("Código inválido", err.message),
  });

  const resetMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      Alert.alert("Senha redefinida!", "Sua senha foi alterada com sucesso. Faça login com a nova senha.", [
        { text: "OK", onPress: () => router.replace("/admin/login" as any) },
      ]);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const handleEmailSubmit = () => {
    if (!email.trim()) { Alert.alert("Atenção", "Informe seu e-mail."); return; }
    forgotMutation.mutate({ email: email.trim().toLowerCase() });
  };

  const handleCodeSubmit = () => {
    if (code.length !== 6) { Alert.alert("Atenção", "O código deve ter 6 dígitos."); return; }
    verifyMutation.mutate({ email: email.trim().toLowerCase(), token: code.trim() });
  };

  const handlePasswordSubmit = () => {
    if (newPassword.length < 6) { Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Atenção", "As senhas não coincidem."); return; }
    resetMutation.mutate({ email: email.trim().toLowerCase(), token: code.trim(), newPassword });
  };

  const stepTitles: Record<Step, string> = {
    email: "Recuperar Senha",
    code: "Verificar Código",
    newPassword: "Nova Senha",
  };

  const stepDescriptions: Record<Step, string> = {
    email: "Informe o e-mail da sua conta para receber o código de recuperação.",
    code: `Digite o código de 6 dígitos enviado para\n${email}`,
    newPassword: "Crie uma nova senha para sua conta.",
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Botão Voltar */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Voltar</Text>
          </Pressable>

          {/* Indicador de etapas */}
          <View style={styles.stepsRow}>
            {(["email", "code", "newPassword"] as Step[]).map((s, i) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  { backgroundColor: step === s ? colors.primary : (["email", "code", "newPassword"].indexOf(step) > i ? colors.primary : colors.border) },
                ]}
              />
            ))}
          </View>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.foreground }]}>{stepTitles[step]}</Text>
              <Text style={[styles.desc, { color: colors.muted }]}>{stepDescriptions[step]}</Text>

              {step === "email" && (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.muted }]}>E-mail</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="seu@email.com"
                      placeholderTextColor={colors.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleEmailSubmit}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                    onPress={handleEmailSubmit}
                    disabled={forgotMutation.isPending}
                  >
                    {forgotMutation.isPending
                      ? <ActivityIndicator color={colors.background} />
                      : <Text style={[styles.btnText, { color: colors.background }]}>ENVIAR CÓDIGO</Text>
                    }
                  </Pressable>
                </>
              )}

              {step === "code" && (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.muted }]}>Código de 6 dígitos</Text>
                    <TextInput
                      style={[styles.input, styles.codeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      value={code}
                      onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      placeholderTextColor={colors.muted}
                      keyboardType="number-pad"
                      maxLength={6}
                      returnKeyType="done"
                      onSubmitEditing={handleCodeSubmit}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                    onPress={handleCodeSubmit}
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending
                      ? <ActivityIndicator color={colors.background} />
                      : <Text style={[styles.btnText, { color: colors.background }]}>VERIFICAR</Text>
                    }
                  </Pressable>
                  <Pressable
                    style={styles.resendLink}
                    onPress={() => { setCode(""); forgotMutation.mutate({ email: email.trim().toLowerCase() }); }}
                    disabled={forgotMutation.isPending}
                  >
                    <Text style={[styles.resendText, { color: colors.muted }]}>Não recebeu? Reenviar código</Text>
                  </Pressable>
                </>
              )}

              {step === "newPassword" && (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.muted }]}>Nova Senha</Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Mínimo 6 caracteres"
                        placeholderTextColor={colors.muted}
                        secureTextEntry={!showPass}
                        returnKeyType="next"
                      />
                      <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                        <Text style={styles.eyeText}>{showPass ? "🙈" : "👁️"}</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.muted }]}>Confirmar Senha</Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Repita a senha"
                        placeholderTextColor={colors.muted}
                        secureTextEntry={!showConfirm}
                        returnKeyType="done"
                        onSubmitEditing={handlePasswordSubmit}
                      />
                      <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                        <Text style={styles.eyeText}>{showConfirm ? "🙈" : "👁️"}</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                    onPress={handlePasswordSubmit}
                    disabled={resetMutation.isPending}
                  >
                    {resetMutation.isPending
                      ? <ActivityIndicator color={colors.background} />
                      : <Text style={[styles.btnText, { color: colors.background }]}>REDEFINIR SENHA</Text>
                    }
                  </Pressable>
                </>
              )}
            </View>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 16,
  },
  backBtn: {
    marginBottom: 20,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
  },
  stepsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 28,
  },
  stepDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  codeInput: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 8,
    paddingVertical: 16,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyeBtn: {
    padding: 10,
  },
  eyeText: {
    fontSize: 18,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },
  resendLink: {
    marginTop: 14,
    alignItems: "center",
  },
  resendText: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
