# Comparativo: Painel Admin Web × Painel Admin App

> Levantamento realizado em 27/02/2026 com base no código-fonte de `server/admin-routes.ts` (web) e `app/admin/(tabs)/` (mobile).

---

## Resumo Executivo

O painel admin **web** possui **28 seções/rotas** distintas. O painel admin **app** possui **20 telas**. Há **8 funcionalidades exclusivas do web** que ainda não existem no app, e **2 funcionalidades exclusivas do app** que ainda não existem no web. As demais **18 áreas** existem nos dois, mas com graus variados de paridade de recursos.

---

## Tabela Comparativa Completa

| Funcionalidade | Admin Web | Admin App | Observação |
|---|:---:|:---:|---|
| **Dashboard** | ✅ | ✅ | Paridade: KPIs, agenda do dia, pagamentos pendentes, card de link |
| **Agenda (visualização diária)** | ✅ | ✅ | Paridade: lista de agendamentos por data |
| **Agenda → Novo agendamento** | ✅ | ✅ | Paridade: seleção de cliente, serviço, barbeiro, data e horário |
| **Agenda → Alterar status** | ✅ | ✅ | Paridade: confirmado, concluído, cancelado |
| **Agenda → Bloquear horário** | ✅ | ✅ | Paridade: bloquear slots por barbeiro |
| **Clientes → Listagem com busca** | ✅ | ✅ | Paridade: busca por nome/telefone |
| **Clientes → Detalhe do cliente** | ✅ | ✅ | Web: página dedicada. App: modal lateral |
| **Clientes → Criar/editar cliente** | ✅ | ✅ | Paridade |
| **Clientes → Histórico de agendamentos** | ✅ | ✅ | Paridade |
| **Clientes → Painel de aniversariantes** | ✅ | ✅ | Paridade: hoje e mês atual, botão WhatsApp |
| **Clientes → Exportar CSV** | ✅ | ❌ | **Exclusivo web** |
| **Serviços → Listagem** | ✅ | ✅ | Paridade |
| **Serviços → Criar/editar** | ✅ | ✅ | Paridade: nome, preço, duração, categoria, upload de mídia |
| **Serviços → Ativar/desativar** | ✅ | ✅ | Paridade |
| **Serviços → Excluir** | ✅ | ✅ | Paridade |
| **Produtos → Listagem** | ✅ | ✅ | Paridade |
| **Produtos → Criar/editar** | ✅ | ✅ | Paridade: nome, preço, estoque, categoria, upload de mídia |
| **Produtos → Ativar/desativar** | ✅ | ✅ | Paridade |
| **Financeiro → Resumo (receita/despesa/lucro)** | ✅ | ✅ | Paridade: por mês, breakdown por forma de pagamento |
| **Financeiro → Registrar venda** | ✅ | ✅ | Paridade: serviço ou produto, forma de pagamento |
| **Financeiro → Registrar despesa** | ✅ | ✅ | Paridade: categoria, valor, data |
| **Financeiro → Exportar CSV financeiro** | ✅ | ❌ | **Exclusivo web** |
| **Financeiro → Exportar PDF (DRE)** | ✅ | ✅ | Web: botão na tela de relatórios. App: via tRPC `reports.exportPdf` |
| **Relatórios → Gráfico de faturamento** | ✅ | ✅ | Paridade: por semana/mês, gráfico de barras |
| **Relatórios → Ranking de serviços** | ✅ | ✅ | Paridade |
| **Relatórios → Clientes VIP** | ✅ | ✅ | Paridade |
| **Relatórios → Ocupação por barbeiro** | ✅ | ✅ | Paridade |
| **Estoque → Listagem de produtos** | ✅ | ✅ | Paridade: venda e uso interno |
| **Estoque → Movimentação (entrada/saída)** | ✅ | ✅ | Paridade |
| **Estoque → Média de consumo** | ✅ | ✅ | Paridade |
| **Estoque → Exportar CSV** | ✅ | ❌ | **Exclusivo web** |
| **Fidelidade → Configuração de pontos** | ✅ | ✅ | Paridade: regras de acúmulo |
| **Fidelidade → Recompensas** | ✅ | ✅ | Paridade: criar, editar, ativar/desativar |
| **Cupons → Listagem** | ✅ | ✅ | Paridade |
| **Cupons → Criar/editar** | ✅ | ✅ | Paridade |
| **Cupons → Ativar/desativar** | ✅ | ✅ | Paridade |
| **Comissões → Configuração por barbeiro** | ✅ | ✅ | Paridade: percentual por serviço |
| **Comissões → Resumo por período** | ✅ | ✅ | Paridade |
| **Comissões → Minhas comissões (visão barbeiro)** | ❌ | ✅ | **Exclusivo app** — tela `my-commissions.tsx` |
| **Promoções → Enviar notificação segmentada** | ✅ | ✅ | Paridade: por audiência (todos, inativos, VIP) |
| **Promoções → Histórico de campanhas** | ✅ | ✅ | Paridade |
| **Conversão de Promoções → Relatório** | ✅ | ✅ | Paridade: campanhas, enviados, agendamentos gerados, taxa |
| **Mensagens de Retorno → Configurar por serviço** | ✅ | ✅ | Paridade |
| **Lista de Espera → Listagem por data** | ✅ | ✅ | Paridade |
| **Lista de Espera → Remover da fila** | ✅ | ✅ | Paridade |
| **Recorrências → Listagem** | ✅ | ✅ | Paridade |
| **Recorrências → Cancelar** | ✅ | ✅ | Paridade |
| **Avaliações → Listagem com notas e comentários** | ✅ | ❌ | **Exclusivo web** |
| **Chat WhatsApp → Lista de conversas** | ✅ | ❌ | **Exclusivo web** |
| **Chat WhatsApp → Conversa individual** | ✅ | ❌ | **Exclusivo web** |
| **Barbearia → Dados (nome, CNPJ, endereço, CEP)** | ✅ | ✅ | Paridade: ambos têm busca de CEP via ViaCEP |
| **Barbearia → Logo e galeria de fotos** | ✅ | ✅ | Paridade |
| **Barbearia → Equipe (criar/editar/desativar barbeiro)** | ✅ | ✅ | Paridade |
| **Barbearia → Horários de trabalho por barbeiro** | ✅ | ✅ | Paridade |
| **Barbearia → Integração Mercado Pago** | ✅ | ✅ | Paridade: token público e privado |
| **Página do Cliente → URL e QR Code** | ✅ | ⚠️ | Web: aba dedicada. App: apenas `page-appearance.tsx` (cor e banner) |
| **Página do Cliente → Personalização visual** | ✅ | ✅ | Paridade: cor primária e banner |
| **Página do Cliente → Domínio customizado** | ✅ | ❌ | **Exclusivo web** |
| **Página do Cliente → Rastreamento (GA4/Pixel)** | ✅ | ❌ | **Exclusivo web** |
| **Página do Cliente → SEO (título, descrição, OG)** | ✅ | ❌ | **Exclusivo web** |
| **Página do Cliente → Preview (iframe)** | ✅ | ❌ | **Exclusivo web** |
| **Meu Perfil → Editar nome e foto** | ✅ | ✅ | Paridade |
| **Meu Perfil → Alterar senha** | ✅ | ✅ | Paridade |
| **Configurações → Tema (claro/escuro/sistema)** | ❌ | ✅ | **Exclusivo app** — seletor de tema na tela `settings.tsx` |
| **Recuperação de senha** | ✅ | ✅ | Paridade: e-mail com código |

