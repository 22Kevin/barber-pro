import { useEffect, useRef } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

export default function WelcomeScreen() {
  const router = useRouter();

  const aLogo = useRef(new Animated.Value(0.6)).current;
  const aLogoOp = useRef(new Animated.Value(0)).current;
  const aName = useRef(new Animated.Value(30)).current;
  const aNameOp = useRef(new Animated.Value(0)).current;
  const aTag = useRef(new Animated.Value(0)).current;
  const aDivider = useRef(new Animated.Value(0)).current;
  const aOpts = useRef(new Animated.Value(0)).current;
  const aOptsY = useRef(new Animated.Value(24)).current;
  const aFooter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(aLogo, { toValue: 1, tension: 60, friction: 8, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(aLogoOp, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.parallel([
        Animated.timing(aNameOp, { toValue: 1, duration: 280, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(aName, { toValue: 0, duration: 280, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.timing(aTag, { toValue: 1, duration: 220, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(aDivider, { toValue: 1, duration: 320, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.parallel([
        Animated.timing(aOpts, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(aOptsY, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.timing(aFooter, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, []);

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={s.container}>
          <View style={s.logoContainer}>
            <Animated.View style={[s.logoWrapper, { opacity: aLogoOp, transform: [{ scale: aLogo }] }]}>
              <View style={s.logoGlow} />
              <Image source={require("../../assets/images/icon.png")} style={s.logo} resizeMode="contain" />
            </Animated.View>
            <Animated.Text style={[s.appName, { opacity: aNameOp, transform: [{ translateY: aName }] }]}>
              BARBER PRO
            </Animated.Text>
            <Animated.Text style={[s.tagline, { opacity: aTag }]}>
              Sistema Completo de Barbearia
            </Animated.Text>
          </View>

          <Animated.View style={[s.divider, { transform: [{ scaleX: aDivider }] }]} />

          <Animated.View style={[s.options, { opacity: aOpts, transform: [{ translateY: aOptsY }] }]}>
            <Text style={s.optionsLabel}>SELECIONE O ACESSO</Text>

            <Pressable
              style={({ pressed }) => [s.optionCard, s.registerCard, pressed && s.pressed]}
              onPress={() => router.push("/onboarding/plan-selection" as any)}
            >
              <View style={[s.optionIconBox, { backgroundColor: "#C9A84C22" }]}>
                <IconSymbol name="building.2.fill" size={28} color="#C9A84C" />
              </View>
              <View style={s.flex1}>
                <Text style={[s.optionTitle, { color: "#C9A84C" }]}>Cadastrar minha barbearia</Text>
                <Text style={[s.optionSubtitle, { color: "#888880" }]}>Comece seu período gratuito de 14 dias</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#C9A84C" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.optionCard, s.adminCard, pressed && s.pressed]}
              onPress={() => router.push("/admin/login" as any)}
            >
              <View style={s.optionIconBox}>
                <IconSymbol name="scissors" size={28} color="#0A0A0A" />
              </View>
              <View style={s.flex1}>
                <Text style={s.optionTitle}>Painel Administrativo</Text>
                <Text style={s.optionSubtitle}>Barbeiros e gestão da barbearia</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#0A0A0A" />
            </Pressable>
          </Animated.View>

          <Animated.Text style={[s.footer, { opacity: aFooter }]}>
            Barber Pro © 2025 · Todos os direitos reservados
          </Animated.Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: "#0A0A0A" },
  safe:  { flex: 1, backgroundColor: "#0A0A0A" },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  logoContainer: { alignItems: "center", marginBottom: 32 },
  logoWrapper: { position: "relative", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoGlow: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "#C9A84C", opacity: 0.12,
    shadowColor: "#C9A84C", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 30, elevation: 20,
  },
  logo: { width: 100, height: 100, borderRadius: 22 },
  appName: { fontSize: 32, fontWeight: "900", color: "#C9A84C", letterSpacing: 6, marginTop: 10 },
  tagline: { fontSize: 13, color: "#666660", letterSpacing: 1.5, marginTop: 6 },
  divider: { height: 1, backgroundColor: "#2A2A2A", marginBottom: 32 },
  options: { gap: 14 },
  optionsLabel: { fontSize: 11, color: "#444", letterSpacing: 2.5, textAlign: "center", marginBottom: 10 },
  optionCard: { flexDirection: "row", alignItems: "center", borderRadius: 18, padding: 18, borderWidth: 1 },
  adminCard: { backgroundColor: "#C9A84C", borderColor: "#C9A84C", elevation: 8 },
  registerCard: { backgroundColor: "#0A0A0A", borderColor: "#C9A84C44", borderWidth: 1.5 },
  optionIconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#0A0A0A22", justifyContent: "center", alignItems: "center", marginRight: 14 },
  flex1: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: "700", color: "#0A0A0A", marginBottom: 2 },
  optionSubtitle: { fontSize: 12, color: "#0A0A0A99" },
  footer: { fontSize: 11, color: "#333", textAlign: "center", marginTop: 32 },
  pressed: { opacity: 0.8 },
});
