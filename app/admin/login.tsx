import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useBarberAuth } from "@/lib/auth-context";
import { trpc, saveBarberJwt, saveBarberRefreshJwt } from "@/lib/trpc";
import { getExpoPushToken } from "@/lib/use-notifications";
import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";

let GoogleSignin: any = null;
let statusCodes: any = null;
try {
  const mod = require("@react-native-google-signin/google-signin");
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
} catch {}

const REMEMBER_ME_KEY = "@barber_pro_remember_me";
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const GOLD = "#C9A84C";
const BG = "#0A0A0A";
const SURFACE = "#111111";
const SURFACE2 = "#1A1A1A";
const BORDER = "#2A2A2A";
const MUTED = "#9BA1A6";
const TEXT = "#ECEDEE";

export default function AdminLoginScreen() {
  const { login } = useBarberAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Default: manter conectado
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_ME_KEY).then((saved) => {
      if (saved) {
        try {
          const { email: savedEmail, remember } = JSON.parse(saved);
          if (remember && savedEmail) { setEmail(savedEmail); setRememberMe(true); }
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    if (!GoogleSignin || !WEB_CLIENT_ID) return;
    try {
      GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, iosClientID: IOS_CLIENT_ID || undefined, offlineAccess: false });
    } catch {}
  }, []);

  const savePushToken = trpc.barbers.savePushToken.useMutation();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (!data?.token) { Alert.alert("Erro", "Resposta inválida do servidor."); return; }
      await saveBarberJwt(data.token);
      if (data.refreshToken) await saveBarberRefreshJwt(data.refreshToken);
      if (rememberMe) {
        // Salvar email E flag de auto-login
        await AsyncStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ email, remember: true, autoLogin: true }));
      } else {
        // Sem "mantenha conectado" - só salva a sessão atual sem auto-renovação
        await AsyncStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ email, remember: false, autoLogin: false }));
      }
      login(data.barber ?? data);
      try {
        const pushToken = await getExpoPushToken();
        if (pushToken && data.barber?.id) savePushToken.mutate({ barberId: data.barber.id, token: pushToken });
      } catch {}
      router.replace("/admin/(tabs)/dashboard" as any);
    },
    onError: (e) => Alert.alert("Erro ao entrar", e.message ?? "Verifique suas credenciais."),
  });

  const googleLoginMutation = trpc.auth.googleLogin.useMutation({
    onSuccess: async (data) => {
      if (!data?.token) { Alert.alert("Erro", "Falha na autenticação Google."); return; }
      await saveBarberJwt(data.token);
      if (data.refreshToken) await saveBarberRefreshJwt(data.refreshToken);
      login(data.barber ?? data);
      router.replace("/admin/(tabs)/dashboard" as any);
    },
    onError: (e) => Alert.alert("Erro Google", e.message),
  });

  async function handleLogin() {
    if (!email.trim() || !password) { Alert.alert("Atenção", "Preencha e-mail e senha."); return; }
    loginMutation.mutate({ email: email.trim().toLowerCase(), password });
  }

  async function handleGoogleLogin() {
    if (!GoogleSignin || !WEB_CLIENT_ID) {
      Alert.alert(
        "Login com Google",
        "Para usar o login com Google no app, é necessário configurar o ID do cliente Google nas configurações do projeto.\n\nAlternativamente, acesse o painel pelo navegador em usebarberpro.com",
        [{ text: "Entendi" }]
      );
      return;
    }
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken ?? userInfo?.idToken;
      if (!idToken) throw new Error("Token Google não disponível");
      googleLoginMutation.mutate({ idToken });
    } catch (e: any) {
      if (e?.code !== statusCodes?.SIGN_IN_CANCELLED) Alert.alert("Erro Google", e?.message ?? "Falha na autenticação");
    } finally {
      setGoogleLoading(false);
    }
  }

  const isLoading = loginMutation.isPending || googleLoading || googleLoginMutation.isPending;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Background glow */}
          <View style={styles.glowOuter} pointerEvents="none" />
          <View style={styles.glowInner} pointerEvents="none" />

          {/* Logo + marca */}
          <View style={styles.logoArea}>
            <View style={styles.ringOuter}>
              <View style={styles.ringInner}>
                <View style={styles.logoRing}>
                  <Image source={require("@/assets/images/icon.png")} style={styles.logo} resizeMode="contain" />
                </View>
              </View>
            </View>
            <Text style={styles.brand}>BARBER PRO</Text>
            <Text style={styles.brandSub}>Painel Administrativo</Text>
          </View>

          {/* Card de login */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bem-vindo de volta</Text>
            <Text style={styles.cardSub}>Entre com sua conta para acessar o painel</Text>

            {/* E-mail */}
            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput style={[styles.input, emailFocused && styles.inputFocused]} value={email} onChangeText={setEmail} onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)} placeholder="seu@email.com" placeholderTextColor={MUTED} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            </View>

            {/* Senha */}
            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }, passwordFocused && styles.inputFocused]} value={password} onChangeText={setPassword} onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} placeholder="••••••••" placeholderTextColor={MUTED} secureTextEntry={!showPassword} returnKeyType="done" onSubmitEditing={handleLogin} />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <IconSymbol name={showPassword ? "eye.slash.fill" : "eye.fill"} size={20} color={MUTED} />
                </Pressable>
              </View>
            </View>

            {/* Lembrar-me */}
            <Pressable style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
              <View style={[styles.checkbox, { borderColor: rememberMe ? GOLD : BORDER, backgroundColor: rememberMe ? GOLD : "transparent" }]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Mantenha-me conectado</Text>
            </Pressable>

            {/* Botão Entrar */}
            <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={handleLogin} disabled={isLoading}>
              {loginMutation.isPending ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color={BG} size="small" />
                <Text style={styles.btnText}>Entrando...</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>Entrar no Painel</Text>
            )}
            </Pressable>

            {/* Divisor */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou continue com</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <Pressable style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.8 }]} onPress={handleGoogleLogin} disabled={isLoading}>
              {(googleLoading || googleLoginMutation.isPending) ? (
                <ActivityIndicator color={TEXT} size="small" />
              ) : (
                <>
                  <View style={styles.googleIconBox}><Text style={styles.googleIconText}>G</Text></View>
                  <Text style={styles.googleBtnText}>Entrar com Google</Text>
                </>
              )}
            </Pressable>

            {/* Links */}
            <Pressable onPress={() => router.push("/admin/forgot-password" as any)} style={styles.link}>
              <Text style={styles.linkText}>Esqueci minha senha</Text>
            </Pressable>

            <Pressable onPress={() => router.replace("/(tabs)/" as any)} style={styles.link}>
              <Text style={[styles.linkText, { color: GOLD }]}>← Voltar ao app</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: BG },
  glowOuter: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(201,168,76,0.06)', alignSelf: 'center', top: 0 },
  glowInner: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(201,168,76,0.04)', alignSelf: 'center', top: 100 },
  logoArea: { alignItems: "center", marginBottom: 36 },
  ringOuter: { width: 124, height: 124, borderRadius: 62, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ringInner: { width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', alignItems: 'center', justifyContent: 'center' },
  logoRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: GOLD + '55', backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', elevation: 0 },
  logo: { width: 88, height: 88, borderRadius: 44 },
  brand: { fontSize: 26, fontWeight: "900", color: GOLD, letterSpacing: 5, marginBottom: 4 },
  brandSub: { fontSize: 12, color: MUTED, letterSpacing: 2, textTransform: "uppercase" },
  card: { backgroundColor: SURFACE, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  cardTitle: { fontSize: 22, fontWeight: "800", color: TEXT, marginBottom: 4 },
  cardSub: { fontSize: 13, color: MUTED, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, color: MUTED, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 },
  input: { backgroundColor: SURFACE2, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: TEXT },
  inputFocused: { borderColor: GOLD, backgroundColor: '#141410' },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyeBtn: { padding: 10 },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checkmark: { color: BG, fontSize: 12, fontWeight: "900" },
  rememberText: { fontSize: 13, color: MUTED },
  btn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginBottom: 16 },
  btnText: { color: BG, fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(201,168,76,0.2)' },
  dividerText: { fontSize: 12, color: MUTED },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: SURFACE2, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', borderRadius: 14, paddingVertical: 14, marginBottom: 20 },
  googleIconBox: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(201,168,76,0.15)', alignItems: "center", justifyContent: "center" },
  googleIconText: { fontSize: 14, fontWeight: "900", color: GOLD },
  googleBtnText: { fontSize: 15, color: TEXT, fontWeight: "600" },
  link: { alignItems: "center", paddingVertical: 6 },
  linkText: { fontSize: 13, color: MUTED },
});
