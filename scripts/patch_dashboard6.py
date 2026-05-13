#!/usr/bin/env python3
"""
Patch: três melhorias no dashboard admin web
1. Card "Próximo agendamento"
2. Meta diária de faturamento com barra de progresso
3. Ícone sol/lua na topbar com persistência melhorada
"""

with open('/home/ubuntu/barber_app/server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# ─── 1. Ícone sol/lua na topbar ─────────────────────────────────────────────
# Adicionar botão de tema com SVG dinâmico antes do avatar na topbar
OLD_TOPBAR = '        <div class="topbar-avatar" title="${esc(barberName)}">${initials}</div>'
NEW_TOPBAR = '''        <button id="theme-toggle-btn" onclick="toggleTheme()" title="Alternar tema" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:6px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:color 0.2s,background 0.2s;" onmouseover="this.style.background='var(--surface2)';this.style.color='var(--gold)'" onmouseout="this.style.background='none';this.style.color='var(--muted)'">
          <svg id="theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg id="theme-icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <div class="topbar-avatar" title="${esc(barberName)}">${initials}</div>'''

if OLD_TOPBAR in content:
    content = content.replace(OLD_TOPBAR, NEW_TOPBAR, 1)
    print("✓ Botão sol/lua adicionado na topbar")
else:
    print("✗ ERRO: topbar-avatar não encontrado")

# Atualizar a função toggleTheme para também atualizar o ícone
OLD_TOGGLE = '''    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('bp_theme', next);
    }'''
NEW_TOGGLE = '''    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('bp_theme', next);
      updateThemeIcon(next);
    }
    function updateThemeIcon(theme) {
      var sun = document.getElementById('theme-icon-sun');
      var moon = document.getElementById('theme-icon-moon');
      if (!sun || !moon) return;
      if (theme === 'dark') { sun.style.display = 'block'; moon.style.display = 'none'; }
      else { sun.style.display = 'none'; moon.style.display = 'block'; }
    }
    // Inicializar ícone ao carregar
    (function() {
      var t = localStorage.getItem('bp_theme') || 'dark';
      var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      updateThemeIcon(isDark ? 'dark' : 'light');
    })();'''

if OLD_TOGGLE in content:
    content = content.replace(OLD_TOGGLE, NEW_TOGGLE, 1)
    print("✓ toggleTheme atualizado com ícone dinâmico")
else:
    print("✗ ERRO: toggleTheme não encontrado")

# ─── 2. Meta diária — adicionar campo no schema ──────────────────────────────
OLD_SCHEMA_FIELD = '  backgroundColor: varchar("backgroundColor", { length: 20 }).default("#0A0A0A"),'
NEW_SCHEMA_FIELD = '''  backgroundColor: varchar("backgroundColor", { length: 20 }).default("#0A0A0A"),
  dailyGoal: integer("dailyGoal").default(0),'''

if OLD_SCHEMA_FIELD in content:
    print("✗ Schema não está no admin-routes.ts (esperado no drizzle/schema.ts)")
else:
    print("ℹ Schema está no drizzle/schema.ts — será editado separadamente")

# ─── 3. Card Próximo Agendamento — calcular no renderDashboard ───────────────
# Inserir cálculo do próximo agendamento após o carregamento de appointments
OLD_APPT_LOAD = '''  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);
  const barbers = await db.getAllBarbers(tenantId);'''
NEW_APPT_LOAD = '''  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);
  // ─── Próximo agendamento do dia ───────────────────────────────────────────
  const nowMinutes = (() => {
    const now = new Date();
    // Ajustar para horário de Brasília (UTC-3)
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return brt.getUTCHours() * 60 + brt.getUTCMinutes();
  })();
  const nextAppointment = appointments
    .filter((a: any) => {
      if (!a.startTime) return false;
      const [h, m] = a.startTime.split(':').map(Number);
      return (h * 60 + m) >= nowMinutes && ['scheduled', 'confirmed'].includes(a.status);
    })
    .sort((a: any, b: any) => {
      const [ah, am] = a.startTime.split(':').map(Number);
      const [bh, bm] = b.startTime.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    })[0] ?? null;
  const barbers = await db.getAllBarbers(tenantId);'''

if OLD_APPT_LOAD in content:
    content = content.replace(OLD_APPT_LOAD, NEW_APPT_LOAD, 1)
    print("✓ Cálculo do próximo agendamento adicionado")
else:
    print("✗ ERRO: bloco de carregamento de appointments não encontrado")

# ─── 4. Buscar meta diária e settings no renderDashboard ────────────────────
OLD_DASH_SETTINGS = '''  // Buscar slug para o card de link de agendamento
  const dashTenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;'''
NEW_DASH_SETTINGS = '''  // Buscar slug e settings para o card de link e meta diária
  const dashSettings = await db.getShopSettings(tenantId).catch(() => null);
  const dailyGoal = dashSettings?.dailyGoal ?? 0;
  const dashTenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;'''

if OLD_DASH_SETTINGS in content:
    content = content.replace(OLD_DASH_SETTINGS, NEW_DASH_SETTINGS, 1)
    print("✓ Busca de meta diária adicionada")
else:
    print("✗ ERRO: bloco de busca de slug não encontrado")

# ─── 5. Card Faturamento com barra de progresso ──────────────────────────────
# Localizar o card de faturamento para adicionar a barra de progresso
OLD_REVENUE_CARD = '''      <div class="metric-card" style="--delay:60ms" title="Ontem: R$ ${(statsYesterday.revenueToday/100).toFixed(2).replace('.',',')} · ${revDiff}">
        <div class="metric-header">
          <span class="metric-label">FATURAMENTO HOJE</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="metric-value" style="color:var(--gold)">R$ ${(stats.revenueToday/100).toFixed(2).replace(".", ",")}</div>
        <div class="metric-sub">vendas pagas</div>
      </div>'''

NEW_REVENUE_CARD = '''      <div class="metric-card" style="--delay:60ms" title="Ontem: R$ ${(statsYesterday.revenueToday/100).toFixed(2).replace('.',',')} · ${revDiff}">
        <div class="metric-header">
          <span class="metric-label">FATURAMENTO HOJE</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="metric-value" style="color:var(--gold)">R$ ${(stats.revenueToday/100).toFixed(2).replace(".", ",")}</div>
        ${dailyGoal > 0 ? (() => {
          const pct = Math.min(100, Math.round((stats.revenueToday / dailyGoal) * 100));
          const goalFmt = (dailyGoal/100).toFixed(2).replace('.', ',');
          const barColor = pct >= 100 ? '#22C55E' : pct >= 60 ? '#C9A84C' : '#EF4444';
          return `<div style="margin-top:6px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:10px;color:var(--muted)">Meta: R$ ${goalFmt}</span>
              <span style="font-size:10px;font-weight:700;color:${barColor}">${pct}%</span>
            </div>
            <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${barColor};border-radius:2px;transition:width 0.6s ease"></div>
            </div>
          </div>`;
        })() : '<div class="metric-sub">vendas pagas</div>'}
      </div>'''

if OLD_REVENUE_CARD in content:
    content = content.replace(OLD_REVENUE_CARD, NEW_REVENUE_CARD, 1)
    print("✓ Barra de progresso da meta adicionada no card de faturamento")
else:
    print("✗ ERRO: card de faturamento não encontrado — tentando padrão alternativo")
    # Tentar padrão alternativo
    alt_old = 'FATURAMENTO HOJE'
    if alt_old in content:
        print(f"  ℹ 'FATURAMENTO HOJE' encontrado no arquivo — verificar manualmente")

# ─── 6. Card Próximo Agendamento no HTML ─────────────────────────────────────
# Inserir o card após os KPI cards e antes da Agenda de Hoje
OLD_AGENDA_SECTION = '    <!-- Agenda de Hoje -->'
NEXT_APPT_CARD = '''    <!-- Card: Próximo Agendamento -->
    ${nextAppointment ? (() => {
      const clientName = (nextAppointment as any).clientName ?? clientMap[(nextAppointment as any).clientId] ?? 'Cliente';
      const serviceName = (nextAppointment as any).serviceName ?? serviceMap[(nextAppointment as any).serviceId] ?? 'Serviço';
      const barberName2 = barberMap[(nextAppointment as any).barberId] ?? '';
      const startTime = (nextAppointment as any).startTime ?? '';
      const timeFormatted = startTime ? startTime.substring(0, 5) : '';
      const statusColor = (nextAppointment as any).status === 'confirmed' ? '#22C55E' : '#C9A84C';
      const statusLabel = (nextAppointment as any).status === 'confirmed' ? 'Confirmado' : 'Agendado';
      return `<div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border:1px solid rgba(201,168,76,0.3);border-radius:16px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;gap:20px;box-shadow:0 4px 24px rgba(0,0,0,0.3);position:relative;overflow:hidden">
        <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,rgba(201,168,76,0.08) 0%,transparent 70%);pointer-events:none"></div>
        <div style="width:52px;height:52px;background:rgba(201,168,76,0.15);border:2px solid rgba(201,168,76,0.4);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px">Próximo Agendamento</span>
            <span style="font-size:10px;font-weight:700;color:${statusColor};background:${statusColor}22;border:1px solid ${statusColor}44;border-radius:4px;padding:1px 6px">${statusLabel}</span>
          </div>
          <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${clientName}</div>
          <div style="font-size:13px;color:var(--muted)">${serviceName}${barberName2 ? ' · ' + barberName2 : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:28px;font-weight:900;color:#C9A84C;line-height:1">${timeFormatted}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">hoje</div>
        </div>
      </div>`;
    })() : ''}
    <!-- Agenda de Hoje -->'''

if OLD_AGENDA_SECTION in content:
    content = content.replace(OLD_AGENDA_SECTION, NEXT_APPT_CARD, 1)
    print("✓ Card Próximo Agendamento adicionado antes da Agenda de Hoje")
else:
    print("✗ ERRO: '<!-- Agenda de Hoje -->' não encontrado")

with open('/home/ubuntu/barber_app/server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nPatch concluído!")
