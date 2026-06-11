const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. Role logic + filtro de agendamentos
rep(
  `  const stats = await db.getDashboardStats(dateStr, tenantId);
  const yesterdayStr = yesterday();
  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);`,
  `  const isBarberRole = session.role === "barber" || session.role === "receptionist";
  const myBarberId = session.barberId;
  const stats = await db.getDashboardStats(dateStr, tenantId);
  const yesterdayStr = yesterday();
  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  let appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);
  if (session.role === "barber") appointments = appointments.filter((a: any) => a.barberId === myBarberId);`,
  'role logic'
);

// 2. Meus serviços/comissões do mês
rep(
  `  const monthlySales = await db.getSalesByDateRange(monthStart, monthEnd, undefined, tenantId).catch(() => []);
  const monthRevenue = (monthlySales as any[]).filter((s: any) => s.paymentStatus === 'paid').reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
  const monthExpenses = await db.getExpensesByDateRange(monthStart, monthEnd, tenantId).catch(() => []);
  const monthExpenseTotal = (monthExpenses as any[]).reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
  const monthProfit = monthRevenue - monthExpenseTotal;
  const now2 = new Date(); const monthLabel = now2.toLocaleDateString('pt-BR', { month: 'long' });`,
  `  const monthlySales = await db.getSalesByDateRange(monthStart, monthEnd, undefined, tenantId).catch(() => []);
  const monthRevenue = (monthlySales as any[]).filter((s: any) => s.paymentStatus === 'paid').reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
  const monthExpenses = await db.getExpensesByDateRange(monthStart, monthEnd, tenantId).catch(() => []);
  const monthExpenseTotal = (monthExpenses as any[]).reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
  const monthProfit = monthRevenue - monthExpenseTotal;
  const now2 = new Date(); const monthLabel = now2.toLocaleDateString('pt-BR', { month: 'long' });
  const myApptsToday = appointments.filter((a: any) => a.barberId === myBarberId && a.status === 'completed');
  const myServicesRevenue = myApptsToday.reduce((sum: number, a: any) => sum + parseFloat(a.price || a.servicePrice || '0'), 0);
  const myMonthlySales = (monthlySales as any[]).filter((s: any) => s.barberId === myBarberId && s.paymentStatus === 'paid');
  const myMonthRevenue = myMonthlySales.reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
  const commissionConfig = await db.getCommissionConfig(myBarberId).catch(() => null);
  const commissionRate = commissionConfig ? parseFloat((commissionConfig as any).rate || '0') / 100 : 0;
  const myMonthCommission = myMonthRevenue * commissionRate;`,
  'my stats'
);

// 3. Label do card do mês
rep(
  `          <span style="font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:1.5px;text-transform:uppercase">Faturamento de \${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</span>`,
  `          <span style="font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:1.5px;text-transform:uppercase">\${isBarberRole ? "Meus Serviços de " : "Faturamento de "}\${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</span>`,
  'label mes'
);

// 4. Valor principal do faturamento
rep(
  `          <div id="dashMonthReveal" style="font-size:32px;font-weight:900;color:#C9A84C;letter-spacing:-1px;line-height:1;filter:blur(8px);user-select:none;transition:filter 0.3s" onclick="toggleMonthRevenue()">\${fmtCurrency(monthRevenue)}</div>`,
  `          <div id="dashMonthReveal" style="font-size:32px;font-weight:900;color:#C9A84C;letter-spacing:-1px;line-height:1;filter:blur(8px);user-select:none;transition:filter 0.3s" onclick="toggleMonthRevenue()">\${fmtCurrency(isBarberRole ? myMonthRevenue : monthRevenue)}</div>`,
  'revenue val'
);

// 5. Despesas/Lucro → Comissão/Atendimentos para barbeiro
rep(
  `            <div>
              <div style="font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.8px">Despesas</div>
              <div id="dashMonthExpense" style="font-size:14px;font-weight:700;color:#F87171;filter:blur(6px);transition:filter 0.3s" onclick="toggleMonthRevenue()">-\${fmtCurrency(monthExpenseTotal)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.8px">Lucro</div>
              <div id="dashMonthProfit" style="font-size:14px;font-weight:700;color:\${monthProfit >= 0 ? '#4ADE80' : '#F87171'};filter:blur(6px);transition:filter 0.3s" onclick="toggleMonthRevenue()">\${fmtCurrency(monthProfit)}</div>
            </div>`,
  `            \${isBarberRole ? \`
            <div>
              <div style="font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.8px">Comissão</div>
              <div id="dashMonthExpense" style="font-size:14px;font-weight:700;color:#4ADE80;filter:blur(6px);transition:filter 0.3s" onclick="toggleMonthRevenue()">\${fmtCurrency(myMonthCommission)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.8px">Atend. hoje</div>
              <div id="dashMonthProfit" style="font-size:14px;font-weight:700;color:#C9A84C;filter:blur(6px);transition:filter 0.3s" onclick="toggleMonthRevenue()">\${myApptsToday.length}</div>
            </div>
            \` : \`
            <div>
              <div style="font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.8px">Despesas</div>
              <div id="dashMonthExpense" style="font-size:14px;font-weight:700;color:#F87171;filter:blur(6px);transition:filter 0.3s" onclick="toggleMonthRevenue()">-\${fmtCurrency(monthExpenseTotal)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.8px">Lucro</div>
              <div id="dashMonthProfit" style="font-size:14px;font-weight:700;color:\${monthProfit >= 0 ? '#4ADE80' : '#F87171'};filter:blur(6px);transition:filter 0.3s" onclick="toggleMonthRevenue()">\${fmtCurrency(monthProfit)}</div>
            </div>
            \`}`,
  'despesas/lucro -> comissao'
);

// 6. Link Ver detalhes
rep(
  `        <div style="margin-top:10px;font-size:11px;color:#555">Toque no valor ou no olhinho para revelar &nbsp;·&nbsp; <a href="/admin/financeiro" style="color:#C9A84C88;text-decoration:none">Ver detalhes →</a></div>`,
  `        <div style="margin-top:10px;font-size:11px;color:#555">Toque no valor ou no olhinho para revelar &nbsp;·&nbsp; <a href="\${isBarberRole ? '/admin/minhas-comissoes' : '/admin/financeiro'}" style="color:#C9A84C88;text-decoration:none">Ver detalhes →</a></div>`,
  'ver detalhes link'
);

// 7. Faturamento Hoje label
rep(
  `          <div class="metric-label">Faturamento Hoje</div>`,
  `          <div class="metric-label">\${isBarberRole ? "Meus Serviços Hoje" : "Faturamento Hoje"}</div>`,
  'fat hoje label'
);

// 8. Faturamento Hoje valor
rep(
  `        <div class="metric-value" style="color:#4ADE80">\${fmtCurrency(stats.revenueToday)}</div>`,
  `        <div class="metric-value" style="color:#4ADE80">\${fmtCurrency(isBarberRole ? myServicesRevenue : stats.revenueToday)}</div>`,
  'fat hoje valor'
);

// 9. Nova Venda — ocultar para barbeiro
const oldVenda = `        <a href="/admin/financeiro?new=1" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(201,168,76,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--text);text-align:center;">Nova Venda</span>
        </a>`;
const novVenda = `        \${!isBarberRole ? \`<a href="/admin/financeiro?new=1" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(201,168,76,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--text);text-align:center;">Nova Venda</span>
        </a>\` : ""}`;
rep(oldVenda, novVenda, 'nova venda');

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
