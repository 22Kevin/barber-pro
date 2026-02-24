import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Share, Text, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";
import { sendConfirmationWhatsApp, type AppointmentInfo } from "@/lib/whatsapp";
import { scheduleAppointmentReminder, notifyBarberNewAppointment, scheduleReviewNotification } from "@/lib/use-notifications";
import { DiscountSheet, type AppliedDiscount } from "@/components/discount-sheet";

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
  const [pendingApptId, setPendingApptId] = useState<number | null>(null);
  const [isOpeningPayment, setIsOpeningPayment] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [showDiscountSheet, setShowDiscountSheet] = useState(false);

  const servicesQuery = trpc.services.list.useQuery({ activeOnly: true });
  const barbersQuery = trpc.barbers.list.useQuery();
  const slotsQuery = trpc.slots.available.useQuery(
    { barberId: selectedBarber?.id ?? 0, date: selectedDate ? formatDate(selectedDate) : "", durationMinutes: selectedService?.durationMinutes ?? 30 },
    { enabled: !!selectedBarber && !!selectedDate && !!selectedService }
  );

  // Verificar cupons/recompensas disponíveis para o banner proativo
  const orderValue = selectedService ? parseFloat(selectedService.price) : 0;
  const availableDiscountsQuery = trpc.coupons.getAvailableForClient.useQuery(
    { clientId: client?.id ?? null, orderValue },
    { enabled: !!selectedService && isAuthenticated }
  );
  const hasAvailableDiscounts =
    (availableDiscountsQuery.data?.coupons?.length ?? 0) > 0 ||
    (availableDiscountsQuery.data?.redeemableRewards?.length ?? 0) > 0;

  const createPreference = trpc.payments.createPreference.useMutation();

  const createAppointment = trpc.appointments.create.useMutation({
    onSuccess: async (apptId) => {
      const numApptId = typeof apptId === "number" ? apptId : Number(apptId);
      setPendingApptId(numApptId);

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
        sendConfirmationWhatsApp(info).catch(() => null);

        const [hours, minutes] = selectedSlot.startTime.split(":").map(Number);
        const appointmentDateTime = new Date(selectedDate);
        appointmentDateTime.setHours(hours, minutes, 0, 0);
        scheduleAppointmentReminder(numApptId, selectedService.name, selectedBarber.name, appointmentDateTime).catch(() => null);
        notifyBarberNewAppointment(client.name, selectedService.name, appointmentDateTime, numApptId).catch(() => null);
        scheduleReviewNotification(numApptId, selectedService.name, selectedBarber.name, appointmentDateTime).catch(() => null);
      }
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

  // Calcular valor final com desconto
  const basePrice = selectedService ? parseFloat(selectedService.price) : 0;
  const discountAmount = appliedDiscount?.discountAmount ?? 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

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

  const handlePayOnline = async () => {
    if (!pendingApptId || !client || !selectedService || !selectedBarber || !selectedDate || !selectedSlot) return;
    setIsOpeningPayment(true);
    try {
      const result = await createPreference.mutateAsync({
        appointmentId: pendingApptId,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: finalPrice,
        clientName: client.name,
        clientEmail: client.email ?? undefined,
        barberId: selectedBarber.id,
        clientId: client.id,
        date: formatDate(selectedDate),
        startTime: selectedSlot.startTime,
      });

      const url = result.initPoint ?? result.sandboxInitPoint;
      if (url) {
        if (Platform.OS === "web") {
          window.open(url, "_blank");
        } else {
          await Linking.openURL(url);
        }
        Alert.alert(
          "Pagamento iniciado",
          "Complete o pagamento no navegador. Seu agendamento será confirmado automaticamente após a aprovação.",
          [
            { text: "Ver meus agendamentos", onPress: () => router.replace("/client/(tabs)/history" as any) },
            { text: "Início", onPress: () => router.replace("/client/(tabs)/home" as any) },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert("Erro ao gerar pagamento", err.message ?? "Tente novamente.");
    } finally {
      setIsOpeningPayment(false);
    }
  };

  const handlePayPix = () => {
    if (!pendingApptId || !client || !selectedService || !selectedBarber || !selectedDate || !selectedSlot) return;
    router.push({
      pathname: "/client/pix-payment" as any,
      params: {
        serviceId: String(selectedService.id),
        serviceName: selectedService.name,
        servicePrice: String(finalPrice),
        clientName: client.name,
        clientEmail: client.email ?? "",
        clientId: String(client.id),
        barberId: String(selectedBarber.id),
        appointmentId: String(pendingApptId),
        date: formatDate(selectedDate),
        startTime: selectedSlot.startTime,
      },
    });
  };

  const handlePayOnSite = () => {
    Alert.alert(
      "Agendamento confirmado!",
      "Você receberá uma confirmação pelo WhatsApp e um lembrete 1 hora antes. O pagamento será realizado na barbearia.",
      [
        { text: "Ver meus agendamentos", onPress: () => router.replace("/client/(tabs)/history" as any) },
        { text: "Início", onPress: () => router.replace("/client/(tabs)/home" as any) },
      ]
    );
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

  // Tela de seleção de forma de pagamento (após criar o agendamento)
  if (pendingApptId !== null) {
    return (
      <ScreenContainer containerClassName="bg-black">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20 }}>
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>✅</Text>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22, textAlign: "center" }}>Agendamento criado!</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", marginTop: 6 }}>
              Como você prefere pagar?
            </Text>
          </View>

          {/* Resumo */}
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#1F2937", gap: 10, marginBottom: 24 }}>
            {[
              { label: "Serviço", value: selectedService?.name },
              { label: "Barbeiro", value: selectedBarber?.name },
              { label: "Data", value: selectedDate?.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) },
              { label: "Horário", value: selectedSlot ? `${selectedSlot.startTime} — ${selectedSlot.endTime}` : "" },
              ...(appliedDiscount ? [
                { label: "Subtotal", value: `R$ ${basePrice.toFixed(2).replace(".", ",")}` },
                { label: `Desconto (${appliedDiscount.type === "coupon" ? appliedDiscount.code : (appliedDiscount as any).rewardName})`, value: `− R$ ${discountAmount.toFixed(2).replace(".", ",")}` },
              ] : []),
              { label: "Total", value: `R$ ${finalPrice.toFixed(2).replace(".", ",")}` },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: item.label === "Total" ? "#EAB308" : "#9CA3AF", fontSize: 14, fontWeight: item.label === "Total" ? "700" : "400" }}>{item.label}</Text>
                <Text style={{ color: item.label === "Total" ? "#EAB308" : item.label.startsWith("Desconto") ? "#4ADE80" : "#fff", fontWeight: item.label === "Total" ? "800" : "600", fontSize: 14, textAlign: "right", flex: 1, marginLeft: 16 }}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Opção 1: Pagar online */}
          <TouchableOpacity
            onPress={handlePayOnline}
            disabled={isOpeningPayment || createPreference.isPending}
            style={{
              backgroundColor: "#009EE3",
              borderRadius: 16,
              padding: 20,
              marginBottom: 12,
              alignItems: "center",
              opacity: (isOpeningPayment || createPreference.isPending) ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 4 }}>
              {(isOpeningPayment || createPreference.isPending) ? "Gerando link..." : "💳 Pagar agora (online)"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
              Pix, cartão de crédito ou débito via Mercado Pago
            </Text>
          </TouchableOpacity>

          {/* Opção 2: Pix QR Code */}
          <TouchableOpacity
            onPress={handlePayPix}
            disabled={isOpeningPayment}
            style={{
              backgroundColor: "#32BCAD",
              borderRadius: 16,
              padding: 20,
              marginBottom: 12,
              alignItems: "center",
              opacity: isOpeningPayment ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 4 }}>
              📱 Pagar via Pix (QR Code)
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
              Escaneie o QR Code com qualquer banco
            </Text>
          </TouchableOpacity>

          {/* Opção 3: Pagar no local */}
          <TouchableOpacity
            onPress={handlePayOnSite}
            style={{
              backgroundColor: "#111827",
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#1F2937",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 4 }}>
              💵 Pagar na barbearia
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
              Dinheiro, cartão ou Pix no local
            </Text>
          </TouchableOpacity>

          {/* Compartilhar agendamento */}
          <TouchableOpacity
            onPress={() => {
              const dateStr = selectedDate?.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) ?? "";
              const msg = [
                "💈 *Agendamento confirmado!*",
                "",
                `✂️ *Serviço:* ${selectedService?.name}`,
                `👤 *Barbeiro:* ${selectedBarber?.name}`,
                `📅 *Data:* ${dateStr}`,
                `⏰ *Horário:* ${selectedSlot?.startTime} — ${selectedSlot?.endTime}`,
                `💰 *Valor:* R$ ${finalPrice.toFixed(2).replace(".", ",")}`,
                "",
                "Agendado pelo app da barbearia 😎",
              ].join("\n");
              Share.share({ message: msg });
            }}
            style={{
              backgroundColor: "#0D1F0D",
              borderRadius: 16,
              padding: 16,
              alignItems: "center",
              marginTop: 12,
              borderWidth: 1,
              borderColor: "#25D366",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 20 }}>💬</Text>
            <Text style={{ color: "#25D366", fontWeight: "700", fontSize: 15 }}>Compartilhar agendamento</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

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

      {/* Banner proativo de desconto — aparece quando o cliente tem cupons/recompensas disponíveis */}
      {step === "confirm" && isAuthenticated && hasAvailableDiscounts && !appliedDiscount && (
        <TouchableOpacity
          onPress={() => setShowDiscountSheet(true)}
          style={{
            marginHorizontal: 20,
            marginBottom: 8,
            backgroundColor: "#1A1200",
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: "#EAB308",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 22 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#EAB308", fontWeight: "700", fontSize: 14 }}>Você tem descontos disponíveis!</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>Toque para aplicar um cupom ou resgatar pontos</Text>
          </View>
          <Text style={{ color: "#EAB308", fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      )}

      {/* Banner de desconto aplicado */}
      {step === "confirm" && appliedDiscount && (
        <TouchableOpacity
          onPress={() => setShowDiscountSheet(true)}
          style={{
            marginHorizontal: 20,
            marginBottom: 8,
            backgroundColor: "#0D1F0D",
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: "#4ADE80",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 22 }}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#4ADE80", fontWeight: "700", fontSize: 14 }}>
              Desconto aplicado: − R$ {discountAmount.toFixed(2).replace(".", ",")}
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>
              {appliedDiscount.type === "coupon" ? `Cupom: ${appliedDiscount.code}` : `Recompensa: ${(appliedDiscount as any).rewardName}`}
              {" · "}Toque para alterar
            </Text>
          </View>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); setAppliedDiscount(null); }}
            style={{ padding: 4 }}
          >
            <Text style={{ color: "#6B7280", fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* STEP 1: Serviço */}
        {step === "service" && (
          <View>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20, marginBottom: 16 }}>Escolha o serviço</Text>
            {servicesQuery.isLoading ? <Text style={{ color: "#9CA3AF" }}>Carregando...</Text> : null}
            {(servicesQuery.data ?? []).map((svc: any) => (
              <TouchableOpacity
                key={svc.id}
                onPress={() => { setSelectedService(svc); setAppliedDiscount(null); setStep("barber"); }}
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
                ...(appliedDiscount ? [
                  { label: "Subtotal", value: `R$ ${basePrice.toFixed(2).replace(".", ",")}` },
                  { label: "Desconto", value: `− R$ ${discountAmount.toFixed(2).replace(".", ",")}` },
                ] : []),
                { label: "Valor", value: `R$ ${finalPrice.toFixed(2).replace(".", ",")}` },
              ].map((item) => (
                <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#9CA3AF", fontSize: 14 }}>{item.label}</Text>
                  <Text style={{ color: item.label === "Desconto" ? "#4ADE80" : "#fff", fontWeight: "600", fontSize: 14, textAlign: "right", flex: 1, marginLeft: 16 }}>{item.value}</Text>
                </View>
              ))}
            </View>

            {/* Botão de desconto — aparece se não há desconto aplicado */}
            {isAuthenticated && !appliedDiscount && (
              <TouchableOpacity
                onPress={() => setShowDiscountSheet(true)}
                style={{
                  backgroundColor: "#111827",
                  borderRadius: 14,
                  padding: 14,
                  marginTop: 14,
                  borderWidth: 1,
                  borderColor: "#374151",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 18 }}>🏷️</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 14, flex: 1 }}>Tenho um cupom ou quero usar pontos</Text>
                <Text style={{ color: "#6B7280", fontSize: 16 }}>›</Text>
              </TouchableOpacity>
            )}

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

      {/* DiscountSheet — bottom sheet para aplicar cupons e recompensas */}
      <DiscountSheet
        visible={showDiscountSheet}
        onClose={() => setShowDiscountSheet(false)}
        onApply={(discount) => {
          setAppliedDiscount(discount);
          setShowDiscountSheet(false);
        }}
        orderValue={basePrice}
        clientId={client?.id ?? null}
        currentDiscount={appliedDiscount}
      />
    </ScreenContainer>
  );
}
