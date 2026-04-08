# Jornada do Cliente — Barber Pro

## Visão Geral

O Barber Pro oferece **duas plataformas** para o cliente realizar agendamentos e interagir com a barbearia: o **aplicativo mobile** (Expo/React Native) e a **página pública web** (slug.barberpro.com.br). Ambas compartilham o mesmo backend e banco de dados, garantindo sincronização em tempo real. Este documento mapeia cada passo da jornada do cliente em ambas as plataformas, identifica pontos de fricção e propõe melhorias.

---

## 1. Canais de Entrada (Descoberta)

O cliente pode chegar à barbearia por diferentes caminhos:

| Canal | Descrição | Destino |
|-------|-----------|---------|
| **Link direto / WhatsApp** | Barbearia compartilha link da página pública | Página pública (web) |
| **Instagram / Redes sociais** | Link na bio ou stories | Página pública (web) |
| **Google Maps** | Ficha do Google com link | Página pública (web) |
| **App instalado** | Cliente já tem o app no celular | Tela de boas-vindas (app) |
| **Aba "Explorar" no app** | Busca por barbearias próximas via GPS | Lista de barbearias (app) |
| **Indicação boca a boca** | Amigo indica, cliente busca no app/web | Ambos |

---

## 2. Jornada Completa — Plataforma Web (Página Pública)

### Fluxo Principal: Visitante → Agendamento

