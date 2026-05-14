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

- [x] Navegação híbrida no painel admin: 4 abas no rodapé (Dashboard, Agenda, Clientes, Financeiro) + botão hamburguer (≡) no cabeçalho abrindo drawer lateral com Serviços, Produtos, Fidelidade, Relatórios e Configurações

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

- [x] Pix QR Code nativo no app (rota servidor + tela cliente com QR Code gerado via Mercado Pago)
- [x] Exportação de relatório financeiro em PDF para contabilidade (receitas, despesas, lucro por período)
- [x] Campo CNPJ da barbearia nas configurações
- [ ] Relatório mensal no formato adequado para imposto de renda (DRE simplificado)

## Personalização de Tema

- [ ] Seletor de tema claro/escuro nas configurações do cliente e do admin (respeitar preferência do sistema por padrão)

## Melhorias na Home do Cliente

- [x] Botão Instagram na Home do cliente (usa o @ cadastrado nas configurações do admin)
- [x] Botão "Como chegar" na Home do cliente abrindo Google Maps com endereço da barbearia

## Versão Web (Painel Admin)

- [ ] [AVALIAR] Criar versão web responsiva do painel administrativo (o Expo já gera build web — avaliar se a experiência atual no navegador já é suficiente ou se precisa de layout adaptado para telas grandes)

## Painel Admin Web — Novas Seções

- [x] Lista de Espera no painel admin web
- [x] Estoque no painel admin web
- [x] Recorrências no painel admin web
- [x] Conversão de Promoções no painel admin web
- [x] Retorno Automático no painel admin web
- [x] Relatórios no painel admin web
- [x] Meu Perfil no painel admin web

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

### Redesign Home v3.2
- [x] Remover botão "Compartilhar Agendamento" do book.tsx após confirmação
- [x] Remover seção "Acesso Rápido" da Home do cliente
- [x] Atualizar rota services.list e products.list para incluir a primeira foto de cada item
- [x] Substituir emojis por logos reais do Instagram e Google Maps na seção "Nos encontre"
- [x] Converter seção "Produtos" para scroll horizontal (igual aos Serviços)
- [x] Exibir fotos reais dos serviços e produtos nos cards da Home
- [x] Melhorar visual geral da Home (hierarquia, espaçamento, tipografia)

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

## Novas Funcionalidades v3.5
- [x] Aba "Minhas Comissões" no app do barbeiro (tab ou tela acessível pelo perfil)
- [x] Seletor de mês para visualizar comissões do período
- [x] Cards: total bruto, comissão a receber, atendimentos realizados
- [x] Lista de atendimentos com valor individual de comissão

## Agendamento Recorrente (v3.5)
- [x] Tabela `recurring_appointments` no banco (clientId, barberId, serviceId, startDate, intervalWeeks, endDate, isActive)
- [x] Rota tRPC: criar agendamento recorrente (gera N agendamentos futuros)
- [x] Opção "Repetir agendamento" na tela de confirmação do cliente (book.tsx)
- [x] Seletor de frequência: toda semana, a cada 2 semanas, a cada 3 semanas, mensal
- [x] Tela admin: visualizar e cancelar séries de agendamentos recorrentes

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
- [x] Tela admin: "Estoque" — lista de produtos com quantidade atual, badge de alerta mínimo
- [x] Tela admin: registrar entrada de estoque (compra de produtos)
- [x] Tela admin: histórico de movimentações por produto
- [x] Tela admin: relatório de consumo médio mensal por produto (média dos últimos 3 meses)
- [x] Tela admin: previsão de ruptura (quantos dias até acabar com base no consumo médio)
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

## Bug v3.5.2

- [x] Corrigir botão "Nova Promoção" invadindo safe area do topo (promotions.tsx) — movido para rightElement do AdminHeader
- [x] Auditar e corrigir todos os botões flutuantes nas telas admin que não respeitam useSafeAreaInsets — demais telas estão corretas

## Bug v3.5.3

- [x] Corrigir erro de login: "Failed query: select from barbers" — coluna inexistente no banco (schema desatualizado — erro era ETIMEDOUT temporário, banco sincronizado)

## Reorganização Menu Admin v3.6
- [x] Criar tela "Barbearia" com: nome, CNPJ, endereço, telefone, WhatsApp, Instagram, logo, galeria, chave Pix, token Mercado Pago, equipe (barbeiros), horários de funcionamento
- [x] Criar tela "Meu Perfil" independente (nome, foto, e-mail, alterar senha)
- [x] Simplificar settings.tsx para conter apenas preferências do sistema (tema, notificações)
- [x] Refatorar admin-drawer.tsx com grupos rotulados: OPERAÇÃO, CATÁLOGO, MARKETING, FINANCEIRO, SISTEMA
- [x] Aplicar hierarquia de acesso por role no drawer: super_admin vê tudo, barber vê apenas Agenda/Clientes/Minhas Comissões, receptionist vê Agenda/Clientes/Serviços/Produtos
- [x] Registrar novas telas (barbearia, my-profile) no _layout.tsx com tabBarItemStyle display nonee

## Reorganização Menu Admin v3.6

- [x] Drawer com grupos rotulados (OPERAÇÃO, CATÁLOGO, MARKETING, FINANCEIRO, SISTEMA)
- [x] Hierarquia de acesso por role (super_admin, barber, receptionist) — itens filtrados por role
- [x] Tela Barbearia criada (dados da empresa, equipe, horários, integrações/Mercado Pago/Pix)
- [x] Tela Meu Perfil independente no topo do drawer (nome, telefone, alterar senha, sair)
- [x] Configurações simplificada (apenas tema/aparência + versão do app)
- [x] Novas telas registradas no _layout.tsx com display none (barbearia, my-profile)
- [x] Ícones novos adicionados ao icon-symbol.tsx (building.2.fill, tray.full.fill, etc.)

## Melhorias v3.7

- [x] Foto de perfil no Meu Perfil (upload via câmera/galeria, exibir avatar real no drawer)
- [x] Máscara de telefone em todo o sistema (formato (99) 99999-9999)
- [x] Campo CNPJ/CPF unificado na tela Barbearia com detecção automática do tipo de documento

## Melhorias v3.8

- [x] Avatar real no drawer lateral (exibir foto de perfil do barbeiro logado no cabeçalho do drawer)
- [x] Validação de CPF/CNPJ com dígito verificador (aviso discreto se documento inválido)
- [x] Máscara de CEP (XXXXX-XXX) com busca automática de endereço via ViaCEP na tela Barbearia

## Melhorias v3.9

- [x] Campo Número/Complemento após busca de CEP na tela Barbearia (compõe endereço completo)
- [x] Reordenação da galeria de fotos da barbearia por arrastar e soltar (drag-and-drop)

## Correções v3.9.1

- [x] Máscara de telefone no campo WhatsApp (com DDD) na tela Barbearia
- [x] Corrigir rota da Agenda no drawer lateral (não encontra a tela)
- [x] Ajustar safe area em todas as telas admin (paddingBottom dinâmico com useSafeAreaInsets)

## Melhorias v3.10

- [x] Reduzir padding superior do AdminHeader (aproveitar área abaixo da status bar)
- [x] Corrigir corte de itens no rodapé (tab bar sobrepondo conteúdo)
- [x] Intervalo de almoço (entrada/saída) na aba Horários da Barbearia

## Melhorias v3.11

- [x] Bloquear agendamentos durante o intervalo de almoço do barbeiro
- [x] Ocultar horários passados ao agendar para o dia atual

## Reformulação Home do Cliente v4.0

- [x] Logo redondo da barbearia no canto superior esquerdo
- [x] Nome da barbearia e saudação ao usuário no header
- [x] Indicador "Aberto agora / Fechado" com horário em tempo real
- [x] Carrossel de fotos do ambiente da barbearia
- [x] Botão "Agende seu horário" em destaque
- [x] Avaliações em destaque (últimas 5, carrossel horizontal)
- [x] Botões "Nos Encontre" (WhatsApp, Instagram, Google Maps)
- [x] Remover serviços e produtos da Home (já existem abas dedicadas)

## Melhorias v4.1

- [x] Atualizar visual da aba Serviços do cliente (fundo escuro, tipografia dourada, consistente com Home)
- [x] Animação de entrada (fade-in suave) nos elementos da Home do cliente

## Melhorias v4.2

- [x] Aplicar identidade visual da aba Serviços na aba Produtos (fundo escuro, badge de preço, filtro por categoria, animação de entrada, grid 2 colunas)

## Identidade Visual Completa v4.3

- [x] Reformular history.tsx (histórico de agendamentos do cliente)
- [x] Reformular profile.tsx (perfil do cliente)
- [x] book.tsx já usa identidade visual correta (fundo preto, dourado)
- [x] Reformular recurring.tsx (agendamento recorrente)
- [x] Reformular login.tsx (login do cliente)
- [x] Reformular register.tsx (cadastro do cliente)
- [x] Reformular forgot-password.tsx (recuperação de senha)
- [x] pix-payment.tsx já usa identidade visual correta

## Bugs v4.4

- [x] Dados da barbearia cortados no drawer lateral (flexDirection + contentContainerStyle corrigidos)
- [x] Logo da barbearia não aparece na Home da área do cliente (logoUrl adicionado ao settings.update)

## Bugs v4.5 (reincidentes)

- [x] Drawer lateral ainda cortando dados da barbearia — removido paddingBottom do painel, movido para contentContainerStyle do ScrollView com insets.bottom+48
- [x] Logo da barbearia não aparecia na Home do cliente — logo e galeria agora são salvos automaticamente no banco após o upload (sem precisar clicar em SALVAR DADOS)

## Correções e Funcionalidades v4.6

- [x] Corrigir corte das abas da tela Barbearia (removido marginHorizontal do tabsScroll, adicionado paddingHorizontal no contentContainer)
- [x] Corrigir corte dos campos de texto na aba Integrações (ScreenContainer com edges=["top"] para evitar safe area lateral)
- [x] Gestão de usuários exclusiva do Super Admin (botão excluir com confirmação, protegido contra exclusão do próprio Super Admin)

## Diagnóstico e Correções v4.7

- [x] Mover hidratação de estado do settingsQuery em barbearia.tsx para useEffect (side-effect no render causando loops)
- [x] Garantir GestureHandlerRootView no app/_layout.tsx raiz (gestos quebrados em outras telas)
- [x] Corrigir AdminDrawer: substituir acesso a _value interno do Animated por estado React
- [x] Otimizar queries N+1 nas telas de Serviços e Produtos do cliente (usar listWithMediaAndRatings e listWithMedia)
- [x] Auditar SafeArea/padding em todas as telas admin (já corrigido em v3.9.1 e v3.10)
- [x] Validar lógica de fuso horário (UTC-3 fixo correto para Brasil desde 2019 sem horário de verão)

## Melhorias v4.8

- [x] Tela de boas-vindas premium: splash screen animada com logo dourado antes dos botões de acesso
- [x] Reativar usuários excluídos: botão de reativação no painel de Equipe (soft delete reverso)
- [x] Card de próximo agendamento na Home do cliente (data, horário, serviço, barbeiro, botão cancelar)

## Melhorias v4.9

- [x] Carrossel automático com auto-play animado na Home do cliente (troca a cada 4s com fade/slide suave)
- [x] Botão "Reagendar" no card de próximo agendamento (abre fluxo book.tsx com serviço pré-selecionado)
- [x] Configuração de antecedência do lembrete no perfil do cliente (1h, 2h, 24h) com persistência AsyncStorage

### Fluxo de Agendamento Otimizado v5.0
- [x] Backend: campo pushToken na tabela barbers + campo cancelReason na tabela appointments
- [x] Backend: endpoint barbers.savePushToken para registrar token ao fazer login
- [x] Backend: endpoint appointments.create com push server-side ao barbeiro via Expo Push API
- [x] Backend: endpoint appointments.cancelWithReason com campo de motivo
- [x] Fluxo book.tsx: status inicial confirmed (sem passar por scheduled)
- [x] Fluxo book.tsx: remover abertura automática do WhatsApp ao criar agendamento
- [x] Fluxo book.tsx: modal de seleção de lembrete pós-agendamento (1h, 45min, 30min, 15min)
- [x] Admin: salvar push token ao fazer login no painel admin (login.tsx)
- [x] Admin: botão WhatsApp no card de agendamento (abre wa.me com número do cliente)
- [x] Admin: modal de cancelamento com motivo (Imprevisto, Fériado, Problema técnico, Outro)
- [x] Avaliação rápida pós-atendimento: modal automático na Home do cliente com estrelas (1-5) e comentário

## Melhorias v5.1
- [x] Barra de progresso animada no carrossel (substitui pontos estáticos, mostra tempo restante até próxima troca)
- [x] Motivo de cancelamento exibido no card do histórico do cliente
- [x] Filtro de barbeiro na agenda do admin (seletor rápido no topo da tela, apenas super_admin/receptionist)

## Melhorias v5.2
- [x] Relatório de ocupação por barbeiro: gráfico de barras com agendamentos e % de ocupação por período
- [x] Bloqueio de horário em lote: selecionar intervalo de datas para bloquear horários de um barbeiro
- [x] Busca de agendamento por cliente na agenda do admin (campo de busca no topo)

## Fase 1 SaaS — Fundação Multi-Tenant (v6.0)
- [x] Tabela `tenants` no banco (id, slug, nome, plano, status, createdAt)
- [x] Campo `tenantId` nas tabelas core: barbers, clients, shopSettings (tabelas filho herdam via join)
- [x] Endpoints de onboarding: onboarding.register, onboarding.checkSlug, onboarding.listTenants
- [x] Wizard de cadastro da barbearia: Etapa 1 — Dados básicos (nome, telefone, CNPJ)
- [x] Wizard de cadastro da barbearia: Etapa 2 — Endereço (CEP com auto-preenchimento, número, complemento)
- [x] Wizard de cadastro da barbearia: Etapa 3 — Horários de funcionamento (dias e horários)
- [x] Wizard de cadastro da barbearia: Etapa 4 — Conta do administrador (nome, email, senha)
- [x] Tela de seleção de plano (Solo R$49, Equipe R$89, Estúdio R$149)
- [x] Integrar fluxo completo: tela inicial → selecionar plano → wizard → dashboard

## Fase 1 SaaS — Continuação (v6.1)
- [x] Botão "Cadastrar minha barbearia" na tela inicial (index.tsx)
- [x] Tela de seleção de plano (plan-selection.tsx): Solo R$49, Equipe R$89, Estúdio R$149 com comparativo
- [x] Endpoint onboarding.register: aceitar campo `plan` vindo da tela de seleção
- [x] Isolamento por tenantId: getAllBarbers, getAllBarbersIncludingInactive filtrar por tenantId quando presente
- [x] Isolamento por tenantId: getAllClients filtrar por tenantId quando presente
- [x] Isolamento por tenantId: `getAllServices`, `getAllServicesWithMedia`, `getAllServicesWithMediaAndRatings`
- [x] Isolamento por tenantId: `getAllProducts`, `getAllProductsWithMedia`
- [x] Isolamento por tenantId: `getAllAppointmentsByDate`, `getAppointmentsByDate` via barbeiro
- [x] Isolamento por tenantId: getShopSettings filtrar por tenantId quando presente

