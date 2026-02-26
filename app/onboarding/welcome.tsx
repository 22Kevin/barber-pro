import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";

// ─── Constantes visuais ───────────────────────────────────────────────────────
const GOLD = "#C9A84C";
const BG = "#0A0A0A";
const SURFACE = "#141414";
const BORDER = "#2A2A2A";
const MUTED = "#888880";
const TEXT = "#F5F5F0";

// ─── Componente de item de checklist animado ──────────────────────────────────
function CheckItem({ label, delay }: { label: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-16);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateX.value = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.checkItem, animStyle]}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string; shopName?: string }>();
  const slug = params.slug ?? "";
  const shopName = params.shopName ?? "sua barbearia";

  // Animações de entrada
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(20);
  const cardOpacity = useSharedValue(0);
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Sequência de animações de entrada
    logoScale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 120 }));
    logoOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    titleOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    titleTranslate.value = withDelay(500, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));
    cardOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    btnOpacity.value = withDelay(1400, withTiming(1, { duration: 400 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
  }));

  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
  }));

  // URL da página pública
  const publicUrl = slug
    ? `Sua página: barberpro.com.br/b/${slug}`
    : "Configure o slug nas Configurações";

  function handleGoToDashboard() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.replace("/admin/(tabs)/dashboard" as any);
  }

  function handleOpenPublicPage() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Em produção, abriria a URL real
    router.replace("/admin/(tabs)/dashboard" as any);
  }

  return (
    <ScreenContainer containerClassName="bg-[#0A0A0A]">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Ícone de sucesso animado */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <View style={styles.successRing}>
            <View style={styles.successCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
          </View>
        </Animated.View>

        {/* Título */}
        <Animated.View style={[styles.titleWrap, titleStyle]}>
          <Text style={styles.title}>Barbearia criada{"\n"}com sucesso! 🎉</Text>
          <Text style={styles.subtitle}>
            Bem-vindo ao Barber Pro, {shopName}. Tudo está pronto para você começar.
          </Text>
        </Animated.View>

        {/* Card de checklist */}
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.cardTitle}>O que já está configurado</Text>
          <CheckItem label="Barbearia cadastrada no sistema" delay={1000} />
          <CheckItem label="Página pública de agendamento criada" delay={1150} />
          <CheckItem label="Horários de funcionamento definidos" delay={1300} />
          <CheckItem label="Conta de administrador ativa" delay={1450} />
        </Animated.View>

        {/* Card da página pública */}
        <Animated.View style={[styles.linkCard, cardStyle]}>
          <Text style={styles.linkCardLabel}>SUA PÁGINA PÚBLICA</Text>
          <Text style={styles.linkCardUrl}>{publicUrl}</Text>
          <Text style={styles.linkCardHint}>
            Compartilhe esse link no Instagram, WhatsApp e cartão de visita. Seus clientes agendam direto, sem intermediários.
          </Text>
        </Animated.View>

        {/* Botões */}
        <Animated.View style={[styles.btnWrap, btnStyle]}>
          <Pressable
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleGoToDashboard}
          >
            <Text style={styles.btnPrimaryText}>Ir para o painel →</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleOpenPublicPage}
          >
            <Text style={styles.btnSecondaryText}>Ver minha página pública</Text>
          </Pressable>
        </Animated.View>

        {/* Dica final */}
        <Animated.View style={[styles.tipBox, cardStyle]}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            Dica: adicione seus serviços e o primeiro barbeiro no painel para começar a receber agendamentos.
          </Text>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
    alignItems: "center",
  },
  logoWrap: {
    marginBottom: 32,
    alignItems: "center",
  },
  successRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: `${GOLD}44`,
    alignItems: "center",
    justifyContent: "center",
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A1500",
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    fontSize: 36,
    color: GOLD,
    fontWeight: "800",
  },
  titleWrap: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: TEXT,
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  card: {
    width: "100%",
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0D1F0D",
    borderWidth: 1.5,
    borderColor: "#4ADE80",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  checkMark: {
    fontSize: 12,
    color: "#4ADE80",
    fontWeight: "800",
  },
  checkLabel: {
    fontSize: 14,
    color: TEXT,
    flex: 1,
  },
  linkCard: {
    width: "100%",
    backgroundColor: "#0D0D00",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: `${GOLD}44`,
    marginBottom: 24,
  },
  linkCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: GOLD,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  linkCardUrl: {
    fontSize: 14,
    color: GOLD,
    fontWeight: "600",
    marginBottom: 10,
  },
  linkCardHint: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  btnWrap: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  btnPrimary: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "600",
  },
  tipBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#0A0A14",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E1E3A",
  },
  tipIcon: {
    fontSize: 18,
    flexShrink: 0,
    marginTop: 1,
  },
  tipText: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
    flex: 1,
  },
});
