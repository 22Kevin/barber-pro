import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useBarberAuth } from "@/lib/auth-context";

function getMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function CommissionsScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const [tab, setTab] = useState<"summary" | "config">("summary");
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingBarber, setEditingBarber] = useState<{ id: number; name: string; rate: number } | null>(null);
  const [rateInput, setRateInput] = useState("");

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear] = useState(now.getFullYear());
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);

  const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${lastDay}`;

  const summaryQuery = trpc.commissions.summary.useQuery({ startDate, endDate, tenantId });
  const configsQuery = trpc.commissions.listConfigs.useQuery({ tenantId });
  const saveConfigMutation = trpc.commissions.saveConfig.useMutation({
    onSuccess: () => {
      configsQuery.refetch();
      summaryQuery.refetch();
      setConfigModalVisible(false);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const allSummary = summaryQuery.data ?? [];
  const configs = configsQuery.data ?? [];
  const summary = selectedBarberId ? allSummary.filter((b) => b.barberId === selectedBarberId) : allSummary;

  const totalGross = summary.reduce((s, b) => s + b.totalGross, 0);
  const totalCommission = summary.reduce((s, b) => s + b.totalCommission, 0);
  const totalNet = summary.reduce((s, b) => s + b.totalNet, 0);

  function openConfigEdit(barberId: number, barberName: string, currentRate: number) {
    setEditingBarber({ id: barberId, name: barberName, rate: currentRate });
    setRateInput(String(currentRate));
    setConfigModalVisible(true);
  }

  function handleSaveConfig() {
    if (!editingBarber) return;
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert("Atenção", "Informe um percentual entre 0 e 100.");
      return;
    }
    saveConfigMutation.mutate({ barberId: editingBarber.id, defaultRate: rate });
  }

  const months = Array.from({ length: 12 }, (_, i) => i);

  const dyn = StyleSheet.create({
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    barberName: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    rateText: { fontSize: 13, color: colors.muted, marginTop: 2 },
    valueRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    valueLabel: { fontSize: 12, color: colors.muted },
    valueAmount: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    commissionAmount: { fontSize: 14, fontWeight: "700", color: colors.primary },
    configCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    configName: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    configRate: { fontSize: 13, color: colors.muted, marginTop: 2 },
    editBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      color: colors.foreground,
      fontSize: 24,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 14,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      marginTop: 8,
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Comissões" />

      {/* Tabs */}
      <View style={[styles.tabs, { borderColor: colors.border }]}>
        {(["summary", "config"] as const).map((t) => (
          <Pressable
            key={t}
            style={({ pressed }) => [
              styles.tabBtn,
              { borderBottomColor: tab === t ? colors.primary : "transparent", opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.muted }]}>
              {t === "summary" ? "Resumo" : "Configurações"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "summary" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Seletor de mês */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {months.map((m) => (
                <Pressable
                  key={m}
                  style={({ pressed }) => [
                    styles.monthBtn,
                    {
                      backgroundColor: selectedMonth === m ? "#C9A84C" : "#1A1A1A",
                      borderColor: selectedMonth === m ? "#C9A84C" : "#C9A84C",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => setSelectedMonth(m)}
                >
                  <Text style={{ color: selectedMonth === m ? "#0A0A0A" : "#C9A84C", fontWeight: "700", fontSize: 13 }}>
                    {MONTH_NAMES[m]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Seletor de funcionário */}
          {allSummary.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  style={({ pressed }) => [styles.monthBtn, { backgroundColor: selectedBarberId === null ? "#C9A84C" : "#1A1A1A", borderColor: "#C9A84C", opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => setSelectedBarberId(null)}
                >
                  <Text style={{ color: selectedBarberId === null ? "#0A0A0A" : "#C9A84C", fontWeight: "700", fontSize: 13 }}>Todos</Text>
                </Pressable>
                {allSummary.map((b) => (
                  <Pressable
                    key={b.barberId}
                    style={({ pressed }) => [styles.monthBtn, { backgroundColor: selectedBarberId === b.barberId ? "#C9A84C" : "#1A1A1A", borderColor: "#C9A84C", opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => setSelectedBarberId(b.barberId)}
                  >
                    <Text style={{ color: selectedBarberId === b.barberId ? "#0A0A0A" : "#C9A84C", fontWeight: "700", fontSize: 13 }}>{b.barberName}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Cards de totais */}
          <View style={styles.totalsRow}>
            <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.muted }]}>Faturamento</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>{fmt(totalGross)}</Text>
            </View>
            <View style={[styles.totalCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
              <Text style={[styles.totalLabel, { color: colors.primary }]}>Total Comissões</Text>
              <Text style={[styles.totalValue, { color: colors.primary }]}>{fmt(totalCommission)}</Text>
            </View>
          </View>
          <View style={[styles.netCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.muted }]}>Líquido da Barbearia</Text>
            <Text style={[styles.netValue, { color: colors.foreground }]}>{fmt(totalNet)}</Text>
          </View>

          {summaryQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : summary.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="chart.bar" size={40} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhum dado para este período</Text>
            </View>
          ) : (
            summary.map((b) => (
              <View key={b.barberId} style={[dyn.summaryCard]}>
                <View style={styles.barberHeader}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {b.barberName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dyn.barberName}>{b.barberName}</Text>
                    <Text style={dyn.rateText}>{b.commissionRate}% de comissão · {b.entriesCount} atendimentos</Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={dyn.valueRow}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={dyn.valueLabel}>Bruto</Text>
                    <Text style={dyn.valueAmount}>{fmt(b.totalGross)}</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={[dyn.valueLabel, { color: colors.primary }]}>Comissão</Text>
                    <Text style={dyn.commissionAmount}>{fmt(b.totalCommission)}</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={dyn.valueLabel}>Líquido</Text>
                    <Text style={[dyn.valueAmount, { color: colors.success ?? "#4CAF50" }]}>{fmt(b.totalNet)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === "config" && (
        <>
          {configsQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={configs}
              keyExtractor={(c) => String(c.id)}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={dyn.configCard}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dyn.configName}>{item.name}</Text>
                    <Text style={dyn.configRate}>{item.commissionRate}% de comissão</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [dyn.editBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => openConfigEdit(item.id, item.name, item.commissionRate)}
                  >
                    <IconSymbol name="pencil" size={18} color={colors.primary} />
                  </Pressable>
                </View>
              )}
            />
          )}
        </>
      )}

      {/* Modal de configuração */}
      <Modal visible={configModalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setConfigModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Comissão</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>{editingBarber?.name}</Text>
            </View>
            <Pressable onPress={() => setConfigModalVisible(false)} style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
            Percentual de comissão sobre o valor bruto de cada serviço/produto:
          </Text>

          <View style={styles.percentRow}>
            <TextInput
              style={dyn.input}
              value={rateInput}
              onChangeText={setRateInput}
              keyboardType="decimal-pad"
              placeholder="50"
              placeholderTextColor={colors.muted}
            />
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground, marginLeft: 8, marginBottom: 14 }}>%</Text>
          </View>

          {/* Atalhos rápidos */}
          <View style={styles.quickRates}>
            {[30, 40, 50, 60, 70].map((r) => (
              <Pressable
                key={r}
                style={({ pressed }) => [
                  styles.quickRateBtn,
                  {
                    backgroundColor: rateInput === String(r) ? colors.primary : colors.surface,
                    borderColor: rateInput === String(r) ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => setRateInput(String(r))}
              >
                <Text style={{ color: rateInput === String(r) ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 14 }}>
                  {r}%
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [dyn.saveBtn, { opacity: pressed || saveConfigMutation.isPending ? 0.7 : 1 }]}
            onPress={handleSaveConfig}
            disabled={saveConfigMutation.isPending}
          >
            {saveConfigMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={dyn.saveBtnText}>Salvar</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontWeight: "700" },
  monthBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, marginRight: 8 },
  totalsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  totalCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14 },
  totalLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  totalValue: { fontSize: 16, fontWeight: "800" },
  netCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netValue: { fontSize: 20, fontWeight: "800" },
  barberHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "800" },
  divider: { height: 1, marginBottom: 12 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  modalContainer: { flex: 1, padding: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  closeBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  percentRow: { flexDirection: "row", alignItems: "center" },
  quickRates: { flexDirection: "row", gap: 8, marginBottom: 24 },
  quickRateBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
});
