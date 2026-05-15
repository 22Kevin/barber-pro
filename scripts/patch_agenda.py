#!/usr/bin/env python3
"""Patch the agenda page layout in admin-routes.ts"""

import re

with open('/home/ubuntu/barber_app/server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Replace the body const (header + two-panel layout) ───────────────────
old_body_header = '''  const body = `
    <!-- Header da Agenda -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
      <div>
        <h1 style="font-size:22px;font-weight:800;color:var(--foreground);margin:0;">${fmtDate(dateStr)}</h1>
        <p style="font-size:13px;color:var(--muted);margin:4px 0 0;">${appointments.length} agendamento(s)${filterSearch || filterBarberId ? " — filtrado" : ""}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button onclick="document.getElementById(\'planModal\').style.display=\'flex\'" style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;" onmouseover="this.style.background=\'rgba(201,168,76,0.1)\'" onmouseout="this.style.background=\'transparent\'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Plano
        </button>
        <button type="button" onclick="document.getElementById(\'newApptModal\').style.display=\'flex\'" style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;background:var(--primary);color:#0A0A0A;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .15s;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Novo
        </button>
      </div>
    </div>

    <!-- Layout dois painéis -->
    <div style="display:flex;gap:20px;align-items:flex-start;">

      <!-- Painel esquerdo: calendário + navegação de dia -->
      <div style="display:flex;flex-direction:column;gap:12px;flex-shrink:0;">
        ${calendarHtml}
        <!-- Navegação de dia -->
     
            <a href="/admin/agenda?date=${prevDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--foreground);background:var(--background);font-size:16px;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--primary)\'" onmouseout="this.style.borderColor=\'var(--border)\'">‹</a>
            <input type="date" value="${dateStr}" onchange="location.href=\'/admin/agenda?date=\'+this.value+\'${filterBarberId ? \'&barberId=\' + filterBarberId : ""}\'"
              style="flex:1;padding:7px 10px;background:var(--background);border:1px solid var(--border);border-radius:8px;color:var(--foreground);font-size:13px;text-align:center;" />
            <a href="/admin/agenda?date=${nextDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--foreground);background:var(--background);font-size:16px;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--primary)\'" onmouseout="this.style.borderColor=\'var(--border)\'">›</a>
          </div>
          <a href="/admin/agenda?date=${todayStr}${filterBarberId ? \'&barberId=\' + filterBarberId : \'\'}" style="display:block;text-align:center;padding:7px;background:var(--background);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--muted);font-size:12px;font-weight:600;transition:color .15s;" onmouseover="this.style.color=\'var(--primary)\'" onmouseout="this.style.color=\'var(--muted)\'">Hoje</a>
        </div>
      </div>

      <!-- Painel direito: filtros + lista de agendamentos -->
      <div style="flex:1;min-width:0;">
        <!-- Filtros -->
        <form method="GET" style="display:flex;gap:10px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">
          <input type="hidden" name="date" value="${dateStr}" />
          <select name="barberId" onchange="this.form.submit()" style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--foreground);font-size:13px;min-width:120px;">
            <option value="">Todos os profissionais</option>
            ${barbers.map((b: any) => `<option value="${b.id}"${filterBarberId === b.id ? " selected" : ""}>${esc(b.name)}</option>`).join("")}
          </select>
          <div style="display:flex;flex:1;min-width:180px;gap:8px;">
            <input type="text" name="q" value="${esc(filterSearch)}" placeholder="Buscar por nome ou telefone..."
              style="flex:1;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--foreground);font-size:13px;" />
            <button type="submit" class="btn btn-primary" style="padding:8px 16px;font-size:13px;white-space:nowrap;">Buscar</button>
            ${filterSearch || filterBarberId ? `<a href="/admin/agenda?date=${dateStr}" class="btn btn-ghost" style="padding:8px 12px;font-size:13px;">Limpar</a>` : ""}
          </div>
        </form>
        <!-- Toggle de vista -->
        <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
          <button type="button" id="btnViewCards" onclick="setView(\'cards\')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--primary);color:#0A0A0A;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Cards
          </button>
          <button type="button" id="btnViewTimeline" onclick="setView(\'timeline\')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--surface);color:var(--muted);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Linha do Tempo
          </button>'''

# We'll use line-based replacement instead
print("Script loaded. Using line-based approach.")
print(f"File length: {len(content)} chars, {content.count(chr(10))} lines")

# Find the body const start
body_start = content.find('  const body = `\n    <!-- Header da Agenda -->')
print(f"body_start found at char: {body_start}")

# Find the end of the body const (before the planModalHtml reference)
body_end_marker = '    ${planModalHtml}'
body_end = content.find(body_end_marker, body_start)
print(f"body_end found at char: {body_end}")

if body_start == -1 or body_end == -1:
    print("ERROR: Could not find markers")
    exit(1)

# Extract what we need to keep after the replacement point
after_plan_modal = content[body_end:]

# Build the new body
new_body = '''  const body = `
    <style>
      .agenda-page { display:grid; grid-template-columns: 340px 1fr; gap:24px; align-items:flex-start; }
      @media(max-width:900px){ .agenda-page{ grid-template-columns:1fr; } }
      .agenda-left-panel { display:flex; flex-direction:column; gap:16px; position:sticky; top:20px; }
      .agenda-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:20px; }
      .agenda-appt-card { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px 18px; cursor:pointer; transition:border-color .15s, box-shadow .15s, transform .1s; display:flex; align-items:center; gap:14px; }
      .agenda-appt-card:hover { border-color:rgba(201,168,76,0.5); box-shadow:0 4px 20px rgba(0,0,0,0.25); transform:translateY(-1px); }
      .agenda-avatar { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; flex-shrink:0; }
      .agenda-time-block { text-align:center; min-width:50px; flex-shrink:0; }
      .agenda-status-pill { padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
      .agenda-view-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; }
      .agenda-filter-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .agenda-filter-bar select, .agenda-filter-bar input[type=text] { padding:9px 14px; background:var(--surface); border:1px solid var(--border); border-radius:12px; color:var(--foreground); font-size:13px; }
      .agenda-filter-bar select:focus, .agenda-filter-bar input[type=text]:focus { outline:none; border-color:var(--primary); }
      .agenda-day-nav { display:flex; align-items:center; gap:8px; }
      .agenda-day-nav a { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border:1px solid var(--border); border-radius:10px; text-decoration:none; color:var(--foreground); background:var(--background); transition:all .15s; }
      .agenda-day-nav a:hover { border-color:var(--primary); color:var(--primary); }
      .agenda-today-btn { display:block; text-align:center; padding:9px; background:var(--background); border:1px solid var(--border); border-radius:12px; text-decoration:none; color:var(--muted); font-size:12px; font-weight:700; transition:all .15s; letter-spacing:0.3px; }
      .agenda-today-btn:hover { border-color:var(--primary); color:var(--primary); }
    </style>

    <!-- Header moderno da Agenda -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <div style="width:4px;height:28px;background:var(--primary);border-radius:2px;flex-shrink:0;"></div>
          <h1 style="font-size:26px;font-weight:900;color:var(--foreground);margin:0;letter-spacing:-0.5px;">${fmtDate(dateStr)}</h1>
        </div>
        <p style="font-size:13px;color:var(--muted);margin:0 0 0 14px;padding-left:14px;">${appointments.length === 0 ? 'Nenhum agendamento' : appointments.length + ' agendamento' + (appointments.length !== 1 ? 's' : '')}${filterSearch || filterBarberId ? " — filtrado" : ""}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button onclick="document.getElementById('planModal').style.display='flex'" style="display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='rgba(201,168,76,0.1)'" onmouseout="this.style.background='transparent'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Plano
        </button>
        <button type="button" onclick="document.getElementById('newApptModal').style.display='flex'" style="display:inline-flex;align-items:center;gap:7px;padding:10px 22px;background:var(--primary);color:#0A0A0A;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;transition:opacity .15s;box-shadow:0 4px 16px rgba(201,168,76,0.3);" onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Novo Agendamento
        </button>
      </div>
    </div>

    <!-- Layout dois painéis modernos -->
    <div class="agenda-page">

      <!-- Painel esquerdo: calendário + navegação -->
      <div class="agenda-left-panel">
        <!-- Calendário grande -->
        ${calendarHtml}

        <!-- Navegação de dia -->
        <div class="agenda-card" style="padding:16px;">
          <div class="agenda-day-nav" style="margin-bottom:10px;">
            <a href="/admin/agenda?date=${prevDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" title="Dia anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </a>
            <input type="date" value="${dateStr}" onchange="location.href='/admin/agenda?date='+this.value+'${filterBarberId ? '&barberId=' + filterBarberId : ''}'"
              style="flex:1;padding:8px 12px;background:var(--background);border:1px solid var(--border);border-radius:10px;color:var(--foreground);font-size:13px;text-align:center;font-weight:600;" />
            <a href="/admin/agenda?date=${nextDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" title="Próximo dia">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
          <a href="/admin/agenda?date=${todayStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" class="agenda-today-btn">
            📅 Ir para Hoje
          </a>
        </div>
      </div>

      <!-- Painel direito: filtros + lista de agendamentos -->
      <div style="min-width:0;">
        <!-- Barra de filtros moderna -->
        <form method="GET" class="agenda-filter-bar" style="margin-bottom:18px;">
          <input type="hidden" name="date" value="${dateStr}" />
          <select name="barberId" onchange="this.form.submit()" style="min-width:180px;">
            <option value="">Todos os profissionais</option>
            ${barbers.map((b: any) => `<option value="${b.id}"${filterBarberId === b.id ? " selected" : ""}>${esc(b.name)}</option>`).join("")}
          </select>
          <div style="display:flex;flex:1;min-width:200px;gap:8px;">
            <input type="text" name="q" value="${esc(filterSearch)}" placeholder="Buscar por nome ou telefone..." style="flex:1;" />
            <button type="submit" class="btn btn-primary" style="padding:9px 18px;font-size:13px;white-space:nowrap;border-radius:12px;">Buscar</button>
            ${filterSearch || filterBarberId ? `<a href="/admin/agenda?date=${dateStr}" class="btn btn-ghost" style="padding:9px 14px;font-size:13px;border-radius:12px;">✕ Limpar</a>` : ""}
          </div>
        </form>

        <!-- Toggle de vista -->
        <div style="display:flex;gap:8px;margin-bottom:18px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:6px;width:fit-content;">
          <button type="button" id="btnViewCards" onclick="setView('cards')" class="agenda-view-btn" style="background:var(--primary);color:#0A0A0A;border:none;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Cards
          </button>
          <button type="button" id="btnViewTimeline" onclick="setView('timeline')" class="agenda-view-btn" style="background:transparent;color:var(--muted);border:none;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Linha do Tempo
          </button>'''

# Replace in content
before_body = content[:body_start]
new_content = before_body + new_body + '\n' + after_plan_modal

with open('/home/ubuntu/barber_app/server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Done! New file length: {len(new_content)} chars")
