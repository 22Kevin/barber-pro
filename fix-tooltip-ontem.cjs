const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. Calcular myYesterdayRevenue após statsYesterday
rep(
  `  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  let appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);`,
  `  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  // Serviços de ontem do barbeiro (para tooltip)
  const myYesterdaySales = isBarberRole ? await db.getSalesByDateRange(yesterdayStr, yesterdayStr, myBarberId, tenantId).catch(() => []) : [];
  const myYesterdayRevenue = (myYesterdaySales as any[]).filter((s: any) => s.paymentStatus === 'paid').reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
  let appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);`,
  'myYesterdayRevenue'
);

// 2. Tooltip do card "Meus Serviços Hoje" — usar myYesterdayRevenue para barbeiro
rep(
  `        <div class="kpi-tip">Ontem: \${fmtCurrency(statsYesterday.revenueToday)} · \${stats.revenueToday === 0 && statsYesterday.revenueToday === 0 ? '—' : statsYesterday.revenueToday === 0 ? '↑ novo' : stats.revenueToday > statsYesterday.revenueToday ? '↑ +' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : stats.revenueToday < statsYesterday.revenueToday ? '↓ ' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : '= igual'}</div>`,
  `        <div class="kpi-tip">\${(() => { const cur = isBarberRole ? myServicesRevenue : stats.revenueToday; const prev = isBarberRole ? myYesterdayRevenue : statsYesterday.revenueToday; const diff = cur === 0 && prev === 0 ? '—' : prev === 0 ? '↑ novo' : cur > prev ? '↑ +' + Math.round((cur-prev)/prev*100) + '%' : cur < prev ? '↓ ' + Math.round((cur-prev)/prev*100) + '%' : '= igual'; return 'Ontem: ' + fmtCurrency(prev) + ' · ' + diff; })()}</div>`,
  'tooltip ontem faturamento'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
