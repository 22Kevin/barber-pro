import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useBarberAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function AdminLoginScreen() {
  const { login } = useBarberAuth();
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.admin.login.useMutation({
    onSuccess: async (data) => {
      await login(data as any);
      router.replace("/admin/(tabs)/dashboard" as any);
    },
    onError: (err) => {
      Alert.alert("Erro ao entrar", err.message);
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Atenção", "Preencha e-mail e senha.");
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
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
          {/* Logo */}
          <View style={styles.logoArea}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.brandName, { color: colors.primary }]}>BARBER PRO</Text>
            <Text style={[styles.brandSub, { color: colors.muted }]}>Painel Administrativo</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Entrar</Text>

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
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
              onPress={handleLogin}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.btnText, { color: colors.background }]}>ENTRAR</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.push("/admin/setup" as any)} style={styles.setupLink}>
              <Text style={[styles.setupText, { color: colors.primary }]}>Primeiro acesso? Criar conta de administrador</Text>
            </Pressable>
          </View>

          {/* Espaço extra para garantir que o botão fique visível acima do teclado */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
  },
  brandSub: {
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
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
    marginBottom: 0,
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
  setupLink: {
    marginTop: 16,
    alignItems: "center",
  },
  setupText: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
