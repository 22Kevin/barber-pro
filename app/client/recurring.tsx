import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useClientAuth } from "@/lib/client-auth-context";

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

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function RecurringScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { client } = useClientAuth();
  const tenantId = client?.tenantId ?? undefined;

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

  const barbersQuery = trpc.barbers.list.useQuery({ tenantId });
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true, tenantId });
  const recurringQuery = trpc.recurring.listByClient.useQuery(
    { clientId: clientId ?? 0 },
    { enabled: !!clientId }
  );

  const createMutation = trpc.recurring.create.useMutation({
    onSuccess: (result) => {
      Alert.alert(
        "Assinatura criada! 🔄",
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
      Alert.alert("Campos obrigatórios", "Preencha todos os campos para criar a assinatura.");
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

  // ─── LISTA ───────────────────────────────────────────────────────────────────
  if (step === "list") {
    const list = recurringQuery.data ?? [];
    return (
      <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assinaturas</Text>
          <TouchableOpacity onPress={() => setStep("create")} style={styles.addBtn} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Nova</Text>
          </TouchableOpacity>
        </View>

        {recurringQuery.isLoading ? (
          <ActivityIndicator color="#EAB308" style={{ marginTop: 60 }} />
        ) : list.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 40 }}>🔄</Text>
            </View>
            <Text style={styles.emptyTitle}>Nenhuma assinatura ativa</Text>
            <Text style={styles.emptySubtitle}>
              Crie uma assinatura para agendar automaticamente o mesmo serviço a cada semana ou mês.
            </Text>
            <TouchableOpacity onPress={() => setStep("create")} style={styles.createBtn} activeOpacity={0.85}>
              <Text style={styles.createBtnText}>Criar Assinatura</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => {
              const intervalLabel = INTERVAL_OPTIONS.find((o) => o.weeks === item.intervalWeeks)?.label ?? `A cada ${item.intervalWeeks} semanas`;
              return (
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardIconWrap}>
                      <Text style={{ fontSize: 22 }}>🔄</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardService}>{(item as any).serviceName}</Text>
                      <Text style={styles.cardBarber}>{(item as any).barberName} · {intervalLabel}</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => Alert.alert(
                        "Cancelar assinatura",
                        "Deseja cancelar esta série? Os agendamentos já criados não serão removidos.",
                        [
                          { text: "Não", style: "cancel" },
                          { text: "Cancelar série", style: "destructive", onPress: () => cancelMutation.mutate({ id: item.id }) },
                        ]
                      )}
                    >
                      <Text style={{ color: "#EF4444", fontSize: 20 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardInfo}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Início</Text>
                      <Text style={styles.infoValue}>
                        {item.startDate ? new Date(item.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Horário</Text>
                      <Text style={styles.infoValue}>{item.startTime?.slice(0, 5) ?? "—"}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Ocorrências</Text>
                      <Text style={styles.infoValue}>{item.occurrences}x</Text>
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

  // ─── CRIAÇÃO ─────────────────────────────────────────────────────────────────
  const barbers = barbersQuery.data?.filter((b: any) => b.isActive) ?? [];
  const services = servicesQuery.data ?? [];

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
    <ScreenContainer containerClassName="bg-black" edges={["left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setStep("list")} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Assinatura</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

        {/* Barbeiro */}
        <View>
          <Text style={styles.sectionTitle}>Barbeiro</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {barbers.map((b: any) => {
              const active = selectedBarber?.id === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedBarber(b)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{b.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Serviço */}
        <View>
          <Text style={styles.sectionTitle}>Serviço</Text>
          <View style={{ gap: 8 }}>
            {services.map((s: any) => {
              const active = selectedService?.id === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.serviceCard, active && styles.serviceCardActive]}
                  onPress={() => setSelectedService(s)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceName, active && { color: "#000" }]}>{s.name}</Text>
                    <Text style={[styles.serviceDuration, active && { color: "#00000088" }]}>⏱ {s.durationMinutes} min</Text>
                  </View>
                  <Text style={[styles.servicePrice, active && { color: "#000" }]}>R$ {parseFloat(s.price).toFixed(2)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Data */}
        <View>
          <Text style={styles.sectionTitle}>Data de início</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {dateOptions.map((d) => {
              const dateObj = new Date(d + "T12:00:00");
              const active = selectedDate === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dateCard, active && styles.dateCardActive]}
                  onPress={() => setSelectedDate(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateDow, active && { color: "#000" }]}>{DAYS_PT[dateObj.getDay()]}</Text>
                  <Text style={[styles.dateNum, active && { color: "#000" }]}>{dateObj.getDate()}</Text>
                  <Text style={[styles.dateMon, active && { color: "#000" }]}>{MONTHS_PT[dateObj.getMonth()]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Horário */}
        <View>
          <Text style={styles.sectionTitle}>Horário</Text>
          <View style={styles.timesGrid}>
            {timeSlots.map((t) => {
              const active = selectedTime === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeChip, active && styles.timeChipActive]}
                  onPress={() => setSelectedTime(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timeText, active && { color: "#000" }]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Intervalo */}
        <View>
          <Text style={styles.sectionTitle}>Frequência</Text>
          <View style={{ gap: 8 }}>
            {INTERVAL_OPTIONS.map((opt) => {
              const active = intervalWeeks === opt.weeks;
              return (
                <TouchableOpacity
                  key={opt.weeks}
                  style={[styles.radioRow, active && styles.radioRowActive]}
                  onPress={() => setIntervalWeeks(opt.weeks)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.radioLabel, active && { color: "#EAB308" }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Ocorrências */}
        <View>
          <Text style={styles.sectionTitle}>Número de ocorrências</Text>
          <View style={styles.occurrencesGrid}>
            {OCCURRENCE_OPTIONS.map((n) => {
              const active = occurrences === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.occChip, active && styles.occChipActive]}
                  onPress={() => setOccurrences(n)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.occText, active && { color: "#000" }]}>{n}x</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Preview */}
        {previewDates.length > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Próximas datas</Text>
            {previewDates.map((d, i) => (
              <View key={i} style={styles.previewRow}>
                <View style={styles.previewDot} />
                <Text style={styles.previewDate}>{d}</Text>
              </View>
            ))}
            {occurrences > 4 && (
              <Text style={styles.previewMore}>+ {occurrences - 4} mais...</Text>
            )}
          </View>
        )}

        {/* Botão criar */}
        <TouchableOpacity
          style={[styles.createBtn, createMutation.isPending && { opacity: 0.7 }]}
          onPress={handleCreate}
          disabled={createMutation.isPending}
          activeOpacity={0.85}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.createBtnText}>Criar Assinatura</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  backBtn: { paddingVertical: 4 },
  backText: { color: "#EAB308", fontSize: 15, fontWeight: "600" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  addBtn: {
    backgroundColor: "#EAB308",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: "#000", fontWeight: "700", fontSize: 13 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1A1000",
    borderWidth: 2,
    borderColor: "#EAB308",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { color: "#6B7280", fontSize: 14, textAlign: "center", lineHeight: 22 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A1000",
    borderWidth: 1,
    borderColor: "#EAB308",
    alignItems: "center",
    justifyContent: "center",
  },
  cardService: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardBarber: { color: "#9CA3AF", fontSize: 13, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: "#1F2937", marginVertical: 12 },
  cardInfo: { flexDirection: "row", justifyContent: "space-around" },
  infoItem: { alignItems: "center", gap: 4 },
  infoLabel: { color: "#6B7280", fontSize: 11, fontWeight: "500" },
  infoValue: { color: "#fff", fontSize: 14, fontWeight: "700" },
  sectionTitle: { color: "#EAB308", fontSize: 14, fontWeight: "700", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  chipActive: { backgroundColor: "#EAB308", borderColor: "#EAB308" },
  chipText: { color: "#9CA3AF", fontWeight: "600", fontSize: 14 },
  chipTextActive: { color: "#000" },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  serviceCardActive: { backgroundColor: "#EAB308", borderColor: "#EAB308" },
  serviceName: { color: "#fff", fontWeight: "600", fontSize: 15 },
  serviceDuration: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  servicePrice: { color: "#EAB308", fontWeight: "700", fontSize: 15 },
  dateCard: {
    width: 64,
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  dateCardActive: { backgroundColor: "#EAB308", borderColor: "#EAB308" },
  dateDow: { color: "#9CA3AF", fontSize: 11, fontWeight: "600" },
  dateNum: { color: "#fff", fontSize: 20, fontWeight: "800" },
  dateMon: { color: "#9CA3AF", fontSize: 11 },
  timesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  timeChipActive: { backgroundColor: "#EAB308", borderColor: "#EAB308" },
  timeText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  radioRowActive: { borderColor: "#EAB308" },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: { borderColor: "#EAB308" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EAB308" },
  radioLabel: { color: "#fff", fontSize: 15, fontWeight: "500" },
  occurrencesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  occChip: {
    width: 64,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
  },
  occChipActive: { backgroundColor: "#EAB308", borderColor: "#EAB308" },
  occText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  previewBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    gap: 8,
  },
  previewTitle: { color: "#EAB308", fontWeight: "700", fontSize: 13, marginBottom: 4 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EAB308" },
  previewDate: { color: "#D1D5DB", fontSize: 14 },
  previewMore: { color: "#6B7280", fontSize: 12, marginTop: 4 },
  createBtn: {
    backgroundColor: "#EAB308",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  createBtnText: { color: "#000", fontWeight: "800", fontSize: 16 },
});
