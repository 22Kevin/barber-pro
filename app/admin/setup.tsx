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

export default function AdminSetupScreen() {
  const { login } = useBarberAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

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

            {[
              { label: "Nome completo", value: name, setter: setName, placeholder: "João da Silva", keyboard: "default" as const },
              { label: "E-mail", value: email, setter: setEmail, placeholder: "admin@barbearia.com", keyboard: "email-address" as const },
              { label: "Senha", value: password, setter: setPassword, placeholder: "Mínimo 6 caracteres", secure: true },
              { label: "Confirmar Senha", value: confirm, setter: setConfirm, placeholder: "Repita a senha", secure: true },
            ].map((field) => (
              <View key={field.label} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder={field.placeholder}
                  placeholderTextColor="#555"
                  secureTextEntry={field.secure}
                  keyboardType={field.keyboard}
                  autoCapitalize={field.keyboard === "email-address" ? "none" : "words"}
                  autoCorrect={false}
                />
              </View>
            ))}

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
  btn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  btnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 2 },
  backLink: { marginTop: 16, alignItems: "center" },
  backText: { color: "#C9A84C", fontSize: 13 },
});
