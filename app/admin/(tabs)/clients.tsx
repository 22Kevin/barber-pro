import { useState } from "react";
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
import { trpc } from "@/lib/trpc";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

type Client = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  notes: string | null;
  isActive: boolean;
  totalPoints: number | null;
  createdAt: Date | string;
};

export default function ClientsScreen() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const clientsQuery = trpc.clients.list.useQuery();
  const clientAppointmentsQuery = trpc.clients.appointments.useQuery(
    { clientId: selectedClient?.id ?? 0 },
    { enabled: !!selectedClient }
  );
  const servicesQuery = trpc.services.list.useQuery({ activeOnly: false });

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); closeModal(); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); closeModal(); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  function openCreate() {
    setEditing(null);
    setName(""); setPhone(""); setEmail(""); setBirthDate(""); setNotes("");
    setShowModal(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setName(c.name); setPhone(c.phone); setEmail(c.email ?? ""); setBirthDate(c.birthDate ?? ""); setNotes(c.notes ?? "");
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Atenção", "Informe o nome do cliente."); return; }
    if (!phone.trim() || phone.length < 8) { Alert.alert("Atenção", "Informe um telefone válido."); return; }
    const data = { name: name.trim(), phone: phone.trim(), email: email.trim() || null, birthDate: birthDate.trim() || null, notes: notes.trim() || null };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate({ ...data, isActive: true } as any);
    }
  }

  function openDetail(c: Client) {
    setSelectedClient(c);
    setShowDetailModal(true);
  }

  const clients = (clientsQuery.data ?? []).filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  ) as Client[];

  const appointments = (clientAppointmentsQuery.data ?? []) as any[];
  const services = (servicesQuery.data ?? []) as any[];

  const getServiceName = (id: number) => services.find((s: any) => s.id === id)?.name ?? "Serviço";

  const STATUS_LABELS: Record<string, string> = {
    scheduled: "Agendado", confirmed: "Confirmado", in_progress: "Em andamento",
    completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu",
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Clientes</Text>
        <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={openCreate}>
          <IconSymbol name="person.badge.plus" size={18} color="#0A0A0A" />
          <Text style={styles.addBtnText}>Novo</Text>
        </Pressable>
      </View>

      {/* Busca */}
      <View style={styles.searchRow}>
        <IconSymbol name="magnifyingglass" size={18} color="#888880" />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar por nome ou telefone..." placeholderTextColor="#555" />
      </View>

      {/* Contador */}
      <Text style={styles.countText}>{clients.length} cliente(s)</Text>

      {/* Lista */}
      {clientsQuery.isLoading ? (
        <ActivityIndicator color="#C9A84C" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={clients}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <IconSymbol name="person.2.fill" size={40} color="#2A2A2A" />
              <Text style={styles.emptyText}>Nenhum cliente encontrado</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
              onPress={() => openDetail(item)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{item.name}</Text>
                <Text style={styles.clientPhone}>{item.phone}</Text>
                {item.email ? <Text style={styles.clientEmail}>{item.email}</Text> : null}
              </View>
              <View style={styles.cardRight}>
                {(item.totalPoints ?? 0) > 0 && (
                  <View style={styles.pointsBadge}>
                    <IconSymbol name="star.fill" size={11} color="#C9A84C" />
                    <Text style={styles.pointsText}>{item.totalPoints}</Text>
                  </View>
                )}
                <Pressable onPress={() => openEdit(item)} style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}>
                  <IconSymbol name="pencil" size={16} color="#C9A84C" />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Modal Criar/Editar */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? "Editar Cliente" : "Novo Cliente"}</Text>
                <Pressable onPress={closeModal}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {[
                  { label: "Nome completo *", value: name, setter: setName, placeholder: "João da Silva", keyboard: "default" as const },
                  { label: "Telefone/WhatsApp *", value: phone, setter: setPhone, placeholder: "(11) 99999-9999", keyboard: "phone-pad" as const },
                  { label: "E-mail", value: email, setter: setEmail, placeholder: "joao@email.com", keyboard: "email-address" as const },
                  { label: "Data de Nascimento (AAAA-MM-DD)", value: birthDate, setter: setBirthDate, placeholder: "1990-01-15", keyboard: "default" as const },
                ].map(field => (
                  <View key={field.label} style={{ marginBottom: 14 }}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput
                      style={styles.input}
                      value={field.value}
                      onChangeText={field.setter}
                      placeholder={field.placeholder}
                      placeholderTextColor="#555"
                      keyboardType={field.keyboard}
                      autoCapitalize={field.keyboard === "email-address" ? "none" : "words"}
                      autoCorrect={false}
                    />
                  </View>
                ))}
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.fieldLabel}>Observações</Text>
                  <TextInput style={[styles.input, styles.textarea]} value={notes} onChangeText={setNotes} placeholder="Preferências, alergias, etc..." placeholderTextColor="#555" multiline numberOfLines={3} />
                </View>
                <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveBtnText}>{editing ? "SALVAR" : "CADASTRAR"}</Text>}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Detalhe do Cliente */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Perfil do Cliente</Text>
              <Pressable onPress={() => setShowDetailModal(false)}><IconSymbol name="xmark" size={22} color="#888880" /></Pressable>
            </View>
            {selectedClient && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Info */}
                <View style={styles.clientDetailHeader}>
                  <View style={styles.avatarLarge}>
                    <Text style={styles.avatarLargeText}>{selectedClient.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{selectedClient.name}</Text>
                    <Text style={styles.detailPhone}>{selectedClient.phone}</Text>
                    {selectedClient.email ? <Text style={styles.detailEmail}>{selectedClient.email}</Text> : null}
                  </View>
                </View>

                {/* Pontos */}
                {(selectedClient.totalPoints ?? 0) > 0 && (
                  <View style={styles.pointsCard}>
                    <IconSymbol name="star.fill" size={20} color="#C9A84C" />
                    <Text style={styles.pointsCardText}>{selectedClient.totalPoints} pontos acumulados</Text>
                  </View>
                )}

                {/* Ações rápidas */}
                <View style={styles.quickActions}>
                  <Pressable
                    style={({ pressed }) => [styles.quickActionBtn, pressed && { opacity: 0.7 }]}
    onPress={() => sendWhatsAppMessage(selectedClient.phone, `Olá, ${selectedClient.name}! 👋`)}
              >
                <IconSymbol name="message.fill" size={20} color="#4CAF50" />
                    <Text style={[styles.quickActionText, { color: "#4CAF50" }]}>WhatsApp</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.quickActionBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => { setShowDetailModal(false); openEdit(selectedClient); }}
                  >
                    <IconSymbol name="pencil" size={20} color="#C9A84C" />
                    <Text style={[styles.quickActionText, { color: "#C9A84C" }]}>Editar</Text>
                  </Pressable>
                </View>

                {/* Histórico */}
                <Text style={styles.historyTitle}>Histórico de Atendimentos</Text>
                {clientAppointmentsQuery.isLoading ? (
                  <ActivityIndicator color="#C9A84C" />
                ) : appointments.length === 0 ? (
                  <Text style={styles.historyEmpty}>Nenhum atendimento registrado</Text>
                ) : (
                  appointments.map((apt: any) => (
                    <View key={apt.id} style={styles.historyCard}>
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyDate}>{apt.date}</Text>
                        <Text style={styles.historyTime}>{apt.startTime} – {apt.endTime}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyService}>{getServiceName(apt.serviceId)}</Text>
                        <Text style={styles.historyStatus}>{STATUS_LABELS[apt.status] ?? apt.status}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
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
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: "#141414", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#2A2A2A", gap: 8, marginBottom: 4 },
  searchInput: { flex: 1, color: "#F5F5F0", fontSize: 14 },
  countText: { fontSize: 13, color: "#888880", paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },
  emptyCard: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: "#888880", fontSize: 16, fontWeight: "600" },
  card: { backgroundColor: "#141414", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#C9A84C44" },
  avatarText: { color: "#C9A84C", fontSize: 20, fontWeight: "700" },
  clientName: { fontSize: 15, fontWeight: "700", color: "#F5F5F0", marginBottom: 2 },
  clientPhone: { fontSize: 13, color: "#888880" },
  clientEmail: { fontSize: 12, color: "#555" },
  cardRight: { alignItems: "flex-end", gap: 8 },
  pointsBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#C9A84C22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pointsText: { fontSize: 12, color: "#C9A84C", fontWeight: "600" },
  editBtn: { padding: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#141414", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "92%", borderWidth: 1, borderColor: "#2A2A2A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F0" },
  fieldLabel: { fontSize: 13, color: "#888880", marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#F5F5F0" },
  textarea: { height: 80, textAlignVertical: "top" },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 8, marginTop: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  // Detail
  clientDetailHeader: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 16 },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#C9A84C44" },
  avatarLargeText: { color: "#C9A84C", fontSize: 28, fontWeight: "700" },
  detailName: { fontSize: 18, fontWeight: "700", color: "#F5F5F0" },
  detailPhone: { fontSize: 14, color: "#888880", marginTop: 2 },
  detailEmail: { fontSize: 13, color: "#555", marginTop: 2 },
  pointsCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#C9A84C22", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#C9A84C44" },
  pointsCardText: { fontSize: 14, color: "#C9A84C", fontWeight: "600" },
  quickActions: { flexDirection: "row", gap: 10, marginBottom: 16 },
  quickActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1E1E1E", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#2A2A2A" },
  quickActionText: { fontSize: 13, fontWeight: "600" },
  historyTitle: { fontSize: 16, fontWeight: "700", color: "#F5F5F0", marginBottom: 10 },
  historyEmpty: { color: "#888880", fontSize: 14, textAlign: "center", paddingVertical: 20 },
  historyCard: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  historyLeft: { width: 80 },
  historyDate: { fontSize: 12, color: "#888880" },
  historyTime: { fontSize: 12, color: "#555" },
  historyService: { fontSize: 14, fontWeight: "600", color: "#F5F5F0" },
  historyStatus: { fontSize: 12, color: "#888880", marginTop: 2 },
});
