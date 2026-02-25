#!/usr/bin/env python3
"""
Patch admin-routes.ts:
1. Adiciona função renderRelatorios com gráficos SVG de faturamento, ranking de serviços e desempenho por barbeiro
2. Melhora renderClientes com detalhe do cliente (histórico e pontos)
3. Adiciona "Relatórios" ao menu de navegação
4. Registra rotas /admin/relatorios e /admin/clientes/:id
"""

path = "/home/ubuntu/barber_app/server/admin-routes.ts"
with open(path, "r") as f:
    content = f.read()

# 1. Adicionar "Relatórios" ao menu de navegação
old_nav = '''    { href: "/admin/configuracoes", icon: "⚙️", label: "Configurações", id: "configuracoes" },'''
new_nav = '''    { href: "/admin/relatorios", icon: "📊", label: "Relatórios", id: "relatorios" },
    { href: "/admin/configuracoes", icon: "⚙️", label: "Configurações", id: "configuracoes" },'''
if old_nav in content:
    content = content.replace(old_nav, new_nav, 1)
    print("✅ Relatórios adicionado ao menu")
else:
    print("❌ Menu não encontrado")

# 2. Melhorar renderClientes com link de detalhe
old_client_row = '''                    <td><strong>${esc(c.name)}</strong></td>'''
new_client_row = '''                    <td><a href="/admin/clientes/${c.id}" style="color:var(--gold);text-decoration:none;font-weight:700">${esc(c.name)}</a></td>'''
if old_client_row in content:
    content = content.replace(old_client_row, new_client_row, 1)
    print("✅ Link de detalhe do cliente adicionado")
else:
    print("❌ Linha de cliente não encontrada")

# 3. Adicionar funções renderRelatorios e renderClienteDetalhe antes de registerAdminRoutes
old_register = '''export function registerAdminRoutes(app: Express): void {'''

