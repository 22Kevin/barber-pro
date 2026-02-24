# Barber Pro — TODO

## Fase 1: Base e Identidade Visual
- [x] Gerar logo do Barber Pro (dourado/preto)
- [x] Configurar tema visual (cores preto/branco/dourado)
- [x] Atualizar app.config.ts com nome e branding
- [x] Configurar schema do banco de dados completo

## Fase 2: Banco de Dados
- [x] Tabela: barbers (barbeiros/funcionários)
- [x] Tabela: clients (clientes da barbearia)
- [x] Tabela: services (serviços oferecidos)
- [x] Tabela: products (produtos à venda)
- [x] Tabela: appointments (agendamentos)
- [x] Tabela: sales (vendas)
- [x] Tabela: sale_items (itens de cada venda)
- [x] Tabela: expenses (despesas)
- [x] Tabela: loyalty_config (configuração do sistema de pontos)
- [x] Tabela: loyalty_rewards (recompensas configuradas)
- [x] Tabela: client_points (pontos dos clientes)
- [x] Tabela: coupons (cupons de desconto)
- [x] Tabela: coupon_uses (uso de cupons)
- [x] Tabela: working_hours (horários de trabalho dos barbeiros)
- [x] Tabela: blocked_slots (horários bloqueados)
- [x] Tabela: media_files (fotos/vídeos de serviços e produtos)
- [x] Executar migração do banco de dados

## Fase 3: Autenticação e Hierarquia
- [x] Tela de Login (email/senha)
- [x] Sistema de roles: super_admin, barber, receptionist
- [x] Proteção de rotas por papel
- [x] Contexto global de autenticação

## Fase 4: Navegação Base
- [x] Tab bar do painel administrativo
- [x] Navegação por stack para sub-telas
- [x] Mapeamento de ícones no icon-symbol.tsx

## Fase 5: Dashboard Administrativo
- [x] Tela de Dashboard com resumo do dia
- [x] Cards: agendamentos do dia, faturamento, clientes
- [x] Lista de próximos agendamentos

## Fase 6: Cadastro de Serviços
- [x] Tela de listagem de serviços
- [x] Formulário de criação/edição de serviço
- [x] Upload de fotos e vídeos para serviços
- [x] Ativar/desativar serviços
- [x] Categorias de serviços

## Fase 7: Cadastro de Produtos
- [x] Tela de listagem de produtos
- [x] Formulário de criação/edição de produto
- [x] Upload de fotos e vídeos para produtos
- [x] Controle de estoque
- [x] Categorias de produtos

## Fase 8: Gestão de Barbeiros
- [x] Tela de listagem de barbeiros
- [x] Formulário de cadastro/edição de barbeiro
- [x] Configuração de horários de trabalho por barbeiro
- [x] Gerenciar permissões/papéis

## Fase 9: Agendamento (Admin)
- [x] Tela de agenda com visão de calendário
- [x] Visão por dia com blocos de horário
- [x] Criar agendamento manualmente
- [x] Editar/cancelar agendamento
- [x] Bloquear horários (folga, intervalo)
- [x] Lógica de verificação de conflito de horários
- [x] Cálculo automático de slots baseado na duração do serviço

## Fase 10: Confirmação via WhatsApp
- [x] Integração com WhatsApp API (link wa.me)
- [x] Mensagem de confirmação de agendamento
- [x] Lembrete automático 1 hora antes do agendamento

## Fase 11: Gestão de Clientes
- [x] Tela de listagem de clientes com busca
- [x] Perfil do cliente com histórico
- [x] Histórico de cortes e serviços
- [x] Pontos acumulados

## Fase 12: Sistema Financeiro
- [x] Tela de resumo financeiro (receita, despesas, lucro)
- [x] Registro de vendas (serviços + produtos)
- [x] Registro de despesas
- [x] Relatórios por período (mês)
- [x] Breakdown por forma de pagamento
- [x] Configuração de credenciais Mercado Pago

