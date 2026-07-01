import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";

interface AdminHeaderProps {
  title?: string;
  titleNode?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function AdminHeader({ title, titleNode, rightElement }: AdminHeaderProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 2 }]}>
      {/* Selo da marca */}
      <View style={styles.logoBadge}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.logoImage}
          resizeMode="cover"
        />
      </View>

      {/* Título */}
      <View style={{ flex: 1, minWidth: 0 }}>
        {titleNode ?? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>

      {/* Elemento direito (ação contextual) */}
      <View style={styles.rightSlot}>
        {rightElement ?? <View style={{ width: 40 }} />}
      </View>
    </View>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#0A0A0A",
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
    gap: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "#C9A84C",
    overflow: "hidden",
    backgroundColor: "#0F0F0F",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  rightSlot: {
    flexShrink: 0,
    flexGrow: 0,
    alignItems: "flex-end",
    minWidth: 40,
  },
});
}
