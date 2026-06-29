import { useEffect, useRef } from "react";
import { Animated, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";


const ND = Platform.OS !== "web";

export default function WelcomeScreen() {
  const router = useRouter();

  const aLogo   = useRef(new Animated.Value(0.7)).current;
  const aLogoOp = useRef(new Animated.Value(0)).current;
  const aName   = useRef(new Animated.Value(20)).current;
  const aNameOp = useRef(new Animated.Value(0)).current;
  const aTag    = useRef(new Animated.Value(0)).current;
  const aDivider = useRef(new Animated.Value(0)).current;
  const aOpts   = useRef(new Animated.Value(0)).current;
  const aOptsY  = useRef(new Animated.Value(16)).current;
  const aFooter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(aLogo,   { toValue: 1, tension: 50, friction: 7, useNativeDriver: ND }),
        Animated.timing(aLogoOp, { toValue: 1, duration: 500, useNativeDriver: ND }),
      ]),
      Animated.parallel([
        Animated.timing(aNameOp, { toValue: 1, duration: 300, useNativeDriver: ND }),
        Animated.timing(aName,   { toValue: 0, duration: 300, useNativeDriver: ND }),
      ]),
      Animated.timing(aTag,     { toValue: 1, duration: 250, useNativeDriver: ND }),
      Animated.timing(aDivider, { toValue: 1, duration: 400, useNativeDriver: ND }),
      Animated.parallel([
        Animated.timing(aOpts,  { toValue: 1, duration: 350, useNativeDriver: ND }),
        Animated.timing(aOptsY, { toValue: 0, duration: 350, useNativeDriver: ND }),
      ]),
      Animated.timing(aFooter, { toValue: 1, duration: 200, useNativeDriver: ND }),
    ]).start();
  }, []);

  return (
    <View style={s.root}>
            {/* Fundo sutil */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0C0C08" }]} />

      <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={s.container}>

          {/* ── Logo ─────────────────────────────────────────── */}
          <View style={s.logoSection}>
            <Animated.View style={[s.logoWrapper, {
              opacity: aLogoOp,
              transform: [{ scale: aLogo }],
            }]}>
              {/* Glow externo */}
              <View style={s.glowOuter} />
              {/* Glow interno */}
              <View style={s.glowInner} />
              {/* Imagem circular */}
              <Image
                source={require("../../assets/images/icon.png")}
                style={s.logo}
                resizeMode="cover"
              />
            </Animated.View>

            <Animated.Text style={[s.appName, {
              opacity: aNameOp,
              transform: [{ translateY: aName }],
            }]}>
              BARBER PRO
            </Animated.Text>

            <Animated.Text style={[s.tagline, { opacity: aTag }]}>
              Sistema Completo de Barbearia
            </Animated.Text>
          </View>

          {/* ── Divisor ──────────────────────────────────────── */}
          <Animated.View style={[s.dividerRow, { transform: [{ scaleX: aDivider }] }]}>
            <View style={s.dividerLine} />
            <View style={s.dividerDot} />
            <View style={s.dividerLine} />
          </Animated.View>

          {/* ── Opções ───────────────────────────────────────── */}
          <Animated.View style={[s.options, {
            opacity: aOpts,
            transform: [{ translateY: aOptsY }],
          }]}>
            <Text style={s.optionsLabel}>SELECIONE O ACESSO</Text>

            {/* Cadastrar */}
            <Pressable
              style={({ pressed }) => [s.card, s.cardOutline, pressed && s.pressed]}
              onPress={() => router.push("/onboarding/plan-selection" as any)}
            >
              <View style={[s.cardIconBox, s.cardIconBoxOutline]}>
                <IconSymbol name="building.2.fill" size={26} color="#C9A84C" />
              </View>
              <View style={s.cardText}>
                <Text style={[s.cardTitle, { color: "#C9A84C" }]}>Cadastrar minha barbearia</Text>
                <Text style={[s.cardSub, { color: "#777770" }]}>Comece seu período gratuito de 14 dias</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#C9A84C66" />
            </Pressable>

            {/* Login admin */}
            <Pressable
              style={({ pressed }) => [s.card, s.cardSolid, pressed && s.pressed]}
              onPress={() => router.push("/admin/login" as any)}
            >
              <View style={[s.cardIconBox, s.cardIconBoxSolid]}>
                <IconSymbol name="scissors" size={26} color="#1A1A0E" />
              </View>
              <View style={s.cardText}>
                <Text style={[s.cardTitle, { color: "#1A1A0E" }]}>Painel Administrativo</Text>
                <Text style={[s.cardSub, { color: "#1A1A0E99" }]}>Barbeiros e gestão da barbearia</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#1A1A0E66" />
            </Pressable>
          </Animated.View>

          {/* ── Footer ───────────────────────────────────────── */}
          <Animated.View style={[{ alignItems: "center", gap: 8, paddingBottom: 8 }, { opacity: aFooter }]}>
            <Text style={s.footer}>
              Barber Pro © 2026 · Todos os direitos reservados
            </Text>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <Pressable onPress={() => Linking.openURL("https://usebarberpro.com/pub/politica-privacidade")}>
                <Text style={s.footerLink}>Privacidade</Text>
              </Pressable>
              <Text style={s.footerDot}>·</Text>
              <Pressable onPress={() => Linking.openURL("https://usebarberpro.com/pub/termos-de-uso")}>
                <Text style={s.footerLink}>Termos de Uso</Text>
              </Pressable>
              <Text style={s.footerDot}>·</Text>
              <Pressable onPress={() => Linking.openURL("https://usebarberpro.com/pub/politica-privacidade#lgpd")}>
                <Text style={s.footerLink}>LGPD</Text>
              </Pressable>
            </View>
            <Text style={s.footerLgpd}>
              Em conformidade com a LGPD (Lei nº 13.709/2018)
            </Text>
          </Animated.View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const GOLD = "#C9A84C";

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: "#0A0A0A" },
  safe:  { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },

  // Logo
  logoSection: { alignItems: "center", marginBottom: 36 },
  logoWrapper: {
    width: 118, height: 118,
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  glowOuter: {
    position: "absolute",
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: GOLD,
    opacity: 0.08,
  },
  glowInner: {
    position: "absolute",
    width: 118, height: 118, borderRadius: 59,
    backgroundColor: GOLD,
    opacity: 0.12,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 16,
  },
  logo: {
    width: 108, height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: GOLD + "55",
  },
  appName: {
    fontSize: 30,
    fontWeight: "900",
    color: GOLD,
    letterSpacing: 4,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 12,
    color: "#555550",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // Divisor
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#222218" },
  dividerDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD + "66" },

  // Opções
  options:      { gap: 12 },
  optionsLabel: {
    fontSize: 10, color: "#444440",
    letterSpacing: 3, textAlign: "center",
    textTransform: "uppercase", marginBottom: 12,
  },
  card: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, padding: 16, gap: 14,
  },
  cardOutline: {
    backgroundColor: "#0F0F0B",
    borderWidth: 1, borderColor: GOLD + "33",
  },
  cardSolid: {
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  cardIconBox: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  cardIconBoxOutline: { backgroundColor: GOLD + "18" },
  cardIconBoxSolid:   { backgroundColor: "#1A1A0E33" },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  cardSub:   { fontSize: 12, lineHeight: 17 },
  pressed:   { opacity: 0.82, transform: [{ scale: 0.98 }] },

  // Footer
  footer: { fontSize: 11, color: "#2A2A25", textAlign: "center", marginTop: 36 },
  footerLink: { fontSize: 11, color: "#C9A84C88", textDecorationLine: "underline" },
  footerDot: { fontSize: 11, color: "#2A2A25" },
  footerLgpd: { fontSize: 10, color: "#2A2A2588", textAlign: "center" },
});
