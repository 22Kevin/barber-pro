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
import { DatePickerModal } from "@/components/date-picker-modal";
import { useClientAuth } from "@/lib/client-auth-context";
import { useGoogleAuth } from "@/lib/use-google-auth";
import { trpc } from "@/lib/trpc";
import { applyPhoneMask, stripMask } from "@/hooks/use-mask";

function formatBirthDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function ClientRegister() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useClientAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const registerMutation = trpc.clientAuth.register.useMutation({
    onSuccess: async (data) => {
      await login({ id: data.id, name: data.name, email: data.email, phone: data.phone, totalPoints: 0, birthDate });
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

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result?.type !== "success") setGoogleLoading(false);
    } catch {
      setGoogleLoading(false);
      Alert.alert("Erro", "Não foi possível conectar com o Google.");
    }
  };

  const handleRegister = () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Atenção", "As senhas não coincidem");
      return;
    }
    registerMutation.mutate({ name: name.trim(), email: email.trim(), phone: stripMask(phone), password, birthDate: birthDate ?? undefined });
  };

  const isLoading = registerMutation.isPending || googleLoading || googleLoginMutation.isPending;

  return (
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Botão voltar */}
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Ícone decorativo */}
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>💈</Text>
            </View>

            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Cadastre-se para agendar e acumular pontos de fidelidade</Text>

            {/* Google */}
            <Pressable
              style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
              onPress={handleGoogleSignUp}
              disabled={isLoading}
            >
              {googleLoading || googleLoginMutation.isPending ? (
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
              <Text style={styles.dividerText}>ou preencha o formulário</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Campos */}
            <View style={styles.form}>
              <View>
                <Text style={styles.label}>Nome completo *</Text>
                <TextInput value={name} onChangeText={setName} autoCapitalize="words" placeholder="Seu nome" placeholderTextColor="#4B5563" style={styles.input} />
              </View>
              <View>
                <Text style={styles.label}>E-mail *</Text>
                <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="seu@email.com" placeholderTextColor="#4B5563" style={styles.input} />
              </View>
              <View>
                <Text style={styles.label}>Telefone / WhatsApp *</Text>
                <TextInput value={phone} onChangeText={(t) => setPhone(applyPhoneMask(t))} keyboardType="phone-pad" placeholder="(11) 99999-9999" placeholderTextColor="#4B5563" style={styles.input} />
              </View>

              {/* Data de nascimento */}
              <View>
                <Text style={styles.label}>
                  Data de Nascimento <Text style={{ color: "#6B7280" }}>(opcional)</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: birthDate ? "#fff" : "#4B5563", fontSize: 16 }}>
                    {birthDate ? formatBirthDate(birthDate) : "Toque para selecionar 🎂"}
                  </Text>
                  {birthDate && (
                    <TouchableOpacity onPress={() => setBirthDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: "#6B7280", fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <Text style={styles.hintText}>Receba um cupom especial no seu aniversário 🎉</Text>
              </View>

              <View>
                <Text style={styles.label}>Senha *</Text>
                <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 6 caracteres" placeholderTextColor="#4B5563" style={styles.input} />
              </View>
              <View>
                <Text style={styles.label}>Confirmar senha *</Text>
                <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Repita a senha" placeholderTextColor="#4B5563" returnKeyType="done" onSubmitEditing={handleRegister} style={styles.input} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.registerBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.registerBtnText}>
                {registerMutation.isPending ? "Criando conta..." : "Criar conta"}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Já tem conta? </Text>
              <TouchableOpacity onPress={() => router.replace("/client/login" as any)}>
                <Text style={styles.loginLink}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={birthDate}
        onConfirm={(date) => { setBirthDate(date); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 2 },
  backText: { color: "#EAB308", fontSize: 16, fontWeight: "600" },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#1A1000", borderWidth: 2, borderColor: "#EAB308",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 24,
  },
  iconText: { fontSize: 32 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#9CA3AF", marginBottom: 24, lineHeight: 20, textAlign: "center" },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff", borderRadius: 16, paddingVertical: 15, gap: 10, marginBottom: 20,
  },
  googleIcon: { fontSize: 18, fontWeight: "800", color: "#4285F4" },
  googleBtnText: { fontSize: 15, fontWeight: "700", color: "#111" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1F2937" },
  dividerText: { fontSize: 12, color: "#6B7280" },
  form: { gap: 16 },
  label: { fontSize: 13, color: "#9CA3AF", marginBottom: 8, fontWeight: "500" },
  hintText: { fontSize: 11, color: "#4B5563", marginTop: 6, lineHeight: 16 },
  input: {
    backgroundColor: "#111827", color: "#fff", borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: "#1F2937", fontSize: 16,
  },
  registerBtn: {
    backgroundColor: "#EAB308", borderRadius: 16, paddingVertical: 16,
    alignItems: "center", marginTop: 28,
  },
  registerBtnText: { color: "#000", fontWeight: "800", fontSize: 16 },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  loginText: { color: "#9CA3AF", fontSize: 14 },
  loginLink: { color: "#EAB308", fontWeight: "700", fontSize: 14 },
});
