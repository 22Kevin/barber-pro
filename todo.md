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
- [ ] Tela de agendamento pelo cliente
- [ ] Visualização de serviços e produtos
- [ ] Histórico de cortes do cliente
- [ ] Compra de produtos
- [ ] Conta do cliente com pontos de fidelidade