## Fase 13: Sistema de Fidelidade
- [x] Tela de configuração do sistema de pontos
- [x] Definir regras de acúmulo (por serviço, por valor gasto)
- [x] Criar recompensas personalizadas
- [x] Tela de criação/gestão de cupons de desconto
- [x] Ativar/desativar recompensas e cupons

## Fase 14: Configurações do Sistema
- [x] Tela de configurações gerais da barbearia
- [x] Dados da barbearia (nome, endereço, telefone, WhatsApp)
- [x] Configurações de pagamento Mercado Pago

## Fase 15: Polimento e Qualidade
- [x] Revisar todos os fluxos end-to-end
- [x] Garantir feedback visual em todas as ações
- [x] Tratar estados de loading e erro
- [x] TypeScript sem erros (0 erros)
- [x] Servidor reiniciado e funcionando

## Pendente (Fase 2 - Área do Cliente)
- [x] Tela de agendamento pelo cliente
- [x] Visualização de serviços e produtos
- [x] Histórico de cortes do cliente
- [x] Compra de produtos
- [x] Conta do cliente com pontos de fidelidade

## Fase 2 — Área do Cliente

### Autenticação do Cliente
- [x] Rotas no servidor: clientAuth.register, clientAuth.login, clientAuth.updateProfile, clientAuth.changePassword
- [x] Schema: tabela client_accounts (email, passwordHash, clientId)
- [x] Tela de boas-vindas da área do cliente
- [x] Tela de login do cliente
- [x] Tela de cadastro do cliente
- [x] Contexto de autenticação do cliente (ClientAuthContext)

### Catálogo
- [x] Tela Home do cliente com destaques e boas-vindas
- [x] Tela de catálogo de serviços com galeria de fotos/vídeos
- [x] Detalhe do serviço com galeria e botão "Agendar"
- [x] Funcionalidade "Ver mais" para descrições longas de serviços
- [x] Tela de loja de produtos em grade (2 colunas)
- [x] Detalhe do produto com galeria de fotos/vídeos
- [x] Imagens expansíveis ao clicar (zoom modal)

### Agendamento Online
- [x] Rota no servidor: slots.available (slots livres por barbeiro/data/duração)
- [x] Fluxo de agendamento em 5 etapas: serviço → barbeiro → data → horário → confirmação
- [x] Seleção de barbeiro
- [x] Seleção de data com próximos 30 dias
- [x] Seleção de horário com slots disponíveis
- [x] Tela de confirmação com resumo do agendamento
- [x] Envio de confirmação via WhatsApp após agendar

### Histórico e Perfil
- [x] Tela de perfil do cliente (dados pessoais, edição)
- [x] Tela de histórico de agendamentos (próximos e passados)
- [x] Carteira de pontos (saldo, histórico, recompensas disponíveis)
- [x] Tela de cupons disponíveis do cliente

### Avaliações
- [x] Rotas no servidor: reviews.create, reviews.byService, reviews.byClient
- [x] Schema: tabela reviews (clientId, serviceId, appointmentId, rating, comment)
- [x] Modal de avaliação após atendimento concluído
- [x] Exibição de avaliações e média no detalhe do serviço

### Navegação da Área do Cliente
- [x] Layout de tabs do cliente: Início, Serviços, Loja, Agenda, Perfil
- [x] Integração da tela inicial com botão "Área do Cliente" (ativado)
- [x] Proteção de rotas autenticadas do cliente

## Melhorias v2.1 — Integrações Google e Upload de Mídia
- [x] Google Places Autocomplete no endereço da barbearia
- [x] Upload de logo da barbearia (SingleImageUploader)
- [x] Galeria de fotos do ambiente da barbearia (até 8 fotos)
- [x] Upload de fotos e vídeos nos serviços (MediaUploader)
- [x] Upload de fotos e vídeos nos produtos (MediaUploader)
- [x] Login com Google para a área do cliente (expo-auth-session)
- [x] Rota googleLogin no servidor (clientAuth)
- [x] Campo googleId na tabela client_accounts
- [x] Credenciais Google Maps API e OAuth configuradas como env vars
- [x] Ícones photo.on.rectangle e mappin adicionados ao icon-symbol.tsx

