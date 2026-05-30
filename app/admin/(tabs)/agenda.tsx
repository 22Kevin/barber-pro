import { useState, useCallback, useEffect, useRef } from "react";
import { hapticSuccess, hapticError, hapticMedium, hapticLight } from "@/lib/haptics";
import { toast } from "@/components/toast";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBarberAuth } from "@/lib/auth-context";
import { AdminHeader } from "@/components/admin-header";
import { SwipeableAppointmentCard } from "@/components/swipeable-appointment-card";
import { PaymentStatusModal } from "@/components/payment-status-modal";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { trpc } from "@/lib/trpc";
import { scheduleAppointmentReminder, cancelAppointmentReminder, clearAppBadge } from "@/lib/use-notifications";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:        { label: "Agendado",          color: "#C9A84C" },
  confirmed:        { label: "Confirmado",        color: "#4CAF50" },
  in_progress:      { label: "Em andamento",      color: "#2196F3" },
  completed:        { label: "Concluído",         color: "#888880" },
  cancelled:        { label: "Cancelado",         color: "#F44336" },
  no_show:          { label: "Não compareceu",   color: "#FF9800" },
  pending_approval: { label: "⏳ Aguarda aprovação", color: "#FF6B35" },
};

function dateToString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Gera slots de horário respeitando:
 * - Intervalo de almoço do barbeiro
 * - Horários já passados (quando a data é hoje)
 */
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

