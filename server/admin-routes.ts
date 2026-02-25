/**
 * Barber Pro — Painel Administrativo Web
 *
 * Acessível em /admin — protegido por sessão do barbeiro (super_admin ou barber)
 * Autenticação via email/senha (mesma base de dados do app mobile)
 *
 * Rotas:
 *   GET  /admin/login          — Página de login
 *   POST /admin/login          — Autenticar
 *   GET  /admin/logout         — Encerrar sessão
 *   GET  /admin                — Dashboard (métricas do dia)
 *   GET  /admin/agenda         — Agenda do dia / semana
 *   GET  /admin/clientes       — Lista de clientes
 *   GET  /admin/servicos       — Gestão de serviços
 *   GET  /admin/financeiro     — Resumo financeiro mensal
 *   GET  /admin/configuracoes  — Configurações da barbearia
 */

import type { Express, Request, Response, NextFunction } from "express";
import * as db from "./db";

const ADMIN_SESSION_COOKIE = "bp_admin_session";
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 horas

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtCurrency(val: number | string): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function monthRange(): { start: string; end: string } {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

// ─── Sessão simples (JWT-less, cookie assinado com barberId) ──────────────────
function encodeSession(barberId: number, role: string): string {
  const payload = Buffer.from(JSON.stringify({ barberId, role, ts: Date.now() })).toString("base64url");
  return payload;
}

function decodeSession(token: string): { barberId: number; role: string } | null {
  try {
    const data = JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
    if (!data.barberId || !data.role) return null;
    // Expirar após 8h
    if (Date.now() - data.ts > SESSION_MAX_AGE * 1000) return null;
    return { barberId: data.barberId, role: data.role };
  } catch {
    return null;
  }
}

// ─── Middleware de autenticação ───────────────────────────────────────────────
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (!token) return res.redirect("/admin/login");
  const session = decodeSession(token);
  if (!session) return res.redirect("/admin/login");
  (req as any).adminSession = session;
  next();
}

