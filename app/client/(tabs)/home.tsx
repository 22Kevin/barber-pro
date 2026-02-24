import { useRouter } from "expo-router";
import { Image, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";

export default function ClientHome() {
  const router = useRouter();
  const { client, isAuthenticated } = useClientAuth();

  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true });
  const productsQuery = trpc.products.list.useQuery({ activeOnly: true });
  const settingsQuery = trpc.settings.get.useQuery();

  const featuredServices = (servicesQuery.data ?? []).slice(0, 4);
  const featuredProducts = (productsQuery.data ?? []).slice(0, 4);
  const shopName = (settingsQuery.data as any)?.shopName ?? "Barber Pro";
  const shopInstagram = (settingsQuery.data as any)?.instagram ?? null;
  const shopGoogleMapsUrl = (settingsQuery.data as any)?.googleMapsUrl ?? null;

  function openInstagram() {
    if (!shopInstagram) return;
    const handle = shopInstagram.replace(/^@/, "");
    const appUrl = `instagram://user?username=${handle}`;
    const webUrl = `https://instagram.com/${handle}`;
    Linking.canOpenURL(appUrl).then((supported) => {
      Linking.openURL(supported ? appUrl : webUrl);
    });
  }

  function openGoogleMaps() {
    if (!shopGoogleMapsUrl) return;
    Linking.openURL(shopGoogleMapsUrl);
  }

  return (
    <ScreenContainer containerClassName="bg-black">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ padding: 20, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ color: "#EAB308", fontWeight: "800", fontSize: 22, letterSpacing: 2 }}>
                {shopName.toUpperCase()}
              </Text>
              <Text style={{ color: "#9CA3AF", fontSize: 14, marginTop: 2 }}>
                {isAuthenticated ? `Olá, ${client?.name.split(" ")[0]}! 👋` : "Bem-vindo!"}
              </Text>
            </View>
            {isAuthenticated && (
              <View style={{ backgroundColor: "#1F1500", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#EAB308" }}>
                <Text style={{ color: "#EAB308", fontWeight: "700", fontSize: 13 }}>⭐ {client?.totalPoints ?? 0} pts</Text>
              </View>
            )}
          </View>
        </View>

        {/* Banner de agendamento */}
        <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: "#111827", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#EAB308" }}>
          <View style={{ padding: 20 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 20, marginBottom: 6 }}>Agende seu horário</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 16 }}>Escolha seu barbeiro, data e horário preferido</Text>
            <TouchableOpacity
              style={{ backgroundColor: "#EAB308", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignSelf: "flex-start" }}
              onPress={() => router.push("/client/book" as any)}
            >
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 14 }}>Agendar agora ✂️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Login CTA para não autenticados */}
        {!isAuthenticated && (
          <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: "#0f1a0f", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#22C55E" }}>
            <Text style={{ color: "#22C55E", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>⭐ Programa de Fidelidade</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 12 }}>Crie sua conta e acumule pontos a cada visita para ganhar recompensas exclusivas!</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#22C55E", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                onPress={() => router.push("/client/register" as any)}
              >
                <Text style={{ color: "#000", fontWeight: "700", fontSize: 13 }}>Criar conta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#374151" }}
                onPress={() => router.push("/client/login" as any)}
              >
                <Text style={{ color: "#9CA3AF", fontSize: 13 }}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Serviços em destaque */}
        {featuredServices.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>Nossos Serviços</Text>
              <TouchableOpacity onPress={() => router.push("/client/(tabs)/services" as any)}>
                <Text style={{ color: "#EAB308", fontSize: 14 }}>Ver todos →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {featuredServices.map((svc: any) => (
                <TouchableOpacity
                  key={svc.id}
                  onPress={() => router.push({ pathname: "/client/book" as any, params: { serviceId: svc.id } })}
                  style={{ width: 160, backgroundColor: "#111827", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#1F2937" }}
                >
                  <View style={{ height: 100, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 40 }}>✂️</Text>
                  </View>
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }} numberOfLines={1}>{svc.name}</Text>
                    <Text style={{ color: "#EAB308", fontWeight: "700", fontSize: 14, marginTop: 4 }}>R$ {parseFloat(svc.price).toFixed(2)}</Text>
                    <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>⏱ {svc.durationMinutes} min</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Produtos em destaque */}
        {featuredProducts.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>Produtos</Text>
              <TouchableOpacity onPress={() => router.push("/client/(tabs)/shop" as any)}>
                <Text style={{ color: "#EAB308", fontSize: 14 }}>Ver todos →</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {featuredProducts.map((prod: any) => (
                  <TouchableOpacity
                    key={prod.id}
                    onPress={() => router.push("/client/(tabs)/shop" as any)}
                    style={{ width: "47%", backgroundColor: "#111827", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#1F2937" }}
                  >
                    <View style={{ height: 90, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 36 }}>🧴</Text>
                    </View>
                    <View style={{ padding: 10 }}>
                      <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }} numberOfLines={2}>{prod.name}</Text>
                      <Text style={{ color: "#EAB308", fontWeight: "700", fontSize: 13, marginTop: 4 }}>R$ {parseFloat(prod.price).toFixed(2)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Instagram e Google Maps */}
        {(shopInstagram || shopGoogleMapsUrl) && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18, marginBottom: 12 }}>Nos encontre</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {shopInstagram && (
                <TouchableOpacity
                  onPress={openInstagram}
                  style={{ flex: 1, backgroundColor: "#1a0a1a", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#7C3AED", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Text style={{ fontSize: 22 }}>📸</Text>
                  <View>
                    <Text style={{ color: "#C084FC", fontWeight: "700", fontSize: 13 }}>Instagram</Text>
                    <Text style={{ color: "#7C3AED", fontSize: 11 }}>{shopInstagram.startsWith("@") ? shopInstagram : `@${shopInstagram}`}</Text>
                  </View>
                </TouchableOpacity>
              )}
              {shopGoogleMapsUrl && (
                <TouchableOpacity
                  onPress={openGoogleMaps}
                  style={{ flex: 1, backgroundColor: "#0a1a0a", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#16A34A", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Text style={{ fontSize: 22 }}>📍</Text>
                  <View>
                    <Text style={{ color: "#4ADE80", fontWeight: "700", fontSize: 13 }}>Como chegar</Text>
                    <Text style={{ color: "#16A34A", fontSize: 11 }}>Google Maps</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Acesso rápido */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18, marginBottom: 12 }}>Acesso rápido</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {[
              { icon: "✂️", label: "Serviços", route: "/client/(tabs)/services" },
              { icon: "🛍️", label: "Loja", route: "/client/(tabs)/shop" },
              { icon: "📅", label: "Meus agendamentos", route: "/client/(tabs)/history" },
              { icon: "⭐", label: "Meus pontos", route: "/client/(tabs)/profile" },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push(item.route as any)}
                style={{ width: "47%", backgroundColor: "#111827", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#1F2937" }}
              >
                <Text style={{ fontSize: 28, marginBottom: 6 }}>{item.icon}</Text>
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13, textAlign: "center" }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
