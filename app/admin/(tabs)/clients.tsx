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
  TouchableOpacity,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { DatePickerModal } from "@/components/date-picker-modal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AdminHeader } from "@/components/admin-header";
import { trpc } from "@/lib/trpc";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { applyPhoneMask, stripMask } from "@/hooks/use-mask";
import {} from "react-native-safe-area-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { exportCsv } from "@/hooks/use-csv-export";
import { useBarberAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";

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

function formatBirthDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isBirthdayToday(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  const today = new Date();
  const parts = birthDate.split("-");
  return parseInt(parts[1], 10) === today.getMonth() + 1 &&
    parseInt(parts[2], 10) === today.getDate();
}

function isBirthdayThisMonth(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  return parseInt(birthDate.split("-")[1], 10) === new Date().getMonth() + 1;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function ClientsScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBirthdayPanel, setShowBirthdayPanel] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const handlePhoneChange = (t: string) => setPhone(applyPhoneMask(t));
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const utils = trpc.useUtils();
  const clientsQuery = trpc.clients.list.useQuery({ tenantId });
  const exportQuery = trpc.export.clientsCsv.useQuery(
    { tenantId },
    { enabled: false }
  );

  async function handleExportCsv() {
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        await exportCsv(result.data, "clientes.csv");
      }
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e?.message ?? "Falha na exportação");
    }
  }
  const birthdayTodayQuery = trpc.clients.birthdayToday.useQuery({ tenantId });
  const birthdayMonthQuery = trpc.clients.birthdayThisMonth.useQuery({ tenantId });
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
    setName(""); setPhone(""); setEmail(""); setBirthDate(null); setNotes("");
    setShowModal(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setName(c.name); setPhone(applyPhoneMask(c.phone)); setEmail(c.email ?? ""); setBirthDate(c.birthDate ?? null); setNotes(c.notes ?? "");
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Atenção", "Informe o nome do cliente."); return; }
    const rawPhone = stripMask(phone);
    if (!rawPhone || rawPhone.length < 10) { Alert.alert("Atenção", "Informe um telefone válido."); return; }
    const data = { name: name.trim(), phone: rawPhone, email: email.trim() || null, birthDate: birthDate || null, notes: notes.trim() || null };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate({ ...data, isActive: true, tenantId } as any);
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
  const birthdayToday = (birthdayTodayQuery.data ?? []) as Client[];
  const birthdayMonth = (birthdayMonthQuery.data ?? []) as Client[];
  const currentMonthName = MONTH_NAMES[new Date().getMonth()];

  const getServiceName = (id: number) => services.find((s: any) => s.id === id)?.name ?? "Serviço";

  const STATUS_LABELS: Record<string, string> = {
    scheduled: "Agendado", confirmed: "Confirmado", in_progress: "Em andamento",
    completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu",
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={["left", "right"]}>
      <AdminHeader
        title="Clientes"
        rightElement={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={({ pressed }) => [styles.birthdayBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowBirthdayPanel(true)}
            >
              <Text style={{ fontSize: 16 }}>🎂</Text>
              {birthdayToday.length > 0 && (
                <View style={styles.birthdayBadge}>
                  <Text style={styles.birthdayBadgeText}>{birthdayToday.length}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.birthdayBtn, pressed && { opacity: 0.8 }]}
              onPress={handleExportCsv}
            >
              <Text style={{ fontSize: 14 }}>📥</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={openCreate}>
              <IconSymbol name="person.badge.plus" size={18} color="#0A0A0A" />
              <Text style={styles.addBtnText}>Novo</Text>
            </Pressable>
          </View>
        }
      />

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
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: tabBarHeight }}
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
              <View style={[styles.avatar, isBirthdayToday(item.birthDate) && styles.avatarBirthday]}>
                <Text style={styles.avatarText}>
                  {isBirthdayToday(item.birthDate) ? "🎂" : item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{item.name}</Text>
                <Text style={styles.clientPhone}>{item.phone}</Text>
                {item.email ? <Text style={styles.clientEmail}>{item.email}</Text> : null}
                {item.birthDate && (
                  <Text style={{ fontSize: 11, color: isBirthdayToday(item.birthDate) ? "#EAB308" : "#555", marginTop: 2 }}>
                    {isBirthdayToday(item.birthDate) ? "🎉 Aniversário hoje!" : `🎂 ${formatBirthDate(item.birthDate)}`}
                  </Text>
                )}
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

      {/* Modal Painel de Aniversariantes */}
      <Modal visible={showBirthdayPanel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎂 Aniversariantes</Text>
              <Pressable onPress={() => setShowBirthdayPanel(false)}>
                <IconSymbol name="xmark" size={22} color="#888880" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Hoje */}
              <Text style={styles.birthdaySectionTitle}>Hoje</Text>
              {birthdayToday.length === 0 ? (
                <Text style={styles.birthdayEmpty}>Nenhum aniversariante hoje</Text>
              ) : (
                birthdayToday.map((c) => (
                  <View key={c.id} style={styles.birthdayCard}>
                    <View style={[styles.avatar, styles.avatarBirthday]}>
                      <Text style={styles.avatarText}>🎂</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.birthdayClientName}>{c.name}</Text>
                      <Text style={styles.birthdayClientPhone}>{c.phone}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => sendWhatsAppMessage(c.phone, `🎂 Feliz Aniversário, ${c.name}! A equipe da barbearia deseja um dia especial para você! 🎉`)}
                      style={styles.whatsappBtn}
                    >
                      <Text style={{ fontSize: 18 }}>💬</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Este mês */}
              <Text style={[styles.birthdaySectionTitle, { marginTop: 20 }]}>
                Em {currentMonthName} ({birthdayMonth.length})
              </Text>
              {birthdayMonth.length === 0 ? (
                <Text style={styles.birthdayEmpty}>Nenhum aniversariante este mês</Text>
              ) : (
                birthdayMonth.map((c) => {
                  const isToday = isBirthdayToday(c.birthDate);
                  return (
                    <View key={c.id} style={[styles.birthdayCard, isToday && styles.birthdayCardToday]}>
                      <View style={[styles.avatar, isToday && styles.avatarBirthday]}>
                        <Text style={styles.avatarText}>
                          {isToday ? "🎂" : c.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.birthdayClientName}>
                          {c.name} {isToday && <Text style={{ color: "#EAB308" }}>• Hoje!</Text>}
                        </Text>
                        <Text style={styles.birthdayClientPhone}>
                          {c.phone} · {formatBirthDate(c.birthDate)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => sendWhatsAppMessage(c.phone, isToday
                          ? `🎂 Feliz Aniversário, ${c.name}! A equipe da barbearia deseja um dia especial para você! 🎉`
                          : `Olá, ${c.name}! 🎉 Seu aniversário está chegando! Venha comemorar com a gente.`
                        )}
                        style={styles.whatsappBtn}
                      >
                        <Text style={{ fontSize: 18 }}>💬</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                  { label: "Telefone/WhatsApp *", value: phone, setter: handlePhoneChange, placeholder: "(11) 99999-9999", keyboard: "phone-pad" as const },
                  { label: "E-mail", value: email, setter: setEmail, placeholder: "joao@email.com", keyboard: "email-address" as const },
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

                {/* Data de Nascimento com DatePicker */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.fieldLabel}>Data de Nascimento</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                  >
                    <Text style={{ color: birthDate ? "#F5F5F0" : "#555", fontSize: 15 }}>
                      {birthDate ? formatBirthDate(birthDate) : "Toque para selecionar"}
                    </Text>
                    <Text style={{ fontSize: 16 }}>🎂</Text>
                  </TouchableOpacity>
                  {birthDate && (
                    <TouchableOpacity onPress={() => setBirthDate(null)} style={{ marginTop: 4, alignSelf: "flex-end" }}>
                      <Text style={{ color: "#555", fontSize: 12 }}>Remover data</Text>
                    </TouchableOpacity>
                  )}
                </View>

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
                  <View style={[styles.avatarLarge, isBirthdayToday(selectedClient.birthDate) && styles.avatarBirthday]}>
                    <Text style={styles.avatarLargeText}>
                      {isBirthdayToday(selectedClient.birthDate) ? "🎂" : selectedClient.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{selectedClient.name}</Text>
                    <Text style={styles.detailPhone}>{selectedClient.phone}</Text>
                    {selectedClient.email ? <Text style={styles.detailEmail}>{selectedClient.email}</Text> : null}
                    {selectedClient.birthDate && (
                      <Text style={{ fontSize: 13, color: isBirthdayToday(selectedClient.birthDate) ? "#EAB308" : "#888880", marginTop: 4 }}>
                        {isBirthdayToday(selectedClient.birthDate) ? "🎉 Aniversário hoje!" : `🎂 ${formatBirthDate(selectedClient.birthDate)}`}
                      </Text>
                    )}
                    {selectedClient.birthDate && isBirthdayThisMonth(selectedClient.birthDate) && !isBirthdayToday(selectedClient.birthDate) && (
                      <Text style={{ fontSize: 12, color: "#D97706", marginTop: 2 }}>Aniversário este mês!</Text>
                    )}
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
                    onPress={() => sendWhatsAppMessage(selectedClient.phone,
                      isBirthdayToday(selectedClient.birthDate)
                        ? `🎂 Feliz Aniversário, ${selectedClient.name}! A equipe da barbearia deseja um dia especial para você! 🎉`
                        : `Olá, ${selectedClient.name}! 👋`
                    )}
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

      {/* DatePickerModal */}
      <DatePickerModal
        visible={showDatePicker}
        value={birthDate}
        onConfirm={(date) => { setBirthDate(date); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: c.foreground },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 14 },
  birthdayBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#1A1000", borderWidth: 1, borderColor: "#C9A84C44", justifyContent: "center", alignItems: "center" },
  birthdayBadge: { position: "absolute", top: -4, right: -4, backgroundColor: "#EAB308", borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  birthdayBadgeText: { color: "#000", fontSize: 10, fontWeight: "800" },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.border, gap: 8, marginBottom: 4 },
  searchInput: { flex: 1, color: c.foreground, fontSize: 14 },
  countText: { fontSize: 13, color: c.muted, paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },
  emptyCard: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: c.muted, fontSize: 16, fontWeight: "600" },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#C9A84C44" },
  avatarBirthday: { backgroundColor: "#1A1000", borderColor: "#EAB308", borderWidth: 2 },
  avatarText: { color: "#C9A84C", fontSize: 20, fontWeight: "700" },
  clientName: { fontSize: 15, fontWeight: "700", color: c.foreground, marginBottom: 2 },
  clientPhone: { fontSize: 13, color: c.muted },
  clientEmail: { fontSize: 12, color: c.muted },
  cardRight: { alignItems: "flex-end", gap: 8 },
  pointsBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#C9A84C22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pointsText: { fontSize: 12, color: "#C9A84C", fontWeight: "600" },
  editBtn: { padding: 4 },
  // Birthday panel
  birthdaySectionTitle: { fontSize: 14, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  birthdayEmpty: { color: c.muted, fontSize: 14, textAlign: "center", paddingVertical: 12 },
  birthdayCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  birthdayCardToday: { backgroundColor: "#1A1000", borderRadius: 12, paddingHorizontal: 10, borderBottomWidth: 0, marginBottom: 4, borderWidth: 1, borderColor: "#EAB30844" },
  birthdayClientName: { fontSize: 15, fontWeight: "700", color: c.foreground },
  birthdayClientPhone: { fontSize: 13, color: c.muted },
  whatsappBtn: { padding: 8, backgroundColor: "#0D1F0D", borderRadius: 10, borderWidth: 1, borderColor: "#22C55E44" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "92%", borderWidth: 1, borderColor: c.border },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: c.foreground },
  fieldLabel: { fontSize: 13, color: c.muted, marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.foreground },
  textarea: { height: 80, textAlignVertical: "top" },
  saveBtn: { backgroundColor: "#C9A84C", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 8, marginTop: 8 },
  saveBtnText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  // Detail
  clientDetailHeader: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 16 },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#C9A84C22", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#C9A84C44" },
  avatarLargeText: { color: "#C9A84C", fontSize: 28, fontWeight: "700" },
  detailName: { fontSize: 18, fontWeight: "700", color: c.foreground },
  detailPhone: { fontSize: 14, color: c.muted, marginTop: 2 },
  detailEmail: { fontSize: 13, color: c.muted, marginTop: 2 },
  pointsCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#C9A84C22", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#C9A84C44" },
  pointsCardText: { fontSize: 14, color: "#C9A84C", fontWeight: "600" },
  quickActions: { flexDirection: "row", gap: 10, marginBottom: 16 },
  quickActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1A1A1A", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#C9A84C" },
  quickActionText: { fontSize: 13, fontWeight: "600" },
  historyTitle: { fontSize: 16, fontWeight: "700", color: c.foreground, marginBottom: 10 },
  historyEmpty: { color: c.muted, fontSize: 14, textAlign: "center", paddingVertical: 20 },
  historyCard: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  historyLeft: { width: 80 },
  historyDate: { fontSize: 12, color: c.muted },
  historyTime: { fontSize: 12, color: c.muted },
  historyService: { fontSize: 14, fontWeight: "600", color: c.foreground },
  historyStatus: { fontSize: 12, color: c.muted, marginTop: 2 },
});
}