export default function AgendaScreen() {
  const { barber } = useBarberAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ openAppointmentId?: string; highlightApproval?: string }>();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(colors);

  // Zera o badge do ícone do app ao abrir a tela de agenda
  useEffect(() => {
    clearAppBadge().catch(() => null);
  }, []);

  // Controla se o modal de detalhes deve destacar os botões de aprovação
  const [highlightApproval, setHighlightApproval] = useState(false);

  // Query para buscar agendamento por ID (usado ao navegar via notificação)
  const openApptId = params.openAppointmentId ? Number(params.openAppointmentId) : null;
  const openApptQuery = trpc.appointments.byId.useQuery(
    { id: openApptId ?? 0 },
    { enabled: !!openApptId }
  );

  // Quando o agendamento é carregado via notificação, navega para a data e abre o modal
  useEffect(() => {
    if (!openApptQuery.data || !openApptId) return;
    const apt = openApptQuery.data;
    // Navega para a data do agendamento
    if (apt.date) {
      const [y, m, d] = (apt.date as string).split('-').map(Number);
      setSelectedDate(new Date(y, m - 1, d));
      setCurrentMonth(new Date(y, m - 1, d));
    }
    // Monta o objeto de agendamento para o modal
    setSelectedAppointment(apt);
    setEditServices([]);
    setHighlightApproval(params.highlightApproval === '1');
    setShowDetailModal(true);
  }, [openApptQuery.data, openApptId]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAppointment, setPaymentAppointment] = useState<any>(null);
  // Mapa de status de pagamento por appointmentId (true = pendente)
  const [paymentPendingMap, setPaymentPendingMap] = useState<Record<number, boolean>>({});

  // Form state
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(barber);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  // Serviço principal (compat com APIs que esperam serviceId único)
  const selectedService = selectedServices[0] ?? null;
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelApptId, setCancelApptId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  // Filtro de barbeiro para managers (null = todos)
  const [filterBarberId, setFilterBarberId] = useState<number | null>(null);
  const isManager = barber?.role === "super_admin" || barber?.role === "receptionist";

  // Estado de edição de serviços no modal de detalhes
  const [editServices, setEditServices] = useState<any[]>([]);
  const editTotalDuration = useMemo(
    () => editServices.reduce((sum, s) => sum + (s.durationMinutes ?? 30), 0),
    [editServices]
  );
  const editTotalPrice = useMemo(
    () => editServices.reduce((sum, s) => sum + parseFloat(s.price ?? "0"), 0),
    [editServices]
  );

  const dateStr = dateToString(selectedDate);
  const utils = trpc.useUtils();

  const tenantId = barber?.tenantId ?? undefined;
  const barbersQuery = trpc.barbers.list.useQuery({ tenantId });
  const clientsQuery = trpc.clients.list.useQuery({ tenantId });
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true, tenantId });

  // ── Busca o mês inteiro de uma vez — sem query por dia ──────────────────────
  const monthStart = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = (() => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Barbeiro individual: byDateRange do mês
  const appointmentsByMonthQuery = trpc.appointments.byDateRange.useQuery(
    { barberId: barber?.id ?? 0, startDate: monthStart, endDate: monthEnd },
    { enabled: !!barber?.id && !isManager, staleTime: 0 }
  );
  // Manager: allByDateRange do mês
  const allAppointmentsByMonthQuery = trpc.appointments.allByDateRange.useQuery(
    { startDate: monthStart, endDate: monthEnd, tenantId },
    { enabled: isManager, staleTime: 0 }
  );

  // Filtrar localmente pelo dia selecionado (sem nova requisição)
  const appointmentsQuery = useMemo(() => {
    const data = (appointmentsByMonthQuery.data ?? []).filter((a: any) => a.date === dateStr);
    return { data, isLoading: appointmentsByMonthQuery.isLoading, refetch: appointmentsByMonthQuery.refetch };
  }, [appointmentsByMonthQuery.data, appointmentsByMonthQuery.isLoading, appointmentsByMonthQuery.refetch, dateStr]);

  const allAppointmentsQuery = useMemo(() => {
    const data = (allAppointmentsByMonthQuery.data ?? []).filter((a: any) => a.date === dateStr);
    return { data, isLoading: allAppointmentsByMonthQuery.isLoading, refetch: allAppointmentsByMonthQuery.refetch };
  }, [allAppointmentsByMonthQuery.data, allAppointmentsByMonthQuery.isLoading, allAppointmentsByMonthQuery.refetch, dateStr]);

  const workingHoursQuery = trpc.barbers.workingHours.get.useQuery(
    { barberId: barber?.id ?? 0 },
    { enabled: !!barber?.id }
  );

  // Datas com agendamentos — derivar do cache mensal (sem query extra)
  const datesWithAppt = useMemo(() => {
    const all = isManager
      ? (allAppointmentsByMonthQuery.data ?? [])
      : (appointmentsByMonthQuery.data ?? []);
    return new Set(all.map((a: any) => a.date));
  }, [isManager, allAppointmentsByMonthQuery.data, appointmentsByMonthQuery.data]);

  // Manter compatibilidade com código que usa datesWithApptQuery
  const datesWithApptQuery = { data: Array.from(datesWithAppt) };

  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: async (result: any) => {
      hapticSuccess();
      // Invalidar E buscar imediatamente — não aguarda re-render
      await Promise.all([
        utils.appointments.byDateRange.invalidate(),
        utils.appointments.allByDateRange.invalidate(),
        utils.dashboard.stats.invalidate(),
      ]);
      // Refetch explícito para garantir atualização imediata na UI
      await Promise.all([
        appointmentsByMonthQuery.refetch(),
        allAppointmentsByMonthQuery.refetch(),
      ]);

      const apptId = result?.apptId ?? result;

      // Agenda notificação push 1 hora antes (se o cliente tiver o app instalado)
      if (selectedServices.length > 0 && selectedTime) {
        const [hours, minutes] = selectedTime.split(":").map(Number);
        const appointmentDateTime = new Date(selectedDate);
        appointmentDateTime.setHours(hours, minutes, 0, 0);
        const serviceNames = selectedServices.map((s) => s.name).join(" + ");
        scheduleAppointmentReminder(
          typeof apptId === "number" ? apptId : Number(apptId),
          serviceNames,
          barber?.name ?? "Barbeiro",
          appointmentDateTime
        ).catch(() => null);
      }

      closeNewModal();
      const clientName = clients.find((c: any) => c.id === selectedClientId)?.name ?? "Cliente";
      const serviceNames = selectedServices.map((s: any) => s.name).join(", ");
      toast.confirm(
        "Agendamento confirmado! ✓",
        `${clientName} · ${selectedTime} · ${serviceNames}`
      );      if (result?.requiresApproval) {
        // Agendamento ultrapassa horário de fechamento — informa o barbeiro
        const endHHMM = addMinutes(selectedTime, totalDuration).substring(0, 5);
        const closeHHMM = (result.closingTime ?? "").substring(0, 5);
        const extra = result.overtimeMinutes ?? 0;
        const extraH = Math.floor(extra / 60);
        const extraM = extra % 60;
        const extraStr = extraH > 0 ? `${extraH}h${extraM > 0 ? extraM + "min" : ""}` : `${extraM}min`;
        Alert.alert(
          "⚠️ Agendamento aguarda aprovação",
          `Este agendamento termina às ${endHHMM}, ou seja ${extraStr} após o horário de fechamento (${closeHHMM}).\n\nO agendamento foi criado com status "Aguarda aprovação". Você pode aprovar ou recusar na tela de detalhes.`,
          [{ text: "Entendido" }]
        );
      } else {
        // Agendamento criado normalmente — toast já foi exibido acima
      }
    },
    onError: (e) => { hapticError(); Alert.alert("Erro", e.message); },
  });

  const approveMutation = trpc.appointments.approveOvertime.useMutation({
    onSuccess: (_data: unknown, variables: any) => {
      utils.appointments.byDateRange.invalidate(); utils.appointments.allByDateRange.invalidate();
      utils.dashboard.stats.invalidate();
      setShowDetailModal(false);
      Alert.alert(
        variables.approve ? "✅ Aprovado" : "❌ Recusado",
        variables.approve
          ? "Agendamento confirmado! O cliente será notificado."
          : "Agendamento cancelado. O cliente será notificado."
      );
    },
    onError: (e) => { hapticError(); Alert.alert("Erro", e.message); },
  });

  const updateMutation = trpc.appointments.update.useMutation({
    onSuccess: (_data: unknown, variables: any) => {
      if (variables.status === "cancelled" || variables.status === "no_show") {
        cancelAppointmentReminder(variables.id).catch(() => null);
      }
      utils.appointments.byDateRange.invalidate(); utils.appointments.allByDateRange.invalidate();
      utils.dashboard.stats.invalidate();
      setShowDetailModal(false);
    },
    onError: (e) => { hapticError(); Alert.alert("Erro", e.message); },
  });
  const cancelWithReasonMutation = trpc.appointments.cancelWithReason.useMutation({
    onSuccess: () => {
      utils.appointments.byDateRange.invalidate(); utils.appointments.allByDateRange.invalidate();
      utils.dashboard.stats.invalidate();
      setShowCancelModal(false);
      setCancelReason("");
      setCancelApptId(null);
    },
    onError: (e) => { hapticError(); Alert.alert("Erro", e.message); },
  });
  function handleCancelWithReason(id: number) {
    setCancelApptId(id);
    setCancelReason("");
    setShowCancelModal(true);
  }
  function confirmCancelWithReason() {
    if (!cancelApptId) return;
    cancelWithReasonMutation.mutate({ id: cancelApptId, reason: cancelReason || undefined });
    cancelAppointmentReminder(cancelApptId).catch(() => null);
  }

  // Calcular duração total e preço total somando todos os serviços selecionados
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (s.durationMinutes ?? 30), 0),
    [selectedServices]
  );
  const totalServicePrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + parseFloat(s.price ?? "0"), 0),
    [selectedServices]
  );

  // Limpar o horário selecionado quando a duração total muda (serviços adicionados/removidos)
  // Evita usar um endTime calculado para duração menor
  useEffect(() => {
    setSelectedTime("");
  }, [totalDuration]);

  function closeNewModal() {
    setShowNewModal(false);
    setSelectedClient(null); setSelectedServices([]); setSelectedTime(""); setNotes(""); setClientSearch("");
  }

  function handleCreateAppointment() {
    if (!selectedClient) { Alert.alert("Atenção", "Selecione um cliente."); return; }
    if (selectedServices.length === 0) { Alert.alert("Atenção", "Selecione ao menos um serviço."); return; }
    if (!selectedTime) { Alert.alert("Atenção", "Selecione um horário."); return; }
    const endTime = addMinutes(selectedTime, totalDuration);
    // Monta string de nomes de serviços para exibir no card da agenda
    const serviceNamesStr = selectedServices.length > 1
      ? selectedServices.map((s: any) => s.name).join(" + ")
      : undefined;
    createMutation.mutate({
      clientId: selectedClient.id,
      barberId: barber?.id ?? 0,
      serviceId: selectedService!.id, // serviço principal
      serviceNames: serviceNamesStr,
      date: dateStr,
      startTime: selectedTime,
      endTime,
      notes: notes || null,
      status: "scheduled",
    });
  }

  function handleStatusChange(id: number, status: string) {
    if (status === "completed") {
      Alert.alert("Alterar Status", `Mudar para "${STATUS_CONFIG[status]?.label}"?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => {
            updateMutation.mutate({ id, status: status as any }, {
              onSuccess: () => {
                const allApts = [
                  ...(appointmentsQuery.data ?? []),
                  ...(allAppointmentsQuery.data ?? []),
                ];
                const apt = allApts.find((a: any) => a.id === id);
                if (apt) {
                  const service = (servicesQuery.data ?? []).find((s: any) => s.id === apt.serviceId);
                  const client = (clientsQuery.data ?? []).find((c: any) => c.id === apt.clientId);
                  // Calcular preço — tentar service.price, depois apt.servicePrice, depois 0
                  const rawPrice = service?.price ?? apt.servicePrice ?? "0";
                  const numericPrice = parseFloat(String(rawPrice));
                  const safePrice = isNaN(numericPrice) ? "0" : String(numericPrice);
                  setPaymentAppointment({
                    ...apt,
                    clientName: client?.name ?? apt.clientName,
                    clientPhone: client?.phone ?? apt.clientPhone,
                    serviceName: service?.name ?? apt.serviceName ?? apt.serviceNames ?? "Serviço",
                    servicePrice: safePrice,
                    serviceId: apt.serviceId ?? service?.id ?? 0,
                  });
                  setShowDetailModal(false);
                  setShowPaymentModal(true);
                  setPaymentPendingMap(prev => ({ ...prev, [id]: true }));
                }
              },
            });
          },
        },
      ]);
      return;
    }
    Alert.alert("Alterar Status", `Mudar para "${STATUS_CONFIG[status]?.label}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", onPress: () => updateMutation.mutate({ id, status: status as any }) },
    ]);
  }

  function handleAppointmentCompleted(apt: any) {
    const client = (clientsQuery.data ?? []).find(c => c.id === apt.clientId);
    const service = (servicesQuery.data ?? []).find(s => s.id === apt.serviceId);
    setPaymentAppointment({
      ...apt,
      clientName: client?.name,
      clientPhone: client?.phone,
      serviceName: service?.name ?? "Serviço",
      servicePrice: service?.price ?? "0",
      serviceId: apt.serviceId,
    });
    setShowPaymentModal(true);
    // Marca como pendente até confirmar
    setPaymentPendingMap(prev => ({ ...prev, [apt.id]: true }));
  }

  // Calendar
  const daysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysCount; d++) days.push(new Date(year, month, d));
    return days;
  };

  const isToday = (d: Date) => dateToString(d) === dateToString(new Date());
  const isSelected = (d: Date) => dateToString(d) === dateStr;

  const workingDay = workingHoursQuery.data?.find(wh => wh.dayOfWeek === selectedDate.getDay());
  const timeSlots = workingDay?.isWorking
    ? generateTimeSlots(
        workingDay.startTime,
        workingDay.endTime,
        30,
        workingDay.lunchStart ?? null,
        workingDay.lunchEnd ?? null,
        dateStr,
      )
    : [];

  const bookedTimes = new Set(
    (appointmentsQuery.data ?? [])
      .filter(a => a.status !== "cancelled" && a.status !== "no_show")
      .map(a => a.startTime)
  );

  const filteredClients = (clientsQuery.data ?? []).filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  // Para managers: usa allByDate e aplica filtro de barbeiro; para barbeiros: usa byDate
  const rawAppointments = isManager
    ? (allAppointmentsQuery.data ?? [])
    : (appointmentsQuery.data ?? []);
  const [apptSearch, setApptSearch] = useState("");
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  // Filtro de barbeiro específico para a Linha do Tempo
  const [timelineFilterBarberId, setTimelineFilterBarberId] = useState<number | null>(null);
  // Ref para o ScrollView principal (scroll automático para horário atual)
  const mainScrollRef = useRef<ScrollView>(null);
  // Horário atual para indicador na timeline
  const [currentTime, setCurrentTime] = useState(new Date());
  // Atualiza o horário atual a cada minuto
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
  // Scroll automático para o horário atual quando a timeline é ativada
  useEffect(() => {
    if (viewMode !== 'timeline') return;
    const now = new Date();
    const isToday = dateToString(selectedDate) === dateToString(now);
    if (!isToday) return;
    // Calcular posição do slot atual (cada slot tem ~40px de altura mínima)
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = 7 * 60; // 07:00
    const slotIndex = Math.max(0, Math.floor((nowMinutes - startMinutes) / 30) - 1);
    const estimatedY = slotIndex * 42 + 200; // ~42px por slot + offset do calendário
    setTimeout(() => {
      mainScrollRef.current?.scrollTo({ y: estimatedY, animated: true });
    }, 300);
  }, [viewMode, selectedDate]);
  const filteredByBarber = isManager && filterBarberId !== null
    ? rawAppointments.filter((a: any) => a.barberId === filterBarberId)
    : rawAppointments;
  const appointments = apptSearch.trim()
    ? filteredByBarber.filter((a: any) => {
        const clientsData = clientsQuery.data ?? [];
        const client = clientsData.find((c: any) => c.id === a.clientId);
        const name = (client?.name ?? "").toLowerCase();
        const phone = client?.phone ?? "";
        const q = apptSearch.toLowerCase();
        return name.includes(q) || phone.includes(apptSearch);
      })
    : filteredByBarber;
  const isLoadingAppointments = isManager ? allAppointmentsQuery.isLoading : appointmentsQuery.isLoading;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader
        title="Agenda"
        rightElement={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={({ pressed }) => [styles.addBtn, { backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#C9A84C" }, pressed && { opacity: 0.8 }]}
              onPress={() => router.push("/admin/subscription-plans" as any)}
            >
              <IconSymbol name="star.fill" size={14} color="#C9A84C" />
              <Text style={[styles.addBtnText, { color: "#C9A84C" }]}>Plano</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.addBtn, { backgroundColor: "#C9A84C" }, pressed && { opacity: 0.8 }]}
              onPress={() => setShowNewModal(true)}
            >
              <IconSymbol name="plus" size={20} color="#0A0A0A" />
              <Text style={[styles.addBtnText, { color: "#0A0A0A" }]}>+ Novo</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView ref={mainScrollRef} showsVerticalScrollIndicator={false}>

        {/* Calendário */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
              <IconSymbol name="chevron.left" size={22} color="#C9A84C" />
            </Pressable>
            <Text style={styles.calendarTitle}>
              {MONTHS_PT[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>
            <Pressable onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
              <IconSymbol name="chevron.right" size={22} color="#C9A84C" />
            </Pressable>
          </View>

          <View style={styles.daysRow}>
            {DAYS_PT.map(d => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
          </View>

          <View style={styles.daysGrid}>
            {daysInMonth().map((day, idx) => {
              const dayStr = day ? dateToString(day) : null;
              const hasAppt = dayStr ? datesWithAppt.has(dayStr) : false;
              return (
                <Pressable
                  key={idx}
                  style={[
                    styles.dayCell,
                    day && isSelected(day) && styles.dayCellSelected,
                    day && isToday(day) && !isSelected(day) && styles.dayCellToday,
                  ]}
                  onPress={() => day && setSelectedDate(day)}
                  disabled={!day}
                >
                  {day ? (
                    <>
                      <Text style={[
                        styles.dayText,
                        isSelected(day) && styles.dayTextSelected,
                        isToday(day) && !isSelected(day) && styles.dayTextToday,
                      ]}>
                        {day.getDate()}
                      </Text>
                      {hasAppt && (
                        <View style={[
                          styles.dayDot,
                          isSelected(day) && { backgroundColor: '#0A0A0A' },
                        ]} />
                      )}
                    </>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Filtro de barbeiro (apenas para managers) */}
        {isManager && (barbersQuery.data ?? []).length > 1 && (
          <View style={styles.barberFilterWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barberFilterScroll}>
              <Pressable
                style={[styles.barberFilterChip, filterBarberId === null && styles.barberFilterChipActive]}
                onPress={() => setFilterBarberId(null)}
              >
                <Text style={[styles.barberFilterChipText, filterBarberId === null && styles.barberFilterChipTextActive]}>
                  Todos
                </Text>
              </Pressable>
              {(barbersQuery.data ?? []).map((b: any) => (
                <Pressable
                  key={b.id}
                  style={[styles.barberFilterChip, filterBarberId === b.id && styles.barberFilterChipActive]}
                  onPress={() => setFilterBarberId(filterBarberId === b.id ? null : b.id)}
                >
                  <Text style={[styles.barberFilterChipText, filterBarberId === b.id && styles.barberFilterChipTextActive]}>
                    {b.name.split(" ")[0]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Campo de busca por cliente */}
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#141414", borderRadius: 10, borderWidth: 1, borderColor: apptSearch ? "#C9A84C" : "#2A2A2A", paddingHorizontal: 12, gap: 8 }}>
            <IconSymbol name="magnifyingglass" size={16} color={apptSearch ? "#C9A84C" : "#555"} />
            <TextInput
              style={{ flex: 1, color: "#F5F5F0", fontSize: 14, paddingVertical: 10 }}
              value={apptSearch}
              onChangeText={setApptSearch}
              placeholder="Buscar por nome ou telefone..."
              placeholderTextColor="#555"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {apptSearch.length > 0 && (
              <Pressable onPress={() => setApptSearch("")} style={{ padding: 4 }}>
                <IconSymbol name="xmark" size={14} color="#888880" />
              </Pressable>
            )}
          </View>
        </View>
        {/* Agendamentos do dia */}
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              {DAYS_PT[selectedDate.getDay()]}, {selectedDate.getDate()} de {MONTHS_PT[selectedDate.getMonth()]}
            </Text>
            <Text style={styles.sectionCount}>{appointments.length} agendamento(s)</Text>
          </View>
        </View>
        {/* Toggle Cards / Linha do Tempo */}
        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={({ pressed }) => [styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive, pressed && { opacity: 0.8 }]}
              onPress={() => setViewMode('list')}
            >
              <IconSymbol name="list.bullet" size={14} color={viewMode === 'list' ? '#0A0A0A' : '#C9A84C'} />
              <Text style={[styles.viewToggleBtnText, viewMode === 'list' ? { color: '#0A0A0A' } : { color: '#C9A84C' }]}>Cards</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.viewToggleBtn, viewMode === 'timeline' && styles.viewToggleBtnActive, pressed && { opacity: 0.8 }]}
              onPress={() => setViewMode('timeline')}
            >
              <IconSymbol name="list.bullet.rectangle" size={14} color={viewMode === 'timeline' ? '#0A0A0A' : '#C9A84C'} />
              <Text style={[styles.viewToggleBtnText, viewMode === 'timeline' ? { color: '#0A0A0A' } : { color: '#C9A84C' }]}>Linha do Tempo</Text>
            </Pressable>
          </View>
        </View>

        {isLoadingAppointments ? (
          <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
        ) : appointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <IconSymbol name="calendar" size={36} color="#2A2A2A" />
            <Text style={styles.emptyText}>Nenhum agendamento neste dia</Text>
          </View>
        ) : viewMode === 'list' ? (
          <GestureHandlerRootView>
            {appointments.map((apt) => (
              <SwipeableAppointmentCard
                key={apt.id}
                appointment={apt}
                onPress={() => {
                  if (apt.status === "completed") {
                    const svc = (servicesQuery.data ?? []).find((s: any) => s.id === apt.serviceId);
                    const cli = (clientsQuery.data ?? []).find((c: any) => c.id === apt.clientId);
                    const rawPrice = svc?.price ?? apt.servicePrice ?? "0";
                    const numericPrice = parseFloat(String(rawPrice));
                    const safePrice = isNaN(numericPrice) ? "0" : String(numericPrice);
                    setPaymentAppointment({
                      ...apt,
                      clientName: cli?.name ?? apt.clientName,
                      clientPhone: cli?.phone ?? apt.clientPhone,
                      serviceName: svc?.name ?? apt.serviceName ?? apt.serviceNames ?? "Serviço",
                      servicePrice: safePrice,
                      serviceId: apt.serviceId ?? svc?.id ?? 0,
                    });
                    setShowPaymentModal(true);
                  } else {
                    setSelectedAppointment({ ...apt });
                    // Inicializa editServices com o serviço atual do agendamento
                    const currentService = (servicesQuery.data ?? []).find((s: any) => s.id === apt.serviceId);
                    setEditServices(currentService ? [currentService] : []);
                    setShowDetailModal(true);
                  }
                }}
                onStatusChange={handleStatusChange}
                onCompleted={handleAppointmentCompleted}
                onCancelWithReason={handleCancelWithReason}
                onResendPaymentLink={async (apptId) => {
                  try {
                    const tenantId = barber?.tenantId ?? 0;
                    const link = await utils.asaasPayments.getPaymentLink.fetch({ appointmentId: apptId, tenantId });
                    const phone = apt.clientPhone?.replace(/\D/g, "");
                    if (!phone) { Alert.alert("Atenção", "Cliente sem telefone cadastrado."); return; }
                    const url = link?.invoiceUrl ?? link?.pixCopyCola ?? null;
                    if (!url) { Alert.alert("Atenção", "Nenhum link de pagamento encontrado para este agendamento."); return; }
                    const msg = encodeURIComponent(`Olá ${apt.clientName}! Segue o link para pagamento do seu agendamento: ${url}`);
                    Linking.openURL(`https://wa.me/55${phone}?text=${msg}`);
                  } catch { Alert.alert("Erro", "Não foi possível buscar o link de pagamento."); }
                }}
                paymentPending={apt.status === "completed" ? (paymentPendingMap[apt.id] ?? true) : undefined}
              />
            ))}
          </GestureHandlerRootView>
        ) : (
          /* Vista de Timeline */
          <View style={styles.timelineContainer}>
            {/* Filtro de barbeiro na Linha do Tempo (apenas para managers) */}
            {isManager && (barbersQuery.data ?? []).length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12, paddingHorizontal: 4 }}>
                <Pressable
                  style={[styles.barberFilterChip, timelineFilterBarberId === null && styles.barberFilterChipActive]}
                  onPress={() => setTimelineFilterBarberId(null)}
                >
                  <Text style={[styles.barberFilterChipText, timelineFilterBarberId === null && styles.barberFilterChipTextActive]}>Todos</Text>
                </Pressable>
                {(barbersQuery.data ?? []).map((b: any) => (
                  <Pressable
                    key={b.id}
                    style={[styles.barberFilterChip, timelineFilterBarberId === b.id && styles.barberFilterChipActive]}
                    onPress={() => setTimelineFilterBarberId(timelineFilterBarberId === b.id ? null : b.id)}
                  >
                    <Text style={[styles.barberFilterChipText, timelineFilterBarberId === b.id && styles.barberFilterChipTextActive]}>{b.name.split(" ")[0]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {Array.from({ length: 31 }, (_, i) => {
              const totalMinutes = 7 * 60 + i * 30; // 07:00 a 22:00 em slots de 30min
              const slotH = Math.floor(totalMinutes / 60);
              const slotM = totalMinutes % 60;
              const slotLabel = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;
              // Verificar se o horário atual está neste slot
              const isToday = dateToString(selectedDate) === dateToString(new Date());
              const nowH = currentTime.getHours();
              const nowM = currentTime.getMinutes();
              const nowMinutesTotal = nowH * 60 + nowM;
              const slotEndMinutes = totalMinutes + 30;
              const isCurrentSlot = isToday && nowMinutesTotal >= totalMinutes && nowMinutesTotal < slotEndMinutes;
              // Posição relativa do indicador dentro do slot (0-100%)
              const indicatorOffset = isCurrentSlot ? ((nowMinutesTotal - totalMinutes) / 30) : 0;
              // Agendamentos que começam neste slot (HH:MM), com filtro de barbeiro na timeline
              const timelineAppts = isManager && timelineFilterBarberId !== null
                ? appointments.filter((a: any) => a.barberId === timelineFilterBarberId)
                : appointments;
              const slotAppts = timelineAppts.filter((a: any) => {
                const t = (a.startTime ?? "").substring(0, 5);
                return t === slotLabel;
              });
              return (
                <View key={slotLabel} style={styles.timelineRow}>
                  <Text style={[styles.timelineHour, isCurrentSlot && { color: '#F44336', fontWeight: '700' }]}>{slotLabel}</Text>
                  <View style={styles.timelineLineWrapper}>
                    <View style={styles.timelineLine} />
                    {isCurrentSlot && (
                      <View style={[styles.timelineNowIndicator, { top: `${indicatorOffset * 100}%` as any }]}>
                        <View style={styles.timelineNowDot} />
                        <View style={styles.timelineNowLine} />
                      </View>
                    )}
                  </View>
                  <View style={styles.timelineEvents}>
                    {slotAppts.map((apt: any) => {
                      const statusColor = STATUS_CONFIG[apt.status]?.color ?? "#888880";
                      // Calcular altura proporcional à duração
                      const [sh, sm] = (apt.startTime ?? "00:00").split(":").map(Number);
                      const [eh, em] = (apt.endTime ?? "00:30").split(":").map(Number);
                      const dur = Math.max((eh * 60 + em) - (sh * 60 + sm), 30);
                      const cardHeight = Math.max(dur * 1.6, 52);
                      return (
                        <Pressable
                          key={apt.id}
                          style={({ pressed }) => [styles.timelineCard, { borderLeftColor: statusColor, minHeight: cardHeight, opacity: pressed ? 0.8 : 1 }]}
                          onPress={() => {
                            if (apt.status === "completed") {
                              const svc = (servicesQuery.data ?? []).find((s: any) => s.id === apt.serviceId);
                              const cli = (clientsQuery.data ?? []).find((c: any) => c.id === apt.clientId);
                              const rawPrice = svc?.price ?? apt.servicePrice ?? "0";
                              const numericPrice = parseFloat(String(rawPrice));
                              const safePrice = isNaN(numericPrice) ? "0" : String(numericPrice);
                              setPaymentAppointment({ ...apt, clientName: cli?.name ?? apt.clientName, clientPhone: cli?.phone ?? apt.clientPhone, serviceName: svc?.name ?? apt.serviceName ?? apt.serviceNames ?? "Serviço", servicePrice: safePrice, serviceId: apt.serviceId ?? svc?.id ?? 0 });
                              setShowPaymentModal(true);
                            } else {
                              setSelectedAppointment({ ...apt });
                              const currentService = (servicesQuery.data ?? []).find((s: any) => s.id === apt.serviceId);
                              setEditServices(currentService ? [currentService] : []);
                              setShowDetailModal(true);
                            }
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <Text style={styles.timelineCardTime}>{apt.startTime?.substring(0, 5)} – {apt.endTime?.substring(0, 5)}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                              <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_CONFIG[apt.status]?.label ?? apt.status}</Text>
                            </View>
                          </View>
                          <Text style={styles.timelineCardClient} numberOfLines={1}>{apt.clientName ?? '—'}</Text>
                          <Text style={styles.timelineCardService} numberOfLines={1}>{apt.serviceNames ?? apt.serviceName ?? '—'}</Text>
                          {apt.barberName && isManager && (
                            <Text style={styles.timelineCardBarber} numberOfLines={1}>{apt.barberName}</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal Novo Agendamento */}
      <Modal visible={showNewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo Agendamento</Text>
                <Pressable onPress={closeNewModal}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Data</Text>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>{selectedDate.getDate()} de {MONTHS_PT[selectedDate.getMonth()]} de {selectedDate.getFullYear()}</Text>
                </View>

                <Text style={styles.fieldLabel}>Cliente *</Text>
                <Pressable style={styles.selectorBtn} onPress={() => setShowClientPicker(true)}>
                  <Text style={selectedClient ? styles.selectorText : styles.selectorPlaceholder}>
                    {selectedClient ? selectedClient.name : "Selecionar cliente..."}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="#888880" />
                </Pressable>

                <Text style={styles.fieldLabel}>Serviço{selectedServices.length > 1 ? "s" : ""} * <Text style={{ color: "#888880", fontWeight: "400", fontSize: 12 }}>(selecione um ou mais)</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: selectedServices.length > 0 ? 8 : 14 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(servicesQuery.data ?? []).map(s => {
                      const isChipSelected = selectedServices.some((sv) => sv.id === s.id);
                      return (
                        <Pressable
                          key={s.id}
                          style={[styles.serviceChip, isChipSelected && styles.serviceChipActive]}
                          onPress={() => setSelectedServices((prev) => {
                            const exists = prev.some((sv) => sv.id === s.id);
                            return exists ? prev.filter((sv) => sv.id !== s.id) : [...prev, s];
                          })}
                        >
                          <Text style={[styles.serviceChipText, isChipSelected && styles.serviceChipTextActive]}>{s.name}</Text>
                          <Text style={[styles.serviceChipPrice, isChipSelected && { color: "#C9A84C" }]}>
                            R$ {parseFloat(s.price).toFixed(2).replace(".", ",")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                {/* Resumo dos serviços selecionados */}
                {selectedServices.length > 0 && (
                  <View style={{ backgroundColor: "#1A1500", borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: "#C9A84C" }}>
                    {selectedServices.map((s, i) => (
                      <View key={s.id} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: i < selectedServices.length - 1 ? 3 : 0 }}>
                        <Text style={{ color: "#fff", fontSize: 13 }}>{s.name}</Text>
                        <Text style={{ color: "#888880", fontSize: 12 }}>{s.durationMinutes} min</Text>
                      </View>
                    ))}
                    <View style={{ borderTopWidth: 1, borderTopColor: "#3A3000", marginTop: 6, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "#C9A84C", fontWeight: "700", fontSize: 13 }}>Total</Text>
                      <Text style={{ color: "#C9A84C", fontWeight: "700", fontSize: 13 }}>{totalDuration} min · R$ {totalServicePrice.toFixed(2).replace(".", ",")}</Text>
                    </View>
                  </View>
                )}

                <Text style={styles.fieldLabel}>Horário *</Text>
                {!workingDay?.isWorking ? (
                  <View style={styles.infoBox}>
                    <Text style={[styles.infoText, { color: "#F44336" }]}>Barbeiro não trabalha neste dia</Text>
                  </View>
                ) : (
                  <View style={{ marginBottom: 14 }}>
                    {[
                      { label: "🌅 Manhã",  range: [6,  12] },
                      { label: "☀️ Tarde",  range: [12, 18] },
                      { label: "🌙 Noite",  range: [18, 24] },
                    ].map(({ label, range }) => {
                      const slots = timeSlots.filter(s => {
                        const h = parseInt(s.split(":")[0]);
                        return h >= range[0] && h < range[1];
                      });
                      if (slots.length === 0) return null;
                      return (
                        <View key={label} style={{ marginBottom: 12 }}>
                          <Text style={styles.timePeriodLabel}>{label}</Text>
                          <View style={styles.timeSlotsGrid}>
                            {slots.map(slot => {
                              const isBooked = bookedTimes.has(slot);
                              const isActive = selectedTime === slot;
                              return (
                                <Pressable
                                  key={slot}
                                  style={[
                                    styles.timeSlot,
                                    isActive && styles.timeSlotActive,
                                    isBooked && styles.timeSlotBooked,
                                  ]}
                                  onPress={() => !isBooked && setSelectedTime(slot)}
                                  disabled={isBooked}
                                >
                                  <Text style={[
                                    styles.timeSlotText,
                                    isActive && styles.timeSlotTextActive,
                                    isBooked && styles.timeSlotTextBooked,
                                  ]}>
                                    {slot}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.fieldLabel}>Observações</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Observações sobre o atendimento..."
                  placeholderTextColor="#555"
                  multiline
                  numberOfLines={3}
                />

                <Pressable
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleCreateAppointment}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#0A0A0A" />
                  ) : (
                    <Text style={styles.saveBtnText}>CONFIRMAR AGENDAMENTO</Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Seleção de Cliente */}
      <Modal visible={showClientPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "70%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Cliente</Text>
              <Pressable onPress={() => setShowClientPicker(false)}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
            </View>
            <View style={styles.searchRow}>
              <IconSymbol name="magnifyingglass" size={16} color="#888880" />
              <TextInput style={styles.searchInput} value={clientSearch} onChangeText={setClientSearch} placeholder="Buscar por nome ou telefone..." placeholderTextColor="#555" autoFocus />
            </View>
            <FlatList
              data={filteredClients}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.clientItem, pressed && { opacity: 0.7 }]}
                  onPress={() => { setSelectedClient(item); setShowClientPicker(false); setClientSearch(""); }}
                >
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.clientName}>{item.name}</Text>
                    <Text style={styles.clientPhone}>{item.phone}</Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Nenhum cliente encontrado</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Modal Detalhe do Agendamento */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes do Agendamento</Text>
              <Pressable onPress={() => setShowDetailModal(false)}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
            </View>
            {selectedAppointment && (
              <ScrollView>
                {/* Banner de ação necessária — exibido ao abrir via notificação */}
                {highlightApproval && selectedAppointment.status === "pending_approval" && (
                  <View style={{ backgroundColor: "#FF9800", borderRadius: 8, padding: 10, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🔔</Text>
                    <Text style={{ color: "#0A0A0A", fontWeight: "700", fontSize: 13, flex: 1 }}>
                      Ação necessária: este agendamento aguarda sua aprovação.
                    </Text>
                  </View>
                )}
                {/* Informações do agendamento */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cliente</Text>
                  <Text style={styles.detailValue}>
                    {selectedAppointment.clientName ?? selectedAppointment.client?.name ?? "—"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Serviço(s)</Text>
                  <Text style={styles.detailValue}>
                    {selectedAppointment.serviceNames ?? selectedAppointment.serviceName ?? selectedAppointment.service?.name ?? "—"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Horário</Text>
                  <Text style={styles.detailValue}>{selectedAppointment.startTime} – {selectedAppointment.endTime}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_CONFIG[selectedAppointment.status]?.color ?? "#888880") + "22" }]}>
                    <Text style={[styles.statusText, { color: STATUS_CONFIG[selectedAppointment.status]?.color ?? "#888880" }]}>
                      {STATUS_CONFIG[selectedAppointment.status]?.label ?? selectedAppointment.status}
                    </Text>
                  </View>
                </View>
                {selectedAppointment.notes ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Observações</Text>
                    <Text style={styles.detailValue}>{selectedAppointment.notes}</Text>
                  </View>
                ) : null}

                {/* Seção de edição de serviços */}
                {selectedAppointment.status !== "completed" && selectedAppointment.status !== "cancelled" && selectedAppointment.status !== "no_show" && (
                  <View>
                    <Text style={[styles.fieldLabel, { marginTop: 20, marginBottom: 8 }]}>Editar Serviços</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      {(servicesQuery.data ?? []).map((svc: any) => {
                        const isSelected = editServices.some((s) => s.id === svc.id);
                        return (
                          <Pressable
                            key={svc.id}
                            style={[styles.serviceChip, isSelected && styles.serviceChipActive]}
                            onPress={() => setEditServices((prev) =>
                              isSelected ? prev.filter((s) => s.id !== svc.id) : [...prev, svc]
                            )}
                          >
                            <Text style={[styles.serviceChipText, isSelected && styles.serviceChipTextActive]}>
                              {svc.name}
                            </Text>
                            <Text style={[styles.serviceChipText, isSelected && styles.serviceChipTextActive, { fontSize: 11, opacity: 0.8 }]}>
                              {svc.durationMinutes} min
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {editServices.length > 0 && (
                      <View style={[styles.serviceChip, { backgroundColor: "#1A1A1A", borderColor: "#C9A84C", marginBottom: 12, flexDirection: "row", justifyContent: "space-between" }]}>
                        <Text style={{ color: "#C9A84C", fontSize: 13, fontWeight: "600" }}>
                          {editServices.map((s) => s.name).join(" + ")}
                        </Text>
                        <Text style={{ color: "#888880", fontSize: 12 }}>
                          {editTotalDuration} min · R$ {editTotalPrice.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <Pressable
                      style={[styles.saveBtn, { marginBottom: 16, opacity: editServices.length === 0 ? 0.5 : 1 }]}
                      onPress={() => {
                        if (editServices.length === 0) {
                          Alert.alert("Atenção", "Selecione ao menos um serviço.");
                          return;
                        }
                        const newEndTime = addMinutes(selectedAppointment.startTime, editTotalDuration);
                        const newServiceNames = editServices.length > 1
                          ? editServices.map((s: any) => s.name).join(" + ")
                          : null;
                        updateMutation.mutate({
                          id: selectedAppointment.id,
                          serviceId: editServices[0].id,
                          serviceNames: newServiceNames,
                          endTime: newEndTime,
                        });
                      }}
                    >
                      <Text style={styles.saveBtnText}>
                        {updateMutation.isPending ? "Salvando..." : "Salvar Serviços"}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Seção de aprovação de horário extra */}
                {selectedAppointment.status === "pending_approval" && (
                  <View style={{ backgroundColor: "#1A0D00", borderRadius: 12, padding: 16, marginTop: 16, marginBottom: 8, borderWidth: highlightApproval ? 2 : 1, borderColor: highlightApproval ? "#FF9800" : "#FF6B35", ...(highlightApproval && { shadowColor: "#FF9800", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 }) }}>
                    <Text style={{ color: "#FF6B35", fontWeight: "700", fontSize: 15, marginBottom: 6 }}>
                      ⚠️ Agendamento fora do expediente
                    </Text>
                    <Text style={{ color: "#F5F5F0", fontSize: 13, lineHeight: 20, marginBottom: 14 }}>
                      Este agendamento termina às {selectedAppointment.endTime?.substring(0, 5)}, ultrapassando o horário de fechamento. Deseja confirmar mesmo assim?
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable
                        style={[styles.saveBtn, { flex: 1, backgroundColor: "#4CAF50", marginBottom: 0 }]}
                        onPress={() => approveMutation.mutate({ id: selectedAppointment.id, approve: true })}
                        disabled={approveMutation.isPending}
                      >
                        <Text style={styles.saveBtnText}>{approveMutation.isPending ? "..." : "✔ Aprovar"}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.saveBtn, { flex: 1, backgroundColor: "#F44336", marginBottom: 0 }]}
                        onPress={() => approveMutation.mutate({ id: selectedAppointment.id, approve: false })}
                        disabled={approveMutation.isPending}
                      >
                        <Text style={styles.saveBtnText}>{approveMutation.isPending ? "..." : "✖ Recusar"}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {selectedAppointment.status !== "pending_approval" && (
                  <View>
                    <Text style={[styles.fieldLabel, { marginTop: 4, marginBottom: 8 }]}>Alterar Status</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      {Object.entries(STATUS_CONFIG).filter(([k]) => k !== "pending_approval").map(([key, cfg]) => (
                        <Pressable
                          key={key}
                          style={[styles.statusChangeBtn, { borderColor: cfg.color }]}
                          onPress={() => handleStatusChange(selectedAppointment.id, key)}
                        >
                          <Text style={[styles.statusChangeBtnText, { color: cfg.color }]}>{cfg.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Pagamento */}
      <PaymentStatusModal
        visible={showPaymentModal}
        appointment={paymentAppointment}
        onClose={() => setShowPaymentModal(false)}
        onPaymentRegistered={() => {
          if (paymentAppointment) {
            setPaymentPendingMap(prev => ({ ...prev, [paymentAppointment.id]: false }));
          }
          utils.appointments.byDateRange.invalidate(); utils.appointments.allByDateRange.invalidate();
          utils.dashboard.stats.invalidate();
        }}
      />

      {/* Modal Cancelamento com Motivo */}
      <Modal visible={showCancelModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: 340 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancelar Agendamento</Text>
              <Pressable onPress={() => setShowCancelModal(false)}>
                <IconSymbol name="xmark" size={22} color="#888880" />
              </Pressable>
            </View>
            <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Motivo (opcional)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {["Imprevisto", "Feriado", "Problema técnico", "Outro"].map(r => (
                <Pressable
                  key={r}
                  onPress={() => setCancelReason(r)}
                  style={[styles.serviceChip, cancelReason === r && styles.serviceChipActive, { minWidth: 0, paddingHorizontal: 14 }]}
                >
                  <Text style={[styles.serviceChipText, cancelReason === r && styles.serviceChipTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Ou escreva um motivo personalizado..."
              placeholderTextColor="#555"
              value={cancelReason}
              onChangeText={setCancelReason}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.saveBtn, { backgroundColor: "#F44336" }]}
              onPress={confirmCancelWithReason}
              disabled={cancelWithReasonMutation.isPending}
            >
              {cancelWithReasonMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>CONFIRMAR CANCELAMENTO</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: c.foreground },
  addBtn: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { fontWeight: "700", fontSize: 14 },
  calendarCard: { marginHorizontal: 16, backgroundColor: c.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.border, marginBottom: 16 },
  calendarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  calendarTitle: { fontSize: 19, fontWeight: "700", color: c.foreground },
  daysRow: { flexDirection: "row", marginBottom: 12 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 13, color: c.muted, fontWeight: "600" },
  daysGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.28%", aspectRatio: 1, justifyContent: "center", alignItems: "center", borderRadius: 10, paddingBottom: 2 },
  dayCellSelected: { backgroundColor: "#C9A84C" },
  dayCellToday: { backgroundColor: "#C9A84C33", borderWidth: 1.5, borderColor: "#C9A84C" },
  dayText: { fontSize: 16, color: c.foreground, lineHeight: 22 },
  dayTextSelected: { color: "#0A0A0A", fontWeight: "800" },
  dayTextToday: { color: "#C9A84C", fontWeight: "800" },
  dayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#C9A84C", marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.foreground },
  sectionCount: { fontSize: 13, color: c.muted },
  emptyCard: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: c.muted, fontSize: 14 },
  aptCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  aptStatusBar: { width: 4, alignSelf: "stretch" },
  aptContent: { flex: 1, padding: 14 },
  aptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  aptTime: { fontSize: 15, fontWeight: "700", color: c.foreground },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  aptClientName: { fontSize: 14, fontWeight: "600", color: c.foreground },
  aptServiceName: { fontSize: 13, color: c.muted },
  aptNotes: { fontSize: 12, color: c.muted, marginTop: 4, fontStyle: "italic" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "92%", borderWidth: 1, borderColor: c.border },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: c.foreground },
  fieldLabel: { fontSize: 13, color: c.muted, marginBottom: 6, fontWeight: "500" },
  infoBox: { backgroundColor: c.background, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: c.border },
  infoText: { color: c.foreground, fontSize: 14 },
  selectorBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.background, borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: c.border },
  selectorText: { color: c.foreground, fontSize: 14 },
  selectorPlaceholder: { color: c.muted, fontSize: 14 },
  serviceChip: { padding: 12, borderRadius: 10, backgroundColor: c.background, borderWidth: 1, borderColor: c.border, minWidth: 120, alignItems: "center" },
  serviceChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  serviceChipText: { fontSize: 13, color: c.muted, fontWeight: "600", marginBottom: 4 },
  serviceChipTextActive: { color: "#C9A84C" },
  serviceChipPrice: { fontSize: 12, color: c.muted },
  timePeriodLabel: { fontSize: 11, fontWeight: "700", color: "#666", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  timeSlotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeSlot: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "#141414", borderWidth: 1, borderColor: "#2A2A2A", minWidth: 64, alignItems: "center" },
  timeSlotActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  timeSlotBooked: { backgroundColor: "#141414", borderColor: "#F4433622", opacity: 0.4 },
  timeSlotText: { fontSize: 13, color: "#E5E5E5", fontWeight: "600" },
  timeSlotTextActive: { color: "#C9A84C" },
  timeSlotTextBooked: { color: "#F44336" },
  input: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.foreground, marginBottom: 14 },
  textarea: { height: 80, textAlignVertical: "top" },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  // Cliente picker
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: c.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.border, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, color: c.foreground, fontSize: 14 },
  clientItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center" },
  clientAvatarText: { color: "#C9A84C", fontSize: 16, fontWeight: "700" },
  clientName: { fontSize: 15, fontWeight: "600", color: c.foreground },
  clientPhone: { fontSize: 13, color: c.muted },
  // Detalhe
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  detailLabel: { fontSize: 13, color: c.muted },
  detailValue: { fontSize: 14, color: c.foreground, fontWeight: "600", flex: 1, textAlign: "right" },
  statusChangeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  statusChangeBtnText: { fontSize: 12, fontWeight: "600" },
  // Filtro de barbeiro
  barberFilterWrapper: { paddingHorizontal: 16, paddingBottom: 12 },
  barberFilterScroll: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  barberFilterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#C9A84C" },
  barberFilterChipActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  barberFilterChipText: { fontSize: 13, color: "#C9A84C", fontWeight: "600" },
  barberFilterChipTextActive: { color: "#0A0A0A" },
  // Toggle de vista (Lista / Timeline)
  viewToggle: { flexDirection: "row", backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: "hidden", alignSelf: "stretch" },
  viewToggleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#C9A84C", backgroundColor: "#1A1A1A" },
  viewToggleBtnActive: { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
  viewToggleBtnText: { fontSize: 13, fontWeight: "700", color: "#C9A84C" },
  viewToggleBtnTextActive: { color: "#0A0A0A" },
  // Timeline
  timelineContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", minHeight: 40, marginBottom: 2 },
  timelineHour: { width: 44, fontSize: 11, color: c.muted, fontWeight: "600", paddingTop: 6, textAlign: "right", paddingRight: 8 },
  timelineLineWrapper: { width: 12, alignSelf: "stretch", alignItems: "center", marginRight: 6, position: "relative" },
  timelineLine: { width: 1, backgroundColor: c.border, flex: 1 },
  timelineNowIndicator: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center" },
  timelineNowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F44336", marginLeft: -3 },
  timelineNowLine: { flex: 1, height: 1.5, backgroundColor: "#F44336" },
  timelineEvents: { flex: 1, gap: 4, paddingBottom: 4 },
  timelineCard: { backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, borderLeftWidth: 4, padding: 10, marginBottom: 2 },
  timelineCardTime: { fontSize: 11, color: c.muted, fontWeight: "600", marginBottom: 2 },
  timelineCardClient: { fontSize: 14, fontWeight: "700", color: c.foreground, marginBottom: 1 },
  timelineCardService: { fontSize: 12, color: c.muted },
  timelineCardBarber: { fontSize: 11, color: c.muted, marginTop: 2, fontStyle: "italic" },
  });
}
