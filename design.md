# Barber Pro — Design Document

## Identidade Visual

**Nome:** Barber Pro  
**Paleta:** Preto, branco e dourado como acento  
**Tipografia:** Sans-serif moderna (System font)  
**Estilo:** Elegante, minimalista, premium

### Cores
- `primary`: #C9A84C (dourado)
- `background`: #0A0A0A (preto profundo)
- `surface`: #1A1A1A (cinza escuro)
- `foreground`: #F5F5F5 (branco suave)
- `muted`: #888888 (cinza médio)
- `border`: #2A2A2A (cinza escuro)
- `success`: #4CAF50
- `warning`: #FF9800
- `error`: #F44336

---

## Hierarquia de Usuários

| Papel | Acesso |
|---|---|
| **Super Admin** | Tudo — gerencia barbeiros, configurações globais, financeiro completo |
| **Barbeiro** | Sua própria agenda, serviços, clientes, financeiro próprio |
| **Recepcionista** | Agendamentos, clientes, sem acesso financeiro |
| **Cliente** | App do cliente — agendamentos, compras, histórico, pontos |

---

## Telas do Painel Administrativo

### 1. Login / Autenticação
- Tela de login com email/senha
- Redirecionamento por papel após login

### 2. Dashboard (Home Admin)
- Resumo do dia: agendamentos, faturamento, clientes atendidos
- Gráfico de faturamento semanal/mensal
- Próximos agendamentos do dia
- Alertas e notificações

### 3. Agenda
- Visão de calendário (dia/semana/mês)
- Blocos de horário por barbeiro
- Criação/edição de agendamentos
- Bloqueio de horários (folga, intervalo)
- Indicador de conflito de horários

### 4. Serviços
- Lista de serviços cadastrados
- Formulário: nome, descrição, preço, duração, fotos/vídeos
- Ativar/desativar serviços
- Categorias de serviços

### 5. Produtos
- Lista de produtos cadastrados
- Formulário: nome, descrição, preço, estoque, fotos/vídeos
- Controle de estoque
- Categorias de produtos

### 6. Clientes
- Lista de clientes com busca
- Perfil do cliente: dados, histórico de cortes, pontos, compras
- Adicionar/editar clientes manualmente

### 7. Barbeiros / Equipe
- Lista de barbeiros cadastrados
- Perfil: nome, foto, especialidades, horário de trabalho
- Gerenciar permissões por papel

### 8. Financeiro
- Resumo: receita, despesas, lucro líquido
- Registro de vendas (serviços + produtos)
- Registro de despesas
- Relatórios por período
- Integração Mercado Pago (presencial e online)
- Gráficos de desempenho

### 9. Fidelidade & Promoções
- Configurar sistema de pontos (regras, recompensas)
- Criar/gerenciar cupons de desconto
- Histórico de resgates

### 10. Configurações
- Dados da barbearia (nome, endereço, foto, horário de funcionamento)
- Configurações de WhatsApp para notificações
- Configurações de pagamento (Mercado Pago)
- Gerenciar usuários do sistema

---

## Telas do App do Cliente

### 1. Onboarding / Login
- Tela de boas-vindas
- Cadastro/login por email ou redes sociais

### 2. Home do Cliente
- Destaques e promoções
- Serviços em destaque
- Botão rápido de agendamento

### 3. Serviços
- Listagem de todos os serviços com fotos e preços
- Detalhe do serviço com galeria

### 4. Produtos (Loja)
- Listagem de produtos com fotos e preços
- Detalhe do produto
- Carrinho e checkout com Mercado Pago

### 5. Agendamento
- Seleção de serviço → barbeiro → data → horário
- Confirmação com resumo
- Confirmação enviada por WhatsApp

### 6. Meus Agendamentos
- Próximos agendamentos
- Histórico de agendamentos passados

### 7. Meu Perfil
- Dados pessoais
- Meus pontos de fidelidade
- Meus cupons
- Histórico de cortes

---

## Fluxos Principais

### Fluxo de Agendamento (Cliente)
1. Cliente acessa "Agendar"
2. Seleciona serviço desejado
3. Seleciona barbeiro (ou "qualquer disponível")
4. Seleciona data no calendário
5. Visualiza horários disponíveis (baseado na duração do serviço)
6. Confirma agendamento
7. Recebe confirmação via WhatsApp
8. 1 hora antes: recebe lembrete via WhatsApp

### Fluxo Financeiro (Admin)
1. Atendimento concluído → registrar venda
2. Selecionar serviços/produtos realizados
3. Aplicar desconto/cupom se houver
4. Processar pagamento (Mercado Pago ou manual)
5. Venda registrada no financeiro
6. Dashboard atualizado em tempo real

### Fluxo de Fidelidade
1. Admin configura: "A cada R$ 50 gastos = 10 pontos"
2. Admin configura recompensa: "500 pontos = 1 corte grátis"
3. Cliente realiza serviços → acumula pontos automaticamente
4. Cliente resgata pontos na tela de perfil
5. Admin valida resgate no painel
