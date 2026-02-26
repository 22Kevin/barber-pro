# Barber Pro — Documentação Técnica Completa

**Versão:** 6.8  
**Data:** Fevereiro de 2026  
**Stack:** Expo SDK 54 · React Native 0.81 · TypeScript 5.9 · tRPC 11 · Drizzle ORM · MySQL · Express

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura](#2-arquitetura)
3. [Banco de Dados — Tabelas e Relacionamentos](#3-banco-de-dados--tabelas-e-relacionamentos)
4. [API — Rotas tRPC (App Mobile)](#4-api--rotas-trpc-app-mobile)
5. [API — Rotas REST (Painel Web e Público)](#5-api--rotas-rest-painel-web-e-público)
6. [Módulos do Servidor](#6-módulos-do-servidor)
7. [Funcionalidades Implementadas](#7-funcionalidades-implementadas)
8. [Variáveis de Ambiente](#8-variáveis-de-ambiente)
9. [Guia de Configuração Inicial](#9-guia-de-configuração-inicial)

---

## 1. Visão Geral do Sistema

O **Barber Pro** é um sistema SaaS completo de gestão para barbearias e salões de beleza. Ele é composto por três camadas de interface que compartilham o mesmo backend:

| Camada | Tecnologia | Público-alvo |
|--------|-----------|--------------|
| **App Mobile (Admin)** | Expo / React Native | Barbeiros e administradores |
| **App Mobile (Cliente)** | Expo / React Native | Clientes da barbearia |
| **Painel Web Admin** | HTML/CSS/JS (SSR via Express) | Administradores via navegador |
| **Página Pública Web** | HTML/CSS/JS (SSR via Express) | Clientes via navegador |

O sistema suporta **multi-tenancy**, ou seja, múltiplas barbearias podem operar de forma isolada na mesma infraestrutura, cada uma identificada por um `slug` único (ex: `minha-barbearia`). A arquitetura permite tanto instalação SaaS (múltiplos tenants) quanto instalação dedicada (single-tenant legado).

---

## 2. Arquitetura

```
barber_app/
├── app/                        # Telas do app mobile (Expo Router)
│   ├── (tabs)/                 # Navegação por abas (admin)
│   │   ├── index.tsx           # Dashboard administrativo
│   │   ├── agenda.tsx          # Agenda de agendamentos
│   │   ├── clientes.tsx        # Gestão de clientes
│   │   └── financeiro.tsx      # Painel financeiro
│   ├── admin/                  # Telas administrativas (drawer)
│   │   ├── servicos/           # CRUD de serviços
│   │   ├── produtos/           # CRUD de produtos
│   │   ├── fidelidade/         # Sistema de pontos e cupons
│   │   ├── relatorios/         # Relatórios e gráficos
│   │   └── configuracoes/      # Configurações do sistema
│   └── cliente/                # Área do cliente
│       ├── home.tsx            # Home do cliente
│       ├── servicos/           # Catálogo de serviços
│       ├── loja/               # Loja de produtos
│       ├── agenda/             # Agendamento online
│       └── perfil/             # Perfil e histórico
├── server/                     # Backend Node.js / Express
│   ├── _core/                  # Infraestrutura do servidor
│   │   ├── index.ts            # Entry point do servidor
│   │   └── trpc.ts             # Configuração tRPC
│   ├── routers.ts              # Todos os routers tRPC
│   ├── db.ts                   # Funções de acesso ao banco
│   ├── admin-routes.ts         # Painel web admin (SSR)
│   ├── public-routes.ts        # Página pública (SSR)
│   ├── superadmin-routes.ts    # Painel super-admin (SSR)
│   ├── mp-routes.ts            # Webhooks Mercado Pago
│   ├── email.ts                # Envio de e-mails (SMTP/Resend)
│   ├── review-job.ts           # Job de e-mail de avaliação
│   └── storage.ts              # Upload de arquivos (S3)
└── drizzle/
    └── schema.ts               # Schema completo do banco de dados
```

### Fluxo de Dados

O app mobile se comunica com o backend exclusivamente via **tRPC** (type-safe RPC sobre HTTP). O painel web e a página pública utilizam rotas **REST/SSR** com Express, renderizando HTML diretamente no servidor. Ambas as camadas compartilham as mesmas funções de acesso ao banco definidas em `server/db.ts`.

---

## 3. Banco de Dados — Tabelas e Relacionamentos

O banco de dados é **MySQL**, gerenciado pelo **Drizzle ORM**. A seguir, cada tabela é descrita com suas colunas, tipos e relacionamentos.

### Diagrama de Relacionamentos (Simplificado)

```
tenants ──────────────────────────────────────────────┐
   │                                                   │
   ├── barbers ──────────────────────────────────────┐ │
   │      │                                          │ │
   │      ├── working_hours                          │ │
   │      ├── blocked_slots                          │ │
   │      ├── commission_configs ──► commission_entries
   │      └── appointments ◄──────────────────────┐ │ │
   │                                               │ │ │
   ├── clients ─────────────────────────────────┐  │ │ │
   │      │                                     │  │ │ │
   │      ├── client_accounts                   │  │ │ │
   │      ├── client_points ◄── loyalty_rewards │  │ │ │
   │      ├── waitlist                          │  │ │ │
   │      └── appointments ────────────────────►┘  │ │ │
   │                                               │ │ │
   ├── services ──────────────────────────────────►│ │ │
   │      ├── media_files                          │ │ │
   │      ├── return_message_configs               │ │ │
   │      └── reviews ◄── appointments ────────────┘ │ │
   │                                                  │ │
   ├── products ──────────────────────────────────────┘ │
   │      ├── media_files                               │
   │      └── stock_movements                           │
   │                                                    │
   ├── sales ──────────────────────────────────────────►┘
   │      └── sale_items
   │
   ├── expenses
   ├── coupons ──► sales (couponId)
   ├── loyalty_config
   ├── loyalty_rewards ──► client_points
   ├── shop_settings
   ├── promotions
   ├── recurring_appointments
   └── password_reset_tokens
```

---

### 3.1 `tenants` — Barbearias / Salões

Representa cada barbearia cadastrada na plataforma SaaS. É a entidade raiz do multi-tenancy.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `slug` | VARCHAR(100) UNIQUE | Identificador URL-friendly (ex: `barbearia-do-joao`) |
| `name` | VARCHAR(255) | Nome da barbearia |
| `phone` | VARCHAR(20) | Telefone de contato |
| `cnpj` | VARCHAR(20) | CNPJ da empresa |
| `address` | TEXT | Endereço completo |
| `cep` | VARCHAR(10) | CEP |
| `addressNumber` | VARCHAR(20) | Número do endereço |
| `addressComplement` | VARCHAR(100) | Complemento |
| `city` | VARCHAR(100) | Cidade |
| `state` | VARCHAR(2) | Estado (UF) |
| `plan` | ENUM | Plano contratado: `solo`, `team`, `studio` |
| `status` | ENUM | Status: `active`, `trial`, `suspended`, `cancelled` |
| `trialEndsAt` | TIMESTAMP | Data de expiração do período de teste |
| `logoUrl` | TEXT | URL do logotipo |
| `createdAt` | TIMESTAMP | Data de criação |
| `updatedAt` | TIMESTAMP | Última atualização |

**Relacionamentos:** Um tenant possui muitos `barbers`, `clients`, `shopSettings` e `appointments` (via `tenantId`).

---

### 3.2 `users` — Usuários do Sistema (OAuth)

Usuários autenticados via OAuth (Google, etc.) para acesso ao painel super-admin.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `openId` | VARCHAR(64) UNIQUE | ID do provedor OAuth |
| `name` | TEXT | Nome do usuário |
| `email` | VARCHAR(320) | E-mail |
| `loginMethod` | VARCHAR(64) | Método de login (ex: `google`) |
| `role` | ENUM | Papel: `user`, `admin` |
| `createdAt` | TIMESTAMP | Data de criação |
| `lastSignedIn` | TIMESTAMP | Último acesso |

---

### 3.3 `barbers` — Barbeiros / Funcionários

Profissionais que trabalham na barbearia. Inclui tanto barbeiros quanto recepcionistas e administradores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `tenantId` | INT | Referência ao tenant (null = single-tenant) |
| `name` | VARCHAR(255) | Nome completo |
| `email` | VARCHAR(320) | E-mail de acesso ao painel |
| `phone` | VARCHAR(20) | Telefone |
| `photoUrl` | TEXT | URL da foto de perfil |
| `role` | ENUM | Papel: `super_admin`, `barber`, `receptionist` |
| `specialties` | TEXT | Especialidades (JSON ou texto livre) |
| `isActive` | BOOLEAN | Se o profissional está ativo |
| `passwordHash` | VARCHAR(255) | Hash bcrypt da senha |
| `pushToken` | TEXT | Expo Push Token para notificações push |
| `createdAt` | TIMESTAMP | Data de criação |

**Relacionamentos:** Um barbeiro possui muitos `appointments`, `working_hours`, `blocked_slots`, `commission_configs` e `commission_entries`.

---

### 3.4 `clients` — Clientes da Barbearia

Cadastro de clientes atendidos pela barbearia.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `tenantId` | INT | Referência ao tenant |
| `name` | VARCHAR(255) | Nome completo |
| `email` | VARCHAR(320) | E-mail |
| `phone` | VARCHAR(20) | Telefone (obrigatório) |
| `birthDate` | VARCHAR(10) | Data de nascimento (YYYY-MM-DD) |
| `photoUrl` | TEXT | URL da foto |
| `notes` | TEXT | Observações internas |
| `totalPoints` | INT | Saldo atual de pontos de fidelidade |
| `isActive` | BOOLEAN | Se o cliente está ativo |
| `createdAt` | TIMESTAMP | Data de cadastro |

**Relacionamentos:** Um cliente possui muitos `appointments`, `client_points`, `reviews`, `waitlist` e pode ter uma `client_account`.

---

### 3.5 `client_accounts` — Contas de Acesso dos Clientes

Credenciais de autenticação para que o cliente acesse a área do cliente no app e na web.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `clientId` | INT UNIQUE | Referência ao cliente (1:1) |
| `email` | VARCHAR(320) UNIQUE | E-mail de login |
| `passwordHash` | VARCHAR(255) | Hash bcrypt da senha |
| `googleId` | VARCHAR(255) | ID Google para login social |
| `isActive` | BOOLEAN | Se a conta está ativa |

**Relacionamentos:** Cada `client_account` pertence a exatamente um `client` (relação 1:1).

---

### 3.6 `categories` — Categorias

Categorias para organizar serviços e produtos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `name` | VARCHAR(100) | Nome da categoria |
| `type` | ENUM | Tipo: `service` ou `product` |

**Relacionamentos:** Uma categoria agrupa muitos `services` ou `products`.

---

### 3.7 `services` — Serviços

Catálogo de serviços oferecidos pela barbearia (cortes, tratamentos, etc.).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `categoryId` | INT | Referência à categoria |
| `name` | VARCHAR(255) | Nome do serviço |
| `description` | TEXT | Descrição detalhada |
| `price` | DECIMAL(10,2) | Preço em reais |
| `durationMinutes` | INT | Duração em minutos |
| `isActive` | BOOLEAN | Se o serviço está disponível |

**Relacionamentos:** Um serviço aparece em muitos `appointments`, `sale_items`, `reviews`, `media_files` e `return_message_configs`.

---

### 3.8 `products` — Produtos

Catálogo de produtos à venda ou de uso interno da barbearia.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `categoryId` | INT | Referência à categoria |
| `name` | VARCHAR(255) | Nome do produto |
| `description` | TEXT | Descrição |
| `price` | DECIMAL(10,2) | Preço de venda |
| `productType` | ENUM | Tipo: `sale` (venda ao cliente) ou `internal` (uso da barbearia) |
| `stockQuantity` | INT | Quantidade em estoque |
| `minStockAlert` | INT | Quantidade mínima antes do alerta |
| `isActive` | BOOLEAN | Se o produto está ativo |

**Relacionamentos:** Um produto aparece em muitos `sale_items`, `media_files` e `stock_movements`.

---

### 3.9 `media_files` — Arquivos de Mídia

Fotos e vídeos associados a serviços ou produtos, armazenados em S3.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `entityType` | ENUM | Tipo da entidade: `service` ou `product` |
| `entityId` | INT | ID da entidade associada |
| `url` | TEXT | URL pública do arquivo no S3 |
| `type` | ENUM | Tipo do arquivo: `image` ou `video` |
| `order` | INT | Ordem de exibição na galeria |

**Relacionamentos:** Cada arquivo pertence a um `service` ou `product` via `entityType` + `entityId` (polimórfico).

---

### 3.10 `working_hours` — Horários de Trabalho

Define os horários de funcionamento de cada barbeiro por dia da semana.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `barberId` | INT | Referência ao barbeiro |
| `dayOfWeek` | INT | Dia da semana (0=Domingo, 6=Sábado) |
| `startTime` | TIME | Horário de início |
| `endTime` | TIME | Horário de término |
| `lunchStart` | TIME | Início do intervalo de almoço |
| `lunchEnd` | TIME | Fim do intervalo de almoço |
| `isWorking` | BOOLEAN | Se trabalha neste dia |

**Relacionamentos:** Cada registro pertence a um `barber`. Utilizado pelo algoritmo de slots disponíveis.

---

### 3.11 `blocked_slots` — Horários Bloqueados

Bloqueios pontuais de horário (folgas, feriados, intervalos extras).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `barberId` | INT | Referência ao barbeiro |
| `date` | VARCHAR(10) | Data do bloqueio (YYYY-MM-DD) |
| `startTime` | TIME | Início do bloqueio |
| `endTime` | TIME | Fim do bloqueio |
| `reason` | VARCHAR(255) | Motivo do bloqueio |

**Relacionamentos:** Cada bloqueio pertence a um `barber`. Consultado junto com `working_hours` para calcular disponibilidade.

---

### 3.12 `appointments` — Agendamentos

Núcleo do sistema. Registra todos os agendamentos realizados.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `clientId` | INT | Referência ao cliente |
| `barberId` | INT | Referência ao barbeiro |
| `serviceId` | INT | Referência ao serviço |
| `date` | VARCHAR(10) | Data do agendamento (YYYY-MM-DD) |
| `startTime` | TIME | Horário de início |
| `endTime` | TIME | Horário de término (calculado automaticamente) |
| `status` | ENUM | Status: `scheduled`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show` |
| `notes` | TEXT | Observações do agendamento |
| `cancelReason` | TEXT | Motivo do cancelamento |
| `reminderSent` | BOOLEAN | Se o lembrete foi enviado |
| `whatsappConfirmationSent` | BOOLEAN | Se a confirmação WhatsApp foi enviada |

**Relacionamentos:** Um agendamento conecta `client`, `barber` e `service`. Pode gerar uma `sale`, uma `review` e `commission_entries`.

---

### 3.13 `sales` — Vendas

Registra todas as transações financeiras (serviços prestados e produtos vendidos).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `clientId` | INT | Referência ao cliente (opcional) |
| `barberId` | INT | Barbeiro responsável |
| `appointmentId` | INT | Agendamento vinculado (opcional) |
| `subtotal` | DECIMAL(10,2) | Subtotal antes de descontos |
| `discount` | DECIMAL(10,2) | Valor do desconto aplicado |
| `total` | DECIMAL(10,2) | Valor total cobrado |
| `paymentMethod` | ENUM | Método: `cash`, `credit_card`, `debit_card`, `pix`, `mercado_pago`, `other` |
| `paymentStatus` | ENUM | Status: `pending`, `paid`, `cancelled`, `refunded` |
| `couponId` | INT | Cupom utilizado (opcional) |
| `couponCode` | VARCHAR(50) | Código do cupom (desnormalizado) |
| `mercadoPagoPaymentId` | VARCHAR(255) | ID do pagamento no Mercado Pago |
| `notes` | TEXT | Observações |

**Relacionamentos:** Uma venda pertence a um `barber` e opcionalmente a um `client` e `appointment`. Possui muitos `sale_items` e pode referenciar um `coupon`.

---

### 3.14 `sale_items` — Itens de Venda

Detalhamento dos itens (serviços ou produtos) de cada venda.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `saleId` | INT | Referência à venda |
| `itemType` | ENUM | Tipo: `service` ou `product` |
| `itemId` | INT | ID do serviço ou produto |
| `itemName` | VARCHAR(255) | Nome desnormalizado (histórico) |
| `quantity` | INT | Quantidade |
| `unitPrice` | DECIMAL(10,2) | Preço unitário |
| `total` | DECIMAL(10,2) | Total do item |

**Relacionamentos:** Cada item pertence a uma `sale`. O `itemId` referencia `services` ou `products` conforme `itemType`.

---

### 3.15 `expenses` — Despesas

Registro de despesas operacionais da barbearia.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `barberId` | INT | Barbeiro responsável (opcional) |
| `category` | VARCHAR(100) | Categoria da despesa |
| `description` | VARCHAR(500) | Descrição detalhada |
| `amount` | DECIMAL(10,2) | Valor da despesa |
| `date` | VARCHAR(10) | Data (YYYY-MM-DD) |
| `paymentMethod` | VARCHAR(50) | Forma de pagamento |
| `receiptUrl` | TEXT | URL do comprovante |

---

### 3.16 `loyalty_config` — Configuração de Fidelidade

Parâmetros globais do programa de pontos da barbearia.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `isActive` | BOOLEAN | Se o programa está ativo |
| `pointsPerService` | INT | Pontos ganhos por serviço realizado |
| `pointsPerReal` | DECIMAL(5,2) | Pontos ganhos por real gasto |
| `pointsExpireMonths` | INT | Meses até os pontos expirarem (0 = nunca) |

---

### 3.17 `loyalty_rewards` — Recompensas de Fidelidade

Recompensas que os clientes podem resgatar com seus pontos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `name` | VARCHAR(255) | Nome da recompensa |
| `description` | TEXT | Descrição |
| `pointsRequired` | INT | Pontos necessários para resgate |
| `rewardValue` | DECIMAL(10,2) | Valor monetário do benefício |
| `isActive` | BOOLEAN | Se a recompensa está disponível |

**Relacionamentos:** Uma recompensa pode ser referenciada em `client_points` quando resgatada.

---

### 3.18 `client_points` — Histórico de Pontos

Registro de todas as movimentações de pontos de cada cliente.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `clientId` | INT | Referência ao cliente |
| `points` | INT | Quantidade de pontos (positivo = ganho, negativo = gasto) |
| `type` | ENUM | Tipo: `earned`, `redeemed`, `expired`, `adjusted` |
| `description` | VARCHAR(255) | Descrição da movimentação |
| `saleId` | INT | Venda que gerou os pontos (opcional) |
| `rewardId` | INT | Recompensa resgatada (opcional) |
| `expiresAt` | TIMESTAMP | Data de expiração dos pontos |

**Relacionamentos:** Cada entrada pertence a um `client` e pode referenciar uma `sale` ou `loyalty_reward`.

---

### 3.19 `coupons` — Cupons de Desconto

Cupons de desconto criados pelo administrador ou gerados automaticamente (ex: aniversário).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `code` | VARCHAR(50) UNIQUE | Código do cupom |
| `description` | VARCHAR(255) | Descrição |
| `discountType` | ENUM | Tipo: `percent` (%) ou `fixed` (R$) |
| `discountValue` | DECIMAL(10,2) | Valor do desconto |
| `minOrderValue` | DECIMAL(10,2) | Pedido mínimo para aplicar |
| `maxUses` | INT | Limite de usos (null = ilimitado) |
| `usedCount` | INT | Quantidade de vezes usado |
| `validFrom` | VARCHAR(10) | Data de início de validade |
| `validUntil` | VARCHAR(10) | Data de fim de validade |
| `isActive` | BOOLEAN | Se o cupom está ativo |

**Relacionamentos:** Um cupom pode ser referenciado em muitas `sales`.

---

### 3.20 `shop_settings` — Configurações da Barbearia

Todas as configurações operacionais e de personalização da barbearia.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `tenantId` | INT | Referência ao tenant |
| `shopName` | VARCHAR(255) | Nome da barbearia |
| `address` | TEXT | Endereço |
| `phone` | VARCHAR(20) | Telefone |
| `whatsapp` | VARCHAR(20) | Número WhatsApp |
| `logoUrl` | TEXT | URL do logo |
| `mercadoPagoAccessToken` | TEXT | Token de acesso Mercado Pago |
| `mercadoPagoPublicKey` | TEXT | Chave pública Mercado Pago |
| `whatsappMessageTemplate` | TEXT | Template de mensagem de confirmação |
| `reminderMessageTemplate` | TEXT | Template de lembrete |
| `instagram` | VARCHAR(100) | Perfil Instagram (`@usuario`) |
| `cnpj` | VARCHAR(20) | CNPJ |
| `cep` | VARCHAR(10) | CEP |
| `addressNumber` | VARCHAR(20) | Número do endereço |
| `addressComplement` | VARCHAR(100) | Complemento |
| `googleMapsUrl` | TEXT | Link do Google Maps |
| `pixKey` | VARCHAR(255) | Chave Pix (CNPJ, CPF, e-mail ou telefone) |
| `galleryUrls` | TEXT | URLs das fotos da galeria (JSON) |
| `primaryColor` | VARCHAR(20) | Cor primária da marca (hex) |
| `bannerUrl` | TEXT | URL do banner da página pública |

---

### 3.21 `password_reset_tokens` — Tokens de Recuperação de Senha

Tokens temporários para o fluxo de redefinição de senha.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `email` | VARCHAR(320) | E-mail do solicitante |
| `token` | VARCHAR(6) | Código de 6 dígitos enviado por e-mail |
| `expiresAt` | TIMESTAMP | Expiração do token |
| `used` | BOOLEAN | Se o token já foi utilizado |

---

### 3.22 `reviews` — Avaliações de Serviços

Avaliações deixadas pelos clientes após os atendimentos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `clientId` | INT | Referência ao cliente |
| `serviceId` | INT | Referência ao serviço avaliado |
| `appointmentId` | INT | Agendamento avaliado (opcional) |
| `rating` | INT | Nota de 1 a 5 |
| `comment` | TEXT | Comentário opcional |
| `createdAt` | TIMESTAMP | Data da avaliação |

**Relacionamentos:** Uma avaliação conecta `client`, `service` e opcionalmente `appointment`.

---

### 3.23 `return_message_configs` — Mensagens de Retorno Automáticas

Configuração de mensagens automáticas enviadas X dias após um atendimento para incentivar o retorno.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `serviceId` | INT UNIQUE | Serviço vinculado (1:1) |
| `delayDays` | INT | Dias após o atendimento para enviar |
| `messageTemplate` | TEXT | Template da mensagem (suporta variáveis) |
| `isActive` | BOOLEAN | Se está ativo |

---

### 3.24 `promotions` — Promoções e Campanhas

Campanhas de marketing enviadas por push notification para segmentos de clientes.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `title` | VARCHAR(255) | Título da promoção |
| `message` | TEXT | Mensagem da campanha |
| `targetAudience` | ENUM | Público: `all`, `inactive_30`, `inactive_60`, `birthday_month` |
| `sentAt` | TIMESTAMP | Data/hora de envio |
| `recipientCount` | INT | Número de destinatários |
| `createdBy` | INT | Barbeiro que criou |

---

### 3.25 `waitlist` — Lista de Espera

Clientes aguardando uma vaga quando o horário desejado está ocupado.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `clientId` | INT | Referência ao cliente |
| `barberId` | INT | Barbeiro preferido (opcional) |
| `serviceId` | INT | Serviço desejado (opcional) |
| `date` | VARCHAR(10) | Data desejada |
| `notifiedAt` | TIMESTAMP | Quando foi notificado |
| `status` | ENUM | Status: `waiting`, `notified`, `booked`, `cancelled` |

---

### 3.26 `commission_configs` — Configuração de Comissões

Define a taxa de comissão padrão de cada barbeiro.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `barberId` | INT UNIQUE | Referência ao barbeiro (1:1) |
| `defaultRate` | DECIMAL(5,2) | Taxa padrão em percentual (ex: 50.00 = 50%) |
| `isActive` | BOOLEAN | Se a configuração está ativa |

---

### 3.27 `commission_entries` — Entradas de Comissão

Registro de cada comissão calculada para um barbeiro.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `barberId` | INT | Referência ao barbeiro |
| `appointmentId` | INT | Agendamento vinculado (opcional) |
| `saleId` | INT | Venda vinculada (opcional) |
| `grossValue` | DECIMAL(10,2) | Valor bruto do serviço/produto |
| `commissionRate` | DECIMAL(5,2) | Taxa aplicada |
| `commissionValue` | DECIMAL(10,2) | Valor da comissão calculada |
| `type` | ENUM | Tipo: `service` ou `product` |
| `date` | VARCHAR(10) | Data da comissão |

---

### 3.28 `recurring_appointments` — Agendamentos Recorrentes

Configuração de agendamentos que se repetem periodicamente.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `clientId` | INT | Referência ao cliente |
| `barberId` | INT | Referência ao barbeiro |
| `serviceId` | INT | Referência ao serviço |
| `startDate` | VARCHAR(10) | Data de início da recorrência |
| `startTime` | TIME | Horário de início |
| `endTime` | TIME | Horário de término |
| `intervalWeeks` | INT | Intervalo em semanas (ex: 4 = mensal) |
| `occurrences` | INT | Número de ocorrências a gerar |
| `isActive` | BOOLEAN | Se a recorrência está ativa |

---

### 3.29 `stock_movements` — Movimentações de Estoque

Histórico de entradas, saídas e ajustes de estoque de produtos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador único |
| `productId` | INT | Referência ao produto |
| `type` | ENUM | Tipo: `in` (entrada), `out` (saída), `adjustment` |
| `quantity` | INT | Quantidade (positivo = entrada, negativo = saída) |
| `reason` | VARCHAR(255) | Motivo da movimentação |
| `barberId` | INT | Barbeiro responsável (opcional) |
| `saleId` | INT | Venda que gerou a saída (opcional) |
| `date` | VARCHAR(10) | Data da movimentação |

---

## 4. API — Rotas tRPC (App Mobile)

O app mobile se comunica com o servidor via tRPC em `/api/trpc`. Todos os routers estão definidos em `server/routers.ts`.

| Router | Operações Principais |
|--------|---------------------|
| `auth` | `me`, `login`, `logout`, `setup` |
| `admin` | `getStats`, `getRecentAppointments`, `getUpcomingAppointments` |
| `barbers` | `list`, `get`, `create`, `update`, `delete`, `workingHours.*` |
| `clients` | `list`, `get`, `create`, `update`, `delete`, `search`, `getWithHistory` |
| `categories` | `list`, `create`, `delete` |
| `services` | `list`, `listWithMedia`, `listWithMediaAndRatings`, `get`, `create`, `update`, `delete`, `media.*` |
| `products` | `list`, `listWithMedia`, `get`, `create`, `update`, `delete`, `media.*` |
| `upload` | `image`, `video`, `pdf` |
| `appointments` | `byDate`, `allByDate`, `nextByClient`, `byDateRange`, `checkAvailability`, `create`, `update`, `cancel`, `getPaymentStatus`, `registerPayment`, `blockedSlots.*` |
| `sales` | `byDateRange`, `get`, `create` |
| `expenses` | `byDateRange`, `create`, `update`, `delete` |
| `coupons` | `list`, `get`, `create`, `update`, `delete`, `getAvailableForClient`, `validate` |
| `loyalty` | `getConfig`, `updateConfig`, `rewards.*` |
| `settings` | `get`, `update` |
| `dashboard` | `getStats` |
| `clientAuth` | `register`, `login`, `updateProfile`, `changePassword`, `googleLogin`, `requestPasswordReset`, `verifyResetToken`, `resetPassword` |
| `reviews` | `create`, `byService`, `byClient` |
| `slots` | `available` |
| `pointsHistory` | `byClient` |
| `payments` | `createPreference`, `createPixPayment`, `getStatus` |
| `reports` | `financial`, `serviceRanking`, `barberPerformance`, `clientVip` |
| `returnMessages` | `getByService`, `upsert`, `delete` |
| `promotions` | `list`, `create`, `send` |
| `waitlist` | `add`, `getByDate`, `notify`, `cancel` |
| `commissions` | `getConfig`, `upsertConfig`, `getEntries`, `getSummary` |
| `recurring` | `create`, `list`, `cancel` |
| `stock` | `getMovements`, `addMovement`, `getAlerts` |
| `onboarding` | `getStatus`, `complete` |

---

## 5. API — Rotas REST (Painel Web e Público)

### 5.1 Painel Administrativo Web (`/admin/*`)

Todas as rotas requerem autenticação via cookie de sessão (`admin_session`).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin` | Dashboard com KPIs do dia |
| GET | `/admin/agenda` | Agenda do dia com agendamentos |
| GET | `/admin/agenda/novo` | Formulário de novo agendamento |
| POST | `/admin/agenda/novo` | Criar agendamento via painel web |
| GET | `/admin/clientes` | Lista de clientes com busca |
| GET | `/admin/clientes/:id` | Detalhe do cliente com histórico |
| GET | `/admin/servicos` | CRUD de serviços |
| POST | `/admin/servicos` | Criar ou editar serviço |
| POST | `/admin/servicos/toggle` | Ativar/desativar serviço |
| POST | `/admin/servicos/delete` | Excluir serviço |
| GET | `/admin/produtos` | CRUD de produtos |
| POST | `/admin/produtos` | Criar ou editar produto |
| POST | `/admin/produtos/toggle` | Ativar/desativar produto |
| POST | `/admin/produtos/delete` | Excluir produto |
| GET | `/admin/financeiro` | Painel financeiro com receitas e despesas |
| GET | `/admin/relatorios` | Relatórios com gráficos SVG |
| GET | `/admin/configuracoes` | Configurações (4 abas) |
| POST | `/admin/configuracoes` | Salvar dados ou visual |
| POST | `/admin/configuracoes/horarios/:barberId` | Salvar horários de trabalho |
| POST | `/admin/configuracoes/equipe/toggle` | Ativar/desativar profissional |
| POST | `/admin/configuracoes/equipe/novo` | Cadastrar novo profissional |
| GET | `/admin/login` | Tela de login |
| POST | `/admin/login` | Autenticar |
| GET | `/admin/logout` | Encerrar sessão |
| POST | `/admin-api/appointment-status` | Atualizar status de agendamento (AJAX) |

### 5.2 Página Pública (`/pub/*`)

Acessível por clientes via navegador, identificada pelo `slug` da barbearia.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/pub/:slug` | Página inicial da barbearia |
| GET | `/pub/:slug/agendar` | Página de agendamento online |
| GET | `/pub/:slug/login` | Login do cliente |
| GET | `/pub/:slug/cadastro` | Cadastro do cliente |
| GET | `/pub/:slug/logout` | Logout do cliente |
| GET | `/pub/:slug/meus-agendamentos` | Histórico de agendamentos do cliente |
| GET | `/pub/:slug/avaliar/:appointmentId` | Página de avaliação pós-atendimento |
| GET | `/pub-api/slots` | Slots disponíveis para agendamento |
| POST | `/pub-api/login` | Autenticar cliente |
| POST | `/pub-api/register` | Cadastrar cliente |
| POST | `/pub-api/book` | Criar agendamento online |
| POST | `/pub-api/cancel-appointment` | Cancelar agendamento |
| POST | `/pub-api/submit-review` | Submeter avaliação |
| GET | `/pub-api/oauth-start` | Iniciar fluxo OAuth Google |
| GET | `/pub-api/oauth-callback` | Callback OAuth Google |

---

## 6. Módulos do Servidor

### 6.1 `email.ts` — Envio de E-mails

Módulo responsável por todos os e-mails transacionais do sistema. Suporta SMTP genérico (Resend, Gmail, etc.) via variáveis de ambiente.

| Função | Descrição |
|--------|-----------|
| `sendBookingConfirmationEmail` | E-mail de confirmação de agendamento ao cliente |
| `sendBarberNotificationEmail` | Notificação ao barbeiro sobre novo agendamento online |
| `sendReviewRequestEmail` | E-mail de solicitação de avaliação com estrelas clicáveis |

O template de avaliação inclui 5 estrelas clicáveis que direcionam para a página pública com a nota pré-selecionada via query string (`?rating=N`).

### 6.2 `review-job.ts` — Job de Avaliação Automática

Job agendado que executa a cada **15 minutos**. Para cada agendamento com status `completed` cujo horário de término ocorreu há pelo menos **2 horas**, e que ainda não teve e-mail de avaliação enviado, o job:

1. Busca o e-mail do cliente via `client_accounts`
2. Busca as configurações da barbearia para personalizar o e-mail
3. Envia o e-mail de avaliação via `sendReviewRequestEmail`
4. Marca o agendamento como `reviewEmailSent = true` para evitar reenvio

### 6.3 `storage.ts` — Upload de Arquivos

Integração com S3-compatible storage para upload de imagens e vídeos. Utilizado pelo router `upload` do tRPC.

### 6.4 `mp-routes.ts` — Mercado Pago

Webhooks IPN do Mercado Pago para confirmação automática de pagamentos. Ao receber confirmação, atualiza o status da venda para `paid`.

---

## 7. Funcionalidades Implementadas

### App Mobile — Painel Administrativo

O painel administrativo do app mobile é estruturado em **4 abas principais** no rodapé (Dashboard, Agenda, Clientes, Financeiro) e um **drawer lateral** (≡) com acesso a Serviços, Produtos, Fidelidade, Relatórios e Configurações.

**Dashboard** exibe KPIs do dia (agendamentos, faturamento, clientes atendidos), lista de próximos agendamentos e card de pagamentos pendentes do Mercado Pago.

**Agenda** apresenta visão de calendário com blocos de horário por barbeiro. Os cards de agendamento suportam **swipe gesture**: arrastar para a direita avança o status positivo (Agendado → Confirmado → Em Andamento → Concluído), arrastar para a esquerda abre menu rápido com Cancelar e Não Compareceu. Ao concluir, abre automaticamente o modal de pagamento.

**Clientes** lista todos os clientes com busca em tempo real. O detalhe do cliente exibe histórico de agendamentos, pontos de fidelidade e painel de aniversariantes do dia/mês.

**Financeiro** consolida receitas (vendas) e despesas com breakdown por forma de pagamento e exportação de DRE em PDF.

### App Mobile — Área do Cliente

A área do cliente possui **5 abas**: Início, Serviços, Loja, Agenda e Perfil.

O **fluxo de agendamento** segue 5 etapas: seleção de serviço → barbeiro → data → horário → confirmação. Suporta aplicação de cupons e pontos de fidelidade antes do pagamento. Integra Mercado Pago (Checkout Pro) e Pix com QR Code nativo.

O **sistema de fidelidade** acumula pontos por serviço realizado ou por valor gasto, com recompensas configuráveis pelo administrador. Cupons de aniversário são gerados automaticamente no mês do aniversário do cliente.

### Painel Web Administrativo

Interface web responsiva renderizada no servidor (SSR), acessível em qualquer navegador sem necessidade de instalar o app. Inclui todas as funcionalidades de gestão: agenda, clientes, serviços, produtos, financeiro, relatórios e configurações completas.

### Página Pública Web

Cada barbearia possui uma landing page pública em `/pub/:slug` com informações, galeria de fotos, lista de serviços e botão de agendamento. Clientes podem criar conta, fazer login com Google, agendar online e visualizar seus agendamentos.

### Sistema de Avaliações

Após cada atendimento concluído, o cliente recebe um e-mail automático (2h depois) com 5 estrelas clicáveis. Ao clicar, é direcionado para a página de avaliação com a nota pré-selecionada, podendo adicionar um comentário. As avaliações ficam visíveis no detalhe de cada serviço no app do cliente.

---

## 8. Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | String de conexão MySQL |
| `JWT_SECRET` | Sim | Chave secreta para tokens JWT |
| `SMTP_HOST` | Não | Host do servidor SMTP |
| `SMTP_PORT` | Não | Porta SMTP (padrão: 587) |
| `SMTP_USER` | Não | Usuário SMTP |
| `SMTP_PASS` | Não | Senha SMTP |
| `SMTP_FROM` | Não | Endereço de remetente |
| `RESEND_API_KEY` | Não | API Key do Resend (alternativa ao SMTP) |
| `GOOGLE_CLIENT_ID` | Não | Client ID OAuth Google |
| `GOOGLE_CLIENT_SECRET` | Não | Client Secret OAuth Google |
| `GOOGLE_MAPS_API_KEY` | Não | API Key Google Maps (autocomplete) |
| `S3_ENDPOINT` | Não | Endpoint S3 para upload de mídia |
| `S3_ACCESS_KEY` | Não | Access Key S3 |
| `S3_SECRET_KEY` | Não | Secret Key S3 |
| `S3_BUCKET` | Não | Nome do bucket S3 |
| `EXPO_PUBLIC_API_URL` | Não | URL base da API para o app |

> **Nota:** As credenciais do Mercado Pago (`mercadoPagoAccessToken` e `mercadoPagoPublicKey`) são armazenadas por barbearia na tabela `shop_settings`, não como variáveis de ambiente globais.

---

## 9. Guia de Configuração Inicial

### Passo 1 — Banco de Dados

Execute a migração inicial para criar todas as tabelas:

```bash
pnpm db:push
```

### Passo 2 — Primeiro Acesso (Super Admin)

Acesse o app mobile e utilize a tela de **Primeiro Acesso** (`/setup`) para criar o primeiro administrador com nome, e-mail e senha. Este usuário terá o papel `super_admin`.

### Passo 3 — Configurações da Barbearia

No painel administrativo, acesse **Configurações** e preencha:

- **Aba Dados:** nome da barbearia, telefone, WhatsApp, Instagram, endereço completo e chave Pix
- **Aba Visual:** cor primária da marca, logo, banner e galeria de fotos
- **Aba Horários:** configure os dias e horários de trabalho de cada profissional
- **Aba Equipe:** cadastre os demais profissionais com seus e-mails e senhas

### Passo 4 — Serviços e Produtos

Cadastre os serviços oferecidos (com preço e duração) e os produtos disponíveis para venda. Adicione fotos e vídeos para enriquecer o catálogo exibido na área do cliente.

### Passo 5 — E-mail (Opcional)

Configure as variáveis SMTP ou a API Key do Resend para habilitar:

- Confirmação de agendamento ao cliente
- Notificação ao barbeiro sobre novos agendamentos online
- Recuperação de senha
- Solicitação de avaliação pós-atendimento

### Passo 6 — Mercado Pago (Opcional)

Nas configurações da barbearia, insira o **Access Token** e a **Public Key** do Mercado Pago para habilitar pagamento online via Checkout Pro e Pix com QR Code.

---

*Documentação gerada em 26 de fevereiro de 2026 — Barber Pro v6.8*
