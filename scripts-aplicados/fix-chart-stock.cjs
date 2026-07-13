const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. Gráfico 7 dias — filtrar por barbeiro
rep(
`    const dayStats = await db.getDashboardStats(dateKey, tenantId).catch(() => ({ revenueToday: 0, appointmentsToday: 0, clientsToday: 0, pendingAppointments: 0 }));
    weekDays.push({ date: dateKey, label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), revenue: dayStats.revenueToday, appointmentsCount: dayStats.appointmentsToday });`,
`    if (isBarberRole) {
      const dayAppts = await db.getAllAppointmentsByDate(dateKey, tenantId).catch(() => []);
      const myDayAppts = (dayAppts as any[]).filter((a: any) => a.barberId === myBarberId);
      const myDaySales = await db.getSalesByDateRange(dateKey, dateKey, myBarberId, tenantId).catch(() => []);
      const myDayRev = (myDaySales as any[]).filter((s: any) => s.paymentStatus === 'paid').reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
      weekDays.push({ date: dateKey, label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), revenue: myDayRev, appointmentsCount: myDayAppts.length });
    } else {
      const dayStats = await db.getDashboardStats(dateKey, tenantId).catch(() => ({ revenueToday: 0, appointmentsToday: 0, clientsToday: 0, pendingAppointments: 0 }));
      weekDays.push({ date: dateKey, label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), revenue: dayStats.revenueToday, appointmentsCount: dayStats.appointmentsToday });
    }`,
'grafico 7 dias'
);

// 2. Alerta de estoque — só para admin/quem tem acesso a produtos
rep(
`    \${lowStockItems.length > 0 ? \``,
`    \${!isBarberRole && lowStockItems.length > 0 ? \``,
'alerta estoque'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
