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
