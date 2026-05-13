#!/usr/bin/env python3
"""
Patch Dashboard Round 3:
1. Animação cascata fade-in nos 5 cards de Ações Rápidas
2. Buscar statsYesterday e adicionar tooltip com valor anterior + variação % nos KPI cards
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Adicionar função yesterday() logo após today() ───────────────────────
old_today = '''function today(): string {
  return new Date().toISOString().split("T")[0];
}'''

new_today = '''function today(): string {
  return new Date().toISOString().split("T")[0];
}
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}'''

if old_today in content:
    content = content.replace(old_today, new_today, 1)
    print('OK: função yesterday() adicionada')
else:
    print('ERRO: função today() não encontrada')

# ─── 2. Buscar statsYesterday logo após stats ─────────────────────────────────
old_stats = '  const stats = await db.getDashboardStats(dateStr, tenantId);\n  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);'
new_stats = '''  const stats = await db.getDashboardStats(dateStr, tenantId);
  const yesterdayStr = yesterday();
  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);'''

if old_stats in content:
    content = content.replace(old_stats, new_stats, 1)
    print('OK: statsYesterday adicionado ao renderDashboard')
else:
    print('ERRO: bloco stats não encontrado')

# ─── 3. Adicionar CSS de tooltip e animação das Ações Rápidas ─────────────────
old_metric_css = '    .metric-card:nth-child(4) { animation-delay: 180ms; }'
new_metric_css = '''    .metric-card:nth-child(4) { animation-delay: 180ms; }
    /* ── Tooltip KPI ── */
    .kpi-tooltip { position:relative; cursor:default; }
    .kpi-tooltip .kpi-tip {
      visibility:hidden; opacity:0; pointer-events:none;
      position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);
      background:#1e293b; border:1px solid rgba(201,168,76,0.3); border-radius:8px;
      padding:8px 12px; white-space:nowrap; font-size:12px; color:#e2e8f0;
      box-shadow:0 4px 16px rgba(0,0,0,0.4); z-index:100;
      transition:opacity .18s ease, visibility .18s ease;
    }
    .kpi-tooltip .kpi-tip::after {
      content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%);
      border:5px solid transparent; border-top-color:#1e293b;
    }
    .kpi-tooltip:hover .kpi-tip { visibility:visible; opacity:1; }
    /* ── Animação Ações Rápidas ── */
    @keyframes action-in {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .action-card { animation: action-in 0.3s ease both; }
    .action-card:nth-child(1) { animation-delay: 200ms; }
    .action-card:nth-child(2) { animation-delay: 250ms; }
    .action-card:nth-child(3) { animation-delay: 300ms; }
    .action-card:nth-child(4) { animation-delay: 350ms; }
    .action-card:nth-child(5) { animation-delay: 400ms; }'''

if old_metric_css in content:
    content = content.replace(old_metric_css, new_metric_css, 1)
    print('OK: CSS de tooltip e animação das Ações Rápidas adicionado')
else:
    print('ERRO: CSS metric-card nth-child(4) não encontrado')

# ─── 4. Adicionar classe action-card e tooltip nos KPI cards ─────────────────
# Função helper para gerar tooltip de variação
# Vamos substituir cada metric-card com tooltip inline usando template string

# Card 1: Agendamentos Hoje
old_card1 = '''      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-label">Agendamentos Hoje</div>
          <div class="metric-icon" style="background:var(--gold-dim)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:var(--gold)">${stats.appointmentsToday}</div>
        <div class="metric-sub">${stats.pendingAppointments} pendentes</div>
      </div>'''

new_card1 = '''      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${statsYesterday.appointmentsToday} agendamento${statsYesterday.appointmentsToday !== 1 ? 's' : ''} · ${stats.appointmentsToday === 0 && statsYesterday.appointmentsToday === 0 ? '—' : statsYesterday.appointmentsToday === 0 ? '↑ novo' : stats.appointmentsToday > statsYesterday.appointmentsToday ? '↑ +' + Math.round((stats.appointmentsToday - statsYesterday.appointmentsToday) / statsYesterday.appointmentsToday * 100) + '%' : stats.appointmentsToday < statsYesterday.appointmentsToday ? '↓ ' + Math.round((stats.appointmentsToday - statsYesterday.appointmentsToday) / statsYesterday.appointmentsToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Agendamentos Hoje</div>
          <div class="metric-icon" style="background:var(--gold-dim)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:var(--gold)">${stats.appointmentsToday}</div>
        <div class="metric-sub">${stats.pendingAppointments} pendentes</div>
      </div>'''

if old_card1 in content:
    content = content.replace(old_card1, new_card1, 1)
    print('OK: tooltip no card Agendamentos Hoje')
else:
    print('ERRO: card Agendamentos Hoje não encontrado')

# Card 2: Faturamento Hoje
old_card2 = '''      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-label">Faturamento Hoje</div>
          <div class="metric-icon" style="background:rgba(74,222,128,0.1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:var(--success)">${fmtCurrency(stats.revenueToday)}</div>
        <div class="metric-sub">vendas pagas</div>
      </div>'''

new_card2 = '''      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${fmtCurrency(statsYesterday.revenueToday)} · ${stats.revenueToday === 0 && statsYesterday.revenueToday === 0 ? '—' : statsYesterday.revenueToday === 0 ? '↑ novo' : stats.revenueToday > statsYesterday.revenueToday ? '↑ +' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : stats.revenueToday < statsYesterday.revenueToday ? '↓ ' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Faturamento Hoje</div>
          <div class="metric-icon" style="background:rgba(74,222,128,0.1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:var(--success)">${fmtCurrency(stats.revenueToday)}</div>
        <div class="metric-sub">vendas pagas</div>
      </div>'''

if old_card2 in content:
    content = content.replace(old_card2, new_card2, 1)
    print('OK: tooltip no card Faturamento Hoje')
else:
    print('ERRO: card Faturamento Hoje não encontrado')

# Card 3: Clientes Atendidos
old_card3 = '''      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-label">Clientes Atendidos</div>
          <div class="metric-icon" style="background:rgba(96,165,250,0.1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:var(--info)">${stats.clientsToday}</div>
        <div class="metric-sub">hoje</div>
      </div>'''

new_card3 = '''      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${statsYesterday.clientsToday} cliente${statsYesterday.clientsToday !== 1 ? 's' : ''} · ${stats.clientsToday === 0 && statsYesterday.clientsToday === 0 ? '—' : statsYesterday.clientsToday === 0 ? '↑ novo' : stats.clientsToday > statsYesterday.clientsToday ? '↑ +' + Math.round((stats.clientsToday - statsYesterday.clientsToday) / statsYesterday.clientsToday * 100) + '%' : stats.clientsToday < statsYesterday.clientsToday ? '↓ ' + Math.round((stats.clientsToday - statsYesterday.clientsToday) / statsYesterday.clientsToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Clientes Atendidos</div>
          <div class="metric-icon" style="background:rgba(96,165,250,0.1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:var(--info)">${stats.clientsToday}</div>
        <div class="metric-sub">hoje</div>
      </div>'''

if old_card3 in content:
    content = content.replace(old_card3, new_card3, 1)
    print('OK: tooltip no card Clientes Atendidos')
else:
    print('ERRO: card Clientes Atendidos não encontrado')

# ─── 5. Adicionar classe action-card nos 5 cards de Ações Rápidas ─────────────
# Substituir o estilo inline dos cards de ação para incluir a classe action-card
# Todos os 5 cards têm o mesmo padrão de estilo
old_action_style = 'style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;"'
new_action_style = 'class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;"'

count = content.count(old_action_style)
if count > 0:
    content = content.replace(old_action_style, new_action_style)
    print(f'OK: classe action-card adicionada em {count} cards de Ações Rápidas')
else:
    print('ERRO: estilo dos cards de Ações Rápidas não encontrado')

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Concluído.')
