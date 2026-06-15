import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { useBarberAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";

// Templates de mensagem rápida
const QUICK_TEMPLATES = [
  { label: "Confirmar agendamento", text: "Olá! Confirmando seu agendamento para amanhã. Até lá! ✂️" },
  { label: "Lembrete 1h", text: "Oi! Lembrando que seu horário é em 1 hora. Te esperamos! 💈" },
  { label: "Promoção", text: "Olá! Temos uma promoção especial para você esta semana. Venha nos visitar! 🎉" },
  { label: "Pós-atendimento", text: "Obrigado pela visita! Esperamos que tenha gostado. Até a próxima! ⭐" },
];

function formatTime(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type ChatClient = {
  id: number;
  name: string;
  phone: string | null;
  tenantId: number;
  lastMessage?: {
    id: number;
    message: string;
    direction: "outgoing" | "incoming";
    sentAt: Date | string;
  } | null;
  messageCount: number;
};

export default function ChatScreen() {
  const colors = useColors();
  const { barber } = useBarberAuth();
  const tenantId = barber?.tenantId ?? 0;
  const [selectedClient, setSelectedClient] = useState<ChatClient | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const clientsQuery = trpc.chat.clients.useQuery(
    { tenantId },
    { enabled: tenantId > 0, refetchInterval: 30000 }
  );

  const historyQuery = trpc.chat.history.useQuery(
    { tenantId, clientId: selectedClient?.id ?? 0 },
    { enabled: !!selectedClient && tenantId > 0, refetchInterval: 10000 }
  );

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      historyQuery.refetch();
      clientsQuery.refetch();
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const clients = (clientsQuery.data ?? []) as ChatClient[];
  const messages = historyQuery.data ?? [];

  function handleOpenWhatsApp(phone: string | null, message?: string) {
    if (!phone) {
      Alert.alert("Sem telefone", "Este cliente não tem número de WhatsApp cadastrado.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const url = message
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/55${cleanPhone}`;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o WhatsApp."));
  }

  function handleSendMessage() {
    if (!messageText.trim() || !selectedClient) return;
    // Registra no histórico interno
    sendMutation.mutate({
      tenantId,
      clientId: selectedClient.id,
      barberId: barber?.id,
      direction: "outgoing",
      message: messageText.trim(),
    });
    // Abre WhatsApp com a mensagem
    handleOpenWhatsApp(selectedClient.phone, messageText.trim());
  }

  function handleSelectTemplate(template: string) {
    setMessageText(template);
    setShowTemplates(false);
  }

  const dyn = StyleSheet.create({
    clientCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#C9A84C22",
      borderWidth: 1.5,
      borderColor: "#C9A84C",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#C9A84C",
    },
    clientInfo: { flex: 1 },
    clientName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    lastMsg: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    msgTime: {
      fontSize: 11,
      color: colors.muted,
    },
    chatContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
      backgroundColor: colors.surface,
    },
    backBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    chatClientName: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    waBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: "#25D366",
    },
    waBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
    },
    messageBubble: {
      maxWidth: "80%",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      marginBottom: 6,
    },
    outgoing: {
      alignSelf: "flex-end",
      backgroundColor: "#C9A84C",
      borderBottomRightRadius: 4,
    },
    incoming: {
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    msgText: {
      fontSize: 13,
      lineHeight: 19,
    },
    msgTimeSmall: {
      fontSize: 10,
      marginTop: 3,
      opacity: 0.7,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 100,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#25D366",
      justifyContent: "center",
      alignItems: "center",
    },
    templateBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    templatesPanel: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 8,
    },
    templateItem: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    templateLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    templateText: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    emptyText: {
      fontSize: 15,
      color: colors.muted,
      textAlign: "center",
      marginTop: 12,
    },
    dateSeparator: {
      alignSelf: "center",
      backgroundColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginVertical: 8,
    },
    dateSeparatorText: {
      fontSize: 11,
      color: colors.muted,
    },
  });

  // Tela de chat com cliente selecionado
  if (selectedClient) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <AdminHeader title="Chat WhatsApp" />
        <View style={dyn.chatContainer}>
          {/* Header do chat */}
          <View style={dyn.chatHeader}>
            <Pressable style={dyn.backBtn} onPress={() => setSelectedClient(null)}>
              <IconSymbol name="chevron.left" size={18} color={colors.foreground} />
            </Pressable>
            <View style={dyn.avatar}>
              <Text style={dyn.avatarText}>
                {selectedClient.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dyn.chatClientName} numberOfLines={1}>{selectedClient.name}</Text>
              {selectedClient.phone && (
                <Text style={{ fontSize: 11, color: colors.muted }}>{selectedClient.phone}</Text>
              )}
            </View>
            <Pressable
              style={dyn.waBtn}
              onPress={() => handleOpenWhatsApp(selectedClient.phone)}
            >
              <Text style={{ fontSize: 16 }}>💬</Text>
              <Text style={dyn.waBtnText}>WhatsApp</Text>
            </Pressable>
          </View>

          {/* Mensagens */}
          {historyQuery.isLoading ? (
            <View style={dyn.emptyContainer}>
              <ActivityIndicator color="#C9A84C" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={() => (
                <View style={dyn.emptyContainer}>
                  <Text style={{ fontSize: 32 }}>💬</Text>
                  <Text style={dyn.emptyText}>Nenhuma mensagem ainda.{"\n"}Inicie uma conversa pelo WhatsApp.</Text>
                </View>
              )}
              renderItem={({ item, index }) => {
                const isOutgoing = item.direction === "outgoing";
                const prevItem = index > 0 ? messages[index - 1] : null;
                const showDate = !prevItem || formatDate(item.sentAt) !== formatDate(prevItem.sentAt);
                return (
                  <>
                    {showDate && (
                      <View style={dyn.dateSeparator}>
                        <Text style={dyn.dateSeparatorText}>{formatDate(item.sentAt)}</Text>
                      </View>
                    )}
                    <View style={[dyn.messageBubble, isOutgoing ? dyn.outgoing : dyn.incoming]}>
                      <Text style={[dyn.msgText, { color: isOutgoing ? "#0A0A0A" : colors.foreground }]}>
                        {item.message}
                      </Text>
                      <Text style={[dyn.msgTimeSmall, { color: isOutgoing ? "#0A0A0A" : colors.muted, textAlign: "right" }]}>
                        {formatTime(item.sentAt)}
                      </Text>
                    </View>
                  </>
                );
              }}
            />
          )}

          {/* Templates */}
          {showTemplates && (
            <View style={dyn.templatesPanel}>
              <ScrollView style={{ maxHeight: 200 }}>
                {QUICK_TEMPLATES.map((t, i) => (
                  <Pressable key={i} style={dyn.templateItem} onPress={() => handleSelectTemplate(t.text)}>
                    <Text style={dyn.templateLabel}>{t.label}</Text>
                    <Text style={dyn.templateText} numberOfLines={1}>{t.text}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input */}
          <View style={dyn.inputRow}>
            <Pressable style={dyn.templateBtn} onPress={() => setShowTemplates(!showTemplates)}>
              <Text style={{ fontSize: 16 }}>⚡</Text>
            </Pressable>
            <TextInput
              style={dyn.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Mensagem..."
              placeholderTextColor={colors.muted}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            <Pressable
              style={[dyn.sendBtn, { opacity: messageText.trim() ? 1 : 0.5 }]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendMutation.isPending}
            >
              <IconSymbol name="paperplane.fill" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // Lista de clientes
  return (
    <ScreenContainer>
      <AdminHeader title="Chat WhatsApp" />
      {clientsQuery.isLoading ? (
        <View style={dyn.emptyContainer}>
          <ActivityIndicator color="#C9A84C" size="large" />
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable style={dyn.clientCard} onPress={() => setSelectedClient(item)}>
              <View style={dyn.avatar}>
                <Text style={dyn.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={dyn.clientInfo}>
                <Text style={dyn.clientName}>{item.name}</Text>
                {item.lastMessage ? (
                  <Text style={dyn.lastMsg} numberOfLines={1}>
                    {item.lastMessage.direction === "outgoing" ? "Você: " : ""}
                    {item.lastMessage.message}
                  </Text>
                ) : (
                  <Text style={dyn.lastMsg}>Sem mensagens</Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {item.lastMessage && (
                  <Text style={dyn.msgTime}>{formatTime(item.lastMessage.sentAt)}</Text>
                )}
                {item.messageCount > 0 && (
                  <View style={{ backgroundColor: "#25D366", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color: "#fff", fontWeight: "700" }}>{item.messageCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View style={dyn.emptyContainer}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={dyn.emptyText}>Nenhum cliente encontrado.{"\n"}Cadastre clientes para iniciar conversas.</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </ScreenContainer>
  );
}