---

## Funcionalidades Exclusivas do Web (8 itens)

Estas funcionalidades existem no painel web mas **ainda não foram implementadas no app**:

| # | Funcionalidade | Prioridade sugerida |
|---|---|---|
| 1 | **Avaliações** — listagem de notas e comentários dos clientes | Alta |
| 2 | **Chat WhatsApp** — lista de conversas e histórico por cliente | Alta |
| 3 | **Exportar CSV** — clientes, financeiro e estoque | Média |
| 4 | **Página do Cliente → URL e QR Code** — link de agendamento, QR, compartilhar | Alta |
| 5 | **Página do Cliente → Domínio customizado** | Baixa |
| 6 | **Página do Cliente → Rastreamento (GA4/Pixel)** | Baixa |
| 7 | **Página do Cliente → SEO** | Baixa |
| 8 | **Página do Cliente → Preview (iframe)** | Baixa |

---

## Funcionalidades Exclusivas do App (2 itens)

Estas funcionalidades existem no app mas **ainda não foram implementadas no web**:

| # | Funcionalidade | Prioridade sugerida |
|---|---|---|
| 1 | **Minhas Comissões** — visão do barbeiro sobre suas próprias comissões do mês | Alta |
| 2 | **Seletor de Tema** — alternar entre claro, escuro e sistema | Média |

---

## Áreas com Paridade Parcial (requerem atenção)

| Área | Diferença |
|---|---|
| **Página do Cliente** | O app tem apenas a tela de aparência (cor + banner). O web tem 6 abas completas (URL, Visual, Domínio, Rastreamento, SEO, Preview). |
| **Clientes → Detalhe** | O web tem uma página dedicada com histórico completo. O app usa um modal lateral que pode ter menos informações. |

---

## Recomendação de Implementação

Para atingir paridade completa, sugere-se a seguinte ordem de prioridade:

1. **Avaliações no app** — tela de listagem de avaliações com nota, comentário, serviço e data
2. **URL e QR Code no app** — tela dentro de "Barbearia" ou "Configurações" com link de agendamento, QR Code e botão de copiar/compartilhar
3. **Minhas Comissões no web** — seção no painel web para barbeiros (não super_admin) visualizarem suas comissões
4. **Chat WhatsApp no app** — lista de conversas e histórico por cliente
5. **Seletor de Tema no web** — já existe como preferência do sistema via CSS, mas não há seletor manual
6. **Exportações CSV no app** — compartilhar arquivo CSV via sistema nativo do dispositivo
