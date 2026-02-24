# Barber Pro — Documentação Técnica Completa

**Versão:** 1.0 (checkpoint `48651245`)
**Data:** Fevereiro de 2026
**Stack:** Expo SDK 54 · React Native 0.81 · tRPC · PostgreSQL · NativeWind

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura Técnica](#2-arquitetura-técnica)
3. [Banco de Dados](#3-banco-de-dados)
4. [Painel Administrativo](#4-painel-administrativo)
5. [Área do Cliente](#5-área-do-cliente)
6. [Integrações Externas](#6-integrações-externas)
7. [Sistema de Notificações Push](#7-sistema-de-notificações-push)
8. [Sistema de Fidelidade e Cupons](#8-sistema-de-fidelidade-e-cupons)
9. [Funcionalidade de Aniversário](#9-funcionalidade-de-aniversário)
10. [Integração Mercado Pago](#10-integração-mercado-pago)
11. [Relatórios e Inteligência de Negócio](#11-relatórios-e-inteligência-de-negócio)
12. [Segurança e Autenticação](#12-segurança-e-autenticação)
13. [Roadmap de Funcionalidades Futuras](#13-roadmap-de-funcionalidades-futuras)

---

## 1. Visão Geral do Sistema

O **Barber Pro** é um sistema completo de gestão para barbearias e salões de beleza, desenvolvido como aplicativo mobile nativo para iOS e Android. O sistema é composto por dois ambientes distintos que coexistem no mesmo aplicativo: o **Painel Administrativo**, voltado para donos, barbeiros e recepcionistas, e a **Área do Cliente**, voltada para os clientes finais da barbearia.

A proposta central do Barber Pro é eliminar o uso de planilhas, cadernos de papel e aplicativos de mensagens como ferramentas de gestão, centralizando em um único lugar o agendamento, o controle financeiro, o relacionamento com clientes e a análise de desempenho do negócio.

O sistema foi projetado para funcionar no modelo **SaaS multi-tenant**: cada barbearia opera com sua própria instância de dados, suas próprias credenciais de pagamento e sua própria configuração visual. A identidade visual padrão adota uma paleta **preto, branco e dourado**, transmitindo sofisticação e profissionalismo.

---

## 2. Arquitetura Técnica

O Barber Pro é construído sobre uma stack moderna e fortemente tipada, que garante segurança em tempo de compilação do banco de dados até a interface do usuário.

| Camada | Tecnologia | Função |
|---|---|---|
| **Mobile** | React Native 0.81 + Expo SDK 54 | Interface iOS e Android |
| **Roteamento** | Expo Router 6 (file-based) | Navegação por arquivos |
| **Estilização** | NativeWind 4 (Tailwind CSS) | Classes utilitárias no mobile |
| **API** | tRPC 11 + Zod | Tipagem end-to-end TypeScript |
| **Servidor** | Express.js + tsx | API REST + tRPC handler |
| **Banco de Dados** | PostgreSQL + Drizzle ORM | Persistência relacional |
| **Autenticação** | JWT + AsyncStorage | Sessões stateless |
| **Armazenamento** | S3-compatible | Fotos e vídeos de serviços/produtos |
| **Linguagem** | TypeScript 5.9 (100%) | Tipagem estática completa |

A comunicação entre o app e o servidor ocorre exclusivamente via **tRPC**, que gera tipos TypeScript automaticamente a partir das definições do servidor. Isso significa que qualquer mudança na API é imediatamente refletida como erro de compilação no cliente, eliminando uma classe inteira de bugs de integração.

---

## 3. Banco de Dados

O banco de dados PostgreSQL é gerenciado pelo **Drizzle ORM**, que permite definir o schema em TypeScript e gerar migrações automaticamente. O schema completo é composto por 16 tabelas:

| Tabela | Descrição |
|---|---|
| `barbers` | Funcionários da barbearia (nome, foto, especialidades, status) |
| `clients` | Clientes cadastrados (nome, telefone, email, data de nascimento) |
| `client_accounts` | Credenciais de acesso dos clientes (email, senha hash, Google ID) |
| `services` | Serviços oferecidos (nome, preço, duração, categoria, mídia) |
| `products` | Produtos à venda (nome, preço, estoque, categoria, mídia) |
| `appointments` | Agendamentos (cliente, barbeiro, serviço, data, horário, status) |
| `sales` | Vendas registradas (total, forma de pagamento, status MP) |
| `sale_items` | Itens de cada venda (serviço ou produto, quantidade, preço) |
| `expenses` | Despesas da barbearia (descrição, valor, categoria, data) |
| `working_hours` | Horários de trabalho por barbeiro (dia da semana, início, fim) |
| `blocked_slots` | Horários bloqueados (folgas, intervalos, manutenção) |
| `loyalty_config` | Configuração do sistema de pontos (regras de acúmulo) |
| `loyalty_rewards` | Recompensas disponíveis (nome, pontos necessários, desconto) |
| `client_points` | Saldo e histórico de pontos por cliente |
| `coupons` | Cupons de desconto (código, tipo, valor, validade, limite de uso) |
| `coupon_uses` | Registro de uso de cupons por cliente |
| `reviews` | Avaliações de serviços (nota, comentário, cliente, agendamento) |
| `media_files` | Arquivos de mídia vinculados a serviços e produtos (S3 URLs) |
| `shop_settings` | Configurações da barbearia (nome, endereço, WhatsApp, logo, MP) |

---

## 4. Painel Administrativo

O painel administrativo é acessado por donos, barbeiros e recepcionistas. Ele é protegido por autenticação com **hierarquia de papéis** (`super_admin`, `barber`, `receptionist`), onde cada papel tem acesso a funcionalidades específicas.

### 4.1 Dashboard

A tela inicial do painel exibe um resumo em tempo real do dia: total de agendamentos, faturamento do dia, número de clientes atendidos e lista dos próximos agendamentos com horário, nome do cliente e serviço. Um card especial de **pagamentos pendentes** alerta sobre agendamentos com pagamento online ainda não confirmado pelo Mercado Pago.

### 4.2 Agenda

A tela de agenda oferece uma visão de calendário com navegação por dia. Cada bloco de horário exibe o nome do cliente, o serviço e o barbeiro responsável. O administrador pode criar agendamentos manualmente, editar ou cancelar agendamentos existentes, e **bloquear horários** para folgas, intervalos ou manutenção.

O sistema de agendamento possui **verificação automática de conflitos**: ao tentar agendar um horário, o servidor verifica se o barbeiro selecionado já possui um agendamento ativo ou um horário bloqueado naquele período, considerando a duração exata do serviço.

### 4.3 Serviços

Gestão completa do catálogo de serviços. Cada serviço possui nome, descrição, preço, duração (configurável em horas e minutos com seletor visual), categoria e galeria de fotos e vídeos. Os serviços podem ser ativados ou desativados individualmente, controlando sua visibilidade para os clientes.

### 4.4 Produtos

Gestão do estoque de produtos à venda. Cada produto possui nome, descrição, preço, quantidade em estoque, categoria e galeria de mídia. O sistema alerta quando o estoque de um produto está baixo.

### 4.5 Clientes

Listagem completa de clientes com busca por nome ou telefone. Ao selecionar um cliente, é possível visualizar seu histórico completo de atendimentos, saldo de pontos de fidelidade e cupons disponíveis. Um **painel de aniversariantes** exibe os clientes que fazem aniversário no dia e no mês atual, com botão de atalho para enviar mensagem personalizada via WhatsApp.

### 4.6 Financeiro

Tela de controle financeiro com resumo de receitas, despesas e lucro por período. Exibe o breakdown por forma de pagamento (dinheiro, cartão, Pix, Mercado Pago) e lista todas as vendas com seus respectivos itens. Vendas realizadas via Mercado Pago exibem um **badge de status** (Pago / Pendente) e o ID do pagamento para rastreabilidade.

### 4.7 Fidelidade

Configuração completa do programa de fidelidade. O administrador define as regras de acúmulo de pontos (por serviço realizado, por valor gasto), cria recompensas personalizadas com seus respectivos custos em pontos, e gerencia cupons de desconto com controle de validade, tipo (percentual ou valor fixo) e limite de uso.

### 4.8 Relatórios

Nova tela de inteligência de negócio com quatro seções analíticas:

- **Faturamento:** gráfico de barras SVG com seletor de período (7 dias, 30 dias, 12 meses) e total do período
- **Serviços Mais Vendidos:** ranking com barra de progresso proporcional, quantidade de realizações e receita gerada
- **Clientes com Maior Ticket:** top 10 clientes por receita total, com número de visitas e ticket médio calculado
- **Desempenho por Barbeiro:** ranking comparativo de barbeiros por receita e número de atendimentos

### 4.9 Configurações

Tela de configurações gerais da barbearia: nome, endereço (com autocompletar via Google Places), telefone, WhatsApp, logo (upload direto para S3), galeria de fotos do ambiente e credenciais do Mercado Pago.

---

## 5. Área do Cliente

A área do cliente é um aplicativo completo dentro do Barber Pro, acessado pelos clientes finais da barbearia. O acesso é feito por email/senha ou **Login com Google** (OAuth 2.0).

### 5.1 Autenticação

O sistema de autenticação do cliente é independente do painel administrativo. O cliente pode criar uma conta com email e senha, fazer login com Google, ou recuperar a senha via código enviado por email. Ao criar a conta, o cliente já pode informar sua **data de nascimento** para ativar o benefício do cupom de aniversário.

### 5.2 Home

A tela inicial exibe uma saudação personalizada com o nome do cliente, destaques de serviços em carrossel, e acesso rápido às principais funcionalidades. Se o cliente entrou pelo Google e ainda não cadastrou a data de nascimento, um **banner dourado** convida-o a completar o perfil para ganhar o cupom de aniversário.

### 5.3 Catálogo de Serviços

Listagem de todos os serviços ativos com fotos, preços e avaliações médias. Ao tocar em um serviço, o cliente acessa a página de detalhes com galeria completa de fotos e vídeos, descrição completa (com "ver mais" para textos longos), avaliações de outros clientes e botão "Agendar". As imagens podem ser expandidas com zoom ao toque.

### 5.4 Agendamento Online

Fluxo de agendamento em 5 etapas sequenciais:

1. **Serviço** — selecionado automaticamente ao vir da tela de detalhes, ou escolhido manualmente
2. **Barbeiro** — lista de barbeiros disponíveis com foto e especialidades
3. **Data** — calendário com os próximos 30 dias, desabilitando datas sem disponibilidade
4. **Horário** — slots disponíveis calculados em tempo real pelo servidor, considerando horários de trabalho, agendamentos existentes e horários bloqueados
5. **Confirmação** — resumo completo com opção de escolher a forma de pagamento

Ao confirmar, o cliente recebe uma **notificação push local** agendada para 1 hora antes do atendimento, e pode optar por enviar uma confirmação via WhatsApp.

### 5.5 Pagamento Online

Após confirmar o agendamento, o cliente escolhe entre três formas de pagamento:

- **Pagar Online (Checkout Pro):** abre o navegador do sistema com a página de pagamento do Mercado Pago, aceitando cartão de crédito, débito, Pix e boleto
- **Pagar via Pix:** gera um QR Code Pix diretamente no app (sem abrir o navegador), com código copia-e-cola para facilitar o pagamento
- **Pagar na Barbearia:** confirma o agendamento sem pagamento antecipado

### 5.6 Loja de Produtos

Catálogo de produtos em grade de duas colunas com fotos, preços e controle de estoque. Cada produto possui página de detalhes com galeria de mídia e opção de compra.

### 5.7 Histórico e Agenda Pessoal

Tela com dois segmentos: **Próximos** (agendamentos futuros com opção de cancelar) e **Passados** (histórico completo com opção de avaliar o serviço). Ao cancelar um agendamento, a notificação push correspondente é automaticamente cancelada.

### 5.8 Perfil do Cliente

Tela de perfil com edição de dados pessoais (nome, telefone, email), **seletor de data de nascimento** com interface de roda (wheel picker), troca de senha e logout. A aba de **Cupons** exibe todos os cupons disponíveis do cliente, incluindo o cupom especial de aniversário quando o mês atual coincide com o mês de nascimento.

### 5.9 Avaliações

Após um atendimento ser marcado como concluído pelo admin, o cliente recebe um prompt para avaliar o serviço com nota de 1 a 5 estrelas e comentário opcional. As avaliações são exibidas na página de detalhes do serviço com a média calculada.

---

## 6. Integrações Externas

### 6.1 Google OAuth 2.0

Login com Google implementado via `expo-auth-session` com fluxo de código de autorização. O servidor valida o token ID recebido e cria ou recupera a conta do cliente automaticamente. Em produção (app publicado), o fluxo usa o scheme nativo do app (`manus20260223005104://oauth`) para o redirecionamento.

> **Nota sobre data de nascimento via Google:** o Google não fornece a data de nascimento pelo fluxo OAuth padrão. O escopo `user.birthday.read` da Google People API requer verificação formal do app pelo Google — processo que leva semanas e exige o app publicado. A solução adotada é um banner de convite no perfil para clientes que entraram pelo Google.

### 6.2 Google Places API

Autocompletar de endereço nas configurações da barbearia, com sugestões em tempo real conforme o usuário digita.

### 6.3 WhatsApp

Integração via deep link `wa.me` para envio de mensagens de confirmação de agendamento e lembretes. O sistema gera automaticamente uma mensagem formatada com os dados do agendamento (cliente, serviço, barbeiro, data e horário).

### 6.4 Mercado Pago

Integração completa descrita na seção 10.

---

## 7. Sistema de Notificações Push

O Barber Pro utiliza **notificações locais agendadas** via `expo-notifications`, sem necessidade de servidor de push externo. Isso garante funcionamento offline e sem custos adicionais.

| Evento | Notificação | Timing |
|---|---|---|
| Agendamento confirmado (cliente) | "Lembrete: seu corte é em 1 hora" | 1h antes do horário |
| Agendamento criado (admin) | "Lembrete: atendimento em 1 hora" | 1h antes do horário |
| Novo agendamento recebido (barbeiro) | "Novo agendamento! [Cliente] às [hora]" | Imediata |
| Aniversário do cliente | "Feliz aniversário! Seu cupom especial te espera" | 9h do dia do aniversário |

As notificações de aniversário usam o trigger `YEARLY` do `expo-notifications`, que se repete automaticamente todo ano na mesma data, sem necessidade de reagendamento. O agendamento ocorre no login do cliente e é atualizado sempre que a data de nascimento é alterada.

---

## 8. Sistema de Fidelidade e Cupons

O sistema de fidelidade é totalmente configurável pelo administrador. As regras de acúmulo de pontos podem ser definidas por serviço realizado (pontos fixos) ou por valor gasto (pontos proporcionais ao ticket). O cliente acompanha seu saldo de pontos em tempo real na aba de perfil.

As **recompensas** são criadas pelo admin com nome, descrição e custo em pontos. O cliente pode resgatar recompensas diretamente pelo app, gerando um cupom de desconto automaticamente.

Os **cupons de desconto** suportam dois tipos: percentual (ex: 20% OFF) e valor fixo (ex: R$ 15 de desconto). Cada cupom pode ter data de validade, limite de uso total e limite de uso por cliente. O sistema valida todas essas regras no momento do resgate.

---

## 9. Funcionalidade de Aniversário

O sistema de aniversário é composto por quatro elementos integrados:

**No perfil do cliente:** seletor visual de data de nascimento com interface de roda (wheel picker) com colunas de dia, mês e ano. A data é exibida no cabeçalho do perfil com ícone de bolo.

**No cadastro:** o formulário de criação de conta inclui o campo de data de nascimento com explicação do benefício do cupom de aniversário.

**No app do cliente:** durante o mês de aniversário, a aba de Cupons exibe um banner especial com o cupom de aniversário ativo. No dia exato, exibe "Feliz Aniversário!" com destaque especial.

**No painel admin:** botão 🎂 na tela de Clientes abre um painel com aniversariantes do dia (com badge de contagem) e do mês, cada um com botão de atalho para WhatsApp com mensagem personalizada pré-formatada.

---

## 10. Integração Mercado Pago

A integração segue o **Modelo 1 (SaaS)**: cada barbearia configura suas próprias credenciais (`MP_ACCESS_TOKEN` e `MP_PUBLIC_KEY`) nas configurações do app. Os pagamentos vão diretamente para a conta Mercado Pago da barbearia.

### Fluxo Checkout Pro

O servidor cria uma **preferência de pagamento** com os dados do agendamento, valor, e-mail do cliente e URLs de retorno. O app abre o Checkout Pro no navegador do sistema, onde o cliente escolhe entre cartão de crédito, débito, Pix ou boleto. Após o pagamento, o Mercado Pago notifica o servidor via webhook.

### Fluxo Pix Nativo

O servidor cria um **pagamento Pix** diretamente via API do Mercado Pago e retorna o QR Code em base64. O app exibe o QR Code como imagem nativa e o código copia-e-cola, sem precisar abrir o navegador. A expiração é de 30 minutos.

### Webhook IPN

O servidor Express recebe notificações do Mercado Pago em `/api/mp/webhook`. Ao receber uma notificação de pagamento aprovado, o servidor consulta os detalhes do pagamento, identifica o agendamento pelo `external_reference` e atualiza o status da venda para "pago". O endpoint sempre responde `200 OK` para evitar reenvios.

---

## 11. Relatórios e Inteligência de Negócio

A tela de Relatórios oferece quatro visões analíticas com seletor de período (7 dias, 30 dias, 12 meses). Os gráficos são renderizados com **SVG customizado** via `react-native-svg`, garantindo compatibilidade com Expo Go e apps publicados sem dependências nativas adicionais.

O gráfico de faturamento agrupa as vendas por dia (para 7 e 30 dias) ou por mês (para 12 meses), calculando o total de cada período. O ranking de serviços ordena por receita gerada, com barra de progresso proporcional ao primeiro colocado. O ranking de clientes calcula o ticket médio dividindo a receita total pelo número de visitas. O desempenho por barbeiro compara receita e número de atendimentos no período.

---

## 12. Segurança e Autenticação

O sistema possui dois contextos de autenticação independentes: o **painel administrativo** (barbeiros e staff) e a **área do cliente**. Cada contexto usa tokens JWT com expiração configurável, armazenados de forma segura no `AsyncStorage` do dispositivo.

A hierarquia de papéis do painel administrativo (`super_admin`, `barber`, `receptionist`) controla o acesso a funcionalidades sensíveis como gestão financeira, configurações da barbearia e gerenciamento de outros usuários. As rotas tRPC validam o papel do usuário autenticado antes de executar operações privilegiadas.

As senhas são armazenadas com hash bcrypt. O fluxo de recuperação de senha utiliza códigos temporários de 6 dígitos enviados por email, com expiração de 15 minutos.

---

## 13. Roadmap de Funcionalidades Futuras

As funcionalidades a seguir foram identificadas como próximos passos naturais para o Barber Pro:

| Funcionalidade | Prioridade | Complexidade |
|---|---|---|
| Exportação de relatórios em PDF | Alta | Baixa |
| Notificação push ao confirmar agendamento | Alta | Baixa |
| Avaliações com resposta do barbeiro | Média | Baixa |
| Modelo Marketplace Mercado Pago (comissão) | Alta | Alta |
| EAS Build para publicação nas lojas | Alta | Média |
| Integração com Google Calendar | Média | Média |
| Programa de indicação (referral) | Média | Média |
| App separado para barbeiros (modo simplificado) | Baixa | Alta |
