/**
 * BranchSelector — Seletor de unidade para o app Barber Pro
 *
 * Exporta:
 *   BranchProvider       — envolve o layout raiz
 *   HeaderBranchTitle    — título clicável no header
 *   NavbarBranchIndicator — dot dourado no ícone ativo da navbar
 *   useBranch            — hook para acessar estado atual
 */

import React, {
  useCallback,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { skipToken } from "@trpc/client";
import { trpc } from "@/lib/trpc";
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
  const sheetRef = useRef<BottomSheet>(null);
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? null;

  const { data, isLoading } = trpc.branches.list.useQuery(
    tenantId != null ? { tenantId } : skipToken,
  );

  // Derivar branches com isMatrix inferido do matrixId retornado pelo servidor
  const branches: Branch[] = (data?.branches ?? []).map((b: any) => ({
    ...b,
    isMatrix: b.id === data?.matrixId,
  }));

  // Tenant ativo: o que o servidor reconhece como currentTenantId
  const [current, setCurrent] = useState<Branch | null>(null);
  const activeCurrent =
    current ??
    branches.find((b) => b.id === (data?.currentTenantId ?? tenantId)) ??
    null;

  const openSelector = useCallback(() => {
    sheetRef.current?.expand();
  }, []);

  // Troca de filial é apenas local — atualiza o contexto sem chamar mutation de estoque
  const switchBranch = useCallback(
    (branch: Branch) => {
      setCurrent(branch);
      sheetRef.current?.close();
    },
    [],
  );

  return (
    <BranchContext.Provider
      value={{
        current: activeCurrent,
        branches,
        isLoading,
        openSelector,
        switchBranch,
      }}
    >
      {children}
      <BranchSelectorSheet ref={sheetRef} />
    </BranchContext.Provider>
  );
}

// ─── Título do Header ──────────────────────────────────────────────────────────
export function HeaderBranchTitle() {
  const { current, branches, openSelector } = useBranch();

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
      <Text style={styles.headerTitleText} numberOfLines={1}>
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

// ─── Bottom Sheet ──────────────────────────────────────────────────────────────
const BranchSelectorSheet = React.forwardRef<BottomSheet>((_props, ref) => {
  const { current, branches } = useBranch();

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    [],
  );

  const matrix = branches.find((b) => b.isMatrix);
  const filiais = branches.filter((b) => !b.isMatrix);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={["48%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.sheetHandle}
    >
      <BottomSheetView style={styles.sheetContent}>
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
      </BottomSheetView>
    </BottomSheet>
  );
});

// ─── Card ──────────────────────────────────────────────────────────────────────
function BranchCard({
  branch,
  isActive,
}: {
  branch: Branch;
  isActive: boolean;
}) {
  const { switchBranch } = useBranch();

  return (
    <Pressable
      onPress={() => !isActive && switchBranch(branch)}
      style={({ pressed }) => [
        styles.card,
        isActive && styles.cardActive,
        pressed && !isActive && styles.cardPressed,
      ]}
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
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerTitleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    maxWidth: 200,
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
  sheetBg: { backgroundColor: SURFACE },
  sheetHandle: { backgroundColor: "#444", width: 36 },
  sheetContent: { flex: 1, paddingHorizontal: 20, paddingBottom: 32 },
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
});