// ─── Layout base do painel ────────────────────────────────────────────────────
function adminLayout(title: string, activePage: string, body: string, barberName = ""): string {
  const navItems = [
    { href: "/admin", icon: "⊞", label: "Dashboard", id: "dashboard" },
    { href: "/admin/agenda", icon: "📅", label: "Agenda", id: "agenda" },
    { href: "/admin/clientes", icon: "👥", label: "Clientes", id: "clientes" },
    { href: "/admin/servicos", icon: "✂️", label: "Serviços", id: "servicos" },
    { href: "/admin/financeiro", icon: "💰", label: "Financeiro", id: "financeiro" },
    { href: "/admin/configuracoes", icon: "⚙️", label: "Configurações", id: "configuracoes" },
  ];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} — Barber Pro Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold: #C9A84C;
      --gold-dim: #C9A84C22;
      --bg: #0C0C0C;
      --surface: #161616;
      --surface2: #1E1E1E;
      --border: #2A2A2A;
      --text: #F0EEE8;
      --muted: #888880;
      --success: #4ADE80;
      --warning: #FBBF24;
      --error: #F87171;
      --sidebar-w: 220px;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar { width: var(--sidebar-w); background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 100; }
    .sidebar-logo { padding: 24px 20px 16px; border-bottom: 1px solid var(--border); }
    .sidebar-logo-title { font-size: 18px; font-weight: 900; color: var(--gold); letter-spacing: 1px; }
    .sidebar-logo-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .sidebar-nav { flex: 1; padding: 12px 0; overflow-y: auto; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; font-size: 14px; color: var(--muted); text-decoration: none; border-radius: 0; transition: all 0.15s; cursor: pointer; }
    .nav-item:hover { background: var(--surface2); color: var(--text); }
    .nav-item.active { background: var(--gold-dim); color: var(--gold); border-right: 3px solid var(--gold); font-weight: 600; }
    .nav-icon { font-size: 16px; width: 20px; text-align: center; }
    .sidebar-footer { padding: 16px 20px; border-top: 1px solid var(--border); }
    .sidebar-user { font-size: 13px; color: var(--muted); margin-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sidebar-logout { display: block; font-size: 12px; color: var(--error); text-decoration: none; }
    .sidebar-logout:hover { opacity: 0.8; }

    /* Main */
    .main { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
    .topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; }
    .topbar-title { font-size: 20px; font-weight: 800; }
    .topbar-date { font-size: 13px; color: var(--muted); }
    .content { padding: 28px; flex: 1; }

    /* Cards de métrica */
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
    .metric-label { font-size: 11px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
    .metric-value { font-size: 28px; font-weight: 900; }
    .metric-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

    /* Tabelas */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; margin-bottom: 24px; }
    .card-header { padding: 18px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .card-title { font-size: 15px; font-weight: 700; }
    .card-body { padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 12px 16px; font-size: 11px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; text-align: left; border-bottom: 1px solid var(--border); background: var(--surface2); }
    td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface2); }

    /* Badges */
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-success { background: #4ADE8022; color: var(--success); }
    .badge-warning { background: #FBBF2422; color: var(--warning); }
    .badge-error { background: #F8717122; color: var(--error); }
    .badge-muted { background: var(--surface2); color: var(--muted); }
    .badge-gold { background: var(--gold-dim); color: var(--gold); }

    /* Botões */
    .btn { display: inline-block; padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; }
    .btn-primary { background: var(--gold); color: #0C0C0C; }
    .btn-ghost { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }

    /* Empty state */
    .empty { text-align: center; padding: 48px; color: var(--muted); font-size: 14px; }

    /* Formulários */
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; letter-spacing: 0.5px; }
    .form-input { width: 100%; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 14px; }
    .form-input:focus { outline: none; border-color: var(--gold); }

    /* Responsivo mobile */
    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); }
      .main { margin-left: 0; }
    }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-title">BARBER PRO</div>
      <div class="sidebar-logo-sub">Painel Administrativo</div>
    </div>
    <nav class="sidebar-nav">
      ${navItems.map((n) => `
        <a href="${n.href}" class="nav-item ${activePage === n.id ? "active" : ""}">
          <span class="nav-icon">${n.icon}</span>
          ${n.label}
        </a>
      `).join("")}
    </nav>
    <div class="sidebar-footer">
      ${barberName ? `<div class="sidebar-user">👤 ${esc(barberName)}</div>` : ""}
      <a href="/admin/logout" class="sidebar-logout">Sair da conta</a>
    </div>
  </aside>

  <div class="main">
    <div class="topbar">
      <div class="topbar-title">${esc(title)}</div>
      <div class="topbar-date">${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
    <div class="content">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

// ─── Página de Login ──────────────────────────────────────────────────────────
function loginPage(error = false): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login — Barber Pro Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0C0C0C; color: #F0EEE8; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #161616; border: 1px solid #2A2A2A; border-radius: 20px; padding: 40px; width: 100%; max-width: 380px; }
    .logo { font-size: 22px; font-weight: 900; color: #C9A84C; letter-spacing: 2px; text-align: center; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #888880; text-align: center; margin-bottom: 32px; }
    label { display: block; font-size: 12px; color: #888880; margin-bottom: 6px; }
    input { width: 100%; padding: 12px 14px; background: #0C0C0C; border: 1px solid #2A2A2A; border-radius: 10px; color: #F0EEE8; font-size: 14px; margin-bottom: 16px; }
    input:focus { outline: none; border-color: #C9A84C; }
    button { width: 100%; padding: 14px; background: #C9A84C; color: #0C0C0C; border: none; border-radius: 12px; font-size: 15px; font-weight: 800; cursor: pointer; margin-top: 8px; }
    button:hover { opacity: 0.9; }
    .error { background: #F8717122; border: 1px solid #F8717144; color: #F87171; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
    .back { display: block; text-align: center; margin-top: 20px; font-size: 12px; color: #888880; text-decoration: none; }
    .back:hover { color: #C9A84C; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">BARBER PRO</div>
    <div class="subtitle">Painel Administrativo</div>
    ${error ? `<div class="error">Email ou senha incorretos.</div>` : ""}
    <form method="POST" action="/admin/login">
      <label>Email</label>
      <input type="email" name="email" placeholder="seu@email.com" required autofocus />
      <label>Senha</label>
      <input type="password" name="password" placeholder="••••••••" required />
      <button type="submit">Entrar</button>
    </form>
    <a href="/" class="back">← Voltar ao app</a>
  </div>
</body>
</html>`;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function renderDashboard(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const dateStr = today();
  const stats = await db.getDashboardStats(dateStr);
  const appointments = await db.getAllAppointmentsByDate(dateStr);
  const barbers = await db.getAllBarbers();

  // Mapa de barbeiros e clientes para exibição
  const barberMap: Record<number, string> = Object.fromEntries(barbers.map((b) => [b.id, b.name]));
  const clientIds = [...new Set(appointments.map((a: any) => a.clientId))];
  const clientMap: Record<number, string> = {};
  for (const cid of clientIds) {
    const c = await db.getClientById(cid);
    if (c) clientMap[cid] = c.name;
  }
  const serviceIds = [...new Set(appointments.map((a: any) => a.serviceId))];
  const serviceMap: Record<number, string> = {};
  for (const sid of serviceIds) {
    const s = await db.getServiceById(sid);
    if (s) serviceMap[sid] = s.name;
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      scheduled: "badge-warning",
      confirmed: "badge-gold",
      in_progress: "badge-gold",
      completed: "badge-success",
      cancelled: "badge-error",
      no_show: "badge-muted",
    };
    const labels: Record<string, string> = {
      scheduled: "Agendado",
      confirmed: "Confirmado",
      in_progress: "Em andamento",
      completed: "Concluído",
      cancelled: "Cancelado",
      no_show: "Não compareceu",
    };
    return `<span class="badge ${map[status] ?? "badge-muted"}">${labels[status] ?? status}</span>`;
  };

  const appointmentsHtml = appointments.length === 0
    ? `<div class="empty">Nenhum agendamento para hoje.</div>`
    : `<table>
        <thead><tr><th>Horário</th><th>Cliente</th><th>Serviço</th><th>Barbeiro</th><th>Status</th></tr></thead>
        <tbody>
          ${appointments.map((a: any) => `
            <tr>
              <td>${a.startTime?.substring(0, 5) ?? "—"}</td>
              <td>${esc(clientMap[a.clientId] ?? "—")}</td>
              <td>${esc(serviceMap[a.serviceId] ?? "—")}</td>
              <td>${esc(barberMap[a.barberId] ?? "—")}</td>
              <td>${statusBadge(a.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

  const body = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Agendamentos Hoje</div>
        <div class="metric-value" style="color:var(--gold)">${stats.appointmentsToday}</div>
        <div class="metric-sub">${stats.pendingAppointments} pendentes</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Faturamento Hoje</div>
        <div class="metric-value" style="color:var(--success)">${fmtCurrency(stats.revenueToday)}</div>
        <div class="metric-sub">vendas pagas</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Clientes Atendidos</div>
        <div class="metric-value">${stats.clientsToday}</div>
        <div class="metric-sub">hoje</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Equipe Ativa</div>
        <div class="metric-value">${barbers.length}</div>
        <div class="metric-sub">profissionais</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📅 Agenda de Hoje — ${fmtDate(dateStr)}</div>
        <a href="/admin/agenda" class="btn btn-ghost">Ver tudo</a>
      </div>
      <div class="card-body">${appointmentsHtml}</div>
    </div>
  `;

  res.send(adminLayout("Dashboard", "dashboard", body, barber?.name));
}

// ─── Agenda ───────────────────────────────────────────────────────────────────
async function renderAgenda(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const dateStr = (req.query.date as string) || today();
  const appointments = await db.getAllAppointmentsByDate(dateStr);
  const barbers = await db.getAllBarbers();

  const barberMap: Record<number, string> = Object.fromEntries(barbers.map((b) => [b.id, b.name]));
  const clientIds = [...new Set(appointments.map((a: any) => a.clientId))];
  const clientMap: Record<number, string> = {};
  for (const cid of clientIds) {
    const c = await db.getClientById(cid);
    if (c) clientMap[cid] = c.name;
  }
  const serviceIds = [...new Set(appointments.map((a: any) => a.serviceId))];
  const serviceMap: Record<number, string> = {};
  for (const sid of serviceIds) {
    const s = await db.getServiceById(sid);
    if (s) serviceMap[sid] = s.name;
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { scheduled: "badge-warning", confirmed: "badge-gold", in_progress: "badge-gold", completed: "badge-success", cancelled: "badge-error", no_show: "badge-muted" };
    const labels: Record<string, string> = { scheduled: "Agendado", confirmed: "Confirmado", in_progress: "Em andamento", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };
    return `<span class="badge ${map[status] ?? "badge-muted"}">${labels[status] ?? status}</span>`;
  };

  // Navegação de dias
  const prevDate = new Date(dateStr + "T12:00:00");
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(dateStr + "T12:00:00");
  nextDate.setDate(nextDate.getDate() + 1);

  const body = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
      <a href="/admin/agenda?date=${prevDate.toISOString().split("T")[0]}" class="btn btn-ghost">← Anterior</a>
      <input type="date" value="${dateStr}" onchange="location.href='/admin/agenda?date='+this.value"
        style="padding:8px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
      <a href="/admin/agenda?date=${nextDate.toISOString().split("T")[0]}" class="btn btn-ghost">Próximo →</a>
      <span style="color:var(--muted);font-size:13px">${appointments.length} agendamento(s)</span>
    </div>

    <div class="card">
      <div class="card-body">
        ${appointments.length === 0
          ? `<div class="empty">Nenhum agendamento para ${fmtDate(dateStr)}.</div>`
          : `<table>
              <thead><tr><th>Horário</th><th>Cliente</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th>Notas</th></tr></thead>
              <tbody>
                ${appointments.map((a: any) => `
                  <tr>
                    <td><strong>${a.startTime?.substring(0, 5) ?? "—"}</strong> – ${a.endTime?.substring(0, 5) ?? "—"}</td>
                    <td>${esc(clientMap[a.clientId] ?? "—")}</td>
                    <td>${esc(serviceMap[a.serviceId] ?? "—")}</td>
                    <td>${esc(barberMap[a.barberId] ?? "—")}</td>
                    <td>${statusBadge(a.status)}</td>
                    <td style="color:var(--muted);font-size:12px">${esc(a.notes ?? "")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;

  res.send(adminLayout(`Agenda — ${fmtDate(dateStr)}`, "agenda", body, barber?.name));
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
async function renderClientes(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const search = ((req.query.q as string) || "").toLowerCase();
  const allClients = await db.getAllClients();
  const filtered = search
    ? allClients.filter((c: any) => c.name.toLowerCase().includes(search) || (c.phone ?? "").includes(search))
    : allClients;

  const body = `
    <div style="margin-bottom:20px">
      <form method="GET" style="display:flex;gap:12px">
        <input type="text" name="q" value="${esc(search)}" placeholder="Buscar por nome ou telefone..."
          style="flex:1;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
        <button type="submit" class="btn btn-primary">Buscar</button>
        ${search ? `<a href="/admin/clientes" class="btn btn-ghost">Limpar</a>` : ""}
      </form>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">👥 Clientes (${filtered.length})</div>
      </div>
      <div class="card-body">
        ${filtered.length === 0
          ? `<div class="empty">Nenhum cliente encontrado.</div>`
          : `<table>
              <thead><tr><th>Nome</th><th>Telefone</th><th>Email</th><th>Pontos</th><th>Cadastro</th></tr></thead>
              <tbody>
                ${filtered.slice(0, 100).map((c: any) => `
                  <tr>
                    <td><strong>${esc(c.name)}</strong></td>
                    <td>${esc(c.phone ?? "—")}</td>
                    <td style="color:var(--muted)">${esc(c.email ?? "—")}</td>
                    <td><span class="badge badge-gold">${c.loyaltyPoints ?? 0} pts</span></td>
                    <td style="color:var(--muted);font-size:12px">${c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;

  res.send(adminLayout("Clientes", "clientes", body, barber?.name));
}

// ─── Serviços ─────────────────────────────────────────────────────────────────
async function renderServicos(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const services = await db.getAllServicesWithMediaAndRatings();

  const body = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">✂️ Serviços (${services.length})</div>
      </div>
      <div class="card-body">
        ${services.length === 0
          ? `<div class="empty">Nenhum serviço cadastrado. Adicione serviços pelo app mobile.</div>`
          : `<table>
              <thead><tr><th>Nome</th><th>Preço</th><th>Duração</th><th>Avaliação</th><th>Status</th></tr></thead>
              <tbody>
                ${services.map((s) => `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        ${s.thumbnailUrl ? `<img src="${esc(s.thumbnailUrl)}" style="width:36px;height:36px;border-radius:8px;object-fit:cover" />` : `<div style="width:36px;height:36px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px">✂️</div>`}
                        <strong>${esc(s.name)}</strong>
                      </div>
                    </td>
                    <td style="color:var(--gold);font-weight:700">${fmtCurrency(s.price)}</td>
                    <td style="color:var(--muted)">${s.durationMinutes} min</td>
                    <td>${s.avgRating ? `<span style="color:#FBBF24">★ ${s.avgRating}</span> <span style="color:var(--muted);font-size:12px">(${s.reviewCount})</span>` : `<span style="color:var(--muted)">—</span>`}</td>
                    <td>${s.isActive ? `<span class="badge badge-success">Ativo</span>` : `<span class="badge badge-muted">Inativo</span>`}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>
    <p style="color:var(--muted);font-size:13px;margin-top:12px">💡 Para adicionar ou editar serviços, use o app mobile no Painel Administrativo → Serviços.</p>
  `;

  res.send(adminLayout("Serviços", "servicos", body, barber?.name));
}

// ─── Financeiro ───────────────────────────────────────────────────────────────
async function renderFinanceiro(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const { start, end } = monthRange();
  const salesData = await db.getSalesByDateRange(start, end);
  const expenses = await db.getExpensesByDateRange(start, end);

  const totalRevenue = salesData
    .filter((s: any) => s.paymentStatus === "paid")
    .reduce((sum: number, s: any) => sum + parseFloat(s.total), 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
  const profit = totalRevenue - totalExpenses;

  // Agrupamento por dia para o gráfico de barras simples
  const revenueByDay: Record<string, number> = {};
  for (const s of salesData.filter((s: any) => s.paymentStatus === "paid")) {
    const day = new Date(s.createdAt).toISOString().split("T")[0];
    revenueByDay[day] = (revenueByDay[day] ?? 0) + parseFloat(s.total);
  }
  const maxRevDay = Math.max(...Object.values(revenueByDay), 1);

  const body = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Receita do Mês</div>
        <div class="metric-value" style="color:var(--success)">${fmtCurrency(totalRevenue)}</div>
        <div class="metric-sub">${salesData.filter((s: any) => s.paymentStatus === "paid").length} vendas pagas</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Despesas do Mês</div>
        <div class="metric-value" style="color:var(--error)">${fmtCurrency(totalExpenses)}</div>
        <div class="metric-sub">${expenses.length} lançamentos</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Lucro Líquido</div>
        <div class="metric-value" style="color:${profit >= 0 ? "var(--success)" : "var(--error)"}">${fmtCurrency(profit)}</div>
        <div class="metric-sub">receita − despesas</div>
      </div>
    </div>

    ${Object.keys(revenueByDay).length > 0 ? `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">📊 Receita por Dia</div></div>
      <div class="card-body" style="padding:20px">
        <div style="display:flex;align-items:flex-end;gap:4px;height:120px">
          ${Object.entries(revenueByDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, val]) => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="width:100%;background:var(--gold);border-radius:4px 4px 0 0;height:${Math.round((val / maxRevDay) * 100)}px;min-height:4px" title="${fmtCurrency(val)}"></div>
              <div style="font-size:9px;color:var(--muted);writing-mode:vertical-rl;transform:rotate(180deg)">${day.split("-")[2]}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>` : ""}

    <div class="card">
      <div class="card-header"><div class="card-title">🧾 Últimas Vendas</div></div>
      <div class="card-body">
        ${salesData.length === 0
          ? `<div class="empty">Nenhuma venda registrada este mês.</div>`
          : `<table>
              <thead><tr><th>Data</th><th>Total</th><th>Pagamento</th><th>Status</th></tr></thead>
              <tbody>
                ${salesData.slice(0, 50).map((s: any) => `
                  <tr>
                    <td>${new Date(s.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td style="color:var(--gold);font-weight:700">${fmtCurrency(s.total)}</td>
                    <td style="color:var(--muted)">${s.paymentMethod ?? "—"}</td>
                    <td>${s.paymentStatus === "paid" ? `<span class="badge badge-success">Pago</span>` : `<span class="badge badge-warning">Pendente</span>`}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;

  res.send(adminLayout("Financeiro", "financeiro", body, barber?.name));
}

// ─── Configurações ────────────────────────────────────────────────────────────
async function renderConfiguracoes(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const settings = await db.getShopSettings();
  const saved = req.query.saved === "1";

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Configurações salvas com sucesso!</div>` : ""}

    <div class="card">
      <div class="card-header"><div class="card-title">⚙️ Dados da Barbearia</div></div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/configuracoes">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label">Nome da Barbearia</label>
              <input class="form-input" type="text" name="shopName" value="${esc(settings?.shopName ?? "")}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Telefone</label>
              <input class="form-input" type="text" name="phone" value="${esc(settings?.phone ?? "")}" />
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp</label>
              <input class="form-input" type="text" name="whatsapp" value="${esc(settings?.whatsapp ?? "")}" />
            </div>
            <div class="form-group">
              <label class="form-label">Instagram</label>
              <input class="form-input" type="text" name="instagram" value="${esc(settings?.instagram ?? "")}" placeholder="@seuinstagram" />
            </div>
            <div class="form-group">
              <label class="form-label">Endereço</label>
              <input class="form-input" type="text" name="address" value="${esc(settings?.address ?? "")}" />
            </div>
            <div class="form-group">
              <label class="form-label">Número</label>
              <input class="form-input" type="text" name="addressNumber" value="${esc(settings?.addressNumber ?? "")}" />
            </div>
            <div class="form-group">
              <label class="form-label">Complemento</label>
              <input class="form-input" type="text" name="addressComplement" value="${esc(settings?.addressComplement ?? "")}" />
            </div>
            <div class="form-group">
              <label class="form-label">CEP</label>
              <input class="form-input" type="text" name="cep" value="${esc(settings?.cep ?? "")}" />
            </div>
          </div>
          <div class="form-group" style="margin-top:8px">
            <label class="form-label">Link Google Maps</label>
            <input class="form-input" type="text" name="googleMapsUrl" value="${esc(settings?.googleMapsUrl ?? "")}" placeholder="https://maps.google.com/..." />
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">Salvar Configurações</button>
        </form>
      </div>
    </div>
  `;

  res.send(adminLayout("Configurações", "configuracoes", body, barber?.name));
}

// ─── Registro das rotas ───────────────────────────────────────────────────────
export function registerAdminRoutes(app: Express): void {
  // Middleware de parse de cookie simples (sem dependência externa)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!req.cookies) {
      const cookieHeader = req.headers.cookie ?? "";
      const cookies: Record<string, string> = {};
      cookieHeader.split(";").forEach((part) => {
        const [k, ...v] = part.trim().split("=");
        if (k) cookies[k.trim()] = decodeURIComponent(v.join("="));
      });
      (req as any).cookies = cookies;
    }
    next();
  });

  // GET /admin/login
  app.get("/admin/login", (req: Request, res: Response) => {
    const token = (req as any).cookies?.[ADMIN_SESSION_COOKIE];
    if (token && decodeSession(token)) return res.redirect("/admin");
    res.send(loginPage(req.query.error === "1"));
  });

  // POST /admin/login
  app.post("/admin/login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.redirect("/admin/login?error=1");

    let bcrypt: any;
    try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }

    const barber = await db.getBarberByEmail(email);
    if (!barber || !barber.isActive || !barber.passwordHash) return res.redirect("/admin/login?error=1");

    const valid = bcrypt
      ? await bcrypt.compare(password, barber.passwordHash)
      : password === barber.passwordHash;
    if (!valid) return res.redirect("/admin/login?error=1");

    const token = encodeSession(barber.id, barber.role);
    res.setHeader("Set-Cookie", `${ADMIN_SESSION_COOKIE}=${token}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
    res.redirect("/admin");
  });

  // GET /admin/logout
  app.get("/admin/logout", (_req: Request, res: Response) => {
    res.setHeader("Set-Cookie", `${ADMIN_SESSION_COOKIE}=; Path=/admin; HttpOnly; Max-Age=0`);
    res.redirect("/admin/login");
  });

  // POST /admin/configuracoes (salvar)
  app.post("/admin/configuracoes", requireAdminAuth, async (req: Request, res: Response) => {
    const { shopName, phone, whatsapp, instagram, address, addressNumber, addressComplement, cep, googleMapsUrl } = req.body ?? {};
    await db.upsertShopSettings({ shopName, phone, whatsapp, instagram, address, addressNumber, addressComplement, cep, googleMapsUrl });
    res.redirect("/admin/configuracoes?saved=1");
  });

  // Rotas protegidas
  app.get("/admin", requireAdminAuth, (req, res) => renderDashboard(req, res));
  app.get("/admin/agenda", requireAdminAuth, (req, res) => renderAgenda(req, res));
  app.get("/admin/clientes", requireAdminAuth, (req, res) => renderClientes(req, res));
  app.get("/admin/servicos", requireAdminAuth, (req, res) => renderServicos(req, res));
  app.get("/admin/financeiro", requireAdminAuth, (req, res) => renderFinanceiro(req, res));
  app.get("/admin/configuracoes", requireAdminAuth, (req, res) => renderConfiguracoes(req, res));
}