## Notificações Push — Lembretes de Agendamento
- [x] Ler documentação expo-notifications
- [x] Hook useNotifications com solicitação de permissão e canal Android
- [x] Agendamento de notificação local 1h antes ao confirmar agendamento (área do cliente)
- [x] Agendamento de notificação local 1h antes ao criar agendamento (painel admin)
- [x] Cancelamento automático da notificação ao cancelar agendamento (cliente e admin)
- [x] Listener de notificações no layout raiz do app (NotificationsSetup)
- [x] Integração no fluxo book.tsx (cliente)
- [x] Integração no fluxo agenda.tsx (admin)
- [x] Botão de cancelar agendamento na tela de histórico do cliente

## Melhorias v2.3

- [x] Seletor de duração livre (tipo relógio com horas e minutos) no cadastro de serviços
- [x] Seletor de horário de início e fim de trabalho configurável nas configurações do barbeiro

## Correção v2.3.1

- [x] Corrigir erro 400 redirect_uri_mismatch no Login com Google

## Melhorias v2.4

- [x] Login com Google na tela de Criar Conta (register.tsx)
- [x] Notificação push para o barbeiro ao receber novo agendamento do cliente
- [x] Fluxo de recuperação de senha por e-mail (solicitar código, verificar, redefinir)
- [x] Link "Esqueci minha senha" na tela de login do cliente

## Funcionalidade de Aniversário do Cliente

- [x] Campo birthdate na tabela clients (banco de dados + migração)
- [x] Rota tRPC para salvar/atualizar data de nascimento do cliente
- [x] Seletor de data de nascimento na tela de perfil do cliente
- [x] Lógica de geração automática de cupom de aniversário (válido no mês do aniversário)
- [x] Rota tRPC para verificar e gerar cupom de aniversário
- [x] Painel de aniversariantes do dia e do mês na tela de Clientes (admin)

## Melhorias de Aniversário (Round 2)

- [x] Campo de data de nascimento na tela de cadastro do cliente (register.tsx)
- [x] Investigar obtenção de birthDate via Google People API no login Google (não viável sem verificação Google; banner de convite implementado)
- [x] Notificação push automática de aniversário (YEARLY trigger local às 9h, agendado no login/updateClient)
- [x] Notificação de aniversário agendada localmente via expo-notifications (sem necessidade de servidor)

## Fase A — Integração Mercado Pago

- [x] Instalar SDK mercadopago (Node.js) no projeto
- [x] Rota tRPC payments.createPreference (gerar link de pagamento)
- [x] Integrar link de pagamento no fluxo de agendamento do cliente (book.tsx)
- [x] Webhook de confirmação de pagamento (atualizar status do agendamento)
- [x] Histórico de transações Mercado Pago no painel financeiro do admin

## Melhorias Mercado Pago (Round 2)

- [x] Pix com QR Code nativo no app (rota servidor + tela cliente)
- [x] Card de pagamentos pendentes no dashboard admin
- [x] Tutorial de configuração do webhook IPN no Mercado Pago (PDF)

## Fase B — Relatórios e Inteligência de Negócio

- [x] Tela de Relatórios no painel admin (nova aba)
- [x] Gráfico de faturamento por semana/mês (barras)
- [x] Ranking dos serviços mais vendidos
- [x] Clientes mais frequentes e com maior ticket médio
- [x] Taxa de ocupação dos barbeiros por período

## Melhorias de UX/Navegação

