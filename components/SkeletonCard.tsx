import { useEffect, useRef } from "react";
import { Animated, DimensionValue, ViewStyle } from "react-native";

const GOLD = "#C9A84C";

function useShimmer() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return opacity;
}

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonCard({ width = "100%", height = 80, borderRadius = 12, style }: SkeletonProps) {
  const opacity = useShimmer();
  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: GOLD, opacity }, style]} />
  );
}

export function SkeletonRow({ width = "80%", height = 14, borderRadius = 6, style }: SkeletonProps) {
  const opacity = useShimmer();
  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: GOLD, opacity }, style]} />
  );
}

export function SkeletonAvatar({ size = 48, style }: { size?: number; style?: ViewStyle }) {
  const opacity = useShimmer();
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: GOLD, opacity }, style]}
    />
  );
}
