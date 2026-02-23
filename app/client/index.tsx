import { useRouter } from "expo-router";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { useEffect } from "react";

export default function ClientWelcome() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useClientAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/client/(tabs)/home" as any);
    }
  }, [isAuthenticated, isLoading]);

  return (
    <ScreenContainer containerClassName="bg-black">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View className="items-center pt-16 pb-8 px-6">
          <View className="w-24 h-24 rounded-3xl overflow-hidden mb-6 border-2 border-yellow-500">
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: 96, height: 96 }}
              resizeMode="cover"
            />
          </View>
          <Text className="text-4xl font-bold text-yellow-500 tracking-widest mb-2">BARBER PRO</Text>
          <Text className="text-gray-400 text-base text-center">Agende seu horário, compre produtos e acompanhe seus benefícios</Text>
        </View>

        {/* Features */}
        <View className="px-6 gap-4 mb-10">
          {[
            { icon: "✂️", title: "Agendamento Online", desc: "Escolha seu barbeiro, data e horário com facilidade" },
            { icon: "🛍️", title: "Loja de Produtos", desc: "Pomadas, shampoos e muito mais para cuidar do visual" },
            { icon: "⭐", title: "Programa de Pontos", desc: "Acumule pontos a cada visita e ganhe recompensas" },
            { icon: "📋", title: "Histórico Completo", desc: "Acompanhe todos os seus cortes e serviços realizados" },
          ].map((f) => (
            <View key={f.title} className="flex-row items-center gap-4 bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <Text className="text-3xl">{f.icon}</Text>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">{f.title}</Text>
                <Text className="text-gray-400 text-sm mt-0.5">{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Buttons */}
        <View className="px-6 gap-3 pb-10">
          <TouchableOpacity
            style={{ backgroundColor: "#EAB308", borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
            onPress={() => router.push("/client/login" as any)}
          >
            <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>Entrar na minha conta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: "transparent", borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#EAB308" }}
            onPress={() => router.push("/client/register" as any)}
          >
            <Text style={{ color: "#EAB308", fontWeight: "700", fontSize: 16 }}>Criar conta gratuita</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingVertical: 12, alignItems: "center" }}
            onPress={() => router.push("/client/(tabs)/home" as any)}
          >
            <Text style={{ color: "#9CA3AF", fontSize: 14 }}>Explorar sem conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