- [ ] Navegação híbrida no painel admin: 4 abas no rodapé (Dashboard, Agenda, Clientes, Financeiro) + botão hamburguer (≡) no cabeçalho abrindo drawer lateral com Serviços, Produtos, Fidelidade, Relatórios e Configurações

## Correções de Texto/Semântica

- [x] Alterar texto do botão Google em register.tsx de "Criar conta com Google" para "Continuar com Google"

## Melhorias na Agenda (Admin)

- [x] Swipe gesture nos cards de agendamento: arrastar direita (→) avança status positivo (Agendado→Confirmado→Concluído), arrastar esquerda (←) abre menu rápido com Cancelar / Não compareceu
- [x] Corrigir botão "Alterar Status" que não executa ação (substituído pelo swipe)

## Integração Instagram

- [x] Campo @instagram da barbearia nas configurações (settings.tsx)
- [x] Botão "Siga-nos no Instagram" na tela Home do cliente, abrindo o perfil diretamente no app do Instagram

## Integrações Futuras — Redes Sociais

- [ ] [FUTURO] Compartilhar agendamento confirmado nos Instagram Stories: gerar card estilizado com react-native-view-shot e abrir via expo-sharing com imagem pré-carregada

- [ ] Google Business (avaliações): após atendimento concluído, enviar notificação ao cliente com link direto para avaliar a barbearia no Google Maps
- [ ] [FUTURO] TikTok Share: compartilhar resultado do corte no TikTok com card da barbearia
- [ ] [FUTURO] Facebook/Instagram Booking API: agendamento direto pelo perfil da barbearia no Instagram
- [ ] [FUTURO] WhatsApp Business API: sincronizar catálogo de serviços com o catálogo do WhatsApp Business

## Melhorias Financeiras

- [ ] Pix QR Code nativo no app (rota servidor + tela cliente com QR Code gerado via Mercado Pago)
- [ ] Exportação de relatório financeiro em PDF para contabilidade (receitas, despesas, lucro por período)
- [x] Campo CNPJ da barbearia nas configurações
- [ ] Relatório mensal no formato adequado para imposto de renda (DRE simplificado)

## Personalização de Tema

- [ ] Seletor de tema claro/escuro nas configurações do cliente e do admin (respeitar preferência do sistema por padrão)

## Melhorias na Home do Cliente

- [x] Botão Instagram na Home do cliente (usa o @ cadastrado nas configurações do admin)
- [x] Botão "Como chegar" na Home do cliente abrindo Google Maps com endereço da barbearia

## Versão Web (Painel Admin)

- [ ] [AVALIAR] Criar versão web responsiva do painel administrativo (o Expo já gera build web — avaliar se a experiência atual no navegador já é suficiente ou se precisa de layout adaptado para telas grandes)

## Tela de Pagamento Pix

- [x] Rota servidor: gerar QR Code Pix via Mercado Pago (com fallback local para dev)
- [x] Tela dedicada de pagamento Pix no app do cliente (fora do modal)
- [x] Exibir QR Code, código copia-e-cola e timer de expiração
- [x] Integrar tela Pix no fluxo de agendamento (book.tsx)

## Cobrança de Pagamento pelo Barbeiro (Agenda)

- [x] Rota tRPC appointments.getPaymentStatus (verifica se o agendamento já foi pago via tabela sales)
- [x] Rota tRPC appointments.registerPayment (registra pagamento manual pelo barbeiro criando venda na tabela sales)
- [x] Componente PaymentStatusModal: exibe status e opções de cobrança
- [x] Ao concluir agendamento via swipe (→ Concluído), abrir modal de pagamento automaticamente
- [x] Modal: se já pago → mensagem de confirmação com método e valor
- [x] Modal: se não pago → opções: Pix QR Code na tela, link WhatsApp para cobrar, registrar pagamento manual (dinheiro/cartão/Pix no local)
- [x] Badge "Pagamento pendente" / "✓ Pago" nos cards de agendamento concluídos
- [x] Ao tocar em card concluído, reabre o modal de pagamento

