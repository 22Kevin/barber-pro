import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: "#2A2A2A" },
        { opacity },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Skeleton height={22} width="50%" />
      <Skeleton height={14} width="35%" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        {[1,2,3,4].map(i => (
          <View key={i} style={{ width: "47%", backgroundColor: "#141414", borderRadius: 12, padding: 14, gap: 10 }}>
            <Skeleton width={40} height={40} borderRadius={10} />
            <Skeleton height={22} width="60%" />
            <Skeleton height={12} width="80%" />
          </View>
        ))}
      </View>
      <Skeleton height={16} width="40%" style={{ marginTop: 8 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[1,2,3,4].map(i => (
          <View key={i} style={{ width: "47%", backgroundColor: "#141414", borderRadius: 12, padding: 14, gap: 8 }}>
            <Skeleton width={44} height={44} borderRadius={12} />
            <Skeleton height={12} width="70%" />
          </View>
        ))}
      </View>
      <Skeleton height={16} width="40%" style={{ marginTop: 8 }} />
      {[1,2,3].map(i => (
        <View key={i} style={{ backgroundColor: "#141414", borderRadius: 12, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton height={14} width="30%" />
            <Skeleton height={18} width="20%" />
          </View>
          <Skeleton height={12} width="50%" />
        </View>
      ))}
    </View>
  );
}

export function ClientListSkeleton() {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      {[1,2,3,4,5,6].map(i => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#141414", borderRadius: 12, padding: 14 }}>
          <Skeleton width={46} height={46} borderRadius={23} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={15} width="55%" />
            <Skeleton height={12} width="40%" />
          </View>
          <Skeleton width={28} height={28} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}
