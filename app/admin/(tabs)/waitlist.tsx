import React, { useState } from "react";
import {
function toLocalDate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

function getToday() {
  return toLocalDate(new Date());
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function WaitlistScreen() {
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState(getToday());

  const listQuery = trpc.waitlist.listByDate.useQuery({ date: selectedDate }, { refetchInterval: 30000 });
  const leaveMutation = trpc.waitlist.leave.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const entries = listQuery.data ?? [];

  function handleRemove(id: number, clientName: string) {
    Alert.alert(
      "Remover da fila",
      `Remover ${clientName} da lista de espera?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: () => leaveMutation.mutate({ id }) },
      ]
    );
  }

  // Gerar os próximos 7 dias para o seletor
  const days = Array.from({ length: 7 }, (_, i) => addDays(getToday(), i));

  const dyn = StyleSheet.create({
    dayBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      marginRight: 8,
      alignItems: "center",
      minWidth: 56,
    },
    dayBtnText: { fontSize: 13, fontWeight: "700" },
    dayBtnSub: { fontSize: 10, marginTop: 1 },
    card: {
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
    position: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    positionText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    clientName: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    clientMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
    removeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#F4433622",
      alignItems: "center",
      justifyContent: "center",
    },
  });

  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Lista de Espera" />

      {/* Seletor de data */}
      <View style={styles.dateSelector}>
        <FlatList
          horizontal
          data={days}
          keyExtractor={(d) => d}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          renderItem={({ item: day }) => {
            const isSelected = day === selectedDate;
            const d = new Date(day + "T12:00:00");
            const dayLabel = dayLabels[d.getDay()];
            const dayNum = day.split("-")[2];
            return (
              <Pressable
                style={({ pressed }) => [
                  dyn.dayBtn,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[dyn.dayBtnText, { color: isSelected ? "#fff" : colors.foreground }]}>{dayNum}</Text>
                <Text style={[dyn.dayBtnSub, { color: isSelected ? "#ffffff99" : colors.muted }]}>{dayLabel}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Cabeçalho da data */}
      <View style={[styles.dateHeader, { borderColor: colors.border }]}>
        <IconSymbol name="person.badge.clock" size={16} color={colors.primary} />
        <Text style={[styles.dateHeaderText, { color: colors.foreground }]}>
          {formatDate(selectedDate)} — {entries.length} na fila
        </Text>
      </View>

      {listQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="checkmark.circle" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Fila vazia</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Nenhum cliente aguardando horário neste dia.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          renderItem={({ item, index }) => {
            const client = (item as any).client;
            const clientName = client?.name ?? `Cliente #${item.clientId}`;
            const clientPhone = client?.phone ?? "";
            const createdAt = new Date(item.createdAt);
            const timeStr = createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            return (
              <View style={dyn.card}>
                <View style={dyn.position}>
                  <Text style={dyn.positionText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dyn.clientName}>{clientName}</Text>
                  <Text style={dyn.clientMeta}>
                    {clientPhone ? `${clientPhone} · ` : ""}Entrou às {timeStr}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [dyn.removeBtn, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => handleRemove(item.id, clientName)}
                >
                  <IconSymbol name="xmark" size={16} color="#F44336" />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dateSelector: { borderBottomWidth: 0 },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  dateHeaderText: { fontSize: 14, fontWeight: "600" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
});
