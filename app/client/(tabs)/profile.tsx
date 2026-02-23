import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";

type ProfileTab = "points" | "coupons" | "settings";

function PointsTab({ clientId }: { clientId: number }) {
  const pointsHistory = trpc.pointsHistory.byClient.useQuery({ clientId });
  const rewardsQuery = trpc.loyalty.rewards.list.useQuery();
  const configQuery = trpc.loyalty.getConfig.useQuery();
  const { client } = useClientAuth();

  const typeColors: Record<string, string> = {
    earned: "#22C55E",
    redeemed: "#EF4444",
    expired: "#6B7280",
    adjusted: "#3B82F6",
  };
  const typeLabels: Record<string, string> = {
    earned: "+",
    redeemed: "-",
    expired: "-",
    adjusted: "±",
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Saldo */}
      <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 24, margin: 20, alignItems: "center", borderWidth: 1, borderColor: "#EAB308" }}>
        <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 4 }}>Seus pontos</Text>
        <Text style={{ color: "#EAB308", fontSize: 48, fontWeight: "800" }}>{client?.totalPoints ?? 0}</Text>
        <Text style={{ color: "#9CA3AF", fontSize: 13 }}>pontos acumulados</Text>
        {configQuery.data?.isActive && (
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 8, textAlign: "center" }}>
            Ganhe {configQuery.data.pointsPerService} pontos por serviço
          </Text>
        )}
      </View>

      {/* Recompensas disponíveis */}
      {rewardsQuery.data && rewardsQuery.data.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>Recompensas disponíveis</Text>
          {rewardsQuery.data.map((reward: any) => {
            const canRedeem = (client?.totalPoints ?? 0) >= reward.pointsRequired;
            return (
              <View key={reward.id} style={{ backgroundColor: "#111827", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: canRedeem ? "#EAB308" : "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "600" }}>{reward.name}</Text>
                  {reward.description ? <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 2 }}>{reward.description}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: canRedeem ? "#EAB308" : "#6B7280", fontWeight: "700" }}>{reward.pointsRequired} pts</Text>
                  {canRedeem && <Text style={{ color: "#22C55E", fontSize: 11, marginTop: 2 }}>Disponível!</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Histórico de pontos */}
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>Histórico de pontos</Text>
        {pointsHistory.isLoading ? (
          <Text style={{ color: "#9CA3AF" }}>Carregando...</Text>
        ) : !pointsHistory.data || pointsHistory.data.length === 0 ? (
          <Text style={{ color: "#6B7280", textAlign: "center", paddingVertical: 20 }}>Nenhuma movimentação ainda</Text>
        ) : (
          pointsHistory.data.map((entry: any) => (
            <View key={entry.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1F2937" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 14 }}>{entry.description ?? "Pontos"}</Text>
                <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</Text>
              </View>
              <Text style={{ color: typeColors[entry.type] ?? "#fff", fontWeight: "700", fontSize: 16 }}>
                {typeLabels[entry.type]}{Math.abs(entry.points)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function CouponsTab() {
  const couponsQuery = trpc.coupons.list.useQuery();
  const activeCoupons = couponsQuery.data?.filter((c: any) => c.isActive) ?? [];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 16 }}>Cupons disponíveis na barbearia</Text>
      {activeCoupons.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🎟️</Text>
          <Text style={{ color: "#9CA3AF", textAlign: "center" }}>Nenhum cupom disponível no momento</Text>
        </View>
      ) : (
        activeCoupons.map((coupon: any) => (
          <View key={coupon.id} style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#EAB308", borderStyle: "dashed" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "#EAB308", fontWeight: "800", fontSize: 20, letterSpacing: 2 }}>{coupon.code}</Text>
              <View style={{ backgroundColor: "#1F1500", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: "#EAB308", fontWeight: "700" }}>
                  {coupon.discountType === "percent" ? `${coupon.discountValue}% OFF` : `R$ ${parseFloat(coupon.discountValue).toFixed(2)} OFF`}
                </Text>
              </View>
            </View>
            {coupon.description && <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 8 }}>{coupon.description}</Text>}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
              {coupon.validUntil && <Text style={{ color: "#6B7280", fontSize: 12 }}>Válido até: {new Date(coupon.validUntil + "T12:00:00").toLocaleDateString("pt-BR")}</Text>}
              {coupon.minOrderValue && parseFloat(coupon.minOrderValue) > 0 && (
                <Text style={{ color: "#6B7280", fontSize: 12 }}>Mín: R$ {parseFloat(coupon.minOrderValue).toFixed(2)}</Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function SettingsTab({ client, onUpdate }: { client: any; onUpdate: (data: any) => void }) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const updateMutation = trpc.clientAuth.updateProfile.useMutation({
    onSuccess: () => { onUpdate({ name, phone }); Alert.alert("Sucesso", "Perfil atualizado!"); },
    onError: (err: any) => Alert.alert("Erro", err.message),
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 16 }}>Editar perfil</Text>
      <View style={{ gap: 14 }}>
        {[
          { label: "Nome", value: name, setter: setName, keyboard: "default" as const },
          { label: "Telefone / WhatsApp", value: phone, setter: setPhone, keyboard: "phone-pad" as const },
        ].map((f) => (
          <View key={f.label}>
            <Text style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 6 }}>{f.label}</Text>
            <TextInput
              value={f.value}
              onChangeText={f.setter}
              keyboardType={f.keyboard}
              autoCapitalize={f.keyboard === "default" ? "words" : "none"}
              style={{ backgroundColor: "#111827", color: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151", fontSize: 15 }}
            />
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={{ backgroundColor: "#EAB308", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 24, opacity: updateMutation.isPending ? 0.7 : 1 }}
        onPress={() => updateMutation.mutate({ clientId: client.id, name, phone })}
        disabled={updateMutation.isPending}
      >
        <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>{updateMutation.isPending ? "Salvando..." : "Salvar alterações"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function ClientProfile() {
  const router = useRouter();
  const { client, isAuthenticated, logout, updateClient } = useClientAuth();
  const [tab, setTab] = useState<ProfileTab>("points");

  if (!isAuthenticated || !client) {
    return (
      <ScreenContainer containerClassName="bg-black">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>👤</Text>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20, marginBottom: 8 }}>Minha conta</Text>
          <Text style={{ color: "#9CA3AF", textAlign: "center", marginBottom: 24 }}>Faça login para acessar seu perfil, pontos e cupons.</Text>
          <TouchableOpacity
            style={{ backgroundColor: "#EAB308", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12 }}
            onPress={() => router.push("/client/login" as any)}
          >
            <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>Fazer login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/client/register" as any)}>
            <Text style={{ color: "#EAB308" }}>Criar conta gratuita</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black">
      <View style={{ flex: 1 }}>
        {/* Header do perfil */}
        <View style={{ padding: 20, paddingBottom: 0 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22 }}>{client.name}</Text>
              <Text style={{ color: "#9CA3AF", fontSize: 14 }}>{client.email}</Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert("Sair", "Deseja sair da sua conta?", [
                { text: "Cancelar" },
                { text: "Sair", style: "destructive", onPress: () => { logout(); router.replace("/client/index" as any); } },
              ])}
              style={{ backgroundColor: "#1F2937", borderRadius: 10, padding: 10 }}
            >
              <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}>Sair</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: "row", backgroundColor: "#111827", borderRadius: 12, padding: 4 }}>
            {[
              { key: "points", label: "⭐ Pontos" },
              { key: "coupons", label: "🎟️ Cupons" },
              { key: "settings", label: "⚙️ Perfil" },
            ].map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key as ProfileTab)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: tab === t.key ? "#EAB308" : "transparent" }}
              >
                <Text style={{ color: tab === t.key ? "#000" : "#9CA3AF", fontWeight: "600", fontSize: 12 }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {tab === "points" && <PointsTab clientId={client.id} />}
        {tab === "coupons" && <CouponsTab />}
        {tab === "settings" && <SettingsTab client={client} onUpdate={(data) => updateClient(data)} />}
      </View>
    </ScreenContainer>
  );
}
