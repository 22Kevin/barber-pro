import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";

export default function ClientLogin() {
  const router = useRouter();
  const { login } = useClientAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.clientAuth.login.useMutation({
    onSuccess: async (data) => {
      await login({ ...data, email: data.email ?? "" });
      router.replace("/client/(tabs)/home" as any);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  return (
    <ScreenContainer containerClassName="bg-black">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="flex-row items-center px-6 pt-4 pb-2">
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Text style={{ color: "#EAB308", fontSize: 16 }}>← Voltar</Text>
            </TouchableOpacity>
          </View>

          <View className="px-6 pt-8 pb-10">
            <Text className="text-3xl font-bold text-white mb-2">Bem-vindo de volta</Text>
            <Text className="text-gray-400 mb-10">Entre na sua conta para agendar e ver seus benefícios</Text>

            <View className="gap-4">
              <View>
                <Text className="text-gray-400 text-sm mb-2">E-mail</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="seu@email.com"
                  placeholderTextColor="#4B5563"
                  style={{ backgroundColor: "#111827", color: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151", fontSize: 16 }}
                />
              </View>
              <View>
                <Text className="text-gray-400 text-sm mb-2">Senha</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#4B5563"
                  returnKeyType="done"
                  onSubmitEditing={() => loginMutation.mutate({ email, password })}
                  style={{ backgroundColor: "#111827", color: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151", fontSize: 16 }}
                />
              </View>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: "#EAB308", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 32, opacity: loginMutation.isPending ? 0.7 : 1 }}
              onPress={() => loginMutation.mutate({ email, password })}
              disabled={loginMutation.isPending}
            >
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-6">
              <Text className="text-gray-400">Não tem conta? </Text>
              <TouchableOpacity onPress={() => router.replace("/client/register" as any)}>
                <Text style={{ color: "#EAB308", fontWeight: "600" }}>Criar conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
