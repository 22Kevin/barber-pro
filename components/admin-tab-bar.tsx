import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface TabConfig {
  name: string;
  label: string;
  icon: "chart.bar.fill" | "person.2.fill" | "dollarsign.circle.fill" | "line.3.horizontal";
}

const TABS: TabConfig[] = [
  { name: "dashboard", label: "Início", icon: "chart.bar.fill" },
  { name: "clients", label: "Clientes", icon: "person.2.fill" },
  { name: "financial", label: "Financeiro", icon: "dollarsign.circle.fill" },
  { name: "menu", label: "Menu", icon: "line.3.horizontal" },
];

interface AdminTabBarProps extends BottomTabBarProps {
  canFinanceiro: boolean;
}

export function AdminTabBar({ state, navigation, canFinanceiro }: AdminTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 6);

  const visibleTabs = TABS.filter((tab) => tab.name !== "financial" || canFinanceiro);
  const activeRouteName = state.routes[state.index]?.name;

  const goTo = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    navigation.navigate(route.name);
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      {visibleTabs.map((tab) => {
        const isActive = activeRouteName === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => goTo(tab.name)}
          >
            <IconSymbol name={tab.icon} size={20} color={isActive ? "#C9A84C" : "#666"} />
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => goTo("agenda")}>
        <IconSymbol name="calendar.badge.plus" size={22} color="#0A0A0A" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    backgroundColor: "#0A0A0A",
    borderTopWidth: 0.5,
    borderTopColor: "#2A2A2A",
    paddingTop: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666",
  },
  labelActive: {
    color: "#C9A84C",
  },
  fab: {
    position: "absolute",
    top: -22,
    left: "50%",
    marginLeft: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#C9A84C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0A0A0A",
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 }
      : { elevation: 6 }),
  },
});
