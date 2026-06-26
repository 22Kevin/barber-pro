import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
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
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

type Role = "super_admin" | "barber" | "receptionist";

const PLAN_FEATURES: Record<string, Set<string>> = {
  solo:   new Set([]),
  team:   new Set(["products","stock","suppliers","orders","coupons","subscription_plans","reports_full"]),
  studio: new Set(["products","stock","suppliers","orders","coupons","subscription_plans","reports_full","commissions","orbit","priority_support"]),
};

function planHasFeature(plan: string | null | undefined, feature: string): boolean {
  if (!plan) return false;
  return PLAN_FEATURES[plan.toLowerCase()]?.has(feature) ?? false;
}

interface DrawerItem {
  label: string;
  icon: string;
  route: string;
  roles: Role[];
  feature?: string;
  requiredPlan?: string;
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
      { label: "Encomendas",      icon: "cube.box.fill",               route: "/admin/(tabs)/orders",            roles: ["super_admin", "barber", "receptionist"], feature: "orders", requiredPlan: "Equipe" },
      { label: "Avaliações",      icon: "star.bubble.fill",             route: "/admin/(tabs)/reviews",           roles: ["super_admin", "receptionist"] },
      { label: "Clientes em Órbita", icon: "location.circle.fill",         route: "/admin/(tabs)/orbit",             roles: ["super_admin", "receptionist"], feature: "orbit", requiredPlan: "Estúdio" },
    ],
  },
  {
    label: "CATÁLOGO",
    items: [
      { label: "Serviços",        icon: "scissors",                    route: "/admin/(tabs)/services",          roles: ["super_admin", "receptionist"] },
      { label: "Produtos",        icon: "cube.box.fill",               route: "/admin/(tabs)/products",          roles: ["super_admin", "receptionist"], feature: "products", requiredPlan: "Equipe" },
      { label: "Estoque",         icon: "tray.full.fill",              route: "/admin/(tabs)/stock",             roles: ["super_admin"], feature: "stock", requiredPlan: "Equipe" },
      { label: "Fornecedores",     icon: "building.2.fill",             route: "/admin/(tabs)/suppliers",         roles: ["super_admin"], feature: "suppliers", requiredPlan: "Equipe" },
      { label: "Assinaturas",       icon: "arrow.clockwise",             route: "/admin/subscription-plans",      roles: ["super_admin", "receptionist"], feature: "subscription_plans", requiredPlan: "Equipe" },
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
      { label: "Comissões",         icon: "chart.bar.doc.horizontal",    route: "/admin/(tabs)/commissions",       roles: ["super_admin"], feature: "commissions", requiredPlan: "Estúdio" },
      { label: "Minhas Comissões",  icon: "person.text.rectangle",       route: "/admin/(tabs)/my-commissions",    roles: ["barber"], feature: "commissions", requiredPlan: "Estúdio" },
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
    label: "SUPORTE",
    items: [
      { label: "Suporte",         icon: "questionmark.circle.fill",    route: "/admin/(tabs)/suporte",           roles: ["super_admin"] },
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
  const colors = useColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { barber, logout } = useBarberAuth();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  const role = (barber?.role ?? "barber") as Role;
  const tenantId = barber?.tenantId ?? 0;
  const pendingOrdersQuery = trpc.productOrders.pendingCount.useQuery(
    { tenantId },
    { enabled: tenantId > 0, refetchInterval: 30000 }
  );
  const tenantPlan = (barber as any)?.tenantPlan ?? "solo";
  const pendingOrdersCount = pendingOrdersQuery.data?.count ?? 0;
  const initials = (barber?.name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "barber" ? "Barbeiro" : "Recepcionista";
  const [upgradeModal, setUpgradeModal] = useState<{ feature: string; plan: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 280, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 240, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 240, useNativeDriver: require('react-native').Platform.OS !== 'web' }),
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
      {/* Upgrade modal */}
      <Modal visible={!!upgradeModal} transparent animationType="fade" onRequestClose={() => setUpgradeModal(null)}>
        <View style={styles.upgradeOverlay}>
          <View style={styles.upgradeCard}>
            <View style={styles.upgradeAccent} />
            <Text style={styles.upgradeLock}>🔒</Text>
            <Text style={styles.upgradeTitle}>{upgradeModal?.feature}</Text>
            <Text style={styles.upgradeDesc}>
              Este recurso não está disponível no seu plano atual.{"\n"}Faça upgrade para desbloqueá-lo.
            </Text>
            <View style={styles.upgradePlanBadge}>
              <Text style={styles.upgradePlanText}>Plano {upgradeModal?.plan} ou superior</Text>
            </View>
            <TouchableOpacity style={styles.upgradeBtn} onPress={() => { setUpgradeModal(null); handleNavigate("/admin/(tabs)/settings"); }}>
              <Text style={styles.upgradeBtnText}>Ver planos e fazer upgrade →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUpgradeModal(null)}>
              <Text style={styles.upgradeCancel}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
                  const isActive = pathname.includes(item.route.replace("/admin/(tabs)/", "").replace("/admin/", ""));
                  const isLocked = !!item.feature && !planHasFeature(tenantPlan, item.feature);
                  return (
                    <TouchableOpacity
                      key={item.route}
                      style={[styles.drawerItem, isActive && !isLocked && styles.drawerItemActive, isLocked && styles.drawerItemLocked]}
                      onPress={() => {
                        if (isLocked) {
                          onClose();
                          setUpgradeModal({ feature: item.label, plan: item.requiredPlan ?? "Superior" });
                        } else {
                          handleNavigate(item.route);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.itemIconBox, isActive && !isLocked && styles.itemIconBoxActive, isLocked && styles.itemIconBoxLocked]}>
                        <IconSymbol name={item.icon as any} size={16} color={isLocked ? "#555" : isActive ? "#0A0A0A" : "#888880"} />
                      </View>
                      <Text style={[styles.itemLabel, isActive && !isLocked && styles.itemLabelActive, isLocked && styles.itemLabelLocked]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {isLocked && (
                        <IconSymbol name="lock.fill" size={11} color="#444" />
                      )}
                      {!isLocked && item.route.includes("orders") && pendingOrdersCount > 0 && !isActive && (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>{pendingOrdersCount}</Text>
                        </View>
                      )}
                      {!isLocked && isActive && <View style={styles.activeDot} />}
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

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
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
  drawerUserName: { fontSize: 15, fontWeight: "700", color: c.foreground },
  drawerUserRole: { fontSize: 11, color: "#C9A84C", marginTop: 1 },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: "#1C1C1C" },
  profileRow: { paddingHorizontal: 12, paddingBottom: 10 },
  profileBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  profileBtnActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  profileBtnText: { fontSize: 13, fontWeight: "600", color: "#C9A84C" },
  profileBtnTextActive: { color: "#0A0A0A" },
  divider: { height: 1, backgroundColor: c.background, marginHorizontal: 14, marginBottom: 4 },
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
  pendingBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  trialBar: { height: 3, backgroundColor: "#2A2A2A", borderRadius: 2, marginTop: 6, marginBottom: 2, width: "100%", overflow: "hidden" },
  trialBarFill: { height: 3, borderRadius: 2 },
  trialText: { fontSize: 10, color: "#666", marginTop: 1 },
  drawerItemLocked: { opacity: 0.5 },
  itemIconBoxLocked: { backgroundColor: "#1A1A1A" },
  itemLabelLocked: { color: "#555" },
  upgradeOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", alignItems: "center", padding: 32 },
  upgradeCard: { width: "100%", maxWidth: 340, backgroundColor: "#161616", borderRadius: 16, borderWidth: 1, borderColor: "#2A2A2A", overflow: "hidden", alignItems: "center" },
  upgradeAccent: { height: 3, backgroundColor: "#C9A84C", width: "100%" },
  upgradeLock: { fontSize: 40, marginTop: 24, marginBottom: 10 },
  upgradeTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", marginBottom: 8, textAlign: "center", paddingHorizontal: 20 },
  upgradeDesc: { fontSize: 13, color: "#888", lineHeight: 20, textAlign: "center", paddingHorizontal: 24, marginBottom: 16 },
  upgradePlanBadge: { backgroundColor: "#C9A84C18", borderWidth: 1, borderColor: "#C9A84C44", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 20 },
  upgradePlanText: { color: "#C9A84C", fontSize: 12, fontWeight: "600" },
  upgradeBtn: { backgroundColor: "#C9A84C", borderRadius: 10, paddingVertical: 13, paddingHorizontal: 24, width: "85%", alignItems: "center", marginBottom: 12 },
  upgradeBtnText: { color: "#0A0A0A", fontSize: 14, fontWeight: "700" },
  upgradeCancel: { color: "#555", fontSize: 13, marginBottom: 24 },
});
}
