import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, Platform } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

type ToastType = "success" | "error" | "info";

// Global state via callbacks
let _showToast: ((msg: string, type: ToastType) => void) | null = null;

export const toast = {
  success: (msg: string) => _showToast?.(msg, "success"),
  error:   (msg: string) => _showToast?.(msg, "error"),
  info:    (msg: string) => _showToast?.(msg, "info"),
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
  const [state, setState] = useState<{ message: string; type: ToastType; key: number } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    _showToast = (msg, type) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ message: msg, type, key: Date.now() });
      opacity.setValue(0);
      translateY.setValue(-20);
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }),
      ]).start();
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
        ]).start(() => setState(null));
      }, 3000);
    };
    return () => { _showToast = null; };
  }, []);

  if (!state) return null;

  const color = COLORS[state.type];

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.toast, { borderLeftColor: color }]}>
        <IconSymbol name={ICONS[state.type]} size={20} color={color} />
        <Text style={styles.message} numberOfLines={2}>{state.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 48,
    left: 16, right: 16,
    zIndex: 99999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#1A1A1A",
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderLeftWidth: 4, width: "100%",
    elevation: 8,
  },
  message: { flex: 1, color: "#F5F5F5", fontSize: 14, fontWeight: "500" },
});