## Melhorias v2.8

- [x] Campo Chave Pix nas configurações do admin (CNPJ, CPF, e-mail ou telefone)
- [x] Integrar chave Pix real no QR Code gerado pelo barbeiro no PaymentStatusModal
- [x] Integrar chave Pix real no QR Code da tela de pagamento do cliente (pix-payment.tsx)
- [x] Exportação de relatório financeiro em PDF (DRE simplificado por período)
- [x] PDF com: nome da barbearia, CNPJ, período, receitas por categoria, despesas, lucro líquido
- [x] Botão "Exportar PDF" na tela de Relatórios do admin
- [x] Navegação híbrida no admin: 4 abas no rodapé (Dashboard, Agenda, Clientes, Financeiro)
- [x] Drawer lateral (≡) no cabeçalho com: Serviços, Produtos, Fidelidade, Relatórios, Configurações

## Melhorias v2.9

- [x] Seletor de tema claro/escuro nas configurações do cliente (toggle: Claro / Escuro / Seguir sistema)
- [x] Seletor de tema claro/escuro nas configurações do admin (mesmo padrão)
- [x] Persistir preferência de tema com AsyncStorage
- [x] Compartilhar agendamento confirmado no WhatsApp (card com data, horário, serviço e barbeiro)
- [x] Botão "Compartilhar" na tela de confirmação de agendamento (book.tsx)
- [x] Notificação push de avaliação 2h após o horário do atendimento (agendada ao confirmar agendamento)
- [x] Cancelamento da notificação de avaliação ao cancelar agendamento via swipe

## Melhorias v3.0