new_functions = '''// ─── Relatórios ───────────────────────────────────────────────────────────────
async function renderRelatorios(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  // Período: últimos 30 dias por padrão
  const period = (req.query.period as string) || "30";
  const days = parseInt(period) || 30;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);
  // Buscar dados
  const allSales = await db.getSalesByDateRange(startStr, endStr);
  const allExpenses = await db.getExpensesByDateRange(startStr, endStr);
  const allBarbers = await db.getAllBarbers();
  // Calcular faturamento total e despesas
  const totalRevenue = allSales.reduce((s: number, sale: any) => s + parseFloat(sale.total ?? "0"), 0);
  const totalExpenses = allExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount ?? "0"), 0);
  const netProfit = totalRevenue - totalExpenses;
  // Faturamento por dia (últimos N dias)
  const revenueByDay: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    revenueByDay[d.toISOString().slice(0, 10)] = 0;
  }
  allSales.forEach((sale: any) => {
    const day = new Date(sale.createdAt).toISOString().slice(0, 10);
    if (revenueByDay[day] !== undefined) revenueByDay[day] += parseFloat(sale.total ?? "0");
  });
  // Gráfico de barras SVG — faturamento por dia
  const dayKeys = Object.keys(revenueByDay);
  const dayVals = Object.values(revenueByDay) as number[];
  const maxVal = Math.max(...dayVals, 1);
  const barW = Math.max(4, Math.floor(560 / dayKeys.length) - 2);
  const svgBars = dayKeys.map((d, i) => {
    const h = Math.round((dayVals[i] / maxVal) * 120);
    const x = i * (barW + 2) + 20;
    const y = 140 - h;
    const label = days <= 14 ? d.slice(5) : (i % Math.ceil(days / 10) === 0 ? d.slice(5) : "");
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#C9A84C" rx="2" opacity="0.85"/>
      ${label ? `<text x="${x + barW / 2}" y="158" text-anchor="middle" font-size="9" fill="#999">${label}</text>` : ""}`;
  }).join("");
  const chartSvg = `<svg width="600" height="165" style="width:100%;max-width:600px">
    <line x1="20" y1="20" x2="20" y2="140" stroke="#444" stroke-width="1"/>
    <line x1="20" y1="140" x2="590" y2="140" stroke="#444" stroke-width="1"/>
    ${svgBars}
    <text x="12" y="24" text-anchor="middle" font-size="9" fill="#999">${fmt(maxVal)}</text>
    <text x="12" y="82" text-anchor="middle" font-size="9" fill="#999">${fmt(maxVal/2)}</text>
  </svg>`;
  // Ranking de serviços (por saleItems)
  const { saleItems: saleItemsTable } = await import("../drizzle/schema.js");
  const dbConn = await (await import("./_core/db.js")).getDb();
  let serviceRanking: Array<{ name: string; count: number; revenue: number }> = [];
  if (dbConn) {
    const items = await dbConn.select().from(saleItemsTable).where(
      (await import("drizzle-orm")).eq(saleItemsTable.itemType, "service")
    );
    const map: Record<string, { count: number; revenue: number }> = {};
    items.forEach((item: any) => {
      if (!map[item.itemName]) map[item.itemName] = { count: 0, revenue: 0 };
      map[item.itemName].count += item.quantity;
      map[item.itemName].revenue += parseFloat(item.total ?? "0");
    });
    serviceRanking = Object.entries(map).map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
  }
  const maxCount = Math.max(...serviceRanking.map(s => s.count), 1);
  const rankingRows = serviceRanking.map((s, i) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600">${i + 1}. ${esc(s.name)}</span>
        <span style="font-size:12px;color:var(--muted)">${s.count}x · R$ ${fmt(s.revenue)}</span>
      </div>
      <div style="background:var(--border);border-radius:4px;height:8px">
        <div style="background:#C9A84C;height:8px;border-radius:4px;width:${Math.round(s.count / maxCount * 100)}%"></div>
      </div>
    </div>`).join("") || '<div class="empty">Sem dados de serviços no período.</div>';
  // Desempenho por barbeiro
  const barberStats = await Promise.all(allBarbers.map(async (b: any) => {
    const bSales = allSales.filter((s: any) => s.barberId === b.id);
    const bRevenue = bSales.reduce((sum: number, s: any) => sum + parseFloat(s.total ?? "0"), 0);
    const bAppts = await db.getAllAppointmentsByDateRange(b.id, startStr, endStr);
    const completed = bAppts.filter((a: any) => a.status === "completed").length;
    return { name: b.name, revenue: bRevenue, completed };
  }));
  const barberRows = barberStats.sort((a, b) => b.revenue - a.revenue).map((b: any) => `
    <tr>
      <td><strong>${esc(b.name)}</strong></td>
      <td style="text-align:right">R$ ${fmt(b.revenue)}</td>
      <td style="text-align:right">${b.completed}</td>
    </tr>`).join("") || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Sem dados</td></tr>';
  const periodOptions = [
    { v: "7", l: "7 dias" }, { v: "14", l: "14 dias" }, { v: "30", l: "30 dias" }, { v: "60", l: "60 dias" }, { v: "90", l: "90 dias" }
  ].map(o => `<option value="${o.v}" ${period === o.v ? "selected" : ""}>${o.l}</option>`).join("");
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <h2 style="font-size:20px;font-weight:700;margin:0">📊 Relatórios</h2>
      <form method="GET" style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;color:var(--muted)">Período:</label>
        <select name="period" onchange="this.form.submit()" style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">${periodOptions}</select>
      </form>
    </div>
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px">
      <div class="card" style="padding:20px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#C9A84C">R$ ${fmt(totalRevenue)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Faturamento</div>
      </div>
      <div class="card" style="padding:20px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--error)">R$ ${fmt(totalExpenses)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Despesas</div>
      </div>
      <div class="card" style="padding:20px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${netProfit >= 0 ? "#4ADE80" : "var(--error)"}">R$ ${fmt(netProfit)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Lucro Líquido</div>
      </div>
      <div class="card" style="padding:20px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--text)">${allSales.length}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Vendas</div>
      </div>
    </div>
    <!-- Gráfico de faturamento -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">📈 Faturamento por Dia</div></div>
      <div class="card-body" style="overflow-x:auto">${chartSvg}</div>
    </div>
    <!-- Grid ranking + barbeiros -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <div class="card">
        <div class="card-header"><div class="card-title">✂️ Serviços Mais Vendidos</div></div>
        <div class="card-body">${rankingRows}</div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">👤 Desempenho por Barbeiro</div></div>
        <div class="card-body">
          <table>
            <thead><tr><th>Barbeiro</th><th style="text-align:right">Faturamento</th><th style="text-align:right">Concluídos</th></tr></thead>
            <tbody>${barberRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  res.send(adminLayout("Relatórios", "relatorios", body, barber?.name));
}

// ─── Detalhe do Cliente ────────────────────────────────────────────────────────
async function renderClienteDetalhe(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const clientId = parseInt(req.params.id);
  if (!clientId) { res.redirect("/admin/clientes"); return; }
  const client = await db.getClientById(clientId);
  if (!client) { res.status(404).send("Cliente não encontrado"); return; }
  const appointments = await db.getClientAppointments(clientId);
  const sales = await db.getClientSales(clientId);
  const pointsHistory = await db.getClientPointsHistory(clientId);
  const totalSpent = sales.reduce((s: number, sale: any) => s + parseFloat(sale.total ?? "0"), 0);
  const totalPoints = pointsHistory.filter((p: any) => p.type === "earned").reduce((s: number, p: any) => s + p.points, 0);
  const usedPoints = pointsHistory.filter((p: any) => p.type === "redeemed").reduce((s: number, p: any) => s + p.points, 0);
  const currentPoints = totalPoints - usedPoints;
  const statusLabels: Record<string, string> = { scheduled: "Agendado", confirmed: "Confirmado", in_progress: "Em andamento", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };
  const statusColors: Record<string, string> = { scheduled: "#6B7280", confirmed: "#3B82F6", in_progress: "#F59E0B", completed: "#10B981", cancelled: "#EF4444", no_show: "#9CA3AF" };
  const apptRows = appointments.slice(0, 20).map((a: any) => `
    <tr>
      <td>${a.date ? new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
      <td>${esc(a.serviceName ?? "—")}</td>
      <td>${esc(a.barberName ?? "—")}</td>
      <td><span style="background:${statusColors[a.status] ?? "#6B7280"}22;color:${statusColors[a.status] ?? "#6B7280"};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${statusLabels[a.status] ?? a.status}</span></td>
      <td style="text-align:right">R$ ${fmt(parseFloat(a.price ?? "0"))}</td>
    </tr>`).join("") || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Sem agendamentos</td></tr>';
  const pointsRows = pointsHistory.slice(0, 15).map((p: any) => `
    <tr>
      <td style="font-size:12px;color:var(--muted)">${p.createdAt ? new Date(p.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
      <td>${esc(p.description ?? "—")}</td>
      <td style="text-align:right;color:${p.type === "earned" ? "#4ADE80" : "#EF4444"};font-weight:700">${p.type === "earned" ? "+" : "-"}${p.points}</td>
    </tr>`).join("") || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Sem histórico</td></tr>';
  const body = `
    <div style="margin-bottom:16px">
      <a href="/admin/clientes" style="color:var(--muted);text-decoration:none;font-size:13px">← Voltar para Clientes</a>
    </div>
    <!-- Header do cliente -->
    <div class="card" style="margin-bottom:20px;padding:24px">
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#000;flex-shrink:0">
          ${esc((client as any).name?.charAt(0)?.toUpperCase() ?? "?")}
        </div>
        <div style="flex:1">
          <h2 style="font-size:22px;font-weight:800;margin:0 0 4px">${esc((client as any).name)}</h2>
          <div style="color:var(--muted);font-size:13px">${esc((client as any).phone ?? "")} ${(client as any).email ? "· " + esc((client as any).email) : ""}</div>
          ${(client as any).birthdate ? `<div style="color:var(--muted);font-size:12px;margin-top:2px">🎂 ${new Date((client as any).birthdate + "T12:00:00").toLocaleDateString("pt-BR")}</div>` : ""}
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:800;color:#C9A84C">R$ ${fmt(totalSpent)}</div>
            <div style="font-size:11px;color:var(--muted)">Total gasto</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:800;color:#C9A84C">${appointments.filter((a: any) => a.status === "completed").length}</div>
            <div style="font-size:11px;color:var(--muted)">Atendimentos</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:800;color:#C9A84C">${currentPoints}</div>
            <div style="font-size:11px;color:var(--muted)">Pontos</div>
          </div>
        </div>
      </div>
    </div>
    <!-- Grid histórico + pontos -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><div class="card-title">📅 Histórico de Agendamentos</div></div>
        <div class="card-body" style="overflow-x:auto">
          <table>
            <thead><tr><th>Data</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th style="text-align:right">Valor</th></tr></thead>
            <tbody>${apptRows}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">⭐ Histórico de Pontos</div></div>
        <div class="card-body" style="overflow-x:auto">
          <div style="background:var(--surface);border-radius:10px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between">
            <span style="font-size:13px;color:var(--muted)">Saldo atual</span>
            <span style="font-size:16px;font-weight:800;color:#C9A84C">${currentPoints} pts</span>
          </div>
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th style="text-align:right">Pontos</th></tr></thead>
            <tbody>${pointsRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  res.send(adminLayout(`Cliente: ${(client as any).name}`, "clientes", body, barber?.name));
}

export function registerAdminRoutes(app: Express): void {'''

