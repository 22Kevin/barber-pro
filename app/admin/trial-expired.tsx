import { useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";

const GOLD = "#C9A84C";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://usebarberpro.com";

export default function TrialExpiredScreen() {
  const router = useRouter();
  const { barber, logout } = useBarberAuth();
  const [exporting, setExporting] = useState<string | null>(null);

  const tenantQuery = trpc.tenants.getMyTenant.useQuery(
    { tenantId: barber?.tenantId ?? 0 },
    { enabled: !!barber?.tenantId }
  );
  const tenant = tenantQuery.data;
  const isExpired = tenant?.status === "suspended" || tenant?.status === "cancelled";
  const isTrialEnd = tenant?.status === "trial";

  async function openExport(type: string) {
    setExporting(type);
    try {
      const url = `${API_BASE}/admin/export/${type}?token=${barber?.token ?? ""}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o export. Acesse usebarberpro.com no navegador.");
    } finally {
      setExporting(null);
    }
  }

  function openRenewal() {
    Linking.openURL(`${API_BASE}/admin/configuracoes?tab=plano`);
  }

  const exports = [
    { id: "clientes", icon: "person.2.fill", label: "Clientes", color: "#3B82F6" },
    { id: "agendamentos", icon: "calendar", label: "Agendamentos", color: GOLD },
    { id: "financeiro", icon: "dollarsign.circle.fill", label: "Financeiro", color: "#22C55E" },
    { id: "servicos", icon: "scissors", label: "Serviços", color: "#8B5CF6" },
    { id: "produtos", icon: "cube.box.fill", label: "Produtos", color: "#F59E0B" },
    { id: "fornecedores", icon: "building.2.fill", label: "Fornecedores", color: "#EF4444" },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.iconCircle}>
            <Text style={{ fontSize: 40 }}>{isExpired ? "🔒" : "⏰"}</Text>
          </View>
          <Text style={s.title}>
            {isExpired ? "Plano suspenso" : "Trial expirado"}
          </Text>
          <Text style={s.subtitle}>
            {isExpired
              ? "Seu plano foi suspenso por falta de pagamento."
              : "Seu período gratuito chegou ao fim."}
            {"\n"}Continue usando o Barber Pro renovando seu plano.
          </Text>
        </View>

        {/* Botão de renovação */}
        <Pressable
          style={({ pressed }) => [s.renewBtn, pressed && { opacity: 0.85 }]}
          onPress={openRenewal}
        >
          <IconSymbol name="arrow.clockwise" size={18} color="#0A0A0A" />
          <Text style={s.renewBtnText}>Renovar meu plano agora</Text>
        </Pressable>

        <Text style={s.orText}>ou</Text>

        {/* Exportar dados */}
        <View style={s.exportCard}>
          <Text style={s.exportTitle}>📦 Seus dados são seus</Text>
          <Text style={s.exportDesc}>
            Exporte todas as suas informações em formato CSV antes de sair.
            Você tem direito a todos os dados que cadastrou no sistema.
          </Text>

          <View style={s.exportGrid}>
            {exports.map(exp => (
              <Pressable
                key={exp.id}
                style={({ pressed }) => [s.exportItem, pressed && { opacity: 0.7 }]}
                onPress={() => openExport(exp.id)}
                disabled={!!exporting}
              >
                <View style={[s.exportIcon, { backgroundColor: exp.color + "22" }]}>
                  {exporting === exp.id
                    ? <ActivityIndicator color={exp.color} size="small" />
                    : <IconSymbol name={exp.icon as any} size={22} color={exp.color} />
                  }
                </View>
                <Text style={s.exportLabel}>{exp.label}</Text>
                <Text style={s.exportSub}>↓ CSV</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Alert.alert(
              "Sair",
              "Tem certeza que deseja sair?",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Sair", style: "destructive", onPress: logout },
              ]
            );
          }}
        >
          <Text style={s.logoutText}>Sair da conta</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { alignItems: "center", marginBottom: 32, paddingTop: 16 },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "#1A1A14", borderWidth: 1.5, borderColor: GOLD + "44",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: "900", color: "#F0EEE8", marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#888", textAlign: "center", lineHeight: 22 },
  renewBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: GOLD, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 24, marginBottom: 20,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 10,
  },
  renewBtnText: { fontSize: 16, fontWeight: "800", color: "#0A0A0A" },
  orText: { textAlign: "center", color: "#444", fontSize: 13, marginBottom: 20 },
  exportCard: {
    backgroundColor: "#141414", borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: "#222", marginBottom: 20,
  },
  exportTitle: { fontSize: 16, fontWeight: "800", color: "#F0EEE8", marginBottom: 8 },
  exportDesc: { fontSize: 13, color: "#666", lineHeight: 20, marginBottom: 20 },
  exportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  exportItem: {
    width: "30%", flex: 1, minWidth: 90,
    backgroundColor: "#0F0F0B", borderRadius: 14, padding: 14,
    alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#2A2A2A",
  },
  exportIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  exportLabel: { fontSize: 12, fontWeight: "700", color: "#E5E5E5", textAlign: "center" },
  exportSub: { fontSize: 10, color: "#555", fontWeight: "600" },
  logoutBtn: { alignItems: "center", paddingVertical: 12 },
  logoutText: { fontSize: 13, color: "#555" },
});