- [x] Tema claro: fundo branco marfim + vinho/borgonha (#7B2D3E) como segunda cor dominante
- [x] Atualizar theme.config.js com paleta light/dark separada e todas as telas do admin usando useColors()
- [x] Campo "Descrição" na venda substituído por seletor de serviços/produtos cadastrados (com preço automático)
- [x] Corrigir teclado cobrindo campos no login do painel administrativo (KeyboardAvoidingView + ScrollView)
- [x] Corrigir teclado no setup.tsx (Primeiro acesso)

## Bug v3.0.1

- [x] Erro na aba "Receitas" dentro do Financeiro — createdAt retornado como Date pelo Drizzle ORM, corrigido com new Date(sale.createdAt).toLocaleDateString("pt-BR")

## Fidelidade v3.1 — Aplicação de Cupons no Agendamento

- [x] Rota tRPC `coupons.getAvailableForClient`: retorna cupons ativos + recompensas resgatáveis pelo cliente
- [x] Componente `DiscountSheet`: bottom sheet com campo de código manual, lista de cupons disponíveis e recompensas de pontos
- [x] Banner proativo na tela de confirmação: aparece se cliente tiver cupom ou pontos suficientes para resgatar recompensa
- [x] Botão "Tenho um cupom ou quero usar pontos" na tela de confirmação (step confirm)
- [x] Desconto aplicado no resumo do agendamento com valor final calculado
- [x] Valor com desconto passado para tela de pagamento Pix e Mercado Pago
- [x] Banner verde ao aplicar desconto com opção de remover
- [x] Desconto resetado ao trocar de serviço
- [x] Desconto passado para a tela de pagamento Pix e para o registro da venda
- [x] Validação em tempo real do código de cupom digitado manualmente
- [x] Ao resgatar recompensa de pontos, deduzir pontos do cliente automaticamente ao confirmar

## Redesign Home v3.2

- [ ] Remover botão "Compartilhar Agendamento" do book.tsx após confirmação
- [ ] Remover seção "Acesso Rápido" da Home do cliente
- [ ] Atualizar rota services.list e products.list para incluir a primeira foto de cada item
- [ ] Substituir emojis por logos reais do Instagram e Google Maps na seção "Nos encontre"
- [ ] Converter seção "Produtos" para scroll horizontal (igual aos Serviços)
- [ ] Exibir fotos reais dos serviços e produtos nos cards da Home
- [ ] Melhorar visual geral da Home (hierarquia, espaçamento, tipografia)

## Redesign Home do Cliente v3.2

- [x] Remover botão "Compartilhar agendamento" da tela de confirmação de agendamento (book.tsx)
- [x] Remover seção "Acesso rápido" da Home do cliente
- [x] Substituir emoji 📸 por ícone SVG real do Instagram (gradiente colorido) na seção "Nos encontre"
- [x] Substituir emoji 📍 por ícone SVG real do Google Maps (pin vermelho) na seção "Nos encontre"
- [x] Converter seção de Produtos para scroll horizontal (FlatList horizontal) igual à seção de Serviços
- [x] Criar rotas tRPC `services.listWithMedia` e `products.listWithMedia` que retornam thumbnail da primeira foto
- [x] Exibir foto real dos serviços nos cards da Home (com fallback para emoji ✂️ se sem foto)
- [x] Exibir foto real dos produtos nos cards da Home (com fallback para emoji 🧴 se sem foto)
- [x] Migrar home.tsx para usar StyleSheet.create() em vez de inline styles

## Melhorias Home v3.3 — Hero Image e Avaliações

- [x] Hero image configurável no banner de agendamento (usa logoUrl das settings; fallback para fundo sólido)
- [x] Overlay escuro sobre a hero image para garantir legibilidade do texto
- [x] Rota tRPC `services.listWithMediaAndRatings` que retorna thumbnail + avgRating + reviewCount por serviço
- [x] Estrelas de avaliação (★) nos cards de serviços da Home (média e contagem de avaliações)
- [x] Texto "Sem avaliações" para serviços sem reviews cadastradas

## Novas Funcionalidades v3.4 — Paridade AppBarber + Comissões

### Mensagens de Retorno Automáticas
- [x] Tabela `return_messages` no banco (serviceId, delayDays, messageTemplate, isActive)
- [x] Rota admin para configurar mensagem de retorno por serviço
- [x] Job no servidor: ao concluir agendamento, agendar push de retorno com delay configurado
- [x] Tela admin: "Mensagens de Retorno" — lista de serviços com configuração de dias e mensagem
- [x] Cancelar push agendado se cliente reagendar antes do prazo

### Envio de Promoções e Notícias
- [x] Tabela `promotions` no banco (title, message, targetAudience, sentAt, recipientCount)
- [x] Rota admin para criar e disparar promoção para público segmentado
- [x] Segmentos: todos, clientes inativos há X dias, aniversariantes do mês
- [x] Tela admin: "Promoções" — formulário de criação + histórico de envios com métricas
- [x] Tela cliente: notificação push recebida abre modal com detalhes da promoção

### Lista de Espera Automática
- [x] Tabela `waitlist` no banco (clientId, barberId, date, serviceId, notifiedAt)
- [x] Rota cliente para entrar/sair da lista de espera de um dia
- [x] Trigger no servidor: ao cancelar agendamento, notificar próximo da fila
- [x] Tela cliente: botão "Entrar na lista de espera" quando não há horário disponível
- [x] Tela admin: painel de lista de espera por dia e barbeiro

### Controle de Comissões por Barbeiro
- [x] Campo `commissionRate` (%) na tabela de barbeiros
- [x] Tabela `commission_entries` (barberId, appointmentId, saleId, grossValue, commissionValue, date)
- [x] Cálculo automático de comissão ao concluir agendamento ou venda
- [x] Tela admin: "Comissões" — relatório por barbeiro e período com total bruto, comissão e líquido
- [x] Tela admin: configuração de % de comissão por barbeiro (pode ser diferente por serviço)
- [x] Tela barbeiro (app): visualização das próprias comissões do período

## Novas Funcionalidades v3.5

### Comissões para o Barbeiro
- [ ] Aba "Minhas Comissões" no app do barbeiro (tab ou tela acessível pelo perfil)
- [ ] Seletor de mês para visualizar comissões do período
- [ ] Cards: total bruto, comissão a receber, atendimentos realizados
- [ ] Lista de atendimentos com valor individual de comissão

### Agendamento Recorrente
- [ ] Tabela `recurring_appointments` no banco (clientId, barberId, serviceId, startDate, intervalWeeks, endDate, isActive)
- [ ] Rota tRPC: criar agendamento recorrente (gera N agendamentos futuros)
- [ ] Opção "Repetir agendamento" na tela de confirmação do cliente (book.tsx)
- [ ] Seletor de frequência: toda semana, a cada 2 semanas, a cada 3 semanas, mensal
- [ ] Tela admin: visualizar e cancelar séries de agendamentos recorrentes

### Relatório de Conversão de Promoções
- [ ] Rota tRPC: promotions.conversionReport (clientes que agendaram em até 7 dias após receber promoção)
- [ ] Adicionar coluna "Conversões" e "Taxa de conversão" na tela de Promoções do admin
- [ ] Exibir gráfico de barras simples com conversão por promoção

### Controle de Estoque
- [ ] Campo `productType` na tabela products: "sale" (venda ao cliente) ou "internal" (uso do barbeiro)
- [ ] Campo `stockQuantity` (quantidade atual) e `minStockAlert` (alerta de estoque mínimo) na tabela products
- [ ] Tabela `stock_movements` (productId, type: in/out/adjustment, quantity, reason, barberId, date)
- [ ] Baixa automática de estoque ao registrar venda de produto (tipo "sale")
- [ ] Baixa manual de estoque para produtos de uso interno (barbeiro registra o consumo)
- [ ] Tela admin: "Estoque" — lista de produtos com quantidade atual, badge de alerta mínimo
- [ ] Tela admin: registrar entrada de estoque (compra de produtos)
- [ ] Tela admin: histórico de movimentações por produto
- [ ] Tela admin: relatório de consumo médio mensal por produto (média dos últimos 3 meses)
- [ ] Tela admin: previsão de ruptura (quantos dias até acabar com base no consumo médio)
- [ ] Notificação push para admin quando produto atingir estoque mínimo

## Funcionalidades v3.5 — Concluídas

- [x] Tela "Minhas Comissões" para o barbeiro (app admin, visível apenas para role barber/super_admin)
- [x] Agendamento Recorrente — banco (tabela recurring_appointments + migração)
- [x] Agendamento Recorrente — backend (rotas tRPC: create, listByClient, cancel, listAll)
- [x] Agendamento Recorrente — tela cliente (criar, listar, cancelar recorrências com preview de datas)
- [x] Agendamento Recorrente — tela admin (painel de recorrências ativas com cancelamento)
- [x] Relatório de Conversão de Promoções — backend (getPromotionConversionReport com janela de 7 dias)
- [x] Relatório de Conversão de Promoções — tela admin (taxa de conversão por campanha, barra de progresso, cards de resumo)
- [x] Controle de Estoque — banco (tabela stock_movements, campos productType/stockQuantity/minStockAlert em products + migração)
- [x] Controle de Estoque — backend (getStockProducts, addStockMovement, getStockMovements, getStockConsumptionAverage, getLowStockProducts)
- [x] Controle de Estoque — tela admin (filtros por tipo, entrada/saída/ajuste, histórico, previsão de ruptura, alerta de estoque baixo)
- [x] Novas telas (Estoque, Recorrências, Conversão de Promoções) registradas no drawer de navegação admin

## Bug v3.5.1

- [x] Corrigir menu rodapé admin: exibir apenas 4 abas (Dashboard, Agenda, Clientes, Financeiro) — demais telas só no drawer