if 'export function registerAdminRoutes(app: Express): void {' in content:
    content = content.replace('export function registerAdminRoutes(app: Express): void {', new_functions, 1)
    print("✅ Funções renderRelatorios e renderClienteDetalhe adicionadas")
else:
    print("❌ Ponto de inserção das funções não encontrado")

# 4. Adicionar rotas de relatórios e detalhe do cliente no registerAdminRoutes
old_routes_end = '''  app.get("/admin/configuracoes", requireAdminAuth, (req, res) => renderConfiguracoes(req, res));
}'''
new_routes_end = '''  app.get("/admin/configuracoes", requireAdminAuth, (req, res) => renderConfiguracoes(req, res));
  app.get("/admin/relatorios", requireAdminAuth, (req, res) => renderRelatorios(req, res));
  app.get("/admin/clientes/:id", requireAdminAuth, (req, res) => renderClienteDetalhe(req, res));
}'''
if old_routes_end in content:
    content = content.replace(old_routes_end, new_routes_end, 1)
    print("✅ Rotas /admin/relatorios e /admin/clientes/:id adicionadas")
else:
    print("❌ Final das rotas não encontrado")

# 5. Adicionar helper fmt() se não existir
if 'function fmt(' not in content:
    old_esc = 'function esc(s: unknown): string {'
    new_esc = '''function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function esc(s: unknown): string {'''
    if old_esc in content:
        content = content.replace(old_esc, new_esc, 1)
        print("✅ Helper fmt() adicionado")
    else:
        print("❌ Helper esc() não encontrado para inserir fmt()")

with open(path, "w") as f:
    f.write(content)

print("✅ Patch aplicado com sucesso")
