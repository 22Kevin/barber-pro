#!/usr/bin/env python3
"""
Patch Dashboard Round 5:
1. Adicionar alternador Faturamento/Agendamentos no gráfico semanal
2. Reorganizar blocos do dashboard na ordem:
   KPI cards → Agenda → Gráficos → Ações Rápidas → Link de compartilhamento → Card baixar app
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── Localizar o início e fim do body do dashboard ───────────────────────────
body_start = '  const body = `\n    <div class="metrics-grid">'
body_end_marker = '  res.send(adminLayout("Dashboard", "dashboard", body, barber?.name, dashTenant?.plan ?? ""));'

idx_start = content.find(body_start)
idx_end = content.find(body_end_marker)

if idx_start == -1 or idx_end == -1:
    print(f'ERRO: marcadores não encontrados. start={idx_start}, end={idx_end}')
    exit(1)

# Extrair o body atual completo (da linha const body até o res.send)
old_body_block = content[idx_start:idx_end]

# ─── Construir o novo body na ordem correta ───────────────────────────────────
new_body = '''  const body = `
    <!-- 1. KPI Cards -->
    <div class="metrics-grid">
      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${statsYesterday.appointmentsToday} agendamento${statsYesterday.appointmentsToday !== 1 ? 's' : ''} · ${stats.appointmentsToday === 0 && statsYesterday.appointmentsToday === 0 ? '—' : statsYesterday.appointmentsToday === 0 ? '↑ novo' : stats.appointmentsToday > statsYesterday.appointmentsToday ? '↑ +' + Math.round((stats.appointmentsToday - statsYesterday.appointmentsToday) / statsYesterday.appointmentsToday * 100) + '%' : stats.appointmentsToday < statsYesterday.appointmentsToday ? '↓ ' + Math.round((stats.appointmentsToday - statsYesterday.appointmentsToday) / statsYesterday.appointmentsToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Agendamentos Hoje</div>
          <div class="metric-icon" style="background:var(--gold-dim)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:var(--gold)">${stats.appointmentsToday}</div>
        <div class="metric-sub">${stats.pendingAppointments} pendentes</div>
      </div>
      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${fmtCurrency(statsYesterday.revenueToday)} · ${stats.revenueToday === 0 && statsYesterday.revenueToday === 0 ? '—' : statsYesterday.revenueToday === 0 ? '↑ novo' : stats.revenueToday > statsYesterday.revenueToday ? '↑ +' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : stats.revenueToday < statsYesterday.revenueToday ? '↓ ' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Faturamento Hoje</div>
          <div class="metric-icon" style="background:rgba(74,222,128,.12)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:#4ADE80">${fmtCurrency(stats.revenueToday)}</div>
        <div class="metric-sub">vendas pagas</div>
      </div>
      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${statsYesterday.clientsToday} cliente${statsYesterday.clientsToday !== 1 ? 's' : ''} · ${stats.clientsToday === 0 && statsYesterday.clientsToday === 0 ? '—' : statsYesterday.clientsToday === 0 ? '↑ novo' : stats.clientsToday > statsYesterday.clientsToday ? '↑ +' + Math.round((stats.clientsToday - statsYesterday.clientsToday) / statsYesterday.clientsToday * 100) + '%' : stats.clientsToday < statsYesterday.clientsToday ? '↓ ' + Math.round((stats.clientsToday - statsYesterday.clientsToday) / statsYesterday.clientsToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Clientes Atendidos</div>
          <div class="metric-icon" style="background:rgba(96,165,250,.12)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:#60A5FA">${stats.clientsToday}</div>
        <div class="metric-sub">hoje</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-label">Equipe Ativa</div>
          <div class="metric-icon" style="background:rgba(251,191,36,.12)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:#FBBF24">${barbers.length}</div>
        <div class="metric-sub">profissionais</div>
      </div>
    </div>

    <!-- 2. Agenda de Hoje -->
    ${lowStockItems.length > 0 ? `
    <a href="/admin/estoque" style="text-decoration:none;display:flex;align-items:center;gap:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:12px;padding:14px 16px;margin-bottom:20px;transition:background .2s;" onmouseover="this.style.background='rgba(245,158,11,.14)'" onmouseout="this.style.background='rgba(245,158,11,.08)'">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#F59E0B;">${lowStockItems.length} produto${lowStockItems.length !== 1 ? 's' : ''} com estoque baixo</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${lowStockItems.slice(0,3).map((p: any) => p.name + ' (' + (p.stockQuantity ?? 0) + ')').join(' · ')}${lowStockItems.length > 3 ? ' · ...' : ''}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </a>` : ''}
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <div class="card-title">Agenda de Hoje &mdash; ${fmtDate(dateStr)}</div>
        <a href="/admin/agenda" class="btn btn-ghost btn-sm">Ver tudo</a>
      </div>
      <div class="card-body">${appointmentsHtml}</div>
    </div>

    <!-- 3. Gráfico de Faturamento/Agendamentos Semanal -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%);pointer-events:none;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--foreground);letter-spacing:0.3px;" id="chart-title">Faturamento — Últimos 7 dias</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;" id="chart-subtitle">Total do período: <span style="color:#C9A84C;font-weight:700;" id="chart-total">${fmtCurrency(totalWeekRevenue)}</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="btn-revenue" onclick="switchChart('revenue')" style="padding:6px 14px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid #C9A84C;background:#C9A84C;color:#0C0C0C;cursor:pointer;transition:all .2s;">Faturamento</button>
          <button id="btn-appointments" onclick="switchChart('appointments')" style="padding:6px 14px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .2s;">Agendamentos</button>
        </div>
      </div>
      <svg id="revenue-chart" viewBox="0 0 700 200" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;overflow:visible;" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#F5D78E" stop-opacity="1"/>
            <stop offset="100%" stop-color="#C9A84C" stop-opacity="0.7"/>
          </linearGradient>
          <linearGradient id="barGradAppt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#93C5FD" stop-opacity="1"/>
            <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.7"/>
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#C9A84C" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="areaGradAppt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
          </linearGradient>
          <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <style>
            .bar-rect { transform-origin: bottom; animation: bar-grow 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
            .bar-rect:nth-child(1) { animation-delay: 0ms; }
            .bar-rect:nth-child(2) { animation-delay: 80ms; }
            .bar-rect:nth-child(3) { animation-delay: 160ms; }
            .bar-rect:nth-child(4) { animation-delay: 240ms; }
            .bar-rect:nth-child(5) { animation-delay: 320ms; }
            .bar-rect:nth-child(6) { animation-delay: 400ms; }
            .bar-rect:nth-child(7) { animation-delay: 480ms; }
            @keyframes bar-grow { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
            .line-path { stroke-dasharray: 1000; stroke-dashoffset: 1000; animation: draw-line 1.2s ease 0.3s forwards; }
            @keyframes draw-line { to { stroke-dashoffset: 0; } }
            .area-path { opacity: 0; animation: fade-area 0.8s ease 0.8s forwards; }
            @keyframes fade-area { to { opacity: 1; } }
            .dot-point { opacity: 0; animation: pop-dot 0.3s ease both; }
            .dot-point:nth-child(1) { animation-delay: 0.9s; }
            .dot-point:nth-child(2) { animation-delay: 1.0s; }
            .dot-point:nth-child(3) { animation-delay: 1.1s; }
            .dot-point:nth-child(4) { animation-delay: 1.2s; }
            .dot-point:nth-child(5) { animation-delay: 1.3s; }
            .dot-point:nth-child(6) { animation-delay: 1.4s; }
            .dot-point:nth-child(7) { animation-delay: 1.5s; }
            @keyframes pop-dot { from { opacity:0; transform:scale(0); } to { opacity:1; transform:scale(1); } }
          </style>
        </defs>
        <!-- Grade horizontal -->
        ${[0.25, 0.5, 0.75, 1.0].map(pct => {
          const y = 160 - pct * 140;
          const val = maxRevenue * pct;
          return `<line x1="40" y1="${y}" x2="680" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,4"/>
          <text class="grid-label-rev" x="36" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--muted)">${val >= 1000 ? 'R$' + (val/1000).toFixed(1) + 'k' : 'R$' + val.toFixed(0)}</text>`;
        }).join('')}
        <!-- Barras -->
        <g id="bars-group">
          ${weekDays.map((d, i) => {
            const x = 40 + i * 92 + 18;
            const barW = 56;
            const barH = Math.max(d.revenue / maxRevenue * 140, d.revenue > 0 ? 4 : 0);
            const y = 160 - barH;
            const isToday = d.date === dateStr;
            return `<rect class="bar-rect" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" ry="6" fill="${isToday ? 'url(#barGrad)' : 'rgba(201,168,76,0.35)'}" data-rev="${d.revenue}" data-appt="0" />`;
          }).join('')}
        </g>
        <!-- Área sob a linha -->
        <path class="area-path" id="area-path" d="${(() => {
          const pts = weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0);
            return [cx, cy];
          });
          let path = `M ${pts[0][0]} 160 L ${pts[0][0]} ${pts[0][1]} `;
          for (let i = 1; i < pts.length; i++) {
            const cpx = (pts[i-1][0] + pts[i][0]) / 2;
            path += `C ${cpx} ${pts[i-1][1]} ${cpx} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]} `;
          }
          path += `L ${pts[pts.length-1][0]} 160 Z`;
          return path;
        })()}" fill="url(#areaGrad)"/>
        <!-- Linha de tendência -->
        <path class="line-path" id="line-path" d="${(() => {
          const pts = weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0);
            return [cx, cy];
          });
          let path = `M ${pts[0][0]} ${pts[0][1]} `;
          for (let i = 1; i < pts.length; i++) {
            const cpx = (pts[i-1][0] + pts[i][0]) / 2;
            path += `C ${cpx} ${pts[i-1][1]} ${cpx} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]} `;
          }
          return path;
        })()}" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Pontos na linha -->
        <g id="dots-group">
          ${weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0);
            return `<circle class="dot-point" cx="${cx}" cy="${cy}" r="4" fill="var(--surface)" stroke="#C9A84C" stroke-width="2"/>`;
          }).join('')}
        </g>
        <!-- Labels de valor -->
        <g id="labels-group">
          ${weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0) - 10;
            if (d.revenue === 0) return '';
            const label = d.revenue >= 1000 ? 'R$' + (d.revenue/1000).toFixed(1) + 'k' : 'R$' + d.revenue.toFixed(0);
            return `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="9" font-weight="700" fill="#C9A84C" opacity="0.9">${label}</text>`;
          }).join('')}
        </g>
        <!-- Labels dos dias -->
        ${weekDays.map((d, i) => {
          const cx = 40 + i * 92 + 18 + 28;
          const isToday = d.date === dateStr;
          return `<text x="${cx}" y="178" text-anchor="middle" font-size="11" font-weight="${isToday ? '700' : '500'}" fill="${isToday ? '#C9A84C' : 'var(--muted)'}">${d.label}</text>`;
        }).join('')}
        <!-- Linha base -->
        <line x1="40" y1="160" x2="680" y2="160" stroke="var(--border)" stroke-width="1"/>
      </svg>
      <script>
        // Dados do gráfico (injetados pelo servidor)
        var chartData = {
          revenue: [${weekDays.map(d => d.revenue).join(',')}],
          appointments: [${weekDays.map(d => d.appointmentsCount ?? 0).join(',')}],
          labels: [${weekDays.map(d => `"${d.label}"`).join(',')}],
          dates: [${weekDays.map(d => `"${d.date}"`).join(',')}],
          today: "${dateStr}"
        };
        var currentMode = 'revenue';
        function switchChart(mode) {
          if (mode === currentMode) return;
          currentMode = mode;
          var isRev = mode === 'revenue';
          // Atualizar botões
          document.getElementById('btn-revenue').style.background = isRev ? '#C9A84C' : 'transparent';
          document.getElementById('btn-revenue').style.color = isRev ? '#0C0C0C' : 'var(--muted)';
          document.getElementById('btn-revenue').style.borderColor = isRev ? '#C9A84C' : 'var(--border)';
          document.getElementById('btn-appointments').style.background = !isRev ? '#3B82F6' : 'transparent';
          document.getElementById('btn-appointments').style.color = !isRev ? '#fff' : 'var(--muted)';
          document.getElementById('btn-appointments').style.borderColor = !isRev ? '#3B82F6' : 'var(--border)';
          // Atualizar título e total
          var data = isRev ? chartData.revenue : chartData.appointments;
          var maxVal = Math.max.apply(null, data.concat([1]));
          var total = data.reduce(function(a,b){return a+b;},0);
          document.getElementById('chart-title').textContent = isRev ? 'Faturamento — Últimos 7 dias' : 'Agendamentos — Últimos 7 dias';
          var totalEl = document.getElementById('chart-total');
          totalEl.style.color = isRev ? '#C9A84C' : '#3B82F6';
          if (isRev) {
            var t = total >= 1000 ? 'R$ ' + (total/1000).toFixed(1) + 'k' : 'R$ ' + total.toFixed(2).replace('.',',');
            document.getElementById('chart-subtitle').innerHTML = 'Total do período: <span style="color:#C9A84C;font-weight:700;" id="chart-total">' + t + '</span>';
          } else {
            document.getElementById('chart-subtitle').innerHTML = 'Total do período: <span style="color:#3B82F6;font-weight:700;" id="chart-total">' + total + ' agendamento' + (total !== 1 ? 's' : '') + '</span>';
          }
          // Atualizar barras
          var bars = document.querySelectorAll('#bars-group rect');
          bars.forEach(function(bar, i) {
            var val = data[i] || 0;
            var barH = maxVal > 0 ? Math.max(val / maxVal * 140, val > 0 ? 4 : 0) : 0;
            var y = 160 - barH;
            var isToday = chartData.dates[i] === chartData.today;
            bar.setAttribute('y', y);
            bar.setAttribute('height', barH);
            bar.setAttribute('fill', isRev ? (isToday ? 'url(#barGrad)' : 'rgba(201,168,76,0.35)') : (isToday ? 'url(#barGradAppt)' : 'rgba(59,130,246,0.35)'));
          });
          // Atualizar linha e área
          var pts = data.map(function(val, i) {
            var cx = 40 + i * 92 + 18 + 28;
            var cy = maxVal > 0 ? 160 - Math.max(val / maxVal * 140, 0) : 160;
            return [cx, cy];
          });
          var linePath = 'M ' + pts[0][0] + ' ' + pts[0][1] + ' ';
          var areaPath = 'M ' + pts[0][0] + ' 160 L ' + pts[0][0] + ' ' + pts[0][1] + ' ';
          for (var i = 1; i < pts.length; i++) {
            var cpx = (pts[i-1][0] + pts[i][0]) / 2;
            linePath += 'C ' + cpx + ' ' + pts[i-1][1] + ' ' + cpx + ' ' + pts[i][1] + ' ' + pts[i][0] + ' ' + pts[i][1] + ' ';
            areaPath += 'C ' + cpx + ' ' + pts[i-1][1] + ' ' + cpx + ' ' + pts[i][1] + ' ' + pts[i][0] + ' ' + pts[i][1] + ' ';
          }
          areaPath += 'L ' + pts[pts.length-1][0] + ' 160 Z';
          document.getElementById('line-path').setAttribute('d', linePath);
          document.getElementById('line-path').style.stroke = isRev ? '#C9A84C' : '#3B82F6';
          document.getElementById('area-path').setAttribute('d', areaPath);
          document.getElementById('area-path').setAttribute('fill', isRev ? 'url(#areaGrad)' : 'url(#areaGradAppt)');
          // Atualizar pontos
          var dots = document.querySelectorAll('#dots-group circle');
          dots.forEach(function(dot, i) {
            var val = data[i] || 0;
            var cy = maxVal > 0 ? 160 - Math.max(val / maxVal * 140, 0) : 160;
            dot.setAttribute('cy', cy);
            dot.setAttribute('stroke', isRev ? '#C9A84C' : '#3B82F6');
          });
          // Atualizar labels
          var labelsG = document.getElementById('labels-group');
          labelsG.innerHTML = '';
          data.forEach(function(val, i) {
            if (val === 0) return;
            var cx = 40 + i * 92 + 18 + 28;
            var cy = maxVal > 0 ? 160 - Math.max(val / maxVal * 140, 0) - 10 : 150;
            var label = isRev ? (val >= 1000 ? 'R$' + (val/1000).toFixed(1) + 'k' : 'R$' + val.toFixed(0)) : val.toString();
            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', cx);
            text.setAttribute('y', cy);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '9');
            text.setAttribute('font-weight', '700');
            text.setAttribute('fill', isRev ? '#C9A84C' : '#3B82F6');
            text.setAttribute('opacity', '0.9');
            text.textContent = label;
            labelsG.appendChild(text);
          });
          // Atualizar grade
          var gridLabels = document.querySelectorAll('.grid-label-rev');
          gridLabels.forEach(function(el, i) {
            var pct = [0.25, 0.5, 0.75, 1.0][i];
            var val = maxVal * pct;
            el.textContent = isRev ? (val >= 1000 ? 'R$' + (val/1000).toFixed(1) + 'k' : 'R$' + val.toFixed(0)) : val.toFixed(0);
          });
        }
      </script>
    </div>

    <!-- 4. Ações Rápidas -->
    <div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">Ações Rápidas</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
        <a href="/admin/agenda/novo" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(201,168,76,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--foreground);text-align:center;">Novo Agendamento</span>
        </a>
        <a href="/admin/clientes?new=1" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(33,150,243,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--foreground);text-align:center;">Novo Cliente</span>
        </a>
        <a href="/admin/financeiro?new=1" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(76,175,80,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--foreground);text-align:center;">Nova Venda</span>
        </a>
        <a href="/admin/servicos" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(156,39,176,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9C27B0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3L8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--foreground);text-align:center;">Serviços</span>
        </a>
        <a href="/admin/promocoes" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(239,68,68,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--foreground);text-align:center;">Nova Promoção</span>
        </a>
      </div>
    </div>

    <!-- 5. Link de Agendamento -->
    ${dashBookingUrl ? `
    <div class="card" style="background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);border:1px solid var(--gold)44;margin-bottom:20px;">
      <div class="card-header">
        <div class="card-title">Link de Agendamento Online</div>
        <a href="/admin/pagina-cliente" class="btn btn-ghost btn-sm">Configurar página</a>
      </div>
      <div class="card-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Compartilhe este link com seus clientes para que eles possam agendar online:</p>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
          <input id="dash-booking-url" class="form-input" type="text" value="${esc(dashBookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
          <button onclick="(function(btn){navigator.clipboard.writeText(document.getElementById('dash-booking-url').value).then(()=>{var o=btn.innerHTML;btn.innerHTML='Copiado!';setTimeout(()=>btn.innerHTML=o,2000)});})(this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Copiar</button>
          <a href="${esc(dashBookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Abrir</a>
          <a href="https://wa.me/?text=${encodeURIComponent('Agende seu horário: ' + dashBookingUrl)}" target="_blank" class="btn btn-primary" style="flex-shrink:0;padding:8px 14px;font-size:12px">WhatsApp</a>
        </div>
        ${dashPublicUrl ? `
        <div style="margin-top:8px;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-weight:600;letter-spacing:0.3px;">PREVIEW DA SUA PÁGINA</div>
          <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border);position:relative;">
            <div style="background:var(--surface2);padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);">
              <div style="display:flex;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#EF4444;"></div><div style="width:10px;height:10px;border-radius:50%;background:#F59E0B;"></div><div style="width:10px;height:10px;border-radius:50%;background:#22C55E;"></div></div>
              <div style="flex:1;background:var(--surface);border-radius:6px;padding:4px 10px;font-size:10px;color:var(--muted);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(dashPublicUrl)}</div>
              <a href="${esc(dashPublicUrl)}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;">Abrir ↗</a>
            </div>
            <div style="height:280px;overflow:hidden;position:relative;">
              <iframe src="${esc(dashPublicUrl)}" style="width:100%;height:100%;border:none;pointer-events:none;transform-origin:top left" scrolling="no" loading="lazy" title="Preview da sua página"></iframe>
              <a href="${esc(dashPublicUrl)}" target="_blank" style="position:absolute;inset:0;display:block;cursor:pointer" title="Abrir página pública"></a>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- 6. Card: Baixe o App -->
    <div id="download-app-card" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);border:1px solid rgba(201,168,76,0.25);border-radius:16px;padding:0;margin-bottom:20px;display:none;overflow:hidden;position:relative">
      <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(201,168,76,0.12) 0%,transparent 70%);pointer-events:none"></div>
      <div style="position:absolute;bottom:-60px;left:-20px;width:180px;height:180px;background:radial-gradient(circle,rgba(96,165,250,0.06) 0%,transparent 70%);pointer-events:none"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px 0">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.05));border:1px solid rgba(201,168,76,0.3);display:flex;align-items:center;justify-content:center;font-size:22px">📱</div>
          <div>
            <div style="font-size:15px;font-weight:800;color:#F1F5F9;letter-spacing:-0.3px">Baixe o App no Celular</div>
            <div style="font-size:11px;color:rgba(201,168,76,0.8);margin-top:2px;font-weight:500">Gerencie sua barbearia de qualquer lugar</div>
          </div>
        </div>
        <button onclick="document.getElementById('download-app-card').style.display='none'" style="background:rgba(255,255,255,0.06);border:none;color:rgba(241,245,249,0.5);cursor:pointer;padding:6px;border-radius:8px;font-size:16px;line-height:1;transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">✕</button>
      </div>
      <div id="app-content-android" style="display:none;padding:16px 20px 20px">
        <div style="display:flex;gap:20px;align-items:flex-start">
          <div style="flex-shrink:0">
            <img src="/admin/app-qrcode" alt="QR Code" style="width:120px;height:120px;border-radius:12px;border:2px solid rgba(201,168,76,0.3);background:#fff;padding:4px" />
          </div>
          <div style="flex:1">
            <div style="font-size:12px;color:rgba(148,163,184,0.8);margin-bottom:14px;line-height:1.5">Escaneie o QR Code com a câmera do seu celular Android para baixar o app Barber Pro:</div>
            <a href="https://play.google.com/store/apps/details?id=space.manus.barber.app" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(34,197,94,0.3);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 16px rgba(34,197,94,0.4)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 12px rgba(34,197,94,0.3)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5v-17c0-.83 1-.83 1.5-.5l14 8.5c.5.3.5 1 0 1.3l-14 8.5c-.5.3-1.5.3-1.5-.8z"/></svg>
              Google Play →
            </a>
          </div>
        </div>
      </div>
      <div id="app-content-ios" style="display:none;padding:16px 20px 20px">
        <div style="display:flex;gap:16px;align-items:center;background:rgba(255,255,255,0.04);border-radius:12px;padding:14px;border:1px solid rgba(255,255,255,0.08)">
          <div style="font-size:28px">🍎</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#F1F5F9;margin-bottom:4px">iPhone — App Store</div>
            <div style="font-size:12px;color:rgba(148,163,184,0.7);line-height:1.4">Em breve disponível na App Store.<br>Aguarde novidades!</div>
          </div>
        </div>
      </div>
      <div id="app-content-desktop" style="display:none;padding:16px 20px 20px">
        <div style="display:flex;gap:16px;align-items:center;background:rgba(255,255,255,0.04);border-radius:12px;padding:14px;border:1px solid rgba(255,255,255,0.08)">
          <div style="font-size:28px">💻</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#F1F5F9;margin-bottom:4px">Acesse pelo celular</div>
            <div style="font-size:12px;color:rgba(148,163,184,0.7);line-height:1.4">O app está disponível para Android.<br>Acesse esta página pelo seu celular para baixar.</div>
          </div>
        </div>
      </div>
    </div>
    <script>
      (function() {
        var card = document.getElementById('download-app-card');
        var ua = navigator.userAgent;
        var isAndroid = /Android/i.test(ua);
        var isIOS = /iPhone|iPad|iPod/i.test(ua);
        card.style.display = 'block';
        if (isAndroid) { document.getElementById('app-content-android').style.display = 'block'; }
        else if (isIOS) { document.getElementById('app-content-ios').style.display = 'block'; }
        else { document.getElementById('app-content-desktop').style.display = 'block'; }
      })();
    </script>
  `;
'''

# Substituir o body antigo pelo novo
content = content[:idx_start] + new_body + content[idx_end:]

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('OK: dashboard reorganizado e alternador adicionado')
