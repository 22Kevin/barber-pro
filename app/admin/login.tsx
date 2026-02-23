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

export default function AdminLoginScreen() {
  const { login } = useBarberAuth();
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>BARBER PRO</Text>
            <Text style={styles.brandSub}>Painel Administrativo</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entrar</Text>

            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor="#555"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#555"
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
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
              onPress={handleLogin}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={styles.btnText}>ENTRAR</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.push("/admin/setup" as any)} style={styles.setupLink}>
              <Text style={styles.setupText}>Primeiro acesso? Criar conta de administrador</Text>
            </Pressable>
          </View>
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
    marginBottom: 40,
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
    color: "#C9A84C",
    letterSpacing: 4,
  },
  brandSub: {
    fontSize: 13,
    color: "#888880",
    letterSpacing: 2,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F5F5F0",
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: "#888880",
    marginBottom: 6,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#F5F5F0",
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
    backgroundColor: "#C9A84C",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },
  setupLink: {
    marginTop: 16,
    alignItems: "center",
  },
  setupText: {
    color: "#C9A84C",
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
