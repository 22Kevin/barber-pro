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

// ─── Dados dos tutoriais ──────────────────────────────────────────────────────
interface TutorialStep { title: string; desc: string; tip?: string; }
interface Tutorial { id: string; icon: string; title: string; desc: string; steps: TutorialStep[]; color: string; }

const TUTORIALS: Tutorial[] = [
  {
    id: "agenda",
    icon: "📅",
    title: "Como criar um agendamento",
    desc: "Agende um horário para seu cliente em segundos",
    color: "#C9A84C",
    steps: [
      { title: "Abra a Agenda", desc: "Toque em 'Agenda' na barra inferior ou no menu lateral." },
      { title: "Selecione o dia", desc: "Toque em qualquer dia no calendário. Dias com agendamentos têm um ponto dourado abaixo." },
      { title: "Toque em '+ Novo'", desc: "Botão no canto superior direito da tela da agenda." },
      { title: "Escolha o cliente", desc: "Toque em 'Selecionar cliente...' e busque pelo nome ou telefone.", tip: "Você pode cadastrar um novo cliente diretamente pela tela de Clientes." },
      { title: "Selecione os serviços", desc: "Deslize os chips horizontalmente e toque nos serviços desejados. O resumo aparece abaixo.", tip: "Você pode selecionar múltiplos serviços — a duração total é calculada automaticamente." },
      { title: "Escolha o horário", desc: "Deslize os chips de horário e toque no horário disponível. Horários ocupados aparecem acinzentados." },
      { title: "Confirme", desc: "Toque em 'CONFIRMAR AGENDAMENTO'. O agendamento aparece na lista e no calendário imediatamente." },
    ],
  },
  {
    id: "cliente",
    icon: "👤",
    title: "Como cadastrar um cliente",
    desc: "Adicione clientes à sua base com todas as informações",
    color: "#3B82F6",
    steps: [
      { title: "Acesse Clientes", desc: "Toque em 'Clientes' na barra inferior." },
      { title: "Toque em '+ Novo'", desc: "Botão no canto superior direito." },
      { title: "Preencha os dados", desc: "Nome completo e telefone são obrigatórios. E-mail e data de nascimento são opcionais.", tip: "A data de nascimento é usada para enviar parabéns automáticos no aniversário do cliente." },
      { title: "Aceite os termos", desc: "Marque o checkbox de consentimento LGPD para poder enviar mensagens ao cliente." },
      { title: "Salve", desc: "Toque em 'Cadastrar'. O cliente aparece na lista e você pode agendar para ele imediatamente." },
    ],
  },
  {
    id: "servicos",
    icon: "✂️",
    title: "Como gerenciar serviços",
    desc: "Crie e edite os serviços que sua barbearia oferece",
    color: "#8B5CF6",
    steps: [
      { title: "Acesse Serviços", desc: "Menu lateral → Catálogo → Serviços." },
      { title: "Toque em '+ Novo'", desc: "Botão no canto superior direito." },
      { title: "Preencha o serviço", desc: "Nome e preço são obrigatórios. A duração define os slots disponíveis na agenda.", tip: "Use a duração real do serviço para evitar conflitos de horário na agenda." },
      { title: "Ativar/Desativar", desc: "Serviços inativos não aparecem na seleção durante o agendamento. Use para serviços temporariamente fora de operação." },
      { title: "Editar ou excluir", desc: "Toque no lápis para editar ou na lixeira vermelha para excluir. Serviços com agendamentos vinculados não podem ser excluídos." },
    ],
  },
  {
    id: "financeiro",
    icon: "💰",
    title: "Como usar o Financeiro",
    desc: "Registre vendas, despesas e acompanhe o lucro",
    color: "#22C55E",
    steps: [
      { title: "Acesse Financeiro", desc: "Toque em 'Financeiro' na barra inferior." },
      { title: "Nova venda", desc: "Toque em '+ Venda' (dourado) para registrar uma receita. Informe o serviço ou produto, valor e forma de pagamento." },
      { title: "Nova despesa", desc: "Toque em '− Despesa' (vermelho) para registrar uma saída. Ex: aluguel, produtos, energia.", tip: "Categorize suas despesas para ter relatórios mais detalhados." },
      { title: "Aba Resumo", desc: "Mostra o Lucro Líquido do período com barra de progresso, grid de métricas e breakdown por forma de pagamento." },
      { title: "Navegue pelos períodos", desc: "Use as setas < > no topo para navegar entre meses. Os dados são filtrados automaticamente." },
      { title: "Relatórios", desc: "Menu lateral → Financeiro → Relatórios para análises detalhadas com comparativos e projeções." },
    ],
  },
  {
    id: "planos",
    icon: "⭐",
    title: "Como configurar planos de assinatura",
    desc: "Crie pacotes mensais para fidelizar seus clientes",
    color: "#F59E0B",
    steps: [
      { title: "Acesse Assinaturas", desc: "Menu lateral → Catálogo → Assinaturas, ou toque no botão '⭐ Plano' na Agenda." },
      { title: "Crie um plano", desc: "Toque em '+ Novo Plano'. Defina o nome, descrição e quantos atendimentos por mês." },
      { title: "Selecione serviços", desc: "Escolha quais serviços fazem parte do plano e quantos o cliente pode escolher por visita.", tip: "O sistema calcula automaticamente uma sugestão de preço com 15% de desconto." },
      { title: "Defina o preço", desc: "Use a sugestão ou defina seu próprio preço. Toque em '↑ usar' para aceitar o preço sugerido." },
      { title: "Gerencie assinantes", desc: "Acesse 'Assinaturas' no menu para ver quem assinou, MRR e taxa de cancelamento." },
      { title: "Nova assinatura", desc: "Na tela de Assinaturas, toque em '+ Nova Assinatura' para vincular um cliente a um plano existente." },
    ],
  },
  {
    id: "estoque",
    icon: "📦",
    title: "Como gerenciar o estoque",
    desc: "Controle produtos, reposições e movimentações",
    color: "#F59E0B",
    steps: [
      { title: "Acesse Estoque", desc: "Menu lateral → Catálogo → Estoque." },
      { title: "Veja os produtos", desc: "Lista todos os produtos com quantidade atual. Itens em vermelho estão abaixo do mínimo configurado." },
      { title: "Repor estoque", desc: "Toque em '+' no produto. Informe a quantidade, custo unitário e selecione o fornecedor.", tip: "O custo é registrado automaticamente como despesa no Financeiro." },
      { title: "Registrar uso interno", desc: "Toque em '−' para registrar consumo dentro da barbearia. Ex: produto usado no atendimento." },
      { title: "Ver histórico", desc: "Toque no ícone de relógio para ver todas as movimentações do produto: entradas, saídas e vendas.", tip: "Vendas de produtos também aparecem aqui automaticamente." },
      { title: "Alerta de mínimo", desc: "Configure a quantidade mínima em cada produto. O sistema avisa quando chegar abaixo do limite." },
    ],
  },
  {
    id: "encomendas",
    icon: "🛍️",
    title: "Como gerenciar encomendas",
    desc: "Acompanhe pedidos de clientes da página pública",
    color: "#F59E0B",
    steps: [
      { title: "Acesse Encomendas", desc: "Menu lateral → Encomendas, ou toque no badge de notificações." },
      { title: "Tipos de pedido", desc: "'🛒 Compra' — produto em estoque, já confirmado. '📦 Encomenda' — sem estoque, aguarda confirmação." },
      { title: "Avançar o status", desc: "Toque no botão dourado no card para avançar: Recebido → Confirmado → Em Preparo → Pronto → Entregue." },
      { title: "Separar produto", desc: "Quando o status for 'Confirmado', o botão mostra '✂️ Separar Produto'. Isso indica que o cliente está aguardando." },
      { title: "Avisar pelo WhatsApp", desc: "Toque no botão verde WhatsApp para avisar o cliente sobre o status do pedido.", tip: "A mensagem já vem pré-formatada com o nome do produto e status." },
      { title: "Filtrar pedidos", desc: "Use os chips no topo para filtrar por status (Recebido, Confirmado...) ou por período (Hoje, 7 dias, 30 dias)." },
    ],
  },
  {
    id: "relatorios",
    icon: "📊",
    title: "Como usar os Relatórios",
    desc: "Analise o desempenho da sua barbearia",
    color: "#60A5FA",
    steps: [
      { title: "Acesse Relatórios", desc: "Menu lateral → Financeiro → Relatórios." },
      { title: "Aba Financeiro", desc: "Veja receita, despesas e lucro líquido com gráfico de evolução. Mude o período no seletor acima." },
      { title: "Aba Serviços", desc: "Ranking dos serviços mais vendidos com receita total e quantidade de atendimentos." },
      { title: "Aba Barbeiros", desc: "Desempenho individual: receita, atendimentos e ticket médio de cada profissional." },
      { title: "Aba Encomendas", desc: "Volume de pedidos por produto, faturamento da loja e status dos pedidos." },
      { title: "Aba Inativos 👻", desc: "Clientes que não visitam há mais de 30 dias. Use para campanhas de reativação via WhatsApp.", tip: "Combine com a tela de Promoções para criar uma campanha de retorno." },
      { title: "Exportar CSV", desc: "Toque no botão '↓ CSV' para exportar os dados para planilha." },
    ],
  },
  {
    id: "orbita",
    icon: "🪐",
    title: "Clientes em Órbita",
    desc: "Acompanhe leads que quase agendaram",
    color: "#8B5CF6",
    steps: [
      { title: "O que é Órbita?", desc: "Clientes que visitaram sua página pública mas não completaram o agendamento — estão 'em órbita' da sua barbearia." },
      { title: "Acesse Clientes em Órbita", desc: "Menu lateral → Clientes em Órbita." },
      { title: "Veja os leads", desc: "Lista de visitantes com data, serviço de interesse e status (Pendente, Convertido, Perdido)." },
      { title: "Converter lead", desc: "Toque em '+ Agendar' para criar um agendamento para o lead e convertê-lo em cliente.", tip: "Entre em contato pelo WhatsApp para entender por que não finalizou o agendamento." },
      { title: "Filtrar por período", desc: "Use os filtros 'Hoje', '7 dias', '30 dias' para ver leads recentes." },
    ],
  },
  {
    id: "promocoes",
    icon: "📢",
    title: "Como criar Promoções",
    desc: "Envie mensagens em massa para seus clientes",
    color: "#EF4444",
    steps: [
      { title: "Acesse Promoções", desc: "Menu lateral → Marketing → Promoções." },
      { title: "Nova promoção", desc: "Toque em '+ Nova Promoção'. Dê um título e escreva a mensagem." },
      { title: "Escolha o público", desc: "'Todos os clientes', 'Inativos há 30 dias', 'Aniversariantes do mês' ou 'Cliente específico'." },
      { title: "Use variáveis", desc: "Insira {nome} e {barbearia} na mensagem para personalizar automaticamente para cada cliente.", tip: "Ex: 'Olá {nome}! Temos uma promoção especial em {barbearia} para você!'" },
      { title: "Enviar", desc: "Toque em 'Enviar'. As mensagens são disparadas via WhatsApp para cada cliente do público selecionado." },
    ],
  },
  {
    id: "primeiros-passos",
    icon: "🚀",
    title: "Primeiros passos no Barber Pro",
    desc: "Configure sua barbearia do zero em 5 minutos",
    color: "#EF4444",
    steps: [
      { title: "Configure a barbearia", desc: "Menu lateral → Sistema → Barbearia. Adicione nome, telefone, Instagram e Google Maps." },
      { title: "Defina os horários", desc: "Na aba 'Horários', configure os dias e horários de funcionamento de cada barbeiro.", tip: "Os horários definidos aqui determinam quais slots aparecem na tela de agendamento." },
      { title: "Cadastre sua equipe", desc: "Na aba 'Equipe', adicione os barbeiros com e-mail e role (barbeiro ou recepcionista)." },
      { title: "Adicione seus serviços", desc: "Menu lateral → Catálogo → Serviços. Cadastre todos os cortes e serviços que você oferece." },
      { title: "Compartilhe sua página", desc: "Menu lateral → Página do Cliente. Copie o link ou QR Code e envie para seus clientes pelo WhatsApp.", tip: "Seus clientes podem agendar diretamente pela página pública sem precisar do app." },
      { title: "Pronto!", desc: "Sua barbearia está configurada. Comece criando seus primeiros agendamentos e cadastrando clientes." },
    ],
  },
];

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TutoriaisTab({ colors, styles, tabBarHeight }: any) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24 }}
    >
      <Text style={styles.tutorialSectionTitle}>Guias passo a passo</Text>
      <Text style={styles.tutorialSectionDesc}>Aprenda a usar todos os recursos do Barber Pro</Text>

      {TUTORIALS.map(tutorial => {
        const isOpen = expanded === tutorial.id;
        return (
          <View key={tutorial.id} style={styles.tutorialCard}>
            <Pressable
              style={styles.tutorialHeader}
              onPress={() => setExpanded(isOpen ? null : tutorial.id)}
            >
              <View style={[styles.tutorialIconBox, { backgroundColor: tutorial.color + "22" }]}>
                <Text style={styles.tutorialIcon}>{tutorial.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tutorialTitle}>{tutorial.title}</Text>
                <Text style={styles.tutorialDesc}>{tutorial.desc}</Text>
              </View>
              <View style={[styles.tutorialChevron, isOpen && styles.tutorialChevronOpen]}>
                <IconSymbol name="chevron.down" size={16} color="#888" />
              </View>
            </Pressable>

            {isOpen && (
              <View style={styles.tutorialSteps}>
                <View style={[styles.tutorialDivider, { backgroundColor: tutorial.color + "33" }]} />
                {tutorial.steps.map((step, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <View style={[styles.stepNum, { backgroundColor: tutorial.color + "22", borderColor: tutorial.color + "44" }]}>
                      <Text style={[styles.stepNumText, { color: tutorial.color }]}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDesc}>{step.desc}</Text>
                      {step.tip && (
                        <View style={styles.stepTip}>
                          <Text style={styles.stepTipText}>💡 {step.tip}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={[styles.helpCard, { marginTop: 8 }]}>
        <Text style={styles.helpTitle}>Ainda com dúvidas?</Text>
        <Text style={styles.helpDesc}>Use a aba 🤖 IA para perguntar qualquer coisa, ou abra um ticket na aba 🎫 Tickets para falar com nossa equipe.</Text>
      </View>
    </ScrollView>
  );
}

function IATab({ chatMessages, chatInput, setChatInput, chatLoading, sendChat, chatScrollRef, colors, styles, tabBarHeight }: any) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        ref={chatScrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {chatMessages.map((msg: ChatMessage, idx: number) => (
          <View key={idx} style={[
            styles.messageBubble,
            msg.role === "user" ? styles.messageBubbleClient : styles.messageBubbleAdmin,
          ]}>
            <Text style={styles.messageAuthor}>{msg.role === "user" ? "Você" : "IA Assistente"}</Text>
            <Text style={styles.messageContent}>{msg.content}</Text>
          </View>
        ))}
        {chatLoading && (
          <View style={styles.messageBubble}>
            <ActivityIndicator size="small" color="#C9A84C" />
          </View>
        )}
      </ScrollView>
      <View style={[styles.replyBox, { paddingHorizontal: 16, paddingBottom: tabBarHeight + 8 }]}>
        <TextInput
          style={[styles.input, styles.replyInput]}
          placeholder="Pergunte qualquer coisa sobre o sistema..."
          placeholderTextColor="#555"
          value={chatInput}
          onChangeText={setChatInput}
          multiline
          returnKeyType="send"
          onSubmitEditing={sendChat}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!chatInput.trim() || chatLoading) && styles.sendBtnDisabled]}
          onPress={sendChat}
          disabled={!chatInput.trim() || chatLoading}
        >
          <IconSymbol name="paperplane.fill" size={18} color="#0A0A0A" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function TicketsTab({ tickets, openCount, isLoading, onNewTicket, onOpenTicket, styles, tabBarHeight }: any) {
  return (
    <>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.listTitle}>Meus Tickets</Text>
          {openCount > 0 && (
            <Text style={styles.listSub}>{openCount} ticket{openCount > 1 ? "s" : ""} em aberto</Text>
          )}
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={onNewTicket} activeOpacity={0.8}>
          <IconSymbol name="plus" size={16} color="#0A0A0A" />
          <Text style={styles.newBtnText}>Novo Ticket</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator color="#C9A84C" /></View>
      ) : tickets.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="questionmark.circle.fill" size={48} color="#333" />
          <Text style={styles.emptyTitle}>Nenhum ticket ainda</Text>
          <Text style={styles.emptySub}>Abra um ticket para falar com nosso suporte.</Text>
          <TouchableOpacity style={styles.newBtn} onPress={onNewTicket} activeOpacity={0.8}>
            <IconSymbol name="plus" size={16} color="#0A0A0A" />
            <Text style={styles.newBtnText}>Abrir Ticket</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item: any) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16 }}
          renderItem={({ item }: any) => {
            const status = item.status as TicketStatus;
            const color = STATUS_COLORS[status] ?? "#888";
            const hasNew = status === "answered";
            return (
              <TouchableOpacity
                style={[styles.ticketCard, hasNew && styles.ticketCardHighlight]}
                onPress={() => onOpenTicket(item.id)}
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
                    {CATEGORIES.find((c: any) => c.value === item.category)?.label ?? item.category}
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
    </>
  );
}


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

        {/* ── Abas ───────────────────────────────────────────────────── */}
        <View style={styles.tabBar}>
          {([
            { key: "tutoriais", label: "📚 Tutoriais" },
            { key: "ia",        label: "🤖 IA" },
            { key: "tickets",   label: openCount > 0 ? `🎫 Tickets (${openCount})` : "🎫 Tickets" },
          ] as const).map(tab => (
            <Pressable
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Tutoriais ───────────────────────────────────────────────── */}
        {activeTab === "tutoriais" && (
          <TutoriaisTab colors={colors} styles={styles} tabBarHeight={tabBarHeight} />
        )}

        {/* ── IA Chat ─────────────────────────────────────────────────── */}
        {activeTab === "ia" && (
          <IATab
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            chatLoading={chatLoading}
            sendChat={sendChat}
            chatScrollRef={chatScrollRef}
            colors={colors}
            styles={styles}
            tabBarHeight={tabBarHeight}
          />
        )}

        {/* ── Tickets ─────────────────────────────────────────────────── */}
        {activeTab === "tickets" && (
          <TicketsTab
            tickets={tickets}
            openCount={openCount}
            isLoading={ticketsQuery.isLoading}
            onNewTicket={() => setView("new")}
            onOpenTicket={handleOpenTicket}
            styles={styles}
            tabBarHeight={tabBarHeight}
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

  // ── Abas ─────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
    backgroundColor: "#141414", borderWidth: 1, borderColor: "#2A2A2A",
  },
  tabBtnActive: { backgroundColor: "#C9A84C22", borderColor: "#C9A84C44" },
  tabBtnText: { fontSize: 12, color: "#666", fontWeight: "600" },
  tabBtnTextActive: { color: "#C9A84C" },

  // ── Tutoriais ─────────────────────────────────────────────────────────────
  tutorialSectionTitle: { fontSize: 20, fontWeight: "800", color: "#F0EEE8", marginBottom: 4 },
  tutorialSectionDesc: { fontSize: 13, color: "#666", marginBottom: 20 },
  tutorialCard: {
    backgroundColor: "#141414", borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#2A2A2A", overflow: "hidden",
  },
  tutorialHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  tutorialIconBox: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tutorialIcon: { fontSize: 22 },
  tutorialTitle: { fontSize: 14, fontWeight: "700", color: "#F0EEE8", marginBottom: 2 },
  tutorialDesc: { fontSize: 12, color: "#666", lineHeight: 16 },
  tutorialChevron: { padding: 4 },
  tutorialChevronOpen: { transform: [{ rotate: "180deg" }] },
  tutorialDivider: { height: 1, marginHorizontal: 14, marginBottom: 14 },
  tutorialSteps: { paddingHorizontal: 14, paddingBottom: 16 },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
  },
  stepNumText: { fontSize: 13, fontWeight: "800" },
  stepTitle: { fontSize: 14, fontWeight: "700", color: "#F0EEE8", marginBottom: 3 },
  stepDesc: { fontSize: 13, color: "#AAAAAA", lineHeight: 19 },
  stepTip: {
    marginTop: 6, backgroundColor: "#C9A84C11", borderRadius: 8,
    padding: 8, borderLeftWidth: 3, borderLeftColor: "#C9A84C",
  },
  stepTipText: { fontSize: 12, color: "#C9A84C", lineHeight: 17 },
  helpCard: {
    backgroundColor: "#0F1A0F", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#22C55E33",
  },
  helpTitle: { fontSize: 15, fontWeight: "700", color: "#22C55E", marginBottom: 6 },
  helpDesc: { fontSize: 13, color: "#9CA3AF", lineHeight: 19 },

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
