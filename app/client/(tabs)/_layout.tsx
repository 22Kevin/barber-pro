import { Tabs } from "expo-router";
import { Platform, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClientAuthProvider } from "@/lib/client-auth-context";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function ClientTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <ClientAuthProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            paddingTop: 8,
            paddingBottom: bottomPadding,
            height: tabBarHeight,
            backgroundColor: "#0A0A0A",
            borderTopColor: "#1F2937",
            borderTopWidth: 0.5,
          },
          tabBarActiveTintColor: "#EAB308",
          tabBarInactiveTintColor: "#6B7280",
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Início",
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="services"
          options={{
            title: "Serviços",
            tabBarIcon: ({ focused }) => <TabIcon emoji="✂️" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            title: "Loja",
            tabBarIcon: ({ focused }) => <TabIcon emoji="🛍️" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: "Explorar",
            tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "Agenda",
            tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
          }}
        />
      </Tabs>
    </ClientAuthProvider>
  );
}
