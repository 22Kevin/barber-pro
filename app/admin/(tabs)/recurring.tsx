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

const INTERVAL_LABELS: Record<number, string> = {
  1: "Toda semana",
  2: "A cada 2 semanas",
  3: "A cada 3 semanas",
  4: "Mensal",
};

type NewRecurring = {
  clientId: number | null;
  barberId: number | null;
  serviceId: number | null;
  startDate: string;
  startTime: string;
  endTime: string;
  intervalWeeks: number;
  occurrences: number;
  notes: string;
};

const EMPTY_FORM: NewRecurring = {
  clientId: null,
  barberId: null,
  serviceId: null,
  startDate: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
  intervalWeeks: 2,
  occurrences: 4,
  notes: "",
};

export default function RecurringScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const utils = trpc.useUtils();

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<NewRecurring>(EMPTY_FORM);

  const listQuery = trpc.recurring.listAll.useQuery();
  const clientsQuery = trpc.clients.list.useQuery();
  const barbersQuery = trpc.barbers.list.useQuery();
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true, tenantId });

  const cancelMutation = trpc.recurring.cancel.useMutation({
    onSuccess: () => utils.recurring.listAll.invalidate(),
  });
  const createMutation = trpc.recurring.create.useMutation({
    onSuccess: () => {
      utils.recurring.listAll.invalidate();
      setModalVisible(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  function handleCancel(id: number, clientName: string) {
    Alert.alert(
      "Cancelar Recorrência",
      `Cancelar a série de agendamentos recorrentes de ${clientName}? Os agendamentos já criados não serão removidos.`,
      [
        { text: "Não", style: "cancel" },
        { text: "Cancelar Série", style: "destructive", onPress: () => cancelMutation.mutate({ id }) },
      ]
    );
  }

  function handleCreate() {
    if (!form.clientId) { Alert.alert("Atenção", "Selecione um cliente."); return; }
    if (!form.barberId) { Alert.alert("Atenção", "Selecione um barbeiro."); return; }
    if (!form.serviceId) { Alert.alert("Atenção", "Selecione um serviço."); return; }
    if (!form.startDate) { Alert.alert("Atenção", "Informe a data de início."); return; }
    createMutation.mutate({
      clientId: form.clientId,
      barberId: form.barberId,
      serviceId: form.serviceId,
      startDate: form.startDate,
      startTime: form.startTime,
      endTime: form.endTime,
      intervalWeeks: form.intervalWeeks,
      occurrences: form.occurrences,
      notes: form.notes || undefined,
    });
  }

  const data = listQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const barbers = barbersQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  const dyn = {
    label: { fontSize: 13, fontWeight: "600" as const, color: colors.muted, marginBottom: 6, marginTop: 14 },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      color: colors.foreground,
      fontSize: 14,
    },
    selectRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
    selectChip: (selected: boolean) => ({
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      backgroundColor: selected ? colors.primary : colors.surface,
      borderColor: selected ? colors.primary : colors.border,
    }),
    selectChipText: (selected: boolean) => ({
      fontSize: 13,
      fontWeight: "600" as const,
      color: selected ? "#fff" : colors.foreground,
    }),
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader
        title="Agendamentos Recorrentes"
        rightElement={
          <Pressable
            style={({ pressed }) => [styles.newBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => { setForm(EMPTY_FORM); setModalVisible(true); }}
          >
            <IconSymbol name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>Nova</Text>
          </Pressable>
        }
      />

      {listQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : data.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="calendar.badge.clock" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma recorrência ativa</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Toque em "Nova" para criar uma série de agendamentos recorrentes.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => { setForm(EMPTY_FORM); setModalVisible(true); }}
          >
            <Text style={styles.emptyBtnText}>+ Nova Recorrência</Text>
          </Pressable>
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

      {/* Modal Nova Recorrência */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Nova Recorrência</Text>
            <Pressable onPress={() => setModalVisible(false)} style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
            {/* Cliente */}
            <Text style={dyn.label}>CLIENTE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {clients.map((c) => (
                  <Pressable key={c.id} style={dyn.selectChip(form.clientId === c.id)} onPress={() => setForm(f => ({ ...f, clientId: c.id }))}>
                    <Text style={dyn.selectChipText(form.clientId === c.id)}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Barbeiro */}
            <Text style={dyn.label}>BARBEIRO *</Text>
            <View style={dyn.selectRow}>
              {barbers.map((b) => (
                <Pressable key={b.id} style={dyn.selectChip(form.barberId === b.id)} onPress={() => setForm(f => ({ ...f, barberId: b.id }))}>
                  <Text style={dyn.selectChipText(form.barberId === b.id)}>{b.name}</Text>
                </Pressable>
              ))}
            </View>

            {/* Serviço */}
            <Text style={dyn.label}>SERVIÇO *</Text>
            <View style={dyn.selectRow}>
              {services.map((s) => (
                <Pressable key={s.id} style={dyn.selectChip(form.serviceId === s.id)} onPress={() => setForm(f => ({ ...f, serviceId: s.id }))}>
                  <Text style={dyn.selectChipText(form.serviceId === s.id)}>{s.name}</Text>
                </Pressable>
              ))}
            </View>

            {/* Data de início */}
            <Text style={dyn.label}>DATA DE INÍCIO *</Text>
            <TextInput
              style={dyn.input}
              value={form.startDate}
              onChangeText={(t) => setForm(f => ({ ...f, startDate: t }))}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.muted}
            />

            {/* Horários */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={dyn.label}>INÍCIO</Text>
                <TextInput style={dyn.input} value={form.startTime} onChangeText={(t) => setForm(f => ({ ...f, startTime: t }))} placeholder="09:00" placeholderTextColor={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dyn.label}>FIM</Text>
                <TextInput style={dyn.input} value={form.endTime} onChangeText={(t) => setForm(f => ({ ...f, endTime: t }))} placeholder="10:00" placeholderTextColor={colors.muted} />
              </View>
            </View>

            {/* Frequência */}
            <Text style={dyn.label}>FREQUÊNCIA</Text>
            <View style={dyn.selectRow}>
              {[1, 2, 3, 4].map((w) => (
                <Pressable key={w} style={dyn.selectChip(form.intervalWeeks === w)} onPress={() => setForm(f => ({ ...f, intervalWeeks: w }))}>
                  <Text style={dyn.selectChipText(form.intervalWeeks === w)}>{INTERVAL_LABELS[w]}</Text>
                </Pressable>
              ))}
            </View>

            {/* Ocorrências */}
            <Text style={dyn.label}>NÚMERO DE OCORRÊNCIAS</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[2, 4, 6, 8, 12, 24].map((n) => (
                <Pressable key={n} style={dyn.selectChip(form.occurrences === n)} onPress={() => setForm(f => ({ ...f, occurrences: n }))}>
                  <Text style={dyn.selectChipText(form.occurrences === n)}>{n}x</Text>
                </Pressable>
              ))}
            </View>

            {/* Observações */}
            <Text style={dyn.label}>OBSERVAÇÕES</Text>
            <TextInput
              style={[dyn.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={form.notes}
              onChangeText={(t) => setForm(f => ({ ...f, notes: t }))}
              multiline
              placeholder="Observações opcionais..."
              placeholderTextColor={colors.muted}
            />

            <Pressable
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, opacity: pressed || createMutation.isPending ? 0.7 : 1 }]}
              onPress={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Criar Recorrência</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  closeBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: "center", marginTop: 20 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
