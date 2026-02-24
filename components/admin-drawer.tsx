import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBarberAuth } from "@/lib/auth-context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

interface DrawerItem {
  label: string;
  icon: string;
  route: string;
  description: string;
}

const DRAWER_ITEMS: DrawerItem[] = [
  {
    label: "Serviços",
    icon: "scissors",
    route: "/admin/(tabs)/services",
    description: "Gerenciar catálogo de serviços",
  },
  {
    label: "Produtos",
    icon: "cube.box.fill",
    route: "/admin/(tabs)/products",
    description: "Estoque e produtos à venda",
  },
  {
    label: "Fidelidade",
    icon: "star.fill",
    route: "/admin/(tabs)/loyalty",
    description: "Pontos, recompensas e cupons",
  },
  {
    label: "Relatórios",
    icon: "chart.line.uptrend.xyaxis",
    route: "/admin/(tabs)/reports",
    description: "Análises e inteligência de negócio",
  },
  {
    label: "Configurações",
    icon: "gearshape.fill",
    route: "/admin/(tabs)/settings",
    description: "Dados da barbearia e integrações",
  },
  {
    label: "Retorno Automático",
    icon: "bell.badge.fill",
    route: "/admin/(tabs)/return-messages",
    description: "Mensagens automáticas pós-serviço",
  },
  {
    label: "Promoções",
    icon: "megaphone.fill",
    route: "/admin/(tabs)/promotions",
    description: "Enviar notificações para clientes",
  },
  {
    label: "Lista de Espera",
    icon: "person.badge.clock",
    route: "/admin/(tabs)/waitlist",
    description: "Clientes aguardando horário",
  },
  {
    label: "Comissões",
    icon: "chart.bar.fill",
    route: "/admin/(tabs)/commissions",
    description: "Controle de comissões por barbeiro",
  },
];

interface AdminDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function AdminDrawer({ visible, onClose }: AdminDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { barber, logout } = useBarberAuth();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible && (translateX as any)._value === -DRAWER_WIDTH) return null;

  function handleNavigate(route: string) {
    onClose();
    setTimeout(() => router.push(route as any), 50);
  }

  function handleLogout() {
    onClose();
    setTimeout(() => logout(), 300);
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Overlay escuro */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Cabeçalho do drawer */}
        <View style={styles.drawerHeader}>
          <View style={styles.drawerLogo}>
            <Text style={styles.drawerLogoText}>✂</Text>
          </View>
          <View style={styles.drawerUserInfo}>
            <Text style={styles.drawerUserName} numberOfLines={1}>
              {barber?.name ?? "Administrador"}
            </Text>
            <Text style={styles.drawerUserRole}>
              {barber?.role === "super_admin"
                ? "Super Admin"
                : barber?.role === "barber"
                ? "Barbeiro"
                : "Recepcionista"}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <IconSymbol name="xmark" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Itens do menu */}
        <ScrollView style={styles.drawerItems} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>MENU</Text>
          {DRAWER_ITEMS.map((item) => {
            const isActive = pathname.includes(item.route.replace("/admin/(tabs)/", ""));
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                onPress={() => handleNavigate(item.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, isActive && styles.drawerItemIconActive]}>
                  <IconSymbol
                    name={item.icon as any}
                    size={22}
                    color={isActive ? "#0A0A0A" : "#C9A84C"}
                  />
                </View>
                <View style={styles.drawerItemText}>
                  <Text style={[styles.drawerItemLabel, isActive && styles.drawerItemLabelActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.drawerItemDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
                {isActive && (
                  <View style={styles.activeIndicator} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.divider} />

        {/* Rodapé com logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <IconSymbol name="power" size={20} color="#F44336" />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#111111",
    borderRightWidth: 1,
    borderRightColor: "#2A2A2A",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  drawerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#C9A84C22",
    borderWidth: 1,
    borderColor: "#C9A84C44",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerLogoText: {
    fontSize: 22,
  },
  drawerUserInfo: {
    flex: 1,
  },
  drawerUserName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  drawerUserRole: {
    fontSize: 12,
    color: "#C9A84C",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#1E1E1E",
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginHorizontal: 20,
    marginVertical: 8,
  },
  drawerItems: {
    flex: 1,
    paddingHorizontal: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#555",
    letterSpacing: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  drawerItemActive: {
    backgroundColor: "#C9A84C",
  },
  drawerItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerItemIconActive: {
    backgroundColor: "#0A0A0A22",
  },
  drawerItemText: {
    flex: 1,
  },
  drawerItemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  drawerItemLabelActive: {
    color: "#0A0A0A",
  },
  drawerItemDesc: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0A0A0A",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F44336",
  },
});