## Fase 2 Web — Backoffice Super-Admin (v6.2)
- [x] Rota GET /superadmin/login — página de login com senha protegida
- [x] Rota POST /superadmin/login — autenticação com cookie de sessão (HttpOnly, 24h)
- [x] Rota GET /superadmin/logout — limpar cookie e redirecionar para login
- [x] Rota GET /superadmin — dashboard com métricas (total, ativos, trial, suspensos, MRR)
- [x] Tabela de tenants com nome, slug, plano, status, dias de trial, data de cadastro
- [x] Ações: ativar, suspender, alterar plano por tenant
- [x] Modal de alteração de plano (Solo/Equipe/Estúdio)
- [x] SUPERADMIN_PASSWORD configurada via secrets
- [x] ENV.superadminPassword lido do process.env com fallback

## Fase 2 Web — Infraestrutura de Subdomínios (v6.3)
- [x] Middleware de roteamento por subdomínio: ler header Host, extrair slug, buscar tenant
- [x] Rota GET /:slug/* — servir página pública do tenant identificado pelo subdomínio
- [x] Fallback para domínio principal (sem slug) — redirecionar para landing do Barber Pro

## Fase 3 Web — Página Pública de cada Barbearia (v6.3)
- [x] Landing page: hero com logo, banner, nome e descrição da barbearia
- [x] Seção de serviços: lista com nome, duração, preço e foto
- [x] Seção de galeria: fotos do ambiente
- [x] Seção de avaliações: nota média e depoimentos de clientes
- [x] Botão de agendamento online com login do cliente
- [x] Página de agendamento: seleção de serviço, barbeiro, data e hora
- [ ] Confirmação de agendamento por email/WhatsApp

## Limite de Barbeiros por Plano (v6.3)
- [x] Validação no endpoint barber.create: Solo ≤ 1, Equipe ≤ 5, Estúdio = ilimitado
- [x] Mensagem de erro clara quando o limite é atingido

## Fase 4 Web — Painel Admin Web (v6.4)
- [x] Rota /admin/login — autenticação com email/senha do barbeiro (super_admin)
- [x] Rota /admin — dashboard com métricas do dia (agendamentos, faturamento, clientes)
- [x] Rota /admin/agenda — agenda do dia com lista de agendamentos e status
- [x] Rota /admin/clientes — lista de clientes com busca e histórico
- [x] Rota /admin/servicos — gestão de serviços (listar, ativar/desativar)
- [x] Rota /admin/financeiro — resumo financeiro mensal
- [x] Rota /admin/configuracoes — configurações da barbearia
- [x] Navegação lateral com menu e logout

## Fase 5 Web — Personalização Visual (v6.4)
- [x] Adicionar campos primaryColor e bannerUrl ao schema shopSettings
- [x] Migração de banco de dados para novos campos
- [x] Tela de personalização no app (Configurações → Aparência da Página Pública)
- [x] Aplicar primaryColor e bannerUrl na página pública de cada barbearia

## Fase 6 Web — Agendamento Online Completo (v6.4)
- [x] Página de login do cliente na página pública (/pub/:slug/login)
- [x] Consulta de horários disponíveis em tempo real via API
- [x] Criação de agendamento pelo cliente logado
- [x] Confirmação de agendamento com mensagem WhatsApp

## Fase 4 Web — Painel Admin (v6.4)

- [x] Painel web admin (/admin) com autenticação por sessão (barbeiro/admin)
- [x] Dashboard admin web: agendamentos do dia, clientes, serviços, financeiro
- [x] Agenda semanal no painel web admin
- [x] Gestão de clientes no painel web admin
- [x] Relatórios financeiros no painel web admin

## Fase 5 Web — Personalização Visual (v6.4)

- [x] Campo primaryColor no schema shopSettings (migração aplicada)
- [x] Campo bannerUrl no schema shopSettings (migração aplicada)
- [x] Endpoint settings.update aceita primaryColor e bannerUrl
- [x] Tela de personalização visual no app (page-appearance.tsx)
- [x] Link para tela de personalização na tela de configurações
- [x] Página pública usa primaryColor do tenant (não mais hardcoded)

## Fase 6 Web — Agendamento Online Completo (v6.4)

- [x] Endpoint REST GET /pub-api/slots: retorna horários disponíveis em tempo real
- [x] Endpoint REST POST /pub-api/login: autentica cliente com email/senha
- [x] Endpoint REST POST /pub-api/register: cria conta de cliente
- [x] Endpoint REST POST /pub-api/book: cria agendamento e notifica barbeiro
- [x] Página de agendamento com seleção de horário interativa (JavaScript)
- [x] Página de login do cliente (/pub/:slug/login)
- [x] Página de cadastro do cliente (/pub/:slug/cadastro)
- [x] Logout do cliente (/pub/:slug/logout)
- [x] Sessão do cliente via cookie (7 dias)
- [x] Pré-preenchimento de campos via query string após logi## Fase 7 Web — Meus Agendamentos, Admin Web e E-mail (v6.5)
- [x] Página /pub/:slug/meus-agendamentos: lista de agendamentos do cliente logado (próximos e passados)
- [x] Botão cancelar agendamento na página de meus agendamentos
- [x] Link "Meus Agendamentos" na página de agendamento e no cabeçalho quando logado
- [x] Formulário de criar agendamento no painel admin web (/admin)
- [x] Seleção de cliente, serviço, barbeiro e horário disponível no formulário admin web
- [x] E-mail de confirmação ao cliente após agendamento online
- [x] E-mail de lembrete 24h antes do agendamentohes do agendamento (data, hora, serviço, barbeiro)

## Fase 7 Web — Meus Agendamentos, Criar Agendamento Admin e E-mail

- [x] Página /pub/:slug/meus-agendamentos com lista de agendamentos do cliente logado
- [x] Cancelamento de agendamento pela página de meus agendamentos
- [x] Formulário /admin/agenda/novo: criar agendamento com cliente, serviço, barbeiro, data e horário
- [x] Validação de conflito de horário no formulário admin web
- [x] Módulo email.ts com nodemailer para envio de e-mails transacionais
- [x] E-mail de confirmação de agendamento enviado ao cliente após agendar pela web
- [x] Template HTML responsivo do e-mail de confirmação com detalhes do agendamento
- [x] Variáveis SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM para configuração

## Fase 8 Web — SMTP, Ações Agendamento e Login Google

- [x] Configurar Resend como provedor de e-mail (API Key via secrets)
- [x] Módulo email.ts usando SDK Resend para envio de e-mails HTML
- [x] E-mail de confirmação de agendamento enviado automaticamente após booking online
- [x] Ações de status na tabela de agendamentos do painel admin web (Confirmar, Iniciar, Concluir, Cancelar, Não veio)
- [x] Endpoint POST /admin-api/appointment-status para atualizar status via AJAX
- [x] Função updateAppointmentStatus no db.ts
- [x] Botão "Continuar com Google" na página de login/cadastro pública
- [x] Rota GET /pub-api/oauth-start para iniciar fluxo OAuth Google público
- [x] Rota GET /pub-api/oauth-callback para processar retorno OAuth e criar sessão de cliente

## Fase 9 Web — Relatórios, Clientes Detalhado e E-mail Barbeiro

- [x] Tela de Relatórios no painel admin web: KPIs (faturamento, despesas, lucro, vendas)
- [x] Gráfico SVG de faturamento por dia com período configurável (7/14/30/60/90 dias)
- [x] Ranking de serviços mais vendidos com barra de progresso
- [x] Desempenho por barbeiro: faturamento e atendimentos concluídos
- [x] Relatórios adicionado ao menu de navegação do painel admin
- [x] Tela de detalhe do cliente: histórico de agendamentos e pontos de fidelidade
- [x] Link de detalhe do cliente na tabela de clientes
- [x] Função sendBarberNotificationEmail: e-mail HTML dark com detalhes do agendamento
- [x] Envio de e-mail ao barbeiro quando cliente agenda pela página pública


## Fase 10 — Notificações Aprimoradas para Agendamentos Online

- [x] Canal Android "online-booking" com importância MAX, vibração tripla e badge
- [x] Canal Android "barber-pro-reminders" mantido para lembretes padrão
- [x] Funções incrementAppBadge() e clearAppBadge() exportadas do use-notifications.ts
- [x] Tela de agenda: badge zerado automaticamente ao abrir (useEffect)
- [x] sendExpoPushNotification: aceita channelId e badge opcionais
- [x] Endpoint /pub-api/book: notificação usa channelId "online-booking" e badge=1
- [x] Relatórios no painel admin web: gráfico de faturamento, ranking de serviços, desempenho por barbeiro
- [x] Gestão de clientes no painel admin web: busca, tabela, detalhe do cliente
- [x] Notificação por e-mail ao barbeiro quando cliente agenda pela página pública

### Fase 11 — Últimos passos do dia
- [x] CRUD de serviços no painel admin web: criar, editar, ativar/desativar
- [x] CRUD de produtos no painel admin web: criar, editar, controle de estoque
- [x] E-mail automático de avaliação pós-atendimento (2h após horário agendado)
- [x] Página pública de avaliação: /pub/:slug/avaliar/:appointmentId
- [x] Configurações da barbearia no painel web: horários, equipe, personalização visual

## Fase 12 — Banco de Dados Marketplace + Paridade Painel Web
- [x] Adicionar campos marketplace na tabela tenants: latitude, longitude, visivelMarketplace, descricao, fotoCapa
- [x] Migrar schema no banco de dados (migração 0016 aplicada)
- [x] Menu lateral do painel admin reorganizado em grupos: Operacional, Catálogo, Financeiro, Marketing, Sistema
- [x] Tela de Fidelidade no painel admin web: configurar regras de pontos e recompensas
- [x] Tela de Cupons no painel admin web: criar, editar, ativar/desativar cupons
- [x] Tela de Avaliações no painel admin web: média geral, distribuição por estrelas, lista de avaliações
- [x] Tela de Comissões no painel admin web: configurar percentual por barbeiro, resumo mensal

## Fase 13 — Landing Page + Pós-Onboarding + Teste de Usuário
- [x] Landing page do Barber Pro: hero, funcionalidades, planos, depoimentos, download, footer
- [x] Tela de confirmação pós-onboarding: boas-vindas, link da página pública, atalho para painel web
- [x] Validação do fluxo completo: cadastro de barbearia → página pública acessível → painel admin funcional

## Fase 14 — Redesign da Landing Page
- [x] Gerar logo profissional do Barber Pro (navalha douráda com círculo de barbearia)
- [x] Redesenhar landing page com identidade visual forte, hero impactante e logo integrado## Painel Admin Web — Chat, Relatórios e Exportação
- [x] Tabela whatsapp_messages no banco (clientId, barberId, direction, message, sentAt, status)
- [x] Rota GET /admin/chat — lista de clientes com última mensagem e data
- [x] Rota GET /admin/chat/:clientId — histórico de mensagens com o cliente
- [x] Rota POST /admin/chat/:clientId — salvar mensagem enviada e abrir link wa.me
- [x] Relatórios web com gráficos SVG: faturamento por mês (barras), ranking de serviços (barras horizontais)
- [x] Exportação de relatório financeiro em PDF pelo painel web
- [x] Tabela de clientes VIP (top 10 por faturamento) no relatório web
- [x] Desempenho por barbeiro no relatório web (atendimentos, faturamento, comissão)e, alerta mínimo, movimentações)

## Alta Prioridade v6.6

- [x] Isolamento multi-tenant: getAllServices, getAllServicesWithMedia, getAllServicesWithMediaAndRatings filtrar por tenantId
- [x] Isolamento multi-tenant: getAllProducts, getAllProductsWithMedia filtrar por tenantId
- [x] Isolamento multi-tenant: getAllAppointmentsByDate, getAppointmentsByDate filtrar por tenantId via barbeiro
- [x] Página /pub/:slug/meus-agendamentos: lista de agendamentos do cliente logado (próximos e passados)
- [x] Botão cancelar agendamento na página de meus agendamentos (web pública)
- [x] Link "Meus Agendamentos" no cabeçalho da página pública quando logado
- [x] Formulário /admin/agenda/novo: criar agendamento com cliente, serviço, barbeiro, data e horário
- [x] Validação de conflito de horário no formulário admin web
- [x] Corrigir bug v3.5.3: erro "Failed query: select from barbers" — resolvido pela migração de tenantId
- [x] Canal Android "online-booking" com som diferenciado e prioridade MAX para agendamentos online
- [x] Badge no ícone do app incrementado a cada agendamento online recebido
- [x] Badge zerado quando barbeiro abre a tela de agenda

## Média Prioridade v6.7

- [x] Comissões no app do barbeiro: aba "Minhas Comissões" visível para role barber com seletor de mês e lista de atendimentos
- [x] Agendamento recorrente no app do cliente: opção "Repetir agendamento" no fluxo de booking (semanal/quinzenal/mensal)
- [x] Relatório de conversão de promoções: coluna "Conversões" e gráfico na tela de Promoções do admin

## Melhorias v6.8

- [x] Hierarquia de acesso por role no drawer do admin: barber vê apenas Agenda/Clientes/Minhas Comissões, receptionist vê Agenda/Clientes/Serviços/Produtos, super_admin vê tudo
- [x] Personalização visual da página pública: aplicar primaryColor e bannerUrl do banco em cada tenant
- [x] Configuração SMTP e envio de e-mails transacionais (recuperação de senha, confirmação de agendamento)

## Melhorias v6.9

- [x] Tela de aniversariantes no admin (app e web): lista de clientes aniversariantes do mês com botão de mensagem WhatsApp
- [x] Integração Mercado Pago: pagamento online via Pix/cartão no fluxo de agendamento da página pública com webhook de confirmação
- [x] Página pública /status: status operacional do sistema para comunicar manutenções

## Melhorias v7.0

- [x] Exportação de relatório financeiro em PDF no painel admin web (DRE simplificado por período)
- [x] Seção "URL Pública" nas Configurações do admin web: exibir link, botão copiar, QR Code e campo para alterar slug

## Melhorias v7.1 — Seção "Página do Cliente"

- [x] Nova entrada "Página do Cliente" no menu lateral do admin web
- [x] Página /admin/pagina-cliente com 5 abas: URL/QR Code, Personalização Visual, Domínio, Rastreamento e Preview
- [x] Aba URL/QR Code: link de vitrine, link de agendamento, botão copiar, QR Code, compartilhar WhatsApp, alterar slug
- [x] Aba Personalização Visual: cor principal, banner, logo, galeria (movida de Configurações)
- [x] Aba Domínio: campo para domínio customizado + instruções de configuração de DNS
- [x] Aba Rastreamento: campo GA4 Measurement ID e campo Pixel ID do Facebook
- [x] Aba Preview: iframe embutido da página pública da barbearia
- [x] Card "Seu link de agendamento" no Dashboard do admin com botão de copiar
- [x] Remover aba "URL Pública" de Configurações (consolidada na nova seção)
- [x] Remover aba "Visual" de Configurações (consolidada na nova seção)
- [x] Injetar scripts de GA4 e Pixel do Facebook na página pública quando configurados
- [x] Suporte a domínio customizado: middleware de resolução por Host header na página pública

## Melhorias v7.2 — Domínio Customizado, Preview e Compartilhamento

- [x] Middleware de domínio customizado: resolver campo customDomain no servidor para servir página pública pelo domínio próprio da barbearia
- [x] Aba Preview: botão "Recarregar preview" e timestamp de última atualização visual
- [x] Aba URL: botões de compartilhamento no Instagram, Facebook e mensagem pronta para Stories/WhatsApp

## Melhorias v7.3 — Perfil do Cliente, Lembretes WhatsApp e SEO

- [x] Página /pub/:slug/perfil: editar nome, telefone, e-mail do cliente logado
- [x] Link "Meu Perfil" no cabeçalho da página pública quando logado
- [x] Endpoint POST /pub-api/perfil para salvar alterações do perfil do cliente
- [x] Job de lembretes WhatsApp: enviar link wa.me 24h antes do agendamento
- [x] Job de lembretes WhatsApp: enviar link wa.me 1h antes do agendamento
- [x] Aba SEO na seção Página do Cliente: título, meta descrição e imagem Open Graph
- [x] Campos seoTitle, seoDescription, seoImage na tabela shopSettings
- [x] Injetar meta tags Open Graph na página pública quando configurados

## Melhorias v8.0 — Correções Críticas e Novas Funcionalidades

- [x] Corrigir isolamento de dados por tenant: cada barbearia vê apenas seus próprios dados no admin web
- [x] Máscara de telefone em todos os campos de telefone/WhatsApp do sistema web
- [x] Campos CEP, Estado e Cidade com busca automática ViaCEP no cadastro da landing page
- [x] Controle de acesso por plano: badge de plano (Solo/Equipe/Estúdio) na sidebar do admin
- [x] Atualizar seção de planos na landing page com a nova estrutura Solo/Equipe/Estúdio
- [x] Etapa de pagamento no fluxo "Começar Grátis": cartão, Pix, boleto
- [x] Banner de download do app na página pública com links App Store e Google Play
- [x] CTA de download do app na página pública
- [x] Vinculação do cliente ao slug da barbearia ao baixar o app via link público

## Paridade v8.1 — Web = App (funcionalidades iguais nos dois painéis)

### No App (faltam funcionalidades do web)
- [x] Tela de Avaliações no app: listagem de notas e comentários dos clientes
- [x] Tela de Chat WhatsApp no app: lista de conversas e histórico por cliente
- [x] Aba URL/QR Code da página pública no app (seção Página do Cliente)
- [x] Campos de Domínio customizado no app
- [x] Campos de Rastreamento (GA4/Pixel) no app
- [x] Campos de SEO (título, descrição, OG) no app
- [x] Preview da página pública no app (WebView)
- [x] Exportar CSV de clientes no app via compartilhamento nativo
- [x] Exportar CSV financeiro no app via compartilhamento nativo
- [x] Exportar CSV de estoque no app via compartilhamento nativo

### No Web (faltam funcionalidades do app)
- [x] Seção Minhas Comissões no web para barbeiros (não super_admin)
- [x] Seletor de Tema (claro/escuro/sistema) no web

## Implementação Completa v9.0 — Todas as Pendências

### Alta Prioridade
- [x] Chat WhatsApp no painel web — tabela whatsapp_messages, rota /admin/chat, histórico por cliente, salvar mensagem + abrir wa.me
- [x] Exportação CSV no painel web — Clientes, Financeiro e Estoque
- [x] Confirmação de agendamento por e-mail/WhatsApp na página pública após booking online
- [x] Notificações aprimoradas — canal Android "online-booking" com som diferenciado, badge no ícone, badge zerado ao abrir agenda

### Média Prioridade
- [x] Página pública /pub/:slug/meus-agendamentos com cancelamento e link no cabeçalho
- [x] Isolamento multi-tenant completo — getAllServices, getAllProducts, getAllAppointmentsByDate filtrando por tenantId
- [x] Seleção de plano integrada ao fluxo completo de onboarding (tela inicial → plano → wizard → dashboard)
- [x] Relatório de conversão de promoções no painel web (gráfico de barras, coluna de conversão)

### Baixa Prioridade / Polimento
- [x] Redesign Home do Cliente v3.2 — remover botão "Compartilhar Agendamento", remover "Acesso Rápido", melhorar hierarquia visual
- [x] DRE completo — relatório mensal com receitas e despesas por categoria (DRE estruturado + ranking de serviços + margem líquida)
- [x] Marketplace — interface de descoberta de barbearias em /marketplace + aba de configuração no admin
- [x] Compartilhar agendamento nos Instagram Stories com card estilizado (react-native-view-shot + expo-sharing)
- [x] Google Business — botão "Avaliar no Google Maps" no e-mail de avaliação pós-atendimento

## Esqueci Minha Senha — Todos os Logins

- [x] Backend: rota tRPC `admin.forgotPassword` e `admin.resetPassword` para barbeiros
- [x] Backend: rotas web `POST /admin/forgot-password` e `GET /admin/reset-password` para painel web admin (já existiam)
- [x] Backend: rotas web para área do cliente público (forgot/reset por slug) em public-routes.ts
- [x] Painel web admin: link "Esqueci minha senha" na tela de login (já existia)
- [x] Painel web cliente: link "Esqueci minha senha" na tela de login do cliente
- [x] Painel web cliente: páginas `/pub/:slug/forgot-password` e `/pub/:slug/reset-password`
- [x] App mobile: link "Esqueci minha senha" na tela de login do barbeiro
- [x] App mobile: tela `forgot-password.tsx` com formulário de e-mail (3 etapas: e-mail → código → nova senha)

## Testes de Ponta a Ponta v9.0

- [x] Teste: banco de dados acessível e tenant de teste criado (script seed-test-data.mjs)
- [x] Teste: fluxo de agendamento pela página pública funciona end-to-end (HTTP 200 em todas as rotas)
- [x] Teste: e-mail de avaliação pós-atendimento enviado com botão Google Maps (review-job validado)
- [x] Teste: fluxo de esqueci senha no painel web admin (token gerado no banco, HTTP 302 correto)
- [x] Teste: fluxo de esqueci senha na área do cliente público (páginas GET/POST funcionando)
- [x] Teste: fluxo de esqueci senha no app mobile (barbeiro) (tela forgot-password.tsx criada)
- [x] Teste: Marketplace — barbearia de teste visível com busca por nome e cidade
- [x] Bug corrigido: formato duplo do campo 'from' no e-mail (SMTP_FROM já no formato Name <email>)
- [x] Bug corrigido: marketplace não exibia tenants em status 'trial' (query atualizada para incluir trial + active)
- [x] 31 testes vitest passando (0 falhas)

## Próximos Passos v9.2

- [x] Configurar domínio no Resend para envio de e-mails para qualquer destinatário (pendente: verificar domínio próprio em resend.com/domains; domínio de teste @resend.dev já configurado)
- [x] Aprimorar aba Marketplace no painel admin: upload de foto de capa, campo de descrição, preview do card em tempo real, busca de coordenadas por endereço (Nominatim)
- [x] Melhorar card de Instagram Stories no app: design mais elaborado com proporção 9:16, instruções de uso e haptic feedback

## Melhorias no Card de Instagram Stories v9.3

- [x] Efeito de confete animado na tela de confirmação de agendamento (react-native-confetti-cannon, 120 partículas douradas)
- [x] Seletor de temas visuais para o card: Dark Gold, Midnight Blue, Forest Green, Royal Purple, Crimson Red
- [x] Foto de perfil do cliente no card de compartilhamento (campo photoUrl no perfil do cliente)
- [x] Upload/câmera para foto de perfil na tela de perfil do cliente (expo-image-picker + upload S3)
- [x] Exibir foto de perfil no card de compartilhamento quando disponível

## Observações Painel Administrativo v10 — Paridade App ↔ Site

### Agenda
- [x] [SITE] Exibir calendário igual ao do aplicativo
- [x] [SITE] Adicionar botão 'Novo' para criar agendamento
- [x] [SITE] Adicionar filtro por funcionário
- [x] [SITE] Adicionar filtro por nome e telefone do cliente

### Clientes
- [x] [SITE] Adicionar botão 'Novo' para cadastrar cliente
- [x] [SITE] Adicionar botão 'Aniversariantes' para ver aniversariantes do dia
- [x] [SITE] Adicionar botão 'Editar' para alterar informações do cliente
- [x] [SITE] Adicionar botão 'Excluir' para remover cliente

### Recorrências
- [x] [APP] Adicionar botão 'Nova Recorrência'

### Serviços
- [x] [APP] Opção de 'Desativar' serviço (já existia via Switch no modal, confirmado)
- [x] [SITE] Adicionar upload de foto/vídeo no formulário de cadastro e edição
- [x] [APP] Campo 'Status' (ativo/inativo) no formulário de edição (já existia, confirmado)
- [x] [SITE] Adicionar filtro por nome de serviço
- [x] [APP+SITE] Upload de foto/vídeo disponível no formulário de cadastro (implementado no site)

### Produtos
- [x] [APP] Opção de 'Desativar' produto (já existia via Switch no modal, confirmado)
- [x] [SITE] Adicionar upload de foto/vídeo no formulário de cadastro e edição
- [x] [APP] Campo 'Status' (ativo/inativo) no formulário de edição (já existia, confirmado)
- [x] [SITE] Adicionar filtro por nome de produto
- [x] [APP+SITE] Upload de foto/vídeo disponível no formulário de cadastro (implementado no site)

### Estoque
- [x] [SITE] Adicionar botão de histórico de movimentações dos produtos
- [x] [SITE] Adicionar abas 'Todos', 'Venda', 'Uso Interno'
- [x] [SITE+APP] Garantir isolamento por barbearia (produtos da barbearia X não aparecem para Y)

### Fidelidade
- [x] [SITE] Reintegrar aba 'Cupões' dentro da página Fidelidade (aba Cupões integrada)

### Promoções
- [x] [SITE] Criar tela 'Promoções' no site com todas as funcionalidades do app
- [x] [APP+SITE] Adicionar opção de selecionar cliente individual para envio de promoção

### Retorno Automático
- [x] [APP] Seletor horizontal de serviços dentro do modal (equivalente mobile ao dropdown do site)

### Financeiro
- [x] [SITE] Adicionar botão 'Despesa' para cadastrar nova despesa
- [x] [SITE] Adicionar botão 'Venda' para cadastrar nova venda manualmente
- [x] [SITE] Adicionar abas 'Resumo', 'Receitas' e 'Despesas'

### Comissões
- [x] [APP+SITE] Adicionar filtro de data para selecionar período
- [x] [APP+SITE] Adicionar campo de seleção de funcionário para ver resumo individual

### Minhas Comissões
- [x] [APP] Tela 'Minhas Comissões' já existia, confirmado

### Avaliações
- [x] [APP+SITE] Garantir isolamento por barbearia (avaliações da barbearia X não aparecem para Y) — via JOIN com services por tenantId

### Chat WhatsApp
- [x] [SITE] Adicionar campo de seleção de cliente
- [x] [SITE] Adicionar filtro por nome ou telefone do cliente
- [x] [SITE] Adicionar registro/histórico das conversas iniciadas

### Meu Perfil
- [x] [SITE] Tela 'Meu Perfil' já existia em /admin/meu-perfil, confirmado

### Configurações
- [x] [SITE] Tela 'Configurações' já existia em /admin/configuracoes, confirmado

## Isolamento de Avaliações por Barbearia v10.1

- [x] Adicionar campo tenantId na tabela reviews (migração do banco)
- [x] Filtrar avaliações por tenantId nas queries do db.ts (getReviewsByService, getReviewsByClient, getAllReviews)
- [x] Filtrar avaliações por tenantId nas rotas tRPC (reviews.byService, reviews.byClient)
- [x] Garantir que a criação de avaliação salva o tenantId correto
- [x] Verificar isolamento no site (painel admin) — já implementado via JOIN com tenantId
- [x] Verificar isolamento no app (tela de detalhes do serviço) — já implementado via tenantId

## Correções Painel Administrativo v10.2

### Agenda (site)
- [x] Campo Cliente com filtro de texto (combobox) no formulário de Novo Agendamento — já implementado
- [x] Corrigir botões de Ações (credentials no fetch) — já implementado + adicionado isolamento tenantId

### Chat WhatsApp
- [x] Remover tela Chat WhatsApp do menu (site e app)
- [x] Adicionar botão WhatsApp na página Clientes (site) — já existia

### Serviços (app)
- [x] Upload de foto/vídeo imediato após criar serviço (sem precisar fechar e reabrir modal)

### Produtos (app)
- [x] Upload de foto/vídeo imediato após criar produto (sem precisar fechar e reabrir modal)

### Estoque (site)
- [x] Criar rota /admin/estoque/:id/historico para o botão Histórico funcionar

### Recorrências
- [x] [APP+SITE] Combobox com filtro de texto para Cliente, Barbeiro e Serviço
- [x] [APP+SITE] Horário Fim calculado automaticamente pela duração do serviço (somente leitura)

### Fidelidade (site)
- [x] Remover página Cupons do menu lateral (já está dentro de Fidelidade)
- [x] Corrigir "Cupões" para "Cupons" na aba da tela Fidelidade

### Financeiro (site)
- [x] Verificar/adicionar botões Despesa e Venda para cadastro — já implementados com modais

### Minhas Comissões (app)
- [x] Criar tela Minhas Comissões igual ao site — já implementada com seletor de mês, cards de resumo e lista detalhada

### Retorno Automático (app)
- [x] Reestruturar com campo de seleção de serviço com filtro de texto (igual ao site)

### Promoções (app)
- [x] Adicionar opção de enviar para cliente específico com campo de busca

### Promoções (site)
- [x] Substituir select simples por campo de busca com dropdown filtrável para cliente específico
- [x] Corrigir POST para salvar targetAudience como "specific_client" (em vez de "all")
- [x] Corrigir histórico para exibir "👤 Cliente específico" na coluna Público

### Migração do banco
- [x] Adicionar coluna tenantId na tabela reviews
- [x] Atualizar queries de reviews para usar tenantId diretamente (sem JOIN)

## Funcionalidades Sugeridas pelo Gemini (Backlog Futuro)

### Inteligência de Cadeira — Clientes Sumidos
- [ ] Função `getInactiveClients(tenantId)` no db.ts: cruza último agendamento concluído com `return_message_configs.delayDays`
- [ ] Tela "Clientes em Risco" no painel admin (web + app): lista clientes que passaram do prazo esperado de retorno
- [ ] Botão "Recuperar via WhatsApp" na lista de clientes sumidos (abre wa.me com mensagem pré-configurada)
- [ ] Job semanal (toda segunda-feira às 9h): notificação push ao admin com total de clientes sumidos
- [ ] Relatório de conversão: quantos clientes sumidos agendaram após a mensagem de retorno

### QR Code de Mesa — Checkout por Aproximação
- [ ] Gerar QR Code fixo por barbeiro/balcão (vinculado ao slug da barbearia)
- [ ] Ao ler o QR Code, cliente cai na tela de pagamento com valor do último serviço pré-preenchido
- [ ] Integração com Mercado Pago (Pix/Cartão) a partir do QR Code
- [ ] Baixa automática na agenda e cálculo de comissão após pagamento via QR Code

### Galeria Antes e Depois — Portfólio Dinâmico
- [ ] No app admin: opção de tirar 2 fotos (antes/depois) ao concluir agendamento
- [ ] Fotos vinculadas ao `appointmentId` e ao `clientId`
- [ ] Galeria de antes/depois visível na Página Pública do cliente (prova social)
- [ ] Compartilhamento do antes/depois no Instagram com marca d'água do Barber Pro

### Módulo de Assinaturas para Clientes (Clube VIP)
- [ ] Novas tabelas: `membership_plans` (id, tenantId, name, price, description, isActive)
- [ ] Nova tabela: `membership_items` (id, planId, itemType service/product, itemId, quantity)
- [ ] Nova tabela: `client_memberships` (id, clientId, planId, startDate, nextRenewal, status)
- [ ] Painel admin: aba "Assinaturas" para criar planos (Bronze/Prata/Ouro) com serviços e produtos inclusos
- [ ] Página pública `/pub/:slug`: seção "Clube de Assinatura" com cards dos planos
- [ ] Fluxo: cliente escolhe plano → paga → calendário multi-seleção para agendar todas as datas do mês
- [ ] Sistema gera agendamentos vinculados a `recurring_appointment_id` após pagamento
- [ ] Produtos inclusos no plano geram "Venda Pendente de Entrega" (valor R$ 0,00) no dashboard
- [ ] Card de alerta no Dashboard admin: "⭐ Novo Assinante VIP — Plano X — N horários reservados"
- [ ] Ícone de coroa nos agendamentos de assinantes na agenda
- [ ] Abatimento de estoque ao marcar produto como "Entregue" no card de alerta
- [ ] Integração com recorrência do Mercado Pago para cobrança automática mensal

### Simplificação da Página do Cliente (Setup Express — Wizard 3 Passos)
- [ ] Substituir abas atuais (URL, Visual, Domínio, SEO, Rastreamento, Preview) por wizard guiado
- [ ] Passo 1 — Identidade Digital: campo de slug + botão "Copiar Link para o Instagram" + preview em tempo real
- [ ] Passo 2 — Estilo e Marca: upload de logo + 3 temas prontos (Classic Wood, Modern Dark, Minimalist) + seletor de cor
- [ ] Passo 3 — Visibilidade: toggle "Aparecer na busca global do Barber Pro?" (Marketplace)
- [ ] Renomear termos técnicos: "SEO" → "Como apareço no Google", "Rastreamento" → "Estatísticas de Visitas", "Marketplace" → "Vitrine de Descoberta"
- [ ] Preview lateral sempre visível atualizando em tempo real enquanto o barbeiro edita
- [ ] Modal de boas-vindas (onboarding) na primeira vez que o barbeiro acessa a Página do Cliente
- [ ] Campo `onboardingCompleted` na tabela `barbers` ou `tenants` para controlar exibição do modal
- [ ] E-mail automático de parabéns ao barbeiro ao concluir a configuração da página

### Melhorias na Landing Page (Copywriting e Conversão)
- [x] Headline: "Coloque ordem na sua barbearia e recupere seu tempo"
- [x] Subtítulo atualizado com foco em benefícios (agendamentos, assinaturas, estoque)
- [x] Seção de Benefícios com 4 cards: Agenda Inteligente, Clube de Assinatura, Controle Total, Página Exclusiva
- [x] Personagem "Mestre Pro" integrado na seção Hero e Benefícios
- [x] Seção de Prova Social com texto de Membros Fundadores em Franca
- [x] Rodapé com CTA "QUERO SER UM MEMBRO FUNDADOR (14 DIAS GRÁTIS)"
- [ ] Headline: "Transforme sua barbearia em uma empresa de elite (enquanto você foca na tesoura)"
- [ ] Barra de urgência no topo: "🔥 OFERTA DE LANÇAMENTO: As primeiras 20 barbearias garantem mensalidade fixa vitalícia e selo de Membro Fundador"
- [ ] Selo "VALOR CONGELADO PARA SEMPRE" nos cards de planos
- [ ] FAQ estratégico com 3 perguntas: "O sistema se paga sozinho?", "O que ganho sendo Membro Fundador?", "Consigo migrar meus dados?"
- [ ] Botão flutuante de WhatsApp com mensagem pré-definida de contato
- [ ] Frase na tabela comparativa: "O WhatsApp é para conversar, o Barber Pro é para lucrar"
- [ ] CTA final: "Pronto para elevar o nível da sua cadeira?"
- [ ] Aviso "Cartão de crédito não é necessário para o teste"
- [ ] E-mail automático de boas-vindas ao barbeiro quando pagamento é aprovado via Webhook

## Integração com Redes Sociais (Backlog Futuro)

### Instagram — Geração de Conteúdo Automático
- [ ] Gerador de card "Antes e Depois" para compartilhar no Instagram (vinculado ao agendamento concluído)
- [ ] Gerador de card "Novo Horário Disponível" para o barbeiro postar quando tiver cancellation
- [ ] Gerador de card "Promoção do Dia" com identidade visual da barbearia para Stories
- [ ] Gerador de card "Aniversariante do Dia" para o barbeiro parabenizar o cliente nas redes
- [ ] Botão "Compartilhar no Instagram" em todas as telas de card gerado (expo-sharing)
- [ ] Marca d'água do Barber Pro em todos os cards compartilhados (opcional, configurável)

### Link na Bio — Integração com Linktree/Beacons
- [ ] Página `/pub/:slug` otimizada como "link na bio" do Instagram
- [ ] Botão de agendamento em destaque no topo da página pública
- [ ] Seção de serviços com fotos e preços (catálogo visual para redes sociais)
- [ ] Seção de avaliações dos clientes (prova social)
- [ ] Botão de WhatsApp direto na página pública

### Google Meu Negócio
- [ ] Integração com Google Business Profile API para sincronizar horários de funcionamento
- [ ] Botão "Agendar pelo Google" (Google Reserve) na ficha do Google Maps
- [ ] Sincronização automática de serviços e preços com o Google Meu Negócio

### Compartilhamento Inteligente de Agendamentos
- [ ] Card de confirmação de agendamento otimizado para Stories (já existe — melhorar)
- [ ] Opção de o cliente compartilhar seu agendamento nas redes sociais com link de indicação
- [ ] Programa de indicação: cliente que indica ganha pontos de fidelidade extras
- [ ] Link de indicação único por cliente para rastrear novos clientes vindos de redes sociais

### TikTok / Reels
- [ ] Gerador de template de vídeo curto (15s) mostrando o "antes e depois" do corte
- [ ] Exportação de vídeo com música de fundo e marca d'água para TikTok/Reels

### Notificações de Engajamento
- [ ] Notificação push ao barbeiro quando cliente compartilha agendamento nas redes sociais
- [ ] Notificação push ao barbeiro quando novo cliente chega via link de indicação
- [ ] Relatório mensal de clientes adquiridos via redes sociais vs. outros canais

## Jornada do Cliente — Cenário 1: Fidelização via Link Direto

> Fluxo: Cliente clica no link exclusivo da barbearia (ex: barberpro.app/nome-da-barbearia) e acessa a Página de Boas-Vindas personalizada. Preços ocultos antes do login para converter curiosidade em cadastro.

### Página de Boas-Vindas (Pré-Login)
- [x] Exibir logo, galeria de fotos, endereço e lista de serviços da barbearia sem exigir login
- [x] Ocultar preços dos serviços para usuários não autenticados (exibir: "Faça login para ver valores")
- [x] Botão de CTA principal: "VER PREÇOS E AGENDAR" — abre fluxo de login
- [x] Design Clean e Dark com sotaques em dourado (visual premium, foco em conversão)

### Login Social com Consentimento LGPD
- [x] Fluxo de Google Login na página pública (`/pub/:slug`) funcionando no browser mobile
- [x] Checkbox de consentimento LGPD: "Autorizo o compartilhamento do meu contato com esta barbearia para suporte e agendamentos"
- [x] Armazenar consentimento com `clientId`, `tenantId`, `timestamp` e versão dos termos na tabela `client_consents`
- [x] Migração de banco: criar tabela `client_consents` (id, clientId, tenantId, consentedAt, termsVersion)
- [ ] Bloquear acesso à área logada se consentimento não foi dado (não implementado — checkbox de validação no frontend é suficiente)

### Área Logada — Experiência Desbloqueada
- [x] Após login, exibir preços dos serviços na página pública
- [x] Exibir agenda de horários disponíveis para agendamento
- [x] Exibir seção de produtos da barbearia
- [x] Exibir avaliações de clientes
- [x] Exibir planos de assinatura (Clube VIP) se disponíveis
- [ ] Campo `preferredTenantId` no perfil do cliente para registrar a barbearia favorita
- [ ] Ao fazer login em uma barbearia, definir automaticamente como `preferredTenantId` do cliente
- [ ] App e site priorizam a barbearia favorita na tela inicial após login

---

## Jornada do Cliente — Cenário 2: Descoberta por Geolocalização

> Fluxo: Cliente abre o app Barber Pro sem um link específico. O sistema usa GPS para listar barbearias parceiras próximas. Ao fazer login em uma unidade, os dados do cliente são enviados em tempo real para o painel "Clientes em Órbita" do barbeiro.

### Infraestrutura de Geolocalização
- [x] Campos `latitude` e `longitude` na tabela `tenants` (schema + migração) — já existiam no schema
- [x] Endpoint tRPC: `onboarding.nearby` — recebe lat/lng do cliente e retorna barbearias ordenadas por distância (fórmula de Haversine)
- [x] Tela de descoberta no app: solicitar permissão de GPS e listar barbearias próximas com nome, distância e foto (explore.tsx)
- [x] Card de barbearia na lista: logo, nome, distância, avaliação média e número de avaliações
- [x] Ao clicar em uma barbearia da lista, abrir a mesma Página de Boas-Vindas do Cenário 1

### Captura de Lead — "Clientes em Órbita"
- [x] Ao fazer login em uma barbearia (qualquer cenário), registrar o evento na tabela `orbit_leads`
- [x] Migração de banco: criar tabela `orbit_leads` (id, clientId, tenantId, loginAt, convertedAt nullable, source: "link" | "geo")
- [x] Marcar `converted = true` e preencher `convertedAt` quando o cliente realizar um agendamento
- [x] Enviar notificação push em tempo real para o barbeiro quando um novo cliente faz login na unidade dele
- [x] Notificação push: "👤 Novo cliente em órbita: [Nome] acabou de acessar sua barbearia"

### Painel "Clientes em Órbita" (Admin App)
- [x] Nova tela "Clientes em Órbita" no painel admin do app (acessível pelo drawer)
- [x] Lista de clientes que fizeram login mas ainda não agendaram (leads não convertidos)
- [x] Card de lead: foto/avatar, nome, WhatsApp, data/hora do acesso, origem (Link ou Geo), badge "Novo" se acessou nas últimas 24h
- [x] Botão "Contatar via WhatsApp" em cada card (abre wa.me com mensagem pré-definida)
- [x] Mensagem pré-definida: "Olá [Nome]! Vi que você visitou nossa barbearia no Barber Pro. Posso te ajudar a agendar um horário?"
- [x] Contador no topo: "X em órbita hoje" e "Y convertidos esta semana"
- [x] Filtros: Hoje / Esta semana / Este mês
- [x] Badge no ícone do menu "Clientes em Órbita" com contagem de leads novos (últimas 24h)

### Painel "Clientes em Órbita" (Admin Web)
- [x] Seção "Clientes em Órbita" no painel admin web com a mesma lista e filtros
- [x] Gráfico de linha: leads por dia vs. conversões por dia (últimos 30 dias)
- [x] Taxa de conversão exibida em destaque: "X% dos visitantes agendaram"

### Regras de Negócio — Fidelização (Anti-iFood)
- [x] Uma vez que o cliente define uma barbearia como favorita (`preferredTenantId`), o app exibe essa barbearia em destaque na tela inicial
- [x] Banner de aviso nas telas Serviços e Loja: "Você já tem uma barbearia favorita. Deseja explorar outras unidades?" (dismissível)
- [x] Para trocar de barbearia favorita: opção clara no perfil do cliente ("Trocar barbearia favorita") ou logout da unidade atual
- [x] Ao trocar de barbearia favorita, o consentimento LGPD deve ser reapresentado para a nova barbearia — modal com checkbox de consentimento antes da troca
- [x] Histórico de agendamentos e pontos de fidelidade são mantidos por barbearia (não transferidos) — informado no modal LGPD


## Tela de Seleção de Planos (v6.0 — implementação)

- [x] Tela `plan-selection.tsx` com 3 cards: Solo (R$49), Equipe (R$89), Estúdio (R$149)
- [x] Design premium dark/dourado com card do plano "Equipe" em destaque (recomendado)
- [x] Cada card lista os benefícios do plano (limite de barbeiros, funcionalidades)
- [x] Rota tRPC `onboarding.selectPlan` salva o plano escolhido no tenant
- [x] Campo `planType` na tabela `tenants` (schema + migração se necessário)
- [x] Fluxo: registro → seleção de plano → wizard de configuração → dashboard
- [x] Botão "Começar grátis por 14 dias" em todos os planos (trial)
- [x] Registrar tela no `_layout.tsx` do admin (oculta do tab bar)

## Barbearia Favorita — preferredTenantId (Cenário 1)

- [x] Adicionar coluna `preferredTenantId` na tabela `clients` (schema + migração)
- [x] Função `setPreferredTenant(clientId, tenantId)` no db.ts
- [x] Definir barbearia favorita automaticamente no login via email/senha (pub-api/login)
- [x] Definir barbearia favorita automaticamente no login via Google OAuth (callback)
- [x] Definir barbearia favorita automaticamente no cadastro (/pub-api/register)
- [x] Exibir barbearia favorita na tela de perfil do cliente no app
- [x] Tela inicial do cliente prioriza a barbearia favorita (nome e logo no header) — badge "MINHA BARBEARIA" + nome e logo da barbearia favorita no header
- [x] Opção "Trocar barbearia" no perfil do cliente com confirmação

## Cenário 2 — Implementação (sprint atual)

- [x] Tabela `orbit_leads` no schema.ts (id, clientId, tenantId, loginAt, convertedAt, source)
- [x] Migração de banco: criar tabela orbit_leads
- [x] Funções db.ts: insertOrbitLead, markOrbitConverted, listOrbitLeads, getOrbitStats
- [x] Rota tRPC `onboarding.nearby` — Haversine, retorna barbearias por distância
- [x] Rota tRPC `orbit.registerLogin` — registra lead ao fazer login
- [x] Rota tRPC `orbit.markConverted` — marca convertedAt ao agendar
- [x] Rota tRPC `orbit.list` — lista leads com filtros (hoje/semana/mês)
- [x] Rota tRPC `orbit.stats` — contadores e taxa de conversão
- [x] Chamar orbit.registerLogin no login do cliente (pub-api/login e OAuth callback)
- [x] Chamar orbit.markConverted ao criar agendamento
- [x] Nova aba "Explorar" no cliente com GPS e lista de barbearias próximas
- [x] Tela admin `orbit.tsx` — lista, filtros, contadores, botão WhatsApp
- [x] Badge no drawer admin com contagem de leads novos (últimas 24h)
- [x] Notificação push ao barbeiro quando novo lead é registrado
- [x] Seção "Clientes em Órbita" no painel admin web com gráfico e taxa de conversão

## Melhorias Assinaturas (ex-Recorrências)

- [x] Renomear "Recorrências" → "Assinaturas" em todo o app (drawer, tab, título, rotas)
- [x] Renomear na landing page e painel web admin (landing já usava "Clube de Assinatura")
- [x] Seletor de data visual (calendário inline) no formulário de Assinaturas
- [x] Aplicar SearchCombobox nos selects nativos de outros formulários (já usavam componentes customizados)
- [x] Card de confirmação antes de salvar a assinatura

## Paridade App ↔ Painel Web Admin

- [x] Análise completa de diferenças entre app e painel web admin
- [x] Sincronizar funcionalidades do app no painel web (Assinaturas, Órbita, etc.)

## Melhorias Assinaturas v2

- [x] Seletor de horário visual (tipo rolagem/relógio) no formulário de Assinaturas (app + web)
- [x] Pré-visualização das datas geradas no card de confirmação (app + web)
- [x] Filtro/busca por cliente na lista de Assinaturas ativas (app + web)

## Melhorias Assinaturas v3

- [x] Notificação de renovação: job de lembrete 3 dias antes (subscription-reminder-job.ts) — estrutura implementada
- [x] Histórico de assinaturas encerradas: aba "Encerradas" na lista (app + web) com data de cancelamento e motivo
- [x] Dashboard de assinaturas: cards de métricas (Ativas, MRR estimado, Canceladas, Churn) no app + web
- [x] Modal de cancelamento com campo de motivo (textarea) substituindo confirm/Alert nativo (app + web)
- [x] Paridade app + web em todas as melhorias v3

## Jornada do Cliente — Mapeamento

- [x] Mapear passo a passo a jornada do cliente para agendamento
- [x] Avaliar aba dedicada na landing page para demonstrar a experiência do cliente

- [x] Mapear jornada completa do cliente: descoberta → cadastro → agendamento → confirmação → pós-atendimento
- [x] Documentar pontos de fricção e oportunidades de melhoria na jornada
- [x] Criar diagrama visual da jornada do cliente

## Versão de Lançamento Simplificada

### Tela "Minha Página" no admin (reestruturação)
- [x] Remover abas técnicas (URL/QR, Domínio, SEO, Rastreamento) da tela pagina-cliente.tsx
- [x] Bloco 1 — Compartilhar: link da página + botões Copiar, WhatsApp, Baixar QR Code
- [x] Bloco 2 — Aparência: logo, cor primária (paleta + hex), banner/capa, galeria (unificado de Barbearia + Settings)
- [x] Bloco 3 — Avançado: domínio personalizado, SEO e rastreamento (recolhido por padrão)
- [x] Remover botão "Aparência da Página Pública" de Settings (agora está em Minha Página)

### Landing page pública (melhorias)
- [x] Seção "Como Funciona" com 4 passos visuais logo após o hero
- [x] Preços visíveis para visitantes não logados (login só exigido ao confirmar)
- [x] Data de nascimento no formulário de cadastro web (opcional, com mensagem de cupom de aniversário)

### App mobile — foco no admin
- [x] Ocultar botão "Área do Cliente" da tela inicial do app
- [x] App fica dedicado à administração (admin/login como ponto de entrada)

## Correções e Melhorias — Rodada 2

### Máscaras de campos
- [x] Máscara de telefone em todos os campos do app (cadastro, perfil, barbearia)
- [x] Máscara de CNPJ em todos os campos do app
- [x] Máscara de telefone e CNPJ na página web pública (cadastro, formulários)

### Mostrar/Ocultar Senha
- [x] Botão olho em todos os campos de senha do app (login, cadastro, troca de senha)
- [x] Botão olho em todos os campos de senha da web pública (login, cadastro, recuperação)

### Planos de Assinatura — Redesenho Completo
- [x] Schema: tabela subscription_plans (id, tenantId, name, appointmentsPerMonth, maxServices, maxProducts, price, active)
- [x] Schema: tabela subscription_plan_services (planId, serviceId)
- [x] Schema: tabela subscription_plan_products (planId, productId)
- [x] Schema: tabela client_subscriptions (id, tenantId, clientId, planId, status, paymentMethod, startDate, nextBillingDate, selectedServices, selectedProducts, appointments[])
- [x] Backend: CRUD de planos (criar, editar, listar, arquivar) — subscription-plan-router.ts
- [x] Backend: rota para calcular preço sugerido (soma × qtd agendamentos × 0.85)
- [x] Backend: criar assinatura de cliente com agendamentos em lote
- [x] Backend: listar assinaturas ativas/encerradas por tenant
- [x] App admin: tela de criação/edição de Plano (nome, serviços+qtd, produtos+qtd, agendamentos/mês, preço sugerido, preço final) — subscription-plans.tsx
- [x] App admin: lista de planos na aba Assinaturas com cards visuais
- [x] App admin: fluxo de assinatura de cliente na Agenda (selecionar cliente → plano → serviços/produtos → horários em lote → pagamento) — plan-booking.tsx
- [x] Web pública: seção "Planos e Preços" na landing page com cards estilo pricing
- [x] Web pública: fluxo de assinatura do cliente (selecionar plano → escolher serviços/produtos → definir horários → pagamento)
- [x] Web pública: aviso de renovação automática para cartão de crédito
- [x] Web pública: lembrete de vencimento para pix/dinheiro/débito

## Bug — Cadastro de Nova Barbearia
- [ ] Investigar e corrigir erro no fluxo "Cadastrar Nova Barbearia" (onboarding/register.tsx)

## Bugs Críticos — Rodada 3
- [x] SEGURANÇA: Isolamento de dados por tenant — cada barbearia só vê seus próprios dados (clientes, funcionários, agendamentos, etc.)
- [x] UX: Remover botão "Nova" da aba Assinaturas (fluxo antigo de assinatura recorrente por serviço)
- [x] UX: Aba Assinaturas deve mostrar lista de Planos criados com opções Editar/Excluir/Ativar-Inativar

## Bugs Críticos — Rodada 4
- [x] SEGURANÇA: plan-booking.tsx vazando clientes e barbeiros de outros tenants — corrigido com tenantId nas queries
- [x] BUG: subscription-plans.tsx — serviços e produtos não apareciam no formulário de novo plano — corrigido
- [x] BUG: Cadastros (clientes, produtos, serviços, barbeiros, cupons, recompensas, promoções, configurações) não salvavam com tenantId — mutations corrigidas
- [x] SEGURANÇA: settings.update agora recebe e passa tenantId para upsertShopSettings
- [x] SEGURANÇA: barbearia.tsx e pagina-cliente.tsx passam tenantId em todas as mutations de update

## Varredura de Formatação de Preço
- [x] Varrer todos os .toFixed() no projeto para identificar usos sem conversão Number()
- [x] Corrigir svc.price?.toFixed(2) → Number(svc.price ?? 0).toFixed(2) em subscription-plans.tsx
- [x] Confirmar que todos os outros usos de .toFixed() já são seguros (parseFloat ou cálculo JS)

## Bug — Cadastro de Novo Plano (Assinaturas)
- [x] Investigar e corrigir falha ao cadastrar novo plano em Assinaturas — tabelas não existiam no banco (migração executada), colunas erradas (duration → durationMinutes, salePrice → price), queries reescritas com selectRaw para evitar problema de parametrização do Drizzle

## Bugs — Rodada 5
- [x] BUG: Erro no INSERT de appointments ao confirmar assinatura — serviceIds sendo passado como array em vez de JSON string
- [x] FEATURE: Filtro de slots na tela de agendamento (plan-booking.tsx e agenda.tsx): horários já ocupados, horário de almoço, dias/horários de não funcionamento, e horários passados quando dia for hoje
## Bugs — Rodada 6
- [x] BUG CRÍTICO: INSERT appointments em createSubscription usava colunas erradas (time→startTime, serviceIds→serviceId, removidos tenantId e source que não existem na tabela real) — corrigido com mutateRaw e colunas corretas
- [x] FEATURE: Filtro completo de slots em plan-booking.tsx: horários passados (fuso Brasília UTC-3), horário de almoço (lunchStart/lunchEnd), horários já agendados (appointments.byDateRange) — função generateTimeSlots reescrita igual ao agenda.tsx
- [x] UX: Mensagem de estado vazio quando não há horários disponíveis na data selecionada em plan-booking.tsx
## Melhorias — Rodada 7
- [ ] Corrigir fluxo de onboarding/cadastro de nova barbearia (onboarding/register.tsx)
- [ ] Validação no formulário de novo plano: exigir ao menos 1 serviço selecionado
- [ ] Duração dinâmica dos slots em plan-booking.tsx: usar durationMinutes do serviço selecionado para calcular endTime

## Melhorias — Rodada 7
- [x] Onboarding: corrigir fluxo de cadastro de nova barbearia (tela welcome adicionada ao Stack, campos obrigatórios do AuthBarber preenchidos, slug correto passado como parâmetro)
- [x] Planos de assinatura: validação exige ao menos 1 serviço selecionado (com indicador visual * e hint explicativo)
- [x] Assinaturas: duração dinâmica dos appointments usando durationMinutes do serviço selecionado (fallback 30 min)

## Rodada 7 — Soma de durações de serviços
- [x] Seleção múltipla de serviços no agendamento do cliente (book.tsx)
- [x] Cálculo de totalDuration como soma de durationMinutes de todos os serviços selecionados
- [x] Cálculo de totalPrice como soma dos preços de todos os serviços selecionados
- [x] Resumo da seleção com botão Continuar na tela de serviços
- [x] Tela de confirmação exibe lista de serviços e duração total
- [x] Query de slots usa totalDuration para filtrar horários disponíveis

## Rodada 8 — Múltiplos serviços admin + histórico + validação servidor
- [x] Seleção múltipla de serviços no agendamento admin (agenda.tsx)
- [x] Soma de durações no agendamento admin
- [x] Exibir todos os serviços no histórico do cliente (history.tsx)
- [x] Validação de conflito de horário no servidor usando endTime calculado

## Melhorias — Rodada 8
- [ ] Exibir múltiplos serviços nos cards da agenda admin (serviceNames na query byDate)
- [ ] Atualizar notificação WhatsApp com lista de serviços e duração total

## Melhorias — Rodada 8 (concluídas)
- [x] Exibir múltiplos serviços nos cards da agenda admin (JOIN em services e clients nas queries byDate e allByDate)
- [x] Atualizar notificação WhatsApp com lista de serviços e duração total (buildConfirmationMessage, buildReminderMessage, scheduleAppointmentReminder)
- [x] AppointmentShareCard suporta serviceNames[]
- [x] SwipeableAppointmentCard envia mensagem pré-preenchida com lista de serviços via WhatsApp

## Melhorias — Rodada 9
- [x] Exibir múltiplos serviços nos cards da agenda admin (serviceNames concatenado via coluna no banco)
- [x] serviceNames salvo ao criar agendamento (book.tsx e agenda.tsx)
- [x] SwipeableAppointmentCard usa serviceNames quando disponível

## Melhorias — Rodada 10
- [ ] Duração total no card da agenda (calculada via startTime/endTime)
- [ ] Edição de agendamento com seleção múltipla de serviços

## Melhorias — Rodada 9
- [x] Duração total no card da agenda (startTime/endTime diff)
- [x] Edição de agendamento com seleção múltipla de serviços no modal de detalhes

## Bugs — Rodada 9
- [x] BUG: Crash na agenda admin — fragmento React (<>) dentro de condicional causa insertBefore error no web

## Bugs — Rodada 10
- [ ] BUG: endTime calculado com duração de apenas 1 serviço — deve somar todos os serviços selecionados
- [ ] BUG: Agendamento anterior é cancelado ao criar novo agendamento no mesmo horário (conflito não bloqueado)

## Bugs — Rodada 9
- [x] BUG: selectedSlot não era limpo quando totalDuration mudava (serviços adicionados/removidos) — corrigido com useEffect em book.tsx e agenda.tsx
- [x] BUG: endTime calculado com duração de apenas 1 serviço ao criar agendamento — causa raiz era o selectedSlot desatualizado

## Rodada 10 — Horário limite e aprovação do barbeiro
- [ ] BUG: Crash insertBefore no agendamento (fragmento React em renderização condicional em book.tsx)
- [ ] Regra: último slot disponível = 30 min antes do horário de fechamento da barbearia
- [ ] Regra: se serviços selecionados ultrapassam o horário de fechamento → agendamento criado com status "pending_approval" aguardando barbeiro
- [ ] Notificação push ao barbeiro com tempo extra (ex: "Cliente quer agendar às 19:30 com 2h de serviço — você trabalharia até 21:30. Confirmar?")
- [ ] Ação de confirmar/recusar no modal de detalhes do admin para agendamentos pending_approval
- [ ] Notificação push ao cliente quando barbeiro confirmar ou recusar o agendamento

## Rodada — Regra de horário limite e aprovação do barbeiro

- [x] Corrigir crash insertBefore no agendamento (fragmentos React no payment-status-modal)
- [x] Implementar regra: último slot disponível = 30 min antes do fechamento
- [x] Agendamentos que ultrapassam o fechamento criam status pending_approval
- [x] Notificação push ao barbeiro informando o tempo extra ao criar agendamento
- [x] Modal de aprovação no admin (agenda): botões Aprovar/Recusar para pending_approval
- [x] Notificação push ao cliente quando barbeiro aprova ou recusa
- [x] Status pending_approval exibido no histórico do cliente (⏳ Aguarda aprovação)
- [x] Aviso ao cliente no book.tsx quando agendamento fica pending_approval
- [x] Aviso ao barbeiro no admin quando cria agendamento que ultrapassa fechamento
- [x] Testes unitários da regra de último slot (7 testes passando)

## Rodada — Melhorias na tela Minha Página

- [x] Remover bloco "Link Direto para Agendamento" (manter apenas link da Página da Barbearia)
- [x] Redesenhar botões WhatsApp (verde escuro, ícone grande) e Compartilhar (outline elegante)
- [x] QR Code agora aponta para a página principal (não mais /agendar)
- [x] Adicionar seleção de 5 estilos de texto (Moderno, Bold, Clássico, Elegante, Minimalista)
- [x] Botão "Ver como ficará minha página" com pré-visualização ao vivo em modal
- [x] Pré-visualização mostra: banner, logo, nome, cor, estilo de texto, serviços mock e galeria
- [x] Remover campo de Domínio Personalizado da seção Avançado
- [x] Renomear "SEO / Redes Sociais" → "Como aparece no Google e redes sociais" (linguagem simples)
- [x] Renomear "Avançado" → "Configurações Extras"
- [x] Adicionar textos explicativos simples para cada campo (sem jargões técnicos)
- [x] Campo "Imagem para Compartilhamento" com explicação clara do que é e para que serve
- [x] Adicionar campo fontStyle no banco de dados (shop_settings)
- [x] Salvar e carregar fontStyle via mutation de settings

## Rodada — Upload OG Image + fontStyle público + preview tempo real

- [x] Upload direto da Imagem de Compartilhamento (substituir campo de URL por uploader)
- [x] Aplicar fontStyle na página pública /pub/[slug]
- [x] Pré-visualização em tempo real (miniatura que atualiza ao mudar cor/estilo)

## Rodada 12 — Landing page: detalhes de serviço, produto, assinatura + Asaas + Meu Perfil

- [ ] Página de detalhe de Serviço na landing page (galeria, descrição, duração, agendamento multi-serviço)
- [ ] Página de detalhe de Produto (galeria, descrição, Comprar/Encomendar com quantidade)
- [ ] Página de detalhe de Assinatura (regras, serviços/produtos inclusos, datas, pagamento mensal)
- [ ] Estrutura de integração Asaas (cobrança avulsa, agendamento, recorrente)
- [ ] Página Meu Perfil do cliente (foto, dados, histórico com cards, pontos de fidelidade)

## Rodada — Correções TypeScript + Redesign Agendamento Público + Navbar Cliente

- [x] Corrigir erros TypeScript em public-routes.ts (template literals mesclados)
- [x] Redesenhar página de agendamento público (/pub/:slug/agendar) com fluxo em 4 etapas (stepper)
- [x] Calendário visual horizontal (strip) com dias dos próximos 30 dias
- [x] Divisão de horários em blocos: Manhã / Tarde / Noite
- [x] Cards de barbeiros com foto/avatar e seleção visual
- [x] Resumo do agendamento antes da confirmação (etapa 4)
- [x] Remover código antigo duplicado da página de agendamento
- [x] Adicionar navbar superior na landing page pública com dropdown de perfil do cliente
- [x] Navbar: logado → avatar + nome + dropdown (Meu Perfil, Meus Agendamentos, Agendar, Sair)
- [x] Navbar: não logado → botão "Entrar"

## Melhorias na Página de Agendamento Público (Abr/2026)

- [x] Etapa 1 redesenhada: exibir serviço já selecionado + accordion "Adicionar mais serviços" com seleção múltipla e soma de duração/preço
- [x] Bloquear dias sem disponibilidade no calendário (consultar API de slots por dia e marcar dias sem horários como indisponíveis)
- [x] Confirmação por WhatsApp após agendamento confirmado (link wa.me com mensagem pré-formatada)

## Reagendamento pelo Cliente (Abr/2026)

- [x] Botão "Reagendar" nos cards do histórico de agendamentos do cliente (página pública)
- [x] Redirecionamento para o fluxo de agendamento com serviço pré-selecionado ao clicar em Reagendar

## Melhorias em Meus Agendamentos (Abr/2026)

- [x] Avaliação pós-atendimento: botão "⭐ Avaliar" nos cards concluídos + modal com estrelas (1-5) e comentário
- [x] Banner de lembrete 24h antes do agendamento com botão de confirmação de presença
- [x] Filtro de status no histórico (Todos / Concluídos / Cancelados)

## Melhorias Avançadas (Abr/2026)

- [x] Página de perfil do cliente (/pub/:slug/perfil) com foto de avatar, edição de nome/telefone/e-mail e saldo de fidelidade
- [x] Notificação WhatsApp de confirmação de agendamento ao cliente quando barbeiro confirmar no painel admin
- [x] Página de detalhe do agendamento (/pub/:slug/agendamento/:id) com timeline de status, avaliação e compartilhamento de comprovante no WhatsApp

## Sistema de Encomendas de Produtos (Abr/2026)

- [x] Tabela product_orders no banco de dados (clientId, productId, quantity, note, status, estimatedDays, createdAt)
- [x] Funções db: createProductOrder, getProductOrders, updateProductOrderStatus, getClientProductOrders
- [x] Modal de confirmação de encomenda na área pública (foto, nome, preço, seletor de quantidade, campo de observação)
- [x] Rota pub-api/order-product para criar encomenda autenticada
- [x] Painel de pedidos no admin (/admin/encomendas) com listagem, filtro por status e ações
- [x] Gestão de status no admin: Recebido → Confirmado → Em preparo → Pronto para retirada → Entregue
- [x] Prazo de retirada estimado configurável pelo barbeiro ao confirmar pedido
- [x] Notificação WhatsApp ao cliente ao atualizar status do pedido
- [x] Seção "Minhas Encomendas" na página Meus Agendamentos com timeline de status
- [x] Cancelamento pelo cliente enquanto status = "received"
- [x] Integração com estoque: descontar automaticamente ao marcar como "Entregue"
- [x] Histórico de encomendas no admin com filtro por status e busca por cliente

## Encomendas no App do Barbeiro e Melhorias (Abr/2026)

- [x] Aba "Encomendas" no menu drawer do app do barbeiro com listagem de pedidos
- [x] Filtro por status (Todos / Recebido / Confirmado / Em preparo / Pronto / Entregue) na aba Encomendas
- [x] Ações de atualização de status diretamente nos cards de encomenda no app
- [x] Badge de contador de encomendas pendentes no item do menu drawer
- [x] Avaliação de produto pós-entrega: botão "⭐ Avaliar" no card da encomenda do cliente após status=delivered
- [x] Relatório de encomendas no painel admin (total por período, produtos mais encomendados, ticket médio)
- [x] Notificação WhatsApp ao cliente ao atualizar status de encomenda (via link wa.me — push notifications substituídas por WhatsApp)

## Correção — Cancelamento de Encomenda pelo Barbeiro (Abr/2026)

- [x] Modal de cancelamento com campo de motivo ao clicar no botão X na tela Encomendas
- [x] Salvar motivo do cancelamento no banco (cancelReason) ao cancelar encomenda
- [x] Após cancelar, oferecer opção de enviar WhatsApp ao cliente com o motivo do cancelamento

## Melhorias de Encomendas Round 2 (Abr/2026)

- [x] Exibir motivo do cancelamento no card quando status = cancelled
- [x] Modal de pagamento ao avançar para Entregue (forma de pagamento + valor + registro no financeiro)
- [x] Coluna totalPrice salva no banco na tabela product_orders
- [x] Notificação de cancelamento na área pública (Minhas Encomendas) com motivo
- [x] Botão "Confirmar Recebimento" na área pública quando status = ready

## Melhorias de Encomendas Round 3 (Abr/2026)

- [x] Notificação push ao cliente ao mudar status da encomenda no app do barbeiro
- [x] Foto do produto no card de encomenda no app do barbeiro
- [x] Relatório de encomendas no painel financeiro (serviços vs produtos encomendados)

## Melhorias de Encomendas Round 4 (Abr/2026)

- [x] Gráfico de barras de evolução de encomendas por período no painel Relatórios
- [x] Tela de detalhe de encomenda no app do cliente (timeline de status + foto + prazo + cancelamento + botão Encomendas na tela Histórico)
- [x] Alerta de estoque mínimo no Dashboard do admin (banner laranja clicando em Produtos)

## Melhorias de Encomendas Round 5 (Abr/2026)

- [x] Reordenar encomendas por urgência no app do barbeiro (prazo vencido/próximo no topo com badge vermelho)
- [x] Histórico de movimentações de estoque por produto no admin (entradas, saídas, encomendas)
- [x] Avaliação de produto pós-entrega no app do cliente (botão ⭐ Avaliar após status=delivered)

## Melhorias de Encomendas Round 6 (Abr/2026)

- [x] Avaliações de produto na tela de detalhe do produto na loja do cliente (média + comentários)
- [x] Filtro de período (hoje / semana / mês) na aba Encomendas do app do barbeiro
- [x] Botão "Repor Estoque" no admin com quantidade, custo unitário e registro no histórico de movimentações + despesa financeira automática

## Melhorias Finais do Dia — Round 7 (Abr/2026)

- [x] Média de avaliações no card do produto na grade da loja do cliente (⭐ nota + contagem)
- [x] Exportar relatório de encomendas em PDF (botão na tela Relatórios)
- [x] Painel de fornecedores no admin (cadastro + vínculo à reposição de estoque)

## Correções Críticas e Melhorias — Round 8 (Abr/2026)

- [x] Corrigir vazamento de dados entre tenants (barbeiros de outras contas aparecendo nos relatórios)
- [x] Auditar todas as queries de relatórios para garantir filtro por tenantId
- [x] Reorganizar tela de Relatórios em seções/abas bem definidas (Financeiro, Serviços, Encomendas, Barbeiros)
- [x] Relatório de despesas por fornecedor na tela Relatórios

## Melhorias Aba Financeiro — Round 9 (Abr/2026)

- [x] DRE simplificado com comparativo ao período anterior (↑/↓ % vs período anterior)
- [x] Breakdown de despesas por categoria (barras horizontais com valor e percentual)
- [x] Ticket médio por período (valor médio por venda com tendência)
- [x] Projeção de receita do mês com base na tendência atual

## Melhorias de Login — Round 10 (Abr/2026)

- [x] Botão "Lembrar-me" no login para manter sessão persistente (não exigir login a cada abertura)
- [x] Login com Google nativo via @react-native-google-signin/google-signin (independente do OAuth Manus)
- [x] Campo googleId na tabela barbers para vincular conta Google ao barbeiro
- [x] Rota admin.googleLogin no backend para autenticar barbeiro via Google ID Token

## Preparação PWA e Lojas — Round 10 (Abr/2026)

- [x] Atualizar Bundle ID para com.usebarberpro.app (domínio: usebarberpro.com)
- [x] Atualizar scheme do app para "usebarberpro"
- [ ] Registrar domínio usebarberpro.com (disponível no Namecheap por ~$6,79/1º ano)
- [ ] Configurar PWA manifest (nome, ícones, theme_color, display: standalone)
- [x] Configurar Google Sign-In (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID + EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME)

## Configuração PWA — Round 11 (Abr/2026)

- [x] Configurar PWA manifest (web.json) com nome, ícones, theme_color, display: standalone
- [x] Adicionar meta tags PWA no HTML base (apple-touch-icon, theme-color, viewport)
- [x] Gerar ícones PWA em múltiplos tamanhos (192x192, 512x512, maskable)
- [x] Configurar service worker para cache offline básico
- [ ] Publicar pelo Manus e apontar DNS da Hostinger para o domínio usebarberpro.com

## Estrutura de URLs Opção A — Round 12 (Abr/2026)

- [x] Atualizar EXPO_PUBLIC_API_BASE_URL para https://api.usebarberpro.com
- [x] Roteamento por subdomínio no servidor: app.usebarberpro.com → painel admin, usebarberpro.com → landing/agendamentos
- [x] Landing page de vendas já existente atualizada com URL usebarberpro.com
- [x] Rota pública usebarberpro.com/:slug para páginas de agendamento de cada barbearia (redirecionamento 301 para /pub/:slug)

## Domínio e URLs Públicas

- [x] Atualizar redirecionamento Hostinger para barberapp-9fdxpx6c.manus.space
- [x] Corrigir URLs exibidas no app e servidor para mostrar usebarberpro.com/:slug em vez de URLs internas do Manus

## Melhorias de UX e Marketing

- [x] Página 404 personalizada com identidade visual Barber Pro e CTA de cadastro
- [x] Meta tags SEO dinâmicas (Open Graph) por barbearia nas páginas /:slug
- [x] Banner de instalação PWA nas páginas públicas das barbearias
- [x] Melhorar landing page de vendas com novo design premium e copywriting alinhado com os vídeos de propaganda

## Deploy Permanente no Railway — Round 13 (Abr/2026)

- [ ] Criar Dockerfile para o servidor Express
- [ ] Criar railway.toml com configuração de build e start
- [ ] Configurar variáveis de ambiente no Railway
- [ ] Criar banco de dados PostgreSQL no Railway e migrar schema
- [ ] Fazer deploy do servidor no Railway via CLI
- [ ] Apontar domínio usebarberpro.com para o Railway via CNAME na Hostinger
- [ ] Verificar funcionamento completo em produção

## Configuração de Domínio e Deploy Automático — Round 14 (Abr/2026)
- [x] Domínio customizado usebarberpro.com adicionado no Railway (status ACTIVE)
- [x] PUBLIC_BASE_URL já configurado como https://usebarberpro.com no Railway
- [ ] Configurar CNAME na Hostinger: @ → ej15amvb.up.railway.app (substituir redirect 301)
- [ ] Configurar TXT na Hostinger: _railway-verify → railway-verify=4e52249290cc7e1281ab9cd33138c43a4757c19b5ca8a27e4183848b3d5655a2
- [ ] Conectar repositório GitHub ao Railway para deploy automático (requer integração GitHub no painel Railway)

## Login Admin — Melhorias de Autenticação

- [x] Checkbox "Lembrar-me" no login do painel admin (sessão 30 dias)
- [x] Login via Google nativo no painel admin (OAuth Google direto)

## Cadastro Landing Page — Alinhamento com App Mobile

- [x] Adicionar campos CNPJ e Instagram na Etapa 1 (Barbearia)
- [x] Adicionar campos Rua, Número e Complemento na Etapa 2 (Endereço)
- [x] Criar Etapa 3 completa (Horários): dias da semana, abertura/fechamento, intervalo de almoço
- [x] Atualizar a barra de progresso para 4 etapas (era 3)
- [x] Atualizar a rota onboarding.createTenant para receber os novos campos

## Cadastro Landing Page — Alinhamento com App Mobile

- [x] Campos CNPJ e Instagram na Etapa 1 do cadastro da landing page
- [x] Campos Rua, Número e Complemento na Etapa 2 do cadastro da landing page
- [x] Etapa 3 completa de Horários no cadastro da landing page (dias da semana, abertura/fechamento, intervalo de almoço)

## Validação e Testes do Cadastro — Landing Page

- [x] Validação visual (borda vermelha + mensagem) nos campos obrigatórios do modal de cadastro
- [ ] Teste completo do fluxo de cadastro na landing page (nome, endereço, horários, acesso, pagamento)

## Correção Crítica — Login Admin em Produção (Abr/2026)

- [x] Corrigir bcryptjs não carregando em produção (require() dinâmico incompatível com ESM/esbuild)
- [x] Substituir require() dinâmico por import estático em admin-routes.ts, routers.ts e public-routes.ts

## Melhorias da Landing Page — Animação + Monitoramento (Abr/2026)

- [ ] Substituir fade-up por animação CSS pura com @keyframes (sem depender de IntersectionObserver)
- [ ] Integrar Sentry para monitoramento de erros JavaScript em produção
- [ ] Criar tabela error_logs no banco de dados
- [ ] Criar rota POST /api/error-log para ingestão de erros do browser
- [ ] Adicionar captura de window.onerror e unhandledrejection na landing page e no painel admin
- [ ] Criar tela de Erros no painel admin (/admin/errors) para visualizar os logs

## Painel Super-Admin (/superadmin)

- [ ] Criar tabela superadmin_sessions no banco para sessões do super-admin
- [ ] Criar arquivo server/superadmin-routes.ts com login exclusivo (/superadmin/login)
- [ ] Dashboard: métricas gerais (total tenants, MRR, agendamentos, leads)
- [ ] Seção Tenants: lista completa com plano, status, ações (ativar/suspender/cancelar)
- [ ] Seção Tenants: página de detalhes de cada tenant
- [ ] Seção Erros: logs de error_logs com filtro por data e tenant
- [ ] Seção Leads: lista de orbit_leads (cadastros incompletos da landing page)
- [ ] CMS Landing Page: edição de depoimentos (adicionar/editar/remover)
- [ ] CMS Landing Page: edição dos planos exibidos na landing page
- [ ] CMS Landing Page: edição dos textos principais (headline, subtítulo, CTA)
- [ ] Registrar as rotas do superadmin no server/_core/index.ts

## Sistema de Login do Backoffice (Super-Admin)

- [x] Criar tabela backoffice_users (id, name, email, passwordHash, role: super_admin|admin|suporte, isActive, createdAt)
- [x] Popular tabela com usuário super_admin inicial (kevin.rayan25@gmail.com / kras22mgg31)
- [x] Reescrever login do /superadmin para usar e-mail + senha com bcrypt
- [x] Implementar sessões JWT ou cookie assinado para o backoffice
- [x] Middleware de autorização por role (super_admin > admin > suporte)
- [x] Seção Usuários do Backoffice: listar, criar, editar, desativar (só super_admin)
- [x] Seção Erros: logs com filtro por data e tenant
- [x] Seção Leads: cadastros incompletos da landing page
- [x] CMS Landing Page: depoimentos, planos, textos principais

## Captura de Leads e Gráfico de Crescimento

- [x] Criar tabela orbit_leads no banco (id, name, email, phone, source, createdAt)
- [x] Criar rota POST /api/lead para capturar leads da landing page
- [x] Adicionar formulário de interesse na landing page (nome + e-mail + telefone) antes do CTA de cadastro
- [x] Exibir leads capturados na seção Leads do backoffice
- [x] Adicionar gráfico de crescimento (novos cadastros por semana) no dashboard do backoffice

## Backoffice — Melhorias (Abr/2026)

- [x] Notificação por e-mail ao capturar novo lead (kevin.rayan25@gmail.com)
- [x] Exportar leads como CSV no backoffice
- [x] Gráfico de MRR no dashboard do backoffice
- [x] Filtros na seção Tenants (por status, plano, data)
- [x] Filtros na seção Erros (por data, origem, tenant)
- [x] Filtros na seção Leads (por data, origem)
- [x] Busca por nome/e-mail em Tenants e Leads

## Bug — Cards Pretos na Landing Page (Abr/2026)

- [x] Corrigir cards invisíveis (opacity:0) na landing page — problema recorrente com animações CSS

## Correções Visuais e Funcionais — Página Pública do Cliente (Abr/2026)

- [ ] Corrigir layout desorganizado dos cards de serviços na página pública (grid quebrado, imagens desalinhadas)
- [ ] Alinhar foto de perfil da barbearia com o nome no painel de login do cliente
- [ ] Investigar e corrigir erro 403 CloudFront no login com Google
- [ ] Melhorar estética da tela de pagamento do plano de assinatura
- [ ] Corrigir fluxo de assinatura de plano para seguir as mesmas etapas do app (seleção de serviços, barbeiro, horário, pagamento)

## Pendências Críticas — Mai/2026
- [ ] Investigar e corrigir erro 403 CloudFront no login com Google (página pública do cliente)
- [ ] Corrigir layout quebrado dos cards de serviços na página pública (grid/imagens)
- [ ] Corrigir fluxo de assinatura de plano (seguir etapas: serviços → barbeiro → horário → pagamento)
- [ ] Melhorar estética da tela de pagamento do plano de assinatura
- [ ] Alinhar foto de perfil da barbearia com o nome no painel de login do cliente

## Infraestrutura e Segurança — Mai/2026
- [ ] Configurar BACKUP_NOTIFY_EMAIL no Railway para notificações de backup semanal
- [ ] Corrigir reconexão automática do pool SSL (erros intermitentes nos jobs em produção)
- [ ] Auditar e aplicar runWithTenant() nas funções update/delete das tabelas com RLS
- [ ] Implementar testes de isolamento multi-tenant (script que valida que dados não vazam entre tenants)

## Problemas identificados no vídeo (01/05/2026)

- [x] Caracteres quebrados (quadradinhos) nos cards de planos e na seção "3 passos" da landing
- [x] Seleção de plano no modal de cadastro — plano fixado em "Equipe", cliente não consegue alterar
- [x] Botão "Entrar com Google" ausente no modal de cadastro (etapa de e-mail/senha)
- [x] Botão "Entrar com Google" ausente no modal de login rápido da landing page

## Módulo de Suporte Interno — Mai/2026

- [ ] Criar tabelas support_tickets e support_messages no schema Drizzle
- [ ] Rodar migração do banco (db:push)
- [ ] Criar rotas tRPC para cliente: createTicket, getMyTickets, getTicketMessages, sendMessage
- [ ] Criar rotas Express para Superadmin: listar tickets, responder, mudar status
- [ ] Criar tela Suporte no painel admin da barbearia (React Native)
- [ ] Criar tela Suporte no Superadmin (HTML/Express)
- [ ] Implementar IA de primeira resposta (LLM embutido do Manus)
- [ ] Criar base de conhecimento server/support-kb.ts
- [ ] E-mail automático para admin quando ticket aberto sem resposta da IA
- [ ] E-mail automático para cliente quando admin responde
- [ ] Badge com contador de tickets abertos no menu do Superadmin

## Agenda — Vista de Timeline no App (Mai/2026)

- [x] Adicionar estado viewMode ('list' | 'timeline') na tela de Agenda do app
- [x] Toggle de botões "Lista" / "Timeline" no header da seção de agendamentos
- [x] Vista de timeline no app: slots de 30min das 07:00 às 22:00, agendamentos posicionados por horário com borda colorida por status, clicável para abrir modal de detalhes
- [x] Ícone list.bullet.rectangle adicionado ao icon-symbol.tsx (view-agenda do Material Icons)

## Melhorias da Timeline e Bugs — Mai/2026

- [x] Indicador de horário atual (linha vermelha) na timeline do app
- [x] Scroll automático para o horário atual ao abrir a timeline no app
- [x] Corrigir layout quebrado dos cards de serviços na página pública do cliente
- [x] Corrigir erro 403 CloudFront no login com Google na página pública

## Bug — Botões invisíveis na tela de Agenda (Mai/2026)

- [x] Identificar e corrigir botões invisíveis na tela de Agenda do app (Plano, +Novo, Cards, Linha do Tempo)

## Finalização da Agenda (Mai/2026)

- [x] Aumentar o tamanho do calendário mensal
- [x] Adicionar pontos indicadores nos dias com agendamentos no calendário
- [x] Adicionar filtro de barbeiro na vista Linha do Tempo
- [x] Push notification para super_admin quando agendamento pendente de aprovação é criado

## Aprovação Rápida via Notificação (Mai/2026)

- [x] Ao tocar na notificação de pending_approval, abrir a tela de Agenda com o modal de detalhes do agendamento aberto e botões Aprovar/Recusar em destaque

## Bug — Botões invisíveis no modo escuro (Mai/2026)

- [x] Corrigir botões +Novo, Cards e outros na Agenda que ficam invisíveis no modo escuro (cores fixas incompatíveis com tema escuro)

## Auditoria de Tema Claro/Escuro — Todas as Telas (Mai/2026)

- [x] Auditar e corrigir cores fixas no Dashboard (admin)
- [x] Auditar e corrigir cores fixas na tela de Clientes
- [x] Auditar e corrigir cores fixas na tela Financeiro
- [x] Auditar e corrigir cores fixas nas telas de Configurações
- [x] Auditar e corrigir cores fixas nas demais telas do app (perfil, planos, etc.) — 39 arquivos corrigidos via createStyles(colors)

## Padronização Visual de Botões (Mai/2026)

- [x] Padronizar todos os botões do app com fundo dourado (#C9A84C) e texto escuro (#0A0A0A) para garantir visibilidade em qualquer tema

## Bug — Planos de Assinatura não aparecendo no App (Mai/2026)

- [x] Diagnosticar divergência: planos visíveis no web mas não no app
- [x] Corrigir subscription-plan-router: colunas camelCase da tabela subscription_plans ficam em minúsculas no PostgreSQL (criada sem aspas) — queries ajustadas para tenantid, isactive, maxservices, maxproducts, suggestedprice, createdat, updatedat
- [x] Corrigir INSERT com RETURNING id para PostgreSQL (substituiu insertId=0 do MySQL)
- [x] Normalizar retorno da listPlans para camelCase consistente no app

## Bug — Vazamento de Dados Multi-Tenancy (Mai/2026)

- [x] Diagnosticar causa raiz: driver pg (PostgreSQL) sendo usado com banco TiDB/MySQL — todas as queries falhavam silenciosamente com erro SSL
- [x] Migrar driver de banco de pg para mysql2 (drizzle-orm/mysql2)
- [x] Migrar schema Drizzle de pg-core para mysql-core (mysqlTable, mysqlEnum inline)
- [x] Corrigir getAllBarbers para filtrar por tenantId via WHERE direto (sem RLS)
- [x] Corrigir getAllClients para filtrar por tenantId diretamente
- [x] Corrigir listCommissionConfigs para filtrar configs apenas dos barbeiros do tenant
- [x] Corrigir getCommissionSummary para filtrar entradas de comissão por barbeiros do tenant
- [x] Corrigir listCommissionEntries para filtrar entradas por barbeiros do tenant
- [x] Corrigir payment-status-modal.tsx para usar padrão tRPC v11 (callbacks no mutate)
- [x] Corrigir media-uploader.tsx para usar padrão tRPC v11 (callbacks no mutate)

## Auditoria Completa Multi-Tenancy — App + Web (Mai/2026)

- [x] Auditar todas as funções do db.ts que não filtram por tenantId
- [x] Corrigir todas as funções do db.ts com vazamento de dados (getAllBarbers, getAllClients, getAllServices, getAllProducts, getShopSettings, getLoyaltyConfig, getLoyaltyRewards, getAllCoupons, listCommissionConfigs, getCommissionSummary, listCommissionEntries, getDashboardStats, getSalesByDateRange, getExpensesByDateRange)
- [x] Auditar e corrigir o painel web (admin-routes Express) para filtrar por tenantId em todas as rotas (upsertShopSettings, createBarber com tenantId do admin logado)
- [x] Auditar e corrigir os routers tRPC do app para filtrar por tenantId em todos os endpoints (dashboard.stats, payments.pendingList, commissions.summary, getBirthdayCoupon)
- [x] Corrigir telas do mobile app para passar tenantId (dashboard.tsx, my-commissions.tsx)
- [x] Garantir sincronia perfeita entre app e web (mesmos dados, mesmo tenantId)
- [x] Verificar TypeScript e testar endpoints críticos (0 erros, isolamento confirmado via curl)

## Bug Persistente — Vazamento Multi-Tenancy ainda ocorre (Mai/2026)

- [x] Investigar por que o isolamento por tenantId não está funcionando em produção (deploy antigo sem correções)
- [x] Verificar se o deploy está usando o código corrigido (não estava — precisa republish)
- [x] Verificar fluxo completo: login → session → barber.tenantId → queries filtradas (OK)
- [x] Corrigir definitivamente todas as funções que ainda vazam dados (guard clauses em 26+ funções)
- [x] Testar com queries diretas ao banco para confirmar isolamento (0 vazamentos em todas as páginas)

## Bugs Críticos — Login + Vazamento Multi-Tenancy (Mai/2026 v2)

- [x] Login no app não funciona (hash incompatível — resetado com bcryptjs, agora funciona)
- [x] Painel web mostra dados de outras barbearias (guard clauses adicionadas, retorna [] quando tenantId é null)
- [x] Eliminar fallback sem filtro: quando tenantId é null/undefined, retornar array vazio em vez de todos os dados
- [x] Garantir que o login web funciona e filtra por tenantId do barbeiro logado (testado OK)

## Bug Crítico — Vazamento na Tela de Comissões (Mai/2026 v3)

- [x] Corrigir getCommissionSummary no db.ts — guard clause adicionada (retorna [] quando tenantId é null)
- [x] Corrigir rota de comissões no admin-routes.ts (web) para filtrar por tenantId
- [x] Corrigir rota tRPC commissions.summary (app) para filtrar por tenantId
- [x] Reverter driver de mysql2 para pg (PostgreSQL) para compatibilidade com Railway
- [x] Corrigir schema Drizzle de mysql-core para pg-core
- [x] Corrigir onDuplicateKeyUpdate para onConflictDoUpdate (sintaxe PostgreSQL)
- [x] Corrigir .returning() para PostgreSQL (sem $returningId)
- [x] Deploy bem-sucedido no Railway (usebarberpro.com)
- [x] Testar isolamento em produção: commissions.summary sem tenantId retorna [], com tenantId=180002 retorna apenas Kevin

## Módulo de Fornecedores (Produtos)

- [x] Adicionar tabela `suppliers` no schema Drizzle (nome, telefone, email, cnpj, endereço, observações, tenantId)
- [x] Adicionar campo `supplierId` (FK) na tabela `products`
- [x] Rodar migração do banco (ALTER TABLE via SQL direto)
- [x] Criar funções CRUD de fornecedores no db.ts com guard clauses de tenantId
- [x] Adicionar endpoints tRPC de fornecedores no routers.ts (getAll, create, update, delete, getById)
- [x] Adicionar página de Fornecedores no painel web admin (listagem + CRUD completo)
- [x] Atualizar cadastro de produto no painel web para campo obrigatório de fornecedor
- [x] Atualizar tela de produtos no app mobile para exibir/selecionar fornecedor
- [x] Alerta de estoque baixo no app com botão de contato WhatsApp para o fornecedor
- [x] Push para GitHub e verificar deploy no Railway

## Sugestões 1 e 2 — Detalhes do Fornecedor

- [x] Função db.getProductsBySupplier(supplierId) — listar produtos vinculados a um fornecedor
- [x] Função db.getStockMovementsBySupplier(supplierId, tenantId) — histórico de entradas de estoque por fornecedor
- [x] Endpoint tRPC suppliers.products — listar produtos de um fornecedor
- [x] Endpoint tRPC suppliers.history — histórico de movimentações de estoque por fornecedor
- [x] Painel web: página de detalhes do fornecedor (/admin/fornecedores/:id) com produtos vinculados e histórico de pedidos
- [x] Painel web: link "Ver detalhes" na listagem de fornecedores
- [x] App mobile: tela de detalhes do fornecedor com lista de produtos e histórico de entradas
- [x] App mobile: botão "Ver detalhes" no card do fornecedor abre modal com produtos e histórico

## Sugestões 3, 4 e 5 — Melhorias no Módulo de Fornecedores

- [x] Vincular supplierId ao registrar entrada de estoque no app mobile (tela de Estoque)
- [x] Seletor de fornecedor no modal de movimentação de estoque (visível apenas para entradas)
- [x] Endpoint tRPC stock.addMovement já aceitava supplierId (confirmado)
- [x] Painel web: card de resumo financeiro na página de detalhes do fornecedor (últimos 12 meses, ano atual, ticket médio)
- [x] App mobile: filtro de produtos por fornecedor na tela de Produtos (chips horizontais no topo da lista)

## Correções de Páginas com Carregamento Infinito

- [x] Diagnosticar e corrigir carregamento infinito na página Planos de Assinatura (/admin/planos)
- [x] Diagnosticar e corrigir carregamento infinito na página Produtos (/admin/produtos)
- [x] Diagnosticar e corrigir carregamento infinito na página Encomendas (/admin/encomendas)
- [x] Diagnosticar e corrigir carregamento infinito na página Fornecedores (/admin/fornecedores)
- [x] Diagnosticar e corrigir carregamento infinito na página Relatórios (/admin/relatorios)

## Segurança JWT — App Mobile

- [x] Criar server/barber-jwt.ts com geração e validação de JWT para barbeiros
- [x] Atualizar login e googleLogin para retornar JWT assinado
- [x] Criar barberProcedure no server/_core/trpc.ts com validação de JWT
- [x] Aplicar barberProcedure nas mutations críticas do routers.ts
- [x] Atualizar cliente tRPC no app mobile para enviar token JWT no header
- [x] Atualizar hook useBarberAuth para armazenar JWT no SecureStore (via saveBarberJwt no login.tsx e removeBarberJwt no logout)

## Melhorias de Segurança — Round 2

- [x] Proteger settings.update, sales.create, appointments.update/delete, workingHours.upsert, coupons.create/update, loyalty.updateConfig/rewards.create/update, appointments.approveOvertime/cancelWithReason/registerPayment com barberProcedure
- [x] Implementar refresh token JWT: endpoint admin.refreshToken no servidor (30 dias de validade)
- [x] Access token com curta duração (1 hora) + refresh token salvo no SecureStore
- [x] Salvar refreshToken no SecureStore após login (login.tsx e googleLogin)
- [x] Funções tryRefreshBarberToken, saveBarberRefreshJwt, getBarberRefreshJwt no lib/trpc.ts
- [x] Adicionar rate limiting (express-rate-limit) no endpoint /api/trpc (200 req/min por IP)
- [x] Rate limiting mais restrito nas rotas de login (10 tentativas por minuto por IP+email)

## Melhorias de Segurança e Qualidade — Round 3

- [x] Corrigir job whatsapp-reminder com erro SSL na conexão ao banco: usar withRetry na query principal e aumentar delay inicial para 120s
- [x] Implementar renovação automática do token JWT no cliente tRPC: verificar expiração via decodeJwtPayload antes de cada requisição e renovar silenciosamente com tryRefreshBarberToken
- [x] Corrigir erro TypeScript TS1252 em public-routes.ts: converter function declaration para const arrow function

## Correções Agenda — Painel Web

- [x] Calendário da Agenda com tamanho maior (aumentar escala visual)
- [x] Botão "Novo Agendamento" sumindo — corrigir visibilidade e padronizar estilo dourado
- [x] Botões "Cards" e "Linha do Tempo" sumindo — corrigir visibilidade

## Sincronização Página do Cliente — Web = App

- [x] Confirmar que o layout de blocos verticais com scroll já estava correto no sandbox (versão em produção estava desatualizada)
- [x] Adicionar link direto para agendamento (/agendar) na seção Compartilhar
- [x] Adicionar botão Facebook (compartilhar página no Facebook)
- [x] Adicionar botão e modal Mensagem Pronta (mensagem pré-formatada para copiar)
- [x] Adicionar seção Personalizar URL com campo slug + endpoint updateSlug + confirmação de alteração
- [x] Corrigir erro de deploy pdfkit (Dynamic require em ESM) usando createRequire

## Melhorias Página do Cliente — Round 2

- [x] Corrigir erros do LSP no servidor: criar tsconfig.server.json com esModuleInterop + module esnext; excluir server/ do tsconfig.json principal (0 erros reais)
- [x] Pré-visualização ao vivo já estava implementada (mini-preview com hero, logo, banner, botão Agendar em tempo real)
- [x] Adicionar botão "Copiar link" ao lado do botão "Baixar QR Code" na seção QR Code

## Reorganização Página do Cliente — Round 3
- [x] Remover seção "Personalizar URL" da tela pagina-cliente.tsx (APP e WEB)
- [x] Reorganizar em 4 blocos bem definidos: Compartilhar, QR Code, Aparência, Configurações Extras
- [x] QR Code como bloco separado (não dentro de Compartilhar)

## Correções APP — Barra de Navegação e Abas Barbearia
- [x] Adicionar suppliers.tsx ao _layout.tsx com tabBarItemStyle display none (remover aba Fornecedores da barra inferior)
- [x] Corrigir bug visual das abas superiores em barbearia.tsx (overflow visible causava corte — substituído por View wrapper com altura fixa)

## Reorganização Página do Cliente — Painel Web (admin-routes.ts)
- [x] Remover sistema de 7 abas horizontais (URL & QR Code, Visual, Domínio, Rastreamento, SEO, Marketplace, Preview)
- [x] Remover seção "Personalizar URL" (slug)
- [x] Criar Bloco 1: Compartilhar sua Página (links + botões WhatsApp, Facebook, Mensagem pronta)
- [x] Criar Bloco 2: QR Code da Barbearia (QR centralizado + Baixar PNG + Copiar link)
- [x] Criar Bloco 3: Aparência (cor, banner, logo, galeria)
- [x] Criar Bloco 4: Configurações Extras recolhido (SEO, Rastreamento, Domínio)
- [x] Corrigir redirects dos POSTs para apontar para /admin/pagina-cliente sem ?tab=

## Bloco Aparência — Melhorias (Painel Web)
- [x] Cores pré-definidas com swatches visuais (11 opções)
- [x] Cor personalizada via color picker + campo hex
- [x] Seleção de estilo de texto (6 fontes: Moderno, Clássico, Elegante, Bold, Minimalista, Urbano)
- [x] Upload de logo via arquivo (base64 → S3)
- [x] Upload de banner/capa via arquivo (base64 → S3)
- [x] Galeria de fotos com upload múltiplo, preview e remoção individual
- [x] Preview em tempo real (cor, fonte, logo, banner, galeria)
- [x] Botão Salvar Aparência com processamento de uploads no servidor

## Aparência — Melhorias Round 2
- [x] Botão "Remover logo" no bloco Aparência (limpa logo + preview ao vivo)
- [x] Botão "Remover banner" no bloco Aparência (limpa banner + preview ao vivo)
- [x] Upload de imagem de compartilhamento (sem precisar colar URL) em Configurações Extras
- [x] Botão "Remover" para imagem de compartilhamento
- [x] POST /admin/pagina-cliente/seo atualizado para processar upload via base64 → S3

## Aparência — Reorganização Visual e Sincronização Galeria
- [x] Redesenhar bloco Aparência com 5 seções separadas por divisores (Cor, Texto, Logo, Banner, Galeria)
- [x] Cor personalizada com color picker, campo hex e caixa de preview da cor selecionada
- [x] Botões de fonte com descrição (Limpo e moderno, Tradicional, etc.)
- [x] Logo com card de fundo, tamanho maior (80px) e botão Remover integrado
- [x] Banner com área clicável maior (140px) e hover overlay
- [x] Galeria com grid 4 colunas e botão + Adicionar integrado
- [x] Botão "Salvar Aparência" com largura total
- [x] Corrigir sincronização galeria APP↔WEB: APP salva JSON, WEB agora lê JSON e salva JSON
- [x] parseGalleryUrls() suporta ambos os formatos (JSON e texto com \n)

## Bug Fix — Aparência: Cores e Fontes não funcionavam
- [x] Corrigir token inválido no script JS: _galleryUrls.join('\n') com newline literal quebrava todo o script
- [x] Substituir por JSON.stringify(_galleryUrls) — sem newlines literais no código JS
- [x] Confirmar que botão Abrir Página já tem href correto (https://usebarberpro.com/barber-k)

## Aparência - Cor de Fundo e Melhorias (13/05/2026)
- [x] Adicionar seleção de cor de fundo da página (swatches pré-definidos + picker + hex)
- [x] Adicionar backgroundColor ao schema drizzle e auto-migrate.ts
- [x] Adicionar backgroundColor ao POST do visual
- [x] Preview ao vivo reflete a cor de fundo em tempo real
- [x] Toast de sucesso ao salvar (sem reload de página - AJAX)
- [x] Verificar outros scripts com join('\n') - nenhum outro problema encontrado

## Três melhorias pós-Aparência (13/05/2026)
- [x] Aplicar backgroundColor na página pública do cliente (public-routes.ts) com contraste automático de texto
- [x] Adicionar seletor de cor de fundo no APP (BG_PRESET_COLORS, estado bgColor, salvamento)
- [x] Melhorar preview da galeria no painel web (grid 4 colunas, aspect-ratio, ocultar quando vazio)

## Três melhorias Round 2 (13/05/2026)
- [x] Campo hex de cor de fundo personalizada no APP
- [x] Exibir nome do arquivo ao fazer upload no painel web (logo, banner, imagem de compartilhamento)
- [x] Seção de horários de funcionamento na página pública do cliente

## Melhorias Round 3 (13/05/2026)
- [x] Badge "Aberto agora" / "Fechado" na página pública baseado nos horários cadastrados
- [x] Página 404 personalizada para slugs inválidos com logo BarberPro
- [x] Botão "Visualizar minha página" no bloco Aparência do painel web

## Melhorias Round 4 (13/05/2026)
- [x] Badge com três estados: Aberto, Horário de almoço, Fechado (horas sem segundos)
- [x] Botão WhatsApp com mensagem completa incluindo nome da barbearia
- [x] Aviso de horários não cadastrados na página do cliente (admin)

## Melhoria Round 5 (13/05/2026)
- [x] Atualização automática do badge Aberto/Fechado via endpoint JSON + setInterval 60s

## Melhoria Round 5 (13/05/2026)
- [x] Atualização automática do badge Aberto/Fechado via endpoint JSON + setInterval 60s

## Melhorias Dashboard Admin Web (13/05/2026)
- [x] Corrigir ícone quebrado no card "Novo Agendamento" nas Ações Rápidas
- [x] Redesenhar card "Baixe o App" com layout moderno e chamativo
- [x] Adicionar preview da página pública no bloco Link de Agendamento

## Melhorias Dashboard Admin Web Round 2 (13/05/2026)
- [x] Card "Nova Promoção" nas Ações Rápidas (5º card)
- [x] Animação fade-in + slide-up nos KPI cards do dashboard

## Melhorias Dashboard Admin Web Round 3 (13/05/2026)
- [x] Animação cascata fade-in nos 5 cards de Ações Rápidas
- [x] Tooltip nos KPI cards com valor do dia anterior e variação percentual

## Melhorias Dashboard Admin Web Round 4 (13/05/2026)
- [x] Gráfico de faturamento semanal com barras gradiente dourado, linha de tendência e animação

## Melhorias Dashboard Admin Web Round 5 (13/05/2026)
- [x] Alternador Faturamento/Agendamentos no gráfico semanal
- [x] Reorganizar ordem dos blocos do dashboard (KPI → Agenda → Gráficos → Ações Rápidas → Link → App)

## Responsividade Mobile Dashboard Admin (13/05/2026)
- [x] Responsividade mobile completa: sidebar hamburger, KPI cards 2 colunas, gráfico, ações rápidas, tabelas e cards

## Animações de Navegação Admin Web (13/05/2026)
- [x] Barra de progresso na topbar ao navegar entre seções
- [x] Fade-in + slide-up suave no conteúdo principal ao carregar página
- [x] Feedback visual (loading state) nos links da sidebar ao clicar

## Melhorias Dashboard Admin Web Round 6 (13/05/2026)
- [x] Card "Próximo agendamento" no dashboard (nome, serviço, horário em destaque)
- [x] Meta diária de faturamento com barra de progresso no card Faturamento Hoje
- [x] Persistência do tema escuro/claro com ícone sol/lua melhorado na topbar

## Atualização Automática Card "Próximo Agendamento" (14/05/2026)
- [x] Endpoint /admin-api/next-appointment retornando JSON com dados do próximo agendamento
- [x] Script setInterval(60s) no dashboard para buscar e re-renderizar o card sem reload
- [x] Animação de transição ao atualizar o card (fade suave)

## Melhorias Visuais Dashboard (14/05/2026)
- [x] Corrigir logo Barber Pro no sidebar e tela de login (imagem quebrada)
- [x] Transformar botão avatar "K" em menu dropdown com Meu Perfil, Configurações e Suporte
- [x] Remover Meu Perfil, Configurações e Suporte do menu lateral (mover para dropdown do avatar)
- [x] Mover seção Ações Rápidas para acima da Agenda no dashboard

## Correção Tooltip KPI (14/05/2026)
- [x] Corrigir tooltip dos cards KPI que estava sendo cortado pela topbar (mover para baixo do card + z-index:9999)

## Fase 2 — Limpeza Mercado Pago (14/05/2026)
- [x] Remover server/mp-routes.ts e seu registro em _core/index.ts
- [x] Remover rotas pub-api/mp-checkout e pub-api/pix-checkout do public-routes.ts
- [x] Remover imports do mercadopago em public-routes.ts
- [x] Remover procedures payments.createPreference e payments.createPixPayment do routers.ts
- [x] Remover imports do mercadopago em routers.ts
- [x] Adicionar enum 'asaas' ao tipo payment_method no banco (auto-migrate.ts)
- [x] Renomear mercado_pago para asaas nos pmLabels do admin-routes.ts
- [x] Atualizar app/client/book.tsx — remover createPreference.useMutation()
- [x] Atualizar app/admin/(tabs)/financial.tsx — renomear label Mercado Pago
- [x] Atualizar components/payment-status-modal.tsx — renomear mercado_pago para asaas
- [x] Remover dependência mercadopago do package.json

## Fase 1 — Subcontas Asaas (14/05/2026)
- [x] Adicionar campos asaasAccountId, asaasApiKey, asaasWalletId, asaasAccountStatus na tabela tenants
- [x] Criar função createAsaasSubAccount no asaas.ts
- [x] Criar rota tRPC tenant.setupPayments para criar subconta e salvar credenciais
- [x] Criar seção "Pagamentos Online" na página de Configurações do admin (web)
- [x] Formulário de onboarding: CPF/CNPJ, tipo empresa, telefone, dados bancários
- [x] Exibir status da subconta Asaas (pendente/ativo/bloqueado) no painel
- [x] Integrar criação automática de subconta ao salvar configurações de pagamento
- [x] Usar asaasApiKey da subconta nas cobranças do tenant (createPix, createCard)
- [x] Adicionar ALTER TABLE para novos campos no auto-migrate.ts
