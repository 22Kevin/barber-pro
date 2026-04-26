import { useRouter } from "expo-router";
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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { useGoogleAuth } from "@/lib/use-google-auth";
import { trpc } from "@/lib/trpc";
import { getExpoPushToken } from "@/lib/use-notifications";

export default function ClientLogin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useClientAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const savePushToken = trpc.clientAuth.savePushToken.useMutation();

  const registerPushToken = async (clientId: number) => {
    const token = await getExpoPushToken();
    if (token && clientId) savePushToken.mutate({ clientId, pushToken: token });
  };

  const loginMutation = trpc.clientAuth.login.useMutation({
    onSuccess: async (data) => {
      await login({ ...data, email: data.email ?? "" });
      registerPushToken(data.id);
      router.replace("/client/(tabs)/home" as any);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const googleLoginMutation = trpc.clientAuth.googleLogin.useMutation({
    onSuccess: async (data) => {
      await login({ ...data, email: data.email ?? "" });
      registerPushToken(data.id);
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
      if (result?.type !== "success") setGoogleLoading(false);
    } catch {
      setGoogleLoading(false);
      Alert.alert("Erro", "Não foi possível conectar com o Google.");
    }
  };

  const isLoading = loginMutation.isPending || googleLoading;

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Botão voltar */}
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Ícone decorativo */}
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>✂️</Text>
            </View>

            <Text style={styles.title}>Bem-vindo de volta</Text>
            <Text style={styles.subtitle}>Entre na sua conta para agendar e ver seus benefícios</Text>

            {/* Google */}
            <Pressable
              style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
              onPress={handleGoogleLogin}
              disabled={isLoading}
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
            <View style={styles.form}>
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
              style={[styles.loginBtn, isLoading && { opacity: 0.7 }]}
              onPress={() => loginMutation.mutate({ email, password })}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.loginBtnText}>
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ alignItems: "center", marginTop: 14 }}
              onPress={() => router.push("/client/forgot-password" as any)}
            >
              <Text style={styles.forgotText}>Esqueci minha senha</Text>
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Não tem conta? </Text>
              <TouchableOpacity onPress={() => router.replace("/client/register" as any)}>
                <Text style={styles.registerLink}>Criar conta gratuita</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backText: {
    color: "#EAB308",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1A1000",
    borderWidth: 2,
    borderColor: "#EAB308",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 28,
    lineHeight: 20,
    textAlign: "center",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 15,
    gap: 10,
    marginBottom: 20,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4285F4",
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1F2937",
  },
  dividerText: {
    fontSize: 12,
    color: "#6B7280",
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    fontSize: 16,
  },
  loginBtn: {
    backgroundColor: "#EAB308",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  loginBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
  },
  forgotText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  registerLink: {
    color: "#EAB308",
    fontWeight: "700",
    fontSize: 14,
  },
});
