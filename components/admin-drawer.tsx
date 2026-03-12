import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
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

type Role = "super_admin" | "barber" | "receptionist";

interface DrawerItem {
  label: string;
  icon: string;
  route: string;
  roles: Role[];
}

interface DrawerGroup {
  label: string;
  items: DrawerItem[];
}

const DRAWER_GROUPS: DrawerGroup[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { label: "Dashboard",       icon: "chart.bar.fill",              route: "/admin/(tabs)/dashboard",         roles: ["super_admin", "receptionist"] },
      { label: "Agenda",          icon: "calendar",                    route: "/admin/(tabs)/agenda",            roles: ["super_admin", "barber", "receptionist"] },
      { label: "Clientes",        icon: "person.2.fill",               route: "/admin/(tabs)/clients",           roles: ["super_admin", "barber", "receptionist"] },
      { label: "Lista de Espera", icon: "person.badge.clock",          route: "/admin/(tabs)/waitlist",          roles: ["super_admin", "barber", "receptionist"] },
      { label: "Avaliações",      icon: "star.bubble.fill",             route: "/admin/(tabs)/reviews",           roles: ["super_admin", "receptionist"] },
    ],
  },
  {
    label: "CATÁLOGO",
    items: [
      { label: "Serviços",        icon: "scissors",                    route: "/admin/(tabs)/services",          roles: ["super_admin", "receptionist"] },
      { label: "Produtos",        icon: "cube.box.fill",               route: "/admin/(tabs)/products",          roles: ["super_admin", "receptionist"] },
      { label: "Estoque",         icon: "tray.full.fill",              route: "/admin/(tabs)/stock",             roles: ["super_admin"] },
      { label: "Recorrências",    icon: "arrow.clockwise",             route: "/admin/(tabs)/recurring",         roles: ["super_admin", "receptionist"] },
    ],
  },
  {
    label: "MARKETING",
    items: [
      { label: "Fidelidade",              icon: "star.fill",                   route: "/admin/(tabs)/loyalty",           roles: ["super_admin"] },
      { label: "Promoções",               icon: "megaphone.fill",              route: "/admin/(tabs)/promotions",        roles: ["super_admin"] },
      { label: "Conversão de Promoções",  icon: "chart.pie.fill",              route: "/admin/(tabs)/promotion-report",  roles: ["super_admin"] },
      { label: "Retorno Automático",      icon: "bell.badge.fill",             route: "/admin/(tabs)/return-messages",   roles: ["super_admin"] },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { label: "Financeiro",        icon: "dollarsign.circle.fill",      route: "/admin/(tabs)/financial",         roles: ["super_admin"] },
      { label: "Comissões",         icon: "chart.bar.doc.horizontal",    route: "/admin/(tabs)/commissions",       roles: ["super_admin"] },
      { label: "Minhas Comissões",  icon: "person.text.rectangle",       route: "/admin/(tabs)/my-commissions",    roles: ["barber"] },
      { label: "Relatórios",        icon: "chart.line.uptrend.xyaxis",   route: "/admin/(tabs)/reports",           roles: ["super_admin"] },
    ],
  },
  {
    label: "PÁGINA DO CLIENTE",
    items: [
      { label: "Página do Cliente", icon: "globe",                        route: "/admin/(tabs)/pagina-cliente",    roles: ["super_admin"] },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { label: "Barbearia",       icon: "building.2.fill",             route: "/admin/(tabs)/barbearia",         roles: ["super_admin"] },
      { label: "Configurações",   icon: "gearshape.fill",              route: "/admin/(tabs)/settings",          roles: ["super_admin"] },
    ],
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
  const [shouldRender, setShouldRender] = useState(visible);

  const role = (barber?.role ?? "barber") as Role;
  const initials = (barber?.name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "barber" ? "Barbeiro" : "Recepcionista";

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 240, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setShouldRender(false);
      });
    }
  }, [visible]);

  if (!shouldRender) return null;

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
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents={visible ? "auto" : "none"}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            paddingTop: insets.top + 8,
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Header: avatar + nome + role */}
        <TouchableOpacity style={styles.drawerHeader} onPress={() => handleNavigate("/admin/(tabs)/my-profile")} activeOpacity={0.8}>
          <View style={styles.drawerAvatar}>
            {barber?.photoUrl ? (
              <Image source={{ uri: barber.photoUrl }} style={styles.drawerAvatarImage} />
            ) : (
              <Text style={styles.drawerAvatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.drawerUserInfo}>
            <Text style={styles.drawerUserName} numberOfLines={1}>{barber?.name ?? "Administrador"}</Text>
            <Text style={styles.drawerUserRole}>{roleLabel}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <IconSymbol name="xmark" size={18} color="#666" />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Meu Perfil — destaque */}
        <View style={styles.profileRow}>
          <TouchableOpacity
            style={[styles.profileBtn, pathname.includes("my-profile") && styles.profileBtnActive]}
            onPress={() => handleNavigate("/admin/(tabs)/my-profile")}
            activeOpacity={0.8}
          >
            <IconSymbol name="person.fill" size={15} color={pathname.includes("my-profile") ? "#0A0A0A" : "#C9A84C"} />
            <Text style={[styles.profileBtnText, pathname.includes("my-profile") && styles.profileBtnTextActive]}>Meu Perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Grupos */}
        <ScrollView style={styles.drawerItems} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
          {DRAWER_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(role));
            if (visibleItems.length === 0) return null;
            return (
              <View key={group.label} style={styles.group}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {visibleItems.map((item) => {
                  const isActive = pathname.includes(item.route.replace("/admin/(tabs)/", ""));
                  return (
                    <TouchableOpacity
                      key={item.route}
                      style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                      onPress={() => handleNavigate(item.route)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.itemIconBox, isActive && styles.itemIconBoxActive]}>
                        <IconSymbol name={item.icon as any} size={16} color={isActive ? "#0A0A0A" : "#888880"} />
                      </View>
                      <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {isActive && <View style={styles.activeDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

          {/* Sair */}
          <View style={[styles.group, { marginTop: 4 }]}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <View style={[styles.itemIconBox, { backgroundColor: "#EF444418" }]}>
                <IconSymbol name="rectangle.portrait.and.arrow.right" size={16} color="#EF4444" />
              </View>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  drawer: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    backgroundColor: "#0F0F0F",
    borderRightWidth: 1, borderRightColor: "#222",
    flexDirection: "column",
    flex: 1,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14 }
      : { elevation: 20 }),
  },
  drawerHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, gap: 10,
  },
  drawerAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#C9A84C18", borderWidth: 1.5, borderColor: "#C9A84C",
    justifyContent: "center", alignItems: "center",
  },
  drawerAvatarText: { color: "#C9A84C", fontSize: 19, fontWeight: "800" },
  drawerAvatarImage: { width: 46, height: 46, borderRadius: 23 },
  drawerUserInfo: { flex: 1 },
  drawerUserName: { fontSize: 15, fontWeight: "700", color: "#F5F5F0" },
  drawerUserRole: { fontSize: 11, color: "#C9A84C", marginTop: 1 },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: "#1C1C1C" },
  profileRow: { paddingHorizontal: 12, paddingBottom: 10 },
  profileBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A",
  },
  profileBtnActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  profileBtnText: { fontSize: 13, fontWeight: "600", color: "#C9A84C" },
  profileBtnTextActive: { color: "#0A0A0A" },
  divider: { height: 1, backgroundColor: "#1E1E1E", marginHorizontal: 14, marginBottom: 4 },
  drawerItems: { flex: 1, paddingHorizontal: 10, minHeight: 0 },
  group: { marginBottom: 2 },
  groupLabel: {
    fontSize: 9, fontWeight: "800", color: "#3A3A3A",
    letterSpacing: 1.4, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 4,
  },
  drawerItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, marginBottom: 2,
  },
  drawerItemActive: { backgroundColor: "#C9A84C" },
  itemIconBox: {
    width: 30, height: 30, borderRadius: 7,
    backgroundColor: "#1C1C1C", justifyContent: "center", alignItems: "center",
  },
  itemIconBoxActive: { backgroundColor: "#0A0A0A28" },
  itemLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: "#C0C0B8" },
  itemLabelActive: { color: "#0A0A0A" },
  activeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#0A0A0A55" },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10,
  },
  logoutText: { fontSize: 13, fontWeight: "600", color: "#EF4444" },
});
