import { useEffect, useState, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const slideY = useRef(new Animated.Value(-60)).current;

  function show() {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }
  function hide() {
    Animated.timing(slideY, { toValue: -60, duration: 300, useNativeDriver: true }).start();
  }

  useEffect(() => {
    // Only works on native - web uses navigator.onLine
    let NetInfo: any;
    try { NetInfo = require("@react-native-community/netinfo").default; } catch { return; }

    const unsub = NetInfo.addEventListener((state: any) => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      if (!connected) {
        setIsOffline(true);
        setShowOnline(false);
        show();
      } else if (isOffline) {
        setIsOffline(false);
        setShowOnline(true);
        show();
        setTimeout(() => { setShowOnline(false); hide(); }, 3000);
      }
    });
    return () => unsub();
  }, [isOffline]);

  if (!isOffline && !showOnline) return null;

  return (
    <Animated.View style={[styles.banner, isOffline ? styles.offline : styles.online, { transform: [{ translateY: slideY }] }]}>
      <IconSymbol
        name={isOffline ? "wifi.slash" : "wifi"}
        size={16}
        color={isOffline ? "#FFF" : "#FFF"}
      />
      <Text style={styles.text}>
        {isOffline ? "Sem conexão com a internet" : "Conexão restaurada"}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 9999,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 10, paddingHorizontal: 16,
  },
  offline: { backgroundColor: "#EF4444" },
  online:  { backgroundColor: "#22C55E" },
  text: { color: "#FFF", fontSize: 13, fontWeight: "600" },
});
