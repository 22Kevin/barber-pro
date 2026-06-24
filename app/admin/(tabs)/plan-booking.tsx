import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useBarberAuth } from "@/lib/auth-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DAYS_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  debit_card: "Cartão Débito",
  credit_card: "Cartão Crédito",
};

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function addMinutes(t: string, mins: number) {
  const total = toMinutes(t) + mins;
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function generateTimeSlots(
  start: string,
  end: string,
  step = 30,
  lunchStart?: string | null,
  lunchEnd?: string | null,
  dateStr?: string,
) {
  const slots: string[] = [];
  let current = start;

  // Calcular o minuto atual no fuso de Brasília (UTC-3)
  const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayBrasilia = nowBrasilia.toISOString().split("T")[0];
  const isToday = dateStr === todayBrasilia;
  const currentMinute = isToday
    ? nowBrasilia.getUTCHours() * 60 + nowBrasilia.getUTCMinutes() + 5 // margem de 5 min
    : 0;

  const lunchStartMin = lunchStart ? toMinutes(lunchStart) : null;
  const lunchEndMin = lunchEnd ? toMinutes(lunchEnd) : null;

  while (current < end) {
    const slotMin = toMinutes(current);
    // Filtrar horários passados
    const isPast = isToday && slotMin < currentMinute;
    // Filtrar intervalo de almoço
    const isLunch =
      lunchStartMin !== null &&
      lunchEndMin !== null &&
      slotMin >= lunchStartMin &&
      slotMin < lunchEndMin;
    if (!isPast && !isLunch) {
      slots.push(current);
    }
    current = addMinutes(current, step);
  }
  return slots;
}
function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysInMonth(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let i = 1; i <= total; i++) cells.push(i);
  return cells;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Step = "plan" | "items" | "schedule" | "payment" | "confirm";

type SlotEntry = { date: string; time: string };

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PlanBookingScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;
  const router = useRouter();

  const [step, setStep] = useState<Step>("plan");

  // Seleções
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(barber?.id ?? null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pix" | "debit_card" | "credit_card">("cash");
  const [autoRenew, setAutoRenew] = useState(false);
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [clientSearch, setClientSearch] = useState("");

  // Calendário independente para cada slot
  const [calendarMonths, setCalendarMonths] = useState<Date[]>([]);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [pickingTime, setPickingTime] = useState(false);
  const [tempDate, setTempDate] = useState<string | null>(null);

  // Queries
  const tenantIdParam = tenantId > 0 ? tenantId : undefined;
  const plansQuery = trpc.subscriptionPlans.listPlans.useQuery({ tenantId });
  const clientsQuery = trpc.clients.list.useQuery({ tenantId: tenantIdParam });
  const barbersQuery = trpc.barbers.list.useQuery({ tenantId: tenantIdParam });
  const utils = trpc.useUtils();

  const planDetail = useMemo(() => {
    if (!selectedPlanId) return null;
    return (plansQuery.data ?? []).find((p: any) => p.id === selectedPlanId) ?? null;
  }, [selectedPlanId, plansQuery.data]);

  const workingHoursQuery = trpc.barbers.workingHours.get.useQuery(
    { barberId: selectedBarberId ?? 0 },
    { enabled: !!selectedBarberId }
  );

  // Calcular intervalo de datas dos slots para buscar agendamentos existentes
  const slotDates = useMemo(() => slots.map((s) => s.date).filter(Boolean).sort(), [slots]);
  const rangeStart = slotDates[0] ?? formatDate(new Date());
  const rangeEnd = slotDates[slotDates.length - 1] ?? formatDate(new Date());

  const bookedAppointmentsQuery = trpc.appointments.byDateRange.useQuery(
    { barberId: selectedBarberId ?? 0, startDate: rangeStart, endDate: rangeEnd },
    { enabled: !!selectedBarberId && step === "schedule" }
  );

  const createMutation = trpc.subscriptionPlans.createSubscription.useMutation({
    onSuccess: () => {
      utils.subscriptionPlans.listSubscriptions.invalidate();
      Alert.alert(
        "Assinatura criada!",
        "A assinatura foi registrada com sucesso.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: (e) => {
      Alert.alert("Erro", e.message ?? "Não foi possível criar a assinatura.");
    },
  });

  // ── Helpers de seleção ────────────────────────────────────────────────────

  const toggleService = (id: number) => {
    if (!planDetail) return;
    const max = planDetail.maxServices ?? 999;
    setSelectedServiceIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  };

  const toggleProduct = (id: number) => {
    if (!planDetail) return;
    const max = planDetail.maxProducts ?? 999;
    setSelectedProductIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  };

  // ── Inicializar slots ao entrar na etapa de horários ─────────────────────

  const initSlots = () => {
    if (!planDetail) return;
    const count = planDetail.recurrences ?? 1;
    const today = new Date();
    const initial: SlotEntry[] = [];
    const initialMonths: Date[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i * 7);
      initial.push({ date: formatDate(d), time: "" });
      initialMonths.push(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    setSlots(initial);
    setCalendarMonths(initialMonths);
  };

  // ── Atualizar slot ────────────────────────────────────────────────────────

  const updateSlot = (index: number, field: "date" | "time", value: string) => {
    setSlots((prev) => {
      const updated = prev.map((s, i) => (i === index ? { ...s, [field]: value } : s));
      // Auto-preenchimento: quando o usuário define a data do 1º slot,
      // preenche os demais pulando 7 dias, mas só se ainda não foram preenchidos
      if (field === "date" && index === 0) {
        const baseDate = new Date(value + "T12:00:00");
        return updated.map((s, i) => {
          if (i === 0) return s;
          const next = new Date(baseDate);
          next.setDate(baseDate.getDate() + i * 7);
          const nextStr = formatDate(next);
          return { ...s, date: nextStr, time: s.time };
        });
      }
      return updated;
    });
    // Sincronizar o mês do calendário do slot quando a data muda
    if (field === "date") {
      const d = new Date(value + "T12:00:00");
      setCalendarMonths((prev) => {
        const updated = [...prev];
        if (index === 0) {
          // Auto-preencher meses dos outros slots
          const baseDate = new Date(d);
          return updated.map((_, i) => {
            const next = new Date(baseDate);
            next.setDate(baseDate.getDate() + i * 7);
            return new Date(next.getFullYear(), next.getMonth(), 1);
          });
        }
        updated[index] = new Date(d.getFullYear(), d.getMonth(), 1);
        return updated;
      });
    }
  };

  // ── Confirmar assinatura ──────────────────────────────────────────────────

  const handleConfirm = () => {
    if (!planDetail || !selectedClientId || slots.length === 0) return;
    createMutation.mutate({
      tenantId,
      planId: planDetail.id,
      clientId: selectedClientId,
      barberId: selectedBarberId ?? undefined,
      selectedServiceIds,
      selectedProductIds,
      paymentMethod,
      price: Number(planDetail.price),
      autoRenew,
      appointments: slots.map((s) => ({
        date: s.date,
        time: s.time,
        barberId: selectedBarberId ?? undefined,
      })),
    });
  };

  // ── Filtros ───────────────────────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    const all = (clientsQuery.data ?? []) as any[];
    if (!clientSearch) return all;
    return all.filter((c: any) =>
      c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.phone?.includes(clientSearch)
    );
  }, [clientsQuery.data, clientSearch]);

  // ── Slots de horário disponíveis ──────────────────────────────────────────

  const getTimeSlots = (dateStr: string) => {
    const dayOfWeek = new Date(dateStr + "T12:00:00").getDay();
    const wh = (workingHoursQuery.data ?? []) as any[];
    const day = wh.find((d: any) => d.dayOfWeek === dayOfWeek);
    if (!day?.isWorking) return [];

    // Gerar slots com filtros de almoço e horários passados
    const allSlots = generateTimeSlots(
      day.startTime ?? "08:00",
      day.endTime ?? "20:00",
      30,
      day.lunchStart ?? null,
      day.lunchEnd ?? null,
      dateStr,
    );

    // Filtrar horários já agendados para o barbeiro nesta data (considerando duração)
    const bookedRanges = (bookedAppointmentsQuery.data ?? [])
      .filter((a: any) => a.date === dateStr && a.status !== "cancelled" && a.status !== "no_show")
      .map((a: any) => {
        const [sh, sm] = (a.startTime ?? "00:00").split(":").map(Number);
        const [eh, em] = (a.endTime ?? a.startTime ?? "00:00").split(":").map(Number);
        return { start: sh * 60 + sm, end: eh * 60 + em };
      });

    const serviceDuration = planDetail?.maxServices
      ? (planDetail as any).durationMinutes ?? 30
      : 30;

    return allSlots.filter((t) => {
      const [th, tm] = t.split(":").map(Number);
      const slotStart = th * 60 + tm;
      const slotEnd = slotStart + serviceDuration;
      return !bookedRanges.some((r) => slotStart < r.end && slotEnd > r.start);
    });
  };

  // ─── STEP: Plano + Cliente ────────────────────────────────────────────────

  if (step === "plan") {
    const plans = (plansQuery.data ?? []).filter((p: any) => p.isActive !== 0) as any[];
    const clients = filteredClients;

    return (
      <ScreenContainer>
        <AdminHeader
          title="Assinar Plano"
          rightElement={
            <TouchableOpacity style={{ padding: 8 }} onPress={() => router.back()}>
              <IconSymbol name="xmark.circle.fill" size={22} color="#C9A84C" />
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* Progresso */}
          <StepIndicator current={1} total={4} />

          {/* Selecionar Plano */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Escolha o Plano</Text>
          {plansQuery.isLoading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
          ) : plans.length === 0 ? (
            <View style={[styles.emptyBox, { borderColor: colors.border }]}>
              <Text style={{ color: colors.muted, textAlign: "center" }}>
                Nenhum plano ativo. Crie planos em Assinaturas → Planos.
              </Text>
            </View>
          ) : (
            plans.map((plan: any) => (
              <Pressable
                key={plan.id}
                style={[
                  styles.planCard,
                  { borderColor: selectedPlanId === plan.id ? "#C9A84C" : colors.border, backgroundColor: colors.surface },
                ]}
                onPress={() => setSelectedPlanId(plan.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{plan.name}</Text>
                  {plan.description ? (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{plan.description}</Text>
                  ) : null}
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                    {plan.recurrences}x por mês · {plan.maxServices} serviço{plan.maxServices !== 1 ? "s" : ""} · R$ {Number(plan.price).toFixed(2)}
                  </Text>
                </View>
                {selectedPlanId === plan.id && (
                  <IconSymbol name="checkmark.circle.fill" size={22} color="#C9A84C" />
                )}
              </Pressable>
            ))
          )}

          {/* Selecionar Cliente */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Selecione o Cliente</Text>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              style={{ flex: 1, color: colors.foreground, marginLeft: 8, fontSize: 14 }}
              placeholder="Buscar por nome ou telefone..."
              placeholderTextColor={colors.muted}
              value={clientSearch}
              onChangeText={setClientSearch}
            />
          </View>
          {clients.slice(0, 8).map((c: any) => (
            <Pressable
              key={c.id}
              style={[
                styles.clientRow,
                { borderColor: selectedClientId === c.id ? "#C9A84C" : colors.border, backgroundColor: colors.surface },
              ]}
              onPress={() => setSelectedClientId(c.id)}
            >
              <View style={[styles.avatar, { backgroundColor: "#C9A84C22" }]}>
                <Text style={{ color: "#C9A84C", fontWeight: "700", fontSize: 14 }}>
                  {c.name?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{c.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{c.phone ?? c.email ?? ""}</Text>
              </View>
              {selectedClientId === c.id && (
                <IconSymbol name="checkmark.circle.fill" size={20} color="#C9A84C" />
              )}
            </Pressable>
          ))}

          {/* Selecionar Barbeiro */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Barbeiro Responsável</Text>
          {(barbersQuery.data ?? []).map((b: any) => (
            <Pressable
              key={b.id}
              style={[
                styles.clientRow,
                { borderColor: selectedBarberId === b.id ? "#C9A84C" : colors.border, backgroundColor: colors.surface },
              ]}
              onPress={() => setSelectedBarberId(b.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{b.name}</Text>
              </View>
              {selectedBarberId === b.id && (
                <IconSymbol name="checkmark.circle.fill" size={20} color="#C9A84C" />
              )}
            </Pressable>
          ))}

          {/* Botão próximo */}
          <Pressable
            style={[styles.nextBtn, { opacity: selectedPlanId && selectedClientId ? 1 : 0.4 }]}
            disabled={!selectedPlanId || !selectedClientId}
            onPress={() => setStep("items")}
          >
            <Text style={styles.nextBtnText}>Próximo: Serviços e Produtos</Text>
            <IconSymbol name="chevron.right" size={18} color="#0A0A0A" />
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── STEP: Serviços e Produtos ────────────────────────────────────────────

  if (step === "items") {
    const services = (planDetail?.services ?? []) as any[];
    const products = (planDetail?.products ?? []) as any[];
    const maxSvc = planDetail?.maxServices ?? 999;
    const maxPrd = planDetail?.maxProducts ?? 999;

    return (
      <ScreenContainer>
        <AdminHeader
          title="Serviços e Produtos"
          rightElement={
            <TouchableOpacity style={{ padding: 8 }} onPress={() => setStep("plan")}>
              <IconSymbol name="chevron.left" size={22} color="#C9A84C" />
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          <StepIndicator current={2} total={4} />

          {/* Serviços */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Serviços ({selectedServiceIds.length}/{maxSvc === 999 ? "todos" : maxSvc})
          </Text>
          {services.length === 0 ? (
            <Text style={{ color: colors.muted, marginBottom: 16 }}>Nenhum serviço neste plano.</Text>
          ) : (
            services.map((svc: any) => {
              const selected = selectedServiceIds.includes(svc.serviceId ?? svc.id);
              const disabled = !selected && selectedServiceIds.length >= maxSvc;
              return (
                <Pressable
                  key={svc.serviceId ?? svc.id}
                  style={[
                    styles.itemRow,
                    { borderColor: selected ? "#C9A84C" : colors.border, backgroundColor: colors.surface, opacity: disabled ? 0.4 : 1 },
                  ]}
                  onPress={() => !disabled && toggleService(svc.serviceId ?? svc.id)}
                >
                  <View style={[styles.checkbox, { borderColor: selected ? "#C9A84C" : colors.border, backgroundColor: selected ? "#C9A84C" : "transparent" }]}>
                    {selected && <IconSymbol name="checkmark" size={12} color="#0A0A0A" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600" }}>{svc.serviceName ?? svc.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>R$ {Number(svc.servicePrice ?? svc.price ?? 0).toFixed(2)}</Text>
                  </View>
                </Pressable>
              );
            })
          )}

          {/* Produtos */}
          {products.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>
                Produtos ({selectedProductIds.length}/{maxPrd === 999 ? "todos" : maxPrd})
              </Text>
              {products.map((prd: any) => {
                const selected = selectedProductIds.includes(prd.productId ?? prd.id);
                const disabled = !selected && selectedProductIds.length >= maxPrd;
                return (
                  <Pressable
                    key={prd.productId ?? prd.id}
                    style={[
                      styles.itemRow,
                      { borderColor: selected ? "#C9A84C" : colors.border, backgroundColor: colors.surface, opacity: disabled ? 0.4 : 1 },
                    ]}
                    onPress={() => !disabled && toggleProduct(prd.productId ?? prd.id)}
                  >
                    <View style={[styles.checkbox, { borderColor: selected ? "#C9A84C" : colors.border, backgroundColor: selected ? "#C9A84C" : "transparent" }]}>
                      {selected && <IconSymbol name="checkmark" size={12} color="#0A0A0A" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600" }}>{prd.productName ?? prd.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>R$ {Number(prd.productPrice ?? prd.price ?? 0).toFixed(2)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}

          <Pressable
            style={[styles.nextBtn, { opacity: selectedServiceIds.length > 0 ? 1 : 0.4 }]}
            disabled={selectedServiceIds.length === 0}
            onPress={() => { initSlots(); setStep("schedule"); }}
          >
            <Text style={styles.nextBtnText}>Próximo: Horários</Text>
            <IconSymbol name="chevron.right" size={18} color="#0A0A0A" />
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── STEP: Horários ───────────────────────────────────────────────────────

  if (step === "schedule") {
    const today = formatDate(new Date());

    return (
      <ScreenContainer>
        <AdminHeader
          title="Definir Horários"
          rightElement={
            <TouchableOpacity style={{ padding: 8 }} onPress={() => setStep("items")}>
              <IconSymbol name="chevron.left" size={22} color="#C9A84C" />
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          <StepIndicator current={3} total={4} />

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Defina os {planDetail?.recurrences ?? 1} horários do mês
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 16 }}>
            Escolha a data do 1º agendamento — os demais serão preenchidos automaticamente (semanal). Você pode ajustar individualmente.
          </Text>

          {slots.map((slot, index) => {
            const slotMonth = calendarMonths[index] ?? new Date();
            const year = slotMonth.getFullYear();
            const month = slotMonth.getMonth();
            const cells = daysInMonth(year, month);
            return (
            <View key={index} style={[styles.slotCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View style={styles.slotBadge}>
                  <Text style={styles.slotBadgeText}>{index + 1}º</Text>
                </View>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>
                  Agendamento {index + 1}
                </Text>
              </View>

              {/* Calendário inline */}
              <View style={[styles.miniCalendar, { borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Pressable onPress={() => setCalendarMonths((prev) => { const u = [...prev]; u[index] = new Date(year, month - 1, 1); return u; })}>
                    <IconSymbol name="chevron.left" size={18} color="#C9A84C" />
                  </Pressable>
                  <Text style={{ color: colors.foreground, fontWeight: "700" }}>
                    {MONTHS_PT[month]} {year}
                  </Text>
                  <Pressable onPress={() => setCalendarMonths((prev) => { const u = [...prev]; u[index] = new Date(year, month + 1, 1); return u; })}>
                    <IconSymbol name="chevron.right" size={18} color="#C9A84C" />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", marginBottom: 4 }}>
                  {DAYS_PT.map((d) => (
                    <Text key={d} style={{ flex: 1, textAlign: "center", color: colors.muted, fontSize: 10, fontWeight: "700" }}>{d}</Text>
                  ))}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {cells.map((day, ci) => {
                    if (!day) return <View key={ci} style={{ width: "14.28%", height: 32 }} />;
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isSelected = slot.date === dateStr;
                    const isPast = dateStr < today;
                    return (
                      <Pressable
                        key={ci}
                        style={[
                          styles.miniDay,
                          isSelected && { backgroundColor: "#C9A84C" },
                          isPast && { opacity: 0.3 },
                        ]}
                        onPress={() => !isPast && updateSlot(index, "date", dateStr)}
                        disabled={isPast}
                      >
                        <Text style={{ fontSize: 12, color: isSelected ? "#0A0A0A" : colors.foreground, fontWeight: isSelected ? "700" : "400" }}>
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Horários */}
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10, marginBottom: 6 }}>Horário</Text>
              {getTimeSlots(slot.date).length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontStyle: "italic", marginTop: 4 }}>
                  {workingHoursQuery.isLoading
                    ? "Carregando horários..."
                    : "Nenhum horário disponível nesta data. Selecione outro dia."}
                </Text>
              ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                  {getTimeSlots(slot.date).map((t) => {
                    const isSelected = slot.time === t;
                    const usedInOtherSlot = slots.some((s, i) => i !== index && s.date === slot.date && s.time === t);
                    return (
                      <Pressable
                        key={t}
                        style={[
                          styles.timeChip,
                          isSelected && { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
                          usedInOtherSlot && !isSelected && { backgroundColor: "#2A1A1A", borderColor: "#5A2A2A", opacity: 0.6 },
                          { borderColor: colors.border },
                        ]}
                        onPress={() => {
                          if (usedInOtherSlot) {
                            Alert.alert("Horário duplicado", "Este horário já foi escolhido para outra sessão deste plano.");
                            return;
                          }
                          updateSlot(index, "time", t);
                        }}
                      >
                        <Text style={{ fontSize: 13, color: isSelected ? "#0A0A0A" : usedInOtherSlot ? "#884444" : colors.foreground, fontWeight: "600" }}>{t}</Text>
                        {usedInOtherSlot && <Text style={{ fontSize: 9, color: "#884444", marginTop: 1 }}>já usado</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              )}
            </View>
            );
          })}

          <Pressable
            style={styles.nextBtn}
            onPress={() => setStep("payment")}
          >
            <Text style={styles.nextBtnText}>Próximo: Pagamento</Text>
            <IconSymbol name="chevron.right" size={18} color="#0A0A0A" />
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── STEP: Pagamento ──────────────────────────────────────────────────────

  if (step === "payment") {
    return (
      <ScreenContainer>
        <AdminHeader
          title="Forma de Pagamento"
          rightElement={
            <TouchableOpacity style={{ padding: 8 }} onPress={() => setStep("schedule")}>
              <IconSymbol name="chevron.left" size={22} color="#C9A84C" />
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          <StepIndicator current={4} total={4} />

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Como o cliente vai pagar?</Text>

          {(["cash", "pix", "debit_card", "credit_card"] as const).map((method) => (
            <Pressable
              key={method}
              style={[
                styles.clientRow,
                { borderColor: paymentMethod === method ? "#C9A84C" : colors.border, backgroundColor: colors.surface },
              ]}
              onPress={() => setPaymentMethod(method)}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{PAYMENT_LABELS[method]}</Text>
                {method === "credit_card" && (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    O cliente será informado sobre a renovação automática mensal.
                  </Text>
                )}
              </View>
              {paymentMethod === method && (
                <IconSymbol name="checkmark.circle.fill" size={20} color="#C9A84C" />
              )}
            </Pressable>
          ))}

          {/* Renovação automática */}
          <View style={[styles.clientRow, { borderColor: colors.border, backgroundColor: colors.surface, marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>Renovação automática</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Enviar lembrete de renovação 3 dias antes do vencimento.
              </Text>
            </View>
            <Pressable
              style={[styles.toggle, { backgroundColor: autoRenew ? "#C9A84C" : colors.border }]}
              onPress={() => setAutoRenew((v) => !v)}
            >
              <View style={[styles.toggleThumb, { marginLeft: autoRenew ? 18 : 2 }]} />
            </Pressable>
          </View>

          {/* Resumo */}
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: "#C9A84C33" }]}>
            <Text style={{ color: "#C9A84C", fontWeight: "700", fontSize: 14, marginBottom: 8 }}>Resumo da Assinatura</Text>
            <SummaryRow label="Plano" value={planDetail?.name ?? ""} colors={colors} />
            <SummaryRow label="Cliente" value={(clientsQuery.data as any[])?.find((c: any) => c.id === selectedClientId)?.name ?? ""} colors={colors} />
            <SummaryRow label="Agendamentos" value={`${slots.length}x no mês`} colors={colors} />
            <SummaryRow label="Pagamento" value={PAYMENT_LABELS[paymentMethod]} colors={colors} />
            <SummaryRow label="Valor" value={`R$ ${Number(planDetail?.price ?? 0).toFixed(2)}`} colors={colors} bold />
          </View>

          <Pressable
            style={[styles.nextBtn, { opacity: (createMutation.isPending || createMutation.isSuccess) ? 0.6 : 1 }]}
            disabled={createMutation.isPending || createMutation.isSuccess}
            onPress={handleConfirm}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <IconSymbol name="checkmark.circle.fill" size={18} color="#0A0A0A" />
                <Text style={styles.nextBtnText}>Confirmar Assinatura</Text>
              </>
            )}
          </Pressable>

          {createMutation.isError && (
            <Text style={{ color: "#F44336", textAlign: "center", marginTop: 12, fontSize: 13 }}>
              {createMutation.error?.message ?? "Erro ao criar assinatura."}
            </Text>
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  return null;
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i < current ? "#C9A84C" : "#2A2A2A",
          }}
        />
      ))}
    </View>
  );
}

function SummaryRow({ label, value, colors, bold }: { label: string; value: string; colors: any; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: bold ? "700" : "500" }}>{value}</Text>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  sectionTitle: { fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  planCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  clientRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 10 },
  searchBox: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#C9A84C", paddingVertical: 14, borderRadius: 14, marginTop: 24 },
  nextBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 15 },
  itemRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  slotCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  slotBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#C9A84C", alignItems: "center", justifyContent: "center", marginRight: 8 },
  slotBadgeText: { color: "#0A0A0A", fontWeight: "700", fontSize: 12 },
  miniCalendar: { borderRadius: 10, borderWidth: 1, padding: 10 },
  miniDay: { width: "14.28%", height: 32, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  timeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, backgroundColor: c.background },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 16 },
  toggle: { width: 42, height: 24, borderRadius: 12, justifyContent: "center" },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  emptyBox: { borderWidth: 1, borderRadius: 12, padding: 20, alignItems: "center", marginBottom: 16 },
});
}
