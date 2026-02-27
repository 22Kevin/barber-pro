import { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBarberAuth } from "@/lib/auth-context";
import { AdminHeader } from "@/components/admin-header";
import { SwipeableAppointmentCard } from "@/components/swipeable-appointment-card";
import { PaymentStatusModal } from "@/components/payment-status-modal";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { trpc } from "@/lib/trpc";
import { scheduleAppointmentReminder, cancelAppointmentReminder, clearAppBadge } from "@/lib/use-notifications";

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:   { label: "Agendado",     color: "#C9A84C" },
  confirmed:   { label: "Confirmado",   color: "#4CAF50" },
  in_progress: { label: "Em andamento", color: "#2196F3" },
  completed:   { label: "Concluído",    color: "#888880" },
  cancelled:   { label: "Cancelado",    color: "#F44336" },
  no_show:     { label: "Não compareceu", color: "#FF9800" },
};

function dateToString(d: Date) {
  return d.toISOString().split("T")[0];
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

  // Zera o badge do ícone do app ao abrir a tela de agenda
  useEffect(() => {
    clearAppBadge().catch(() => null);
  }, []);
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
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelApptId, setCancelApptId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  // Filtro de barbeiro para managers (null = todos)
  const [filterBarberId, setFilterBarberId] = useState<number | null>(null);
  const isManager = barber?.role === "super_admin" || barber?.role === "receptionist";

  const dateStr = dateToString(selectedDate);
  const utils = trpc.useUtils();

  const tenantId = barber?.tenantId ?? undefined;
  const barbersQuery = trpc.barbers.list.useQuery();
  const clientsQuery = trpc.clients.list.useQuery();
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true, tenantId });
  const appointmentsQuery = trpc.appointments.byDate.useQuery(
    { barberId: barber?.id ?? 0, date: dateStr },
    { enabled: !!barber?.id && !isManager }
  );
  const allAppointmentsQuery = trpc.appointments.allByDate.useQuery(
    { date: dateStr, tenantId },
    { enabled: isManager }
  );
  const workingHoursQuery = trpc.barbers.workingHours.get.useQuery(
    { barberId: barber?.id ?? 0 },
    { enabled: !!barber?.id }
  );

  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: async (apptId) => {
      utils.appointments.byDate.invalidate();
      utils.dashboard.stats.invalidate();

      // Agenda notificação push 1 hora antes (se o cliente tiver o app instalado)
      if (selectedService && selectedTime) {
        const [hours, minutes] = selectedTime.split(":").map(Number);
        const appointmentDateTime = new Date(selectedDate);
        appointmentDateTime.setHours(hours, minutes, 0, 0);
        scheduleAppointmentReminder(
          typeof apptId === "number" ? apptId : Number(apptId),
          selectedService.name,
          barber?.name ?? "Barbeiro",
          appointmentDateTime
        ).catch(() => null);
      }

      closeNewModal();
      Alert.alert("Sucesso", "Agendamento criado! O cliente receberá um lembrete 1 hora antes.");
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const updateMutation = trpc.appointments.update.useMutation({
    onSuccess: (_data: unknown, variables: any) => {
      if (variables.status === "cancelled" || variables.status === "no_show") {
        cancelAppointmentReminder(variables.id).catch(() => null);
      }
      utils.appointments.byDate.invalidate();
      utils.dashboard.stats.invalidate();
      setShowDetailModal(false);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const cancelWithReasonMutation = trpc.appointments.cancelWithReason.useMutation({
    onSuccess: () => {
      utils.appointments.byDate.invalidate();
      utils.dashboard.stats.invalidate();
      setShowCancelModal(false);
      setCancelReason("");
      setCancelApptId(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
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

  function closeNewModal() {
    setShowNewModal(false);
    setSelectedClient(null); setSelectedService(null); setSelectedTime(""); setNotes(""); setClientSearch("");
  }

  function handleCreateAppointment() {
    if (!selectedClient) { Alert.alert("Atenção", "Selecione um cliente."); return; }
    if (!selectedService) { Alert.alert("Atenção", "Selecione um serviço."); return; }
    if (!selectedTime) { Alert.alert("Atenção", "Selecione um horário."); return; }
    const endTime = addMinutes(selectedTime, selectedService.durationMinutes);
    createMutation.mutate({
      clientId: selectedClient.id,
      barberId: barber?.id ?? 0,
      serviceId: selectedService.id,
      date: dateStr,
      startTime: selectedTime,
      endTime,
      notes: notes || null,
      status: "scheduled",
    });
  }

  function handleStatusChange(id: number, status: string) {
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
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setShowNewModal(true)}
          >
            <IconSymbol name="plus" size={20} color="#0A0A0A" />
            <Text style={styles.addBtnText}>Novo</Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false}>

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
            {daysInMonth().map((day, idx) => (
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
                  <Text style={[
                    styles.dayText,
                    isSelected(day) && styles.dayTextSelected,
                    isToday(day) && !isSelected(day) && styles.dayTextToday,
                  ]}>
                    {day.getDate()}
                  </Text>
                ) : null}
              </Pressable>
            ))}
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
          <Text style={styles.sectionTitle}>
            {DAYS_PT[selectedDate.getDay()]}, {selectedDate.getDate()} de {MONTHS_PT[selectedDate.getMonth()]}
          </Text>
          <Text style={styles.sectionCount}>{appointments.length} agendamento(s)</Text>
        </View>

        {isLoadingAppointments ? (
          <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
        ) : appointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <IconSymbol name="calendar" size={36} color="#2A2A2A" />
            <Text style={styles.emptyText}>Nenhum agendamento neste dia</Text>
          </View>
        ) : (
          <GestureHandlerRootView>
            {appointments.map((apt) => {
              const client = (clientsQuery.data ?? []).find(c => c.id === apt.clientId);
              const service = (servicesQuery.data ?? []).find(s => s.id === apt.serviceId);
              return (
<SwipeableAppointmentCard
                  key={apt.id}
                  appointment={apt}
                  client={client}
                  service={service}
                  onPress={() => {
                    if (apt.status === "completed") {
                      // Ao tocar num card concluído, abre o modal de pagamento
                      const svc = (servicesQuery.data ?? []).find(s => s.id === apt.serviceId);
                      setPaymentAppointment({
                        ...apt,
                        clientName: client?.name,
                        clientPhone: client?.phone,
                        serviceName: svc?.name ?? "Serviço",
                        servicePrice: svc?.price ?? "0",
                        serviceId: apt.serviceId,
                      });
                      setShowPaymentModal(true);
                    } else {
                      setSelectedAppointment({ ...apt, client, service });
                      setShowDetailModal(true);
                    }
                  }}
                  onStatusChange={handleStatusChange}
                  onCompleted={handleAppointmentCompleted}
                  onCancelWithReason={handleCancelWithReason}
                  paymentPending={apt.status === "completed" ? (paymentPendingMap[apt.id] ?? true) : undefined}
                />
              );
            })}
          </GestureHandlerRootView>
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

                <Text style={styles.fieldLabel}>Serviço *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(servicesQuery.data ?? []).map(s => (
                      <Pressable
                        key={s.id}
                        style={[styles.serviceChip, selectedService?.id === s.id && styles.serviceChipActive]}
                        onPress={() => setSelectedService(s)}
                      >
                        <Text style={[styles.serviceChipText, selectedService?.id === s.id && styles.serviceChipTextActive]}>{s.name}</Text>
                        <Text style={[styles.serviceChipPrice, selectedService?.id === s.id && { color: "#C9A84C" }]}>
                          R$ {parseFloat(s.price).toFixed(2).replace(".", ",")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Text style={styles.fieldLabel}>Horário *</Text>
                {!workingDay?.isWorking ? (
                  <View style={styles.infoBox}>
                    <Text style={[styles.infoText, { color: "#F44336" }]}>Barbeiro não trabalha neste dia</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {timeSlots.map(slot => {
                        const isBooked = bookedTimes.has(slot);
                        return (
                          <Pressable
                            key={slot}
                            style={[styles.timeSlot, selectedTime === slot && styles.timeSlotActive, isBooked && styles.timeSlotBooked]}
                            onPress={() => !isBooked && setSelectedTime(slot)}
                            disabled={isBooked}
                          >
                            <Text style={[styles.timeSlotText, selectedTime === slot && styles.timeSlotTextActive, isBooked && styles.timeSlotTextBooked]}>
                              {slot}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
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
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cliente</Text>
                  <Text style={styles.detailValue}>{selectedAppointment.client?.name ?? "—"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Serviço</Text>
                  <Text style={styles.detailValue}>{selectedAppointment.service?.name ?? "—"}</Text>
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

                <Text style={[styles.fieldLabel, { marginTop: 16, marginBottom: 8 }]}>Alterar Status</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <Pressable
                      key={key}
                      style={[styles.statusChangeBtn, { borderColor: cfg.color }]}
                      onPress={() => handleStatusChange(selectedAppointment.id, key)}
                    >
                      <Text style={[styles.statusChangeBtnText, { color: cfg.color }]}>{cfg.label}</Text>
                    </Pressable>
                  ))}
                </View>
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
          utils.appointments.byDate.invalidate();
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

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#F5F5F0" },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
  calendarCard: { marginHorizontal: 16, backgroundColor: "#141414", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#2A2A2A", marginBottom: 16 },
  calendarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  calendarTitle: { fontSize: 16, fontWeight: "700", color: "#F5F5F0" },
  daysRow: { flexDirection: "row", marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 11, color: "#888880", fontWeight: "600" },
  daysGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.28%", aspectRatio: 1, justifyContent: "center", alignItems: "center", borderRadius: 8 },
  dayCellSelected: { backgroundColor: "#C9A84C" },
  dayCellToday: { borderWidth: 1, borderColor: "#C9A84C" },
  dayText: { fontSize: 13, color: "#F5F5F0" },
  dayTextSelected: { color: "#0A0A0A", fontWeight: "800" },
  dayTextToday: { color: "#C9A84C", fontWeight: "700" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#F5F5F0" },
  sectionCount: { fontSize: 13, color: "#888880" },
  emptyCard: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: "#888880", fontSize: 14 },
  aptCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#141414", borderRadius: 12, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "center", overflow: "hidden" },
  aptStatusBar: { width: 4, alignSelf: "stretch" },
  aptContent: { flex: 1, padding: 14 },
  aptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  aptTime: { fontSize: 15, fontWeight: "700", color: "#F5F5F0" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  aptClientName: { fontSize: 14, fontWeight: "600", color: "#F5F5F0" },
  aptServiceName: { fontSize: 13, color: "#888880" },
  aptNotes: { fontSize: 12, color: "#555", marginTop: 4, fontStyle: "italic" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#141414", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "92%", borderWidth: 1, borderColor: "#2A2A2A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F0" },
  fieldLabel: { fontSize: 13, color: "#888880", marginBottom: 6, fontWeight: "500" },
  infoBox: { backgroundColor: "#1E1E1E", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#2A2A2A" },
  infoText: { color: "#F5F5F0", fontSize: 14 },
  selectorBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1E1E1E", borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#2A2A2A" },
  selectorText: { color: "#F5F5F0", fontSize: 14 },
  selectorPlaceholder: { color: "#555", fontSize: 14 },
  serviceChip: { padding: 12, borderRadius: 10, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", minWidth: 120, alignItems: "center" },
  serviceChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  serviceChipText: { fontSize: 13, color: "#888880", fontWeight: "600", marginBottom: 4 },
  serviceChipTextActive: { color: "#C9A84C" },
  serviceChipPrice: { fontSize: 12, color: "#555" },
  timeSlot: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A" },
  timeSlotActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  timeSlotBooked: { backgroundColor: "#1E1E1E", borderColor: "#F4433633", opacity: 0.4 },
  timeSlotText: { fontSize: 13, color: "#F5F5F0", fontWeight: "600" },
  timeSlotTextActive: { color: "#C9A84C" },
  timeSlotTextBooked: { color: "#F44336" },
  input: { backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0", marginBottom: 14 },
  textarea: { height: 80, textAlignVertical: "top" },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  // Cliente picker
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E1E1E", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#2A2A2A", gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, color: "#F5F5F0", fontSize: 14 },
  clientItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center" },
  clientAvatarText: { color: "#C9A84C", fontSize: 16, fontWeight: "700" },
  clientName: { fontSize: 15, fontWeight: "600", color: "#F5F5F0" },
  clientPhone: { fontSize: 13, color: "#888880" },
  // Detalhe
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  detailLabel: { fontSize: 13, color: "#888880" },
  detailValue: { fontSize: 14, color: "#F5F5F0", fontWeight: "600", flex: 1, textAlign: "right" },
  statusChangeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  statusChangeBtnText: { fontSize: 12, fontWeight: "600" },
  // Filtro de barbeiro
  barberFilterWrapper: { paddingHorizontal: 16, paddingBottom: 12 },
  barberFilterScroll: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  barberFilterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A" },
  barberFilterChipActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C" },
  barberFilterChipText: { fontSize: 13, color: "#888880", fontWeight: "600" },
  barberFilterChipTextActive: { color: "#C9A84C" },
});
