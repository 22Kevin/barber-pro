import React, { useState, useRef } from "react";
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
import { AdminHeader } from "@/components/admin-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useBarberAuth } from "@/lib/auth-context";
import { useTabBarHeight } from "@/hooks/use-tab-bar-height";
import { useColors } from "@/hooks/use-colors";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TicketStatus = "open" | "waiting_admin" | "answered" | "closed";
type TicketPriority = "low" | "normal" | "high" | "urgent";

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Aberto",
  waiting_admin: "Aguardando",
  answered: "Respondido",
  closed: "Fechado",
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: "#F87171",
  waiting_admin: "#FBBF24",
  answered: "#60A5FA",
  closed: "#4ADE80",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const CATEGORIES = [
  { value: "billing", label: "Financeiro / Cobrança" },
  { value: "technical", label: "Problema Técnico" },
  { value: "feature", label: "Sugestão de Funcionalidade" },
  { value: "account", label: "Conta / Acesso" },
  { value: "other", label: "Outro" },
];

// ─── Componente principal ─────────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://usebarberpro.com";

interface ChatMessage { role: 'user' | 'assistant'; content: string; }


export default function SuporteScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const tabBarHeight = useTabBarHeight();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;
  const utils = trpc.useUtils();

  // Estado de navegação interna
  const [view, setView] = useState<"list" | "detail" | "new">("list");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  // Estado do formulário de novo ticket
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [newMessage, setNewMessage] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("normal");
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Estado do formulário de resposta
  const [replyText, setReplyText] = useState("");

  // Estado do chatbot IA
  const [activeTab, setActiveTab] = useState<"tutoriais" | "ia" | "tickets">("tutoriais");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente do Barber Pro. Posso te ajudar com qualquer dúvida sobre o sistema. Como posso te ajudar?' }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<any>(null);

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: msg };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput("");
    setChatLoading(true);
    try {
      const r = await fetch(`${API_BASE}/admin-api/suporte-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg, history: newHistory.slice(-8) })
      });
      const data = await r.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Desculpe, tente novamente.' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd?.({ animated: true }), 100);
    }
  }

  // ─── Queries ────────────────────────────────────────────────────────────────
  const ticketsQuery = trpc.support.getMyTickets.useQuery(
    { tenantId },
    { enabled: tenantId > 0, refetchInterval: 30000 }
  );

  const ticketDetailQuery = trpc.support.getTicketById.useQuery(
    { id: selectedTicketId! },
    { enabled: !!selectedTicketId && view === "detail" }
  );

  const messagesQuery = trpc.support.getTicketMessages.useQuery(
    { ticketId: selectedTicketId! },
    { enabled: !!selectedTicketId && view === "detail", refetchInterval: 15000 }
  );

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const createTicketMutation = trpc.support.createTicket.useMutation({
    onSuccess: (data) => {
      utils.support.getMyTickets.invalidate();
      setSelectedTicketId(data.ticketId);
      setView("detail");
      setNewTitle("");
      setNewCategory("other");
      setNewMessage("");
      setNewPriority("normal");
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const sendMessageMutation = trpc.support.sendMessage.useMutation({
    onSuccess: () => {
      setReplyText("");
      utils.support.getTicketMessages.invalidate({ ticketId: selectedTicketId! });
      utils.support.getMyTickets.invalidate();
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const closeTicketMutation = trpc.support.closeTicket.useMutation({
    onSuccess: () => {
      utils.support.getMyTickets.invalidate();
      utils.support.getTicketById.invalidate({ id: selectedTicketId! });
      setView("list");
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────
  function handleOpenTicket(id: number) {
    setSelectedTicketId(id);
    setView("detail");
  }

  function handleCreateTicket() {
    if (!newTitle.trim() || newTitle.trim().length < 5) {
      Alert.alert("Atenção", "O título deve ter pelo menos 5 caracteres.");
      return;
    }
    if (!newMessage.trim() || newMessage.trim().length < 10) {
      Alert.alert("Atenção", "A mensagem deve ter pelo menos 10 caracteres.");
      return;
    }
    createTicketMutation.mutate({
      tenantId,
      title: newTitle.trim(),
      category: newCategory,
      priority: newPriority,
      firstMessage: newMessage.trim(),
      authorName: barber?.name,
    });
  }

  function handleSendReply() {
    if (!replyText.trim() || !selectedTicketId) return;
    sendMessageMutation.mutate({
      ticketId: selectedTicketId,
      content: replyText.trim(),
      authorName: barber?.name,
    });
  }

  function handleCloseTicket() {
    if (!selectedTicketId) return;
    Alert.alert(
      "Fechar Ticket",
      "Deseja fechar este ticket de suporte? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Fechar", style: "destructive", onPress: () => closeTicketMutation.mutate({ id: selectedTicketId }) },
      ]
    );
  }

  // ─── Render: Lista de Tickets ────────────────────────────────────────────────
  if (view === "list") {
    const tickets = ticketsQuery.data ?? [];
    const openCount = tickets.filter(t => ["open", "waiting_admin"].includes(t.status)).length;

    return (
      <ScreenContainer containerClassName="bg-background">
        <AdminHeader title="Suporte" />
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>Meus Tickets</Text>
            {openCount > 0 && (
              <Text style={styles.listSub}>{openCount} ticket{openCount > 1 ? "s" : ""} em aberto</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => setView("new")}
            activeOpacity={0.8}
          >
            <IconSymbol name="plus" size={16} color="#0A0A0A" />
            <Text style={styles.newBtnText}>Novo Ticket</Text>
          </TouchableOpacity>
        </View>

        {ticketsQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#C9A84C" />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="questionmark.circle.fill" size={48} color="#333" />
            <Text style={styles.emptyTitle}>Nenhum ticket ainda</Text>
            <Text style={styles.emptySub}>Abra um ticket para falar com nosso suporte.</Text>
            <TouchableOpacity style={styles.newBtn} onPress={() => setView("new")} activeOpacity={0.8}>
              <IconSymbol name="plus" size={16} color="#0A0A0A" />
              <Text style={styles.newBtnText}>Abrir Ticket</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16 }}
            renderItem={({ item }) => {
              const status = item.status as TicketStatus;
              const color = STATUS_COLORS[status] ?? "#888";
              const hasNew = status === "answered";
              return (
                <TouchableOpacity
                  style={[styles.ticketCard, hasNew && styles.ticketCardHighlight]}
                  onPress={() => handleOpenTicket(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.ticketCardTop}>
                    <Text style={styles.ticketTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
                      <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status] ?? status}</Text>
                    </View>
                  </View>
                  <View style={styles.ticketCardMeta}>
                    <Text style={styles.ticketMeta}>
                      {CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}
                    </Text>
                    <Text style={styles.ticketMeta}>
                      {new Date(item.updatedAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                  {hasNew && (
                    <View style={styles.newResponseBadge}>
                      <Text style={styles.newResponseText}>Nova resposta</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </ScreenContainer>
    );
  }

  // ─── Render: Novo Ticket ─────────────────────────────────────────────────────
  if (view === "new") {
    const selectedCat = CATEGORIES.find(c => c.value === newCategory);
    return (
      <ScreenContainer containerClassName="bg-background">
      <AdminHeader
        title="Novo Ticket"
        rightElement={
          <TouchableOpacity onPress={() => setView("list")} style={{ padding: 8 }} activeOpacity={0.7}>
            <IconSymbol name="xmark" size={20} color="#888" />
          </TouchableOpacity>
        }
      />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Título */}
            <Text style={styles.fieldLabel}>Título *</Text>
            <TextInput
              style={styles.input}
              placeholder="Descreva brevemente o problema..."
              placeholderTextColor="#555"
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={255}
              returnKeyType="next"
            />

            {/* Categoria */}
            <Text style={styles.fieldLabel}>Categoria *</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setShowCategoryModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.selectBtnText}>{selectedCat?.label ?? "Selecionar..."}</Text>
              <IconSymbol name="chevron.down" size={16} color="#888" />
            </TouchableOpacity>

            {/* Prioridade */}
            <Text style={styles.fieldLabel}>Prioridade</Text>
            <View style={styles.priorityRow}>
              {(["low", "normal", "high", "urgent"] as TicketPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, newPriority === p && styles.priorityBtnActive]}
                  onPress={() => setNewPriority(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.priorityBtnText, newPriority === p && styles.priorityBtnTextActive]}>
                    {PRIORITY_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mensagem */}
            <Text style={styles.fieldLabel}>Descreva o problema *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Explique detalhadamente o que está acontecendo..."
              placeholderTextColor="#555"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, createTicketMutation.isPending && styles.submitBtnDisabled]}
              onPress={handleCreateTicket}
              disabled={createTicketMutation.isPending}
              activeOpacity={0.8}
            >
              {createTicketMutation.isPending ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={styles.submitBtnText}>Abrir Ticket</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal de categoria */}
        <Modal visible={showCategoryModal} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Selecionar Categoria</Text>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.modalOption, newCategory === cat.value && styles.modalOptionActive]}
                  onPress={() => { setNewCategory(cat.value); setShowCategoryModal(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalOptionText, newCategory === cat.value && styles.modalOptionTextActive]}>
                    {cat.label}
                  </Text>
                  {newCategory === cat.value && <IconSymbol name="checkmark" size={16} color="#C9A84C" />}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      </ScreenContainer>
    );
  }

  // ─── Render: Detalhe do Ticket ───────────────────────────────────────────────
  const ticket = ticketDetailQuery.data;
  const messages = messagesQuery.data ?? [];
  const ticketStatus = ticket?.status as TicketStatus | undefined;
  const isClosed = ticketStatus === "closed";

  return (
    <ScreenContainer containerClassName="bg-background">
      <AdminHeader
        title={`Ticket #${selectedTicketId ?? ""}`}
        rightElement={
          <TouchableOpacity onPress={() => setView("list")} style={{ padding: 8 }} activeOpacity={0.7}>
            <IconSymbol name="xmark" size={20} color="#888" />
          </TouchableOpacity>
        }
      />
      {ticketDetailQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#C9A84C" />
        </View>
      ) : !ticket ? (
        <View style={styles.centered}>
          <Text style={styles.emptySub}>Ticket não encontrado.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 80 }}
          >
            {/* Info do ticket */}
            <View style={styles.ticketInfoCard}>
              <Text style={styles.ticketInfoTitle}>{ticket.title}</Text>
              <View style={styles.ticketInfoRow}>
                <Text style={styles.ticketInfoMeta}>
                  {CATEGORIES.find(c => c.value === ticket.category)?.label ?? ticket.category}
                </Text>
                {ticketStatus && (
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[ticketStatus] + "22", borderColor: STATUS_COLORS[ticketStatus] + "44" }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[ticketStatus] }]}>
                      {STATUS_LABELS[ticketStatus]}
                    </Text>
                  </View>
                )}
              </View>
              {!isClosed && (
                <TouchableOpacity
                  style={styles.closeTicketBtn}
                  onPress={handleCloseTicket}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeTicketBtnText}>Fechar Ticket</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Mensagens */}
            <Text style={styles.sectionLabel}>Conversa</Text>
            {messagesQuery.isLoading ? (
              <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
            ) : messages.length === 0 ? (
              <Text style={styles.emptySub}>Nenhuma mensagem ainda.</Text>
            ) : (
              messages.map((msg: any) => {
                const isAdmin = msg.authorType === "admin";
                const isAI = msg.authorType === "ai";
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      isAdmin ? styles.messageBubbleAdmin : isAI ? styles.messageBubbleAI : styles.messageBubbleClient,
                    ]}
                  >
                    <Text style={styles.messageAuthor}>
                      {isAdmin ? "Suporte" : isAI ? "IA Assistente" : "Você"}
                    </Text>
                    <Text style={styles.messageContent}>{msg.content}</Text>
                    <Text style={styles.messageTime}>
                      {new Date(msg.createdAt).toLocaleString("pt-BR")}
                    </Text>
                  </View>
                );
              })
            )}

            {/* Campo de resposta */}
            {!isClosed && (
              <View style={styles.replyBox}>
                <TextInput
                  style={[styles.input, styles.replyInput]}
                  placeholder="Escreva uma mensagem..."
                  placeholderTextColor="#555"
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!replyText.trim() || sendMessageMutation.isPending) && styles.sendBtnDisabled]}
                  onPress={handleSendReply}
                  disabled={!replyText.trim() || sendMessageMutation.isPending}
                  activeOpacity={0.8}
                >
                  {sendMessageMutation.isPending ? (
                    <ActivityIndicator color="#0A0A0A" size="small" />
                  ) : (
                    <IconSymbol name="paperplane.fill" size={18} color="#0A0A0A" />
                  )}
                </TouchableOpacity>
              </View>
            )}

            {isClosed && (
              <View style={styles.closedBanner}>
                <Text style={styles.closedBannerText}>Este ticket foi fechado.</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </ScreenContainer>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
function createStyles(c: ReturnType<typeof import("@/hooks/use-colors").useColors>) {
  return StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  listHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  listTitle: { fontSize: 18, fontWeight: "800", color: "#F0EEE8" },
  listSub: { fontSize: 12, color: "#F87171", marginTop: 2 },

  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#C9A84C", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  newBtnText: { fontSize: 13, fontWeight: "700", color: "#0A0A0A" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#F0EEE8" },
  emptySub: { fontSize: 13, color: c.muted, textAlign: "center" },

  ticketCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: c.border,
  },
  ticketCardHighlight: { borderColor: "#60A5FA44", backgroundColor: "#60A5FA08" },
  ticketCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  ticketTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: "#F0EEE8" },
  ticketCardMeta: { flexDirection: "row", justifyContent: "space-between" },
  ticketMeta: { fontSize: 11, color: c.muted },

  statusBadge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "700" },

  newResponseBadge: {
    marginTop: 8, alignSelf: "flex-start",
    backgroundColor: "#60A5FA22", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  newResponseText: { fontSize: 11, color: "#60A5FA", fontWeight: "700" },

  // Formulário
  fieldLabel: { fontSize: 12, color: c.muted, marginBottom: 6, marginTop: 16, fontWeight: "600", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#0A0A0A", borderWidth: 1, borderColor: c.border,
    borderRadius: 10, padding: 12, color: "#F0EEE8", fontSize: 14,
  },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0A0A0A", borderWidth: 1, borderColor: c.border,
    borderRadius: 10, padding: 12,
  },
  selectBtnText: { fontSize: 14, color: "#F0EEE8" },

  priorityRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  priorityBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
  },
  priorityBtnActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C44" },
  priorityBtnText: { fontSize: 12, color: c.muted, fontWeight: "600" },
  priorityBtnTextActive: { color: "#C9A84C" },

  submitBtn: {
    marginTop: 24, backgroundColor: "#C9A84C", borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: "800", color: "#0A0A0A" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#F0EEE8", marginBottom: 16 },
  modalOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.background,
  },
  modalOptionActive: {},
  modalOptionText: { fontSize: 14, color: c.muted },
  modalOptionTextActive: { color: "#C9A84C", fontWeight: "700" },

  // Detalhe
  ticketInfoCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: c.border,
  },
  ticketInfoTitle: { fontSize: 16, fontWeight: "800", color: "#F0EEE8", marginBottom: 8 },
  ticketInfoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  ticketInfoMeta: { fontSize: 12, color: c.muted },
  closeTicketBtn: {
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: c.background, borderRadius: 8, borderWidth: 1, borderColor: c.border,
  },
  closeTicketBtnText: { fontSize: 12, color: c.muted, fontWeight: "600" },

  sectionLabel: { fontSize: 11, color: c.muted, letterSpacing: 1.2, fontWeight: "700", marginBottom: 12, textTransform: "uppercase" },

  messageBubble: {
    borderRadius: 12, padding: 12, marginBottom: 10, maxWidth: "85%",
    borderWidth: 1,
  },
  messageBubbleClient: { alignSelf: "flex-start", backgroundColor: c.background, borderColor: c.border },
  messageBubbleAdmin: { alignSelf: "flex-end", backgroundColor: "#C9A84C18", borderColor: "#C9A84C33" },
  messageBubbleAI: { alignSelf: "flex-start", backgroundColor: "#60A5FA18", borderColor: "#60A5FA33" },
  messageAuthor: { fontSize: 10, color: c.muted, marginBottom: 4, fontWeight: "700" },
  messageContent: { fontSize: 13, color: "#F0EEE8", lineHeight: 20 },
  messageTime: { fontSize: 10, color: c.muted, marginTop: 4, textAlign: "right" },

  replyBox: { flexDirection: "row", gap: 10, alignItems: "flex-end", marginTop: 16 },
  replyInput: { flex: 1, minHeight: 60, textAlignVertical: "top" },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#C9A84C", alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },

  closedBanner: {
    marginTop: 16, backgroundColor: c.background, borderRadius: 12,
    padding: 14, alignItems: "center",
  },
  closedBannerText: { fontSize: 13, color: c.muted },
});
}