```
┌─────────────────────────────────────────────────────────────────────┐
│  ETAPA 1: CHEGADA                                                   │
│  slug.barberpro.com.br                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Hero: Logo + Nome + Endereço + Botão "Agendar Horário"     │    │
│  │ Banner CTA: "Desbloqueie preços e horários" (não logado)   │    │
│  │ Seções: Serviços | Galeria | Equipe | Avaliações | Info    │    │
│  │ CTA fixo mobile: "Agendar Horário" (bottom bar)            │    │
│  │ Banner: "Baixe o app" (App Store + Google Play)            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Clica "Agendar Horário"                          │
│                              ▼                                      │
│  ETAPA 2: AUTENTICAÇÃO (se não logado)                              │
│  /pub/slug/login ou /pub/slug/cadastro                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Opções:                                                     │    │
│  │  • Login com Google (OAuth)                                 │    │
│  │  • Login com e-mail + senha                                 │    │
│  │  • Criar conta (nome, e-mail, telefone, senha)              │    │
│  │  • Esqueci minha senha                                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Login/Cadastro bem-sucedido                       │
│                              ▼                                      │
│  ETAPA 3: AGENDAMENTO                                               │
│  /pub/slug/agendar                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Passo 1: Selecionar serviço (dropdown com preço/duração)   │    │
│  │ Passo 2: Selecionar barbeiro (dropdown)                    │    │
│  │ Passo 3: Selecionar data (input date)                      │    │
│  │ Passo 4: Selecionar horário (slots disponíveis em grid)    │    │
│  │ Passo 5: Confirmar agendamento                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Agendamento confirmado                            │
│                              ▼                                      │
│  ETAPA 4: PÓS-AGENDAMENTO                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • Tela de sucesso com dados do agendamento                 │    │
│  │ • Opções de pagamento: Checkout Pro (MP) ou Pix            │    │
│  │ • Botão "Ver meus agendamentos"                            │    │
│  │ • E-mail de confirmação enviado automaticamente            │    │
│  │ • Barbeiro notificado (push + e-mail)                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    24h antes / 1h antes                              │
│                              ▼                                      │
│  ETAPA 5: LEMBRETES                                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • WhatsApp automático 24h antes                            │    │
│  │ • WhatsApp automático 1h antes                             │    │
│  │ • Push notification (se app instalado)                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Após o atendimento                                │
│                              ▼                                      │
│  ETAPA 6: PÓS-ATENDIMENTO                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • E-mail solicitando avaliação (link direto)               │    │
│  │ • Página de avaliação: /pub/slug/avaliar/:id               │    │
│  │ • Pontos de fidelidade creditados automaticamente          │    │
│  │ • Histórico atualizado em "Meus Agendamentos"              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Páginas Disponíveis na Web Pública

| Rota | Descrição |
|------|-----------|
| `/pub/slug` | Landing page com hero, serviços, galeria, equipe, avaliações, info |
| `/pub/slug/agendar` | Formulário de agendamento step-by-step |
| `/pub/slug/login` | Login (e-mail/senha + Google OAuth) |
| `/pub/slug/cadastro` | Cadastro de novo cliente |
| `/pub/slug/forgot-password` | Recuperação de senha |
| `/pub/slug/meus-agendamentos` | Lista de agendamentos do cliente logado (com cancelamento) |
| `/pub/slug/perfil` | Edição de perfil (nome, telefone, e-mail) |
| `/pub/slug/avaliar/:id` | Formulário de avaliação pós-atendimento |
| `/pub/slug/pagamento/sucesso` | Retorno após pagamento aprovado |
| `/pub/slug/pagamento/falha` | Retorno após falha no pagamento |
| `/pub/slug/pagamento/pendente` | Retorno para pagamento pendente |

---

## 3. Jornada Completa — Aplicativo Mobile

### Fluxo Principal: Download → Agendamento

```
┌─────────────────────────────────────────────────────────────────────┐
│  ETAPA 1: BOAS-VINDAS                                               │
│  /client/index                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Hero: Logo + "BARBER PRO" + descrição                      │    │
│  │ Features: Agendamento | Loja | Pontos | Histórico          │    │
│  │ Botões:                                                     │    │
│  │  • "Entrar na minha conta" → Login                         │    │
│  │  • "Criar conta gratuita" → Cadastro                       │    │
│  │  • "Explorar sem conta" → Home (modo visitante)            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│         Login           Cadastro        Explorar                    │
│                              │                                      │
│  ETAPA 2: AUTENTICAÇÃO                                              │
│  /client/login ou /client/register                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Login: e-mail + senha + Google OAuth                       │    │
│  │ Cadastro: nome, e-mail, telefone, data nascimento,         │    │
│  │           senha + Google OAuth                              │    │
│  │ Esqueci minha senha (link)                                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Autenticado com sucesso                           │
│                              ▼                                      │
│  ETAPA 3: HOME                                                      │
│  /client/(tabs)/home                                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Header: Logo + Nome da barbearia + Status (aberto/fechado) │    │
│  │ Badge de pontos de fidelidade                              │    │
│  │ Carrossel de fotos da galeria                              │    │
│  │ Card "Próximo Agendamento" (se houver)                     │    │
│  │ CTA "Programa de Fidelidade" (se não logado)               │    │
│  │ Seção "Agende seu horário" + Botão "Agendar agora"         │    │
│  │ Avaliações recentes                                        │    │
│  │ Links: WhatsApp | Instagram | Google Maps                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Clica "Agendar agora"                             │
│                              ▼                                      │
│  ETAPA 4: AGENDAMENTO (Wizard 5 passos)                             │
│  /client/book                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Step 1 — SERVIÇO                                           │    │
│  │  Cards visuais com foto, nome, preço, duração, avaliação   │    │
│  │                                                             │    │
│  │ Step 2 — BARBEIRO                                          │    │
│  │  Cards com foto, nome, especialidade                       │    │
│  │                                                             │    │
│  │ Step 3 — DATA                                              │    │
│  │  Scroll horizontal de 30 dias com dia da semana            │    │
│  │                                                             │    │
│  │ Step 4 — HORÁRIO                                           │    │
│  │  Grid de slots disponíveis (ex: 09:00, 09:30, 10:00...)   │    │
│  │  Se sem horários: botão "Lista de Espera"                  │    │
│  │                                                             │    │
│  │ Step 5 — CONFIRMAÇÃO                                       │    │
│  │  Resumo: serviço, barbeiro, data, horário, preço           │    │
│  │  Campo de observações (opcional)                            │    │
│  │  Toggle "Repetir agendamento" (recorrente)                 │    │
│  │  Banner de cupons/recompensas disponíveis                  │    │
│  │  Botão "Confirmar Agendamento"                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Agendamento confirmado                            │
│                              ▼                                      │
│  ETAPA 5: PÓS-CONFIRMAÇÃO                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • Confetti animation 🎉                                    │    │
│  │ • Modal de lembrete: escolher antecedência (15/30/45/60m)  │    │
│  │ • Card compartilhável do agendamento                       │    │
│  │ • Opções de pagamento: Checkout Pro | Pix | Pagar na hora  │    │
│  │ • WhatsApp de confirmação enviado                          │    │
│  │ • Barbeiro notificado (push + e-mail)                      │    │
│  │ • Pontos de fidelidade creditados                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Lembretes automáticos                             │
│                              ▼                                      │
│  ETAPA 6: LEMBRETES                                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • Push notification local (antecedência escolhida)         │    │
│  │ • WhatsApp automático 24h antes                            │    │
│  │ • WhatsApp automático 1h antes                             │    │
│  │ • E-mail de lembrete 24h antes                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    Após o atendimento                                │
│                              ▼                                      │
│  ETAPA 7: PÓS-ATENDIMENTO                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • Push de avaliação (após horário do atendimento)          │    │
│  │ • Modal de avaliação na Home (estrelas + comentário)       │    │
│  │ • E-mail solicitando avaliação                             │    │
│  │ • Pontos de fidelidade atualizados                         │    │
│  │ • Histórico completo na aba "Agenda"                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Tabs do App (Barra Inferior)

