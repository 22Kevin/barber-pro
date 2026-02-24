import React, { useState } from "react";
import {
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

const INTERVAL_LABELS: Record<number, string> = {
  1: "Toda semana",
  2: "A cada 2 semanas",
  3: "A cada 3 semanas",
  4: "Mensal",
};

export default function RecurringScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();

  const listQuery = trpc.recurring.listAll.useQuery();
  const cancelMutation = trpc.recurring.cancel.useMutation({
    onSuccess: () => utils.recurring.listAll.invalidate(),
  });

  function handleCancel(id: number, clientName: string) {
    Alert.alert(
      "Cancelar Recorrência",
      `Cancelar a série de agendamentos recorrentes de ${clientName}? Os agendamentos já criados não serão removidos.`,
      [
        { text: "Não", style: "cancel" },
        {
          text: "Cancelar Série",
          style: "destructive",
          onPress: () => cancelMutation.mutate({ id }),
        },
      ]
    );
  }

  const data = listQuery.data ?? [];

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader title="Agendamentos Recorrentes" />

      {listQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : data.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="calendar.badge.clock" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma recorrência ativa</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Quando clientes criarem agendamentos recorrentes, eles aparecerão aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const intervalLabel = INTERVAL_LABELS[item.intervalWeeks] ?? `A cada ${item.intervalWeeks} semanas`;
            const startFormatted = item.startDate
              ? new Date(item.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—";

            return (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
                    <IconSymbol name="arrow.clockwise" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: colors.foreground }]} numberOfLines={1}>
                      {(item as any).clientName ?? "Cliente"}
                    </Text>
                    <Text style={[styles.serviceName, { color: colors.muted }]} numberOfLines={1}>
                      {(item as any).serviceName ?? "Serviço"} · {(item as any).barberName ?? "Barbeiro"}
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => handleCancel(item.id, (item as any).clientName ?? "cliente")}
                  >
                    <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
                  </Pressable>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Frequência</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{intervalLabel}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Início</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{startFormatted}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Ocorrências</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.occurrences}x</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Horário</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.startTime?.slice(0, 5) ?? "—"}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  clientName: { fontSize: 15, fontWeight: "700" },
  serviceName: { fontSize: 13, marginTop: 2 },
  cancelBtn: { padding: 4 },
  divider: { height: 1 },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  infoItem: { flex: 1, minWidth: 80 },
  infoLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: "600" },
});
