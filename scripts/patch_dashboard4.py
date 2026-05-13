#!/usr/bin/env python3
"""
Patch Dashboard Round 4:
Gráfico de faturamento semanal com barras gradiente dourado, linha de tendência
suave (Bezier), pontos interativos, labels de valor e animação de entrada.
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Buscar dados dos últimos 7 dias no renderDashboard ────────────────────
old_dashPublicUrl = '''  const dashPublicUrl = dashSlug ? `${dashBaseUrl}/pub/${dashSlug}` : "";
  // Mapa de barbeiros e clientes para exibição'''

new_dashPublicUrl = '''  const dashPublicUrl = dashSlug ? `${dashBaseUrl}/pub/${dashSlug}` : "";

  // ─── Dados dos últimos 7 dias para o gráfico ─────────────────────────────
  const weekDays: { date: string; label: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
    const dayStats = await db.getDashboardStats(dateKey, tenantId).catch(() => ({ revenueToday: 0, appointmentsToday: 0, clientsToday: 0, pendingAppointments: 0 }));
    weekDays.push({ date: dateKey, label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), revenue: dayStats.revenueToday });
  }
  const maxRevenue = Math.max(...weekDays.map(d => d.revenue), 1);
  const totalWeekRevenue = weekDays.reduce((s, d) => s + d.revenue, 0);

  // Mapa de barbeiros e clientes para exibição'''

if old_dashPublicUrl in content:
    content = content.replace(old_dashPublicUrl, new_dashPublicUrl, 1)
    print('OK: busca dos últimos 7 dias adicionada ao renderDashboard')
else:
    print('ERRO: bloco dashPublicUrl não encontrado')

# ─── 2. Inserir o gráfico no HTML do dashboard após os KPI cards ─────────────
# Encontrar o comentário do card "Baixe o App" para inserir antes dele
old_card_app = "    <!-- Card: Baixe o App (detecção de dispositivo via JS) -->"

new_chart_html = '''    <!-- Gráfico de Faturamento Semanal -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px;position:relative;overflow:hidden;">
      <!-- Brilho decorativo de fundo -->
      <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%);pointer-events:none;"></div>
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--foreground);letter-spacing:0.3px;">Faturamento — Últimos 7 dias</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">Total do período: <span style="color:#C9A84C;font-weight:700;">${fmtCurrency(totalWeekRevenue)}</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#C9A84C,#F5D78E);"></div>
          <span style="font-size:11px;color:var(--muted);">Faturamento</span>
        </div>
      </div>
      <!-- SVG Chart -->
      <svg id="revenue-chart" viewBox="0 0 700 200" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;overflow:visible;" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Gradiente das barras -->
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#F5D78E" stop-opacity="1"/>
            <stop offset="100%" stop-color="#C9A84C" stop-opacity="0.7"/>
          </linearGradient>
          <!-- Gradiente da área sob a linha -->
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#C9A84C" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/>
          </linearGradient>
          <!-- Filtro de brilho nas barras -->
          <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <!-- Animação de crescimento das barras -->
          <style>
            .bar-rect { transform-origin: bottom; animation: bar-grow 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
            .bar-rect:nth-child(1) { animation-delay: 0ms; }
            .bar-rect:nth-child(2) { animation-delay: 80ms; }
            .bar-rect:nth-child(3) { animation-delay: 160ms; }
            .bar-rect:nth-child(4) { animation-delay: 240ms; }
            .bar-rect:nth-child(5) { animation-delay: 320ms; }
            .bar-rect:nth-child(6) { animation-delay: 400ms; }
            .bar-rect:nth-child(7) { animation-delay: 480ms; }
            @keyframes bar-grow {
              from { transform: scaleY(0); opacity: 0; }
              to   { transform: scaleY(1); opacity: 1; }
            }
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
        <!-- Grade horizontal sutil -->
        ${[0.25, 0.5, 0.75, 1.0].map(pct => {
          const y = 160 - pct * 140;
          const val = maxRevenue * pct;
          return `<line x1="40" y1="${y}" x2="680" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,4"/>
          <text x="36" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--muted)">${val >= 1000 ? 'R$' + (val/1000).toFixed(1) + 'k' : 'R$' + val.toFixed(0)}</text>`;
        }).join('')}
        <!-- Barras -->
        <g>
          ${weekDays.map((d, i) => {
            const x = 40 + i * 92 + 18;
            const barW = 56;
            const barH = Math.max(d.revenue / maxRevenue * 140, d.revenue > 0 ? 4 : 0);
            const y = 160 - barH;
            const isToday = d.date === dateStr;
            return `<rect class="bar-rect" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" ry="6" fill="${isToday ? 'url(#barGrad)' : 'rgba(201,168,76,0.35)'}" filter="${isToday ? 'url(#barGlow)' : ''}" style="cursor:default;" onmouseover="this.setAttribute('fill','url(#barGrad)')" onmouseout="this.setAttribute('fill','${isToday ? 'url(#barGrad)' : 'rgba(201,168,76,0.35)'}')" />`;
          }).join('')}
        </g>
        <!-- Área sob a linha -->
        <path class="area-path" d="${(() => {
          const pts = weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0);
            return [cx, cy];
          });
          let path = `M ${pts[0][0]} 160 `;
          path += `L ${pts[0][0]} ${pts[0][1]} `;
          for (let i = 1; i < pts.length; i++) {
            const cpx = (pts[i-1][0] + pts[i][0]) / 2;
            path += `C ${cpx} ${pts[i-1][1]} ${cpx} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]} `;
          }
          path += `L ${pts[pts.length-1][0]} 160 Z`;
          return path;
        })()}" fill="url(#areaGrad)"/>
        <!-- Linha de tendência -->
        <path class="line-path" d="${(() => {
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
        <g>
          ${weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0);
            return `<circle class="dot-point" cx="${cx}" cy="${cy}" r="4" fill="#1e293b" stroke="#C9A84C" stroke-width="2"/>`;
          }).join('')}
        </g>
        <!-- Labels de valor acima das barras -->
        ${weekDays.map((d, i) => {
          const cx = 40 + i * 92 + 18 + 28;
          const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0) - 10;
          if (d.revenue === 0) return '';
          const label = d.revenue >= 1000 ? 'R$' + (d.revenue/1000).toFixed(1) + 'k' : 'R$' + d.revenue.toFixed(0);
          return `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="9" font-weight="700" fill="#C9A84C" opacity="0.9">${label}</text>`;
        }).join('')}
        <!-- Labels dos dias -->
        ${weekDays.map((d, i) => {
          const cx = 40 + i * 92 + 18 + 28;
          const isToday = d.date === dateStr;
          return `<text x="${cx}" y="178" text-anchor="middle" font-size="11" font-weight="${isToday ? '700' : '500'}" fill="${isToday ? '#C9A84C' : 'var(--muted)'}">${d.label}</text>`;
        }).join('')}
        <!-- Linha base -->
        <line x1="40" y1="160" x2="680" y2="160" stroke="var(--border)" stroke-width="1"/>
      </svg>
    </div>
    <!-- Card: Baixe o App (detecção de dispositivo via JS) -->'''

if old_card_app in content:
    content = content.replace(old_card_app, new_chart_html, 1)
    print('OK: gráfico de faturamento semanal adicionado ao dashboard')
else:
    print('ERRO: âncora do card Baixe o App não encontrada')

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Concluído.')
