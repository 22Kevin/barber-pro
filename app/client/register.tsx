import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";

export default function ClientRegister() {
  const router = useRouter();
  const { login } = useClientAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const registerMutation = trpc.clientAuth.register.useMutation({
    onSuccess: async (data) => {
      await login({ id: data.id, name: data.name, email: data.email, phone: data.phone, totalPoints: 0 });
      router.replace("/client/(tabs)/home" as any);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const handleRegister = () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Atenção", "As senhas não coincidem");
      return;
    }
    registerMutation.mutate({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
  };

  return (
    <ScreenContainer containerClassName="bg-black">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center px-6 pt-4 pb-2">
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Text style={{ color: "#EAB308", fontSize: 16 }}>← Voltar</Text>
            </TouchableOpacity>
          </View>

          <View className="px-6 pt-6 pb-10">
            <Text className="text-3xl font-bold text-white mb-2">Criar conta</Text>
            <Text className="text-gray-400 mb-8">Cadastre-se para agendar e acumular pontos de fidelidade</Text>

            <View className="gap-4">
              {[
                { label: "Nome completo *", value: name, setter: setName, placeholder: "Seu nome", keyboard: "default" as const },
                { label: "E-mail *", value: email, setter: setEmail, placeholder: "seu@email.com", keyboard: "email-address" as const },
                { label: "Telefone / WhatsApp *", value: phone, setter: setPhone, placeholder: "(11) 99999-9999", keyboard: "phone-pad" as const },
              ].map((field) => (
                <View key={field.label}>
                  <Text className="text-gray-400 text-sm mb-2">{field.label}</Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.setter}
                    keyboardType={field.keyboard}
                    autoCapitalize={field.keyboard === "default" ? "words" : "none"}
                    placeholder={field.placeholder}
                    placeholderTextColor="#4B5563"
                    style={{ backgroundColor: "#111827", color: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151", fontSize: 16 }}
                  />
                </View>
              ))}
              <View>
                <Text className="text-gray-400 text-sm mb-2">Senha *</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#4B5563"
                  style={{ backgroundColor: "#111827", color: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151", fontSize: 16 }}
                />
              </View>
              <View>
                <Text className="text-gray-400 text-sm mb-2">Confirmar senha *</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Repita a senha"
                  placeholderTextColor="#4B5563"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  style={{ backgroundColor: "#111827", color: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151", fontSize: 16 }}
                />
              </View>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: "#EAB308", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 32, opacity: registerMutation.isPending ? 0.7 : 1 }}
              onPress={handleRegister}
              disabled={registerMutation.isPending}
            >
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
                {registerMutation.isPending ? "Criando conta..." : "Criar conta"}
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-6">
              <Text className="text-gray-400">Já tem conta? </Text>
              <TouchableOpacity onPress={() => router.replace("/client/login" as any)}>
                <Text style={{ color: "#EAB308", fontWeight: "600" }}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
