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
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function AdminSetupScreen() {
  const { login } = useBarberAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const setupMutation = trpc.admin.setup.useMutation({
    onSuccess: async (data) => {
      await login(data as any);
      router.replace("/admin/(tabs)/dashboard" as any);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const handleSetup = () => {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Atenção", "As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setupMutation.mutate({ name: name.trim(), email: email.trim(), password });
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoArea}>
            <Image source={require("@/assets/images/icon.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandName}>BARBER PRO</Text>
            <Text style={styles.brandSub}>Configuração Inicial</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Criar Conta de Administrador</Text>
            <Text style={styles.cardDesc}>Este é o primeiro acesso. Crie sua conta de Super Admin para gerenciar o sistema.</Text>

            {/* Nome */}
            <View style={styles.field}>
              <Text style={styles.label}>Nome completo</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="João da Silva"
                placeholderTextColor="#555"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* E-mail */}
            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="admin@barbearia.com"
                placeholderTextColor="#555"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Senha */}
            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#555"
                  secureTextEntry={!showPassword}
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                  <IconSymbol name={showPassword ? "eye.slash.fill" : "eye.fill"} size={20} color="#888" />
                </Pressable>
              </View>
            </View>

            {/* Confirmar Senha */}
            <View style={styles.field}>
              <Text style={styles.label}>Confirmar Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Repita a senha"
                  placeholderTextColor="#555"
                  secureTextEntry={!showConfirm}
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                  <IconSymbol name={showConfirm ? "eye.slash.fill" : "eye.fill"} size={20} color="#888" />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
              onPress={handleSetup}
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={styles.btnText}>CRIAR CONTA</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.back()} style={styles.backLink}>
              <Text style={styles.backText}>← Voltar para o login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoArea: { alignItems: "center", marginBottom: 32 },
  logo: { width: 80, height: 80, borderRadius: 18, marginBottom: 10 },
  brandName: { fontSize: 26, fontWeight: "800", color: "#C9A84C", letterSpacing: 4 },
  brandSub: { fontSize: 12, color: "#888880", letterSpacing: 2, marginTop: 4 },
  card: { backgroundColor: "#141414", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: "#2A2A2A" },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F0", marginBottom: 8 },
  cardDesc: { fontSize: 13, color: "#888880", marginBottom: 20, lineHeight: 18 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: "#888880", marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0" },
  passwordRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14 },
  eyeBtn: { paddingVertical: 12, paddingLeft: 8 },
  btn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  btnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 2 },
  backLink: { marginTop: 16, alignItems: "center" },
  backText: { color: "#C9A84C", fontSize: 13 },
});
