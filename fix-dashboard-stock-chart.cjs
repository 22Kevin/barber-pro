const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. Gráfico 7 dias — filtrar por barbeiro
rep(
  `  // ─── Dados dos últimos 7 dias para o gráfico ─────────────────────────────
  const weekDays: { date: string; label: string; revenue: number; appointmentsCount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const wd = new Date();
    wd.setDate(wd.getDate() - i);
    const dateKey = wd.toISOString().split("T")[0];
    const dayLabel = wd.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
    const dayStats = await db.getDashboardStats(dateKey, tenantId).catch(() => ({ revenueToday: 0, appointmentsToday: 0, clientsToday: 0, pendingAppointments: 0 }));
    weekDays.push({ date: dateKey, label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), revenue: dayStats.revenueToday, appointmentsCount: dayStats.appointmentsToday });
  }
  const maxRevenue = Math.max(...weekDays.map(d => d.revenue), 1);
  const totalWeekRevenue = weekDays.reduce((s, d) => s + d.revenue, 0);`,
  `  // ─── Dados dos últimos 7 dias para o gráfico ─────────────────────────────
  const weekDays: { date: string; label: string; revenue: number; appointmentsCount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const wd = new Date();
    wd.setDate(wd.getDate() - i);
    const dateKey = wd.toISOString().split("T")[0];
    const dayLabel = wd.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
    if (isBarberRole) {
      // Barbeiro: contar só seus agendamentos e serviços do dia
      const dayAppts = await db.getAllAppointmentsByDate(dateKey, tenantId).catch(() => []);
      const myDayAppts = (dayAppts as any[]).filter((a: any) => a.barberId === myBarberId);
      const myDaySales = await db.getSalesByDateRange(dateKey, dateKey, myBarberId, tenantId).catch(() => []);
      const myDayRevenue = (myDaySales as any[]).filter((s: any) => s.paymentStatus === 'paid').reduce((sum: number, s: any) => sum + parseFloat(s.total || '0'), 0);
      weekDays.push({ date: dateKey, label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), revenue: myDayRevenue, appointmentsCount: myDayAppts.length });
    } else {
      const dayStats = await db.getDashboardStats(dateKey, tenantId).catch(() => ({ revenueToday: 0, appointmentsToday: 0, clientsToday: 0, pendingAppointments: 0 }));
      weekDays.push({ date: dateKey, label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), revenue: dayStats.revenueToday, appointmentsCount: dayStats.appointmentsToday });
    }
  }
  const maxRevenue = Math.max(...weekDays.map(d => d.revenue), 1);
  const totalWeekRevenue = weekDays.reduce((s, d) => s + d.revenue, 0);`,
  'grafico 7 dias por barbeiro'
);

// 2. Alerta de estoque — só para quem tem permissão
rep(
  `    ${lowStockItems.length > 0 ? \`
    <a href="/admin/estoque"`,
  `    \${!isBarberRole && lowStockItems.length > 0 ? \`
    <a href="/admin/estoque"`,
  'alerta estoque'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
