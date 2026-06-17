/**
 * BranchSelector — Seletor de unidade para o app Barber Pro
 * Implementado com Modal + Animated nativo — sem dependências externas.
 *
 * Exporta:
 *   BranchProvider         — envolve o layout das tabs
 *   HeaderBranchTitle      — título clicável no header
 *   NavbarBranchIndicator  — dot dourado no ícone ativo da navbar
 *   useBranch              — hook para acessar estado atual
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { skipToken } from "@tanstack/react-query";
import { trpc, saveBarberJwt, saveBarberRefreshJwt } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const GOLD = "#C9A84C";
const GOLD_DIM = "#C9A84C26";
const BG = "#0A0A0A";
const SURFACE = "#1A1A1A";
const SURFACE2 = "#232323";
const TEXT = "#FFFFFF";
const TEXT_MUTED = "#666666";
const GREEN = "#22C55E";

const SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.52);

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Branch = {
  id: number;
  name: string;
  slug: string;
  isMatrix: boolean;
  address?: string;
};

type BranchContextType = {
  current: Branch | null;
  branches: Branch[];
  isLoading: boolean;
  isSwitching: boolean;
  openSelector: () => void;
  switchBranch: (branch: Branch) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const BranchContext = createContext<BranchContextType | null>(null);

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch deve estar dentro de BranchProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const { barber, login } = useBarberAuth();
  const tenantId = barber?.tenantId ?? null;
  const queryClient = useQueryClient();

  console.log("[BranchProvider] barber:", JSON.stringify(barber));
  console.log("[BranchProvider] tenantId:", tenantId);

  const { data, isLoading } = trpc.branches.list.useQuery(
    tenantId != null ? { tenantId } : skipToken,
  );

  console.log("[BranchProvider] query data:", JSON.stringify(data));
  console.log("[BranchProvider] isLoading:", isLoading);

  // Mapear branches adicionando isMatrix inferido via matrixId do servidor
  const branches: Branch[] = (data?.branches ?? []).map((b: any) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    isMatrix: b.id === data?.matrixId,
    address: b.address,
  }));

  console.log("[BranchProvider] branches:", JSON.stringify(branches));

  const [current, setCurrent] = useState<Branch | null>(null);
  const activeCurrent =
    current ??
    branches.find((b) => b.id === (data?.currentTenantId ?? tenantId)) ??
    null;

  console.log("[BranchProvider] activeCurrent:", JSON.stringify(activeCurrent));

  const openSelector = useCallback(() => {
    setSheetVisible(true);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 160,
    }).start();
  }, [translateY]);

  const closeSelector = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSheetVisible(false));
  }, [translateY]);

  const switchMutation = trpc.branches.switch.useMutation();
  const [isSwitching, setIsSwitching] = useState(false);

  const switchBranch = useCallback(
    (branch: Branch) => {
      if (isSwitching) return;
      setIsSwitching(true);
      closeSelector();
      switchMutation.mutate(
        { branchId: branch.isMatrix ? 0 : branch.id },
        {
          onSuccess: async (data) => {
            await saveBarberJwt(data.token);
            if (data.refreshToken) await saveBarberRefreshJwt(data.refreshToken);
            setCurrent(branch);
            await login(data.barber as any);
            setTimeout(() => { queryClient.invalidateQueries(); }, 300);
            setIsSwitching(false);
          },
          onError: (e: any) => {
            console.error("[BranchSelector] switchBranch error:", e.message);
            Alert.alert(
              "Erro ao trocar de unidade",
              "Não foi possível trocar de unidade. Tente novamente.",
            );
            setIsSwitching(false);
          },
        },
      );
    },
    [isSwitching, closeSelector, switchMutation, login, queryClient],
  );

  return (
    <BranchContext.Provider
      value={{ current: activeCurrent, branches, isLoading, isSwitching, openSelector, switchBranch }}
    >
      {children}
      <BranchSelectorSheet
        visible={sheetVisible}
        translateY={translateY}
        onClose={closeSelector}
      />
    </BranchContext.Provider>
  );
}

// ─── Bottom Sheet (Modal nativo) ───────────────────────────────────────────────
type SheetProps = {
  visible: boolean;
  translateY: Animated.Value;
  onClose: () => void;
};

function BranchSelectorSheet({ visible, translateY, onClose }: SheetProps) {
  const { current, branches } = useBranch();
  const matrix = branches.find((b) => b.isMatrix);
  const filiais = branches.filter((b) => !b.isMatrix);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Suas unidades</Text>
          <Text style={styles.sheetSub}>Toque para trocar</Text>
        </View>

        {matrix && (
          <>
            <Text style={styles.sectionLabel}>MATRIZ</Text>
            <BranchCard branch={matrix} isActive={current?.id === matrix.id} />
          </>
        )}

        {filiais.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>FILIAIS</Text>
            {filiais.map((b) => (
              <BranchCard key={b.id} branch={b} isActive={current?.id === b.id} />
            ))}
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────
function BranchCard({ branch, isActive }: { branch: Branch; isActive: boolean }) {
  const { switchBranch, isSwitching } = useBranch();

  return (
    <TouchableOpacity
      onPress={() => switchBranch(branch)}
      disabled={isSwitching || isActive}
      activeOpacity={0.7}
      style={[styles.card, isActive && styles.cardActive]}
    >
      <View style={[styles.cardIcon, isActive && styles.cardIconActive]}>
        <Ionicons
          name={branch.isMatrix ? "home" : "storefront"}
          size={20}
          color={isActive ? BG : TEXT_MUTED}
        />
      </View>

      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, isActive && styles.cardNameActive]}>
          {branch.name}
        </Text>
        {branch.address ? (
          <Text style={styles.cardAddress}>{branch.address}</Text>
        ) : null}
      </View>

      {isActive ? (
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeBadgeText}>Atual</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
      )}
    </TouchableOpacity>
  );
}

// ─── Título do Header ──────────────────────────────────────────────────────────
export function HeaderBranchTitle() {
  const { current, branches, openSelector } = useBranch();

  console.log("[HeaderBranchTitle] render — branches.length:", branches.length, "current:", current?.name);

  if (branches.length <= 1) {
    return (
      <Text style={styles.headerTitleStatic}>
        {current?.name ?? "Barber Pro"}
      </Text>
    );
  }

  const isFilial = current && !current.isMatrix;

  return (
    <TouchableOpacity
      onPress={openSelector}
      activeOpacity={0.7}
      style={styles.headerTitleBtn}
    >
      {isFilial && <View style={styles.filialDot} />}
      <Text style={styles.headerTitleText} numberOfLines={1} ellipsizeMode="tail">
        {current?.name ?? "Barber Pro"}
      </Text>
      <Ionicons name="chevron-down" size={13} color={GOLD} style={{ marginTop: 1 }} />
    </TouchableOpacity>
  );
}

// ─── Dot na navbar ─────────────────────────────────────────────────────────────
export function NavbarBranchIndicator({ children }: { children: React.ReactNode }) {
  const { current } = useBranch();
  const isFilial = current && !current.isMatrix;

  return (
    <View style={styles.navWrap}>
      {children}
      {isFilial && <View style={styles.navDot} />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Modal
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#444",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingTop: 4,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: TEXT },
  sheetSub: { fontSize: 12, color: TEXT_MUTED },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: TEXT_MUTED,
    letterSpacing: 1.4,
    marginBottom: 8,
  },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: SURFACE2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardActive: { borderColor: GOLD, backgroundColor: GOLD_DIM },
  cardPressed: { opacity: 0.7 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconActive: { backgroundColor: GOLD },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "600", color: TEXT },
  cardNameActive: { color: GOLD },
  cardAddress: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E1A",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  activeBadgeText: { fontSize: 11, fontWeight: "600", color: GREEN },

  // Header title
  headerTitleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
    maxWidth: 180,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    flexShrink: 1,
  },
  headerTitleStatic: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
  },
  filialDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GOLD,
  },

  // Navbar
  navWrap: { position: "relative" },
  navDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GOLD,
    borderWidth: 1.5,
    borderColor: BG,
  },
});
