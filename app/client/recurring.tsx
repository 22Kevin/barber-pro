import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const INTERVAL_OPTIONS = [
  { label: "Toda semana", weeks: 1 },
  { label: "A cada 2 semanas", weeks: 2 },
  { label: "A cada 3 semanas", weeks: 3 },
  { label: "Mensal (4 semanas)", weeks: 4 },
];

const OCCURRENCE_OPTIONS = [3, 4, 6, 8, 10, 12];

function getNextOccurrences(startDate: string, intervalWeeks: number, count: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate + "T12:00:00");
    d.setDate(d.getDate() + i * intervalWeeks * 7);
    dates.push(d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }));
  }
  return dates;
}

export default function RecurringScreen() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [clientId, setClientId] = useState<number | null>(null);
  const [step, setStep] = useState<"list" | "create">("list");
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [intervalWeeks, setIntervalWeeks] = useState(4);
  const [occurrences, setOccurrences] = useState(6);

  React.useEffect(() => {
    AsyncStorage.getItem("client_id").then((id) => {
      if (id) setClientId(parseInt(id, 10));
    });
  }, []);

  const barbersQuery = trpc.barbers.list.useQuery();
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true });
  const recurringQuery = trpc.recurring.listByClient.useQuery(
    { clientId: clientId ?? 0 },
    { enabled: !!clientId }
  );

  const createMutation = trpc.recurring.create.useMutation({
    onSuccess: (result) => {
      Alert.alert(
        "Recorrência criada!",
        `${result.createdCount} agendamentos foram criados com sucesso.`,
        [{ text: "OK", onPress: () => { setStep("list"); utils.recurring.listByClient.invalidate(); } }]
      );
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const cancelMutation = trpc.recurring.cancel.useMutation({
    onSuccess: () => utils.recurring.listByClient.invalidate(),
  });

  function handleCreate() {
    if (!clientId || !selectedBarber || !selectedService || !selectedDate || !selectedTime) {
      Alert.alert("Campos obrigatórios", "Preencha todos os campos para criar a recorrência.");
      return;
    }
    const service = servicesQuery.data?.find((s: any) => s.id === selectedService.id);
    const duration = service?.durationMinutes ?? 30;
    const [h, m] = selectedTime.split(":").map(Number);
    const endDate = new Date(2000, 0, 1, h, m + duration);
    const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

    createMutation.mutate({
      clientId,
      barberId: selectedBarber.id,
      serviceId: selectedService.id,
      startDate: selectedDate,
      startTime: selectedTime + ":00",
      endTime: endTime + ":00",
      intervalWeeks,
      occurrences,
    });
  }

  const previewDates = selectedDate
    ? getNextOccurrences(selectedDate, intervalWeeks, Math.min(occurrences, 4))
    : [];

  if (step === "list") {
    const list = recurringQuery.data ?? [];
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Agendamentos Recorrentes</Text>
          <Pressable
            style={({ pressed }) => [styles.newBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => setStep("create")}
          >
            <IconSymbol name="plus" size={18} color="#fff" />
          </Pressable>
        </View>

        {recurringQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        ) : list.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="arrow.clockwise" size={56} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma recorrência ativa</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Crie uma recorrência para agendar automaticamente o mesmo serviço a cada semana ou mês.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.createBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              onPress={() => setStep("create")}
            >
              <Text style={styles.createBtnText}>Criar Recorrência</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => {
              const intervalLabel = INTERVAL_OPTIONS.find((o) => o.weeks === item.intervalWeeks)?.label ?? `A cada ${item.intervalWeeks} semanas`;
              return (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.cardRow}>
                    <View style={[styles.cardIcon, { backgroundColor: colors.primary + "22" }]}>
                      <IconSymbol name="arrow.clockwise" size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardService, { color: colors.foreground }]}>
                        {(item as any).serviceName}
                      </Text>
                      <Text style={[styles.cardBarber, { color: colors.muted }]}>
                        {(item as any).barberName} · {intervalLabel}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      onPress={() => Alert.alert(
                        "Cancelar recorrência",
                        "Deseja cancelar esta série? Os agendamentos já criados não serão removidos.",
                        [
                          { text: "Não", style: "cancel" },
                          { text: "Cancelar série", style: "destructive", onPress: () => cancelMutation.mutate({ id: item.id }) },
                        ]
                      )}
                    >
                      <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
                    </Pressable>
                  </View>
                  <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.cardInfo}>
                    <View style={styles.infoItem}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Início</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>
                        {item.startDate ? new Date(item.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Horário</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.startTime?.slice(0, 5) ?? "—"}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Ocorrências</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.occurrences}x</Text>
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

  // Step: create
  const barbers = barbersQuery.data?.filter((b: any) => b.isActive) ?? [];
  const services = servicesQuery.data ?? [];

  // Gerar próximas 4 semanas como opções de data
  const dateOptions: string[] = [];
  for (let i = 1; i <= 28; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dateOptions.push(d.toISOString().split("T")[0]);
  }

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "13:00", "13:30", "14:00",
    "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
    "17:30", "18:00",
  ];

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => setStep("list")} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Nova Recorrência</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
        {/* Barbeiro */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Barbeiro</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {barbers.map((b: any) => (
              <Pressable
                key={b.id}
                style={({ pressed }) => [
                  styles.optionChip,
                  {
                    backgroundColor: selectedBarber?.id === b.id ? colors.primary : colors.surface,
                    borderColor: selectedBarber?.id === b.id ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => setSelectedBarber(b)}
              >
                <Text style={{ color: selectedBarber?.id === b.id ? "#fff" : colors.foreground, fontWeight: "600" }}>
                  {b.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Serviço */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Serviço</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {services.map((s: any) => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [
                  styles.optionChip,
                  {
                    backgroundColor: selectedService?.id === s.id ? colors.primary : colors.surface,
                    borderColor: selectedService?.id === s.id ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => setSelectedService(s)}
              >
                <Text style={{ color: selectedService?.id === s.id ? "#fff" : colors.foreground, fontWeight: "600" }}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Data de início */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Data de início</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {dateOptions.slice(0, 14).map((d) => {
              const dateObj = new Date(d + "T12:00:00");
              const label = dateObj.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
              return (
                <Pressable
                  key={d}
                  style={({ pressed }) => [
                    styles.dateChip,
                    {
                      backgroundColor: selectedDate === d ? colors.primary : colors.surface,
                      borderColor: selectedDate === d ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => setSelectedDate(d)}
                >
                  <Text style={{ color: selectedDate === d ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Horário */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Horário</Text>
          <View style={styles.timeGrid}>
            {timeSlots.map((t) => (
              <Pressable
                key={t}
                style={({ pressed }) => [
                  styles.timeChip,
                  {
                    backgroundColor: selectedTime === t ? colors.primary : colors.surface,
                    borderColor: selectedTime === t ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => setSelectedTime(t)}
              >
                <Text style={{ color: selectedTime === t ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Frequência */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Frequência</Text>
          <View style={{ gap: 8 }}>
            {INTERVAL_OPTIONS.map((opt) => (
              <Pressable
                key={opt.weeks}
                style={({ pressed }) => [
                  styles.radioRow,
                  {
                    backgroundColor: intervalWeeks === opt.weeks ? colors.primary + "11" : colors.surface,
                    borderColor: intervalWeeks === opt.weeks ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => setIntervalWeeks(opt.weeks)}
              >
                <View style={[
                  styles.radioCircle,
                  { borderColor: intervalWeeks === opt.weeks ? colors.primary : colors.border },
                ]}>
                  {intervalWeeks === opt.weeks && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={[styles.radioLabel, { color: colors.foreground }]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Número de ocorrências */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Número de agendamentos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {OCCURRENCE_OPTIONS.map((n) => (
              <Pressable
                key={n}
                style={({ pressed }) => [
                  styles.optionChip,
                  {
                    backgroundColor: occurrences === n ? colors.primary : colors.surface,
                    borderColor: occurrences === n ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => setOccurrences(n)}
              >
                <Text style={{ color: occurrences === n ? "#fff" : colors.foreground, fontWeight: "700" }}>
                  {n}x
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Preview das datas */}
        {previewDates.length > 0 && (
          <View style={[styles.previewBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>Próximos agendamentos</Text>
            {previewDates.map((d, i) => (
              <View key={i} style={styles.previewRow}>
                <View style={[styles.previewDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.previewDate, { color: colors.muted }]}>{d}</Text>
              </View>
            ))}
            {occurrences > 4 && (
              <Text style={[styles.previewMore, { color: colors.muted }]}>
                + {occurrences - 4} mais...
              </Text>
            )}
          </View>
        )}

        {/* Botão criar */}
        <Pressable
          style={({ pressed }) => [
            styles.confirmBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleCreate}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmBtnText}>Criar {occurrences} Agendamentos</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  newBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 22, color: "#888" },
  createBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardService: { fontSize: 15, fontWeight: "700" },
  cardBarber: { fontSize: 13, marginTop: 2 },
  cardDivider: { height: 1 },
  cardInfo: { flexDirection: "row", gap: 16 },
  infoItem: {},
  infoLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  optionChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  dateChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, minWidth: 70, alignItems: "center" },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 14, fontWeight: "600" },
  previewBox: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  previewTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  previewDate: { fontSize: 13 },
  previewMore: { fontSize: 12, fontStyle: "italic", marginTop: 4 },
  confirmBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
