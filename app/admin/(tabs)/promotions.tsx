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

type TargetAudience = "all" | "inactive_30" | "inactive_60" | "birthday_month" | "specific_client";

const AUDIENCE_OPTIONS: { value: TargetAudience; label: string; description: string; icon: string }[] = [
  { value: "all", label: "Todos os clientes", description: "Envia para toda a base de clientes ativos", icon: "person.3.fill" },
  { value: "inactive_30", label: "Inativos há 30 dias", description: "Clientes sem agendamento nos últimos 30 dias", icon: "clock.badge.exclamationmark" },
  { value: "inactive_60", label: "Inativos há 60 dias", description: "Clientes sem agendamento nos últimos 60 dias", icon: "clock.badge.xmark" },
  { value: "birthday_month", label: "Aniversariantes do mês", description: "Clientes que fazem aniversário este mês", icon: "gift.fill" },
  { value: "specific_client", label: "Cliente específico", description: "Escolha um cliente específico para receber a mensagem", icon: "person.crop.circle.badge.checkmark" },
];

function fmtDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PromotionsScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<TargetAudience>("all");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");

  const listQuery = trpc.promotions.list.useQuery();
  const clientsQuery = trpc.clients.list.useQuery(
    undefined,
    { enabled: audience === "specific_client" }
  );
  const sendMutation = trpc.promotions.send.useMutation({
    onSuccess: (data) => {
      Alert.alert(
        "Promoção enviada!",
        `Notificação enviada para ${data.recipientCount} cliente(s).`,
        [{ text: "OK" }]
      );
      listQuery.refetch();
      setModalVisible(false);
      setTitle("");
      setMessage("");
      setAudience("all");
      setClientSearch("");
      setSelectedClientId(null);
      setSelectedClientName("");
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  function handleSend() {
    if (!title.trim()) { Alert.alert("Atenção", "Informe um título."); return; }
    if (!message.trim()) { Alert.alert("Atenção", "Informe a mensagem."); return; }
    if (audience === "specific_client" && !selectedClientId) {
      Alert.alert("Atenção", "Selecione um cliente para enviar a mensagem.");
      return;
    }
    const selectedAudience = AUDIENCE_OPTIONS.find((a) => a.value === audience);
    const targetLabel = audience === "specific_client" ? selectedClientName : selectedAudience?.label;
    Alert.alert(
      "Confirmar envio",
      `Enviar "${title}" para: ${targetLabel}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: () =>
            sendMutation.mutate({
              title: title.trim(),
              message: message.trim(),
              targetAudience: audience,
              specificClientId: audience === "specific_client" ? selectedClientId : null,
              createdBy: barber?.id ?? 1,
            }),
        },
      ]
    );
  }

  const promotions = listQuery.data ?? [];

  const dyn = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 14,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    cardMessage: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
    cardMeta: { fontSize: 12, color: colors.muted, marginTop: 8 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      color: colors.foreground,
      fontSize: 14,
      marginBottom: 14,
    },
    label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6 },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
    audienceCard: {
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    sendBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      marginTop: 8,
    },
    sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader
        title="Promoções e Notícias"
        rightElement={
          <Pressable
            style={({ pressed }) => [styles.headerBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => setModalVisible(true)}
          >
            <IconSymbol name="megaphone.fill" size={18} color="#fff" />
            <Text style={styles.headerBtnText}>Nova</Text>
          </Pressable>
        }
      />

      {listQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : promotions.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="megaphone" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma promoção enviada</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Crie sua primeira promoção para engajar os clientes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={promotions}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ paddingTop: 80, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const aud = AUDIENCE_OPTIONS.find((a) => a.value === item.targetAudience);
            return (
              <View style={dyn.card}>
                <Text style={dyn.cardTitle}>{item.title}</Text>
                <Text style={dyn.cardMessage} numberOfLines={2}>{item.message}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.audienceBadge, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.audienceBadgeText, { color: colors.primary }]}>{aud?.label ?? item.targetAudience}</Text>
                  </View>
                  <Text style={dyn.cardMeta}>{item.recipientCount} destinatários · {fmtDate(item.sentAt)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal de criação */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={dyn.modalTitle}>Nova Promoção</Text>
            <Pressable onPress={() => setModalVisible(false)} style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={dyn.label}>Título da notificação</Text>
            <TextInput
              style={dyn.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Promoção de segunda-feira!"
              placeholderTextColor={colors.muted}
              returnKeyType="next"
            />

            <Text style={dyn.label}>Mensagem</Text>
            <TextInput
              style={[dyn.input, { minHeight: 90, textAlignVertical: "top" }]}
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Ex: Hoje temos 20% de desconto em todos os cortes! Agende agora."
              placeholderTextColor={colors.muted}
            />

            <Text style={[dyn.label, { marginBottom: 10 }]}>Público-alvo</Text>
            {AUDIENCE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  dyn.audienceCard,
                  {
                    backgroundColor: audience === opt.value ? colors.primary + "15" : colors.surface,
                    borderColor: audience === opt.value ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => setAudience(opt.value)}
              >
                <View style={[styles.audienceIcon, { backgroundColor: audience === opt.value ? colors.primary : colors.border }]}>
                  <IconSymbol name={opt.icon as any} size={18} color={audience === opt.value ? "#fff" : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{opt.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{opt.description}</Text>
                </View>
                {audience === opt.value && (
                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}

            {/* Campo de busca de cliente específico */}
            {audience === "specific_client" && (
              <View style={{ marginTop: 12, marginBottom: 4 }}>
                <Text style={[dyn.label, { marginBottom: 6 }]}>Buscar cliente</Text>
                <TextInput
                  style={dyn.input}
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  placeholder="Digite o nome ou telefone..."
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                />
                {selectedClientId ? (
                  <View style={[styles.selectedClientBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
                    <IconSymbol name="person.crop.circle.fill" size={16} color={colors.primary} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.primary }}>{selectedClientName}</Text>
                    <Pressable onPress={() => { setSelectedClientId(null); setSelectedClientName(""); setClientSearch(""); }}>
                      <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                ) : clientSearch.trim().length > 0 ? (
                  <View style={[styles.clientDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {clientsQuery.isLoading ? (
                      <ActivityIndicator color={colors.primary} style={{ padding: 12 }} />
                    ) : (
                      (clientsQuery.data ?? []).filter((c: any) =>
                        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                        (c.phone ?? "").includes(clientSearch)
                      ).slice(0, 8).map((c: any) => (
                        <Pressable
                          key={c.id}
                          style={({ pressed }) => [styles.clientOption, { opacity: pressed ? 0.7 : 1 }]}
                          onPress={() => { setSelectedClientId(c.id); setSelectedClientName(c.name); setClientSearch(""); }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{c.name}</Text>
                          {c.phone ? <Text style={{ fontSize: 12, color: colors.muted }}>{c.phone}</Text> : null}
                        </Pressable>
                      ))
                    )}
                    {!clientsQuery.isLoading && (clientsQuery.data ?? []).filter((c: any) =>
                      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                      (c.phone ?? "").includes(clientSearch)
                    ).length === 0 && (
                      <Text style={{ padding: 12, color: colors.muted, fontSize: 13 }}>Nenhum cliente encontrado.</Text>
                    )}
                  </View>
                ) : null}
              </View>
            )}

            <Pressable
              style={({ pressed }) => [dyn.sendBtn, { opacity: pressed || sendMutation.isPending ? 0.7 : 1 }]}
              onPress={handleSend}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={dyn.sendBtnText}>Enviar Promoção</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  audienceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  audienceBadgeText: { fontSize: 11, fontWeight: "700" },
  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  closeBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  audienceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  selectedClientBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 4,
  },
  clientDropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  clientOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
});
