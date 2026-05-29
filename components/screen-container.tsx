import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

const BG = "#0A0A0A";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
}

/**
 * Screen container with explicit dark background.
 * Uses StyleSheet instead of NativeWind classes to guarantee
 * correct rendering on both web and native builds.
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  style,
  ...props
}: ScreenContainerProps) {
  return (
    <View style={[styles.root, style]} {...props}>
      <SafeAreaView edges={edges} style={styles.safe}>
        <View style={styles.inner}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: BG },
  safe:  { flex: 1, backgroundColor: BG },
  inner: { flex: 1 },
});
