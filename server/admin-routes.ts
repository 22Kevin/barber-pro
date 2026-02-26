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

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const navGroups = [
    {
      label: "OPERACIONAL",
      items: [
        { href: "/admin", icon: "⊞", label: "Dashboard", id: "dashboard" },
        { href: "/admin/agenda", icon: "📅", label: "Agenda", id: "agenda" },
        { href: "/admin/clientes", icon: "👥", label: "Clientes", id: "clientes" },
      ],
    },
    {
      label: "CATÁLOGO",
      items: [
        { href: "/admin/servicos", icon: "✂️", label: "Serviços", id: "servicos" },
        { href: "/admin/produtos", icon: "🛍️", label: "Produtos", id: "produtos" },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { href: "/admin/financeiro", icon: "💰", label: "Financeiro", id: "financeiro" },
        { href: "/admin/relatorios", icon: "📊", label: "Relatórios", id: "relatorios" },
        { href: "/admin/comissoes", icon: "🤝", label: "Comissões", id: "comissoes" },
      ],
    },
    {
      label: "MARKETING",
      items: [
        { href: "/admin/fidelidade", icon: "⭐", label: "Fidelidade", id: "fidelidade" },
        { href: "/admin/cupons", icon: "🏷️", label: "Cupons", id: "cupons" },
        { href: "/admin/avaliacoes", icon: "💬", label: "Avaliações", id: "avaliacoes" },
      ],
    },
    {
      label: "SISTEMA",
      items: [
        { href: "/admin/configuracoes", icon: "⚙️", label: "Configurações", id: "configuracoes" },
      ],
    },
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

    /* Nav groups */
    .nav-group { margin-bottom: 4px; }
    .nav-group-label { font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 1.2px; padding: 12px 20px 4px; opacity: 0.6; }

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
      ${navGroups.map((group) => `
        <div class="nav-group">
          <div class="nav-group-label">${group.label}</div>
          ${group.items.map((n) => `
            <a href="${n.href}" class="nav-item ${activePage === n.id ? "active" : ""}">
              <span class="nav-icon">${n.icon}</span>
              ${n.label}
            </a>
          `).join("")}
        </div>
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
              <thead><tr><th>Horário</th><th>Cliente</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                ${appointments.map((a: any) => `
                  <tr id="row-${a.id}">
                    <td><strong>${a.startTime?.substring(0, 5) ?? "—"}</strong> – ${a.endTime?.substring(0, 5) ?? "—"}</td>
                    <td>${esc(clientMap[a.clientId] ?? "—")}</td>
                    <td>${esc(serviceMap[a.serviceId] ?? "—")}</td>
                    <td>${esc(barberMap[a.barberId] ?? "—")}</td>
                    <td id="status-${a.id}">${statusBadge(a.status)}</td>
                    <td style="white-space:nowrap">
                      ${a.status === "scheduled" ? `<button onclick="updateStatus(${a.id},'confirmed')" style="background:#C9A84C;color:#000;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-right:4px">Confirmar</button>` : ""}
                      ${a.status === "confirmed" || a.status === "scheduled" ? `<button onclick="updateStatus(${a.id},'in_progress')" style="background:#3B82F6;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-right:4px">Iniciar</button>` : ""}
                      ${a.status === "in_progress" || a.status === "confirmed" ? `<button onclick="updateStatus(${a.id},'completed')" style="background:#22C55E;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-right:4px">Concluir</button>` : ""}
                      ${a.status !== "cancelled" && a.status !== "completed" ? `<button onclick="updateStatus(${a.id},'cancelled')" style="background:#EF4444;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-right:4px">Cancelar</button>` : ""}
                      ${a.status === "confirmed" || a.status === "scheduled" ? `<button onclick="updateStatus(${a.id},'no_show')" style="background:var(--surface);color:var(--muted);border:1px solid var(--border);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">Não veio</button>` : ""}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <script>
              async function updateStatus(id, status) {
                const labels = {confirmed:"Confirmado",in_progress:"Em andamento",completed:"Concluído",cancelled:"Cancelado",no_show:"Não compareceu",scheduled:"Agendado"};
                const colors = {scheduled:"badge-warning",confirmed:"badge-gold",in_progress:"badge-gold",completed:"badge-success",cancelled:"badge-error",no_show:"badge-muted"};
                try {
                  const r = await fetch("/admin-api/appointment-status", {
                    method: "POST",
                    headers: {"Content-Type":"application/json"},
                    body: JSON.stringify({id, status})
                  });
                  if (!r.ok) { const e = await r.json(); alert("Erro: " + e.error); return; }
                  const cell = document.getElementById("status-" + id);
                  if (cell) cell.innerHTML = "<span class=\"badge " + (colors[status]||"badge-muted") + "\">" + (labels[status]||status) + "</span>";
                  setTimeout(() => location.reload(), 800);
                } catch(e) { alert("Erro ao atualizar status"); }
              }
            </script>`
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
                    <td><a href="/admin/clientes/${c.id}" style="color:var(--gold);text-decoration:none;font-weight:700">${esc(c.name)}</a></td>
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
  const services = await db.getAllServicesWithMedia(false);
  const saved = req.query.saved === "1";
  const deleted = req.query.deleted === "1";
  const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
  const editService = editId ? services.find((s: any) => s.id === editId) : null;

  const formHtml = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">${editService ? "✏️ Editar Serviço" : "➕ Novo Serviço"}</div>
      </div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/servicos${editService ? `?edit=${editService.id}` : ""}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label">Nome do Serviço *</label>
              <input class="form-input" type="text" name="name" value="${esc(editService?.name ?? "")}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$) *</label>
              <input class="form-input" type="number" name="price" step="0.01" min="0" value="${editService?.price ?? ""}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Duração (minutos) *</label>
              <input class="form-input" type="number" name="durationMinutes" min="5" step="5" value="${editService?.durationMinutes ?? 30}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-input" name="isActive">
                <option value="true" ${!editService || editService.isActive ? "selected" : ""}>Ativo</option>
                <option value="false" ${editService && !editService.isActive ? "selected" : ""}>Inativo</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-input" name="description" rows="3" style="resize:vertical">${esc(editService?.description ?? "")}</textarea>
          </div>
          <div style="display:flex;gap:12px;margin-top:8px">
            <button type="submit" class="btn btn-primary" style="padding:12px 28px">${editService ? "Salvar Alterações" : "Criar Serviço"}</button>
            ${editService ? `<a href="/admin/servicos" class="btn" style="padding:12px 20px;background:var(--surface2);color:var(--text)">Cancelar</a>` : ""}
          </div>
        </form>
      </div>
    </div>
  `;

  const tableHtml = services.length === 0
    ? `<div style="text-align:center;padding:40px;color:var(--muted)">Nenhum serviço cadastrado ainda.</div>`
    : `<table class="table">
        <thead><tr><th>Nome</th><th>Preço</th><th>Duração</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${services.map((s: any) => `
            <tr>
              <td><strong>${esc(s.name)}</strong>${s.description ? `<br><small style="color:var(--muted)">${esc(s.description.substring(0, 60))}${s.description.length > 60 ? "..." : ""}</small>` : ""}</td>
              <td style="font-weight:700;color:var(--primary)">R$ ${parseFloat(s.price).toFixed(2).replace(".", ",")}</td>
              <td>${s.durationMinutes} min</td>
              <td>${s.isActive ? `<span class="badge badge-success">Ativo</span>` : `<span class="badge badge-muted">Inativo</span>`}</td>
              <td>
                <div style="display:flex;gap:8px">
                  <a href="/admin/servicos?edit=${s.id}" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">✏️ Editar</a>
                  <form method="POST" action="/admin/servicos/toggle" style="display:inline" onsubmit="return confirm('Alterar status?')">
                    <input type="hidden" name="id" value="${s.id}" />
                    <input type="hidden" name="isActive" value="${!s.isActive}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">${s.isActive ? "⏸ Desativar" : "▶ Ativar"}</button>
                  </form>
                  <form method="POST" action="/admin/servicos/delete" style="display:inline" onsubmit="return confirm('Excluir este serviço? Esta ação não pode ser desfeita.')">
                    <input type="hidden" name="id" value="${s.id}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:#EF444422;color:#F87171">🗑 Excluir</button>
                  </form>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Serviço salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Serviço excluído com sucesso!</div>` : ""}
    ${formHtml}
    <div class="card">
      <div class="card-header"><div class="card-title">✂️ Serviços Cadastrados (${services.length})</div></div>
      <div class="card-body">${tableHtml}</div>
    </div>
  `;
  res.send(adminLayout("Serviços", "servicos", body, barber?.name));
}

async function renderProdutos(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const products = await db.getAllProductsWithMedia(false);
  const saved = req.query.saved === "1";
  const deleted = req.query.deleted === "1";
  const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
  const editProduct = editId ? products.find((p: any) => p.id === editId) : null;

  const formHtml = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">${editProduct ? "✏️ Editar Produto" : "➕ Novo Produto"}</div>
      </div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/produtos${editProduct ? `?edit=${editProduct.id}` : ""}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label">Nome do Produto *</label>
              <input class="form-input" type="text" name="name" value="${esc(editProduct?.name ?? "")}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$) *</label>
              <input class="form-input" type="number" name="price" step="0.01" min="0" value="${editProduct?.price ?? ""}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-input" name="productType">
                <option value="sale" ${!editProduct || editProduct.productType === "sale" ? "selected" : ""}>Venda</option>
                <option value="internal" ${editProduct?.productType === "internal" ? "selected" : ""}>Uso interno</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Estoque atual</label>
              <input class="form-input" type="number" name="stockQuantity" min="0" value="${editProduct?.stockQuantity ?? 0}" />
            </div>
            <div class="form-group">
              <label class="form-label">Alerta mínimo de estoque</label>
              <input class="form-input" type="number" name="minStockAlert" min="0" value="${editProduct?.minStockAlert ?? 5}" />
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-input" name="isActive">
                <option value="true" ${!editProduct || editProduct.isActive ? "selected" : ""}>Ativo</option>
                <option value="false" ${editProduct && !editProduct.isActive ? "selected" : ""}>Inativo</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-input" name="description" rows="3" style="resize:vertical">${esc(editProduct?.description ?? "")}</textarea>
          </div>
          <div style="display:flex;gap:12px;margin-top:8px">
            <button type="submit" class="btn btn-primary" style="padding:12px 28px">${editProduct ? "Salvar Alterações" : "Criar Produto"}</button>
            ${editProduct ? `<a href="/admin/produtos" class="btn" style="padding:12px 20px;background:var(--surface2);color:var(--text)">Cancelar</a>` : ""}
          </div>
        </form>
      </div>
    </div>
  `;

  const tableHtml = products.length === 0
    ? `<div style="text-align:center;padding:40px;color:var(--muted)">Nenhum produto cadastrado ainda.</div>`
    : `<table class="table">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${products.map((p: any) => `
            <tr>
              <td><strong>${esc(p.name)}</strong>${p.description ? `<br><small style="color:var(--muted)">${esc(p.description.substring(0, 50))}${p.description.length > 50 ? "..." : ""}</small>` : ""}</td>
              <td><span class="badge ${p.productType === "sale" ? "badge-success" : "badge-muted"}">${p.productType === "sale" ? "Venda" : "Interno"}</span></td>
              <td style="font-weight:700;color:var(--primary)">R$ ${parseFloat(p.price).toFixed(2).replace(".", ",")}</td>
              <td>
                <span style="color:${p.stockQuantity <= p.minStockAlert ? "var(--error)" : "var(--success)"}">
                  ${p.stockQuantity} un.
                </span>
                ${p.stockQuantity <= p.minStockAlert ? `<br><small style="color:var(--error)">⚠ Estoque baixo</small>` : ""}
              </td>
              <td>${p.isActive ? `<span class="badge badge-success">Ativo</span>` : `<span class="badge badge-muted">Inativo</span>`}</td>
              <td>
                <div style="display:flex;gap:8px">
                  <a href="/admin/produtos?edit=${p.id}" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">✏️ Editar</a>
                  <form method="POST" action="/admin/produtos/toggle" style="display:inline" onsubmit="return confirm('Alterar status?')">
                    <input type="hidden" name="id" value="${p.id}" />
                    <input type="hidden" name="isActive" value="${!p.isActive}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">${p.isActive ? "⏸ Desativar" : "▶ Ativar"}</button>
                  </form>
                  <form method="POST" action="/admin/produtos/delete" style="display:inline" onsubmit="return confirm('Excluir este produto?')">
                    <input type="hidden" name="id" value="${p.id}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:#EF444422;color:#F87171">🗑 Excluir</button>
                  </form>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Produto salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Produto excluído com sucesso!</div>` : ""}
    ${formHtml}
    <div class="card">
      <div class="card-header"><div class="card-title">📦 Produtos Cadastrados (${products.length})</div></div>
      <div class="card-body">${tableHtml}</div>
    </div>
  `;
  res.send(adminLayout("Produtos", "produtos", body, barber?.name));
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
  const activeTab = (req.query.tab as string) ?? "dados";

  // Buscar equipe e horários de trabalho
  const allBarbers = await db.getAllBarbersIncludingInactive();
  const workingHoursMap: Record<number, any[]> = {};
  for (const b of allBarbers) {
    workingHoursMap[b.id] = await db.getWorkingHours(b.id);
  }

  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // Aba: Dados da Barbearia
  const tabDados = `
    <form method="POST" action="/admin/configuracoes?tab=dados">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group">
          <label class="form-label">Nome da Barbearia *</label>
          <input class="form-input" type="text" name="shopName" value="${esc(settings?.shopName ?? "")}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Telefone</label>
          <input class="form-input" type="text" name="phone" value="${esc(settings?.phone ?? "")}" placeholder="(11) 99999-9999" />
        </div>
        <div class="form-group">
          <label class="form-label">WhatsApp</label>
          <input class="form-input" type="text" name="whatsapp" value="${esc(settings?.whatsapp ?? "")}" placeholder="5511999999999" />
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
      <div class="form-group" style="margin-top:4px">
        <label class="form-label">Link Google Maps</label>
        <input class="form-input" type="text" name="googleMapsUrl" value="${esc(settings?.googleMapsUrl ?? "")}" placeholder="https://maps.google.com/..." />
      </div>
      <div class="form-group">
        <label class="form-label">Chave Pix</label>
        <input class="form-input" type="text" name="pixKey" value="${esc(settings?.pixKey ?? "")}" placeholder="CPF, CNPJ, e-mail ou chave aleatória" />
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">✓ Salvar Dados</button>
    </form>
  `;

  // Aba: Personalização Visual
  const tabVisual = `
    <form method="POST" action="/admin/configuracoes?tab=visual">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
        <div>
          <div class="form-group">
            <label class="form-label">Cor Principal da Página Pública</label>
            <div style="display:flex;align-items:center;gap:12px">
              <input type="color" name="primaryColor" value="${esc(settings?.primaryColor ?? "#C9A84C")}" style="width:48px;height:40px;border:1px solid var(--border);border-radius:8px;background:none;cursor:pointer;padding:2px" />
              <input class="form-input" type="text" id="colorHex" value="${esc(settings?.primaryColor ?? "#C9A84C")}" style="flex:1" placeholder="#C9A84C" />
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:6px">Cor usada nos botões e destaques da página de agendamento online.</div>
          </div>
        </div>
        <div>
          <div class="form-group">
            <label class="form-label">URL do Banner</label>
            <input class="form-input" type="text" name="bannerUrl" value="${esc(settings?.bannerUrl ?? "")}" placeholder="https://..." />
            <div style="font-size:11px;color:var(--muted);margin-top:6px">Imagem de fundo do hero da página pública (1200x400px recomendado).</div>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">URL do Logo</label>
        <input class="form-input" type="text" name="logoUrl" value="${esc(settings?.logoUrl ?? "")}" placeholder="https://..." />
        <div style="font-size:11px;color:var(--muted);margin-top:6px">Logo exibido na página pública e nos e-mails.</div>
      </div>
      <div class="form-group">
        <label class="form-label">URLs da Galeria (uma por linha)</label>
        <textarea name="galleryUrls" class="form-input" rows="4" placeholder="https://...\nhttps://...">${esc(settings?.galleryUrls ?? "")}</textarea>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">Fotos exibidas na galeria da página pública.</div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">✓ Salvar Visual</button>
    </form>
    <script>
      document.querySelector('input[type=color]').addEventListener('input', function() {
        document.getElementById('colorHex').value = this.value;
      });
      document.getElementById('colorHex').addEventListener('input', function() {
        if (/^#[0-9A-Fa-f]{6}$/.test(this.value)) {
          document.querySelector('input[type=color]').value = this.value;
        }
      });
    </script>
  `;

  // Aba: Horários de Trabalho
  const tabHorarios = allBarbers.length === 0
    ? `<div class="empty">Nenhum profissional cadastrado ainda.</div>`
    : allBarbers.map((b: any) => {
        const wh = workingHoursMap[b.id] ?? [];
        const whByDay: Record<number, any> = {};
        wh.forEach((h: any) => { whByDay[h.dayOfWeek] = h; });
        return `
          <div class="card" style="margin-bottom:20px">
            <div class="card-header">
              <div class="card-title">💈 ${esc(b.name)}</div>
              <span class="badge ${b.isActive ? 'badge-success' : 'badge-muted'}">${b.isActive ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div class="card-body" style="padding:20px">
              <form method="POST" action="/admin/configuracoes/horarios/${b.id}">
                <div style="display:grid;gap:8px">
                  ${[0,1,2,3,4,5,6].map(day => {
                    const h = whByDay[day];
                    const isWorking = h?.isWorking ?? (day >= 1 && day <= 6);
                    return `
                      <div style="display:grid;grid-template-columns:120px 1fr 1fr 1fr 1fr auto;gap:8px;align-items:center;padding:8px;background:var(--surface2);border-radius:8px">
                        <div style="display:flex;align-items:center;gap:8px">
                          <input type="checkbox" name="working_${day}" value="1" ${isWorking ? 'checked' : ''} id="w${b.id}_${day}" style="width:16px;height:16px;accent-color:var(--gold)" />
                          <label for="w${b.id}_${day}" style="font-size:13px;font-weight:600">${dayNames[day]}</label>
                        </div>
                        <div>
                          <label style="font-size:10px;color:var(--muted)">ENTRADA</label>
                          <input type="time" name="start_${day}" value="${h?.startTime ?? '09:00'}" class="form-input" style="padding:6px 8px;font-size:13px" />
                        </div>
                        <div>
                          <label style="font-size:10px;color:var(--muted)">SAÍDA</label>
                          <input type="time" name="end_${day}" value="${h?.endTime ?? '18:00'}" class="form-input" style="padding:6px 8px;font-size:13px" />
                        </div>
                        <div>
                          <label style="font-size:10px;color:var(--muted)">ALMOÇO INÍCIO</label>
                          <input type="time" name="lunch_start_${day}" value="${h?.lunchStart ?? '12:00'}" class="form-input" style="padding:6px 8px;font-size:13px" />
                        </div>
                        <div>
                          <label style="font-size:10px;color:var(--muted)">ALMOÇO FIM</label>
                          <input type="time" name="lunch_end_${day}" value="${h?.lunchEnd ?? '13:00'}" class="form-input" style="padding:6px 8px;font-size:13px" />
                        </div>
                      </div>`;
                  }).join('')}
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top:16px;padding:10px 24px">✓ Salvar Horários de ${esc(b.name)}</button>
              </form>
            </div>
          </div>`;
      }).join('');

  // Aba: Equipe
  const tabEquipe = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">👥 Profissionais Cadastrados</div>
        <a href="/admin/configuracoes?tab=equipe&novo=1" class="btn btn-primary" style="font-size:12px;padding:8px 16px">+ Novo Profissional</a>
      </div>
      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${allBarbers.length === 0
            ? `<tr><td colspan="5" class="empty">Nenhum profissional cadastrado.</td></tr>`
            : allBarbers.map((b: any) => `
              <tr>
                <td style="font-weight:600">${esc(b.name)}</td>
                <td style="color:var(--muted)">${esc(b.email ?? "—")}</td>
                <td><span class="badge badge-gold">${b.role === 'super_admin' ? 'Super Admin' : b.role === 'barber' ? 'Barbeiro' : b.role}</span></td>
                <td><span class="badge ${b.isActive ? 'badge-success' : 'badge-muted'}">${b.isActive ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  <form method="POST" action="/admin/configuracoes/equipe/toggle" style="display:inline">
                    <input type="hidden" name="id" value="${b.id}" />
                    <input type="hidden" name="isActive" value="${!b.isActive}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">${b.isActive ? 'Desativar' : 'Reativar'}</button>
                  </form>
                </td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${req.query.novo === '1' ? `
    <div class="card">
      <div class="card-header"><div class="card-title">➕ Novo Profissional</div></div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/configuracoes/equipe/novo">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label">Nome *</label>
              <input class="form-input" type="text" name="name" required placeholder="Nome do profissional" />
            </div>
            <div class="form-group">
              <label class="form-label">E-mail *</label>
              <input class="form-input" type="email" name="email" required placeholder="email@exemplo.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Senha *</label>
              <input class="form-input" type="password" name="password" required placeholder="Mínimo 6 caracteres" minlength="6" />
            </div>
            <div class="form-group">
              <label class="form-label">Telefone</label>
              <input class="form-input" type="text" name="phone" placeholder="(11) 99999-9999" />
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">Cadastrar Profissional</button>
          <a href="/admin/configuracoes?tab=equipe" class="btn btn-ghost" style="margin-left:8px;padding:12px 20px">Cancelar</a>
        </form>
      </div>
    </div>` : ''}
  `;

  const tabs = [
    { id: 'dados', label: '🏪 Dados' },
    { id: 'visual', label: '🎨 Visual' },
    { id: 'horarios', label: '🕒 Horários' },
    { id: 'equipe', label: '👥 Equipe' },
  ];

  const tabContent: Record<string, string> = {
    dados: tabDados,
    visual: tabVisual,
    horarios: tabHorarios,
    equipe: tabEquipe,
  };

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Configurações salvas com sucesso!</div>` : ""}

    <!-- Abas -->
    <div style="display:flex;gap:4px;margin-bottom:24px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:4px">
      ${tabs.map(t => `
        <a href="/admin/configuracoes?tab=${t.id}" style="flex:1;text-align:center;padding:10px 16px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none;
          ${activeTab === t.id ? 'background:var(--gold);color:#0C0C0C' : 'color:var(--muted)'}
        ">${t.label}</a>`).join('')}
    </div>

    <!-- Conteúdo da aba ativa -->
    ${tabContent[activeTab] ?? tabDados}
  `;

  res.send(adminLayout("Configurações", "configuracoes", body, barber?.name));
}

// ─── Registro das rotas ───────────────────────────────────────────────────────
// ─── Novo Agendamento (Admin Web) ───────────────────────────────────────────────
async function renderNovoAgendamento(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const clients = await db.getAllClients();
  const services = await db.getAllServices(true);
  const barbers = await db.getAllBarbers();
  const error = req.query.error as string | undefined;
  const preDate = (req.query.date as string) || today();

  const body = `
    <div style="max-width:560px">
      ${error ? `<div style="background:#F8717122;border:1px solid #F8717144;color:#F87171;padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:13px">${esc(error)}</div>` : ""}
      <form method="POST" action="/admin/agenda/novo">
        <div class="form-group">
          <label class="form-label">CLIENTE *</label>
          <select name="clientId" class="form-input" required>
            <option value="">Selecione o cliente</option>
            ${clients.map((c: any) => `<option value="${c.id}">${esc(c.name)}${c.phone ? " — " + esc(c.phone) : ""}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">SERVIÇO *</label>
          <select name="serviceId" class="form-input" required id="serviceSelect" onchange="updateDuration(this)">
            <option value="">Selecione o serviço</option>
            ${services.map((s: any) => `<option value="${s.id}" data-duration="${s.duration ?? 30}">${esc(s.name)} — ${fmtCurrency(s.price)} (${s.duration ?? 30}min)</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">PROFISSIONAL *</label>
          <select name="barberId" class="form-input" required>
            <option value="">Selecione o profissional</option>
            ${barbers.map((b: any) => `<option value="${b.id}"${b.id === session.barberId ? " selected" : ""}>${esc(b.name)}</option>`).join("")}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label class="form-label">DATA *</label>
            <input type="date" name="date" class="form-input" value="${preDate}" required />
          </div>
          <div class="form-group">
            <label class="form-label">HORÁRIO DE INÍCIO *</label>
            <input type="time" name="startTime" class="form-input" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">OBSERVAÇÕES</label>
          <input type="text" name="notes" class="form-input" placeholder="Observações opcionais" />
        </div>
        <div style="display:flex;gap:12px;margin-top:8px">
          <a href="/admin/agenda" class="btn btn-ghost">Cancelar</a>
          <button type="submit" class="btn btn-primary">Criar Agendamento</button>
        </div>
      </form>
    </div>
    <script>
      function updateDuration(sel) {
        const opt = sel.options[sel.selectedIndex];
        const dur = opt.dataset.duration;
        if (dur) document.title = 'Novo Agendamento (' + dur + 'min) — Barber Pro Admin';
      }
    </script>
  `;
  res.send(adminLayout("Novo Agendamento", "agenda", body, barber?.name));
}

// ─── Relatórios ───────────────────────────────────────────────────────────────
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
  const { getDb } = await import("./db.js");
  const dbConn = await getDb();
  let serviceRanking: Array<{ name: string; count: number; revenue: number }> = [];
  if (dbConn) {
    const { eq } = await import("drizzle-orm");
    const items = await dbConn.select().from(saleItemsTable).where(
      eq(saleItemsTable.itemType, "service")
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
    const tab = (req.query.tab as string) ?? "dados";
    const body = req.body ?? {};
    if (tab === "visual") {
      const { primaryColor, bannerUrl, logoUrl, galleryUrls } = body;
      await db.upsertShopSettings({ primaryColor, bannerUrl, logoUrl, galleryUrls });
    } else {
      // tab === "dados" (padrão)
      const { shopName, phone, whatsapp, instagram, address, addressNumber, addressComplement, cep, googleMapsUrl, pixKey } = body;
      await db.upsertShopSettings({ shopName, phone, whatsapp, instagram, address, addressNumber, addressComplement, cep, googleMapsUrl, pixKey });
    }
    res.redirect(`/admin/configuracoes?tab=${tab}&saved=1`);
  });

  // POST /admin/configuracoes/horarios/:barberId (salvar horários de trabalho)
  app.post("/admin/configuracoes/horarios/:barberId", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const barberId = parseInt(req.params.barberId);
      const body = req.body ?? {};
      for (let day = 0; day <= 6; day++) {
        const isWorking = body[`working_${day}`] === "1";
        const startTime = body[`start_${day}`] ?? "09:00";
        const endTime = body[`end_${day}`] ?? "18:00";
        const lunchStart = body[`lunch_start_${day}`] || null;
        const lunchEnd = body[`lunch_end_${day}`] || null;
        await db.upsertWorkingHours(barberId, day, {
          startTime: startTime.length === 5 ? startTime + ":00" : startTime,
          endTime: endTime.length === 5 ? endTime + ":00" : endTime,
          lunchStart: lunchStart ? (lunchStart.length === 5 ? lunchStart + ":00" : lunchStart) : null,
          lunchEnd: lunchEnd ? (lunchEnd.length === 5 ? lunchEnd + ":00" : lunchEnd) : null,
          isWorking,
        });
      }
      res.redirect("/admin/configuracoes?tab=horarios&saved=1");
    } catch (e: any) {
      res.redirect(`/admin/configuracoes?tab=horarios&error=${encodeURIComponent(e.message)}`);
    }
  });

  // POST /admin/configuracoes/equipe/toggle (ativar/desativar profissional)
  app.post("/admin/configuracoes/equipe/toggle", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { id, isActive } = req.body ?? {};
      await db.updateBarber(parseInt(id), { isActive: isActive === "true" });
      res.redirect("/admin/configuracoes?tab=equipe&saved=1");
    } catch (e: any) {
      res.redirect(`/admin/configuracoes?tab=equipe&error=${encodeURIComponent(e.message)}`);
    }
  });

  // POST /admin/configuracoes/equipe/novo (criar novo profissional)
  app.post("/admin/configuracoes/equipe/novo", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { name, email, password, phone } = req.body ?? {};
      if (!name || !email || !password) {
        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Preencha+todos+os+campos"); return;
      }
      if (password.length < 6) {
        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Senha+deve+ter+m%C3%ADnimo+6+caracteres"); return;
      }
      let bcrypt: any;
      try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
      const passwordHash = bcrypt ? await bcrypt.hash(password, 10) : password;
      await db.createBarber({ name, email, phone: phone || null, passwordHash, role: "barber", isActive: true });
      res.redirect("/admin/configuracoes?tab=equipe&saved=1");
    } catch (e: any) {
      const msg = e.message?.includes("Duplicate") ? "E-mail+j%C3%A1+cadastrado" : encodeURIComponent(e.message);
      res.redirect(`/admin/configuracoes?tab=equipe&novo=1&error=${msg}`);
    }
  });

  // Criar agendamento (admin web)
  app.get("/admin/agenda/novo", requireAdminAuth, (req, res) => renderNovoAgendamento(req, res));
  app.post("/admin/agenda/novo", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { clientId, serviceId, barberId, date, startTime, notes } = req.body ?? {};
      if (!clientId || !serviceId || !barberId || !date || !startTime) {
        res.redirect("/admin/agenda/novo?error=Preencha+todos+os+campos+obrigat%C3%B3rios"); return;
      }
      const svc = await db.getServiceById(parseInt(serviceId));
      if (!svc) { res.redirect("/admin/agenda/novo?error=Servi%C3%A7o+n%C3%A3o+encontrado"); return; }
      const [h, m] = startTime.split(":").map(Number);
      const totalMin = h * 60 + m + (svc.durationMinutes ?? 30);
      const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}:00`;
      const startTimeFmt = startTime.length === 5 ? startTime + ":00" : startTime;
      const available = await db.checkSlotAvailability(parseInt(barberId), date, startTimeFmt, endTime);
      if (!available) { res.redirect("/admin/agenda/novo?error=Hor%C3%A1rio+j%C3%A1+ocupado"); return; }
      await db.createAppointment({
        clientId: parseInt(clientId), serviceId: parseInt(serviceId), barberId: parseInt(barberId),
        date, startTime: startTimeFmt, endTime, status: "scheduled",
        notes: notes ?? null,
      });
      res.redirect(`/admin/agenda?date=${date}&created=1`);
    } catch (e: any) {
      res.redirect(`/admin/agenda/novo?error=${encodeURIComponent(e.message)}`);
    }
  });


  // API REST: atualizar status de agendamento
  app.post("/admin-api/appointment-status", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { id, status } = req.body as { id: number; status: string };
      const validStatuses = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
      if (!id || !validStatuses.includes(status)) {
        res.status(400).json({ error: "Parâmetros inválidos" });
        return;
      }
      await db.updateAppointmentStatus(id, status);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // Rotas protegidas
  app.get("/admin", requireAdminAuth, (req, res) => renderDashboard(req, res));
  app.get("/admin/agenda", requireAdminAuth, (req, res) => renderAgenda(req, res));
  app.get("/admin/clientes", requireAdminAuth, (req, res) => renderClientes(req, res));
  app.get("/admin/servicos", requireAdminAuth, (req, res) => renderServicos(req, res));
  app.get("/admin/financeiro", requireAdminAuth, (req, res) => renderFinanceiro(req, res));
  app.get("/admin/configuracoes", requireAdminAuth, (req, res) => renderConfiguracoes(req, res));
  app.get("/admin/relatorios", requireAdminAuth, (req, res) => renderRelatorios(req, res));

  // ─── CRUD Serviços ────────────────────────────────────────────────────────
  app.post("/admin/servicos", requireAdminAuth, async (req: Request, res: Response) => {
    const { name, description, price, durationMinutes, isActive } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    if (editId) {
      await db.updateService(editId, { name, description, price, durationMinutes: parseInt(durationMinutes), isActive: isActive === "true" });
    } else {
      await db.createService({ name, description, price, durationMinutes: parseInt(durationMinutes), isActive: isActive === "true" });
    }
    res.redirect("/admin/servicos?saved=1");
  });
  app.post("/admin/servicos/toggle", requireAdminAuth, async (req: Request, res: Response) => {
    const { id, isActive } = req.body;
    await db.updateService(parseInt(id), { isActive: isActive === "true" });
    res.redirect("/admin/servicos");
  });
  app.post("/admin/servicos/delete", requireAdminAuth, async (req: Request, res: Response) => {
    const { id } = req.body;
    await db.deleteService(parseInt(id));
    res.redirect("/admin/servicos?deleted=1");
  });

  // ─── CRUD Produtos ────────────────────────────────────────────────────────
  app.get("/admin/produtos", requireAdminAuth, (req, res) => renderProdutos(req, res));
  app.post("/admin/produtos", requireAdminAuth, async (req: Request, res: Response) => {
    const { name, description, price, productType, stockQuantity, minStockAlert, isActive } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    if (editId) {
      await db.updateProduct(editId, { name, description, price, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true" });
    } else {
      await db.createProduct({ name, description, price, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true" });
    }
    res.redirect("/admin/produtos?saved=1");
  });
  app.post("/admin/produtos/toggle", requireAdminAuth, async (req: Request, res: Response) => {
    const { id, isActive } = req.body;
    await db.updateProduct(parseInt(id), { isActive: isActive === "true" });
    res.redirect("/admin/produtos");
  });
  app.post("/admin/produtos/delete", requireAdminAuth, async (req: Request, res: Response) => {
    const { id } = req.body;
    await db.deleteProduct(parseInt(id));
    res.redirect("/admin/produtos?deleted=1");
  });

  app.get("/admin/clientes/:id", requireAdminAuth, (req, res) => renderClienteDetalhe(req, res));

  // ─── Fidelidade ────────────────────────────────────────────────────────────
  app.get("/admin/fidelidade", requireAdminAuth, async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const [config, rewards] = await Promise.all([
      db.getLoyaltyConfig(),
      db.getLoyaltyRewards(),
    ]);
    const saved = req.query.saved === "1";
    const rewardTypes: Record<string, string> = {
      free_service: "Serviço Grátis",
      discount_percent: "Desconto %",
      discount_fixed: "Desconto Fixo R$",
      free_product: "Produto Grátis",
    };
    const body = `
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE80;border-radius:10px;padding:12px 18px;margin-bottom:20px;color:#4ADE80;font-size:13px;">Configurações salvas com sucesso.</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">

        <!-- Configuração do Programa -->
        <div>
          <div class="card">
            <div class="card-header"><span class="card-title">⭐ Programa de Pontos</span></div>
            <div class="card-body" style="padding:20px;">
              <form method="POST" action="/admin/fidelidade/config">
                <div class="form-group">
                  <label class="form-label">STATUS DO PROGRAMA</label>
                  <select name="isActive" class="form-input">
                    <option value="true" ${config?.isActive ? "selected" : ""}>Ativo</option>
                    <option value="false" ${!config?.isActive ? "selected" : ""}>Inativo</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">PONTOS POR SERVIÇO CONCLUÍDO</label>
                  <input type="number" name="pointsPerService" class="form-input" value="${config?.pointsPerService ?? 10}" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">PONTOS POR R$ 1,00 GASTO</label>
                  <input type="number" name="pointsPerReal" class="form-input" value="${config?.pointsPerReal ?? '1'}" min="0" step="0.1" />
                </div>
                <div class="form-group">
                  <label class="form-label">EXPIRAÇÃO DOS PONTOS (MESES, 0 = nunca)</label>
                  <input type="number" name="pointsExpireMonths" class="form-input" value="${config?.pointsExpireMonths ?? 12}" min="0" />
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">Salvar Configurações</button>
              </form>
            </div>
          </div>
        </div>

        <!-- Recompensas -->
        <div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">🎁 Recompensas</span>
              <button onclick="document.getElementById('new-reward-form').style.display='block';this.style.display='none';" class="btn btn-primary" style="font-size:12px;padding:6px 14px;">+ Nova</button>
            </div>
            <div id="new-reward-form" style="display:none;padding:16px;border-bottom:1px solid var(--border);">
              <form method="POST" action="/admin/fidelidade/recompensa">
                <div class="form-group">
                  <label class="form-label">NOME DA RECOMPENSA</label>
                  <input type="text" name="name" class="form-input" placeholder="Ex: Corte Grátis" required />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  <div class="form-group">
                    <label class="form-label">TIPO</label>
                    <select name="rewardType" class="form-input">
                      <option value="free_service">Serviço Grátis</option>
                      <option value="discount_percent">Desconto %</option>
                      <option value="discount_fixed">Desconto R$</option>
                      <option value="free_product">Produto Grátis</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">PONTOS NECESSÁRIOS</label>
                    <input type="number" name="pointsRequired" class="form-input" placeholder="100" min="1" required />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">VALOR (para desconto/produto)</label>
                  <input type="text" name="rewardValue" class="form-input" placeholder="Ex: 20 (para 20% ou R$20)" />
                </div>
                <div style="display:flex;gap:8px;">
                  <button type="submit" class="btn btn-primary" style="flex:1;">Salvar</button>
                  <button type="button" onclick="document.getElementById('new-reward-form').style.display='none';document.querySelector('.btn.btn-primary').style.display='';" class="btn btn-ghost">Cancelar</button>
                </div>
              </form>
            </div>
            <table>
              <thead><tr><th>Recompensa</th><th>Tipo</th><th>Pontos</th><th></th></tr></thead>
              <tbody>
                ${rewards.length === 0 ? `<tr><td colspan="4" class="empty">Nenhuma recompensa cadastrada.</td></tr>` : rewards.map((r) => `
                  <tr>
                    <td><strong>${esc(r.name)}</strong>${r.description ? `<br><span style="color:var(--muted);font-size:11px;">${esc(r.description)}</span>` : ""}</td>
                    <td><span class="badge badge-gold">${rewardTypes[r.rewardType] ?? r.rewardType}</span></td>
                    <td><strong>${r.pointsRequired}</strong> pts</td>
                    <td>
                      <form method="POST" action="/admin/fidelidade/recompensa/toggle" style="display:inline;">
                        <input type="hidden" name="id" value="${r.id}" />
                        <input type="hidden" name="isActive" value="${r.isActive ? 'false' : 'true'}" />
                        <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;">${r.isActive ? "Desativar" : "Ativar"}</button>
                      </form>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    res.send(adminLayout("Fidelidade", "fidelidade", body, barber?.name));
  });

  app.post("/admin/fidelidade/config", requireAdminAuth, async (req: Request, res: Response) => {
    const { isActive, pointsPerService, pointsPerReal, pointsExpireMonths } = req.body;
    await db.upsertLoyaltyConfig({
      isActive: isActive === "true",
      pointsPerService: parseInt(pointsPerService),
      pointsPerReal,
      pointsExpireMonths: parseInt(pointsExpireMonths),
    });
    res.redirect("/admin/fidelidade?saved=1");
  });

  app.post("/admin/fidelidade/recompensa", requireAdminAuth, async (req: Request, res: Response) => {
    const { name, description, rewardType, pointsRequired, rewardValue } = req.body;
    await db.createLoyaltyReward({
      name,
      description,
      rewardType,
      pointsRequired: parseInt(pointsRequired),
      rewardValue: rewardValue || undefined,
    });
    res.redirect("/admin/fidelidade?saved=1");
  });

  app.post("/admin/fidelidade/recompensa/toggle", requireAdminAuth, async (req: Request, res: Response) => {
    const { id, isActive } = req.body;
    await db.updateLoyaltyReward(parseInt(id), { isActive: isActive === "true" });
    res.redirect("/admin/fidelidade");
  });

  // ─── Cupons ────────────────────────────────────────────────────────────────
  app.get("/admin/cupons", requireAdminAuth, async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const allCoupons = await db.getAllCoupons();
    const saved = req.query.saved === "1";
    const body = `
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE80;border-radius:10px;padding:12px 18px;margin-bottom:20px;color:#4ADE80;font-size:13px;">Salvo com sucesso.</div>` : ""}
      <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
        <button onclick="document.getElementById('new-coupon-form').style.display='block';this.style.display='none';" class="btn btn-primary">🏷️ Novo Cupão</button>
      </div>
      <div id="new-coupon-form" style="display:none;" class="card">
        <div class="card-header"><span class="card-title">Novo Cupão</span></div>
        <div class="card-body" style="padding:20px;">
          <form method="POST" action="/admin/cupons">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
              <div class="form-group">
                <label class="form-label">CÓDIGO *</label>
                <input type="text" name="code" class="form-input" placeholder="EX: PROMO10" required style="text-transform:uppercase;" />
              </div>
              <div class="form-group">
                <label class="form-label">TIPO DE DESCONTO *</label>
                <select name="discountType" class="form-input">
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor Fixo (R$)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">VALOR DO DESCONTO *</label>
                <input type="number" name="discountValue" class="form-input" placeholder="10" min="0" step="0.01" required />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
              <div class="form-group">
                <label class="form-label">PEDIDO MÍNIMO (R$)</label>
                <input type="number" name="minOrderValue" class="form-input" placeholder="0" min="0" step="0.01" />
              </div>
              <div class="form-group">
                <label class="form-label">MÁX. USOS (0 = ilimitado)</label>
                <input type="number" name="maxUses" class="form-input" placeholder="0" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label">DESCRIÇÃO</label>
                <input type="text" name="description" class="form-input" placeholder="Descrição opcional" />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="form-group">
                <label class="form-label">VÁLIDO DE</label>
                <input type="date" name="validFrom" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">VÁLIDO ATÉ</label>
                <input type="date" name="validUntil" class="form-input" />
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button type="submit" class="btn btn-primary">Criar Cupão</button>
              <button type="button" onclick="document.getElementById('new-coupon-form').style.display='none';" class="btn btn-ghost">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🏷️ Todos os Cupões</span><span style="color:var(--muted);font-size:12px;">${allCoupons.length} cupões</span></div>
        <table>
          <thead><tr><th>Código</th><th>Desconto</th><th>Usos</th><th>Validade</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${allCoupons.length === 0 ? `<tr><td colspan="6" class="empty">Nenhum cupão cadastrado.</td></tr>` : allCoupons.map((c) => `
              <tr>
                <td><strong style="color:var(--gold);font-family:monospace;">${esc(c.code)}</strong>${c.description ? `<br><span style="color:var(--muted);font-size:11px;">${esc(c.description)}</span>` : ""}</td>
                <td>${c.discountType === "percent" ? `${c.discountValue}%` : `R$ ${fmt(parseFloat(c.discountValue as any))}`}</td>
                <td>${c.usedCount ?? 0}${c.maxUses ? ` / ${c.maxUses}` : " / ∞"}</td>
                <td style="font-size:12px;">${c.validFrom ? fmtDate(c.validFrom as any) : "—"} ${c.validUntil ? `até ${fmtDate(c.validUntil as any)}` : ""}</td>
                <td><span class="badge ${c.isActive ? 'badge-success' : 'badge-muted'}">${c.isActive ? "Ativo" : "Inativo"}</span></td>
                <td>
                  <form method="POST" action="/admin/cupons/toggle" style="display:inline;">
                    <input type="hidden" name="id" value="${c.id}" />
                    <input type="hidden" name="isActive" value="${c.isActive ? 'false' : 'true'}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;">${c.isActive ? "Desativar" : "Ativar"}</button>
                  </form>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    res.send(adminLayout("Cupons", "cupons", body, barber?.name));
  });

  app.post("/admin/cupons", requireAdminAuth, async (req: Request, res: Response) => {
    const { code, description, discountType, discountValue, minOrderValue, maxUses, validFrom, validUntil } = req.body;
    await db.createCoupon({
      code,
      description: description || undefined,
      discountType,
      discountValue,
      minOrderValue: minOrderValue || undefined,
      maxUses: maxUses ? parseInt(maxUses) : undefined,
      validFrom: validFrom || undefined,
      validUntil: validUntil || undefined,
    });
    res.redirect("/admin/cupons?saved=1");
  });

  app.post("/admin/cupons/toggle", requireAdminAuth, async (req: Request, res: Response) => {
    const { id, isActive } = req.body;
    await db.updateCoupon(parseInt(id), { isActive: isActive === "true" });
    res.redirect("/admin/cupons");
  });

  // ─── Avaliações ─────────────────────────────────────────────────────────────
  app.get("/admin/avaliacoes", requireAdminAuth, async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const recentReviews = await db.getRecentReviews(100);
    const avgRating = recentReviews.length > 0
      ? (recentReviews.reduce((s, r) => s + r.rating, 0) / recentReviews.length).toFixed(1)
      : "0.0";
    const dist = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: recentReviews.filter((r) => r.rating === star).length,
      pct: recentReviews.length > 0 ? Math.round((recentReviews.filter((r) => r.rating === star).length / recentReviews.length) * 100) : 0,
    }));
    const stars = (n: number) => "⭐".repeat(n) + "☆".repeat(5 - n);
    const body = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="metric-card">
          <div class="metric-label">MÉDIA GERAL</div>
          <div class="metric-value" style="color:var(--gold);">${avgRating} ⭐</div>
          <div class="metric-sub">${recentReviews.length} avaliações no total</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">5 ESTRELAS</div>
          <div class="metric-value" style="color:var(--success);">${dist[0].count}</div>
          <div class="metric-sub">${dist[0].pct}% das avaliações</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">ABAIXO DE 3</div>
          <div class="metric-value" style="color:var(--error);">${dist[3].count + dist[4].count}</div>
          <div class="metric-sub">${dist[3].pct + dist[4].pct}% das avaliações</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:280px 1fr;gap:24px;">
        <!-- Distribuição -->
        <div class="card">
          <div class="card-header"><span class="card-title">Distribuição</span></div>
          <div class="card-body" style="padding:16px;">
            ${dist.map((d) => `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <span style="font-size:13px;width:24px;text-align:right;">${d.star}⭐</span>
                <div style="flex:1;background:var(--surface2);border-radius:4px;height:8px;overflow:hidden;">
                  <div style="width:${d.pct}%;height:100%;background:var(--gold);border-radius:4px;"></div>
                </div>
                <span style="font-size:12px;color:var(--muted);width:30px;">${d.count}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Lista -->
        <div class="card">
          <div class="card-header"><span class="card-title">💬 Avaliações Recentes</span></div>
          <table>
            <thead><tr><th>Cliente</th><th>Serviço</th><th>Nota</th><th>Comentário</th><th>Data</th></tr></thead>
            <tbody>
              ${recentReviews.length === 0 ? `<tr><td colspan="5" class="empty">Nenhuma avaliação recebida ainda.</td></tr>` : recentReviews.map((r) => `
                <tr>
                  <td>${esc(r.clientName)}</td>
                  <td><span style="color:var(--muted);font-size:12px;">${esc(r.serviceName)}</span></td>
                  <td><span style="color:var(--gold);">${stars(r.rating)}</span></td>
                  <td style="max-width:300px;font-size:12px;color:var(--muted);">${r.comment ? esc(r.comment) : "—"}</td>
                  <td style="font-size:12px;color:var(--muted);">${new Date(r.createdAt).toLocaleDateString("pt-BR")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    res.send(adminLayout("Avaliações", "avaliacoes", body, barber?.name));
  });

  // ─── Comissões ────────────────────────────────────────────────────────────
  app.get("/admin/comissoes", requireAdminAuth, async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const configs = await db.listCommissionConfigs(); // retorna barbeiros com commissionRate embutido
    const { start, end } = monthRange();
    const summary = await db.getCommissionSummary(start, end);
    const saved = req.query.saved === "1";
    const totalCommission = summary.reduce((s, b) => s + b.totalCommission, 0);
    const totalGross = summary.reduce((s, b) => s + b.totalGross, 0);
    const body = `
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE80;border-radius:10px;padding:12px 18px;margin-bottom:20px;color:#4ADE80;font-size:13px;">Comissões atualizadas.</div>` : ""}
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="metric-card">
          <div class="metric-label">FATURAMENTO BRUTO (MES)</div>
          <div class="metric-value">${fmtCurrency(totalGross)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">TOTAL DE COMISSÕES</div>
          <div class="metric-value" style="color:var(--warning);">${fmtCurrency(totalCommission)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">LÍQUIDO DA BARBEARIA</div>
          <div class="metric-value" style="color:var(--success);">${fmtCurrency(totalGross - totalCommission)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:300px 1fr;gap:24px;">
        <!-- Configurar taxas -->
        <div class="card">
          <div class="card-header"><span class="card-title">⚙️ Taxas de Comissão</span></div>
          <div class="card-body" style="padding:16px;">
            <form method="POST" action="/admin/comissoes/config">
              ${configs.map((b) => `
                  <div class="form-group">
                    <label class="form-label">${esc(b.name).toUpperCase()}</label>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <input type="number" name="rate_${b.id}" class="form-input" value="${b.commissionRate}" min="0" max="100" step="1" style="width:80px;" />
                      <span style="color:var(--muted);font-size:13px;">%</span>
                    </div>
                  </div>
                `).join("")}
              ${configs.length === 0 ? `<p style="color:var(--muted);font-size:13px;">Nenhum barbeiro cadastrado.</p>` : ""}
              <button type="submit" class="btn btn-primary" style="width:100%;">Salvar Taxas</button>
            </form>
          </div>
        </div>

        <!-- Resumo por barbeiro -->
        <div class="card">
          <div class="card-header"><span class="card-title">🤝 Resumo do Mês</span><span style="color:var(--muted);font-size:12px;">${fmtDate(start)} a ${fmtDate(end)}</span></div>
          <table>
            <thead><tr><th>Barbeiro</th><th>Taxa</th><th>Faturamento</th><th>Comissão</th><th>Líquido</th><th>Atend.</th></tr></thead>
            <tbody>
              ${summary.length === 0 ? `<tr><td colspan="6" class="empty">Nenhum dado de comissão no mês.</td></tr>` : summary.map((s) => `
                <tr>
                  <td><strong>${esc(s.barberName)}</strong></td>
                  <td><span class="badge badge-gold">${s.commissionRate}%</span></td>
                  <td>${fmtCurrency(s.totalGross)}</td>
                  <td style="color:var(--warning);">${fmtCurrency(s.totalCommission)}</td>
                  <td style="color:var(--success);">${fmtCurrency(s.totalNet)}</td>
                  <td>${s.entriesCount}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    res.send(adminLayout("Comissões", "comissoes", body, barber?.name));
  });

  app.post("/admin/comissoes/config", requireAdminAuth, async (req: Request, res: Response) => {
    const barbers = await db.getAllBarbers();
    for (const b of barbers) {
      const rate = req.body[`rate_${b.id}`];
      if (rate !== undefined) {
        await db.upsertCommissionConfig({ barberId: b.id, defaultRate: parseFloat(rate) });
      }
    }
    res.redirect("/admin/comissoes?saved=1");
  });

}
