import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
} from "react-native";
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
  const { login } = useClientAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const handlePhoneChange = (t: string) => setPhone(applyPhoneMask(t));
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const registerMutation = trpc.clientAuth.register.useMutation({
    onSuccess: async (data) => {
      await login({ id: data.id, name: data.name, email: data.email, phone: data.phone, totalPoints: 0, birthDate: birthDate });
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
      if (result?.type !== "success") {
        setGoogleLoading(false);
      }
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
    registerMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: stripMask(phone),
      password,
      birthDate: birthDate ?? undefined,
    });
  };

  const isLoading = registerMutation.isPending || googleLoading || googleLoginMutation.isPending;

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
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Cadastre-se para agendar e acumular pontos de fidelidade</Text>

            {/* Botão Google — opção rápida no topo */}
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

            {/* Formulário */}
            <View style={{ gap: 16 }}>
              {[
                { label: "Nome completo *", value: name, setter: setName, placeholder: "Seu nome", keyboard: "default" as const },
                { label: "E-mail *", value: email, setter: setEmail, placeholder: "seu@email.com", keyboard: "email-address" as const },
                { label: "Telefone / WhatsApp *", value: phone, setter: handlePhoneChange, placeholder: "(11) 99999-9999", keyboard: "phone-pad" as const },
              ].map((field) => (
                <View key={field.label}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.setter}
                    keyboardType={field.keyboard}
                    autoCapitalize={field.keyboard === "default" ? "words" : "none"}
                    placeholder={field.placeholder}
                    placeholderTextColor="#4B5563"
                    style={styles.input}
                  />
                </View>
              ))}

              {/* Data de Nascimento */}
              <View>
                <Text style={styles.label}>Data de Nascimento <Text style={{ color: "#6B7280" }}>(opcional)</Text></Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                >
                  <Text style={{ color: birthDate ? "#fff" : "#4B5563", fontSize: 16 }}>
                    {birthDate ? formatBirthDate(birthDate) : "Toque para selecionar 🎂"}
                  </Text>
                  {birthDate && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); setBirthDate(null); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ color: "#6B7280", fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <Text style={styles.hintText}>Usamos para enviar um cupom especial no seu aniversário 🎉</Text>
              </View>

              <View>
                <Text style={styles.label}>Senha *</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#4B5563"
                  style={styles.input}
                />
              </View>
              <View>
                <Text style={styles.label}>Confirmar senha *</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Repita a senha"
                  placeholderTextColor="#4B5563"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  style={styles.input}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.registerBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={isLoading}
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* DatePickerModal */}
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText: { color: "#EAB308", fontSize: 16 },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#9CA3AF", marginBottom: 24, lineHeight: 20 },
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
  hintText: { fontSize: 11, color: "#4B5563", marginTop: 6, lineHeight: 16 },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
    fontSize: 16,
  },
  registerBtn: {
    backgroundColor: "#EAB308",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  registerBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  loginText: { color: "#9CA3AF", fontSize: 14 },
  loginLink: { color: "#EAB308", fontWeight: "600", fontSize: 14 },
});