| Tab | Ícone | Funcionalidade |
|-----|-------|----------------|
| **Início** | 🏠 | Home com status, próximo agendamento, CTA de booking, avaliações |
| **Serviços** | ✂️ | Catálogo visual de serviços com fotos, preços, avaliações e busca |
| **Loja** | 🛍️ | Catálogo de produtos para venda (pomadas, shampoos, etc.) |
| **Explorar** | 🗺️ | Busca por barbearias próximas via GPS |
| **Agenda** | 📅 | Histórico de agendamentos (futuros e passados) com cancelamento e avaliação |
| **Perfil** | 👤 | Dados pessoais, pontos, cupons, tema claro/escuro, logout |

---

## 4. Comparativo: App vs. Web Pública

| Funcionalidade | App Mobile | Web Pública |
|----------------|:----------:|:-----------:|
| Visualizar serviços | ✅ Cards visuais | ✅ Cards com foto |
| Visualizar equipe | ✅ Na Home | ✅ Seção dedicada |
| Galeria de fotos | ✅ Carrossel com lightbox | ✅ Grid de imagens |
| Agendamento step-by-step | ✅ Wizard 5 passos | ✅ Formulário linear |
| Login e-mail/senha | ✅ | ✅ |
| Login Google OAuth | ✅ | ✅ |
| Cadastro com data nascimento | ✅ | ❌ (apenas nome, e-mail, telefone) |
| Esqueci minha senha | ✅ | ✅ |
| Lista de espera | ✅ | ❌ |
| Cupons e descontos | ✅ Banner proativo | ❌ |
| Agendamento recorrente | ✅ Toggle no booking | ❌ |
| Pagamento online (MP) | ✅ Checkout Pro + Pix | ✅ Checkout Pro + Pix |
| Lembrete personalizado | ✅ Modal de escolha | ❌ |
| Push notifications | ✅ | ❌ (não aplicável) |
| WhatsApp automático | ✅ | ✅ |
| E-mail de confirmação | ✅ | ✅ |
| Avaliação pós-atendimento | ✅ Modal + push | ✅ Página dedicada |
| Histórico de agendamentos | ✅ Aba "Agenda" | ✅ "Meus Agendamentos" |
| Cancelamento de agendamento | ✅ | ✅ |
| Perfil do cliente | ✅ Completo | ✅ Básico |
| Programa de pontos | ✅ Completo | ❌ |
| Loja de produtos | ✅ | ❌ |
| Explorar barbearias | ✅ GPS | ❌ |
| Tema claro/escuro | ✅ | ❌ (sempre escuro) |
| Card compartilhável | ✅ | ❌ |
| Confetti de confirmação | ✅ | ❌ |

---

## 5. Pontos de Fricção Identificados

### Na Web Pública

1. **Preços ocultos para visitantes** — O visitante não logado vê "🔒 Faça login para ver" nos preços. Isso pode afastar clientes que querem apenas consultar valores antes de decidir.

2. **Formulário de agendamento linear** — Na web, o agendamento usa dropdowns simples (serviço, barbeiro, data, horário). No app, é um wizard visual com cards. A experiência web é funcional mas menos atrativa.

3. **Sem lista de espera na web** — Se não há horários disponíveis na web, o cliente não tem opção de entrar na fila. Precisa ir ao app.

4. **Sem cupons/descontos na web** — O banner proativo de cupons e recompensas existe apenas no app. Clientes web perdem essa oportunidade.

