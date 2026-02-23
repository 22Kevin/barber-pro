import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";
import { sendConfirmationWhatsApp, type AppointmentInfo } from "@/lib/whatsapp";
import { scheduleAppointmentReminder } from "@/lib/use-notifications";

type Step = "service" | "barber" | "date" | "time" | "confirm";

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getDatesForNextDays(days = 30): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ serviceId?: string }>();
  const { client, isAuthenticated } = useClientAuth();

  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [notes, setNotes] = useState("");

  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true });
  const barbersQuery = trpc.barbers.list.useQuery();
  const slotsQuery = trpc.slots.available.useQuery(
    { barberId: selectedBarber?.id ?? 0, date: selectedDate ? formatDate(selectedDate) : "", durationMinutes: selectedService?.durationMinutes ?? 30 },
    { enabled: !!selectedBarber && !!selectedDate && !!selectedService }
  );

  const createAppointment = trpc.appointments.create.useMutation({
    onSuccess: async (apptId) => {
      if (client && selectedBarber && selectedService && selectedDate && selectedSlot) {
        const info: AppointmentInfo = {
          clientName: client.name,
          clientPhone: client.phone,
          serviceName: selectedService.name,
          barberName: selectedBarber.name,
          date: formatDate(selectedDate),
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
        };
        // Envia confirmação via WhatsApp
        sendConfirmationWhatsApp(info).catch(() => null);

        // Agenda notificação push 1 hora antes do agendamento
        const [hours, minutes] = selectedSlot.startTime.split(":").map(Number);
        const appointmentDateTime = new Date(selectedDate);
        appointmentDateTime.setHours(hours, minutes, 0, 0);
        scheduleAppointmentReminder(
          typeof apptId === "number" ? apptId : Number(apptId),
          selectedService.name,
          selectedBarber.name,
          appointmentDateTime
        ).catch(() => null);
      }
      Alert.alert("✅ Agendamento confirmado!", "Você receberá uma confirmação pelo WhatsApp e um lembrete 1 hora antes.", [
        { text: "Ver meus agendamentos", onPress: () => router.replace("/client/(tabs)/history" as any) },
        { text: "Início", onPress: () => router.replace("/client/(tabs)/home" as any) },
      ]);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  // Pre-select service from params
  useEffect(() => {
    if (params.serviceId && servicesQuery.data) {
      const svc = servicesQuery.data.find((s: any) => String(s.id) === params.serviceId);
      if (svc) { setSelectedService(svc); setStep("barber"); }
    }
  }, [params.serviceId, servicesQuery.data]);

  const handleConfirm = () => {
    if (!isAuthenticated) {
      Alert.alert("Login necessário", "Faça login para confirmar o agendamento.", [
        { text: "Fazer login", onPress: () => router.push("/client/login" as any) },
        { text: "Cancelar" },
      ]);
      return;
    }
    if (!client || !selectedService || !selectedBarber || !selectedDate || !selectedSlot) return;
    createAppointment.mutate({
      clientId: client.id,
      barberId: selectedBarber.id,
      serviceId: selectedService.id,
      date: formatDate(selectedDate),
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      notes: notes || undefined,
      status: "scheduled",
    });
  };

  const StepIndicator = () => {
    const steps: Step[] = ["service", "barber", "date", "time", "confirm"];
    const labels = ["Serviço", "Barbeiro", "Data", "Horário", "Confirmar"];
    const currentIdx = steps.indexOf(step);
    return (
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, paddingVertical: 16 }}>
        {steps.map((s, i) => (
          <View key={s} style={{ alignItems: "center" }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i <= currentIdx ? "#EAB308" : "#1F2937", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: i <= currentIdx ? "#000" : "#6B7280", fontWeight: "700", fontSize: 12 }}>{i + 1}</Text>
            </View>
            <Text style={{ color: i <= currentIdx ? "#EAB308" : "#6B7280", fontSize: 10, marginTop: 2 }}>{labels[i]}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-black">
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 }}>
        <TouchableOpacity onPress={() => {
          if (step === "service") router.back();
          else {
            const steps: Step[] = ["service", "barber", "date", "time", "confirm"];
            const idx = steps.indexOf(step);
            setStep(steps[idx - 1]);
          }
        }} style={{ padding: 8 }}>
          <Text style={{ color: "#EAB308", fontSize: 16 }}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18, marginLeft: 8 }}>Agendar</Text>
      </View>

      <StepIndicator />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* STEP 1: Serviço */}
        {step === "service" && (
          <View>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20, marginBottom: 16 }}>Escolha o serviço</Text>
            {servicesQuery.isLoading ? <Text style={{ color: "#9CA3AF" }}>Carregando...</Text> : null}
            {(servicesQuery.data ?? []).map((svc: any) => (
              <TouchableOpacity
                key={svc.id}
                onPress={() => { setSelectedService(svc); setStep("barber"); }}
                style={{ backgroundColor: "#111827", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: selectedService?.id === svc.id ? "#EAB308" : "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{svc.name}</Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 2 }}>⏱ {svc.durationMinutes} min</Text>
                </View>
                <Text style={{ color: "#EAB308", fontWeight: "700", fontSize: 16 }}>R$ {parseFloat(svc.price).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 2: Barbeiro */}
        {step === "barber" && (
          <View>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20, marginBottom: 16 }}>Escolha o barbeiro</Text>
            {(barbersQuery.data ?? []).filter((b: any) => b.isActive && b.role !== "receptionist").map((barber: any) => (
              <TouchableOpacity
                key={barber.id}
                onPress={() => { setSelectedBarber(barber); setStep("date"); }}
                style={{ backgroundColor: "#111827", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: selectedBarber?.id === barber.id ? "#EAB308" : "#1F2937", flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 24 }}>💈</Text>
                </View>
                <View>
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{barber.name}</Text>
                  {barber.specialties ? <Text style={{ color: "#9CA3AF", fontSize: 13 }}>{barber.specialties}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 3: Data */}
        {step === "date" && (
          <View>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20, marginBottom: 16 }}>Escolha a data</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {getDatesForNextDays(30).map((d) => {
                const isSelected = selectedDate && formatDate(d) === formatDate(selectedDate);
                const isToday = formatDate(d) === formatDate(new Date());
                return (
                  <TouchableOpacity
                    key={formatDate(d)}
                    onPress={() => { setSelectedDate(d); setSelectedSlot(null); setStep("time"); }}
                    style={{ width: 72, backgroundColor: isSelected ? "#EAB308" : "#111827", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, borderColor: isSelected ? "#EAB308" : "#1F2937" }}
                  >
                    <Text style={{ color: isSelected ? "#000" : "#9CA3AF", fontSize: 11, fontWeight: "600" }}>{DAYS_PT[d.getDay()]}</Text>
                    <Text style={{ color: isSelected ? "#000" : "#fff", fontSize: 20, fontWeight: "800" }}>{d.getDate()}</Text>
                    <Text style={{ color: isSelected ? "#000" : "#9CA3AF", fontSize: 11 }}>{MONTHS_PT[d.getMonth()]}</Text>
                    {isToday && <Text style={{ color: isSelected ? "#000" : "#EAB308", fontSize: 10, fontWeight: "700" }}>Hoje</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 4: Horário */}
        {step === "time" && (
          <View>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20, marginBottom: 4 }}>Escolha o horário</Text>
            {selectedDate && <Text style={{ color: "#9CA3AF", marginBottom: 16 }}>{selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</Text>}
            {slotsQuery.isLoading ? (
              <Text style={{ color: "#9CA3AF" }}>Verificando disponibilidade...</Text>
            ) : slotsQuery.data?.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>😔</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 16, textAlign: "center" }}>Nenhum horário disponível nesta data. Tente outro dia.</Text>
                <TouchableOpacity onPress={() => setStep("date")} style={{ marginTop: 16 }}>
                  <Text style={{ color: "#EAB308" }}>← Escolher outra data</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {(slotsQuery.data ?? []).map((slot: any) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <TouchableOpacity
                      key={slot.startTime}
                      onPress={() => { setSelectedSlot(slot); setStep("confirm"); }}
                      style={{ backgroundColor: isSelected ? "#EAB308" : "#111827", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: isSelected ? "#EAB308" : "#1F2937" }}
                    >
                      <Text style={{ color: isSelected ? "#000" : "#fff", fontWeight: "600", fontSize: 15 }}>{slot.startTime}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* STEP 5: Confirmação */}
        {step === "confirm" && selectedService && selectedBarber && selectedDate && selectedSlot && (
          <View>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20, marginBottom: 20 }}>Confirmar agendamento</Text>

            <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#1F2937", gap: 14 }}>
              {[
                { label: "Serviço", value: selectedService.name },
                { label: "Barbeiro", value: selectedBarber.name },
                { label: "Data", value: selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
                { label: "Horário", value: `${selectedSlot.startTime} — ${selectedSlot.endTime}` },
                { label: "Duração", value: `${selectedService.durationMinutes} minutos` },
                { label: "Valor", value: `R$ ${parseFloat(selectedService.price).toFixed(2)}` },
              ].map((item) => (
                <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#9CA3AF", fontSize: 14 }}>{item.label}</Text>
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14, textAlign: "right", flex: 1, marginLeft: 16 }}>{item.value}</Text>
                </View>
              ))}
            </View>

            {!isAuthenticated && (
              <View style={{ backgroundColor: "#1F1500", borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: "#EAB308" }}>
                <Text style={{ color: "#EAB308", fontSize: 14, textAlign: "center" }}>⚠️ Faça login para confirmar o agendamento e receber confirmação pelo WhatsApp.</Text>
              </View>
            )}

            <TouchableOpacity
              style={{ backgroundColor: "#EAB308", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 24, opacity: createAppointment.isPending ? 0.7 : 1 }}
              onPress={handleConfirm}
              disabled={createAppointment.isPending}
            >
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
                {createAppointment.isPending ? "Confirmando..." : isAuthenticated ? "✓ Confirmar agendamento" : "Fazer login para confirmar"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
