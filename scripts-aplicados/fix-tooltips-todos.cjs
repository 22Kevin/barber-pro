const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. Calcular dados de ontem do barbeiro (se ainda não existir)
if (!content.includes('myYesterdayRevenue')) {
  rep(
    `  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  let appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);`,
    `  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  const myYesterdaySales = isBarberRole ? await db.getSalesByDateRange(yesterdayStr, yesterdayStr, myBarberId, tenantId).catch(() => []) : [];
  const myYesterdayRevenue = (myYesterdaySales as any[]).filter((s: any) => s.paymentStatus === 'paid').reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
  const myYesterdayAppts = isBarberRole ? (await db.getAllAppointmentsByDate(yesterdayStr, tenantId).catch(() => [])).filter((a: any) => a.barberId === myBarberId) : [];
  let appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);`,
    'myYesterday stats'
  );
} else {
  // já tem myYesterdayRevenue, só adicionar myYesterdayAppts
  rep(
    `  const myYesterdaySales = isBarberRole ? await db.getSalesByDateRange(yesterdayStr, yesterdayStr, myBarberId, tenantId).catch(() => []) : [];
  const myYesterdayRevenue = (myYesterdaySales as any[]).filter((s: any) => s.paymentStatus === 'paid').reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
  let appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);`,
    `  const myYesterdaySales = isBarberRole ? await db.getSalesByDateRange(yesterdayStr, yesterdayStr, myBarberId, tenantId).catch(() => []) : [];
  const myYesterdayRevenue = (myYesterdaySales as any[]).filter((s: any) => s.paymentStatus === 'paid').reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
  const myYesterdayAppts = isBarberRole ? (await db.getAllAppointmentsByDate(yesterdayStr, tenantId).catch(() => [])).filter((a: any) => a.barberId === myBarberId) : [];
  let appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);`,
    'myYesterdayAppts'
  );
}

// 2. Tooltip Agendamentos — filtrar por barbeiro
rep(
  `        <div class="kpi-tip">Ontem: \${statsYesterday.appointmentsToday} agendamento\${statsYesterday.appointmentsToday !== 1 ? 's' : ''} · \${stats.appointmentsToday === 0 && statsYesterday.appointmentsToday === 0 ? '—' : statsYesterday.appointmentsToday === 0 ? '↑ novo' : stats.appointmentsToday > statsYesterday.appointmentsToday ? '↑ +' + Math.round((stats.appointmentsToday - statsYesterday.appointmentsToday) / statsYesterday.appointmentsToday * 100) + '%' : stats.appointmentsToday < statsYesterday.appointmentsToday ? '↓ ' + Math.round((stats.appointmentsToday - statsYesterday.appointmentsToday) / statsYesterday.appointmentsToday * 100) + '%' : '= igual'}</div>`,
  `        <div class="kpi-tip">\${(() => { const cur = isBarberRole ? appointments.filter((a: any) => a.barberId === myBarberId).length : stats.appointmentsToday; const prev = isBarberRole ? myYesterdayAppts.length : statsYesterday.appointmentsToday; const diff = cur === 0 && prev === 0 ? '—' : prev === 0 ? '↑ novo' : cur > prev ? '↑ +' + Math.round((cur-prev)/prev*100) + '%' : cur < prev ? '↓ ' + Math.round((cur-prev)/prev*100) + '%' : '= igual'; return 'Ontem: ' + prev + ' agendamento' + (prev !== 1 ? 's' : '') + ' · ' + diff; })()}</div>`,
  'tooltip agendamentos'
);

// 3. Tooltip Faturamento/Serviços — filtrar por barbeiro
rep(
  `        <div class="kpi-tip">Ontem: \${fmtCurrency(statsYesterday.revenueToday)} · \${stats.revenueToday === 0 && statsYesterday.revenueToday === 0 ? '—' : statsYesterday.revenueToday === 0 ? '↑ novo' : stats.revenueToday > statsYesterday.revenueToday ? '↑ +' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : stats.revenueToday < statsYesterday.revenueToday ? '↓ ' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : '= igual'}</div>`,
  `        <div class="kpi-tip">\${(() => { const cur = isBarberRole ? myServicesRevenue : stats.revenueToday; const prev = isBarberRole ? myYesterdayRevenue : statsYesterday.revenueToday; const diff = cur === 0 && prev === 0 ? '—' : prev === 0 ? '↑ novo' : cur > prev ? '↑ +' + Math.round((cur-prev)/prev*100) + '%' : cur < prev ? '↓ ' + Math.round((cur-prev)/prev*100) + '%' : '= igual'; return 'Ontem: ' + fmtCurrency(prev) + ' · ' + diff; })()}</div>`,
  'tooltip faturamento'
);

// 4. Tooltip Clientes Atendidos — filtrar por barbeiro
rep(
  `        <div class="kpi-tip">Ontem: \${statsYesterday.clientsToday} cliente\${statsYesterday.clientsToday !== 1 ? 's' : ''} · \${stats.clientsToday === 0 && statsYesterday.clientsToday === 0 ? '—' : statsYesterday.clientsToday === 0 ? '↑ novo' : stats.clientsToday > statsYesterday.clientsToday ? '↑ +' + Math.round((stats.clientsToday - statsYesterday.clientsToday) / statsYesterday.clientsToday * 100) + '%' : stats.clientsToday < statsYesterday.clientsToday ? '↓ ' + Math.round((stats.clientsToday - statsYesterday.clientsToday) / statsYesterday.clientsToday * 100) + '%' : '= igual'}</div>`,
  `        <div class="kpi-tip">\${(() => { const cur = isBarberRole ? myApptsToday.length : stats.clientsToday; const prev = isBarberRole ? myYesterdayAppts.length : statsYesterday.clientsToday; const diff = cur === 0 && prev === 0 ? '—' : prev === 0 ? '↑ novo' : cur > prev ? '↑ +' + Math.round((cur-prev)/prev*100) + '%' : cur < prev ? '↓ ' + Math.round((cur-prev)/prev*100) + '%' : '= igual'; return 'Ontem: ' + prev + ' cliente' + (prev !== 1 ? 's' : '') + ' · ' + diff; })()}</div>`,
  'tooltip clientes'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
