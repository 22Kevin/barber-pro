import { useEffect, useState } from "react";
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
import { trpc, saveBarberJwt } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { getExpoPushToken } from "@/lib/use-notifications";
import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Google Sign-In — importação condicional para evitar crash na web/Expo Go
let GoogleSignin: any = null;
let statusCodes: any = null;
try {
  const mod = require("@react-native-google-signin/google-signin");
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
} catch {
  // Pacote não disponível (Expo Go ou web)
}

const REMEMBER_ME_KEY = "@barber_pro_remember_me";
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const GOOGLE_CONFIGURED = !!WEB_CLIENT_ID;

export default function AdminLoginScreen() {
  const { login } = useBarberAuth();
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Carregar e-mail salvo se "Lembrar-me" estava ativo
  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_ME_KEY).then((saved) => {
      if (saved) {
        try {
          const { email: savedEmail, remember } = JSON.parse(saved);
          if (remember && savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
          }
        } catch {
          // ignore
        }
      }
    });
  }, []);

  // Configurar Google Sign-In
  useEffect(() => {
    if (!GoogleSignin || !GOOGLE_CONFIGURED) return;
    try {
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        iosClientId: IOS_CLIENT_ID || undefined,
        offlineAccess: false,
      });
    } catch {
      // ignore
    }
  }, []);

  const savePushToken = trpc.barbers.savePushToken.useMutation();
  const loginMutation = trpc.admin.login.useMutation({
    onSuccess: async (data) => {
      // Salvar preferência de "Lembrar-me"
      await AsyncStorage.setItem(
        REMEMBER_ME_KEY,
        JSON.stringify({ email: rememberMe ? email.trim() : "", remember: rememberMe })
      );
      // Salvar JWT para autenticar mutations protegidas
      if ((data as any).token) await saveBarberJwt((data as any).token);
      await login(data as any);
      getExpoPushToken()
        .then((token) => {
          if (token && data.id) savePushToken.mutate({ barberId: data.id, pushToken: token });
        })
        .catch(() => null);
      router.replace("/admin/(tabs)/dashboard" as any);
    },
    onError: (err) => {
      Alert.alert("Erro ao entrar", err.message);
    },
  });

  const googleLoginMutation = trpc.admin.googleLogin.useMutation({
    onSuccess: async (data) => {
      // Salvar JWT para autenticar mutations protegidas
      if ((data as any).token) await saveBarberJwt((data as any).token);
      await login(data as any);
      getExpoPushToken()
        .then((token) => {
          if (token && data.id) savePushToken.mutate({ barberId: data.id, pushToken: token });
        })
        .catch(() => null);
      router.replace("/admin/(tabs)/dashboard" as any);
    },
    onError: (err) => {
      Alert.alert("Erro ao entrar com Google", err.message);
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Atenção", "Preencha e-mail e senha.");
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
  };

  const handleGoogleLogin = async () => {
    if (!GoogleSignin) {
      Alert.alert(
        "Não disponível",
        "O login com Google requer uma build nativa do aplicativo. Use o botão Publicar no painel para gerar o APK."
      );
      return;
    }
    if (!GOOGLE_CONFIGURED) {
      Alert.alert(
        "Google Sign-In não configurado",
        "Configure as credenciais do Google no painel de Secrets (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)."
      );
      return;
    }
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const user = userInfo.data?.user ?? userInfo.user;
      if (!user?.id || !user?.email) throw new Error("Dados do Google incompletos");
      googleLoginMutation.mutate({
        googleId: user.id,
        email: user.email,
        name: user.name ?? user.email,
        photoUrl: user.photo ?? undefined,
      });
    } catch (err: any) {
      if (statusCodes && err.code === statusCodes.SIGN_IN_CANCELLED) {
        // usuário cancelou — não mostrar erro
      } else if (statusCodes && err.code === statusCodes.IN_PROGRESS) {
        // já em andamento
      } else {
        Alert.alert("Erro", err.message ?? "Não foi possível fazer login com Google.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const isLoading = loginMutation.isPending || googleLoading || googleLoginMutation.isPending;

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

            {/* E-mail */}
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

            {/* Senha */}
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
                  <IconSymbol name={showPassword ? "eye.slash.fill" : "eye.fill"} size={20} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            {/* Lembrar-me */}
            <Pressable
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[
                styles.checkbox,
                { borderColor: rememberMe ? colors.primary : colors.border, backgroundColor: rememberMe ? colors.primary : "transparent" }
              ]}>
                {rememberMe && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={[styles.rememberText, { color: colors.muted }]}>Lembrar meu e-mail</Text>
            </Pressable>

            {/* Botão Entrar */}
            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.btnText, { color: colors.background }]}>ENTRAR</Text>
              )}
            </Pressable>

            {/* Divisor */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.muted }]}>ou</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Botão Google */}
            <Pressable
              style={({ pressed }) => [
                styles.googleBtn,
                { backgroundColor: colors.background, borderColor: colors.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleGoogleLogin}
              disabled={isLoading}
            >
              {(googleLoading || googleLoginMutation.isPending) ? (
                <ActivityIndicator color={colors.foreground} size="small" />
              ) : (
                <>
                  {/* Ícone G do Google em SVG inline via Text */}
                  <View style={styles.googleIconContainer}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
                    Entrar com Google
                  </Text>
                </>
              )}
            </Pressable>

            {/* Links */}
            <Pressable onPress={() => router.push("/admin/forgot-password" as any)} style={styles.forgotLink}>
              <Text style={[styles.forgotText, { color: colors.muted }]}>Esqueci minha senha</Text>
            </Pressable>

            <Pressable onPress={() => router.push("/admin/setup" as any)} style={styles.setupLink}>
              <Text style={[styles.setupText, { color: colors.primary }]}>Primeiro acesso? Criar conta de administrador</Text>
            </Pressable>
          </View>

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
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  rememberText: {
    fontSize: 14,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 0,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1.5,
    gap: 10,
  },
  googleIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  forgotLink: {
    marginTop: 16,
    alignItems: "center",
  },
  forgotText: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
  setupLink: {
    marginTop: 12,
    alignItems: "center",
  },
  setupText: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
