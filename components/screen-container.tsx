import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

const BG = "#0A0A0A";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  // These props are accepted for API compatibility but styles come from StyleSheet
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
}

export function ScreenContainer({
  children,
  edges = ["left", "right"],
  style,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  className: _c,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  containerClassName: _cc,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  safeAreaClassName: _sc,
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