5. **Sem agendamento recorrente na web** — A opção de "Repetir agendamento" (semanal/quinzenal/mensal) existe apenas no app.

6. **Cadastro web não pede data de nascimento** — Perde a oportunidade de cupom de aniversário para clientes que se cadastram pela web.

### No App

7. **Sem onboarding guiado** — O app vai direto para a tela de boas-vindas com botões. Não há um tour explicando as funcionalidades (pontos, cupons, agendamento recorrente).

8. **Explorar requer GPS** — A aba "Explorar" depende de permissão de localização. Se negada, não há busca por nome/cidade como alternativa.

### Em Ambos

9. **Confirmação do barbeiro não é visível ao cliente** — O barbeiro recebe notificação e pode confirmar, mas o status "Confirmado" no app/web não é destacado com uma notificação push ao cliente.

10. **Sem estimativa de tempo de espera** — Se o barbeiro está atrasado, o cliente não recebe atualização em tempo real.

---

## 6. Análise: Aba Dedicada na Landing Page?

### Cenário Atual

A landing page pública (`/pub/slug`) já possui:
- Hero com CTA "Agendar Horário"
- Seção de serviços com preços (para logados)
- Galeria de fotos
- Equipe
- Avaliações
- Informações de contato
- Banner de download do app
- CTA fixo no mobile

### Proposta: Seção "Como Funciona" na Landing Page

Em vez de uma aba separada, recomendo adicionar uma **seção "Como Funciona"** na landing page, posicionada logo após o hero e antes dos serviços. Esta seção mostraria o passo a passo visual do agendamento:

```
┌─────────────────────────────────────────────┐
│         ✨ Como Funciona                     │
│                                             │
│  ①  Escolha o serviço                       │
│     Corte, barba, combo... veja preços      │
│                                             │
│  ②  Selecione seu barbeiro                  │
│     Conheça nossa equipe e escolha           │
│                                             │
│  ③  Agende data e horário                   │
│     Veja disponibilidade em tempo real       │
│                                             │
│  ④  Confirme e pague                        │
│     Pix, cartão ou pague na hora             │
│                                             │
│  ⑤  Receba lembretes                        │
│     WhatsApp 24h e 1h antes                  │
│                                             │
│  [ Agendar Agora →  ]                       │
└─────────────────────────────────────────────┘
```

### Por que seção e não aba separada?

| Critério | Aba Separada | Seção na Landing |
|----------|:------------:|:----------------:|
| Visibilidade | Baixa (precisa clicar) | Alta (scroll natural) |
| Conversão | Adiciona um clique extra | Fluxo contínuo |
| Mobile | Mais uma página para carregar | Inline, sem carregamento |
| SEO | Conteúdo fragmentado | Conteúdo concentrado |
| Manutenção | Mais uma rota para manter | Apenas HTML/CSS |

A seção "Como Funciona" educa o visitante sobre o processo sem tirá-lo da página principal, mantendo o fluxo de conversão direto: **ver → entender → agendar**.

---

## 7. Recomendações de Melhoria

### Prioridade Alta (Impacto direto na conversão)

1. **Seção "Como Funciona" na landing page** — Passo a passo visual do agendamento para educar visitantes e aumentar conversão.

2. **Mostrar preços para visitantes** — Remover o bloqueio de preços para não logados. O login deve ser exigido apenas na confirmação do agendamento, não na consulta de preços.

3. **Data de nascimento no cadastro web** — Adicionar campo de data de nascimento no formulário de cadastro da página pública para ativar cupom de aniversário.

### Prioridade Média (Paridade de funcionalidades)

4. **Lista de espera na web** — Quando não há horários, oferecer botão "Entrar na lista de espera" na página de agendamento web.

5. **Cupons/descontos na web** — Mostrar banner de cupons disponíveis na página de agendamento web.

6. **Agendamento recorrente na web** — Adicionar toggle de recorrência no formulário de agendamento web.

### Prioridade Baixa (Polish e experiência)

7. **Onboarding guiado no app** — Tour de 3-4 telas explicando pontos, cupons e agendamento recorrente no primeiro acesso.

8. **Busca por nome na aba Explorar** — Alternativa ao GPS para encontrar barbearias.

9. **Notificação push de confirmação ao cliente** — Quando o barbeiro confirma, enviar push ao cliente.
