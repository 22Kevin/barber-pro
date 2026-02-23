import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { useGoogleAuth } from "@/lib/use-google-auth";
import { trpc } from "@/lib/trpc";

export default function ClientLogin() {
  const router = useRouter();
  const { login } = useClientAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const loginMutation = trpc.clientAuth.login.useMutation({
    onSuccess: async (data) => {
      await login({ ...data, email: data.email ?? "" });
      router.replace("/client/(tabs)/home" as any);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const googleLoginMutation = trpc.clientAuth.googleLogin.useMutation({
    onSuccess: async (data) => {
      await login({ ...data, email: data.email ?? "" });
      router.replace("/client/(tabs)/home" as any);
    },
    onError: (err) => {
      setGoogleLoading(false);
      Alert.alert("Erro", err.message);
    },
  });

  const { promptAsync } = useGoogleAuth(async (googleUser) => {
    setGoogleLoading(true);
    googleLoginMutation.mutate({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      photoUrl: googleUser.picture,
    });
  });

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result?.type !== "success") {
        setGoogleLoading(false);
      }
    } catch {
      setGoogleLoading(false);
      Alert.alert("Erro", "Não foi possível conectar com o Google.");
    }
  };

  return (
    <ScreenContainer containerClassName="bg-black">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Bem-vindo de volta</Text>
            <Text style={styles.subtitle}>Entre na sua conta para agendar e ver seus benefícios</Text>

            {/* Botão Google */}
            <Pressable
              style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
              onPress={handleGoogleLogin}
              disabled={googleLoading || loginMutation.isPending}
            >
              {googleLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Continuar com Google</Text>
                </>
              )}
            </Pressable>

            {/* Divisor */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou entre com e-mail</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Formulário */}
            <View style={{ gap: 16 }}>
              <View>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="seu@email.com"
                  placeholderTextColor="#4B5563"
                  style={styles.input}
                />
              </View>
              <View>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#4B5563"
                  returnKeyType="done"
                  onSubmitEditing={() => loginMutation.mutate({ email, password })}
                  style={styles.input}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, (loginMutation.isPending || googleLoading) && { opacity: 0.7 }]}
              onPress={() => loginMutation.mutate({ email, password })}
              disabled={loginMutation.isPending || googleLoading}
            >
              <Text style={styles.loginBtnText}>
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </Text>
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Não tem conta? </Text>
              <TouchableOpacity onPress={() => router.replace("/client/register" as any)}>
                <Text style={styles.registerLink}>Criar conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText: { color: "#EAB308", fontSize: 16 },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#9CA3AF", marginBottom: 28, lineHeight: 20 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 20,
  },
  googleIcon: { fontSize: 18, fontWeight: "800", color: "#4285F4" },
  googleBtnText: { fontSize: 15, fontWeight: "700", color: "#111" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#374151" },
  dividerText: { fontSize: 12, color: "#6B7280" },
  label: { fontSize: 13, color: "#9CA3AF", marginBottom: 8, fontWeight: "500" },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
    fontSize: 16,
  },
  loginBtn: {
    backgroundColor: "#EAB308",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  loginBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
  registerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  registerText: { color: "#9CA3AF", fontSize: 14 },
  registerLink: { color: "#EAB308", fontWeight: "600", fontSize: 14 },
});
