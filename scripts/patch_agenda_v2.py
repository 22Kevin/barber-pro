#!/usr/bin/env python3
"""
Cirurgical patch: redesign the Agenda page layout in admin-routes.ts.
Only replaces specific sections, preserving all appointment cards and modals.
"""

with open('/home/ubuntu/barber_app/server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── PATCH 1: Replace the calendarHtml container (width 280px → full width with bigger cells) ───
old_cal_container = '    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px;width:280px;flex-shrink:0;">'
new_cal_container = '    <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px 18px;width:100%;">'
assert old_cal_container in content, "PATCH 1 marker not found"
content = content.replace(old_cal_container, new_cal_container, 1)

# ─── PATCH 2: Replace month header (old style → new modern style) ───
old_month_header = '''      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <a href="/admin/agenda?date=${prevMonthStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" style="text-decoration:none;color:var(--primary);padding:6px;border-radius:8px;display:flex;align-items:center;" title="Mês anterior">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </a>
        <span style="font-size:15px;font-weight:700;color:var(--foreground);">${monthNames[calMonth]} ${calYear}</span>
        <a href="/admin/agenda?date=${nextMonthStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" style="text-decoration:none;color:var(--primary);padding:6px;border-radius:8px;display:flex;align-items:center;" title="Próximo mês">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>'''
new_month_header = '''      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <a href="/admin/agenda?date=${prevMonthStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" style="text-decoration:none;color:var(--primary);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(201,168,76,0.1);transition:background .15s;" onmouseover="this.style.background='rgba(201,168,76,0.2)'" onmouseout="this.style.background='rgba(201,168,76,0.1)'" title="Mês anterior">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </a>
        <div style="text-align:center;">
          <div style="font-size:17px;font-weight:800;color:var(--foreground);letter-spacing:-0.3px;">${monthNames[calMonth]}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:500;">${calYear}</div>
        </div>
        <a href="/admin/agenda?date=${nextMonthStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" style="text-decoration:none;color:var(--primary);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(201,168,76,0.1);transition:background .15s;" onmouseover="this.style.background='rgba(201,168,76,0.2)'" onmouseout="this.style.background='rgba(201,168,76,0.1)'" title="Próximo mês">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>'''
assert old_month_header in content, "PATCH 2 marker not found"
content = content.replace(old_month_header, new_month_header, 1)

# ─── PATCH 3: Day labels (bigger, uppercase) ───
old_day_labels = '      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">\n        ${dayLabels.map(d => `<div style="text-align:center;font-size:11px;font-weight:600;color:var(--muted);padding:4px 0;">${d}</div>`).join("")}\n      </div>'
new_day_labels = '      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:8px;">\n        ${dayLabels.map(d => `<div style="text-align:center;font-size:10px;font-weight:700;color:var(--muted);padding:6px 0;text-transform:uppercase;letter-spacing:0.5px;">${d}</div>`).join("")}\n      </div>'
assert old_day_labels in content, "PATCH 3 marker not found"
content = content.replace(old_day_labels, new_day_labels, 1)

# ─── PATCH 4: Calendar grid gap and cell styles ───
old_cal_grid = '      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">'
new_cal_grid = '      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">'
assert old_cal_grid in content, "PATCH 4 marker not found"
content = content.replace(old_cal_grid, new_cal_grid, 1)

# ─── PATCH 5: Calendar cell styles (bigger, more modern) ───
old_cell = "return `<a href=\"/admin/agenda?date=${d}${filterBarberId ? '&barberId=' + filterBarberId : ''}\" style=\"text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;aspect-ratio:1;border-radius:8px;font-size:13px;font-weight:${isSelected || isToday ? '700' : '500'};color:${isSelected ? '#0A0A0A' : isToday ? 'var(--primary)' : 'var(--foreground)'};background:${isSelected ? 'var(--primary)' : 'transparent'};border:${isToday && !isSelected ? '1px solid var(--primary)' : '1px solid transparent'};transition:background .15s;\">${dayNum}<span style=\"width:5px;height:5px;border-radius:50%;background:${isSelected ? '#0A0A0A' : 'var(--primary)'};margin-top:2px;opacity:${datesWithAppointments.has(d) && !isSelected ? '1' : isSelected && datesWithAppointments.has(d) ? '0.6' : '0'};display:block;\"></span></a>`;"
new_cell = "return `<a href=\"/admin/agenda?date=${d}${filterBarberId ? '&barberId=' + filterBarberId : ''}\" style=\"text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;aspect-ratio:1;border-radius:10px;font-size:14px;font-weight:${isSelected || isToday ? '800' : '500'};color:${isSelected ? '#0A0A0A' : isToday ? 'var(--primary)' : 'var(--foreground)'};background:${isSelected ? 'var(--primary)' : isToday ? 'rgba(201,168,76,0.12)' : 'transparent'};border:${isToday && !isSelected ? '1.5px solid var(--primary)' : '1.5px solid transparent'};transition:all .15s;\" onmouseover=\"if(this.style.background!='var(--primary)')this.style.background='rgba(201,168,76,0.08)'\" onmouseout=\"if(this.style.background!='var(--primary)')this.style.background='${isSelected ? 'var(--primary)' : isToday ? 'rgba(201,168,76,0.12)' : 'transparent'}'\">${dayNum}<span style=\"width:5px;height:5px;border-radius:50%;background:${isSelected ? 'rgba(10,10,10,0.6)' : 'var(--primary)'};margin-top:3px;opacity:${datesWithAppointments.has(d) ? '1' : '0'};display:block;\"></span></a>`;"
assert old_cell in content, "PATCH 5 marker not found"
content = content.replace(old_cell, new_cell, 1)

# ─── PATCH 6: Body header (bigger, with accent bar) ───
old_header = '''    <!-- Header da Agenda -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
      <div>
        <h1 style="font-size:22px;font-weight:800;color:var(--foreground);margin:0;">${fmtDate(dateStr)}</h1>
        <p style="font-size:13px;color:var(--muted);margin:4px 0 0;">${appointments.length} agendamento(s)${filterSearch || filterBarberId ? " — filtrado" : ""}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button onclick="document.getElementById('planModal').style.display='flex'" style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='rgba(201,168,76,0.1)'" onmouseout="this.style.background='transparent'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Plano
        </button>
        <button type="button" onclick="document.getElementById('newApptModal').style.display='flex'" style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;background:var(--primary);color:#0A0A0A;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .15s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Novo
        </button>
      </div>
    </div>'''
new_header = '''    <!-- Header moderno da Agenda -->
    <style>
      .agenda-page { display:grid; grid-template-columns: 340px 1fr; gap:28px; align-items:flex-start; }
      @media(max-width:960px){ .agenda-page{ grid-template-columns:1fr; } }
      .agenda-left-panel { display:flex; flex-direction:column; gap:16px; }
      .agenda-panel-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:18px; }
      .agenda-appt-card-new { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px 18px; cursor:pointer; transition:border-color .15s, box-shadow .15s, transform .1s; display:flex; align-items:center; gap:14px; }
      .agenda-appt-card-new:hover { border-color:rgba(201,168,76,0.5); box-shadow:0 4px 20px rgba(0,0,0,0.25); transform:translateY(-1px); }
      .agenda-day-nav-link { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border:1px solid var(--border); border-radius:10px; text-decoration:none; color:var(--foreground); background:var(--background); transition:all .15s; }
      .agenda-day-nav-link:hover { border-color:var(--primary); color:var(--primary); background:rgba(201,168,76,0.08); }
      .agenda-today-link { display:block; text-align:center; padding:9px; background:var(--background); border:1px solid var(--border); border-radius:12px; text-decoration:none; color:var(--muted); font-size:12px; font-weight:700; transition:all .15s; letter-spacing:0.3px; }
      .agenda-today-link:hover { border-color:var(--primary); color:var(--primary); }
      .agenda-view-toggle { display:flex; gap:4px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:4px; width:fit-content; margin-bottom:18px; }
      .agenda-view-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; border:none; }
      .agenda-filter-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:18px; }
      .agenda-filter-bar select, .agenda-filter-bar input[type=text] { padding:9px 14px; background:var(--surface); border:1px solid var(--border); border-radius:12px; color:var(--foreground); font-size:13px; transition:border-color .15s; }
      .agenda-filter-bar select:focus, .agenda-filter-bar input[type=text]:focus { outline:none; border-color:var(--primary); }
    </style>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <div style="width:4px;height:30px;background:var(--primary);border-radius:2px;flex-shrink:0;"></div>
          <h1 style="font-size:28px;font-weight:900;color:var(--foreground);margin:0;letter-spacing:-0.5px;">${fmtDate(dateStr)}</h1>
        </div>
        <p style="font-size:13px;color:var(--muted);margin:0 0 0 14px;">${appointments.length === 0 ? 'Nenhum agendamento' : appointments.length + ' agendamento' + (appointments.length !== 1 ? 's' : '')}${filterSearch || filterBarberId ? " — filtrado" : ""}</p>
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
    </div>'''
assert old_header in content, "PATCH 6 marker not found"
content = content.replace(old_header, new_header, 1)

# ─── PATCH 7: Two-panel layout container ───
old_layout = '    <div style="display:flex;gap:20px;align-items:flex-start;">\n\n      <!-- Painel esquerdo: calendário + navegação de dia -->\n      <div style="display:flex;flex-direction:column;gap:12px;flex-shrink:0;">'
new_layout = '    <div class="agenda-page">\n\n      <!-- Painel esquerdo: calendário + navegação de dia -->\n      <div class="agenda-left-panel">'
assert old_layout in content, "PATCH 7 marker not found"
content = content.replace(old_layout, new_layout, 1)

# ─── PATCH 8: Day navigation panel (old → new modern) ───
old_day_nav = '''        <!-- Navegação de dia -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <a href="/admin/agenda?date=${prevDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--foreground);background:var(--background);font-size:16px;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">‹</a>
            <input type="date" value="${dateStr}" onchange="location.href='/admin/agenda?date='+this.value+'${filterBarberId ? '&barberId=' + filterBarberId : ''}'"
              style="flex:1;padding:7px 10px;background:var(--background);border:1px solid var(--border);border-radius:8px;color:var(--foreground);font-size:13px;text-align:center;" />
            <a href="/admin/agenda?date=${nextDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--foreground);background:var(--background);font-size:16px;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">›</a>
          </div>
          <a href="/admin/agenda?date=${todayStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" style="display:block;text-align:center;padding:7px;background:var(--background);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--muted);font-size:12px;font-weight:600;transition:color .15s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--muted)'">Hoje</a>
        </div>
      </div>'''
new_day_nav = '''        <!-- Navegação de dia -->
        <div class="agenda-panel-card" style="padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <a href="/admin/agenda?date=${prevDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" class="agenda-day-nav-link" title="Dia anterior">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </a>
            <input type="date" value="${dateStr}" onchange="location.href='/admin/agenda?date='+this.value+'${filterBarberId ? '&barberId=' + filterBarberId : ''}'"
              style="flex:1;padding:8px 12px;background:var(--background);border:1px solid var(--border);border-radius:10px;color:var(--foreground);font-size:13px;text-align:center;font-weight:600;" />
            <a href="/admin/agenda?date=${nextDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" class="agenda-day-nav-link" title="Próximo dia">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
          <a href="/admin/agenda?date=${todayStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" class="agenda-today-link">📅 Ir para Hoje</a>
        </div>
      </div>'''
assert old_day_nav in content, "PATCH 8 marker not found"
content = content.replace(old_day_nav, new_day_nav, 1)

# ─── PATCH 9: Right panel container ───
old_right_panel = '      <!-- Painel direito: filtros + lista de agendamentos -->\n      <div style="flex:1;min-width:0;">'
new_right_panel = '      <!-- Painel direito: filtros + lista de agendamentos -->\n      <div style="min-width:0;">'
assert old_right_panel in content, "PATCH 9 marker not found"
content = content.replace(old_right_panel, new_right_panel, 1)

# ─── PATCH 10: Filter form (modern style) ───
old_filter_form = '''        <!-- Filtros -->
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
        </form>'''
new_filter_form = '''        <!-- Filtros modernos -->
        <form method="GET" class="agenda-filter-bar">
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
        </form>'''
assert old_filter_form in content, "PATCH 10 marker not found"
content = content.replace(old_filter_form, new_filter_form, 1)

# ─── PATCH 11: View toggle (pill style) ───
old_toggle = '''        <!-- Toggle de vista -->
        <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
          <button type="button" id="btnViewCards" onclick="setView('cards')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--primary);color:#0A0A0A;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Cards
          </button>
          <button type="button" id="btnViewTimeline" onclick="setView('timeline')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--surface);color:var(--muted);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Linha do Tempo
          </button>
        </div>'''
new_toggle = '''        <!-- Toggle de vista (pill) -->
        <div class="agenda-view-toggle">
          <button type="button" id="btnViewCards" onclick="setView('cards')" class="agenda-view-btn" style="background:var(--primary);color:#0A0A0A;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Cards
          </button>
          <button type="button" id="btnViewTimeline" onclick="setView('timeline')" class="agenda-view-btn" style="background:transparent;color:var(--muted);">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Linha do Tempo
          </button>
        </div>'''
assert old_toggle in content, "PATCH 11 marker not found"
content = content.replace(old_toggle, new_toggle, 1)

# ─── PATCH 12: Appointment cards (add hover class + avatar) ───
old_appt_card_open = '''return `<div id="appt-card-${a.id}" onclick="openEditModal(${JSON.stringify({id:a.id,clientName:a.clientName??'',clientPhone:a.clientPhone??'',serviceId:a.serviceId,serviceName:serviceNames,barberId:a.barberId,barberName:a.barberName??'',date:a.date,startTime:a.startTime??'',endTime:a.endTime??'',status:a.status,notes:a.notes??''})})" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;cursor:pointer;transition:border-color .15s,box-shadow .15s;display:flex;align-items:center;gap:16px" onmouseover="this.style.borderColor='rgba(201,168,76,0.4)';this.style.boxShadow='0 2px 12px rgba(0,0,0,0.2)'" onmouseout="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
                  <!-- Horário -->
                  <div style="flex-shrink:0;text-align:center;min-width:52px">
                    <div style="font-size:18px;font-weight:800;color:var(--foreground);line-height:1">${a.startTime?.substring(0,5) ?? "—"}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:2px">${a.endTime?.substring(0,5) ?? ""}</div>
                  </div>
                  <!-- Barra colorida de status -->
                  <div style="width:3px;height:44px;border-radius:2px;background:${sc.text};flex-shrink:0"></div>
                  <!-- Info principal -->
                  <div style="flex:1;min-width:0">
                    <div style="font-size:14px;font-weight:700;color:var(--foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.clientName ?? "—")}</div>
                    <div style="font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(serviceNames)} · ${esc(a.barberName ?? "—")}</div>
                  </div>
                  <!-- Badge de status -->
                  <div style="flex-shrink:0;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${sc.bg};border:1px solid ${sc.border};color:${sc.text}">${sl}</div>
                  <!-- Seta -->
                  <div style="flex-shrink:0;color:var(--muted)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>`;'''
new_appt_card_open = '''const initials = (a.clientName ?? '?').split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase();
                return `<div id="appt-card-${a.id}" onclick="openEditModal(${JSON.stringify({id:a.id,clientName:a.clientName??'',clientPhone:a.clientPhone??'',serviceId:a.serviceId,serviceName:serviceNames,barberId:a.barberId,barberName:a.barberName??'',date:a.date,startTime:a.startTime??'',endTime:a.endTime??'',status:a.status,notes:a.notes??''})})" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px 18px;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .1s;display:flex;align-items:center;gap:14px;" onmouseover="this.style.borderColor='rgba(201,168,76,0.5)';this.style.boxShadow='0 4px 20px rgba(0,0,0,0.25)';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='var(--border)';this.style.boxShadow='none';this.style.transform='none'">
                  <!-- Horário -->
                  <div style="flex-shrink:0;text-align:center;min-width:52px;">
                    <div style="font-size:20px;font-weight:900;color:var(--foreground);line-height:1;letter-spacing:-0.5px;">${a.startTime?.substring(0,5) ?? "—"}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:3px;font-weight:500;">${a.endTime?.substring(0,5) ?? ""}</div>
                  </div>
                  <!-- Barra colorida de status -->
                  <div style="width:3px;height:48px;border-radius:2px;background:${sc.text};flex-shrink:0;"></div>
                  <!-- Avatar com inicial -->
                  <div style="width:42px;height:42px;border-radius:12px;background:${sc.bg};border:1px solid ${sc.border};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:${sc.text};flex-shrink:0;">${initials}</div>
                  <!-- Info principal -->
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:14px;font-weight:700;color:var(--foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.clientName ?? "—")}</div>
                    <div style="font-size:12px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(serviceNames)}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:2px;opacity:0.7;">${esc(a.barberName ?? "—")}</div>
                  </div>
                  <!-- Badge de status -->
                  <div style="flex-shrink:0;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${sc.bg};border:1px solid ${sc.border};color:${sc.text};white-space:nowrap;">${sl}</div>
                  <!-- Seta -->
                  <div style="flex-shrink:0;color:var(--muted);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>`;'''
assert old_appt_card_open in content, "PATCH 12 marker not found"
content = content.replace(old_appt_card_open, new_appt_card_open, 1)

# ─── PATCH 13: Empty state (bigger, more modern) ───
old_empty = '''<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--muted);font-size:14px">
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;opacity:0.3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               Nenhum agendamento para ${fmtDate(dateStr)}${filterSearch || filterBarberId ? " com os filtros aplicados" : ""}.
             </div>'''
new_empty = '''<div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:60px 40px;text-align:center;color:var(--muted);">
               <div style="width:72px;height:72px;border-radius:20px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               </div>
               <div style="font-size:16px;font-weight:700;color:var(--foreground);margin-bottom:8px;">Nenhum agendamento</div>
               <div style="font-size:13px;color:var(--muted);">Não há agendamentos para ${fmtDate(dateStr)}${filterSearch || filterBarberId ? " com os filtros aplicados" : ""}.</div>
               <button type="button" onclick="document.getElementById('newApptModal').style.display='flex'" style="margin-top:20px;display:inline-flex;align-items:center;gap:7px;padding:10px 22px;background:var(--primary);color:#0A0A0A;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">
                 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                 Criar Agendamento
               </button>
             </div>'''
assert old_empty in content, "PATCH 13 marker not found"
content = content.replace(old_empty, new_empty, 1)

# ─── PATCH 14: setView JS function (update for new CSS classes) ───
old_setview = '''          function setView(v) {
            document.getElementById('viewCards').style.display = v === 'cards' ? 'block' : 'none';
            document.getElementById('viewTimeline').style.display = v === 'timeline' ? 'block' : 'none';
            document.getElementById('btnViewCards').style.background = v === 'cards' ? 'var(--primary)' : 'var(--surface)';
            document.getElementById('btnViewCards').style.color = v === 'cards' ? '#0A0A0A' : 'var(--muted)';
            document.getElementById('btnViewCards').style.border = v === 'cards' ? 'none' : '1px solid var(--border)';
            document.getE'''
new_setview = '''          function setView(v) {
            document.getElementById('viewCards').style.display = v === 'cards' ? 'block' : 'none';
            document.getElementById('viewTimeline').style.display = v === 'timeline' ? 'block' : 'none';
            document.getElementById('btnViewCards').style.background = v === 'cards' ? 'var(--primary)' : 'transparent';
            document.getElementById('btnViewCards').style.color = v === 'cards' ? '#0A0A0A' : 'var(--muted)';
            document.getE'''
assert old_setview in content, "PATCH 14 marker not found"
content = content.replace(old_setview, new_setview, 1)

with open('/home/ubuntu/barber_app/server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"All patches applied successfully! File: {len(content)} chars")
