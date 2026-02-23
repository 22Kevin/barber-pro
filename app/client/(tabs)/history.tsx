import { useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useClientAuth } from "@/lib/client-auth-context";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Agendado", color: "#EAB308", bg: "#1F1500" },
  confirmed: { label: "Confirmado", color: "#22C55E", bg: "#052e16" },
  in_progress: { label: "Em andamento", color: "#3B82F6", bg: "#0c1a2e" },
  completed: { label: "Concluído", color: "#9CA3AF", bg: "#111827" },
  cancelled: { label: "Cancelado", color: "#EF4444", bg: "#1c0a0a" },
  no_show: { label: "Não compareceu", color: "#F97316", bg: "#1c0e00" },
};

function ReviewModal({ appointment, onClose }: { appointment: any; onClose: () => void }) {
  const { client } = useClientAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { TextInput } = require("react-native");

  const createReview = trpc.reviews.create.useMutation({
    onSuccess: () => { Alert.alert("Obrigado!", "Sua avaliação foi enviada."); onClose(); },
    onError: (err: any) => Alert.alert("Erro", err.message),
  });

  if (!client) return null;

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end", zIndex: 100 }}>
      <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 20, marginBottom: 6 }}>Avaliar serviço</Text>
        <Text style={{ color: "#9CA3AF", marginBottom: 20 }}>{appointment.serviceName ?? "Serviço"}</Text>

        <Text style={{ color: "#fff", fontWeight: "600", marginBottom: 12 }}>Sua nota</Text>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity key={s} onPress={() => setRating(s)}>
              <Text style={{ fontSize: 36, color: s <= rating ? "#EAB308" : "#374151" }}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: "#fff", fontWeight: "600", marginBottom: 8 }}>Comentário (opcional)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Como foi sua experiência?"
          placeholderTextColor="#4B5563"
          multiline
          numberOfLines={3}
          style={{ backgroundColor: "#1F2937", color: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151", fontSize: 15, minHeight: 80 }}
        />

        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <TouchableOpacity onPress={onClose} style={{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#374151" }}>
            <Text style={{ color: "#9CA3AF", fontWeight: "600" }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => createReview.mutate({ clientId: client.id, serviceId: appointment.serviceId, appointmentId: appointment.id, rating, comment: comment || undefined })}
            disabled={createReview.isPending}
            style={{ flex: 1, backgroundColor: "#EAB308", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: "#000", fontWeight: "700" }}>{createReview.isPending ? "Enviando..." : "Enviar avaliação"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ClientHistory() {
  const router = useRouter();
  const { client, isAuthenticated } = useClientAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [reviewAppt, setReviewAppt] = useState<any>(null);

  const appointmentsQuery = trpc.clients.appointments.useQuery(
    { clientId: client?.id ?? 0 },
    { enabled: !!client }
  );

  if (!isAuthenticated) {
    return (
      <ScreenContainer containerClassName="bg-black">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20, marginBottom: 8, textAlign: "center" }}>Histórico de agendamentos</Text>
          <Text style={{ color: "#9CA3AF", textAlign: "center", marginBottom: 24 }}>Faça login para ver seus agendamentos e histórico de cortes.</Text>
          <TouchableOpacity
            style={{ backgroundColor: "#EAB308", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32 }}
            onPress={() => router.push("/client/login" as any)}
          >
            <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>Fazer login</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const now = new Date();
  const allAppts = appointmentsQuery.data ?? [];
  const upcoming = allAppts.filter((a: any) => {
    const d = new Date(a.date + "T" + a.startTime);
    return d >= now && a.status !== "cancelled" && a.status !== "no_show";
  });
  const past = allAppts.filter((a: any) => {
    const d = new Date(a.date + "T" + a.startTime);
    return d < now || a.status === "cancelled" || a.status === "no_show" || a.status === "completed";
  });
  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <ScreenContainer containerClassName="bg-black">
      <View style={{ flex: 1 }}>
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 24, marginBottom: 16 }}>Meus Agendamentos</Text>
          <View style={{ flexDirection: "row", backgroundColor: "#111827", borderRadius: 12, padding: 4 }}>
            {[{ key: "upcoming", label: `Próximos (${upcoming.length})` }, { key: "past", label: `Histórico (${past.length})` }].map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key as any)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: tab === t.key ? "#EAB308" : "transparent" }}
              >
                <Text style={{ color: tab === t.key ? "#000" : "#9CA3AF", fontWeight: "600", fontSize: 13 }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {appointmentsQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#9CA3AF" }}>Carregando...</Text>
          </View>
        ) : displayed.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>{tab === "upcoming" ? "📅" : "📋"}</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 16, textAlign: "center" }}>
              {tab === "upcoming" ? "Nenhum agendamento próximo.\nAgende um horário agora!" : "Nenhum histórico ainda."}
            </Text>
            {tab === "upcoming" && (
              <TouchableOpacity
                style={{ backgroundColor: "#EAB308", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}
                onPress={() => router.push("/client/book" as any)}
              >
                <Text style={{ color: "#000", fontWeight: "700" }}>Agendar agora</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const status = STATUS_LABELS[item.status] ?? STATUS_LABELS.scheduled;
              const date = new Date(item.date + "T12:00:00");
              return (
                <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: "#1F2937" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{(item as any).serviceName ?? "Serviço"}</Text>
                      <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 2 }}>💈 {(item as any).barberName ?? "Barbeiro"}</Text>
                    </View>
                    <View style={{ backgroundColor: status.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: status.color, fontSize: 12, fontWeight: "600" }}>{status.label}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
                    <Text style={{ color: "#D1D5DB", fontSize: 14 }}>📅 {date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}</Text>
                    <Text style={{ color: "#D1D5DB", fontSize: 14 }}>⏰ {item.startTime}</Text>
                  </View>
                  {item.status === "completed" && (
                    <TouchableOpacity
                      onPress={() => setReviewAppt(item)}
                      style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#1F2937", paddingTop: 12 }}
                    >
                      <Text style={{ color: "#EAB308", fontWeight: "600", fontSize: 14 }}>⭐ Avaliar este serviço</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {reviewAppt && <ReviewModal appointment={reviewAppt} onClose={() => setReviewAppt(null)} />}
    </ScreenContainer>
  );
}
