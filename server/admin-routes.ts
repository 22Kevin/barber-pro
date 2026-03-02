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
import PDFDocument from "pdfkit";

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
function adminLayout(title: string, activePage: string, body: string, barberName = "", tenantPlan = ""): string {
  const planBadge: Record<string, { label: string; color: string; bg: string }> = {
    solo: { label: "Solo", color: "#9BA1A6", bg: "rgba(155,161,166,0.12)" },
    team: { label: "Equipe", color: "#c9a84c", bg: "rgba(201,168,76,0.12)" },
    studio: { label: "Estúdio", color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  };
  const badge = tenantPlan ? planBadge[tenantPlan] : null;
  const navGroups = [
    {
      label: "OPERACIONAL",
      items: [
        { href: "/admin", icon: "⊞", label: "Dashboard", id: "dashboard" },
        { href: "/admin/agenda", icon: "📅", label: "Agenda", id: "agenda" },
        { href: "/admin/clientes", icon: "👥", label: "Clientes", id: "clientes" },
        { href: "/admin/lista-espera", icon: "⏳", label: "Lista de Espera", id: "lista-espera" },
        { href: "/admin/recorrencias", icon: "🔄", label: "Recorrências", id: "recorrencias" },
      ],
    },
    {
      label: "CATÁLOGO",
      items: [
        { href: "/admin/servicos", icon: "✂️", label: "Serviços", id: "servicos" },
        { href: "/admin/produtos", icon: "🛍️", label: "Produtos", id: "produtos" },
        { href: "/admin/estoque", icon: "📦", label: "Estoque", id: "estoque" },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { href: "/admin/financeiro", icon: "💰", label: "Financeiro", id: "financeiro" },
        { href: "/admin/relatorios", icon: "📊", label: "Relatórios", id: "relatorios" },
        { href: "/admin/comissoes", icon: "🤝", label: "Comissões", id: "comissoes" },
        { href: "/admin/minhas-comissoes", icon: "💵", label: "Minhas Comissões", id: "minhas-comissoes" },
      ],
    },
    {
      label: "MARKETING",
      items: [
        { href: "/admin/fidelidade", icon: "⭐", label: "Fidelidade", id: "fidelidade" },
        { href: "/admin/cupons", icon: "🏷️", label: "Cupons", id: "cupons" },
        { href: "/admin/avaliacoes", icon: "💬", label: "Avaliações", id: "avaliacoes" },
        { href: "/admin/retorno-automatico", icon: "📨", label: "Retorno Automático", id: "retorno-automatico" },
        { href: "/admin/promocoes", icon: "📣", label: "Promoções", id: "promocoes" },
        { href: "/admin/conversao-promocoes", icon: "📈", label: "Conversão de Promoções", id: "conversao-promocoes" },
        { href: "/admin/chat", icon: "💬", label: "Chat WhatsApp", id: "chat" },
      ],
    },
    {
      label: "PÁGINA DO CLIENTE",
      items: [
        { href: "/admin/pagina-cliente", icon: "🌐", label: "Página do Cliente", id: "pagina-cliente" },
      ],
    },
    {
      label: "SISTEMA",
      items: [
        { href: "/admin/meu-perfil", icon: "👤", label: "Meu Perfil", id: "meu-perfil" },
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
    /* Tema claro */
    html[data-theme="light"] {
      --bg: #F5F5F0;
      --surface: #FFFFFF;
      --surface2: #F0EEE8;
      --border: #E5E3DC;
      --text: #1A1A1A;
      --muted: #6B6B65;
    }
  </style>
  <script>
    (function() {
      var t = localStorage.getItem('bp_theme') || 'dark';
      var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    })();
  </script>
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
      ${badge ? `<div style="display:inline-flex;align-items:center;gap:6px;background:${badge.bg};border:1px solid ${badge.color}33;border-radius:6px;padding:4px 10px;margin-bottom:10px;font-size:11px;font-weight:700;color:${badge.color};letter-spacing:0.5px">★ Plano ${badge.label}</div>` : ""}
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
    <a href="/admin/forgot-password" class="back" style="margin-top:14px;color:#C9A84C">Esqueci minha senha</a>
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
  const tenantId = barber?.tenantId ?? null;
  const stats = await db.getDashboardStats(dateStr, tenantId);
  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);
  const barbers = await db.getAllBarbers(tenantId);

  // Buscar slug para o card de link de agendamento
  const dashTenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;
  const dashSlug = dashTenant?.slug ?? "";
  const dashBaseUrl = process.env.PUBLIC_BASE_URL ?? "";
  const dashBookingUrl = dashSlug ? `${dashBaseUrl}/pub/${dashSlug}/agendar` : "";

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

    ${dashBookingUrl ? `
    <div class="card" style="background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);border:1px solid var(--gold)44">
      <div class="card-header">
        <div class="card-title">🌐 Link de Agendamento Online</div>
        <a href="/admin/pagina-cliente" class="btn btn-ghost" style="font-size:12px">Configurar página</a>
      </div>
      <div class="card-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Compartilhe este link com seus clientes para que eles possam agendar online:</p>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="dash-booking-url" class="form-input" type="text" value="${esc(dashBookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
          <button onclick="(function(btn){navigator.clipboard.writeText(document.getElementById('dash-booking-url').value).then(()=>{var o=btn.textContent;btn.textContent='✅ Copiado!';setTimeout(()=>btn.textContent=o,2000)});})(this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">📋 Copiar</button>
          <a href="${esc(dashBookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">🔗 Abrir</a>
          <a href="https://wa.me/?text=${encodeURIComponent('Agende seu horário: ' + dashBookingUrl)}" target="_blank" class="btn btn-primary" style="flex-shrink:0;padding:8px 14px;font-size:12px">📲 WhatsApp</a>
        </div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-header">
        <div class="card-title">📅 Agenda de Hoje — ${fmtDate(dateStr)}</div>
        <a href="/admin/agenda" class="btn btn-ghost">Ver tudo</a>
      </div>
      <div class="card-body">${appointmentsHtml}</div>
    </div>
  `;

  res.send(adminLayout("Dashboard", "dashboard", body, barber?.name, dashTenant?.plan ?? ""));
}

// ─── Agenda ───────────────────────────────────────────────────────────────────
async function renderAgenda(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
  const dateStr = (req.query.date as string) || today();
  const filterBarberId = req.query.barberId ? parseInt(req.query.barberId as string) : null;
  const filterSearch = ((req.query.q as string) || "").toLowerCase().trim();
  const allAppointments = await db.getAllAppointmentsByDate(dateStr, tenantId);
  const barbers = await db.getAllBarbers(tenantId);

  // Carregar todos os clientes e serviços do dia
  const barberMap: Record<number, string> = Object.fromEntries(barbers.map((b) => [b.id, b.name]));
  const clientIds = [...new Set(allAppointments.map((a: any) => a.clientId))];
  const clientMap: Record<number, any> = {};
  for (const cid of clientIds) {
    const c = await db.getClientById(cid);
    if (c) clientMap[cid] = c;
  }
  const serviceIds = [...new Set(allAppointments.map((a: any) => a.serviceId))];
  const serviceMap: Record<number, string> = {};
  for (const sid of serviceIds) {
    const s = await db.getServiceById(sid);
    if (s) serviceMap[sid] = s.name;
  }

  // Aplicar filtros
  let appointments = allAppointments;
  if (filterBarberId) appointments = appointments.filter((a: any) => a.barberId === filterBarberId);
  if (filterSearch) {
    appointments = appointments.filter((a: any) => {
      const client = clientMap[a.clientId];
      const name = (client?.name ?? "").toLowerCase();
      const phone = (client?.phone ?? "").replace(/\D/g, "");
      const searchDigits = filterSearch.replace(/\D/g, "");
      return name.includes(filterSearch) || (searchDigits && phone.includes(searchDigits));
    });
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

  // Calendário mini: semana atual
  const selDate = new Date(dateStr + "T12:00:00");
  const dayOfWeek = selDate.getDay(); // 0=Dom
  const weekStart = new Date(selDate);
  weekStart.setDate(selDate.getDate() - dayOfWeek);
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDays.push(d.toISOString().split("T")[0]);
  }
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const todayStr = today();

  const calendarHtml = `
    <div style="display:flex;gap:4px;margin-bottom:20px;background:var(--surface);border-radius:14px;padding:10px;border:1px solid var(--border);overflow-x:auto">
      ${weekDays.map((d, i) => {
        const isSelected = d === dateStr;
        const isToday = d === todayStr;
        const dayNum = new Date(d + "T12:00:00").getDate();
        return `<a href="/admin/agenda?date=${d}${filterBarberId ? "&barberId=" + filterBarberId : ""}${filterSearch ? "&q=" + encodeURIComponent(filterSearch) : ""}" style="flex:1;min-width:44px;text-align:center;padding:8px 4px;border-radius:10px;text-decoration:none;background:${isSelected ? "var(--primary)" : "transparent"};border:${isToday && !isSelected ? "1px solid var(--primary)" : "1px solid transparent"};transition:background 0.15s">
          <div style="font-size:11px;color:${isSelected ? "#fff" : "var(--muted)"};font-weight:500">${dayLabels[i]}</div>
          <div style="font-size:16px;font-weight:700;color:${isSelected ? "#fff" : "var(--foreground)"};margin-top:2px">${dayNum}</div>
        </a>`;
      }).join("")}
    </div>`;

  // Filtros
  const filtersHtml = `
    <form method="GET" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;align-items:center">
      <input type="hidden" name="date" value="${dateStr}" />
      <select name="barberId" onchange="this.form.submit()" style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;min-width:160px">
        <option value="">Todos os profissionais</option>
        ${barbers.map((b: any) => `<option value="${b.id}"${filterBarberId === b.id ? " selected" : ""}>${esc(b.name)}</option>`).join("")}
      </select>
      <div style="display:flex;flex:1;min-width:200px;gap:8px">
        <input type="text" name="q" value="${esc(filterSearch)}" placeholder="Buscar por nome ou telefone..."
          style="flex:1;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px" />
        <button type="submit" class="btn btn-primary" style="padding:8px 16px;font-size:13px">Buscar</button>
        ${filterSearch || filterBarberId ? `<a href="/admin/agenda?date=${dateStr}" class="btn btn-ghost" style="padding:8px 12px;font-size:13px">✕</a>` : ""}
      </div>
      <a href="/admin/agenda/novo?date=${dateStr}" class="btn btn-primary" style="padding:8px 18px;font-size:13px;white-space:nowrap">+ Novo Agendamento</a>
    </form>`;

  // Navegação de dias
  const navHtml = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <a href="/admin/agenda?date=${prevDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" class="btn btn-ghost" style="padding:8px 14px">← Anterior</a>
      <input type="date" value="${dateStr}" onchange="location.href='/admin/agenda?date='+this.value+'${filterBarberId ? "&barberId=" + filterBarberId : ""}'"
        style="padding:8px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
      <a href="/admin/agenda?date=${nextDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" class="btn btn-ghost" style="padding:8px 14px">Próximo →</a>
      <a href="/admin/agenda?date=${todayStr}" class="btn btn-ghost" style="padding:8px 14px;font-size:13px">Hoje</a>
      <span style="color:var(--muted);font-size:13px;margin-left:auto">${appointments.length} agendamento(s)${filterSearch || filterBarberId ? " (filtrado)" : ""}</span>
    </div>`;

  const body = `
    ${calendarHtml}
    ${navHtml}
    ${filtersHtml}
    <div class="card">
      <div class="card-body">
        ${appointments.length === 0
          ? `<div class="empty">Nenhum agendamento para ${fmtDate(dateStr)}${filterSearch || filterBarberId ? " com os filtros aplicados" : ""}.</div>`
          : `<table>
              <thead><tr><th>Horário</th><th>Cliente</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                ${appointments.map((a: any) => `
                  <tr id="row-${a.id}">
                    <td><strong>${a.startTime?.substring(0, 5) ?? "—"}</strong> – ${a.endTime?.substring(0, 5) ?? "—"}</td>
                    <td>
                      <div style="font-weight:600">${esc(clientMap[a.clientId]?.name ?? "—")}</div>
                      ${clientMap[a.clientId]?.phone ? `<div style="font-size:11px;color:var(--muted)">${esc(clientMap[a.clientId].phone)}</div>` : ""}
                    </td>
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

  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout(`Agenda — ${fmtDate(dateStr)}`, "agenda", body, barber?.name, _tp));
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
async function renderClientes(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
  const search = ((req.query.q as string) || "").toLowerCase();
  const filterBirthday = req.query.aniversariantes === "1";
  const filterStatus = (req.query.status as string) || "all";
  const saved = req.query.saved === "1";
  const deleted = req.query.deleted === "1";
  const allClients = await db.getAllClients(tenantId);

  // Filtrar aniversariantes do mês
  const currentMonth = new Date().getMonth() + 1;
  const todayDay = new Date().getDate();

  let filtered = allClients;
  if (filterBirthday) {
    filtered = filtered.filter((c: any) => {
      if (!c.birthDate) return false;
      const parts = c.birthDate.split("-");
      return parseInt(parts[1], 10) === currentMonth;
    }).sort((a: any, b: any) => {
      const dayA = parseInt(a.birthDate.split("-")[2], 10);
      const dayB = parseInt(b.birthDate.split("-")[2], 10);
      return dayA - dayB;
    });
  }
  if (filterStatus === "active") filtered = filtered.filter((c: any) => c.isActive !== false);
  if (filterStatus === "inactive") filtered = filtered.filter((c: any) => c.isActive === false);
  if (search) filtered = filtered.filter((c: any) => c.name.toLowerCase().includes(search) || (c.phone ?? "").includes(search));

  // Contar aniversariantes do mês e do dia
  const birthdayMonth = allClients.filter((c: any) => {
    if (!c.birthDate) return false;
    return parseInt(c.birthDate.split("-")[1], 10) === currentMonth;
  });
  const birthdayToday = birthdayMonth.filter((c: any) => parseInt(c.birthDate.split("-")[2], 10) === todayDay);

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Cliente salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Cliente excluído com sucesso!</div>` : ""}

    ${birthdayToday.length > 0 ? `
    <div style="background:linear-gradient(135deg,#C9A84C22,#C9A84C11);border:1px solid #C9A84C44;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
      <span style="font-size:24px">🎂</span>
      <div>
        <div style="font-weight:700;color:#C9A84C;font-size:14px">Aniversariantes de hoje!</div>
        <div style="font-size:13px;color:var(--foreground);margin-top:2px">${birthdayToday.map((c: any) => esc(c.name)).join(", ")}</div>
      </div>
    </div>` : ""}

    <!-- Barra de ações -->
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;align-items:center">
      <form method="GET" style="display:flex;flex:1;min-width:200px;gap:8px">
        <input type="text" name="q" value="${esc(search)}" placeholder="Buscar por nome ou telefone..."
          style="flex:1;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px" />
        <button type="submit" class="btn btn-primary" style="padding:8px 16px;font-size:13px">Buscar</button>
        ${search ? `<a href="/admin/clientes" class="btn btn-ghost" style="padding:8px 12px;font-size:13px">✕</a>` : ""}
      </form>
      <select onchange="location.href='/admin/clientes?status='+this.value+'${search ? '&q=' + encodeURIComponent(search) : ''}'"
        style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px">
        <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>Todos os status</option>
        <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>Ativos</option>
        <option value="inactive" ${filterStatus === 'inactive' ? 'selected' : ''}>Inativos</option>
      </select>
      <a href="/admin/clientes?aniversariantes=1" class="btn ${filterBirthday ? 'btn-primary' : 'btn-ghost'}" style="padding:8px 14px;font-size:13px">
        🎂 Aniversariantes (${birthdayMonth.length})
      </a>
      <a href="/admin/export/clientes.csv" class="btn btn-ghost" style="padding:8px 12px;font-size:13px">↓ CSV</a>
      <button onclick="document.getElementById('newClientModal').style.display='flex'" class="btn btn-primary" style="padding:8px 18px;font-size:13px;white-space:nowrap">+ Novo Cliente</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">👥 ${filterBirthday ? `Aniversariantes de ${new Date().toLocaleString('pt-BR', {month:'long'})}` : 'Clientes'} (${filtered.length})</div>
      </div>
      <div class="card-body">
        ${filtered.length === 0
          ? `<div class="empty">${filterBirthday ? 'Nenhum aniversariante este mês.' : 'Nenhum cliente encontrado.'}</div>`
          : `<table>
              <thead><tr><th>Nome</th><th>Telefone</th><th>Email</th><th>${filterBirthday ? 'Aniversário' : 'Pontos'}</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                ${filtered.slice(0, 200).map((c: any) => {
                  const isToday = c.birthDate && parseInt(c.birthDate.split('-')[2], 10) === todayDay && parseInt(c.birthDate.split('-')[1], 10) === currentMonth;
                  const bdFormatted = c.birthDate ? new Date(c.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : '—';
                  return `
                  <tr style="${isToday ? 'background:rgba(201,168,76,0.08)' : ''}">
                    <td>
                      <a href="/admin/clientes/${c.id}" style="color:var(--gold);text-decoration:none;font-weight:700">${esc(c.name)}</a>
                      ${isToday ? '<span style="font-size:14px;margin-left:6px">🎂</span>' : ''}
                    </td>
                    <td>${esc(c.phone ?? '—')}</td>
                    <td style="color:var(--muted);font-size:12px">${esc(c.email ?? '—')}</td>
                    <td>${filterBirthday ? `<strong style="color:#C9A84C">${bdFormatted}</strong>` : `<span class="badge badge-gold">${c.loyaltyPoints ?? c.totalPoints ?? 0} pts</span>`}</td>
                    <td>${c.isActive !== false ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-muted">Inativo</span>'}</td>
                    <td style="white-space:nowrap">
                      <a href="/admin/clientes/${c.id}" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;margin-right:4px">👁 Ver</a>
                      <button onclick="openEditClient(${c.id},'${esc(c.name).replace(/'/g,"\\'")}',' ${esc(c.phone ?? '')}','${esc(c.email ?? '')}','${c.birthDate ?? ''}','${esc(c.notes ?? '')}')" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;margin-right:4px">✏️ Editar</button>
                      <form method="POST" action="/admin/clientes/${c.id}/excluir" style="display:inline" onsubmit="return confirm('Excluir ${esc(c.name).replace(/'/g,"\\'")}'? Esta ação não pode ser desfeita.')">
                        <button type="submit" class="btn" style="font-size:11px;padding:4px 10px;background:#EF444422;color:#F87171;border:none">🗑 Excluir</button>
                      </form>
                    </td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>

    <!-- Modal Novo Cliente -->
    <div id="newClientModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
      <div style="background:var(--surface);border-radius:16px;padding:28px;width:480px;max-width:90vw;max-height:90vh;overflow-y:auto">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">➕ Novo Cliente</h2>
        <form method="POST" action="/admin/clientes/novo">
          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input type="text" name="name" class="form-input" required placeholder="Nome completo" />
          </div>
          <div class="form-group">
            <label class="form-label">Telefone *</label>
            <input type="text" name="phone" class="form-input" required placeholder="(11) 99999-9999" />
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input type="email" name="email" class="form-input" placeholder="email@exemplo.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Data de Nascimento</label>
            <input type="date" name="birthDate" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea name="notes" class="form-input" rows="2" placeholder="Preferências, alergias..."></textarea>
          </div>
          <div style="display:flex;gap:12px;margin-top:20px">
            <button type="button" onclick="document.getElementById('newClientModal').style.display='none'" class="btn" style="flex:1">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1">Criar Cliente</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Editar Cliente -->
    <div id="editClientModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
      <div style="background:var(--surface);border-radius:16px;padding:28px;width:480px;max-width:90vw;max-height:90vh;overflow-y:auto">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">✏️ Editar Cliente</h2>
        <form method="POST" id="editClientForm" action="">
          <input type="hidden" name="_method" value="PUT" />
          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input type="text" name="name" id="editName" class="form-input" required />
          </div>
          <div class="form-group">
            <label class="form-label">Telefone *</label>
            <input type="text" name="phone" id="editPhone" class="form-input" required />
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input type="email" name="email" id="editEmail" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Data de Nascimento</label>
            <input type="date" name="birthDate" id="editBirthDate" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea name="notes" id="editNotes" class="form-input" rows="2"></textarea>
          </div>
          <div style="display:flex;gap:12px;margin-top:20px">
            <button type="button" onclick="document.getElementById('editClientModal').style.display='none'" class="btn" style="flex:1">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      function openEditClient(id, name, phone, email, birthDate, notes) {
        document.getElementById('editClientForm').action = '/admin/clientes/' + id + '/editar';
        document.getElementById('editName').value = name.trim();
        document.getElementById('editPhone').value = phone.trim();
        document.getElementById('editEmail').value = email.trim();
        document.getElementById('editBirthDate').value = birthDate.trim();
        document.getElementById('editNotes').value = notes.trim();
        document.getElementById('editClientModal').style.display = 'flex';
      }
    </script>
  `;

  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Clientes", "clientes", body, barber?.name, _tp));
}

// ─── Serviços ─────────────────────────────────────────────────────────────────
async function renderServicos(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
  const services = await db.getAllServicesWithMedia(false, tenantId);
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
          <!-- Upload de mídia -->
          <div class="form-group" style="margin-top:8px">
            <label class="form-label">🖼️ Foto / Vídeo <span style="color:var(--muted);font-weight:400">(opcional)</span></label>
            <input type="file" id="svc-media-file" accept="image/*,video/*" style="display:none" onchange="svcPreviewMedia(this)" />
            <div style="display:flex;align-items:center;gap:12px">
              <button type="button" onclick="document.getElementById('svc-media-file').click()" class="btn" style="padding:10px 18px;background:var(--surface2);color:var(--text)">📎 Selecionar arquivo</button>
              <span id="svc-media-name" style="color:var(--muted);font-size:13px">Nenhum arquivo selecionado</span>
            </div>
            <div id="svc-media-preview" style="margin-top:10px;display:none">
              <img id="svc-media-img" style="max-width:200px;max-height:140px;border-radius:10px;border:1px solid var(--border);object-fit:cover" />
              <video id="svc-media-vid" style="max-width:200px;max-height:140px;border-radius:10px;border:1px solid var(--border);display:none" controls></video>
            </div>
            <input type="hidden" name="mediaBase64" id="svc-media-b64" />
            <input type="hidden" name="mediaMime" id="svc-media-mime" />
            <script>
              function svcPreviewMedia(input) {
                const file = input.files[0]; if (!file) return;
                document.getElementById('svc-media-name').textContent = file.name;
                const reader = new FileReader();
                reader.onload = function(e) {
                  const data = e.target.result;
                  document.getElementById('svc-media-b64').value = data.split(',')[1];
                  document.getElementById('svc-media-mime').value = file.type;
                  const isVideo = file.type.startsWith('video/');
                  const img = document.getElementById('svc-media-img');
                  const vid = document.getElementById('svc-media-vid');
                  document.getElementById('svc-media-preview').style.display = 'block';
                  if (isVideo) { img.style.display='none'; vid.style.display='block'; vid.src = data; }
                  else { vid.style.display='none'; img.style.display='block'; img.src = data; }
                };
                reader.readAsDataURL(file);
              }
            </script>
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
      <div class="card-header" style="gap:12px">
        <div class="card-title">✂️ Serviços Cadastrados (${services.length})</div>
        <input type="text" id="svc-search" placeholder="Buscar por nome..." oninput="(function(){const q=document.getElementById('svc-search').value.toLowerCase();document.querySelectorAll('#svc-table tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?'':'none';});})()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;min-width:200px" />
      </div>
      <div class="card-body"><div id="svc-table">${tableHtml}</div></div>
    </div>
  `;
  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Serviços", "servicos", body, barber?.name, _tp));
}

async function renderProdutos(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
  const products = await db.getAllProductsWithMedia(false, tenantId);
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
          <!-- Upload de mídia -->
          <div class="form-group" style="margin-top:8px">
            <label class="form-label">🖼️ Foto / Vídeo <span style="color:var(--muted);font-weight:400">(opcional)</span></label>
            <input type="file" id="prd-media-file" accept="image/*,video/*" style="display:none" onchange="prdPreviewMedia(this)" />
            <div style="display:flex;align-items:center;gap:12px">
              <button type="button" onclick="document.getElementById('prd-media-file').click()" class="btn" style="padding:10px 18px;background:var(--surface2);color:var(--text)">📎 Selecionar arquivo</button>
              <span id="prd-media-name" style="color:var(--muted);font-size:13px">Nenhum arquivo selecionado</span>
            </div>
            <div id="prd-media-preview" style="margin-top:10px;display:none">
              <img id="prd-media-img" style="max-width:200px;max-height:140px;border-radius:10px;border:1px solid var(--border);object-fit:cover" />
              <video id="prd-media-vid" style="max-width:200px;max-height:140px;border-radius:10px;border:1px solid var(--border);display:none" controls></video>
            </div>
            <input type="hidden" name="mediaBase64" id="prd-media-b64" />
            <input type="hidden" name="mediaMime" id="prd-media-mime" />
            <script>
              function prdPreviewMedia(input) {
                const file = input.files[0]; if (!file) return;
                document.getElementById('prd-media-name').textContent = file.name;
                const reader = new FileReader();
                reader.onload = function(e) {
                  const data = e.target.result;
                  document.getElementById('prd-media-b64').value = data.split(',')[1];
                  document.getElementById('prd-media-mime').value = file.type;
                  const isVideo = file.type.startsWith('video/');
                  const img = document.getElementById('prd-media-img');
                  const vid = document.getElementById('prd-media-vid');
                  document.getElementById('prd-media-preview').style.display = 'block';
                  if (isVideo) { img.style.display='none'; vid.style.display='block'; vid.src = data; }
                  else { vid.style.display='none'; img.style.display='block'; img.src = data; }
                };
                reader.readAsDataURL(file);
              }
            </script>
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
      <div class="card-header" style="gap:12px">
        <div class="card-title">📦 Produtos Cadastrados (${products.length})</div>
        <input type="text" id="prod-search" placeholder="Buscar por nome..." oninput="(function(){const q=document.getElementById('prod-search').value.toLowerCase();document.querySelectorAll('#prod-table tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?'':'none';});})()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;min-width:200px" />
      </div>
      <div class="card-body"><div id="prod-table">${tableHtml}</div></div>
    </div>
  `;
  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Produtos", "produtos", body, barber?.name, _tp));
}

// ─── Financeiro ───────────────────────────────────────────────────────────────
async function renderFinanceiro(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
  const activeTab = (req.query.tab as string) || "resumo";
  const saved = req.query.saved === "1";
  const deleted = req.query.deleted === "1";

  // Filtro de período
  const period = (req.query.period as string) || "month";
  let start: string, end: string;
  const now = new Date();
  if (period === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    start = d.toISOString().slice(0, 10); end = now.toISOString().slice(0, 10);
  } else if (period === "90") {
    const d = new Date(now); d.setDate(d.getDate() - 89);
    start = d.toISOString().slice(0, 10); end = now.toISOString().slice(0, 10);
  } else if (period === "custom") {
    start = (req.query.start as string) || monthRange().start;
    end = (req.query.end as string) || monthRange().end;
  } else {
    const r = monthRange(); start = r.start; end = r.end;
  }

  const salesData = await db.getSalesByDateRange(start, end, undefined, tenantId);
  const expenses = await db.getExpensesByDateRange(start, end, tenantId);
  const allBarbers = await db.getAllBarbers(tenantId);

  const totalRevenue = salesData
    .filter((s: any) => s.paymentStatus === "paid")
    .reduce((sum: number, s: any) => sum + parseFloat(s.total), 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
  const profit = totalRevenue - totalExpenses;

  // Gráfico de barras por dia
  const revenueByDay: Record<string, number> = {};
  for (const s of salesData.filter((s: any) => s.paymentStatus === "paid")) {
    const day = new Date(s.createdAt).toISOString().split("T")[0];
    revenueByDay[day] = (revenueByDay[day] ?? 0) + parseFloat(s.total);
  }
  const maxRevDay = Math.max(...Object.values(revenueByDay), 1);

  const periodOptions = [
    { v: "month", l: "Este mês" }, { v: "week", l: "Últimos 7 dias" }, { v: "90", l: "Últimos 90 dias" },
  ].map(o => `<option value="${o.v}" ${period === o.v ? "selected" : ""}>${o.l}</option>`).join("");

  const pmLabels: Record<string, string> = { cash: "Dinheiro", credit_card: "Cartão Crédito", debit_card: "Cartão Débito", pix: "Pix", mercado_pago: "Mercado Pago", other: "Outro" };

  // Aba Resumo
  const tabResumo = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Receita</div>
        <div class="metric-value" style="color:var(--success)">${fmtCurrency(totalRevenue)}</div>
        <div class="metric-sub">${salesData.filter((s: any) => s.paymentStatus === "paid").length} vendas pagas</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Despesas</div>
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
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px" title="${day}: ${fmtCurrency(val)}">
              <div style="width:100%;background:var(--gold);border-radius:4px 4px 0 0;height:${Math.round((val / maxRevDay) * 100)}px;min-height:4px"></div>
              <div style="font-size:9px;color:var(--muted);writing-mode:vertical-rl;transform:rotate(180deg)">${day.split("-")[2]}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>` : ""}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><div class="card-title">👤 Por Barbeiro</div></div>
        <div class="card-body">
          <table>
            <thead><tr><th>Barbeiro</th><th style="text-align:right">Receita</th><th style="text-align:right">Vendas</th></tr></thead>
            <tbody>
              ${allBarbers.map((b: any) => {
                const bSales = salesData.filter((s: any) => s.barberId === b.id && s.paymentStatus === "paid");
                const bRev = bSales.reduce((sum: number, s: any) => sum + parseFloat(s.total), 0);
                return `<tr><td>${esc(b.name)}</td><td style="text-align:right;color:#C9A84C;font-weight:700">${fmtCurrency(bRev)}</td><td style="text-align:right;color:var(--muted)">${bSales.length}</td></tr>`;
              }).join("") || '<tr><td colspan="3" class="empty">Sem dados</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">💳 Formas de Pagamento</div></div>
        <div class="card-body">
          <table>
            <thead><tr><th>Método</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>
              ${(() => {
                const pm: Record<string, number> = {};
                salesData.filter((s: any) => s.paymentStatus === "paid").forEach((s: any) => { pm[s.paymentMethod ?? "other"] = (pm[s.paymentMethod ?? "other"] ?? 0) + parseFloat(s.total); });
                const entries = Object.entries(pm).sort((a, b) => b[1] - a[1]);
                return entries.length ? entries.map(([k, v]) => `<tr><td>${pmLabels[k] ?? k}</td><td style="text-align:right;font-weight:700">${fmtCurrency(v)}</td></tr>`).join("") : '<tr><td colspan="2" class="empty">Sem dados</td></tr>';
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Aba Receitas
  const tabReceitas = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button onclick="document.getElementById('newSaleModal').style.display='flex'" class="btn btn-primary">+ Nova Venda</button>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">🧧 Vendas (${salesData.length})</div></div>
      <div class="card-body">
        ${salesData.length === 0
          ? `<div class="empty">Nenhuma venda no período.</div>`
          : `<table>
              <thead><tr><th>Data</th><th>Cliente</th><th>Barbeiro</th><th>Total</th><th>Pagamento</th><th>Status</th></tr></thead>
              <tbody>
                ${salesData.slice(0, 100).map((s: any) => `
                  <tr>
                    <td style="font-size:12px">${new Date(s.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td style="font-size:12px">${esc(s.clientName ?? s.clientId ?? "—")}</td>
                    <td style="font-size:12px;color:var(--muted)">${esc(allBarbers.find((b: any) => b.id === s.barberId)?.name ?? "—")}</td>
                    <td style="color:#C9A84C;font-weight:700">${fmtCurrency(s.total)}</td>
                    <td style="font-size:12px;color:var(--muted)">${pmLabels[s.paymentMethod ?? ""] ?? (s.paymentMethod ?? "—")}</td>
                    <td>${s.paymentStatus === "paid" ? '<span class="badge badge-success">Pago</span>' : s.paymentStatus === "pending" ? '<span class="badge badge-warning">Pendente</span>' : `<span class="badge badge-muted">${s.paymentStatus}</span>`}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>

    <!-- Modal Nova Venda -->
    <div id="newSaleModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
      <div style="background:var(--surface);border-radius:16px;padding:28px;width:460px;max-width:90vw;max-height:90vh;overflow-y:auto">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">🧧 Nova Venda</h2>
        <form method="POST" action="/admin/financeiro/venda">
          <div class="form-group">
            <label class="form-label">Barbeiro *</label>
            <select name="barberId" class="form-input" required>
              <option value="">Selecione...</option>
              ${allBarbers.map((b: any) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição do Serviço *</label>
            <input type="text" name="description" class="form-input" required placeholder="Ex: Corte + Barba" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Valor (R$) *</label>
              <input type="number" name="total" class="form-input" step="0.01" min="0.01" required placeholder="0,00" />
            </div>
            <div class="form-group">
              <label class="form-label">Forma de Pagamento *</label>
              <select name="paymentMethod" class="form-input" required>
                <option value="cash">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="credit_card">Cartão Crédito</option>
                <option value="debit_card">Cartão Débito</option>
                <option value="other">Outro</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="paymentStatus" class="form-input">
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
            </select>
          </div>
          <div style="display:flex;gap:12px;margin-top:20px">
            <button type="button" onclick="document.getElementById('newSaleModal').style.display='none'" class="btn" style="flex:1">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1">Registrar Venda</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Aba Despesas
  const tabDespesas = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button onclick="document.getElementById('newExpenseModal').style.display='flex'" class="btn btn-primary">+ Nova Despesa</button>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">💸 Despesas (${expenses.length})</div></div>
      <div class="card-body">
        ${expenses.length === 0
          ? `<div class="empty">Nenhuma despesa no período.</div>`
          : `<table>
              <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Ações</th></tr></thead>
              <tbody>
                ${expenses.slice(0, 100).map((e: any) => `
                  <tr>
                    <td style="font-size:12px">${e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td style="font-weight:600">${esc(e.description)}</td>
                    <td><span class="badge badge-muted" style="font-size:11px">${esc(e.category)}</span></td>
                    <td style="color:var(--error);font-weight:700">${fmtCurrency(e.amount)}</td>
                    <td>
                      <form method="POST" action="/admin/financeiro/despesa/${e.id}/excluir" style="display:inline" onsubmit="return confirm('Excluir esta despesa?')">
                        <button type="submit" class="btn" style="font-size:11px;padding:4px 10px;background:#EF444422;color:#F87171;border:none">🗑</button>
                      </form>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>

    <!-- Modal Nova Despesa -->
    <div id="newExpenseModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
      <div style="background:var(--surface);border-radius:16px;padding:28px;width:460px;max-width:90vw;max-height:90vh;overflow-y:auto">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">💸 Nova Despesa</h2>
        <form method="POST" action="/admin/financeiro/despesa">
          <div class="form-group">
            <label class="form-label">Descrição *</label>
            <input type="text" name="description" class="form-input" required placeholder="Ex: Aluguel, produto, equipamento..." />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Categoria *</label>
              <select name="category" class="form-input" required>
                <option value="Aluguel">Aluguel</option>
                <option value="Produto">Produto</option>
                <option value="Equipamento">Equipamento</option>
                <option value="Salário">Salário</option>
                <option value="Marketing">Marketing</option>
                <option value="Utilidades">Utilidades</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Valor (R$) *</label>
              <input type="number" name="amount" class="form-input" step="0.01" min="0.01" required placeholder="0,00" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Data *</label>
              <input type="date" name="date" class="form-input" value="${today()}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Forma de Pagamento</label>
              <select name="paymentMethod" class="form-input">
                <option value="cash">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="credit_card">Cartão</option>
                <option value="other">Outro</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:20px">
            <button type="button" onclick="document.getElementById('newExpenseModal').style.display='none'" class="btn" style="flex:1">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1">Registrar Despesa</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const tabs = [
    { id: "resumo", label: "📊 Resumo" },
    { id: "receitas", label: "🧧 Receitas" },
    { id: "despesas", label: "💸 Despesas" },
  ];
  const tabNav = `
    <div style="display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:0">
      ${tabs.map(t => `
        <a href="/admin/financeiro?tab=${t.id}&period=${period}" style="padding:10px 20px;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px 8px 0 0;border:1px solid ${activeTab === t.id ? 'var(--border)' : 'transparent'};border-bottom:${activeTab === t.id ? '1px solid var(--surface)' : '1px solid var(--border)'};background:${activeTab === t.id ? 'var(--surface)' : 'transparent'};color:${activeTab === t.id ? '#C9A84C' : 'var(--muted)'};margin-bottom:-1px">${t.label}</a>
      `).join("")}
    </div>
  `;

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Lançamento salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Lançamento excluído!</div>` : ""}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <h2 style="font-size:20px;font-weight:700;margin:0">💰 Financeiro</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <select onchange="location.href='/admin/financeiro?tab=${activeTab}&period='+this.value"
          style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">${periodOptions}</select>
        <a href="/admin/export/financeiro.csv?period=${period}" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">↓ CSV</a>
      </div>
    </div>
    ${tabNav}
    ${activeTab === "resumo" ? tabResumo : activeTab === "receitas" ? tabReceitas : tabDespesas}
  `;

  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Financeiro", "financeiro", body, barber?.name, _tp));
}

// ─── Configurações ────────────────────────────────────────────
async function renderConfiguracoes(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const settings = await db.getShopSettings();
  const saved = req.query.saved === "1";
  const slugSaved = req.query.slugsaved === "1";
  const slugError = req.query.slugerror as string | undefined;
  const activeTab = (req.query.tab as string) ?? "dados";

  // Buscar tenant para obter o slug
  const tenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;
  const currentSlug = tenant?.slug ?? "";
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "";
  const publicUrl = currentSlug ? `${baseUrl}/pub/${currentSlug}` : "";
  const bookingUrl = currentSlug ? `${baseUrl}/pub/${currentSlug}/agendar` : "";

  // Gerar QR Code como data URL
  let qrDataUrl = "";
  if (bookingUrl) {
    try {
      const QRCode = await import("qrcode");
      qrDataUrl = await QRCode.default.toDataURL(bookingUrl, { width: 200, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
    } catch { /* sem QR Code */ }
  }

  // Buscar equipe e horários de trabalho
  const allBarbers = await db.getAllBarbersIncludingInactive(barber?.tenantId);
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

  // Aba: URL Pública
  const tabUrl = `
    ${slugSaved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ URL atualizada com sucesso!</div>` : ""}
    ${slugError ? `<div style="background:#EF444422;border:1px solid #EF444444;color:var(--error);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">❌ ${esc(slugError)}</div>` : ""}

    <!-- Card principal: link de agendamento -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">🔗 Link de Agendamento Online</div></div>
      <div class="card-body">
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px">Compartilhe este link com seus clientes para que eles possam agendar online diretamente pela página da sua barbearia.</div>
        ${bookingUrl ? `
          <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <!-- QR Code -->
            ${qrDataUrl ? `<div style="flex-shrink:0;background:#fff;padding:8px;border-radius:12px;border:1px solid var(--border)">
              <img src="${qrDataUrl}" width="140" height="140" alt="QR Code" style="display:block" />
              <div style="font-size:10px;color:#666;text-align:center;margin-top:4px">QR Code</div>
            </div>` : ""}
            <!-- Links e ações -->
            <div style="flex:1;min-width:200px">
              <div style="margin-bottom:12px">
                <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:6px">PÁGINA PRINCIPAL</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <input id="url-vitrine" class="form-input" type="text" value="${esc(publicUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
                  <button onclick="copyUrl('url-vitrine')" class="btn btn-ghost" style="flex-shrink:0;padding:8px 12px;font-size:12px">📋 Copiar</button>
                  <a href="${esc(publicUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 12px;font-size:12px">🔗 Abrir</a>
                </div>
              </div>
              <div style="margin-bottom:12px">
                <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:6px">LINK DIRETO PARA AGENDAMENTO</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <input id="url-booking" class="form-input" type="text" value="${esc(bookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
                  <button onclick="copyUrl('url-booking')" class="btn btn-ghost" style="flex-shrink:0;padding:8px 12px;font-size:12px">📋 Copiar</button>
                  <a href="${esc(bookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 12px;font-size:12px">🔗 Abrir</a>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <a href="https://wa.me/?text=${encodeURIComponent('Agende seu horário online: ' + bookingUrl)}" target="_blank" class="btn btn-primary" style="font-size:12px;padding:8px 16px">📲 Compartilhar no WhatsApp</a>
                ${qrDataUrl ? `<a href="${qrDataUrl}" download="qrcode-agendamento.png" class="btn btn-ghost" style="font-size:12px;padding:8px 16px">⬇️ Baixar QR Code</a>` : ""}
              </div>
            </div>
          </div>
        ` : `<div style="color:var(--muted);font-size:13px">⚠️ Não foi possível gerar o link. Verifique as configurações do servidor.</div>`}
      </div>
    </div>

    <!-- Card: personalizar slug -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">⚙️ Personalizar URL</div></div>
      <div class="card-body">
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px">O identificador da URL (“slug”) é a parte final do link que identifica sua barbearia. Use apenas letras minúsculas, números e hífens.</div>
        <form method="POST" action="/admin/configuracoes/slug">
          <div style="display:flex;align-items:center;gap:0;margin-bottom:16px">
            <div style="padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-right:none;border-radius:8px 0 0 8px;font-size:12px;color:var(--muted);white-space:nowrap;font-family:monospace">${esc(baseUrl)}/pub/</div>
            <input class="form-input" type="text" name="slug" value="${esc(currentSlug)}" required pattern="[a-z0-9\\-]+" title="Apenas letras minúsculas, números e hífens" style="border-radius:0 8px 8px 0;font-family:monospace;font-size:14px" placeholder="nome-da-barbearia" />
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:16px">⚠️ Ao alterar o slug, o link antigo deixará de funcionar. Atualize todos os locais onde o link foi compartilhado.</div>
          <button type="submit" class="btn btn-primary" style="padding:10px 24px">Salvar Nova URL</button>
        </form>
      </div>
    </div>

    <script>
    function copyUrl(id) {
      const el = document.getElementById(id);
      if (!el) return;
      navigator.clipboard.writeText(el.value).then(() => {
        const btn = el.nextElementSibling;
        if (btn) { const orig = btn.textContent; btn.textContent = '✅ Copiado!'; setTimeout(() => btn.textContent = orig, 2000); }
      });
    }
    </script>
  `;

  const tabs = [
    { id: 'dados', label: '🏦 Dados' },
    { id: 'horarios', label: '🕒 Horários' },
    { id: 'equipe', label: '👥 Equipe' },
  ];

  const tabContent: Record<string, string> = {
    dados: tabDados,
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

  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Configurações", "configuracoes", body, barber?.name, _tp));
}

// ─── Registro das rotas ───────────────────────────────────────────────────────
// ─── Novo Agendamento (Admin Web) ───────────────────────────────────────────────
async function renderNovoAgendamento(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
  const clients = await db.getAllClients(tenantId);
  const services = await db.getAllServices(true, tenantId);
  const barbers = await db.getAllBarbers(tenantId);
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
  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Novo Agendamento", "agenda", body, barber?.name, _tp));
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
  const tenantId = barber?.tenantId ?? null;
  const allSales = await db.getSalesByDateRange(startStr, endStr, undefined, tenantId);
  const allExpenses = await db.getExpensesByDateRange(startStr, endStr, tenantId);
  const allBarbers = await db.getAllBarbers(tenantId);
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
  // Formas de pagamento
  const paymentMap: Record<string, number> = {};
  allSales.forEach((s: any) => {
    const pm = s.paymentMethod ?? "other";
    paymentMap[pm] = (paymentMap[pm] ?? 0) + parseFloat(s.total ?? "0");
  });
  const pmLabels: Record<string, string> = { cash: "Dinheiro", credit_card: "Cartão Crédito", debit_card: "Cartão Débito", pix: "Pix", mercado_pago: "Mercado Pago", other: "Outro" };
  const pmColors = ["#C9A84C", "#4ADE80", "#60A5FA", "#F472B6", "#A78BFA", "#FB923C"];
  const pmEntries = Object.entries(paymentMap).sort((a, b) => b[1] - a[1]);
  const pmTotal = pmEntries.reduce((s, [, v]) => s + v, 0) || 1;
  // Gerar gráfico de pizza SVG
  let pieSvg = "";
  if (pmEntries.length > 0) {
    let angle = -Math.PI / 2;
    const cx = 80, cy = 80, r = 65;
    const slices = pmEntries.map(([key, val], i) => {
      const pct = val / pmTotal;
      const a1 = angle;
      const a2 = angle + pct * 2 * Math.PI;
      angle = a2;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = pct > 0.5 ? 1 : 0;
      return `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${pmColors[i % pmColors.length]}" opacity="0.9"/>`;
    }).join("");
    const legend = pmEntries.map(([key, val], i) => `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <div style="width:10px;height:10px;border-radius:2px;background:${pmColors[i % pmColors.length]};flex-shrink:0"></div>
        <span style="font-size:12px">${pmLabels[key] ?? key}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:auto">${Math.round(val / pmTotal * 100)}%</span>
      </div>`).join("");
    pieSvg = `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      <svg width="160" height="160" viewBox="0 0 160 160">${slices}</svg>
      <div style="flex:1;min-width:140px">${legend}</div>
    </div>`;
  } else {
    pieSvg = '<div class="empty">Sem dados de pagamento no período.</div>';
  }
  // Gráfico de linha SVG — tendência de faturamento (acumulado por semana se > 14 dias)
  let lineSvg = "";
  if (days <= 14) {
    // Linha diária
    const lineVals = dayVals;
    const lineKeys = dayKeys;
    const lMax = Math.max(...lineVals, 1);
    const pts = lineVals.map((v, i) => {
      const x = 20 + i * (560 / Math.max(lineKeys.length - 1, 1));
      const y = 130 - Math.round((v / lMax) * 110);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const dots = lineVals.map((v, i) => {
      const x = 20 + i * (560 / Math.max(lineKeys.length - 1, 1));
      const y = 130 - Math.round((v / lMax) * 110);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#C9A84C"/>`;
    }).join("");
    lineSvg = `<svg width="600" height="150" style="width:100%;max-width:600px">
      <polyline points="${pts}" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  }
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
        <a href="/admin/export/financeiro.csv?period=${period}" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">↓ Exportar CSV</a>
        <a href="/admin/export/relatorio.pdf?period=${period}" class="btn btn-primary" style="font-size:12px;padding:6px 12px">📄 Exportar PDF</a>
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
    <!-- Gráfico de linha (apenas para períodos curtos) -->
    ${lineSvg ? `<div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">📉 Tendência de Faturamento</div></div>
      <div class="card-body" style="overflow-x:auto">${lineSvg}</div>
    </div>` : ""}
    <!-- Grid ranking + barbeiros + pizza -->
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
    <!-- Formas de pagamento -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">💳 Formas de Pagamento</div></div>
      <div class="card-body">${pieSvg}</div>
    </div>
  `;
  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Relatórios", "relatorios", body, barber?.name, _tp));
}

// ──// ─── Página do Cliente ───────────────────────────────────────────
async function renderPaginaCliente(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const settings = await db.getShopSettings(barber?.tenantId);
  const saved = req.query.saved === "1";
  const slugSaved = req.query.slugsaved === "1";
  const slugError = req.query.slugerror as string | undefined;
  const activeTab = (req.query.tab as string) ?? "url";

  // Buscar tenant para slug
  const tenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;
  const currentSlug = tenant?.slug ?? "";
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "";
  const publicUrl = currentSlug ? `${baseUrl}/pub/${currentSlug}` : "";
  const bookingUrl = currentSlug ? `${baseUrl}/pub/${currentSlug}/agendar` : "";

  // Gerar QR Code
  let qrDataUrl = "";
  if (bookingUrl) {
    try {
      const QRCode = await import("qrcode");
      qrDataUrl = await QRCode.default.toDataURL(bookingUrl, { width: 220, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
    } catch { /* sem QR Code */ }
  }

  // ─── Aba: URL & QR Code ──────────────────────────────────────────────────
  const tabUrlQr = `
    ${slugSaved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ URL atualizada com sucesso!</div>` : ""}
    ${slugError ? `<div style="background:#EF444422;border:1px solid #EF444444;color:var(--error);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">❌ ${esc(slugError)}</div>` : ""}

    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">🔗 Links de Agendamento</div></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--muted);margin-bottom:20px">Compartilhe estes links com seus clientes para que eles possam agendar online diretamente pela página da sua barbearia.</p>
        ${bookingUrl ? `
          <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
            ${qrDataUrl ? `
              <div style="flex-shrink:0;text-align:center">
                <div style="background:#fff;padding:12px;border-radius:16px;border:1px solid var(--border);display:inline-block">
                  <img src="${qrDataUrl}" width="160" height="160" alt="QR Code" style="display:block" />
                </div>
                <div style="font-size:11px;color:var(--muted);margin-top:8px">QR Code de Agendamento</div>
                <a href="${qrDataUrl}" download="qrcode-agendamento.png" class="btn btn-ghost" style="font-size:11px;padding:6px 12px;margin-top:8px">⬇️ Baixar PNG</a>
              </div>` : ""}
            <div style="flex:1;min-width:220px">
              <div style="margin-bottom:16px">
                <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">PÁGINA PRINCIPAL DA BARBEARIA</div>
                <div style="display:flex;gap:8px">
                  <input id="url-vitrine" class="form-input" type="text" value="${esc(publicUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
                  <button onclick="copyUrl('url-vitrine', this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">📋 Copiar</button>
                  <a href="${esc(publicUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">🔗 Abrir</a>
                </div>
              </div>
              <div style="margin-bottom:20px">
                <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">LINK DIRETO PARA AGENDAMENTO</div>
                <div style="display:flex;gap:8px">
                  <input id="url-booking" class="form-input" type="text" value="${esc(bookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
                  <button onclick="copyUrl('url-booking', this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">📋 Copiar</button>
                  <a href="${esc(bookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">🔗 Abrir</a>
                </div>
              </div>
              <!-- Compartilhamento -->
              <div style="margin-top:4px">
                <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:10px">COMPARTILHAR</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <a href="https://wa.me/?text=${encodeURIComponent('Agende seu horário online: ' + bookingUrl)}" target="_blank" class="btn btn-primary" style="font-size:12px;padding:8px 16px;display:flex;align-items:center;gap:6px">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L.057 23.776a.5.5 0 0 0 .614.614l5.929-1.465A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.695-.5-5.24-1.374l-.375-.216-3.878.959.975-3.764-.237-.388A9.945 9.945 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    WhatsApp
                  </a>
                  <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:8px 16px;display:flex;align-items:center;gap:6px;background:#1877F2;color:#fff;border-color:#1877F2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </a>
                  <button onclick="(function(){var msg='Agende seu horário comigo!\n\n✂️ Serviços, preços e disponibilidade:\n${esc(bookingUrl)}\n\nClique no link e escolha o melhor horário para você!';navigator.clipboard.writeText(msg).then(function(){var b=event.target.closest('button');var o=b.innerHTML;b.innerHTML='✅ Copiado!';setTimeout(function(){b.innerHTML=o;},2500);});})()" class="btn btn-ghost" style="font-size:12px;padding:8px 16px;display:flex;align-items:center;gap:6px">
                    📝 Mensagem pronta
                  </button>
                </div>
              </div>
            </div>
          </div>
        ` : `<div style="color:var(--muted);font-size:13px">⚠️ Não foi possível gerar o link. Configure o PUBLIC_BASE_URL no servidor.</div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">⚙️ Personalizar URL</div></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--muted);margin-bottom:16px">O slug é a parte final do link que identifica sua barbearia. Use apenas letras minúsculas, números e hífens.</p>
        <form method="POST" action="/admin/pagina-cliente/slug">
          <div style="display:flex;align-items:center;gap:0;margin-bottom:12px">
            <div style="padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-right:none;border-radius:8px 0 0 8px;font-size:12px;color:var(--muted);white-space:nowrap;font-family:monospace">${esc(baseUrl)}/pub/</div>
            <input class="form-input" type="text" name="slug" value="${esc(currentSlug)}" required pattern="[a-z0-9\\-]+" title="Apenas letras minúsculas, números e hífens" style="border-radius:0 8px 8px 0;font-family:monospace;font-size:14px" placeholder="nome-da-barbearia" />
          </div>
          <p style="font-size:11px;color:var(--muted);margin-bottom:16px">⚠️ Ao alterar o slug, o link antigo deixará de funcionar. Atualize todos os locais onde o link foi compartilhado.</p>
          <button type="submit" class="btn btn-primary" style="padding:10px 24px">Salvar Nova URL</button>
        </form>
      </div>
    </div>

    <script>
    function copyUrl(id, btn) {
      const el = document.getElementById(id);
      if (!el) return;
      navigator.clipboard.writeText(el.value).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✅ Copiado!';
        setTimeout(() => btn.textContent = orig, 2000);
      });
    }
    </script>
  `;

  // ─── Aba: Personalização Visual ──────────────────────────────────────────────
  const tabVisual = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Configurações visuais salvas!</div>` : ""}
    <form method="POST" action="/admin/pagina-cliente/visual">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
        <div class="form-group">
          <label class="form-label">Cor Principal da Página</label>
          <div style="display:flex;align-items:center;gap:12px">
            <input type="color" name="primaryColor" value="${esc(settings?.primaryColor ?? "#C9A84C")}" style="width:48px;height:40px;border:1px solid var(--border);border-radius:8px;background:none;cursor:pointer;padding:2px" />
            <input class="form-input" type="text" id="colorHex" value="${esc(settings?.primaryColor ?? "#C9A84C")}" style="flex:1" placeholder="#C9A84C" />
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px">Cor usada nos botões e destaques da página de agendamento.</div>
        </div>
        <div class="form-group">
          <label class="form-label">URL do Banner</label>
          <input class="form-input" type="text" name="bannerUrl" value="${esc(settings?.bannerUrl ?? "")}" placeholder="https://..." />
          <div style="font-size:11px;color:var(--muted);margin-top:6px">Imagem de fundo do hero (1200×400px recomendado).</div>
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

  // ─── Aba: Domínio Customizado ──────────────────────────────────────────────
  const domainSaved = req.query.domainsaved === "1";
  const tabDominio = `
    ${domainSaved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Domínio salvo com sucesso!</div>` : ""}
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">🌐 Domínio Personalizado</div></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--muted);margin-bottom:20px">Configure um domínio próprio para a página de agendamento da sua barbearia (ex: <code>agendamento.minhabarbearia.com.br</code>). O domínio precisa ser apontado para este servidor via registro DNS do tipo CNAME ou A.</p>
        <form method="POST" action="/admin/pagina-cliente/dominio">
          <div class="form-group">
            <label class="form-label">Domínio Personalizado</label>
            <input class="form-input" type="text" name="customDomain" value="${esc(settings?.customDomain ?? "")}" placeholder="agendamento.minhabarbearia.com.br" />
            <div style="font-size:11px;color:var(--muted);margin-top:6px">Deixe em branco para usar apenas o link padrão do sistema.</div>
          </div>
          <button type="submit" class="btn btn-primary" style="padding:10px 24px">Salvar Domínio</button>
        </form>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">📍 Como configurar o DNS</div></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Após salvar o domínio acima, acesse o painel do seu provedor de DNS e adicione um dos registros abaixo:</p>
        <div style="background:var(--surface2);border-radius:8px;padding:16px;font-family:monospace;font-size:12px;margin-bottom:12px">
          <div style="color:var(--muted);margin-bottom:8px"># Opção 1: Registro CNAME (recomendado para subdomínios)</div>
          <div>Tipo: <strong>CNAME</strong></div>
          <div>Nome: <strong>agendamento</strong> (ou o subdomínio desejado)</div>
          <div>Valor: <strong>${esc(baseUrl.replace(/^https?:\/\//, ""))}</strong></div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:16px;font-family:monospace;font-size:12px">
          <div style="color:var(--muted);margin-bottom:8px"># Opção 2: Registro A (para domínio raiz)</div>
          <div>Tipo: <strong>A</strong></div>
          <div>Nome: <strong>@</strong> ou <strong>agendamento</strong></div>
          <div>Valor: <strong>[IP do servidor]</strong></div>
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:12px">⚠️ A propagação do DNS pode levar até 48 horas. Entre em contato com o suporte após configurar.</p>
      </div>
    </div>
  `;

  // ─── Aba: Rastreamento ──────────────────────────────────────────────────────
  const trackingSaved = req.query.trackingsaved === "1";
  const tabRastreamento = `
    ${trackingSaved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Configurações de rastreamento salvas!</div>` : ""}
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">📊 Google Analytics 4</div></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Acompanhe as visitas e conversões da sua página de agendamento com o Google Analytics 4. Crie uma propriedade em <a href="https://analytics.google.com" target="_blank" style="color:var(--gold)">analytics.google.com</a> e cole o Measurement ID abaixo.</p>
        <form method="POST" action="/admin/pagina-cliente/rastreamento">
          <div class="form-group">
            <label class="form-label">Google Analytics 4 — Measurement ID</label>
            <input class="form-input" type="text" name="ga4MeasurementId" value="${esc(settings?.ga4MeasurementId ?? "")}" placeholder="G-XXXXXXXXXX" style="font-family:monospace" />
            <div style="font-size:11px;color:var(--muted);margin-top:6px">Formato: G-XXXXXXXXXX. Encontrado em Administrador → Fluxos de dados → Tag do Google.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Facebook Pixel ID</label>
            <input class="form-input" type="text" name="facebookPixelId" value="${esc(settings?.facebookPixelId ?? "")}" placeholder="123456789012345" style="font-family:monospace" />
            <div style="font-size:11px;color:var(--muted);margin-top:6px">Encontrado no Gerenciador de Anúncios → Fontes de Dados → Pixels.</div>
          </div>
          <button type="submit" class="btn btn-primary" style="padding:10px 24px">Salvar Rastreamento</button>
        </form>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">ℹ️ Como funciona</div></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Quando configurados, os scripts de rastreamento são injetados automaticamente em todas as páginas públicas da sua barbearia (vitrine, agendamento, pagamento). Você poderá acompanhar:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="background:var(--surface2);border-radius:8px;padding:12px">
            <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:6px">📊 Google Analytics 4</div>
            <div style="font-size:12px;color:var(--muted)">Visitas à página, origem do tráfego, taxa de conversão de agendamentos, dispositivos e localização dos visitantes.</div>
          </div>
          <div style="background:var(--surface2);border-radius:8px;padding:12px">
            <div style="font-size:12px;font-weight:700;color:#1877F2;margin-bottom:6px">📰 Facebook Pixel</div>
            <div style="font-size:12px;color:var(--muted)">Rastreamento de conversões para anúncios no Facebook e Instagram, criação de públicos personalizados e retargeting.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // ─── Aba: Preview ──────────────────────────────────────────────────────────
  const previewTimestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tabPreview = publicUrl ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title">👁️ Preview da Página Pública</div>
        <div style="display:flex;gap:8px;align-items:center">
          <span id="preview-ts" style="font-size:11px;color:var(--muted)">Carregado às ${previewTimestamp}</span>
          <button onclick="(function(){var f=document.getElementById('preview-iframe');var ts=document.getElementById('preview-ts');f.src=f.src.split('?')[0]+'?t='+Date.now();ts.textContent='Recarregado às '+new Date().toLocaleTimeString('pt-BR');})()" class="btn btn-ghost" style="font-size:12px;padding:6px 14px">🔄 Recarregar</button>
          <a href="${esc(publicUrl)}" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:6px 14px">🔗 Abrir em nova aba</a>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <iframe id="preview-iframe" src="${esc(publicUrl)}" style="width:100%;height:600px;border:none;border-radius:0 0 12px 12px" loading="lazy"></iframe>
      </div>
    </div>
  ` : `
    <div class="card">
      <div class="card-body">
        <div style="text-align:center;padding:40px;color:var(--muted)">
          <div style="font-size:48px;margin-bottom:16px">🌐</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px">Página pública não disponível</div>
          <div style="font-size:13px">Configure o PUBLIC_BASE_URL no servidor para habilitar o preview.</div>
        </div>
      </div>
    </div>
  `;

  // ─── Aba: SEO ─────────────────────────────────────────────────────
  const tabSeo = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">🔍 SEO & Compartilhamento</div></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--muted);margin-bottom:20px">Configure como sua página aparece nos resultados do Google e quando compartilhada no WhatsApp, Facebook e Instagram. Estes dados são injetados automaticamente como meta tags na página pública.</p>
        <form method="POST" action="/admin/pagina-cliente/seo">
          <div class="form-group">
            <label class="form-label">🏷️ Título da Página <span style="color:var(--muted);font-weight:400">(até 60 caracteres)</span></label>
            <input class="form-input" type="text" name="seoTitle" value="${esc(settings?.seoTitle ?? "")}" placeholder="Ex: Barbearia do João — Cortes modernos em São Paulo" maxlength="100" />
            <div style="font-size:11px;color:var(--muted);margin-top:6px">Aparece na aba do navegador e nos resultados de busca do Google. Se vazio, usa o nome da barbearia.</div>
          </div>
          <div class="form-group">
            <label class="form-label">📝 Meta Descrição <span style="color:var(--muted);font-weight:400">(até 160 caracteres)</span></label>
            <textarea class="form-input" name="seoDescription" rows="3" placeholder="Ex: Agende seu corte online! Barbearia especializada em cortes modernos, barba e bigode. Atendimento rápido e sem espera." maxlength="300" style="resize:vertical">${esc(settings?.seoDescription ?? "")}</textarea>
            <div style="font-size:11px;color:var(--muted);margin-top:6px">Exibida nos resultados do Google abaixo do título. Impacta diretamente a taxa de cliques.</div>
          </div>
          <div class="form-group">
            <label class="form-label">🖼️ Imagem Open Graph <span style="color:var(--muted);font-weight:400">(URL da imagem, 1200×630px ideal)</span></label>
            <input class="form-input" type="url" name="seoImageUrl" value="${esc(settings?.seoImageUrl ?? "")}" placeholder="https://exemplo.com/imagem-barbearia.jpg" />
            <div style="font-size:11px;color:var(--muted);margin-top:6px">Imagem exibida quando o link é compartilhado no WhatsApp, Facebook e Instagram. Recomendado: 1200×630px. Se vazio, usa o banner ou logo da barbearia.</div>
          </div>
          ${settings?.seoImageUrl ? `
          <div style="margin-bottom:20px">
            <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px">PRÉVIA DO COMPARTILHAMENTO</div>
            <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;max-width:400px">
              <img src="${esc(settings.seoImageUrl)}" alt="OG Image" style="width:100%;height:200px;object-fit:cover;display:block" onerror="this.style.display='none'" />
              <div style="padding:12px;background:var(--surface)">
                <div style="font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase">${esc(publicUrl || "sua-url.com")}</div>
                <div style="font-size:14px;font-weight:700;color:var(--foreground);margin-bottom:4px">${esc(settings.seoTitle || settings.shopName || "Barbearia")}</div>
                <div style="font-size:12px;color:var(--muted)">${esc(settings.seoDescription || "Agende seu horário online.")}</div>
              </div>
            </div>
          </div>` : ""}
          <button type="submit" class="btn btn-primary" style="padding:10px 24px">Salvar SEO</button>
        </form>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">ℹ️ Dicas de SEO</div></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="background:var(--surface2);border-radius:8px;padding:12px">
            <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:6px">🔍 Google</div>
            <div style="font-size:12px;color:var(--muted)">Use palavras-chave como "barbearia", "corte de cabelo" e o nome da sua cidade no título e descrição para aparecer nas buscas locais.</div>
          </div>
          <div style="background:var(--surface2);border-radius:8px;padding:12px">
            <div style="font-size:12px;font-weight:700;color:#25D366;margin-bottom:6px">📱 WhatsApp</div>
            <div style="font-size:12px;color:var(--muted)">Quando você compartilha o link no WhatsApp, a imagem Open Graph é exibida automaticamente como prévia. Use uma foto atraente da barbearia.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Buscar dados de marketplace do tenant
  const tenantMarketplace = tenant ? {
    visivelMarketplace: (tenant as any).visivelMarketplace ?? false,
    descricao: (tenant as any).descricao ?? "",
    fotoCapa: (tenant as any).fotoCapa ?? "",
    latitude: (tenant as any).latitude ?? "",
    longitude: (tenant as any).longitude ?? "",
  } : null;
  const marketplaceSaved = req.query.mksaved === "1";
  const mkName = esc(tenant?.name ?? "Sua Barbearia");
  const mkCity = esc((tenant as any)?.city ?? "");
  const mkState = esc((tenant as any)?.state ?? "");
  const mkLocation = mkCity ? `${mkCity}${mkState ? ", " + mkState : ""}` : "";
  const mkLogo = esc(settings?.logoUrl ?? "");
  const tabMarketplace = `
    ${marketplaceSaved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Configurações do Marketplace salvas!</div>` : ""}
    <div style="display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start">
      <!-- Formulário -->
      <div class="card">
        <div class="card-header"><h3>🏪 Marketplace Barber Pro</h3></div>
        <div class="card-body">
          <p style="font-size:14px;color:var(--muted);margin-bottom:20px;line-height:1.6">Aparecer no <a href="/marketplace" target="_blank" style="color:var(--gold)">Marketplace Barber Pro</a> permite que novos clientes descubram sua barbearia. Ative a visibilidade e preencha as informações abaixo.</p>
          <form method="POST" action="/admin/pagina-cliente/marketplace" id="mkForm">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;background:var(--surface2);border-radius:12px;padding:16px">
              <label style="position:relative;display:inline-block;width:48px;height:26px;flex-shrink:0">
                <input type="checkbox" name="visivelMarketplace" value="1" id="mkVisible" ${tenantMarketplace?.visivelMarketplace ? "checked" : ""} style="opacity:0;width:0;height:0" />
                <span id="mkToggle" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${tenantMarketplace?.visivelMarketplace ? "var(--success)" : "var(--border)"};border-radius:26px;transition:0.3s" onclick="var cb=document.getElementById('mkVisible');cb.checked=!cb.checked;this.style.background=cb.checked?'var(--success)':'var(--border)';document.getElementById('mk-status').textContent=cb.checked?'Visível no Marketplace':'Oculto no Marketplace';updatePreview()"></span>
              </label>
              <div>
                <div style="font-size:14px;font-weight:700" id="mk-status">${tenantMarketplace?.visivelMarketplace ? "Visível no Marketplace" : "Oculto no Marketplace"}</div>
                <div style="font-size:12px;color:var(--muted)">Quando ativo, sua barbearia aparece na página de descoberta</div>
              </div>
            </div>
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">DESCRIÇÃO DA BARBEARIA</label>
              <textarea id="mkDesc" name="descricao" rows="3" placeholder="Descreva sua barbearia, especialidades, diferenciais..." oninput="updatePreview()" style="width:100%;padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;resize:vertical">${esc(tenantMarketplace?.descricao ?? "")}</textarea>
            </div>
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">URL DA FOTO DE CAPA</label>
              <input id="mkFoto" type="url" name="fotoCapa" value="${esc(tenantMarketplace?.fotoCapa ?? "")}" placeholder="https://..." oninput="updatePreview()" style="width:100%;padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
              <div style="font-size:12px;color:var(--muted);margin-top:4px">Imagem de capa exibida no card do marketplace (recomendado: 800x400px)</div>
            </div>
            <div style="margin-bottom:20px">
              <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">LOCALIZAÇÃO (COORDENADAS)</label>
              <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end">
                <div>
                  <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px">Latitude</label>
                  <input id="mkLat" type="text" name="latitude" value="${esc(tenantMarketplace?.latitude ?? "")}" placeholder="-23.5505" style="width:100%;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px" />
                </div>
                <div>
                  <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px">Longitude</label>
                  <input id="mkLng" type="text" name="longitude" value="${esc(tenantMarketplace?.longitude ?? "")}" placeholder="-46.6333" style="width:100%;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px" />
                </div>
                <button type="button" onclick="buscarCoordenadas()" style="padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;cursor:pointer;white-space:nowrap">📍 Buscar pelo endereço</button>
              </div>
              <div id="mkGeoStatus" style="font-size:11px;color:var(--muted);margin-top:4px">Preencha o endereço da barbearia em Configurações para usar a busca automática.</div>
            </div>
            <button type="submit" class="btn btn-primary">Salvar Marketplace</button>
            <a href="/marketplace" target="_blank" class="btn btn-ghost" style="margin-left:8px">🔍 Ver Marketplace</a>
          </form>
        </div>
      </div>
      <!-- Preview do Card -->
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">👁️ Preview do Card</div>
        <div id="mkPreviewCard" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.15)">
          <div id="mkPreviewCapa" style="height:140px;background:${tenantMarketplace?.fotoCapa ? `url('${esc(tenantMarketplace.fotoCapa)}') center/cover` : "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)"};position:relative">
            ${tenantMarketplace?.fotoCapa ? "" : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:32px;color:rgba(255,255,255,0.3)">✂️</div>`}
          </div>
          <div style="padding:14px">
            ${mkLogo ? `<img src="${mkLogo}" style="width:44px;height:44px;border-radius:50%;border:2px solid var(--border);margin-top:-30px;margin-bottom:8px;object-fit:cover;background:var(--surface)" />` : `<div style="width:44px;height:44px;border-radius:50%;border:2px solid var(--border);margin-top:-30px;margin-bottom:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px">✂️</div>`}
            <div id="mkPreviewName" style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px">${mkName}</div>
            ${mkLocation ? `<div style="font-size:12px;color:var(--muted);margin-bottom:6px">📍 ${mkLocation}</div>` : ""}
            <div id="mkPreviewDesc" style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px">${esc(tenantMarketplace?.descricao ?? "Adicione uma descrição para aparecer aqui...")}</div>
            <a style="display:inline-block;padding:7px 14px;background:var(--gold, #c9a84c);color:#000;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Agendar</a>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center">Assim seu card aparecerá no Marketplace</div>
      </div>
    </div>
    <script>
      function updatePreview() {
        var foto = document.getElementById('mkFoto')?.value || '';
        var desc = document.getElementById('mkDesc')?.value || 'Adicione uma descrição para aparecer aqui...';
        var capa = document.getElementById('mkPreviewCapa');
        var descEl = document.getElementById('mkPreviewDesc');
        if (capa) capa.style.background = foto ? "url('" + foto + "') center/cover" : 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)';
        if (descEl) descEl.textContent = desc;
      }
      async function buscarCoordenadas() {
        var status = document.getElementById('mkGeoStatus');
        status.textContent = '⏳ Buscando coordenadas...';
        status.style.color = 'var(--muted)';
        try {
          var addr = '${esc((tenant as any)?.address ?? "")} ${esc((tenant as any)?.city ?? "")} ${esc((tenant as any)?.state ?? "")} Brasil'.trim();
          if (!addr || addr === 'Brasil') { status.textContent = 'Preencha o endereço da barbearia em Configurações primeiro.'; return; }
          var r = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(addr) + '&limit=1');
          var data = await r.json();
          if (data && data[0]) {
            document.getElementById('mkLat').value = parseFloat(data[0].lat).toFixed(7);
            document.getElementById('mkLng').value = parseFloat(data[0].lon).toFixed(7);
            status.textContent = '✅ Coordenadas encontradas: ' + data[0].display_name.substring(0, 60) + '...';
            status.style.color = 'var(--success)';
          } else {
            status.textContent = '❌ Endereço não encontrado. Preencha latitude e longitude manualmente.';
            status.style.color = 'var(--error)';
          }
        } catch(e) {
          status.textContent = '❌ Erro ao buscar. Preencha manualmente.';
          status.style.color = 'var(--error)';
        }
      }
    </script>
  `;

  const tabs = [
    { id: 'url', label: '🔗 URL & QR Code' },
    { id: 'visual', label: '🎨 Visual' },
    { id: 'dominio', label: '🌐 Domínio' },
    { id: 'rastreamento', label: '📊 Rastreamento' },
    { id: 'seo', label: '🔍 SEO' },
    { id: 'marketplace', label: '🏪 Marketplace' },
    { id: 'preview', label: '👁️ Preview' },
  ];

  const tabContent: Record<string, string> = {
    url: tabUrlQr,
    visual: tabVisual,
    dominio: tabDominio,
    rastreamento: tabRastreamento,
    seo: tabSeo,
    marketplace: tabMarketplace,
    preview: tabPreview,
  };

  const body = `
    <!-- Abas -->
    <div style="display:flex;gap:4px;margin-bottom:24px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:4px;overflow-x:auto">
      ${tabs.map(t => `
        <a href="/admin/pagina-cliente?tab=${t.id}" style="flex-shrink:0;text-align:center;padding:10px 16px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none;
          ${activeTab === t.id ? 'background:var(--gold);color:#0C0C0C' : 'color:var(--muted)'}
        ">${t.label}</a>`).join('')}
    </div>
    <!-- Conteúdo da aba ativa -->
    ${tabContent[activeTab] ?? tabUrlQr}
  `;

  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Página do Cliente", "pagina-cliente", body, barber?.name, _tp));
}

// ─── Detalhe do Cliente ────────────────────────────────────────────
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
  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout(`Cliente: ${(client as any).name}`, "clientes", body, barber?.name, _tp));
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

  // ─── Recuperação de Senha ────────────────────────────────────────────────────
  // GET /admin/forgot-password
  app.get("/admin/forgot-password", (_req: Request, res: Response) => {
    const sent = _req.query.sent === "1";
    const error = _req.query.error === "1";
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperar Senha — Barber Pro</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0C0C0C; color: #F0EEE8; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #161616; border: 1px solid #2A2A2A; border-radius: 20px; padding: 40px; width: 100%; max-width: 380px; }
    .logo { font-size: 22px; font-weight: 900; color: #C9A84C; letter-spacing: 2px; text-align: center; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #888880; text-align: center; margin-bottom: 8px; }
    .desc { font-size: 13px; color: #9BA1A6; text-align: center; margin-bottom: 28px; line-height: 1.6; }
    label { display: block; font-size: 12px; color: #888880; margin-bottom: 6px; }
    input { width: 100%; padding: 12px 14px; background: #0C0C0C; border: 1px solid #2A2A2A; border-radius: 10px; color: #F0EEE8; font-size: 14px; margin-bottom: 16px; }
    input:focus { outline: none; border-color: #C9A84C; }
    button { width: 100%; padding: 14px; background: #C9A84C; color: #0C0C0C; border: none; border-radius: 12px; font-size: 15px; font-weight: 800; cursor: pointer; margin-top: 8px; }
    button:hover { opacity: 0.9; }
    .error { background: #F8717122; border: 1px solid #F8717144; color: #F87171; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
    .success { background: #22C55E22; border: 1px solid #22C55E44; color: #4ADE80; padding: 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; text-align: center; line-height: 1.6; }
    .back { display: block; text-align: center; margin-top: 20px; font-size: 12px; color: #888880; text-decoration: none; }
    .back:hover { color: #C9A84C; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">BARBER PRO</div>
    <div class="subtitle">Recuperar Senha</div>
    ${sent ? `<div class="success">✅ E-mail enviado!<br>Verifique sua caixa de entrada e use o código para redefinir sua senha.<br><small style="color:#9BA1A6">(Verifique também a pasta de spam)</small></div>` : ""}
    ${error ? `<div class="error">E-mail não encontrado. Verifique e tente novamente.</div>` : ""}
    ${!sent ? `
    <div class="desc">Digite o e-mail da sua conta e enviaremos um código para redefinir sua senha.</div>
    <form method="POST" action="/admin/forgot-password">
      <label>E-mail da conta</label>
      <input type="email" name="email" placeholder="seu@email.com" required autofocus />
      <button type="submit">Enviar código →</button>
    </form>` : `
    <a href="/admin/reset-password" style="display:block;text-align:center;background:#C9A84C;color:#0C0C0C;font-weight:800;padding:14px;border-radius:12px;text-decoration:none;margin-top:8px">Inserir código →</a>`}
    <a href="/admin/login" class="back">← Voltar ao login</a>
  </div>
</body>
</html>`);
  });

  // POST /admin/forgot-password
  app.post("/admin/forgot-password", async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    if (!email) return res.redirect("/admin/forgot-password?error=1");
    const barber = await db.getBarberByEmail(email);
    if (!barber) return res.redirect("/admin/forgot-password?error=1");
    try {
      const token = await db.createPasswordResetToken(email);
      const { sendPasswordResetEmail } = await import("./email");
      const baseUrl = process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
      await sendPasswordResetEmail({ toEmail: email, token, baseUrl });
    } catch (err) {
      console.error("[reset] Erro ao criar token:", err);
    }
    res.redirect("/admin/forgot-password?sent=1");
  });

  // GET /admin/reset-password
  app.get("/admin/reset-password", (req: Request, res: Response) => {
    const email = (req.query.email as string) ?? "";
    const token = (req.query.token as string) ?? "";
    const error = req.query.error === "1";
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nova Senha — Barber Pro</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0C0C0C; color: #F0EEE8; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #161616; border: 1px solid #2A2A2A; border-radius: 20px; padding: 40px; width: 100%; max-width: 380px; }
    .logo { font-size: 22px; font-weight: 900; color: #C9A84C; letter-spacing: 2px; text-align: center; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #888880; text-align: center; margin-bottom: 28px; }
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
    <div class="subtitle">Criar nova senha</div>
    ${error ? `<div class="error">Código inválido ou expirado. <a href="/admin/forgot-password" style="color:#C9A84C">Solicitar novo código</a>.</div>` : ""}
    <form method="POST" action="/admin/reset-password">
      <label>E-mail</label>
      <input type="email" name="email" value="${esc(email)}" placeholder="seu@email.com" required />
      <label>Código de verificação</label>
      <input type="text" name="token" value="${esc(token)}" placeholder="000000" maxlength="6" required style="letter-spacing:4px;font-size:20px;font-weight:700" />
      <label>Nova senha</label>
      <input type="password" name="password" placeholder="Mínimo 6 caracteres" minlength="6" required />
      <label>Confirmar nova senha</label>
      <input type="password" name="confirm" placeholder="Repita a senha" minlength="6" required />
      <button type="submit">Salvar nova senha →</button>
    </form>
    <a href="/admin/login" class="back">← Voltar ao login</a>
  </div>
</body>
</html>`);
  });

  // POST /admin/reset-password
  app.post("/admin/reset-password", async (req: Request, res: Response) => {
    const { email, token, password, confirm } = req.body ?? {};
    if (!email || !token || !password || password !== confirm || password.length < 6) {
      return res.redirect(`/admin/reset-password?email=${encodeURIComponent(email ?? "")}&token=${encodeURIComponent(token ?? "")}&error=1`);
    }
    const valid = await db.consumePasswordResetToken(email, token);
    if (!valid) {
      return res.redirect(`/admin/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&error=1`);
    }
    let bcrypt: any;
    try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
    const hash = bcrypt ? await bcrypt.hash(password, 10) : password;
    const barber = await db.getBarberByEmail(email);
    if (!barber) return res.redirect("/admin/login?error=1");
    await db.updateBarber(barber.id, { passwordHash: hash });
    res.redirect("/admin/login?reset=1");
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

  // POST /admin/configuracoes/slug (alterar URL pública)
  app.post("/admin/configuracoes/slug", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      if (!barber?.tenantId) {
        res.redirect("/admin/configuracoes?tab=url&slugerror=Tenant+n%C3%A3o+encontrado"); return;
      }
      const { slug } = req.body ?? {};
      if (!slug || !/^[a-z0-9\-]+$/.test(slug)) {
        res.redirect("/admin/configuracoes?tab=url&slugerror=Slug+inv%C3%A1lido.+Use+apenas+letras+min%C3%BAsculas%2C+n%C3%BAmeros+e+h%C3%ADfens"); return;
      }
      // Verificar se o slug já está em uso por outro tenant
      const existing = await db.getTenantBySlug(slug);
      if (existing && existing.id !== barber.tenantId) {
        res.redirect("/admin/configuracoes?tab=url&slugerror=Este+slug+j%C3%A1+est%C3%A1+em+uso+por+outra+barbearia"); return;
      }
      await db.updateTenant(barber.tenantId, { slug });
      res.redirect("/admin/configuracoes?tab=url&slugsaved=1");
    } catch (e: any) {
      const msg = encodeURIComponent(e.message ?? "Erro ao salvar");
      res.redirect(`/admin/configuracoes?tab=url&slugerror=${msg}`);
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

  // POST /admin/clientes/novo — Criar novo cliente
  app.post("/admin/clientes/novo", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const { name, phone, email, birthDate, notes } = req.body ?? {};
      if (!name || !phone) { res.redirect("/admin/clientes?error=Preencha+nome+e+telefone"); return; }
      await db.createClient({
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || undefined,
        birthDate: birthDate?.trim() || undefined,
        notes: notes?.trim() || undefined,
        tenantId: barber?.tenantId ?? undefined,
      } as any);
      res.redirect("/admin/clientes?saved=1");
    } catch (e: any) {
      res.redirect(`/admin/clientes?error=${encodeURIComponent(e.message)}`);
    }
  });

  // POST /admin/clientes/:id/editar — Editar cliente
  app.post("/admin/clientes/:id/editar", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { name, phone, email, birthDate, notes } = req.body ?? {};
      if (!name || !phone) { res.redirect(`/admin/clientes?error=Preencha+nome+e+telefone`); return; }
      await db.updateClient(id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || undefined,
        birthDate: birthDate?.trim() || undefined,
        notes: notes?.trim() || undefined,
      } as any);
      res.redirect("/admin/clientes?saved=1");
    } catch (e: any) {
      res.redirect(`/admin/clientes?error=${encodeURIComponent(e.message)}`);
    }
  });

  // POST /admin/clientes/:id/excluir — Excluir cliente (soft delete)
  app.post("/admin/clientes/:id/excluir", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await db.updateClient(id, { isActive: false } as any);
      res.redirect("/admin/clientes?deleted=1");
    } catch (e: any) {
      res.redirect(`/admin/clientes?error=${encodeURIComponent(e.message)}`);
    }
  });

  app.get("/admin/servicos", requireAdminAuth, (req, res) => renderServicos(req, res));
  app.get("/admin/financeiro", requireAdminAuth, (req, res) => renderFinanceiro(req, res));

  // POST /admin/financeiro/despesa — Criar despesa
  app.post("/admin/financeiro/despesa", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const { description, category, amount, date, paymentMethod } = req.body ?? {};
      if (!description || !category || !amount || !date) { res.redirect("/admin/financeiro?tab=despesas&error=Preencha+todos+os+campos"); return; }
      await db.createExpense({
        description: description.trim(),
        category: category.trim(),
        amount: parseFloat(amount).toFixed(2),
        date: date.trim(),
        paymentMethod: paymentMethod || undefined,
        barberId: session.barberId,
      } as any);
      res.redirect("/admin/financeiro?tab=despesas&saved=1");
    } catch (e: any) {
      res.redirect(`/admin/financeiro?tab=despesas&error=${encodeURIComponent(e.message)}`);
    }
  });

  // POST /admin/financeiro/despesa/:id/excluir — Excluir despesa
  app.post("/admin/financeiro/despesa/:id/excluir", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await db.deleteExpense(id);
      res.redirect("/admin/financeiro?tab=despesas&deleted=1");
    } catch (e: any) {
      res.redirect(`/admin/financeiro?tab=despesas&error=${encodeURIComponent(e.message)}`);
    }
  });

  // POST /admin/financeiro/venda — Criar venda manual
  app.post("/admin/financeiro/venda", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { barberId, description, total, paymentMethod, paymentStatus } = req.body ?? {};
      if (!barberId || !description || !total || !paymentMethod) { res.redirect("/admin/financeiro?tab=receitas&error=Preencha+todos+os+campos"); return; }
      const val = parseFloat(total).toFixed(2);
      await db.createSale(
        { barberId: parseInt(barberId), subtotal: val, discount: "0", total: val, paymentMethod, paymentStatus: paymentStatus || "paid", notes: description.trim() } as any,
        [{ itemType: "service", itemId: 0, itemName: description.trim(), quantity: 1, unitPrice: val, total: val }]
      );
      res.redirect("/admin/financeiro?tab=receitas&saved=1");
    } catch (e: any) {
      res.redirect(`/admin/financeiro?tab=receitas&error=${encodeURIComponent(e.message)}`);
    }
  });

  app.get("/admin/configuracoes", requireAdminAuth, (req, res) => renderConfiguracoes(req, res));
  app.get("/admin/relatorios", requireAdminAuth, (req, res) => renderRelatorios(req, res));
  app.get("/admin/pagina-cliente", requireAdminAuth, (req, res) => renderPaginaCliente(req, res));

  // POST /admin/pagina-cliente/slug — Alterar slug
  app.post("/admin/pagina-cliente/slug", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      if (!barber?.tenantId) { res.redirect("/admin/pagina-cliente?tab=url&slugerror=Tenant+n%C3%A3o+encontrado"); return; }
      const { slug } = req.body ?? {};
      if (!slug || !/^[a-z0-9\-]+$/.test(slug)) {
        res.redirect("/admin/pagina-cliente?tab=url&slugerror=Slug+inv%C3%A1lido.+Use+apenas+letras+min%C3%BAsculas%2C+n%C3%BAmeros+e+h%C3%ADfens"); return;
      }
      const existing = await db.getTenantBySlug(slug);
      if (existing && existing.id !== barber.tenantId) {
        res.redirect("/admin/pagina-cliente?tab=url&slugerror=Este+slug+j%C3%A1+est%C3%A1+em+uso"); return;
      }
      await db.updateTenant(barber.tenantId, { slug });
      res.redirect("/admin/pagina-cliente?tab=url&slugsaved=1");
    } catch (e: any) {
      res.redirect(`/admin/pagina-cliente?tab=url&slugerror=${encodeURIComponent(e.message ?? "Erro ao salvar")}`);
    }
  });

  // POST /admin/pagina-cliente/visual — Salvar visual
  app.post("/admin/pagina-cliente/visual", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const { primaryColor, bannerUrl, logoUrl, galleryUrls } = req.body ?? {};
      await db.upsertShopSettings({ primaryColor, bannerUrl, logoUrl, galleryUrls }, barber?.tenantId);
      res.redirect("/admin/pagina-cliente?tab=visual&saved=1");
    } catch (e: any) {
      res.redirect("/admin/pagina-cliente?tab=visual");
    }
  });

  // POST /admin/pagina-cliente/dominio — Salvar domínio customizado
  app.post("/admin/pagina-cliente/dominio", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const { customDomain } = req.body ?? {};
      await db.upsertShopSettings({ customDomain: customDomain || null }, barber?.tenantId);
      res.redirect("/admin/pagina-cliente?tab=dominio&domainsaved=1");
    } catch (e: any) {
      res.redirect("/admin/pagina-cliente?tab=dominio");
    }
  });

  // POST /admin/pagina-cliente/rastreamento — Salvar GA4 e Pixel
  app.post("/admin/pagina-cliente/rastreamento", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const { ga4MeasurementId, facebookPixelId } = req.body ?? {};
      await db.upsertShopSettings({ ga4MeasurementId: ga4MeasurementId || null, facebookPixelId: facebookPixelId || null }, barber?.tenantId);
      res.redirect("/admin/pagina-cliente?tab=rastreamento&trackingsaved=1");
    } catch (e: any) {
      res.redirect("/admin/pagina-cliente?tab=rastreamento");
    }
  });

   // POST /admin/pagina-cliente/seo — Salvar configurações de SEO
  app.post("/admin/pagina-cliente/seo", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const { seoTitle, seoDescription, seoImageUrl } = req.body ?? {};
      await db.upsertShopSettings({
        seoTitle: seoTitle?.trim() || null,
        seoDescription: seoDescription?.trim() || null,
        seoImageUrl: seoImageUrl?.trim() || null,
      }, barber?.tenantId);
      res.redirect("/admin/pagina-cliente?tab=seo&seosaved=1");
    } catch (e: any) {
      res.redirect("/admin/pagina-cliente?tab=seo");
    }
  });

  // POST /admin/pagina-cliente/marketplace - Salvar configuracoes do marketplace
  app.post("/admin/pagina-cliente/marketplace", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      if (!barber?.tenantId) { res.redirect("/admin/pagina-cliente?tab=marketplace"); return; }
      const { visivelMarketplace, descricao, fotoCapa, latitude, longitude } = req.body ?? {};
      await db.updateTenantMarketplace(barber.tenantId, {
        visivelMarketplace: visivelMarketplace === "1",
        descricao: descricao?.trim() || null,
        fotoCapa: fotoCapa?.trim() || null,
        latitude: latitude?.trim() || null,
        longitude: longitude?.trim() || null,
      });
      res.redirect("/admin/pagina-cliente?tab=marketplace&mksaved=1");
    } catch (e: any) {
      res.redirect("/admin/pagina-cliente?tab=marketplace");
    }
  });

  // ─── CRUD Serviços ──────────────────────────────────────────────────
  app.post("/admin/servicos", requireAdminAuth, async (req: Request, res: Response) => {
    const { name, description, price, durationMinutes, isActive, mediaBase64, mediaMime } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    let serviceId: number;
    if (editId) {
      await db.updateService(editId, { name, description, price, durationMinutes: parseInt(durationMinutes), isActive: isActive === "true" });
      serviceId = editId;
    } else {
      const newService = await db.createService({ name, description, price, durationMinutes: parseInt(durationMinutes), isActive: isActive === "true" });
      serviceId = (newService as any).insertId ?? (newService as any).id ?? 0;
    }
    // Processar upload de mídia
    if (mediaBase64 && mediaMime && serviceId) {
      try {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(mediaBase64, "base64");
        const ext = mediaMime.startsWith("video/") ? "mp4" : "jpg";
        const key = `services/${serviceId}/media-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mediaMime);
        const type = mediaMime.startsWith("video/") ? "video" : "image";
        await db.addMediaFile({ entityType: "service", entityId: serviceId, url, type });
      } catch (e) { console.error("Erro ao salvar mídia do serviço:", e); }
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
    const { name, description, price, productType, stockQuantity, minStockAlert, isActive, mediaBase64, mediaMime } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    let productId: number;
    if (editId) {
      await db.updateProduct(editId, { name, description, price, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true" });
      productId = editId;
    } else {
      const newProduct = await db.createProduct({ name, description, price, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true" });
      productId = (newProduct as any).insertId ?? (newProduct as any).id ?? 0;
    }
    // Processar upload de mídia
    if (mediaBase64 && mediaMime && productId) {
      try {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(mediaBase64, "base64");
        const ext = mediaMime.startsWith("video/") ? "mp4" : "jpg";
        const key = `products/${productId}/media-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mediaMime);
        const type = mediaMime.startsWith("video/") ? "video" : "image";
        await db.addMediaFile({ entityType: "product", entityId: productId, url, type });
      } catch (e) { console.error("Erro ao salvar mídia do produto:", e); }
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
    const activeTab = (req.query.tab as string) || "programa";
    const [config, rewards, allCoupons] = await Promise.all([
      db.getLoyaltyConfig(),
      db.getLoyaltyRewards(),
      db.getAllCoupons(),
    ]);
    const saved = req.query.saved === "1";
    const rewardTypes: Record<string, string> = {
      free_service: "Serviço Grátis",
      discount_percent: "Desconto %",
      discount_fixed: "Desconto Fixo R$",
      free_product: "Produto Grátis",
    };

    const tabs = [
      { id: "programa", label: "⭐ Programa" },
      { id: "recompensas", label: "🎁 Recompensas" },
      { id: "cupons", label: "🏷️ Cupões" },
    ];
    const tabNav = `<div style="display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid var(--border)">
      ${tabs.map(t => `<a href="/admin/fidelidade?tab=${t.id}" style="padding:10px 18px;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px 8px 0 0;border:1px solid ${activeTab === t.id ? 'var(--border)' : 'transparent'};border-bottom:${activeTab === t.id ? '1px solid var(--surface)' : '1px solid var(--border)'};background:${activeTab === t.id ? 'var(--surface)' : 'transparent'};color:${activeTab === t.id ? '#C9A84C' : 'var(--muted)'};margin-bottom:-1px">${t.label}</a>`).join("")}
    </div>`;

    const tabPrograma = `
      <div class="card">
        <div class="card-header"><span class="card-title">⭐ Programa de Pontos</span></div>
        <div class="card-body" style="padding:20px">
          <form method="POST" action="/admin/fidelidade/config">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
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
            </div>
            <button type="submit" class="btn btn-primary">Salvar Configurações</button>
          </form>
        </div>
      </div>`;

    const tabRecompensas = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">🎁 Recompensas</span>
          <button onclick="document.getElementById('new-reward-form').style.display='block';this.style.display='none'" class="btn btn-primary" style="font-size:12px;padding:6px 14px">+ Nova</button>
        </div>
        <div id="new-reward-form" style="display:none;padding:16px;border-bottom:1px solid var(--border)">
          <form method="POST" action="/admin/fidelidade/recompensa">
            <div class="form-group">
              <label class="form-label">NOME DA RECOMPENSA</label>
              <input type="text" name="name" class="form-input" placeholder="Ex: Corte Grátis" required />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
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
            <div style="display:flex;gap:8px">
              <button type="submit" class="btn btn-primary" style="flex:1">Salvar</button>
              <button type="button" onclick="document.getElementById('new-reward-form').style.display='none'" class="btn btn-ghost">Cancelar</button>
            </div>
          </form>
        </div>
        <table>
          <thead><tr><th>Recompensa</th><th>Tipo</th><th>Pontos</th><th></th></tr></thead>
          <tbody>
            ${rewards.length === 0 ? `<tr><td colspan="4" class="empty">Nenhuma recompensa cadastrada.</td></tr>` : rewards.map((r) => `
              <tr>
                <td><strong>${esc(r.name)}</strong>${r.description ? `<br><span style="color:var(--muted);font-size:11px">${esc(r.description)}</span>` : ""}</td>
                <td><span class="badge badge-gold">${rewardTypes[r.rewardType] ?? r.rewardType}</span></td>
                <td><strong>${r.pointsRequired}</strong> pts</td>
                <td>
                  <form method="POST" action="/admin/fidelidade/recompensa/toggle" style="display:inline">
                    <input type="hidden" name="id" value="${r.id}" />
                    <input type="hidden" name="isActive" value="${r.isActive ? 'false' : 'true'}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">${r.isActive ? "Desativar" : "Ativar"}</button>
                  </form>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;

    const tabCupons = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button onclick="document.getElementById('new-coupon-form').style.display='block';this.style.display='none'" class="btn btn-primary">🏷️ Novo Cupão</button>
      </div>
      <div id="new-coupon-form" style="display:none" class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Novo Cupão</span></div>
        <div class="card-body" style="padding:20px">
          <form method="POST" action="/admin/cupons">
            <input type="hidden" name="_redirect" value="/admin/fidelidade?tab=cupons&saved=1" />
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
              <div class="form-group">
                <label class="form-label">CÓDIGO *</label>
                <input type="text" name="code" class="form-input" placeholder="EX: PROMO10" required style="text-transform:uppercase" />
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
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
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
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group">
                <label class="form-label">VÁLIDO DE</label>
                <input type="date" name="validFrom" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">VÁLIDO ATÉ</label>
                <input type="date" name="validUntil" class="form-input" />
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button type="submit" class="btn btn-primary">Criar Cupão</button>
              <button type="button" onclick="document.getElementById('new-coupon-form').style.display='none'" class="btn btn-ghost">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🏷️ Todos os Cupões</span><span style="color:var(--muted);font-size:12px">${allCoupons.length} cupões</span></div>
        <table>
          <thead><tr><th>Código</th><th>Desconto</th><th>Usos</th><th>Validade</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${allCoupons.length === 0 ? `<tr><td colspan="6" class="empty">Nenhum cupão cadastrado.</td></tr>` : allCoupons.map((c) => `
              <tr>
                <td><strong style="color:var(--gold);font-family:monospace">${esc(c.code)}</strong>${c.description ? `<br><span style="color:var(--muted);font-size:11px">${esc(c.description)}</span>` : ""}</td>
                <td>${c.discountType === "percent" ? `${c.discountValue}%` : `R$ ${fmt(parseFloat(c.discountValue as any))}`}</td>
                <td>${c.usedCount ?? 0}${c.maxUses ? ` / ${c.maxUses}` : " / ∞"}</td>
                <td style="font-size:12px">${c.validFrom ? fmtDate(c.validFrom as any) : "—"} ${c.validUntil ? `até ${fmtDate(c.validUntil as any)}` : ""}</td>
                <td><span class="badge ${c.isActive ? 'badge-success' : 'badge-muted'}">${c.isActive ? "Ativo" : "Inativo"}</span></td>
                <td>
                  <form method="POST" action="/admin/cupons/toggle" style="display:inline">
                    <input type="hidden" name="id" value="${c.id}" />
                    <input type="hidden" name="isActive" value="${c.isActive ? 'false' : 'true'}" />
                    <input type="hidden" name="_redirect" value="/admin/fidelidade?tab=cupons" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">${c.isActive ? "Desativar" : "Ativar"}</button>
                  </form>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;

    const body = `
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Salvo com sucesso!</div>` : ""}
      ${tabNav}
      ${activeTab === "programa" ? tabPrograma : activeTab === "recompensas" ? tabRecompensas : tabCupons}
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Fidelidade", "fidelidade", body, barber?.name, _tp));
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
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Cupons", "cupons", body, barber?.name, _tp));
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
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Avaliações", "avaliacoes", body, barber?.name, _tp));
  });

  // ─── Comissões ────────────────────────────────────────────────────────────
  app.get("/admin/comissoes", requireAdminAuth, async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const tenantId = barber?.tenantId ?? null;
    const configs = await db.listCommissionConfigs();
    const allBarbers = await db.getAllBarbers(tenantId);
    const saved = req.query.saved === "1";

    // Filtros de período e funcionário
    const period = (req.query.period as string) || "month";
    const filterBarberId = req.query.barberId ? parseInt(req.query.barberId as string) : null;
    let start: string, end: string;
    const now = new Date();
    if (period === "week") {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      start = d.toISOString().slice(0, 10); end = now.toISOString().slice(0, 10);
    } else if (period === "90") {
      const d = new Date(now); d.setDate(d.getDate() - 89);
      start = d.toISOString().slice(0, 10); end = now.toISOString().slice(0, 10);
    } else if (period === "custom") {
      start = (req.query.start as string) || monthRange().start;
      end = (req.query.end as string) || monthRange().end;
    } else {
      const r = monthRange(); start = r.start; end = r.end;
    }

    const summaryAll = await db.getCommissionSummary(start, end);
    const summary = filterBarberId ? summaryAll.filter((s: any) => s.barberId === filterBarberId) : summaryAll;
    const totalCommission = summary.reduce((s: number, b: any) => s + b.totalCommission, 0);
    const totalGross = summary.reduce((s: number, b: any) => s + b.totalGross, 0);

    const periodOptions = [
      { v: "month", l: "Este mês" }, { v: "week", l: "Últimos 7 dias" }, { v: "90", l: "Últimos 90 dias" },
    ].map(o => `<option value="${o.v}" ${period === o.v ? "selected" : ""}>${o.l}</option>`).join("");

    const barberOptions = [`<option value="">Todos os funcionários</option>`,
      ...allBarbers.map((b: any) => `<option value="${b.id}" ${filterBarberId === b.id ? "selected" : ""}>${esc(b.name)}</option>`)].join("");

    const body = `
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Comissões atualizadas.</div>` : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <h2 style="font-size:20px;font-weight:700;margin:0">🤝 Comissões</h2>
        <form method="GET" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select name="period" onchange="this.form.submit()"
            style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">${periodOptions}</select>
          <select name="barberId" onchange="this.form.submit()"
            style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">${barberOptions}</select>
        </form>
      </div>
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="metric-card">
          <div class="metric-label">FATURAMENTO BRUTO</div>
          <div class="metric-value">${fmtCurrency(totalGross)}</div>
          <div class="metric-sub">${fmtDate(start)} a ${fmtDate(end)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">TOTAL DE COMISSÕES</div>
          <div class="metric-value" style="color:var(--warning)">${fmtCurrency(totalCommission)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">LÍQUIDO DA BARBEARIA</div>
          <div class="metric-value" style="color:var(--success)">${fmtCurrency(totalGross - totalCommission)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:300px 1fr;gap:24px">
        <!-- Configurar taxas -->
        <div class="card">
          <div class="card-header"><span class="card-title">⚙️ Taxas de Comissão</span></div>
          <div class="card-body" style="padding:16px">
            <form method="POST" action="/admin/comissoes/config">
              ${configs.map((b: any) => `
                <div class="form-group">
                  <label class="form-label">${esc(b.name).toUpperCase()}</label>
                  <div style="display:flex;align-items:center;gap:8px">
                    <input type="number" name="rate_${b.id}" class="form-input" value="${b.commissionRate}" min="0" max="100" step="1" style="width:80px" />
                    <span style="color:var(--muted);font-size:13px">%</span>
                  </div>
                </div>
              `).join("")}
              ${configs.length === 0 ? `<p style="color:var(--muted);font-size:13px">Nenhum barbeiro cadastrado.</p>` : ""}
              <button type="submit" class="btn btn-primary" style="width:100%">Salvar Taxas</button>
            </form>
          </div>
        </div>

        <!-- Resumo por barbeiro -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">🤝 Resumo por Funcionário</span>
            <span style="color:var(--muted);font-size:12px">${fmtDate(start)} a ${fmtDate(end)}</span>
          </div>
          <table>
            <thead><tr><th>Barbeiro</th><th>Taxa</th><th>Faturamento</th><th>Comissão</th><th>Líquido</th><th>Atend.</th></tr></thead>
            <tbody>
              ${summary.length === 0 ? `<tr><td colspan="6" class="empty">Nenhum dado no período.</td></tr>` : summary.map((s: any) => `
                <tr>
                  <td><strong>${esc(s.barberName)}</strong></td>
                  <td><span class="badge badge-gold">${s.commissionRate}%</span></td>
                  <td>${fmtCurrency(s.totalGross)}</td>
                  <td style="color:var(--warning)">${fmtCurrency(s.totalCommission)}</td>
                  <td style="color:var(--success)">${fmtCurrency(s.totalNet)}</td>
                  <td>${s.entriesCount}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Comissões", "comissoes", body, barber?.name, _tp));
  });

  app.post("/admin/comissoes/config", requireAdminAuth, async (req: Request, res: Response) => {
    const session2 = (req as any).adminSession;
    const barber2 = await db.getBarberById(session2.barberId);
    const barbers = await db.getAllBarbers(barber2?.tenantId);
    for (const b of barbers) {
      const rate = req.body[`rate_${b.id}`];
      if (rate !== undefined) {
        await db.upsertCommissionConfig({ barberId: b.id, defaultRate: parseFloat(rate) });
      }
    }
    res.redirect("/admin/comissoes?saved=1");
  });

  // ─── Lista de Espera ────────────────────────────────────────────────────────
  app.get("/admin/lista-espera", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const dateParam = (req.query.date as string) || today();
    const tenantId = barber?.tenantId ?? null;
    const entries = await db.listWaitlistByDate(dateParam);
    const allClients = await db.getAllClients(tenantId);
    const allBarbers = await db.getAllBarbers(tenantId);
    const allServices = await db.getAllServices(true, tenantId);
    const saved = req.query.saved === "1";
    const removed = req.query.removed === "1";
    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h1 style="font-size:24px;font-weight:700;color:var(--foreground);">Lista de Espera</h1>
          <p style="color:var(--muted);font-size:14px;margin-top:4px;">Clientes aguardando vaga para uma data específica</p>
        </div>
        <button onclick="document.getElementById('addModal').style.display='flex'" class="btn btn-primary">+ Adicionar à Fila</button>
      </div>
      ${saved ? `<div class="alert alert-success">Cliente adicionado à lista de espera.</div>` : ""}
      ${removed ? `<div class="alert alert-success">Entrada removida da lista de espera.</div>` : ""}
      <div class="card" style="margin-bottom:20px;">
        <div class="card-body" style="padding:16px;">
          <form method="GET" style="display:flex;align-items:center;gap:12px;">
            <label style="color:var(--muted);font-size:13px;">Data:</label>
            <input type="date" name="date" value="${dateParam}" class="form-input" style="width:180px;" onchange="this.form.submit()" />
            <span style="color:var(--muted);font-size:13px;">${entries.length} cliente(s) na fila</span>
          </form>
        </div>
      </div>
      <div class="card">
        <table>
          <thead><tr><th>#</th><th>Cliente</th><th>Barbeiro Preferido</th><th>Serviço</th><th>Na Fila Desde</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${entries.length === 0 ? `<tr><td colspan="7" class="empty">Nenhum cliente na lista de espera para ${fmtDate(dateParam)}.</td></tr>` : entries.map((e, i) => `
              <tr>
                <td><strong>#${i + 1}</strong></td>
                <td>${esc(e.client?.name ?? "—")}<br><small style="color:var(--muted);">${esc(e.client?.phone ?? "")}</small></td>
                <td>${esc(allBarbers.find(b => b.id === e.barberId)?.name ?? "Qualquer")}</td>
                <td>${esc(allServices.find(s => s.id === e.serviceId)?.name ?? "Qualquer")}</td>
                <td>${new Date(e.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td><span class="badge ${e.status === "waiting" ? "badge-gold" : e.status === "notified" ? "badge-success" : "badge-muted"}">${e.status === "waiting" ? "Aguardando" : e.status === "notified" ? "Notificado" : esc(e.status)}</span></td>
                <td>
                  <form method="POST" action="/admin/lista-espera/remover" style="display:inline;">
                    <input type="hidden" name="id" value="${e.id}" />
                    <input type="hidden" name="date" value="${dateParam}" />
                    <button type="submit" class="btn btn-sm" style="background:var(--error);color:#fff;border:none;" onclick="return confirm('Remover da lista?')">Remover</button>
                  </form>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <!-- Modal Adicionar -->
      <div id="addModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:12px;padding:28px;width:420px;max-width:90vw;">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;">Adicionar à Lista de Espera</h2>
          <form method="POST" action="/admin/lista-espera">
            <div class="form-group">
              <label class="form-label">Cliente *</label>
              <select name="clientId" class="form-input" required>
                <option value="">Selecione o cliente</option>
                ${allClients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Data *</label>
              <input type="date" name="date" value="${dateParam}" class="form-input" required />
            </div>
            <div class="form-group">
              <label class="form-label">Barbeiro Preferido</label>
              <select name="barberId" class="form-input">
                <option value="">Qualquer barbeiro</option>
                ${allBarbers.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Serviço</label>
              <select name="serviceId" class="form-input">
                <option value="">Qualquer serviço</option>
                ${allServices.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
              </select>
            </div>
            <div style="display:flex;gap:12px;margin-top:20px;">
              <button type="button" onclick="document.getElementById('addModal').style.display='none'" class="btn" style="flex:1;">Cancelar</button>
              <button type="submit" class="btn btn-primary" style="flex:1;">Adicionar</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Lista de Espera", "lista-espera", body, barber?.name, _tp));
  });

  app.post("/admin/lista-espera", requireAdminAuth, async (req: Request, res: Response) => {
    const { clientId, date, barberId, serviceId } = req.body;
    if (!clientId || !date) { res.redirect("/admin/lista-espera?error=1"); return; }
    await db.joinWaitlist({
      clientId: parseInt(clientId),
      date,
      barberId: barberId ? parseInt(barberId) : undefined,
      serviceId: serviceId ? parseInt(serviceId) : undefined,
    });
    res.redirect(`/admin/lista-espera?date=${date}&saved=1`);
  });

  app.post("/admin/lista-espera/remover", requireAdminAuth, async (req: Request, res: Response) => {
    const { id, date } = req.body;
    if (id) await db.leaveWaitlist(parseInt(id));
    res.redirect(`/admin/lista-espera?date=${date || today()}&removed=1`);
  });

  // ─── Recorrências ────────────────────────────────────────────────────────────
  app.get("/admin/recorrencias", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const allRecurring = await db.getAllRecurringAppointments();
    const allClients = await db.getAllClients(tenantId);
    const allBarbers = await db.getAllBarbers(tenantId);
    const allServices = await db.getAllServices(true, tenantId);
    const cancelled = req.query.cancelled === "1";
    const created = req.query.created === "1";
    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h1 style="font-size:24px;font-weight:700;color:var(--foreground);">Agendamentos Recorrentes</h1>
          <p style="color:var(--muted);font-size:14px;margin-top:4px;">Clientes com agendamentos periódicos configurados</p>
        </div>
        <button onclick="document.getElementById('newRecModal').style.display='flex'" class="btn btn-primary">+ Nova Recorrência</button>
      </div>
      ${cancelled ? `<div class="alert alert-success">Recorrência cancelada com sucesso.</div>` : ""}
      ${created ? `<div class="alert alert-success">Recorrência criada! Agendamentos gerados automaticamente.</div>` : ""}
      <div class="card">
        <table>
          <thead><tr><th>Cliente</th><th>Barbeiro</th><th>Serviço</th><th>Início</th><th>Horário</th><th>Intervalo</th><th>Ocorrências</th><th>Ações</th></tr></thead>
          <tbody>
            ${allRecurring.length === 0 ? `<tr><td colspan="8" class="empty">Nenhuma recorrência ativa.</td></tr>` : allRecurring.map(r => `
              <tr>
                <td><strong>${esc(r.clientName)}</strong></td>
                <td>${esc(r.barberName)}</td>
                <td>${esc(r.serviceName)}</td>
                <td>${fmtDate(r.startDate)}</td>
                <td>${r.startTime?.toString().slice(0,5) ?? "—"}</td>
                <td>A cada ${r.intervalWeeks} semana(s)</td>
                <td>${r.occurrences}x</td>
                <td>
                  <form method="POST" action="/admin/recorrencias/cancelar" style="display:inline;">
                    <input type="hidden" name="id" value="${r.id}" />
                    <button type="submit" class="btn btn-sm" style="background:var(--error);color:#fff;border:none;" onclick="return confirm('Cancelar esta recorrência?')">Cancelar</button>
                  </form>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <!-- Modal Nova Recorrência -->
      <div id="newRecModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:12px;padding:28px;width:480px;max-width:90vw;max-height:90vh;overflow-y:auto;">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;">Nova Recorrência</h2>
          <form method="POST" action="/admin/recorrencias">
            <div class="form-group">
              <label class="form-label">Cliente *</label>
              <select name="clientId" class="form-input" required>
                <option value="">Selecione o cliente</option>
                ${allClients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Barbeiro *</label>
              <select name="barberId" class="form-input" required>
                <option value="">Selecione o barbeiro</option>
                ${allBarbers.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Serviço *</label>
              <select name="serviceId" class="form-input" required>
                <option value="">Selecione o serviço</option>
                ${allServices.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Data de Início *</label>
              <input type="date" name="startDate" class="form-input" required />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Horário Início *</label>
                <input type="time" name="startTime" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">Horário Fim *</label>
                <input type="time" name="endTime" class="form-input" required />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Intervalo (semanas)</label>
                <input type="number" name="intervalWeeks" value="4" min="1" max="12" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Nº de Ocorrências</label>
                <input type="number" name="occurrences" value="6" min="1" max="52" class="form-input" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Observações</label>
              <input type="text" name="notes" class="form-input" placeholder="Opcional" />
            </div>
            <div style="display:flex;gap:12px;margin-top:20px;">
              <button type="button" onclick="document.getElementById('newRecModal').style.display='none'" class="btn" style="flex:1;">Cancelar</button>
              <button type="submit" class="btn btn-primary" style="flex:1;">Criar Recorrência</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Recorrências", "recorrencias", body, barber?.name, _tp));
  });

  app.post("/admin/recorrencias", requireAdminAuth, async (req: Request, res: Response) => {
    const { clientId, barberId, serviceId, startDate, startTime, endTime, intervalWeeks, occurrences, notes } = req.body;
    if (!clientId || !barberId || !serviceId || !startDate || !startTime || !endTime) {
      res.redirect("/admin/recorrencias?error=Preencha+todos+os+campos+obrigatórios"); return;
    }
    try {
      await db.createRecurringAppointments({
        clientId: parseInt(clientId),
        barberId: parseInt(barberId),
        serviceId: parseInt(serviceId),
        startDate,
        startTime,
        endTime,
        intervalWeeks: parseInt(intervalWeeks) || 4,
        occurrences: parseInt(occurrences) || 6,
        notes: notes || undefined,
      });
      res.redirect("/admin/recorrencias?created=1");
    } catch (e: any) {
      res.redirect(`/admin/recorrencias?error=${encodeURIComponent(e.message)}`);
    }
  });

  app.post("/admin/recorrencias/cancelar", requireAdminAuth, async (req: Request, res: Response) => {
    const { id } = req.body;
    if (id) await db.cancelRecurring(parseInt(id));
    res.redirect("/admin/recorrencias?cancelled=1");
  });

  // ─── Estoque ─────────────────────────────────────────────────────────────────
  app.get("/admin/estoque", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const activeTab = (req.query.tab as string) || "todos";
    const saved = req.query.saved === "1";
    const searchProd = ((req.query.q as string) || "").toLowerCase();

    // Buscar todos os produtos (incluindo inativos para histórico)
    const allProducts = await db.getStockProducts();
    // Filtrar por tipo e busca
    let filteredProducts = allProducts;
    if (activeTab === "venda") filteredProducts = allProducts.filter((p: any) => p.productType === "sale");
    if (activeTab === "interno") filteredProducts = allProducts.filter((p: any) => p.productType === "internal");
    if (searchProd) filteredProducts = filteredProducts.filter((p: any) => p.name.toLowerCase().includes(searchProd));

    const lowStock = allProducts.filter((p: any) => p.isLowStock);

    // Buscar histórico recente de movimentações (todos os produtos)
    const recentMovements: any[] = [];
    for (const p of allProducts.slice(0, 20)) {
      const moves = await db.getStockMovements(p.id);
      moves.slice(0, 5).forEach((m: any) => recentMovements.push({ ...m, productName: p.name }));
    }
    recentMovements.sort((a, b) => new Date(b.createdAt ?? b.date).getTime() - new Date(a.createdAt ?? a.date).getTime());

    const typeLabels: Record<string, string> = { in: "Entrada", out: "Saída", adjustment: "Ajuste" };
    const typeColors: Record<string, string> = { in: "var(--success)", out: "var(--error)", adjustment: "#C9A84C" };

    const tabs = [
      { id: "todos", label: "📦 Todos" },
      { id: "venda", label: "💰 Venda" },
      { id: "interno", label: "🔧 Uso Interno" },
      { id: "historico", label: "📊 Histórico" },
    ];
    const tabNav = `<div style="display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid var(--border)">
      ${tabs.map(t => `<a href="/admin/estoque?tab=${t.id}" style="padding:10px 18px;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px 8px 0 0;border:1px solid ${activeTab === t.id ? 'var(--border)' : 'transparent'};border-bottom:${activeTab === t.id ? '1px solid var(--surface)' : '1px solid var(--border)'};background:${activeTab === t.id ? 'var(--surface)' : 'transparent'};color:${activeTab === t.id ? '#C9A84C' : 'var(--muted)'};margin-bottom:-1px">${t.label}</a>`).join("")}
    </div>`;

    const prodTable = `
      <form method="GET" style="display:flex;gap:8px;margin-bottom:16px">
        <input type="hidden" name="tab" value="${activeTab}" />
        <input type="text" name="q" value="${esc(searchProd)}" placeholder="Buscar produto..."
          style="flex:1;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px" />
        <button type="submit" class="btn btn-primary" style="padding:8px 16px">Buscar</button>
        ${searchProd ? `<a href="/admin/estoque?tab=${activeTab}" class="btn btn-ghost" style="padding:8px 12px">✕</a>` : ""}
      </form>
      <div class="card">
        <table>
          <thead><tr><th>Produto</th><th>Tipo</th><th>Estoque</th><th>Alerta</th><th>Status</th><th>Preço</th><th>Ações</th></tr></thead>
          <tbody>
            ${filteredProducts.length === 0 ? `<tr><td colspan="7" class="empty">Nenhum produto encontrado.</td></tr>` : filteredProducts.map((p: any) => `
              <tr>
                <td><strong>${esc(p.name)}</strong></td>
                <td><span class="badge ${p.productType === 'sale' ? 'badge-gold' : 'badge-muted'}">${p.productType === 'sale' ? 'Venda' : 'Uso Interno'}</span></td>
                <td style="font-size:18px;font-weight:700;color:${p.isLowStock ? 'var(--error)' : 'var(--success)'}">${p.stockQuantity}</td>
                <td style="color:var(--muted)">${p.minStockAlert}</td>
                <td>${p.isLowStock ? '<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--error)">Baixo</span>' : '<span class="badge badge-success">OK</span>'}</td>
                <td>${fmtCurrency(p.price)}</td>
                <td style="white-space:nowrap">
                  <button onclick="openStockModal(${p.id}, '${esc(p.name).replace(/'/g, "\\'")}'  , ${p.stockQuantity})" class="btn btn-primary" style="font-size:12px;padding:4px 12px">+ Mov.</button>
                  <a href="/admin/estoque/${p.id}/historico" class="btn btn-ghost" style="font-size:12px;padding:4px 10px">📊</a>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;

    const histTable = `
      <div class="card">
        <div class="card-header"><div class="card-title">📊 Últimas Movimentações</div></div>
        <div class="card-body">
          ${recentMovements.length === 0 ? '<div class="empty">Nenhuma movimentação registrada.</div>' : `
          <table>
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Motivo</th></tr></thead>
            <tbody>
              ${recentMovements.slice(0, 50).map((m: any) => `
                <tr>
                  <td style="font-size:12px">${m.date ? new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR') : (m.createdAt ? new Date(m.createdAt).toLocaleDateString('pt-BR') : '—')}</td>
                  <td style="font-weight:600">${esc(m.productName ?? '—')}</td>
                  <td><span class="badge" style="background:${typeColors[m.type] ?? 'var(--muted)'}22;color:${typeColors[m.type] ?? 'var(--muted)'}">${typeLabels[m.type] ?? m.type}</span></td>
                  <td style="font-weight:700;color:${m.type === 'in' ? 'var(--success)' : 'var(--error)'}">${m.type === 'in' ? '+' : '-'}${Math.abs(m.quantity)}</td>
                  <td style="color:var(--muted);font-size:12px">${esc(m.reason ?? '—')}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
        </div>
      </div>`;

    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div>
          <h1 style="font-size:24px;font-weight:700;color:var(--foreground)">Controle de Estoque</h1>
          <p style="color:var(--muted);font-size:14px;margin-top:4px">Movimentações e alertas de estoque dos produtos</p>
        </div>
        <a href="/admin/export/estoque.csv" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">↓ Exportar CSV</a>
      </div>
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Movimentação registrada!</div>` : ""}
      ${lowStock.length > 0 ? `
        <div style="background:rgba(239,68,68,0.1);border:1px solid var(--error);color:var(--error);border-radius:8px;padding:12px 16px;margin-bottom:20px">
          ⚠️ <strong>${lowStock.length} produto(s) com estoque baixo:</strong> ${lowStock.map((p: any) => esc(p.name)).join(", ")}
        </div>` : ""}
      ${tabNav}
      ${activeTab === "historico" ? histTable : prodTable}
      <!-- Modal Movimentação -->
      <div id="stockModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
        <div style="background:var(--surface);border-radius:12px;padding:28px;width:400px;max-width:90vw">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:4px">Registrar Movimentação</h2>
          <p id="stockModalProd" style="color:var(--muted);font-size:13px;margin-bottom:20px"></p>
          <form method="POST" action="/admin/estoque/movimentacao">
            <input type="hidden" name="productId" id="stockProductId" />
            <input type="hidden" name="tab" value="${activeTab}" />
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select name="type" class="form-input" required>
                <option value="in">Entrada (compra/reposição)</option>
                <option value="out">Saída (uso/venda manual)</option>
                <option value="adjustment">Ajuste de inventário</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Quantidade</label>
              <input type="number" name="quantity" class="form-input" min="1" required />
            </div>
            <div class="form-group">
              <label class="form-label">Motivo</label>
              <input type="text" name="reason" class="form-input" placeholder="Ex: Compra do fornecedor, uso no serviço..." />
            </div>
            <div class="form-group">
              <label class="form-label">Data</label>
              <input type="date" name="date" class="form-input" value="${today()}" required />
            </div>
            <div style="display:flex;gap:12px;margin-top:20px">
              <button type="button" onclick="document.getElementById('stockModal').style.display='none'" class="btn" style="flex:1">Cancelar</button>
              <button type="submit" class="btn btn-primary" style="flex:1">Registrar</button>
            </div>
          </form>
        </div>
      </div>
      <script>
        function openStockModal(id, name, qty) {
          document.getElementById('stockProductId').value = id;
          document.getElementById('stockModalProd').textContent = name + ' — Estoque atual: ' + qty;
          document.getElementById('stockModal').style.display = 'flex';
        }
      </script>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Estoque", "estoque", body, barber?.name, _tp));
  });

  app.post("/admin/estoque/movimentacao", requireAdminAuth, async (req: Request, res: Response) => {
    const { productId, type, quantity, reason, date } = req.body;
    if (!productId || !type || !quantity || !date) { res.redirect("/admin/estoque?error=1"); return; }
    await db.addStockMovement({
      productId: parseInt(productId),
      type: type as "in" | "out" | "adjustment",
      quantity: parseInt(quantity),
      reason: reason || undefined,
      date,
    });
    res.redirect("/admin/estoque?saved=1");
  });

  // ─── Retorno Automático ──────────────────────────────────────────────────────
  app.get("/admin/retorno-automatico", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const configs = await db.listReturnMessageConfigs();
    const allServices = await db.getAllServices(true, tenantId);
    const saved = req.query.saved === "1";
    const deleted = req.query.deleted === "1";
    // Mapear configs com nome do serviço
    const configsWithService = configs.map(c => ({
      ...c,
      serviceName: allServices.find(s => s.id === c.serviceId)?.name ?? "—",
    }));
    // Serviços sem config
    const configuredIds = configs.map(c => c.serviceId);
    const unconfiguredServices = allServices.filter(s => !configuredIds.includes(s.id));
    const body = `
      <div style="margin-bottom:24px;">
        <h1 style="font-size:24px;font-weight:700;color:var(--foreground);">Retorno Automático</h1>
        <p style="color:var(--muted);font-size:14px;margin-top:4px;">Configure mensagens automáticas de retorno por WhatsApp após o atendimento</p>
      </div>
      ${saved ? `<div class="alert alert-success">Configuração salva com sucesso.</div>` : ""}
      ${deleted ? `<div class="alert alert-success">Configuração removida.</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <!-- Adicionar nova config -->
        <div class="card">
          <div class="card-header"><span class="card-title">➕ Nova Configuração</span></div>
          <div class="card-body" style="padding:20px;">
            <form method="POST" action="/admin/retorno-automatico">
              <div class="form-group">
                <label class="form-label">Serviço</label>
                <select name="serviceId" class="form-input" required>
                  <option value="">Selecione o serviço</option>
                  ${unconfiguredServices.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
                  ${unconfiguredServices.length === 0 ? `<option disabled>Todos os serviços já configurados</option>` : ""}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Enviar após (dias)</label>
                <input type="number" name="delayDays" value="30" min="1" max="365" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">Mensagem (use {nome} para o nome do cliente)</label>
                <textarea name="messageTemplate" class="form-input" rows="4" required placeholder="Olá {nome}! Já faz um tempo desde o seu último {servico}. Que tal agendar uma visita? 😊"></textarea>
              </div>
              <div class="form-group" style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" name="isActive" id="isActive" value="1" checked style="width:16px;height:16px;" />
                <label for="isActive" style="color:var(--foreground);font-size:14px;">Ativo</label>
              </div>
              <button type="submit" class="btn btn-primary" style="width:100%;">Salvar Configuração</button>
            </form>
          </div>
        </div>
        <!-- Lista de configs -->
        <div class="card">
          <div class="card-header"><span class="card-title">📨 Configurações Ativas</span></div>
          <div class="card-body" style="padding:0;">
            ${configsWithService.length === 0 ? `<p style="padding:20px;color:var(--muted);font-size:13px;">Nenhuma configuração de retorno cadastrada.</p>` : configsWithService.map(c => `
              <div style="padding:16px;border-bottom:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <strong style="color:var(--foreground);">${esc(c.serviceName)}</strong>
                    <span class="badge ${c.isActive ? "badge-success" : "badge-muted"}" style="margin-left:8px;">${c.isActive ? "Ativo" : "Inativo"}</span>
                    <p style="color:var(--muted);font-size:12px;margin-top:4px;">Enviar ${c.delayDays} dia(s) após o atendimento</p>
                    <p style="color:var(--muted);font-size:12px;margin-top:2px;font-style:italic;">&ldquo;${esc(c.messageTemplate.slice(0, 80))}${c.messageTemplate.length > 80 ? "..." : ""}&rdquo;</p>
                  </div>
                  <form method="POST" action="/admin/retorno-automatico/remover">
                    <input type="hidden" name="serviceId" value="${c.serviceId}" />
                    <button type="submit" class="btn btn-sm" style="background:var(--error);color:#fff;border:none;" onclick="return confirm('Remover esta configuração?')">Remover</button>
                  </form>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:20px;">
        <div class="card-header"><span class="card-title">ℹ️ Como funciona</span></div>
        <div class="card-body" style="padding:20px;">
          <p style="color:var(--muted);font-size:14px;line-height:1.7;">O sistema identifica clientes que realizaram um serviço configurado e não retornaram após o período definido. Uma mensagem personalizada é enviada via WhatsApp para incentivá-los a agendar novamente. Use <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;">{nome}</code> na mensagem para inserir o nome do cliente automaticamente.</p>
        </div>
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Retorno Automático", "retorno-automatico", body, barber?.name, _tp));
  });

  app.post("/admin/retorno-automatico", requireAdminAuth, async (req: Request, res: Response) => {
    const { serviceId, delayDays, messageTemplate, isActive } = req.body;
    if (!serviceId || !delayDays || !messageTemplate) { res.redirect("/admin/retorno-automatico?error=1"); return; }
    await db.upsertReturnMessageConfig({
      serviceId: parseInt(serviceId),
      delayDays: parseInt(delayDays),
      messageTemplate,
      isActive: isActive === "1",
    });
    res.redirect("/admin/retorno-automatico?saved=1");
  });

  app.post("/admin/retorno-automatico/remover", requireAdminAuth, async (req: Request, res: Response) => {
    const { serviceId } = req.body;
    if (serviceId) await db.deleteReturnMessageConfig(parseInt(serviceId));
    res.redirect("/admin/retorno-automatico?deleted=1");
  });

  // ─  // ─── Promoções (envio segmentado) ───────────────────────────────────────
  app.get("/admin/promocoes", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const allClients = await db.getAllClients(tenantId);
    const activeClients = allClients.filter((c: any) => c.isActive);
    const promotionList = await db.listPromotions();
    const sent = req.query.sent === "1";
    const AUDIENCE_OPTIONS = [
      { value: "all", label: "Todos os clientes ativos", icon: "👥" },
      { value: "inactive_30", label: "Inativos há 30 dias", icon: "⏳" },
      { value: "inactive_60", label: "Inativos há 60 dias", icon: "⏰" },
      { value: "birthday_month", label: "Aniversariantes do mês", icon: "🎂" },
    ];
    const body = `
      ${sent ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Promoção enviada com sucesso!</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
        <!-- Formulário de envio -->
        <div class="card">
          <div class="card-header"><div class="card-title">📣 Nova Promoção</div></div>
          <div class="card-body" style="padding:20px">
            <form method="POST" action="/admin/promocoes">
              <div class="form-group">
                <label class="form-label">Título *</label>
                <input class="form-input" type="text" name="title" placeholder="Ex: Desconto de segunda-feira" required />
              </div>
              <div class="form-group">
                <label class="form-label">Mensagem *</label>
                <textarea class="form-input" name="message" rows="4" placeholder="Escreva a mensagem da promoção..." required style="resize:vertical"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Público-alvo</label>
                <select class="form-input" name="targetAudience" id="audience-select" onchange="toggleClientSelect()">
                  ${AUDIENCE_OPTIONS.map(o => `<option value="${o.value}">${o.icon} ${o.label}</option>`).join("")}
                  <option value="individual">👤 Cliente específico</option>
                </select>
              </div>
              <div id="client-select-group" style="display:none" class="form-group">
                <label class="form-label">Selecionar Cliente</label>
                <select class="form-input" name="clientId">
                  <option value="">-- Selecione um cliente --</option>
                  ${activeClients.map((c: any) => `<option value="${c.id}">${esc(c.name)}${c.phone ? " — " + esc(c.phone) : ""}</option>`).join("")}
                </select>
              </div>
              <script>function toggleClientSelect(){const v=document.getElementById('audience-select').value;document.getElementById('client-select-group').style.display=v==='individual'?'block':'none';}</script>
              <button type="submit" class="btn btn-primary" style="width:100%;padding:14px;margin-top:8px">🚀 Enviar Promoção</button>
            </form>
          </div>
        </div>
        <!-- Histórico -->
        <div class="card">
          <div class="card-header"><div class="card-title">📜 Histórico de Promoções</div></div>
          <div class="card-body">
            ${promotionList.length === 0
              ? `<div style="text-align:center;padding:40px;color:var(--muted)">Nenhuma promoção enviada ainda.</div>`
              : `<table class="table"><thead><tr><th>Título</th><th>Público</th><th>Destinatários</th><th>Data</th></tr></thead><tbody>
                ${promotionList.map((p: any) => `<tr>
                  <td><strong>${esc(p.title)}</strong><br><small style="color:var(--muted)">${esc((p.message ?? "").substring(0, 60))}${(p.message ?? "").length > 60 ? "..." : ""}</small></td>
                  <td>${AUDIENCE_OPTIONS.find(o => o.value === p.targetAudience)?.label ?? p.targetAudience}</td>
                  <td style="text-align:center;font-weight:700">${p.recipientCount ?? 0}</td>
                  <td style="color:var(--muted);font-size:12px">${p.sentAt ? new Date(p.sentAt).toLocaleDateString("pt-BR") : "—"}</td>
                </tr>`).join("")}
              </tbody></table>`
            }
          </div>
        </div>
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
    res.send(adminLayout("Promoções", "promocoes", body, barber?.name, _tp));
  });

  app.post("/admin/promocoes", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const { title, message, targetAudience, clientId } = req.body;
    if (!title || !message) { res.redirect("/admin/promocoes?error=1"); return; }
    const audience = targetAudience as "all" | "inactive_30" | "inactive_60" | "birthday_month";
    let recipientCount = 1;
    if (targetAudience !== "individual") {
      recipientCount = await db.getPromotionRecipientCount(audience);
      await db.createPromotion({ title, message, targetAudience: audience, createdBy: session.barberId, recipientCount });
    } else {
      await db.createPromotion({ title, message, targetAudience: "all", createdBy: session.barberId, recipientCount: 1 });
    }
    res.redirect("/admin/promocoes?sent=1");
  });

  // ─── Conversão de Promoções ──────────────────────────────────────────
  app.get("/admin/conversao-promocoes", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const report = await db.getPromotionConversionReport();
    const totalSent = report.reduce((s, p) => s + (p.recipientCount ?? 0), 0);
    const totalConversions = report.reduce((s, p) => s + (p.conversions ?? 0), 0);
    const avgRate = report.length > 0 ? Math.round(report.reduce((s, p) => s + (p.conversionRate ?? 0), 0) / report.length) : 0;
    const body = `
      <div style="margin-bottom:24px;">
        <h1 style="font-size:24px;font-weight:700;color:var(--foreground);">Conversão de Promoções</h1>
        <p style="color:var(--muted);font-size:14px;margin-top:4px;">Relatório de efetividade das promoções enviadas</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
        <div class="card" style="padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:var(--gold);">${report.length}</div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px;">Promoções Enviadas</div>
        </div>
        <div class="card" style="padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:var(--gold);">${totalSent.toLocaleString("pt-BR")}</div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px;">Total de Destinatários</div>
        </div>
        <div class="card" style="padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:${avgRate >= 20 ? "var(--success)" : avgRate >= 10 ? "var(--warning)" : "var(--error)"};">${avgRate}%</div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px;">Taxa Média de Conversão</div>
        </div>
      </div>
      <div class="card">
        <table>
          <thead><tr><th>Promoção</th><th>Público-Alvo</th><th>Enviado em</th><th>Destinatários</th><th>Conversões (7 dias)</th><th>Taxa</th></tr></thead>
          <tbody>
            ${report.length === 0 ? `<tr><td colspan="6" class="empty">Nenhuma promoção enviada ainda. Crie promoções na seção de Cupons.</td></tr>` : report.map(p => {
              const audienceLabel: Record<string, string> = {
                all: "Todos os clientes",
                inactive_30: "Inativos 30+ dias",
                inactive_60: "Inativos 60+ dias",
                birthday_month: "Aniversariantes do mês",
              };
              const rateColor = (p.conversionRate ?? 0) >= 20 ? "var(--success)" : (p.conversionRate ?? 0) >= 10 ? "var(--warning)" : "var(--error)";
              return `
                <tr>
                  <td><strong>${esc(p.title)}</strong><br><small style="color:var(--muted);">${esc(p.message.slice(0, 60))}${p.message.length > 60 ? "..." : ""}</small></td>
                  <td><span class="badge badge-gold">${audienceLabel[p.targetAudience] ?? esc(p.targetAudience)}</span></td>
                  <td>${p.sentAt ? new Date(p.sentAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td>${(p.recipientCount ?? 0).toLocaleString("pt-BR")}</td>
                  <td style="font-weight:600;">${(p.conversions ?? 0).toLocaleString("pt-BR")}</td>
                  <td><span style="color:${rateColor};font-weight:700;font-size:16px;">${p.conversionRate ?? 0}%</span></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
      ${totalConversions > 0 ? `
        <div class="card" style="margin-top:20px;padding:20px;">
          <p style="color:var(--muted);font-size:13px;">💡 <strong>Dica:</strong> Promoções para clientes inativos tendem a ter maior taxa de conversão. Considere segmentar seu público para melhores resultados.</p>
        </div>
      ` : ""}
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Conversão de Promoções", "conversao-promocoes", body, barber?.name, _tp));
  });

  // ─── Meu Perfil ──────────────────────────────────────────────────────────────
  app.get("/admin/meu-perfil", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    if (!barber) { res.redirect("/admin/login"); return; }
    const saved = req.query.saved === "1";
    const pwChanged = req.query.pw === "1";
    const pwError = req.query.pwerr as string | undefined;
    const body = `
      <div style="margin-bottom:24px;">
        <h1 style="font-size:24px;font-weight:700;color:var(--foreground);">Meu Perfil</h1>
        <p style="color:var(--muted);font-size:14px;margin-top:4px;">Gerencie suas informações pessoais e senha de acesso</p>
      </div>
      ${saved ? `<div class="alert alert-success">Perfil atualizado com sucesso.</div>` : ""}
      ${pwChanged ? `<div class="alert alert-success">Senha alterada com sucesso.</div>` : ""}
      ${pwError ? `<div class="alert" style="background:rgba(239,68,68,0.1);border:1px solid var(--error);color:var(--error);border-radius:8px;padding:12px 16px;margin-bottom:16px;">${esc(decodeURIComponent(pwError))}</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <!-- Dados pessoais -->
        <div class="card">
          <div class="card-header"><span class="card-title">👤 Dados Pessoais</span></div>
          <div class="card-body" style="padding:20px;">
            <form method="POST" action="/admin/meu-perfil">
              <div class="form-group">
                <label class="form-label">Nome completo</label>
                <input type="text" name="name" value="${esc(barber.name)}" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">E-mail</label>
                <input type="email" name="email" value="${esc(barber.email ?? "")}" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">Telefone / WhatsApp</label>
                <input type="tel" name="phone" value="${esc(barber.phone ?? "")}" class="form-input" placeholder="(11) 99999-9999" />
              </div>
              <div class="form-group">
                <label class="form-label">Especialidade</label>
                <input type="text" name="specialties" value="${esc(barber.specialties ?? "")}" class="form-input" placeholder="Ex: Corte masculino, Barba..." />
              </div>
              <div class="form-group">
                <label class="form-label">Função</label>
                <input type="text" value="${barber.role === "super_admin" ? "Super Administrador" : barber.role === "barber" ? "Barbeiro" : "Recepcionista"}" class="form-input" disabled style="opacity:0.6;cursor:not-allowed;" />
              </div>
              <button type="submit" class="btn btn-primary" style="width:100%;">Salvar Alterações</button>
            </form>
          </div>
        </div>
        <!-- Alterar senha -->
        <div class="card">
          <div class="card-header"><span class="card-title">🔐 Alterar Senha</span></div>
          <div class="card-body" style="padding:20px;">
            <form method="POST" action="/admin/meu-perfil/senha">
              <div class="form-group">
                <label class="form-label">Senha atual</label>
                <input type="password" name="currentPassword" class="form-input" required placeholder="Sua senha atual" />
              </div>
              <div class="form-group">
                <label class="form-label">Nova senha</label>
                <input type="password" name="newPassword" class="form-input" required placeholder="Mínimo 6 caracteres" minlength="6" />
              </div>
              <div class="form-group">
                <label class="form-label">Confirmar nova senha</label>
                <input type="password" name="confirmPassword" class="form-input" required placeholder="Repita a nova senha" />
              </div>
              <button type="submit" class="btn btn-primary" style="width:100%;">Alterar Senha</button>
            </form>
          </div>
        </div>
       </div>
      <!-- Tema Visual -->
      <div class="card" style="margin-top:24px;">
        <div class="card-header"><span class="card-title">🎨 Tema Visual</span></div>
        <div class="card-body" style="padding:20px;">
          <p style="color:var(--muted);font-size:13px;margin-bottom:16px;">Escolha o tema visual do painel administrativo. A preferência é salva no navegador.</p>
          <div style="display:flex;gap:12px;">
            <button onclick="setTheme('light')" id="theme-light" class="btn btn-ghost" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;">
              <span style="font-size:24px;">☀️</span>
              <span style="font-size:12px;font-weight:600;">Claro</span>
            </button>
            <button onclick="setTheme('dark')" id="theme-dark" class="btn btn-ghost" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;">
              <span style="font-size:24px;">🌙</span>
              <span style="font-size:12px;font-weight:600;">Escuro</span>
            </button>
            <button onclick="setTheme('system')" id="theme-system" class="btn btn-ghost" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;">
              <span style="font-size:24px;">⚙️</span>
              <span style="font-size:12px;font-weight:600;">Sistema</span>
            </button>
          </div>
          <script>
            (function() {
              var saved = localStorage.getItem('bp_theme') || 'dark';
              function applyTheme(t) {
                var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
                ['light','dark','system'].forEach(function(k) {
                  var btn = document.getElementById('theme-' + k);
                  if (btn) btn.style.borderColor = k === t ? 'var(--gold)' : 'var(--border)';
                });
              }
              window.setTheme = function(t) {
                localStorage.setItem('bp_theme', t);
                applyTheme(t);
              };
              applyTheme(saved);
            })();
          </script>
        </div>
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Meu Perfil", "meu-perfil", body, barber?.name, _tp));
  });
  app.post("/admin/meu-perfil", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const { name, email, phone, specialties } = req.body;
    if (!name || !email) { res.redirect("/admin/meu-perfil?error=1"); return; }
    await db.updateBarber(session.barberId, { name, email, phone: phone || null, specialties: specialties || null });
    res.redirect("/admin/meu-perfil?saved=1");
  });

  app.post("/admin/meu-perfil/senha", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      res.redirect("/admin/meu-perfil?pwerr=Preencha+todos+os+campos"); return;
    }
    if (newPassword !== confirmPassword) {
      res.redirect("/admin/meu-perfil?pwerr=As+senhas+n%C3%A3o+coincidem"); return;
    }
    if (newPassword.length < 6) {
      res.redirect("/admin/meu-perfil?pwerr=A+nova+senha+deve+ter+m%C3%ADnimo+6+caracteres"); return;
    }
    const barber = await db.getBarberById(session.barberId);
    if (!barber || !barber.passwordHash) { res.redirect("/admin/meu-perfil?pwerr=Barbeiro+n%C3%A3o+encontrado"); return; }
    let bcrypt: any;
    try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
    const valid = bcrypt
      ? await bcrypt.compare(currentPassword, barber.passwordHash)
      : currentPassword === barber.passwordHash;
    if (!valid) { res.redirect("/admin/meu-perfil?pwerr=Senha+atual+incorreta"); return; }
    const newHash = bcrypt ? await bcrypt.hash(newPassword, 10) : newPassword;
    await db.updateBarber(session.barberId, { passwordHash: newHash });
    res.redirect("/admin/meu-perfil?pw=1");
  });

  // ─── Chat WhatsApp ────────────────────────────────────────────────────────────
  app.get("/admin/chat", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? 1;
    const searchQ = ((req.query.q as string) || "").toLowerCase().trim();
    const allChatClients = await db.getChatClients(tenantId);
    // Ordenar: clientes com mensagens primeiro, depois por nome
    allChatClients.sort((a: any, b: any) => {
      if (a.lastMessage && !b.lastMessage) return -1;
      if (!a.lastMessage && b.lastMessage) return 1;
      if (a.lastMessage && b.lastMessage) return new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime();
      return a.name.localeCompare(b.name);
    });
    // Filtrar por nome ou telefone
    const chatClients = searchQ
      ? allChatClients.filter((c: any) => c.name.toLowerCase().includes(searchQ) || (c.phone ?? "").replace(/\D/g, "").includes(searchQ.replace(/\D/g, "")))
      : allChatClients;

    const clientRows = chatClients.map((c: any) => {
      const lastMsg = c.lastMessage
        ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${esc(c.lastMessage.message)}</div>`
        : `<div style="font-size:11px;color:var(--muted);margin-top:2px">Nenhuma mensagem ainda</div>`;
      const badge = c.messageCount > 0 ? `<span style="background:#C9A84C;color:#000;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;margin-left:6px">${c.messageCount}</span>` : "";
      const timeStr = c.lastMessage ? `<span style="font-size:10px;color:var(--muted)">${new Date(c.lastMessage.sentAt).toLocaleDateString('pt-BR')}</span>` : "";
      return `<a href="/admin/chat/${c.id}" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:background 0.15s" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='transparent'">
        <div style="width:44px;height:44px;border-radius:50%;background:#C9A84C;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#000;flex-shrink:0">${esc(c.name.charAt(0).toUpperCase())}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600;font-size:14px">${esc(c.name)}${badge}</span>
            ${timeStr}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${esc(c.phone ?? '')}</div>
          ${lastMsg}
        </div>
        <span style="font-size:18px;color:var(--muted)">›</span>
      </a>`;
    }).join("");

    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-size:20px;font-weight:700;margin:0">💬 Chat WhatsApp</h2>
        <span style="font-size:12px;color:var(--muted)">${allChatClients.length} cliente(s)</span>
      </div>
      <form method="GET" style="display:flex;gap:8px;margin-bottom:16px">
        <input type="text" name="q" value="${esc(searchQ)}" placeholder="Buscar por nome ou telefone..."
          style="flex:1;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
        <button type="submit" class="btn btn-primary" style="padding:10px 18px">Buscar</button>
        ${searchQ ? `<a href="/admin/chat" class="btn btn-ghost" style="padding:10px 14px">✕</a>` : ""}
      </form>
      ${searchQ ? `<div style="font-size:12px;color:var(--muted);margin-bottom:12px">${chatClients.length} resultado(s) para "${esc(searchQ)}"</div>` : ""}
      <div class="card" style="padding:0;overflow:hidden">
        ${clientRows || `<div style="padding:40px;text-align:center;color:var(--muted)">${searchQ ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado.'}</div>`}
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Chat WhatsApp", "chat", body, barber?.name, _tp));
  });

  app.get("/admin/chat/:clientId", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? 1;
    const clientId = parseInt(req.params.clientId);
    const client = await db.getClientById(clientId);
    if (!client) { res.redirect("/admin/chat"); return; }
    const history = await db.getChatHistory(tenantId, clientId);
    const msgBubbles = history.map((m: any) => {
      const isOut = m.direction === "outgoing";
      const time = new Date(m.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const date = new Date(m.sentAt).toLocaleDateString("pt-BR");
      return `<div style="display:flex;justify-content:${isOut ? "flex-end" : "flex-start"};margin-bottom:8px">
        <div style="max-width:70%;background:${isOut ? "#C9A84C" : "var(--surface)"};color:${isOut ? "#000" : "var(--text)"};padding:10px 14px;border-radius:${isOut ? "18px 18px 4px 18px" : "18px 18px 18px 4px"};font-size:14px">
          ${esc(m.message)}
          <div style="font-size:10px;opacity:0.6;margin-top:4px;text-align:right">${date} ${time}</div>
        </div>
      </div>`;
    }).join("");
    // Templates de mensagem rápida
    const templates = [
      "Olá! Tudo bem? Gostaria de confirmar seu agendamento.",
      "Seu agendamento foi confirmado! Te esperamos.",
      "Lembrete: você tem um agendamento amanhã conosco.",
      "Obrigado pela visita! Esperamos te ver em breve.",
      "Temos uma promoção especial esta semana. Quer agendar?",
    ];
    const templateBtns = templates.map(t => `<button type="button" onclick="document.getElementById('msgInput').value='${t.replace(/'/g, "\\'")}"" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;color:var(--text);text-align:left">${esc(t)}</button>`).join("");
    const phone = client.phone?.replace(/\D/g, "") ?? "";
    const body = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <a href="/admin/chat" style="color:var(--muted);text-decoration:none;font-size:20px">←</a>
        <div style="width:42px;height:42px;border-radius:50%;background:#C9A84C;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#000">${esc(client.name.charAt(0).toUpperCase())}</div>
        <div>
          <div style="font-weight:700;font-size:16px">${esc(client.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${esc(client.phone ?? "")}</div>
        </div>
      </div>
      <!-- Histórico de mensagens -->
      <div class="card" style="margin-bottom:16px;padding:16px;min-height:300px;max-height:450px;overflow-y:auto" id="chatHistory">
        ${msgBubbles || '<div style="text-align:center;color:var(--muted);padding:40px">Nenhuma mensagem ainda. Envie a primeira!</div>'}
      </div>
      <!-- Templates rápidos -->
      <div style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Mensagens rápidas:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${templateBtns}</div>
      </div>
      <!-- Formulário de envio -->
      <form method="POST" action="/admin/chat/${clientId}" style="display:flex;gap:8px">
        <textarea id="msgInput" name="message" rows="2" placeholder="Digite sua mensagem..." required style="flex:1;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;resize:none"></textarea>
        <button type="submit" class="btn" style="align-self:flex-end;padding:10px 20px">Enviar via WhatsApp</button>
      </form>
      <script>const h=document.getElementById('chatHistory');if(h)h.scrollTop=h.scrollHeight;</script>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout(`Chat — ${client.name}`, "chat", body, barber?.name, _tp));
  });

  app.post("/admin/chat/:clientId", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? 1;
    const clientId = parseInt(req.params.clientId);
    const { message } = req.body;
    if (!message?.trim()) { res.redirect(`/admin/chat/${clientId}`); return; }
    const client = await db.getClientById(clientId);
    if (!client) { res.redirect("/admin/chat"); return; }
    // Salvar no histórico
    await db.saveChatMessage({ tenantId, clientId, barberId: session.barberId, direction: "outgoing", message: message.trim(), status: "sent" });
    // Redirecionar para WhatsApp com a mensagem
    const phone = (client.phone ?? "").replace(/\D/g, "");
    const waUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message.trim())}`;
    // Redirecionar para o WhatsApp e depois voltar ao chat
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Abrindo WhatsApp...</title></head><body style="font-family:sans-serif;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px">
      <div style="font-size:48px">💬</div>
      <div style="font-size:18px;font-weight:600">Abrindo WhatsApp...</div>
      <div style="font-size:14px;color:#999">A mensagem foi salva no histórico.</div>
      <script>window.open('${waUrl}','_blank');setTimeout(()=>location.href='/admin/chat/${clientId}',1500);</script>
    </body></html>`);
  });

  // ─── Exportação CSV ───────────────────────────────────────────────────────────
  app.get("/admin/export/clientes.csv", requireAdminAuth, async (req: Request, res: Response) => {
    const sessionExp = (req as any).adminSession;
    const barberExp = await db.getBarberById(sessionExp.barberId);
    const allClients = await db.getAllClients(barberExp?.tenantId);
    const rows = [
      ["ID", "Nome", "Telefone", "Email", "Data Nasc.", "Pontos", "Ativo", "Cadastrado em"],
      ...allClients.map((c: any) => [
        c.id, c.name, c.phone ?? "", c.email ?? "", c.birthDate ?? "",
        c.totalPoints, c.isActive ? "Sim" : "Não",
        new Date(c.createdAt).toLocaleDateString("pt-BR")
      ])
    ];
    const csv = rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="clientes.csv"');
    res.send("\uFEFF" + csv);
  });

  app.get("/admin/export/financeiro.csv", requireAdminAuth, async (req: Request, res: Response) => {
    const sessionCsv = (req as any).adminSession;
    const barberCsv = await db.getBarberById(sessionCsv.barberId);
    const period = (req.query.period as string) || "30";
    const days = parseInt(period) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);
    const sales = await db.getSalesByDateRange(startStr, endStr, undefined, barberCsv?.tenantId);
    const expenses = await db.getExpensesByDateRange(startStr, endStr, barberCsv?.tenantId);
    const rows = [
      ["Data", "Tipo", "Descrição", "Valor", "Forma de Pagamento", "Status"],
      ...sales.map((s: any) => [
        new Date(s.createdAt).toLocaleDateString("pt-BR"), "Receita",
        s.notes ?? "Venda", s.total, s.paymentMethod, s.paymentStatus
      ]),
      ...expenses.map((e: any) => [
        e.date, "Despesa", e.description, `-${e.amount}`, e.paymentMethod ?? "", "pago"
      ])
    ];
    const csv = rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="financeiro.csv"');
    res.send("\uFEFF" + csv);
  });

  app.get("/admin/export/estoque.csv", requireAdminAuth, async (req: Request, res: Response) => {
    const sessionEst = (req as any).adminSession;
    const barberEst = await db.getBarberById(sessionEst.barberId);
    const products = await db.getAllProducts(false, barberEst?.tenantId ?? undefined);
    const rows = [
      ["ID", "Nome", "Tipo", "Preço", "Estoque Atual", "Alerta Mínimo", "Ativo"],
      ...products.map((p: any) => [
        p.id, p.name, p.productType === "sale" ? "Venda" : "Uso Interno",
        p.price, p.stockQuantity, p.minStockAlert, p.isActive ? "Sim" : "Não"
      ])
    ];
    const csv = rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="estoque.csv"');
    res.send("\uFEFF" + csv);
  });

  // GET /admin/export/relatorio.pdf — Exportar DRE simplificado em PDF
  app.get("/admin/export/relatorio.pdf", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const settings = await db.getShopSettings(barber?.tenantId);
      const period = (req.query.period as string) || "30";
      const days = parseInt(period) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);
      const allSales = await db.getSalesByDateRange(startStr, endStr, undefined, barber?.tenantId);
      const allExpenses = await db.getExpensesByDateRange(startStr, endStr, barber?.tenantId);
      const allBarbers = await db.getAllBarbers(barber?.tenantId);
      const saleItemsData = await db.getSaleItemsByDateRange(startStr, endStr, barber?.tenantId);
      const totalRevenue = allSales.reduce((s: number, sale: any) => s + parseFloat(sale.total ?? "0"), 0);
      const totalDiscount = allSales.reduce((s: number, sale: any) => s + parseFloat(sale.discount ?? "0"), 0);
      const totalExpenses = allExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount ?? "0"), 0);
      const netProfit = totalRevenue - totalExpenses;
      const grossMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
      // Receitas por forma de pagamento
      const pmLabels: Record<string, string> = { cash: "Dinheiro", credit_card: "Cartão Crédito", debit_card: "Cartão Débito", pix: "Pix", mercado_pago: "Mercado Pago", other: "Outro" };
      const pmMap: Record<string, number> = {};
      allSales.forEach((s: any) => {
        const pm = s.paymentMethod ?? "other";
        pmMap[pm] = (pmMap[pm] ?? 0) + parseFloat(s.total ?? "0");
      });
      // Despesas por categoria
      const catMap: Record<string, number> = {};
      allExpenses.forEach((e: any) => {
        const cat = e.category ?? "Outros";
        catMap[cat] = (catMap[cat] ?? 0) + parseFloat(e.amount ?? "0");
      });
      // Desempenho por barbeiro
      const barberStats = await Promise.all(allBarbers.map(async (b: any) => {
        const bSales = allSales.filter((s: any) => s.barberId === b.id);
        const bRevenue = bSales.reduce((sum: number, s: any) => sum + parseFloat(s.total ?? "0"), 0);
        const bAppts = await db.getAllAppointmentsByDateRange(b.id, startStr, endStr);
        const completed = bAppts.filter((a: any) => a.status === "completed").length;
        return { name: b.name, revenue: bRevenue, completed };
      }));

      const shopName = settings?.shopName ?? "Barber Pro";
      const cnpj = settings?.cnpj ?? "";
      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const periodLabel = `${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="relatorio-${endStr}.pdf"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      // Cabeçalho
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#C9A84C").text("BARBER PRO", { align: "center" });
      doc.fontSize(14).font("Helvetica").fillColor("#333333").text(shopName, { align: "center" });
      if (cnpj) doc.fontSize(10).fillColor("#666666").text(`CNPJ: ${cnpj}`, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000").text("DEMONSTRATIVO DE RESULTADO", { align: "center" });
      doc.fontSize(11).font("Helvetica").fillColor("#555555").text(`Período: ${periodLabel}`, { align: "center" });
      doc.moveDown(0.5);
      // Linha separadora
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#C9A84C").lineWidth(1.5).stroke();
      doc.moveDown(1);

      // KPIs (4 boxes)
      const kpiY = doc.y;
      const kpiW = 115;
      const kpiBoxes = [
        { label: "Faturamento Bruto", value: `R$ ${fmt(totalRevenue)}`, color: "#C9A84C" },
        { label: "Total de Despesas", value: `R$ ${fmt(totalExpenses)}`, color: "#EF4444" },
        { label: "Lucro Líquido", value: `R$ ${fmt(netProfit)}`, color: netProfit >= 0 ? "#22C55E" : "#EF4444" },
        { label: "Margem Líquida", value: `${grossMargin}%`, color: grossMargin >= 0 ? "#22C55E" : "#EF4444" },
      ];
      kpiBoxes.forEach((kpi, i) => {
        const x = 50 + i * (kpiW + 8);
        doc.rect(x, kpiY, kpiW, 60).fillColor("#F8F8F8").fill();
        doc.rect(x, kpiY, kpiW, 60).strokeColor("#E5E5E5").lineWidth(0.5).stroke();
        doc.fontSize(8).font("Helvetica").fillColor("#666666").text(kpi.label, x + 8, kpiY + 10, { width: kpiW - 16 });
        doc.fontSize(14).font("Helvetica-Bold").fillColor(kpi.color).text(kpi.value, x + 8, kpiY + 28, { width: kpiW - 16 });
      });
      doc.y = kpiY + 75;
      doc.moveDown(0.5);

      // DRE Estruturado (formato contabil)
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#000000").text("DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO (DRE)");
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#C9A84C").lineWidth(1).stroke();
      doc.moveDown(0.3);
      const dreRow = (label: string, value: number, bold = false, indent = 0, color = "#333333") => {
        const x = 50 + indent;
        doc.fontSize(bold ? 11 : 10).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(color);
        doc.text(label, x, doc.y, { continued: true, width: 350 - indent });
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(color).text(`R$ ${fmt(value)}`, { align: "right" });
      };
      dreRow("(+) Receita Bruta de Serviços e Produtos", totalRevenue, true, 0, "#C9A84C");
      if (totalDiscount > 0) dreRow("(-) Descontos Concedidos", -totalDiscount, false, 16, "#EF4444");
      dreRow("(=) Receita Líquida", totalRevenue - totalDiscount, true);
      doc.moveDown(0.3);
      dreRow("(-) Total de Despesas Operacionais", -totalExpenses, false, 0, "#EF4444");
      Object.entries(catMap).sort((a, b) => b[1] - a[1]).forEach(([cat, val]) => {
        dreRow(`    • ${cat}`, -val, false, 16, "#999999");
      });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      dreRow("(=) RESULTADO LÍQUIDO DO PERÍODO", netProfit, true, 0, netProfit >= 0 ? "#22C55E" : "#EF4444");
      doc.moveDown(1);

      // Receitas por forma de pagamento
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#000000").text("RECEITAS POR FORMA DE PAGAMENTO");
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      Object.entries(pmMap).sort((a, b) => b[1] - a[1]).forEach(([pm, val]) => {
        const pct = totalRevenue > 0 ? Math.round(val / totalRevenue * 100) : 0;
        doc.fontSize(11).font("Helvetica").fillColor("#333333").text(`${pmLabels[pm] ?? pm}`, 50, doc.y, { continued: true, width: 300 });
        doc.font("Helvetica-Bold").fillColor("#C9A84C").text(`R$ ${fmt(val)}  (${pct}%)`, { align: "right" });
      });
      if (Object.keys(pmMap).length === 0) doc.fontSize(10).fillColor("#999").text("Sem dados de receita no período.");
      doc.moveDown(1);

      // Despesas por categoria
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#000000").text("DESPESAS POR CATEGORIA");
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      Object.entries(catMap).sort((a, b) => b[1] - a[1]).forEach(([cat, val]) => {
        const pct = totalExpenses > 0 ? Math.round(val / totalExpenses * 100) : 0;
        doc.fontSize(11).font("Helvetica").fillColor("#333333").text(cat, 50, doc.y, { continued: true, width: 300 });
        doc.font("Helvetica-Bold").fillColor("#EF4444").text(`R$ ${fmt(val)}  (${pct}%)`, { align: "right" });
      });
      if (Object.keys(catMap).length === 0) doc.fontSize(10).fillColor("#999").text("Sem despesas registradas no período.");
      doc.moveDown(1);

      // Desempenho por barbeiro
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#000000").text("DESEMPENHO POR PROFISSIONAL");
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      // Cabeçalho da tabela
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#555");
      doc.text("Profissional", 50, doc.y, { continued: true, width: 250 });
      doc.text("Faturamento", { continued: true, width: 130, align: "right" });
      doc.text("Atend. Concluídos", { align: "right" });
      doc.moveDown(0.3);
      barberStats.sort((a, b) => b.revenue - a.revenue).forEach((b: any) => {
        doc.fontSize(11).font("Helvetica").fillColor("#333333");
        doc.text(b.name, 50, doc.y, { continued: true, width: 250 });
        doc.font("Helvetica-Bold").fillColor("#C9A84C").text(`R$ ${fmt(b.revenue)}`, { continued: true, width: 130, align: "right" });
        doc.font("Helvetica").fillColor("#333333").text(String(b.completed), { align: "right" });
      });
      if (barberStats.length === 0) doc.fontSize(10).fillColor("#999").text("Sem dados de profissionais no período.");
      doc.moveDown(1);

      // Ranking de Serviços e Produtos
      if (saleItemsData.length > 0) {
        doc.fontSize(13).font("Helvetica-Bold").fillColor("#000000").text("RANKING DE SERVIÇOS E PRODUTOS");
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#555");
        doc.text("Item", 50, doc.y, { continued: true, width: 220 });
        doc.text("Tipo", { continued: true, width: 80, align: "center" });
        doc.text("Qtd", { continued: true, width: 60, align: "right" });
        doc.text("Faturamento", { align: "right" });
        doc.moveDown(0.3);
        const topItems = saleItemsData.slice(0, 10);
        topItems.forEach((item: any, idx: number) => {
          const pct = totalRevenue > 0 ? Math.round(item.total / totalRevenue * 100) : 0;
          doc.fontSize(10).font("Helvetica").fillColor(idx % 2 === 0 ? "#333333" : "#555555");
          doc.text(item.itemName, 50, doc.y, { continued: true, width: 220 });
          doc.fillColor(item.itemType === "service" ? "#0a7ea4" : "#C9A84C");
          doc.text(item.itemType === "service" ? "Serviço" : "Produto", { continued: true, width: 80, align: "center" });
          doc.fillColor("#333333");
          doc.text(String(item.quantity), { continued: true, width: 60, align: "right" });
          doc.font("Helvetica-Bold").fillColor("#C9A84C").text(`R$ ${fmt(item.total)}  (${pct}%)`, { align: "right" });
        });
        doc.moveDown(1);
      }

      // Resultado final
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#C9A84C").lineWidth(1.5).stroke();
      doc.moveDown(0.5);
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000").text("RESULTADO DO PERÍODO", { continued: true });
      doc.fillColor(netProfit >= 0 ? "#22C55E" : "#EF4444").text(`  R$ ${fmt(netProfit)}`, { align: "right" });
      doc.moveDown(2);

      // Rodapé
      doc.fontSize(9).font("Helvetica").fillColor("#AAAAAA").text(
        `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} — Barber Pro`,
        { align: "center" }
      );

      doc.end();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Minhas Comissões (role barber) ────────────────────────────────────────
  app.get("/admin/minhas-comissoes", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const { start, end } = monthRange();
    const allSummary = await db.getCommissionSummary(start, end);
    const myData = allSummary.find((s) => s.barberId === session.barberId);
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
    const body = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="metric-card">
          <div class="metric-label">ATENDIMENTOS NO MÊS</div>
          <div class="metric-value">${myData?.entriesCount ?? 0}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">FATURAMENTO BRUTO</div>
          <div class="metric-value">${fmtCurrency(myData?.totalGross ?? 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">COMISSÃO A RECEBER</div>
          <div class="metric-value" style="color:var(--warning);">${fmtCurrency(myData?.totalCommission ?? 0)}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">🤝 Minhas Comissões</span>
          <span style="color:var(--muted);font-size:12px;">${fmtDate(start)} a ${fmtDate(end)}</span>
          ${myData ? `<span class="badge badge-gold">${myData.commissionRate}% comissão</span>` : ""}
        </div>
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Bruto</th><th>Comissão</th></tr></thead>
          <tbody>
            ${!myData || myData.entries.length === 0
              ? `<tr><td colspan="4" class="empty">Nenhuma comissão registrada neste mês.</td></tr>`
              : myData.entries.map((e: any) => `
                <tr>
                  <td>${e.date ? new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</td>
                  <td>${esc(e.description ?? "Atendimento")}</td>
                  <td>${fmtCurrency(parseFloat(e.grossValue))}</td>
                  <td style="color:var(--warning);">${fmtCurrency(parseFloat(e.commissionValue))}</td>
                </tr>
              `).join("")}
          </tbody>
        </table>
      </div>
    `;
    res.send(adminLayout("Minhas Comissões", "minhas-comissoes", body, barber?.name, _tp));
  });

}
