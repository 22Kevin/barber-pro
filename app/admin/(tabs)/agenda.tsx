import { useState, useCallback, useEffect, useRef } from "react";
import { EmptyState } from "@/components/empty-state";
import { hapticSuccess, hapticError, hapticMedium, hapticLight } from "@/lib/haptics";
import { toast } from "@/components/toast";
import {
  ActivityIndicator,
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
import { AppAlert } from "@/components/app-alert";
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


function getWeekDays(date: Date): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day); // domingo da semana
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
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

function isSlotBlocked(slot: string, durationMin: number, bookedAppts: any[]) {
  const slotStart = toMinutes(slot);
  const slotEnd = slotStart + durationMin;
  return bookedAppts.some((a: any) => {
    const aStart = toMinutes((a.startTime ?? "00:00").substring(0, 5));
    const aEnd = toMinutes((a.endTime ?? "00:30").substring(0, 5));
    return slotStart < aEnd && slotEnd > aStart;
  });
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

// ─── Cartão de bloqueio de horário ─────────────────────────────────────────────
function BlockedSlotCard({
  reason,
  startTime,
  endTime,
  barberName,
  isFromGoogle,
  onPress,
}: {
  reason: string | null;
  startTime: string | null;
  endTime: string | null;
  barberName: string;
  isFromGoogle: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: "rgba(255,255,255,0.03)",
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: pressed ? "#C9A84C" : "#2A2A2A",
          borderRadius: 14,
          padding: 14,
          marginBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
      ]}
    >
      <View style={{ minWidth: 48, alignItems: "center" }}>
        <Text style={{ fontSize: 15, fontWeight: "900", color: "#888880" }}>{(startTime ?? "").slice(0, 5)}</Text>
        <Text style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{(endTime ?? "").slice(0, 5)}</Text>
      </View>
      <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: "#888880" }} />
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(148,163,184,0.1)", borderWidth: 1, borderColor: "rgba(148,163,184,0.25)", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 16 }}>🔒</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#ECEDEE" }} numberOfLines={1}>
          {reason ?? "Horário bloqueado"}
        </Text>
        <Text style={{ fontSize: 11, color: "#888880", marginTop: 1 }}>
          {barberName}{isFromGoogle ? " · Importado do Google Agenda" : ""}
        </Text>
        {isFromGoogle && (
          <Text style={{ fontSize: 10, color: "#C9A84C", marginTop: 2 }}>💡 Toque para transformar em agendamento</Text>
        )}
      </View>
    </Pressable>
  );
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
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
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
  const [clientPickerTarget, setClientPickerTarget] = useState<"new" | "convert">("new");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelApptId, setCancelApptId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // ── Transformar bloqueio em agendamento ─────────────────────────────────
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertingSlot, setConvertingSlot] = useState<any>(null);
  const [convertClientMode, setConvertClientMode] = useState<"existing" | "new">("existing");
  const [convertServiceMode, setConvertServiceMode] = useState<"existing" | "new">("existing");
  const [convertSelectedClient, setConvertSelectedClient] = useState<any>(null);
  const [convertClientSearch, setConvertClientSearch] = useState("");
  const [convertMatchingClients, setConvertMatchingClients] = useState<any[]>([]);
  const [convertClientGuess, setConvertClientGuess] = useState("");
  const [convertNewClientName, setConvertNewClientName] = useState("");
  const [convertNewClientPhone, setConvertNewClientPhone] = useState("");
  const [convertSelectedService, setConvertSelectedService] = useState<any>(null);
  const [convertNewServiceName, setConvertNewServiceName] = useState("");
  const [convertNewServicePrice, setConvertNewServicePrice] = useState("");
  const [convertNewServiceDuration, setConvertNewServiceDuration] = useState("30");
  // Quando o modal de novo agendamento abre para managers, limpa o barbeiro selecionado
  useEffect(() => {
    if (showNewModal && (barber?.role === "super_admin" || barber?.role === "receptionist")) {
      setSelectedBarber(null);
      setSelectedTime("");
    }
  }, [showNewModal]);

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

  // Bloqueios de horário do mês (mesmo padrão dos agendamentos)
  const blockedSlotsByMonthQuery = trpc.appointments.blockedSlots.byDateRange.useQuery(
    { barberId: barber?.id ?? 0, startDate: monthStart, endDate: monthEnd },
    { enabled: !!barber?.id && !isManager, staleTime: 0 }
  );
  const allBlockedSlotsByMonthQuery = trpc.appointments.blockedSlots.allByDateRange.useQuery(
    { startDate: monthStart, endDate: monthEnd, tenantId },
    { enabled: isManager, staleTime: 0 }
  );

  // IDs de agendamentos de assinatura (não precisam de pagamento individual)
  const subscriptionApptIdsQuery = trpc.appointments.subscriptionAppointmentIds.useQuery(
    { startDate: monthStart, endDate: monthEnd, tenantId },
    { enabled: !!tenantId, staleTime: 60000 }
  );
  const subscriptionApptIds = useMemo(() => {
    const map = new Map<number, { selectedServiceIds: string; planId: number; planPrice?: string; planName?: string }>();
    for (const r of (subscriptionApptIdsQuery.data ?? [])) {
      map.set(r.appointmentId, { selectedServiceIds: r.selectedServiceIds, planId: r.planId, planPrice: r.planPrice, planName: r.planName });
    }
    return map;
  }, [subscriptionApptIdsQuery.data]);

  // Filtrar localmente pelo dia selecionado (sem nova requisição)
  const appointmentsQuery = useMemo(() => {
    const data = (appointmentsByMonthQuery.data ?? []).filter((a: any) => a.date === dateStr);
    return { data, isLoading: appointmentsByMonthQuery.isLoading, refetch: appointmentsByMonthQuery.refetch };
  }, [appointmentsByMonthQuery.data, appointmentsByMonthQuery.isLoading, appointmentsByMonthQuery.refetch, dateStr]);

  const allAppointmentsQuery = useMemo(() => {
    const data = (allAppointmentsByMonthQuery.data ?? []).filter((a: any) => a.date === dateStr);
    return { data, isLoading: allAppointmentsByMonthQuery.isLoading, refetch: allAppointmentsByMonthQuery.refetch };
  }, [allAppointmentsByMonthQuery.data, allAppointmentsByMonthQuery.isLoading, allAppointmentsByMonthQuery.refetch, dateStr]);

  // Bloqueios de horário do dia selecionado (mesmo filtro local dos agendamentos)
  const blockedSlotsQuery = useMemo(() => {
    const data = (blockedSlotsByMonthQuery.data ?? []).filter((b: any) => b.date === dateStr);
    return { data, isLoading: blockedSlotsByMonthQuery.isLoading, refetch: blockedSlotsByMonthQuery.refetch };
  }, [blockedSlotsByMonthQuery.data, blockedSlotsByMonthQuery.isLoading, blockedSlotsByMonthQuery.refetch, dateStr]);
  const allBlockedSlotsQuery = useMemo(() => {
    const data = (allBlockedSlotsByMonthQuery.data ?? []).filter((b: any) => b.date === dateStr);
    return { data, isLoading: allBlockedSlotsByMonthQuery.isLoading, refetch: allBlockedSlotsByMonthQuery.refetch };
  }, [allBlockedSlotsByMonthQuery.data, allBlockedSlotsByMonthQuery.isLoading, allBlockedSlotsByMonthQuery.refetch, dateStr]);

  const modalBarberId = (isManager ? selectedBarber?.id : barber?.id) ?? 0;
  const workingHoursQuery = trpc.barbers.workingHours.get.useQuery(
    { barberId: modalBarberId },
    { enabled: !!modalBarberId }
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

  // Extrai pistas de cliente/serviço do texto do bloqueio (mesma lógica já
  // usada e validada no painel web) e cruza com os clientes/serviços já
  // carregados localmente (sem round-trip extra ao servidor).
  function openConvertBlockModal(slot: any) {
    const cleaned = (slot.reason ?? "").replace(/^Importado da Google Agenda:\s*/i, "").trim();
    const parenMatch = cleaned.match(/\(([^)]+)\)\s*$/);
    const clientGuess = parenMatch ? parenMatch[1].trim() : "";
    const serviceGuess = parenMatch ? cleaned.slice(0, parenMatch.index).trim() : cleaned;
    const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cg = norm(clientGuess);
    const sg = norm(serviceGuess);

    const matches = cg
      ? (clientsQuery.data ?? []).filter((c: any) => {
          const cn = norm(c.name);
          return cn && (cn.includes(cg) || cg.includes(cn));
        })
      : [];
    const matchedService = sg
      ? (servicesQuery.data ?? []).find((s: any) => {
          const sn = norm(s.name);
          return sn && (sn.includes(sg) || sg.includes(sn));
        })
      : null;

    setConvertingSlot(slot);
    setConvertMatchingClients(matches);
    setConvertClientGuess(clientGuess);
    setConvertSelectedClient(matches.length === 1 ? matches[0] : null);
    setConvertClientSearch(matches.length === 1 ? matches[0].name : "");
    setConvertNewClientName(clientGuess);
    setConvertNewClientPhone("");
    setConvertSelectedService(matchedService ?? null);
    setConvertNewServiceName("");
    setConvertNewServicePrice("");
    setConvertNewServiceDuration("30");
    setConvertClientMode("existing");
    setConvertServiceMode("existing");
    setShowConvertModal(true);
  }

  const convertBlockMutation = trpc.appointments.blockedSlots.convertToAppointment.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      setShowConvertModal(false);
      await Promise.all([
        utils.appointments.blockedSlots.byDateRange.invalidate(),
        utils.appointments.blockedSlots.allByDateRange.invalidate(),
        utils.appointments.byDateRange.invalidate(),
        utils.appointments.allByDateRange.invalidate(),
        utils.clients.list.invalidate(),
        utils.services.list.invalidate(),
      ]);
      toast.success("Agendamento criado a partir do bloqueio!");
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  function handleConfirmConvert() {
    if (!convertingSlot) return;
    if (convertClientMode === "new" && (!convertNewClientName.trim() || !convertNewClientPhone.trim())) {
      Alert.alert("Atenção", "Nome e telefone são obrigatórios para cadastrar novo cliente.");
      return;
    }
    if (convertClientMode === "existing" && !convertSelectedClient) {
      Alert.alert("Atenção", "Selecione um cliente.");
      return;
    }
    if (convertServiceMode === "new" && (!convertNewServiceName.trim() || !convertNewServicePrice.trim())) {
      Alert.alert("Atenção", "Nome e preço são obrigatórios para cadastrar novo serviço.");
      return;
    }
    if (convertServiceMode === "existing" && !convertSelectedService) {
      Alert.alert("Atenção", "Selecione um serviço.");
      return;
    }
    convertBlockMutation.mutate({
      blockedSlotId: convertingSlot.id,
      ...(convertClientMode === "existing"
        ? { clientId: convertSelectedClient.id }
        : { newClientName: convertNewClientName.trim(), newClientPhone: convertNewClientPhone.trim() }),
      ...(convertServiceMode === "existing"
        ? { serviceId: convertSelectedService.id }
        : { newServiceName: convertNewServiceName.trim(), newServicePrice: convertNewServicePrice.trim(), newServiceDuration: parseInt(convertNewServiceDuration) || 30 }),
    });
  }

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
          selectedBarber?.name ?? barber?.name ?? "Barbeiro",
          appointmentDateTime
        ).catch(() => null);
      }

      closeNewModal();
      const clientName = (clientsQuery.data ?? []).find((c: any) => c.id === selectedClient?.id)?.name ?? "Cliente";
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
        toast.info(
          "⚠️ Aguarda aprovação",
          `Termina às ${endHHMM}, ${extraStr} após o fechamento (${closeHHMM}). Aprove na tela de detalhes.`
        );
      } else {
        // Agendamento criado normalmente — toast já foi exibido acima
      }
    },
    onError: (e) => { hapticError(); toast.error("Erro", e.message); },
  });

  const approveMutation = trpc.appointments.approveOvertime.useMutation({
    onSuccess: (_data: unknown, variables: any) => {
      utils.appointments.byDateRange.invalidate(); utils.appointments.allByDateRange.invalidate();
      utils.dashboard.stats.invalidate();
      setShowDetailModal(false);
      if (variables.approve) {
        toast.success("✅ Aprovado", "Agendamento confirmado! O cliente será notificado.");
      } else {
        toast.error("❌ Recusado", "Agendamento cancelado. O cliente será notificado.");
      }
    },
    onError: (e) => { hapticError(); toast.error("Erro", e.message); },
  });

  const updateMutation = trpc.appointments.update.useMutation({
    onSuccess: (data: any, variables: any) => {
      if (variables.status === "cancelled" || variables.status === "no_show") {
        cancelAppointmentReminder(variables.id).catch(() => null);
      }
      utils.appointments.byDateRange.invalidate(); utils.appointments.allByDateRange.invalidate();
      utils.appointments.subscriptionAppointmentIds.invalidate();
      utils.dashboard.stats.invalidate();
      setShowDetailModal(false);

      // Se completou um agendamento de assinatura, mostrar modal informativo
      if (variables.status === "completed" && data?.isSubscription) {
        const { sessionNumber, totalSessions, isLast, autoRenew, planName } = data;
        if (isLast && !autoRenew) {
          AppAlert.alert(
            "🎉 Última sessão do plano!",
            `${planName}\n\nEsta foi a sessão ${sessionNumber} de ${totalSessions} — o plano foi concluído!\n\nLembre de oferecer a renovação ao cliente.`,
            [{ text: "Entendido" }]
          );
        } else if (!isLast) {
          AppAlert.alert(
            `✅ Sessão ${sessionNumber} de ${totalSessions} concluída`,
            `${planName}\n\n${totalSessions - sessionNumber} sessão(ões) restante(s) neste ciclo.`,
            [{ text: "OK" }]
          );
        }
      }
    },
    onError: (e) => { hapticError(); toast.error("Erro", e.message); },
  });
  const cancelWithReasonMutation = trpc.appointments.cancelWithReason.useMutation({
    onSuccess: () => {
      utils.appointments.byDateRange.invalidate(); utils.appointments.allByDateRange.invalidate();
      utils.dashboard.stats.invalidate();
      setShowCancelModal(false);
      setCancelReason("");
      setCancelApptId(null);
    },
    onError: (e) => { hapticError(); toast.error("Erro", e.message); },
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
    setSelectedClient(null);
    setSelectedBarber(isManager ? null : barber);
    setSelectedServices([]); setSelectedTime(""); setNotes(""); setClientSearch("");
  }

  function handleCreateAppointment() {
    if (!selectedClient) { toast.info("Selecione um cliente."); return; }
    if (isManager && !selectedBarber) { toast.info("Selecione um barbeiro."); return; }
    if (selectedServices.length === 0) { toast.info("Selecione ao menos um serviço."); return; }
    if (!selectedTime) { toast.info("Selecione um horário."); return; }
    const endTime = addMinutes(selectedTime, totalDuration);
    const serviceNamesStr = selectedServices.length > 1
      ? selectedServices.map((s: any) => s.name).join(" + ")
      : undefined;
    createMutation.mutate({
      clientId: selectedClient.id,
      barberId: selectedBarber?.id ?? barber?.id ?? 0,
      serviceId: selectedService!.id,
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
      // Se for assinatura, nunca mostrar modal de pagamento
      if (subscriptionApptIds.has(id)) {
        updateMutation.mutate({ id, status: status as any });
        return;
      }
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
      return;
    }
    updateMutation.mutate({ id, status: status as any });
  }

  function handleAppointmentCompleted(apt: any) {
    // Se for agendamento de assinatura, não abrir modal de pagamento
    if (subscriptionApptIds.has(apt.id)) {
      // Apenas marca como concluído — o servidor cuidará do incremento e retornará info da sessão
      updateMutation.mutate({ id: apt.id, status: "completed" });
      return;
    }
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

  const modalBookedAppointments = useMemo(() => {
    const data = isManager
      ? (allAppointmentsByMonthQuery.data ?? []).filter(
          (a: any) => a.date === dateStr && a.barberId === selectedBarber?.id
        )
      : (appointmentsQuery.data ?? []);
    return data.filter((a: any) => a.status !== "cancelled" && a.status !== "no_show");
  }, [isManager, allAppointmentsByMonthQuery.data, appointmentsQuery.data, dateStr, selectedBarber?.id]);

  const filteredClients = (clientsQuery.data ?? []).filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  // Para managers: usa allByDate e aplica filtro de barbeiro; para barbeiros: usa byDate
  const rawAppointments = isManager
    ? (allAppointmentsQuery.data ?? [])
    : (appointmentsQuery.data ?? []);
  // Mesmo padrão pros bloqueios de horário
  const rawBlockedSlots = isManager
    ? (allBlockedSlotsQuery.data ?? [])
    : (blockedSlotsQuery.data ?? []);
  const blockedSlotsForDay = isManager && filterBarberId !== null
    ? rawBlockedSlots.filter((b: any) => b.barberId === filterBarberId)
    : rawBlockedSlots;
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
              style={({ pressed }) => [styles.addBtn, { width: 40, height: 40, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#C9A84C", paddingHorizontal: 0, justifyContent: "center" }, pressed && { opacity: 0.8 }]}
              onPress={() => router.push("/admin/(tabs)/plan-booking" as any)}
            >
              <IconSymbol name="star.fill" size={16} color="#C9A84C" />
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
          {/* Toggle Mês / Semana */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            {(['month', 'week'] as const).map(mode => (
              <Pressable
                key={mode}
                style={[{
                  paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: calendarMode === mode ? "#C9A84C" : "#1A1A1A",
                  borderWidth: 1, borderColor: calendarMode === mode ? "#C9A84C" : "#2A2A2A",
                }]}
                onPress={() => setCalendarMode(mode)}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: calendarMode === mode ? "#0A0A0A" : "#888" }}>
                  {mode === 'month' ? '📅 Mês' : '📆 Semana'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.calendarHeader}>
            <Pressable onPress={() => {
              if (calendarMode === 'month') {
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
              } else {
                const prev = new Date(selectedDate);
                prev.setDate(prev.getDate() - 7);
                setSelectedDate(prev);
                setCurrentMonth(new Date(prev.getFullYear(), prev.getMonth(), 1));
              }
            }}>
              <IconSymbol name="chevron.left" size={22} color="#C9A84C" />
            </Pressable>
            <Text style={styles.calendarTitle}>
              {calendarMode === 'month'
                ? `${MONTHS_PT[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
                : (() => {
                    const days = getWeekDays(selectedDate);
                    return `${days[0].getDate()} – ${days[6].getDate()} de ${MONTHS_PT[days[3].getMonth()]}`;
                  })()
              }
            </Text>
            <Pressable onPress={() => {
              if (calendarMode === 'month') {
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
              } else {
                const next = new Date(selectedDate);
                next.setDate(next.getDate() + 7);
                setSelectedDate(next);
                setCurrentMonth(new Date(next.getFullYear(), next.getMonth(), 1));
              }
            }}>
              <IconSymbol name="chevron.right" size={22} color="#C9A84C" />
            </Pressable>
          </View>

          <View style={styles.daysRow}>
            {DAYS_PT.map(d => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
          </View>

          {/* Vista semanal */}
          {calendarMode === 'week' && (
            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 4, paddingBottom: 8 }}>
              {getWeekDays(selectedDate).map((day, i) => {
                const dayStr = dateToString(day);
                const hasAppt = datesWithAppt.has(dayStr);
                const sel = isSelected(day);
                const tod = isToday(day);
                return (
                  <Pressable
                    key={i}
                    style={[{
                      alignItems: "center", flex: 1, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: sel ? "#C9A84C" : tod ? "#C9A84C22" : "transparent",
                      borderWidth: tod && !sel ? 1.5 : 0,
                      borderColor: "#C9A84C",
                    }]}
                    onPress={() => setSelectedDate(day)}
                  >
                    <Text style={{ fontSize: 10, color: sel ? "#0A0A0A" : "#888", fontWeight: "700", marginBottom: 4 }}>
                      {DAYS_PT[i]}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: sel ? "#0A0A0A" : tod ? "#C9A84C" : "#E5E5E5" }}>
                      {day.getDate()}
                    </Text>
                    {hasAppt && <View style={[styles.dayDot, sel && { backgroundColor: "#0A0A0A" }]} />}
                  </Pressable>
                );
              })}
            </View>
          )}

          {calendarMode === 'month' && <View style={styles.daysGrid}>
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
          </View>}
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
              {(barbersQuery.data ?? []).filter((b: any) => b.role !== "receptionist").map((b: any) => (
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
        ) : appointments.length === 0 && blockedSlotsForDay.length === 0 ? (
          <View style={styles.emptyCard}>
            <IconSymbol name="calendar" size={36} color="#2A2A2A" />
            <Text style={styles.emptyText}>Nenhum agendamento neste dia</Text>
          </View>
        ) : viewMode === 'list' ? (
          <GestureHandlerRootView>
            {[
              ...appointments.map((apt: any) => ({ time: apt.startTime ?? "00:00", kind: "appointment" as const, data: apt })),
              ...blockedSlotsForDay.map((b: any) => ({ time: b.startTime ?? "00:00", kind: "blocked" as const, data: b })),
            ]
              .sort((a, b) => String(a.time).localeCompare(String(b.time)))
              .map((item) => {
                if (item.kind === "blocked") {
                  const b = item.data;
                  const barberName = (barbersQuery.data ?? []).find((bb: any) => bb.id === b.barberId)?.name ?? "—";
                  return (
                    <BlockedSlotCard
                      key={`blocked-${b.id}`}
                      reason={b.reason}
                      startTime={b.startTime}
                      endTime={b.endTime}
                      barberName={barberName}
                      isFromGoogle={!!b.googleEventId}
                      onPress={() => openConvertBlockModal(b)}
                    />
                  );
                }
                const apt = item.data;
                return (
              <SwipeableAppointmentCard
                key={apt.id}
                appointment={{ ...apt, isSubscription: subscriptionApptIds.has(apt.id) }}
                onPress={() => {
                  if (apt.status === "completed" && !subscriptionApptIds.has(apt.id)) {
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
                    // Se for agendamento de assinatura, filtrar pelos serviços do plano
                    const subData = subscriptionApptIds.get(apt.id);
                    if (subData?.selectedServiceIds) {
                      try {
                        const planSvcIds: number[] = JSON.parse(subData.selectedServiceIds);
                        const planServices = (servicesQuery.data ?? []).filter((s: any) => planSvcIds.includes(s.id));
                        setEditServices(planServices.length > 0 ? planServices : (servicesQuery.data ?? []).filter((s: any) => s.id === apt.serviceId));
                      } catch {
                        const currentService = (servicesQuery.data ?? []).find((s: any) => s.id === apt.serviceId);
                        setEditServices(currentService ? [currentService] : []);
                      }
                    } else {
                      const currentService = (servicesQuery.data ?? []).find((s: any) => s.id === apt.serviceId);
                      setEditServices(currentService ? [currentService] : []);
                    }
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
                    if (!phone) { toast.info("Cliente sem telefone cadastrado."); return; }
                    const url = link?.invoiceUrl ?? link?.pixCopyCola ?? null;
                    if (!url) { toast.info("Nenhum link de pagamento encontrado."); return; }
                    const msg = encodeURIComponent(`Olá ${apt.clientName}! Segue o link para pagamento do seu agendamento: ${url}`);
                    Linking.openURL(`https://wa.me/55${phone}?text=${msg}`);
                  } catch { toast.error("Não foi possível buscar o link de pagamento."); }
                }}
                paymentPending={apt.status === "completed" && !subscriptionApptIds.has(apt.id) ? (paymentPendingMap[apt.id] ?? true) : undefined}
              />
                );
              })}
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
                {(barbersQuery.data ?? []).filter((b: any) => b.role !== "receptionist").map((b: any) => (
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
                <Pressable style={styles.selectorBtn} onPress={() => { setClientPickerTarget("new"); setShowClientPicker(true); }}>
                  <Text style={selectedClient ? styles.selectorText : styles.selectorPlaceholder}>
                    {selectedClient ? selectedClient.name : "Selecionar cliente..."}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="#888880" />
                </Pressable>

                {isManager && (
                  <>
                    <Text style={styles.fieldLabel}>Barbeiro *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {(barbersQuery.data ?? []).filter((b: any) => b.role !== "receptionist").map((b: any) => {
                          const isSel = selectedBarber?.id === b.id;
                          return (
                            <Pressable
                              key={b.id}
                              style={[styles.serviceChip, isSel && styles.serviceChipActive]}
                              onPress={() => { setSelectedBarber(b); setSelectedTime(""); }}
                            >
                              <Text style={[styles.serviceChipText, isSel && styles.serviceChipTextActive]}>{b.name}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </>
                )}

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
                {isManager && !selectedBarber ? (
                  <View style={styles.infoBox}>
                    <Text style={[styles.infoText, { color: "#888880" }]}>Selecione um barbeiro acima para ver os horários disponíveis</Text>
                  </View>
                ) : !workingDay?.isWorking ? (
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
                              const isBooked = isSlotBlocked(slot, Math.max(totalDuration || 30, 30), modalBookedAppointments);
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator color="#0A0A0A" size="small" />
                      <Text style={styles.saveBtnText}>Salvando...</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveBtnText}>CONFIRMAR AGENDAMENTO</Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Transformar Bloqueio em Agendamento */}
      <Modal visible={showConvertModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Transformar em Agendamento</Text>
                <Pressable onPress={() => setShowConvertModal(false)}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {convertingSlot && (
                  <View style={[styles.infoBox, { borderStyle: "dashed", marginBottom: 16 }]}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#ECEDEE", marginBottom: 4 }}>
                      {convertingSlot.reason ?? "Horário bloqueado"}
                    </Text>
                    <Text style={styles.infoText}>
                      {convertingSlot.date} às {(convertingSlot.startTime ?? "").slice(0, 5)} - {(convertingSlot.endTime ?? "").slice(0, 5)}
                    </Text>
                  </View>
                )}

                {/* Cliente */}
                <Text style={styles.fieldLabel}>Cliente *</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                  <Pressable
                    style={[styles.serviceChip, convertClientMode === "existing" && styles.serviceChipActive, { flex: 1, alignItems: "center" }]}
                    onPress={() => setConvertClientMode("existing")}
                  >
                    <Text style={[styles.serviceChipText, convertClientMode === "existing" && styles.serviceChipTextActive]}>Cliente existente</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.serviceChip, convertClientMode === "new" && styles.serviceChipActive, { flex: 1, alignItems: "center" }]}
                    onPress={() => setConvertClientMode("new")}
                  >
                    <Text style={[styles.serviceChipText, convertClientMode === "new" && styles.serviceChipTextActive]}>+ Cadastrar novo</Text>
                  </Pressable>
                </View>

                {convertClientMode === "existing" ? (
                  <>
                    {convertMatchingClients.length > 0 && (
                      <View style={{ backgroundColor: "rgba(201,168,76,0.08)", borderWidth: 1, borderColor: "rgba(201,168,76,0.25)", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#C9A84C", marginBottom: 6 }}>💡 Possíveis correspondências:</Text>
                        {convertMatchingClients.map((c: any) => (
                          <Pressable
                            key={c.id}
                            onPress={() => { setConvertSelectedClient(c); setConvertClientSearch(c.name); }}
                            style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: convertSelectedClient?.id === c.id ? "rgba(201,168,76,0.2)" : "rgba(0,0,0,0.2)", marginBottom: 4, flexDirection: "row", justifyContent: "space-between" }}
                          >
                            <Text style={{ color: "#ECEDEE", fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
                            {c.phone && <Text style={{ color: "#888880", fontSize: 12 }}>{c.phone}</Text>}
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {convertMatchingClients.length === 0 && convertClientGuess !== "" && (
                      <Text style={{ fontSize: 12, color: "#F87171", marginBottom: 8 }}>
                        ⚠️ Nenhum cliente encontrado com o nome "{convertClientGuess}". Busque manualmente ou cadastre um novo.
                      </Text>
                    )}
                    <Pressable style={styles.selectorBtn} onPress={() => { setClientPickerTarget("convert"); setShowClientPicker(true); }}>
                      <Text style={convertSelectedClient ? styles.selectorText : styles.selectorPlaceholder}>
                        {convertSelectedClient ? convertSelectedClient.name : "Selecionar cliente..."}
                      </Text>
                      <IconSymbol name="chevron.right" size={16} color="#888880" />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <TextInput style={styles.input} placeholder="Nome completo *" placeholderTextColor="#555" value={convertNewClientName} onChangeText={setConvertNewClientName} />
                    <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Telefone / WhatsApp *" placeholderTextColor="#555" value={convertNewClientPhone} onChangeText={setConvertNewClientPhone} keyboardType="phone-pad" />
                  </>
                )}

                {/* Serviço */}
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Serviço *</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                  <Pressable
                    style={[styles.serviceChip, convertServiceMode === "existing" && styles.serviceChipActive, { flex: 1, alignItems: "center" }]}
                    onPress={() => setConvertServiceMode("existing")}
                  >
                    <Text style={[styles.serviceChipText, convertServiceMode === "existing" && styles.serviceChipTextActive]}>Serviço existente</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.serviceChip, convertServiceMode === "new" && styles.serviceChipActive, { flex: 1, alignItems: "center" }]}
                    onPress={() => setConvertServiceMode("new")}
                  >
                    <Text style={[styles.serviceChipText, convertServiceMode === "new" && styles.serviceChipTextActive]}>+ Cadastrar novo</Text>
                  </Pressable>
                </View>

                {convertServiceMode === "existing" ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {(servicesQuery.data ?? []).map((s: any) => {
                        const isSel = convertSelectedService?.id === s.id;
                        return (
                          <Pressable key={s.id} style={[styles.serviceChip, isSel && styles.serviceChipActive]} onPress={() => setConvertSelectedService(s)}>
                            <Text style={[styles.serviceChipText, isSel && styles.serviceChipTextActive]}>{s.name}</Text>
                            <Text style={[styles.serviceChipPrice, isSel && { color: "#C9A84C" }]}>R$ {parseFloat(s.price).toFixed(2).replace(".", ",")}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                ) : (
                  <>
                    <TextInput style={styles.input} placeholder="Nome do novo serviço *" placeholderTextColor="#555" value={convertNewServiceName} onChangeText={setConvertNewServiceName} />
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="Preço (R$) *" placeholderTextColor="#555" value={convertNewServicePrice} onChangeText={setConvertNewServicePrice} keyboardType="decimal-pad" />
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="Duração (min)" placeholderTextColor="#555" value={convertNewServiceDuration} onChangeText={setConvertNewServiceDuration} keyboardType="number-pad" />
                    </View>
                  </>
                )}

                <Pressable
                  style={[styles.saveBtn, { marginTop: 20 }, convertBlockMutation.isPending && { opacity: 0.6 }]}
                  onPress={handleConfirmConvert}
                  disabled={convertBlockMutation.isPending}
                >
                  {convertBlockMutation.isPending ? (
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
                  onPress={() => {
                    if (clientPickerTarget === "convert") { setConvertSelectedClient(item); }
                    else { setSelectedClient(item); }
                    setShowClientPicker(false);
                    setClientSearch("");
                  }}
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
                    {subscriptionApptIds.has(selectedAppointment.id) && (
                      <Text style={{ color: "#C9A84C", fontSize: 11, marginBottom: 8, fontStyle: "italic" }}>
                        ⭐ Exibindo apenas serviços do plano de assinatura
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      {(() => {
                        const subData = subscriptionApptIds.get(selectedAppointment.id);
                        let availableServices = servicesQuery.data ?? [];
                        if (subData?.selectedServiceIds) {
                          try {
                            const planSvcIds: number[] = JSON.parse(subData.selectedServiceIds);
                            availableServices = availableServices.filter((s: any) => planSvcIds.includes(s.id));
                          } catch {}
                        }
                        return availableServices.map((svc: any) => {
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
                        });
                      })()}
                    </View>
                    {editServices.length > 0 && (() => {
                      const subData = subscriptionApptIds.get(selectedAppointment?.id);
                      const isSubAppt = !!subData;
                      const displayPrice = isSubAppt && subData?.planPrice
                        ? parseFloat(String(subData.planPrice))
                        : editTotalPrice;
                      const priceLabel = isSubAppt ? "Plano: " + (subData?.planName ?? "Assinatura") : "";
                      return (
                        <View style={{ backgroundColor: "#1A1A1A", borderColor: "#C9A84C", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                          <Text style={{ color: "#C9A84C", fontSize: 13, fontWeight: "600", marginBottom: 4, flexWrap: "wrap" }}>
                            {editServices.map((s) => s.name).join(" + ")}
                          </Text>
                          <Text style={{ color: "#888880", fontSize: 12 }}>
                            {editTotalDuration} min · R$ {displayPrice.toFixed(2)}
                            {isSubAppt ? " (plano)" : ""}
                          </Text>
                          {priceLabel ? <Text style={{ color: "#C9A84C88", fontSize: 11, marginTop: 2 }}>{priceLabel}</Text> : null}
                        </View>
                      );
                    })()}
                    <Pressable
                      style={[styles.saveBtn, { marginBottom: 16, opacity: editServices.length === 0 ? 0.5 : 1 }]}
                      onPress={() => {
                        if (editServices.length === 0) {
                          toast.info("Selecione ao menos um serviço.");
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
