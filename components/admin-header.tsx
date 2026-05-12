import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminDrawer } from "@/lib/admin-drawer-context";
import { useColors } from "@/hooks/use-colors";

interface AdminHeaderProps {
  title: string;
  rightElement?: React.ReactNode;
}

export function AdminHeader({ title, rightElement }: AdminHeaderProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const { toggleDrawer } = useAdminDrawer();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 2 }]}>
      {/* Botão hamburguer */}
      <TouchableOpacity style={styles.menuBtn} onPress={toggleDrawer} activeOpacity={0.7}>
        <View style={styles.hamburgerLine} />
        <View style={[styles.hamburgerLine, { width: 18 }]} />
        <View style={styles.hamburgerLine} />
      </TouchableOpacity>

      {/* Título */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

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
  menuBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    backgroundColor: c.surface,
  },
  hamburgerLine: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#C9A84C",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    flexShrink: 1,
    minWidth: 0,
  },
  rightSlot: {
    flexShrink: 0,
    flexGrow: 0,
    alignItems: "flex-end",
    minWidth: 160,
  },
});
}
