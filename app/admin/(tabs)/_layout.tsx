import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBarberAuth } from "@/lib/auth-context";

export default function AdminTabsLayout() {
  const { isAuthenticated, isLoading } = useBarberAuth();
  const insets = useSafeAreaInsets();

  if (!isLoading && !isAuthenticated) {
    return <Redirect href={"/admin/login" as any} />;
  }

  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#C9A84C",
        tabBarInactiveTintColor: "#555",
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#0A0A0A",
          borderTopColor: "#2A2A2A",
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      {/* ── 4 abas principais no rodapé ── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <IconSymbol name="chart.bar.fill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color }) => <IconSymbol name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clientes",
          tabBarIcon: ({ color }) => <IconSymbol name="person.2.fill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="financial"
        options={{
          title: "Financeiro",
          tabBarIcon: ({ color }) => <IconSymbol name="dollarsign.circle.fill" size={24} color={color} />,
        }}
      />

      {/* ── Abas secundárias — acessíveis via drawer, ocultas do rodapé ── */}
      <Tabs.Screen
        name="services"
        options={{
          title: "Serviços",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Produtos",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="loyalty"
        options={{
          title: "Fidelidade",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Relatórios",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Configurações",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="return-messages"
        options={{
          title: "Retorno Automático",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: "Promoções",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="waitlist"
        options={{
          title: "Lista de Espera",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="commissions"
        options={{
          title: "Comissões",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="my-commissions"
        options={{
          title: "Minhas Comissões",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: "Estoque",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="recurring"
        options={{
          title: "Assinaturas",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="subscription-plans"
        options={{
          title: "Planos de Assinatura",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="plan-booking"
        options={{
          title: "Assinar Plano",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="promotion-report"
        options={{
          title: "Conversão de Promoções",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="barbearia"
        options={{
          title: "Barbearia",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="my-profile"
        options={{
          title: "Meu Perfil",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: "Avaliações",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat WhatsApp",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="pagina-cliente"
        options={{
          title: "Página do Cliente",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="orbit"
        options={{
          title: "Clientes em Órbita",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Encomendas",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="suporte"
        options={{
          title: "Suporte",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="suppliers"
        options={{
          title: "Fornecedores",
          tabBarItemStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}
