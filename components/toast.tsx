import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, Platform } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

type ToastType = "success" | "error" | "info";

interface ToastData {
  message: string;
  subtitle?: string;
  type: ToastType;
  key: number;
  rich?: boolean;
}

let _showToast: ((data: Omit<ToastData, "key">) => void) | null = null;

export const toast = {
  success: (msg: string, subtitle?: string) =>
    _showToast?.({ message: msg, subtitle, type: "success" }),
  error: (msg: string, subtitle?: string) =>
    _showToast?.({ message: msg, subtitle, type: "error" }),
  info: (msg: string, subtitle?: string) =>
    _showToast?.({ message: msg, subtitle, type: "info" }),
  confirm: (msg: string, subtitle?: string) =>
    _showToast?.({ message: msg, subtitle, type: "success", rich: true }),
};

const ICONS: Record<ToastType, any> = {
  success: "checkmark.circle.fill",
  error:   "xmark.circle.fill",
  info:    "info.circle.fill",
};
const COLORS: Record<ToastType, string> = {
  success: "#22C55E",
  error:   "#EF4444",
  info:    "#C9A84C",
};

export function ToastProvider() {
  const [state, setState] = useState<ToastData | null>(null);
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-24)).current;
  const scale     = useRef(new Animated.Value(0.92)).current;
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    _showToast = (data) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ ...data, key: Date.now() });
      opacity.setValue(0);
      translateY.setValue(-24);
      scale.setValue(0.92);

      Animated.parallel([
        Animated.spring(opacity,    { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.spring(scale,      { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }),
      ]).start();

      const duration = data.rich ? 4000 : 3000;
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -16, duration: 280, useNativeDriver: true }),
          Animated.timing(scale,      { toValue: 0.95, duration: 280, useNativeDriver: true }),
        ]).start(() => setState(null));
      }, duration);
    };
    return () => { _showToast = null; };
  }, []);

  if (!state) return null;

  const color = COLORS[state.type];

  // Rich toast — confirmação de agendamento
  if (state.rich) {
    return (
      <Animated.View style={[
        s.container,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}>
        <View style={[s.richToast, { borderColor: color + "33" }]}>
          <View style={[s.richIconCircle, { backgroundColor: color + "18" }]}>
            <IconSymbol name="checkmark.circle.fill" size={32} color={color} />
          </View>
          <View style={s.richContent}>
            <Text style={[s.richTitle, { color }]}>{state.message}</Text>
            {state.subtitle && (
              <Text style={s.richSubtitle}>{state.subtitle}</Text>
            )}
          </View>
        </View>
      </Animated.View>
    );
  }

  // Toast simples
  return (
    <Animated.View style={[
      s.container,
      { opacity, transform: [{ translateY }, { scale }] },
    ]}>
      <View style={[s.toast, { borderLeftColor: color }]}>
        <IconSymbol name={ICONS[state.type]} size={20} color={color} />
        <View style={{ flex: 1 }}>
          <Text style={s.message} numberOfLines={2}>{state.message}</Text>
          {state.subtitle && (
            <Text style={s.subtitle} numberOfLines={1}>{state.subtitle}</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 48,
    left: 16, right: 16,
    zIndex: 99999,
    alignItems: "center",
  },
  // Simple toast
  toast: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#1C1C1C",
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    borderLeftWidth: 4, width: "100%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  message:  { flex: 1, color: "#F0F0F0", fontSize: 14, fontWeight: "600" },
  subtitle: { color: "#888", fontSize: 12, marginTop: 1 },

  // Rich toast
  richToast: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#141414",
    borderRadius: 18, padding: 16, width: "100%",
    borderWidth: 1,
    shadowColor: "#22C55E", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  richIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  richContent: { flex: 1 },
  richTitle:   { fontSize: 16, fontWeight: "800", marginBottom: 3 },
  richSubtitle:{ fontSize: 13, color: "#888", lineHeight: 18 },
});
