import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer containerClassName="bg-[#0A0A0A]" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>BARBER PRO</Text>
          <Text style={styles.tagline}>Sistema Completo de Barbearia</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Access Options */}
        <View style={styles.options}>
          <Text style={styles.optionsLabel}>SELECIONE O ACESSO</Text>

          <Pressable
            style={({ pressed }) => [styles.optionCard, styles.adminCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/admin/login" as any)}
          >
            <View style={styles.optionIconBox}>
              <IconSymbol name="scissors" size={28} color="#0A0A0A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Painel Administrativo</Text>
              <Text style={styles.optionSubtitle}>Barbeiros e gestão da barbearia</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#0A0A0A" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.optionCard, styles.clientCard, pressed && { opacity: 0.85 }]}
            onPress={() => {
              // TODO: Área do cliente (fase 2)
              // router.push("/client" as any)
            }}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#F5F5F022" }]}>
              <IconSymbol name="person.fill" size={28} color="#F5F5F0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: "#F5F5F0" }]}>Área do Cliente</Text>
              <Text style={[styles.optionSubtitle, { color: "#888880" }]}>Agendamentos e histórico</Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Em breve</Text>
            </View>
          </Pressable>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>Barber Pro © 2025 · Todos os direitos reservados</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 32 },
  logoContainer: { alignItems: "center", gap: 8 },
  logo: { width: 100, height: 100, borderRadius: 22 },
  appName: { fontSize: 32, fontWeight: "900", color: "#C9A84C", letterSpacing: 6 },
  tagline: { fontSize: 14, color: "#888880", letterSpacing: 1 },
  divider: { height: 1, backgroundColor: "#2A2A2A" },
  options: { gap: 14 },
  optionsLabel: { fontSize: 11, color: "#555", letterSpacing: 2, textAlign: "center", marginBottom: 4 },
  optionCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 18, gap: 14, borderWidth: 1 },
  adminCard: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  clientCard: { backgroundColor: "#141414", borderColor: "#2A2A2A" },
  optionIconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#0A0A0A22", justifyContent: "center", alignItems: "center" },
  optionTitle: { fontSize: 16, fontWeight: "700", color: "#0A0A0A", marginBottom: 2 },
  optionSubtitle: { fontSize: 12, color: "#0A0A0A99" },
  comingSoonBadge: { backgroundColor: "#2A2A2A", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  comingSoonText: { fontSize: 11, color: "#888880", fontWeight: "600" },
  footer: { fontSize: 11, color: "#333", textAlign: "center" },
});
