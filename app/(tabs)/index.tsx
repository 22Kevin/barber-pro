import { useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function HomeScreen() {
  const router = useRouter();

  // Animações
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const nameSlide = useRef(new Animated.Value(30)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dividerScale = useRef(new Animated.Value(0)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsSlide = useRef(new Animated.Value(24)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Logo aparece com fade + spring
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      ]),
      // 2. Nome sobe com fade
      Animated.parallel([
        Animated.timing(nameOpacity, { toValue: 1, duration: 280, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
        Animated.timing(nameSlide, { toValue: 0, duration: 280, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      ]),
      // 3. Tagline aparece
      Animated.timing(taglineOpacity, { toValue: 1, duration: 220, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      // 4. Divisor expande
      Animated.timing(dividerScale, { toValue: 1, duration: 320, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      // 5. Botões sobem com fade
      Animated.parallel([
        Animated.timing(optionsOpacity, { toValue: 1, duration: 300, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
        Animated.timing(optionsSlide, { toValue: 0, duration: 300, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      ]),
      // 6. Rodapé aparece
      Animated.timing(footerOpacity, { toValue: 1, duration: 200, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
    ]).start();
  }, []);

  return (
    <ScreenContainer containerClassName="bg-[#0A0A0A]" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>

        {/* ── Logo animado ─────────────────────────────────────────────────── */}
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.logoWrapper, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <View style={styles.logoGlow} />
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.Text style={[styles.appName, { opacity: nameOpacity, transform: [{ translateY: nameSlide }] }]}>
            BARBER PRO
          </Animated.Text>

          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            Sistema Completo de Barbearia
          </Animated.Text>
        </View>

        {/* ── Divisor animado ──────────────────────────────────────────────── */}
        <Animated.View style={[styles.divider, { transform: [{ scaleX: dividerScale }] }]} />

        {/* ── Botões de acesso ─────────────────────────────────────────────── */}
        <Animated.View style={[styles.options, { opacity: optionsOpacity, transform: [{ translateY: optionsSlide }] }]}>
          <Text style={styles.optionsLabel}>SELECIONE O ACESSO</Text>

          {/* Botão de cadastro de nova barbearia */}
          <Pressable
            style={({ pressed }) => [styles.optionCard, styles.registerCard, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
            onPress={() => router.push("/onboarding/plan-selection" as any)}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#C9A84C22" }]}>
              <IconSymbol name="building.2.fill" size={28} color="#C9A84C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: "#C9A84C" }]}>Cadastrar minha barbearia</Text>
              <Text style={[styles.optionSubtitle, { color: "#888880" }]}>Comece seu período gratuito de 14 dias</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#C9A84C" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.optionCard, styles.adminCard, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
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

          {/* Área do Cliente removida da v1 — clientes agendam pela página web da barbearia */}
        </Animated.View>

        {/* ── Rodapé ───────────────────────────────────────────────────────── */}
        <Animated.Text style={[styles.footer, { opacity: footerOpacity }]}>
          Barber Pro © 2025 · Todos os direitos reservados
        </Animated.Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 32 },
  logoContainer: { alignItems: "center", gap: 10 },
  logoWrapper: { position: "relative", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#C9A84C",
    opacity: 0.12,
    shadowColor: "#C9A84C",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  logo: { width: 100, height: 100, borderRadius: 22 },
  appName: { fontSize: 32, fontWeight: "900", color: "#C9A84C", letterSpacing: 6 },
  tagline: { fontSize: 13, color: "#666660", letterSpacing: 1.5 },
  divider: { height: 1, backgroundColor: "#2A2A2A" },
  options: { gap: 14 },
  optionsLabel: { fontSize: 11, color: "#444", letterSpacing: 2.5, textAlign: "center", marginBottom: 4 },
  optionCard: { flexDirection: "row", alignItems: "center", borderRadius: 18, padding: 18, gap: 14, borderWidth: 1 },
  adminCard: {
    backgroundColor: "#C9A84C",
    borderColor: "#C9A84C",
    shadowColor: "#C9A84C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  registerCard: { backgroundColor: "#0A0A0A", borderColor: "#C9A84C44", borderWidth: 1.5 },
  optionIconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#0A0A0A22", justifyContent: "center", alignItems: "center" },
  optionTitle: { fontSize: 16, fontWeight: "700", color: "#0A0A0A", marginBottom: 2 },
  optionSubtitle: { fontSize: 12, color: "#0A0A0A99" },
  footer: { fontSize: 11, color: "#333", textAlign: "center" },
});
