/**
 * Barber Pro — Backoffice Super-Admin
 *
 * Painel interno de gestão da plataforma Barber Pro.
 * Acessível em /superadmin — protegido por login e-mail/senha com hierarquia de roles.
 *
 * Roles:
 *   super_admin — acesso total (gerenciar usuários do backoffice, CMS, tenants, tudo)
 *   admin       — acesso a tenants, erros e leads (sem gestão de usuários nem CMS)
 *   suporte     — somente visualização de tenants e erros (sem ações destrutivas)
 */

import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import * as db from "./db";
import { eq } from "drizzle-orm";
import { backofficeUsers } from "../drizzle/schema";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type BORoleType = "super_admin" | "admin" | "suporte";

interface BOSession {
  userId: number;
  name: string;
  email: string;
  role: BORoleType;
}

// ─── Cookie de sessão ─────────────────────────────────────────────────────────
const SESSION_COOKIE = "bp_bo_session";
const SESSION_SECRET = process.env.BO_SESSION_SECRET ?? "bp-bo-secret-2025-x9k";

function encodeSession(data: BOSession): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64");
  const sig = Buffer.from(payload + SESSION_SECRET).toString("base64").slice(0, 16);
  return `${payload}.${sig}`;
}

function decodeSession(token: string): BOSession | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expectedSig = Buffer.from(payload + SESSION_SECRET).toString("base64").slice(0, 16);
    if (sig !== expectedSig) return null;
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as BOSession;
  } catch {
    return null;
  }
}

function getSession(req: Request): BOSession | null {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.trim().split("=");
    if (k) cookies[k.trim()] = decodeURIComponent(v.join("="));
  });
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  return decodeSession(token);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session) return res.redirect("/superadmin/login");
  (req as any).boSession = session;
  next();
}

function requireRole(...roles: BORoleType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).boSession as BOSession;
    if (!session || !roles.includes(session.role)) {
      return res.status(403).send(layout("Acesso Negado", getSession(req), `
        <div class="container">
          <div class="empty" style="margin-top:80px">
            <div class="empty-icon">🔒</div>
            <div style="font-size:18px;font-weight:700;margin-bottom:8px">Acesso Negado</div>
            <div>Você não tem permissão para acessar esta seção.</div>
            <a href="/superadmin" style="display:inline-block;margin-top:20px;padding:10px 24px;background:var(--gold);color:#0A0A0A;border-radius:10px;font-weight:700;text-decoration:none">Voltar ao Dashboard</a>
          </div>
        </div>
      `));
    }
    next();
  };
}

// ─── Helpers HTML ─────────────────────────────────────────────────────────────
function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function layout(title: string, session: BOSession | null, body: string): string {
  const nav = session ? `
    <nav class="nav">
      <a href="/superadmin" class="nav-brand">BARBER PRO <span>/ Backoffice</span></a>
      <div class="nav-links">
        <a href="/superadmin" class="${title === "Dashboard" ? "active" : ""}">Dashboard</a>
        <a href="/superadmin/tenants" class="${title === "Barbearias" ? "active" : ""}">Barbearias</a>
        <a href="/superadmin/erros" class="${title === "Erros" ? "active" : ""}">Erros</a>
        <a href="/superadmin/leads" class="${title === "Leads" ? "active" : ""}">Leads</a>
        ${session.role === "super_admin" ? `<a href="/superadmin/usuarios" class="${title === "Usuários" ? "active" : ""}">Usuários</a>` : ""}
        ${session.role === "super_admin" ? `<a href="/superadmin/cms" class="${title.startsWith("CMS") ? "active" : ""}">CMS</a>` : ""}
        <div class="nav-user">
          <span>${esc(session.name)}</span>
          <span class="role-badge role-${session.role}">${session.role === "super_admin" ? "Super Admin" : session.role === "admin" ? "Admin" : "Suporte"}</span>
          <a href="/superadmin/logout" style="color:var(--error)">Sair</a>
        </div>
      </div>
    </nav>
  ` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} — Barber Pro Backoffice</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold: #C9A84C; --gold-dim: #C9A84C22;
      --bg: #0A0A0A; --surface: #141414; --surface2: #1E1E1E;
      --border: #2A2A2A; --text: #F0EEE8; --muted: #888880;
      --success: #4ADE80; --warning: #FBBF24; --error: #F87171; --info: #60A5FA;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
    a { color: var(--gold); text-decoration: none; }
    a:hover { opacity: 0.8; }

    /* Nav */
    .nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 28px; display: flex; align-items: center; gap: 0; height: 54px; position: sticky; top: 0; z-index: 50; }
    .nav-brand { font-size: 14px; font-weight: 900; color: var(--gold); letter-spacing: 2px; margin-right: 32px; white-space: nowrap; }
    .nav-brand span { color: var(--muted); font-weight: 400; letter-spacing: 0; }
    .nav-links { display: flex; align-items: center; gap: 4px; flex: 1; }
    .nav-links a { font-size: 13px; color: var(--muted); padding: 6px 12px; border-radius: 8px; transition: all 0.15s; }
    .nav-links a:hover { color: var(--text); background: var(--surface2); }
    .nav-links a.active { color: var(--gold); background: var(--gold-dim); }
    .nav-user { margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 12px; }
    .nav-user span { color: var(--muted); }
    .role-badge { padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
    .role-super_admin { background: #C9A84C22; color: var(--gold); }
    .role-admin { background: #60A5FA22; color: var(--info); }
    .role-suporte { background: #4ADE8022; color: var(--success); }

    /* Layout */
    .container { max-width: 1280px; margin: 0 auto; padding: 32px 24px; }
    .page-header { margin-bottom: 28px; }
    .page-title { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .page-sub { font-size: 13px; color: var(--muted); }

    /* Métricas */
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 28px; }
    .metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px; }
    .metric-label { font-size: 10px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
    .metric-value { font-size: 30px; font-weight: 900; color: var(--gold); line-height: 1; }
    .metric-sub { font-size: 11px; color: var(--muted); margin-top: 5px; }

    /* Tabela */
    .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; margin-bottom: 24px; }
    .table-header { padding: 18px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .table-header h2 { font-size: 15px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 11px 22px; font-size: 10px; color: var(--muted); letter-spacing: 1.2px; text-transform: uppercase; border-bottom: 1px solid var(--border); white-space: nowrap; }
    td { padding: 13px 22px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface2); }

    /* Badges */
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .badge-active { background: #4ADE8022; color: #4ADE80; }
    .badge-trial { background: #FBBF2422; color: #FBBF24; }
    .badge-suspended { background: #F8717122; color: #F87171; }
    .badge-cancelled { background: #44444422; color: #888; }
    .plan-solo { color: var(--muted); }
    .plan-team { color: var(--gold); }
    .plan-studio { color: #C084FC; }

    /* Botões */
    .btn { display: inline-block; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.8; text-decoration: none; }
    .btn-gold { background: var(--gold-dim); color: var(--gold); border: 1px solid #C9A84C44; }
    .btn-green { background: #4ADE8022; color: #4ADE80; border: 1px solid #4ADE8044; }
    .btn-red { background: #F8717122; color: #F87171; border: 1px solid #F8717144; }
    .btn-blue { background: #60A5FA22; color: #60A5FA; border: 1px solid #60A5FA44; }
    .btn-gray { background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }
    .btn-primary { background: var(--gold); color: #0A0A0A; border: none; padding: 8px 18px; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }

    /* Login */
    .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); }
    .login-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 40px; width: 100%; max-width: 380px; }
    .login-logo { font-size: 20px; font-weight: 900; color: var(--gold); letter-spacing: 3px; text-align: center; margin-bottom: 4px; }
    .login-sub { font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 28px; }
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 5px; }
    input[type=email], input[type=password], input[type=text], textarea, select {
      width: 100%; padding: 11px 13px; background: var(--bg); border: 1px solid var(--border);
      border-radius: 10px; color: var(--text); font-size: 14px; outline: none; font-family: inherit;
    }
    input:focus, textarea:focus, select:focus { border-color: var(--gold); }
    textarea { resize: vertical; min-height: 80px; }
    .btn-submit { width: 100%; padding: 13px; background: var(--gold); color: #0A0A0A; font-size: 15px; font-weight: 800; border: none; border-radius: 12px; cursor: pointer; margin-top: 8px; }
    .btn-submit:hover { opacity: 0.9; }
    .alert { padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
    .alert-error { background: #F8717122; border: 1px solid #F8717144; color: #F87171; }
    .alert-success { background: #4ADE8022; border: 1px solid #4ADE8044; color: #4ADE80; }

    /* Filtros */
    .filters { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; align-items: center; }
    .filter-btn { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--muted); text-decoration: none; }
    .filter-btn:hover { border-color: var(--gold); color: var(--gold); text-decoration: none; }
    .filter-btn.active { background: var(--gold-dim); border-color: var(--gold); color: var(--gold); }

    /* Modal */
    .modal-overlay { display: none; position: fixed; inset: 0; background: #00000088; z-index: 100; align-items: center; justify-content: center; }
    .modal-overlay.open { display: flex; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px; width: 100%; max-width: 440px; }
    .modal h3 { font-size: 17px; font-weight: 800; margin-bottom: 18px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }

    /* Empty state */
    .empty { text-align: center; padding: 60px 24px; color: var(--muted); }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }

    /* Stack de texto */
    .text-sm { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .text-mono { font-family: monospace; font-size: 12px; }
    .stack-box { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 11px; font-family: monospace; color: var(--muted); white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto; margin-top: 6px; }

    /* CMS */
    .cms-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-bottom: 18px; }
    .cms-card h3 { font-size: 14px; font-weight: 700; margin-bottom: 14px; color: var(--gold); }
    .cms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 640px) { .cms-grid { grid-template-columns: 1fr; } }

    /* Responsive */
    @media (max-width: 768px) {
      .container { padding: 16px; }
      th, td { padding: 10px 14px; }
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .nav-links { gap: 2px; }
      .nav-links a { padding: 5px 8px; font-size: 12px; }
    }
  </style>
</head>
<body>
  ${nav}
  ${body}
  <script>
    function openModal(id) { document.getElementById(id)?.classList.add('open'); }
    function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
    function openPlanModal(tenantId, currentPlan) {
      document.getElementById('plan-tenant-id').value = tenantId;
      document.getElementById('plan-select').value = currentPlan;
      openModal('plan-modal');
    }
    function openUserModal(id, name, email, role, isActive) {
      document.getElementById('edit-user-id').value = id;
      document.getElementById('edit-user-name').value = name;
      document.getElementById('edit-user-email').value = email;
      document.getElementById('edit-user-role').value = role;
      document.getElementById('edit-user-active').value = isActive ? '1' : '0';
      openModal('edit-user-modal');
    }
  </script>
</body>
</html>`;
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    active: '<span class="badge badge-active">Ativo</span>',
    trial: '<span class="badge badge-trial">Trial</span>',
    suspended: '<span class="badge badge-suspended">Suspenso</span>',
    cancelled: '<span class="badge badge-cancelled">Cancelado</span>',
  };
  return map[status] ?? `<span class="badge">${esc(status)}</span>`;
}

function planLabel(plan: string): string {
  const map: Record<string, string> = {
    solo: '<span class="plan-solo">Solo — R$49</span>',
    team: '<span class="plan-team">Equipe — R$89</span>',
    studio: '<span class="plan-studio">Estúdio — R$149</span>',
  };
  return map[plan] ?? esc(plan);
}

function trialDaysLeft(trialEndsAt: Date | null): string {
  if (!trialEndsAt) return "—";
  const diff = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
  if (diff < 0) return '<span style="color:#F87171">Expirado</span>';
  if (diff === 0) return '<span style="color:#FBBF24">Hoje</span>';
  return `<span style="color:#FBBF24">${diff}d</span>`;
}

function roleBadge(role: string): string {
  const map: Record<string, string> = {
    super_admin: '<span class="badge" style="background:#C9A84C22;color:var(--gold)">Super Admin</span>',
    admin: '<span class="badge" style="background:#60A5FA22;color:#60A5FA">Admin</span>',
    suporte: '<span class="badge" style="background:#4ADE8022;color:#4ADE80">Suporte</span>',
  };
  return map[role] ?? esc(role);
}

// ─── Funções de banco para backoffice_users (Drizzle ORM / PostgreSQL) ──────────
async function getBoUser(email: string): Promise<any | null> {
  const dbConn = await db.getDb();
  if (!dbConn) return null;
  const rows = await dbConn
    .select()
    .from(backofficeUsers)
    .where(eq(backofficeUsers.email, email.toLowerCase().trim()))
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}
async function getAllBoUsers(): Promise<any[]> {
  const dbConn = await db.getDb();
  if (!dbConn) return [];
  return dbConn.select().from(backofficeUsers).orderBy(backofficeUsers.createdAt);
}
async function createBoUser(name: string, email: string, passwordHash: string, role: BORoleType): Promise<void> {
  const dbConn = await db.getDb();
  if (!dbConn) throw new Error("DB unavailable");
  await dbConn.insert(backofficeUsers).values({ name, email: email.toLowerCase().trim(), passwordHash, role });
}
async function updateBoUser(id: number, data: { name?: string; email?: string; passwordHash?: string; role?: string; isActive?: boolean }): Promise<void> {
  const dbConn = await db.getDb();
  if (!dbConn) throw new Error("DB unavailable");
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
  if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (Object.keys(updateData).length === 0) return;
  await dbConn.update(backofficeUsers).set(updateData).where(eq(backofficeUsers.id, id));
}
// ─── Registro das rotas ───────────────────────────────────────────────────────
export function registerSuperAdminRoutes(app: Express): void {

  // ── GET /superadmin/login ──────────────────────────────────────────────────
  app.get("/superadmin/login", (req: Request, res: Response) => {
    const session = getSession(req);
    if (session) return res.redirect("/superadmin");
    const error = req.query.error ? '<div class="alert alert-error">E-mail ou senha incorretos.</div>' : "";
    const success = req.query.created ? '<div class="alert alert-success">Conta criada! Faça login.</div>' : "";
    res.send(layout("Login", null, `
      <div class="login-wrap">
        <div class="login-card">
          <div class="login-logo">BARBER PRO</div>
          <div class="login-sub">Backoffice Interno · Acesso Restrito</div>
          ${error}${success}
          <form method="POST" action="/superadmin/login">
            <div class="form-group">
              <label>E-mail</label>
              <input type="email" name="email" placeholder="seu@email.com" autofocus required />
            </div>
            <div class="form-group">
              <label>Senha</label>
              <input type="password" name="password" placeholder="••••••••••" required />
            </div>
            <button type="submit" class="btn-submit">ENTRAR</button>
          </form>
        </div>
      </div>
    `));
  });

  // ── POST /superadmin/login ─────────────────────────────────────────────────
  app.post("/superadmin/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      if (!email || !password) return res.redirect("/superadmin/login?error=1");
      const user = await getBoUser(email.toLowerCase().trim());
      if (!user || !user.isActive) return res.redirect("/superadmin/login?error=1");
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.redirect("/superadmin/login?error=1");
      const session: BOSession = { userId: user.id, name: user.name, email: user.email, role: user.role };
      const token = encodeSession(session);
      res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/superadmin; HttpOnly; SameSite=Lax; Max-Age=86400`);
      res.redirect("/superadmin");
    } catch (e) {
      console.error("[BO Login]", e);
      res.redirect("/superadmin/login?error=1");
    }
  });

  // ── GET /superadmin/logout ─────────────────────────────────────────────────
  app.get("/superadmin/logout", (_req: Request, res: Response) => {
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/superadmin; HttpOnly; Max-Age=0`);
    res.redirect("/superadmin/login");
  });

  // ── GET /superadmin (dashboard) ────────────────────────────────────────────
  app.get("/superadmin", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    try {
      const allTenants = await db.getAllTenants();
      const total = allTenants.length;
      const active = allTenants.filter((t) => t.status === "active").length;
      const trial = allTenants.filter((t) => t.status === "trial").length;
      const suspended = allTenants.filter((t) => t.status === "suspended").length;
      const mrr = allTenants.filter((t) => t.status === "active")
        .reduce((s, t) => s + (t.plan === "solo" ? 49 : t.plan === "team" ? 89 : 149), 0);

      // Gráfico: novos cadastros por semana (12 semanas)
      const now = new Date();
      const weekLabels: string[] = [];
      const weekCounts: number[] = [];
      for (let w = 11; w >= 0; w--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - w * 7 - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        const count = allTenants.filter((t) => {
          const d = new Date(t.createdAt);
          return d >= weekStart && d < weekEnd;
        }).length;
        const label = weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        weekLabels.push(label);
        weekCounts.push(count);
      }
      const chartLabels = JSON.stringify(weekLabels);
      const chartData = JSON.stringify(weekCounts);

      // Gráfico de MRR acumulado por semana (12 semanas)
      const mrrByWeek: number[] = [];
      for (let w = 11; w >= 0; w--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() - w * 7 - now.getDay() + 7);
        weekEnd.setHours(23, 59, 59, 999);
        const mrrAtWeek = allTenants
          .filter((t) => t.status === "active" && new Date(t.createdAt) <= weekEnd)
          .reduce((s, t) => s + (t.plan === "solo" ? 49 : t.plan === "team" ? 89 : 149), 0);
        mrrByWeek.push(mrrAtWeek);
      }
      const mrrChartData = JSON.stringify(mrrByWeek);
      const totalLeads = await (async () => {
        try {
          const dbConn = await db.getDb();
          if (!dbConn) return 0;
          const { sql } = await import('drizzle-orm');
          const rows = await dbConn.execute(sql`SELECT COUNT(*) as cnt FROM orbit_leads`);
          return (rows.rows?.[0] as any)?.cnt ?? 0;
        } catch { return 0; }
      })();

      // Últimas 5 barbearias
      const recent = allTenants.slice(0, 5).map((t) => `
        <tr>
          <td><div style="font-weight:600">${esc(t.name)}</div><div class="text-sm">${esc(t.slug)}</div></td>
          <td>${planLabel(t.plan)}</td>
          <td>${statusBadge(t.status)}</td>
          <td style="color:var(--muted)">${new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
          <td><a href="/superadmin/tenants" class="btn btn-gray" style="font-size:11px">Ver todos</a></td>
        </tr>
      `).join("");

      res.send(layout("Dashboard", session, `
        <div class="container">
          <div class="page-header">
            <div class="page-title">Dashboard da Plataforma</div>
            <div class="page-sub">Visão geral do Barber Pro · ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>

          <div class="metrics">
            <div class="metric-card">
              <div class="metric-label">Total de Barbearias</div>
              <div class="metric-value">${total}</div>
              <div class="metric-sub">tenants cadastrados</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Assinaturas Ativas</div>
              <div class="metric-value" style="color:var(--success)">${active}</div>
              <div class="metric-sub">pagando mensalmente</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Em Trial</div>
              <div class="metric-value" style="color:var(--warning)">${trial}</div>
              <div class="metric-sub">período gratuito</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Suspensos</div>
              <div class="metric-value" style="color:var(--error)">${suspended}</div>
              <div class="metric-sub">sem acesso</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">MRR Estimado</div>
              <div class="metric-value">R$${mrr}</div>
              <div class="metric-sub">receita mensal recorrente</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Leads Capturados</div>
              <div class="metric-value" style="color:var(--info)">${totalLeads}</div>
              <div class="metric-sub">interesse na landing page</div>
            </div>
          </div>

          <!-- GRÁFICO DE CRESCIMENTO -->
          <div class="table-wrap" style="margin-bottom:24px">
            <div class="table-header">
              <h2>Crescimento Semanal</h2>
              <span style="font-size:12px;color:var(--muted)">Novos cadastros por semana (12 semanas)</span>
            </div>
            <div style="padding:20px 16px">
              <canvas id="growthChart" height="80"></canvas>
            </div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
          <script>
            (function(){
              var opts = {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { size: 11 } } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { size: 11 } }, beginAtZero: true }
                }
              };
              // Gráfico de crescimento
              new Chart(document.getElementById('growthChart').getContext('2d'), {
                type: 'line',
                data: {
                  labels: ${chartLabels},
                  datasets: [{
                    label: 'Novos cadastros',
                    data: ${chartData},
                    borderColor: '#C9A84C',
                    backgroundColor: 'rgba(201,168,76,0.12)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#C9A84C',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                  }]
                },
                options: Object.assign({}, opts, {
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c){ return c.parsed.y + ' cadastro' + (c.parsed.y !== 1 ? 's' : ''); } } } },
                  scales: { x: opts.scales.x, y: Object.assign({}, opts.scales.y, { ticks: { color: '#888', font: { size: 11 }, stepSize: 1 } }) }
                })
              });
              // Gráfico de MRR
              new Chart(document.getElementById('mrrChart').getContext('2d'), {
                type: 'line',
                data: {
                  labels: ${chartLabels},
                  datasets: [{
                    label: 'MRR',
                    data: ${mrrChartData},
                    borderColor: '#22C55E',
                    backgroundColor: 'rgba(34,197,94,0.10)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#22C55E',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                  }]
                },
                options: Object.assign({}, opts, {
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c){ return 'R$' + c.parsed.y; } } } }
                })
              });
            })();
          </script>

          <!-- GRÁFICO DE MRR -->
          <div class="table-wrap" style="margin-bottom:24px">
            <div class="table-header">
              <h2>Evolução do MRR</h2>
              <span style="font-size:12px;color:var(--muted)">Receita mensal recorrente acumulada (12 semanas)</span>
            </div>
            <div style="padding:20px 16px">
              <canvas id="mrrChart" height="80"></canvas>
            </div>
          </div>

          <div class="table-wrap">
            <div class="table-header">
              <h2>Cadastros Recentes</h2>
              <a href="/superadmin/tenants" class="btn btn-gray" style="font-size:12px">Ver todas →</a>
            </div>
            <table>
              <thead><tr><th>Barbearia</th><th>Plano</th><th>Status</th><th>Cadastro</th><th></th></tr></thead>
              <tbody>${recent || '<tr><td colspan="5"><div class="empty"><div class="empty-icon">🏪</div><div>Nenhuma barbearia ainda.</div></div></td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `));
    } catch (e) {
      console.error("[BO Dashboard]", e);
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--error);margin-top:40px">Erro ao carregar dashboard.</p></div>`));
    }
  });

  // ── GET /superadmin/tenants ────────────────────────────────────────────────
  app.get("/superadmin/tenants", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const filterStatus = (req.query.status as string) ?? "all";
    const filterPlan = (req.query.plan as string) ?? "all";
    const searchTenant = ((req.query.search as string) ?? "").trim().toLowerCase();
    try {
      let allTenants = await db.getAllTenants();
      if (filterStatus !== "all") allTenants = allTenants.filter((t) => t.status === filterStatus);
      if (filterPlan !== "all") allTenants = allTenants.filter((t) => t.plan === filterPlan);
      if (searchTenant) allTenants = allTenants.filter((t) =>
        t.name.toLowerCase().includes(searchTenant) ||
        t.slug.toLowerCase().includes(searchTenant)
      );

      const rows = allTenants.map((t) => `
        <tr>
          <td>
            <div style="font-weight:600">${esc(t.name)}</div>
            <div class="text-sm text-mono">${esc(t.slug)}</div>
          </td>
          <td>${planLabel(t.plan)}</td>
          <td>${statusBadge(t.status)}</td>
          <td>${t.status === "trial" ? trialDaysLeft(t.trialEndsAt) : "—"}</td>
          <td style="color:var(--muted)">${new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
          <td>
            ${session.role !== "suporte" ? `
            <div class="actions">
              ${t.status !== "active" ? `<a href="/superadmin/tenants/action?id=${t.id}&action=activate" class="btn btn-green" onclick="return confirm('Ativar ${esc(t.name)}?')">Ativar</a>` : ""}
              ${t.status !== "suspended" ? `<a href="/superadmin/tenants/action?id=${t.id}&action=suspend" class="btn btn-red" onclick="return confirm('Suspender ${esc(t.name)}?')">Suspender</a>` : ""}
              <button class="btn btn-gold" onclick="openPlanModal(${t.id}, '${esc(t.plan)}')">Plano</button>
            </div>` : "—"}
          </td>
        </tr>
      `).join("");

      const filters = ["all", "active", "trial", "suspended", "cancelled"];
      const filterLabels: Record<string, string> = { all: "Todos", active: "Ativos", trial: "Trial", suspended: "Suspensos", cancelled: "Cancelados" };
      const planFilters = ["all", "solo", "team", "studio"];
      const planFilterLabels: Record<string, string> = { all: "Todos os planos", solo: "Solo", team: "Equipe", studio: "Estúdio" };

      res.send(layout("Barbearias", session, `
        <div class="container">
          <div class="page-header">
            <div class="page-title">Barbearias Cadastradas</div>
            <div class="page-sub">${allTenants.length} resultado${allTenants.length !== 1 ? "s" : ""}</div>
          </div>

          <form method="GET" action="/superadmin/tenants" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
            <div style="flex:1;min-width:200px">
              <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">BUSCAR</label>
              <input name="search" value="${esc(searchTenant)}" placeholder="Nome ou slug da barbearia..." style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px" />
            </div>
            <div>
              <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">PLANO</label>
              <select name="plan" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px">
                ${planFilters.map((p) => `<option value="${p}" ${filterPlan === p ? "selected" : ""}>${planFilterLabels[p]}</option>`).join("")}
              </select>
            </div>
            <input type="hidden" name="status" value="${esc(filterStatus)}" />
            <button type="submit" class="btn btn-gold">Filtrar</button>
            <a href="/superadmin/tenants" class="btn btn-gray">Limpar</a>
          </form>

          <div class="filters">
            ${filters.map((f) => `<a href="/superadmin/tenants?status=${f}&plan=${filterPlan}&search=${encodeURIComponent(searchTenant)}" class="filter-btn ${filterStatus === f ? "active" : ""}">${filterLabels[f]}</a>`).join("")}
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>Barbearia</th><th>Plano</th><th>Status</th><th>Trial</th><th>Cadastro</th><th>Ações</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="6"><div class="empty"><div class="empty-icon">🏪</div><div>Nenhuma barbearia encontrada.</div></div></td></tr>'}</tbody>
            </table>
          </div>
        </div>

        <div class="modal-overlay" id="plan-modal">
          <div class="modal">
            <h3>Alterar Plano</h3>
            <form method="GET" action="/superadmin/tenants/action">
              <input type="hidden" name="action" value="change-plan" />
              <input type="hidden" name="id" id="plan-tenant-id" value="" />
              <div class="form-group">
                <label>Novo plano</label>
                <select name="plan" id="plan-select">
                  <option value="solo">Solo — R$49/mês</option>
                  <option value="team">Equipe — R$89/mês</option>
                  <option value="studio">Estúdio — R$149/mês</option>
                </select>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn btn-gray" onclick="closeModal('plan-modal')">Cancelar</button>
                <button type="submit" class="btn btn-gold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      `));
    } catch (e) {
      console.error("[BO Tenants]", e);
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--error);margin-top:40px">Erro ao carregar barbearias.</p></div>`));
    }
  });

  // ── GET /superadmin/tenants/action ─────────────────────────────────────────
  app.get("/superadmin/tenants/action", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
    const { id, action, plan } = req.query as { id: string; action: string; plan?: string };
    const tenantId = parseInt(id);
    if (isNaN(tenantId)) return res.redirect("/superadmin/tenants");
    try {
      if (action === "activate") await db.updateTenant(tenantId, { status: "active" });
      else if (action === "suspend") await db.updateTenant(tenantId, { status: "suspended" });
      else if (action === "change-plan" && plan) await db.updateTenant(tenantId, { plan: plan as "solo" | "team" | "studio" });
    } catch (e) { console.error("[BO Tenant Action]", e); }
    res.redirect("/superadmin/tenants");
  });

  // ── GET /superadmin/erros ──────────────────────────────────────────────────
  app.get("/superadmin/erros", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const searchErr = ((req.query.search as string) ?? "").trim();
    const errSource = (req.query.source as string) ?? "all";
    const errDateFrom = (req.query.dateFrom as string) ?? "";
    const errDateTo = (req.query.dateTo as string) ?? "";
    try {
      let logs = await db.getErrorLogs(500);

      // Filtros em memória
      if (searchErr) {
        const q = searchErr.toLowerCase();
        logs = logs.filter((l: any) =>
          (l.message ?? "").toLowerCase().includes(q) ||
          (l.url ?? "").toLowerCase().includes(q)
        );
      }
      if (errSource !== "all") logs = logs.filter((l: any) => (l.source ?? "browser") === errSource);
      if (errDateFrom) {
        const from = new Date(errDateFrom + "T00:00:00");
        logs = logs.filter((l: any) => new Date(l.createdAt) >= from);
      }
      if (errDateTo) {
        const to = new Date(errDateTo + "T23:59:59");
        logs = logs.filter((l: any) => new Date(l.createdAt) <= to);
      }

      const rows = logs.map((l: any) => `
        <tr>
          <td style="white-space:nowrap;color:var(--muted)">${new Date(l.createdAt).toLocaleString("pt-BR")}</td>
          <td><span class="badge" style="background:var(--surface2);color:var(--muted)">${esc(l.source ?? "browser")}</span></td>
          <td>
            <div style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.message)}</div>
            ${l.stack ? `<div class="stack-box">${esc(l.stack)}</div>` : ""}
          </td>
          <td class="text-sm text-mono" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(l.url ?? "—")}</td>
          <td style="color:var(--muted)">${l.tenantId ?? "—"}</td>
        </tr>
      `).join("");

      const filterBar = `
        <form method="GET" action="/superadmin/erros" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px">
          <div style="flex:1;min-width:200px">
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">BUSCAR</label>
            <input name="search" value="${esc(searchErr)}" placeholder="Mensagem ou URL..." style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">ORIGEM</label>
            <select name="source" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px">
              <option value="all" ${errSource === "all" ? "selected" : ""}>Todas</option>
              <option value="browser" ${errSource === "browser" ? "selected" : ""}>Browser</option>
              <option value="server" ${errSource === "server" ? "selected" : ""}>Servidor</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">DE</label>
            <input type="date" name="dateFrom" value="${esc(errDateFrom)}" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">ATÉ</label>
            <input type="date" name="dateTo" value="${esc(errDateTo)}" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px" />
          </div>
          <button type="submit" class="btn btn-gold">Filtrar</button>
          <a href="/superadmin/erros" class="btn btn-gray">Limpar</a>
        </form>
      `;

      res.send(layout("Erros", session, `
        <div class="container">
          <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div class="page-title">Log de Erros</div>
              <div class="page-sub">${logs.length} resultado${logs.length !== 1 ? "s" : ""}</div>
            </div>
            ${session.role === "super_admin" ? `<a href="/superadmin/erros/clear" class="btn btn-red" onclick="return confirm('Limpar erros com mais de 30 dias?')">Limpar antigos</a>` : ""}
          </div>
          ${filterBar}
          <div class="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Origem</th><th>Mensagem</th><th>URL</th><th>Tenant</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="5"><div class="empty"><div class="empty-icon">✅</div><div>Nenhum erro encontrado.</div></div></td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `));
    } catch (e) {
      console.error("[BO Erros]", e);
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--error);margin-top:40px">Erro ao carregar logs.</p></div>`));
    }
  });

  app.get("/superadmin/erros/clear", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    try { await db.clearErrorLogs(); } catch (e) { console.error("[BO Clear Errors]", e); }
    res.redirect("/superadmin/erros");
  });

  // ── GET /superadmin/leads ──────────────────────────────────────────────────
  app.get("/superadmin/leads", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const search = (req.query.search as string ?? "").trim();
    const dateFrom = (req.query.dateFrom as string ?? "");
    const dateTo = (req.query.dateTo as string ?? "");
    const exportCsv = req.query.export === "csv";
    try {
      const dbConn = await db.getDb();
      let leads: any[] = [];
      if (dbConn) {
        try {
          const { orbitLeads: orbitLeadsTable } = await import("../drizzle/schema");
          const { desc } = await import('drizzle-orm');
          leads = await dbConn.select().from(orbitLeadsTable).orderBy(desc(orbitLeadsTable.loginAt)).limit(500);
        } catch { /* tabela pode não existir */ }
      }

      // Filtros em memória
      if (search) {
        const q = search.toLowerCase();
        leads = leads.filter((l: any) =>
          (l.name ?? "").toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").includes(q)
        );
      }
      if (dateFrom) {
        const from = new Date(dateFrom + "T00:00:00");
        leads = leads.filter((l: any) => new Date(l.createdAt) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo + "T23:59:59");
        leads = leads.filter((l: any) => new Date(l.createdAt) <= to);
      }

      // Exportar CSV
      if (exportCsv) {
        const csvLines = ["Nome,E-mail,WhatsApp,Data"];
        for (const l of leads) {
          const row = [
            `"${(l.name ?? "").replace(/"/g, '""')}"`,
            `"${(l.email ?? "").replace(/"/g, '""')}"`,
            `"${(l.phone ?? "").replace(/"/g, '""')}"`,
            `"${new Date(l.createdAt).toLocaleString("pt-BR")}"`,
          ].join(",");
          csvLines.push(row);
        }
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="leads-${new Date().toISOString().slice(0,10)}.csv"`);
        return res.send("\uFEFF" + csvLines.join("\n"));
      }

      const tableRows = leads.map((l: any) => `
        <tr>
          <td style="font-weight:600">${esc(l.name ?? "—")}</td>
          <td>${esc(l.email ?? "—")}</td>
          <td>${esc(l.phone ?? "—")}</td>
          <td style="color:var(--muted)">${new Date(l.createdAt).toLocaleString("pt-BR")}</td>
        </tr>
      `).join("");

      const filterBar = `
        <form method="GET" action="/superadmin/leads" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px">
          <div style="flex:1;min-width:180px">
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">BUSCAR</label>
            <input name="search" value="${esc(search)}" placeholder="Nome, e-mail ou telefone..." style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">DE</label>
            <input type="date" name="dateFrom" value="${esc(dateFrom)}" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">ATÉ</label>
            <input type="date" name="dateTo" value="${esc(dateTo)}" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--fg);font-size:13px" />
          </div>
          <button type="submit" class="btn btn-gold">Filtrar</button>
          <a href="/superadmin/leads" class="btn btn-gray">Limpar</a>
          <a href="/superadmin/leads?export=csv${search ? '&search=' + encodeURIComponent(search) : ''}${dateFrom ? '&dateFrom=' + dateFrom : ''}${dateTo ? '&dateTo=' + dateTo : ''}" class="btn btn-gray" style="margin-left:auto">↓ Exportar CSV</a>
        </form>
      `;

      res.send(layout("Leads", session, `
        <div class="container">
          <div class="page-header">
            <div class="page-title">Leads da Landing Page</div>
            <div class="page-sub">${leads.length} resultado${leads.length !== 1 ? "s" : ""} encontrado${leads.length !== 1 ? "s" : ""}</div>
          </div>
          ${filterBar}
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Data</th></tr></thead>
              <tbody>${tableRows || '<tr><td colspan="4"><div class="empty"><div class="empty-icon">📋</div><div>Nenhum lead encontrado.</div></div></td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `));
    } catch (e) {
      console.error("[BO Leads]", e);
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--error);margin-top:40px">Erro ao carregar leads.</p></div>`));
    }
  });

  // ── GET /superadmin/usuarios ───────────────────────────────────────────────
  app.get("/superadmin/usuarios", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const saved = req.query.saved ? '<div class="alert alert-success">Alterações salvas com sucesso.</div>' : "";
    const error = req.query.error ? `<div class="alert alert-error">${esc(req.query.error as string)}</div>` : "";
    try {
      const users = await getAllBoUsers();
      const rows = users.map((u: any) => `
        <tr>
          <td><div style="font-weight:600">${esc(u.name)}</div><div class="text-sm">${esc(u.email)}</div></td>
          <td>${roleBadge(u.role)}</td>
          <td>${u.isActive ? '<span class="badge badge-active">Ativo</span>' : '<span class="badge badge-suspended">Inativo</span>'}</td>
          <td style="color:var(--muted)">${new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
          <td>
            ${u.email !== session.email ? `
            <div class="actions">
              <button class="btn btn-gold" onclick="openUserModal(${u.id}, '${esc(u.name)}', '${esc(u.email)}', '${esc(u.role)}', ${u.isActive ? 1 : 0})">Editar</button>
              <a href="/superadmin/usuarios/toggle?id=${u.id}&active=${u.isActive ? 0 : 1}" class="btn ${u.isActive ? "btn-red" : "btn-green"}" onclick="return confirm('${u.isActive ? "Desativar" : "Ativar"} este usuário?')">${u.isActive ? "Desativar" : "Ativar"}</a>
            </div>` : '<span style="color:var(--muted);font-size:12px">Você</span>'}
          </td>
        </tr>
      `).join("");

      res.send(layout("Usuários", session, `
        <div class="container">
          <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div class="page-title">Usuários do Backoffice</div>
              <div class="page-sub">${users.length} usuário${users.length !== 1 ? "s" : ""} cadastrado${users.length !== 1 ? "s" : ""}</div>
            </div>
            <button class="btn btn-primary" onclick="openModal('new-user-modal')">+ Novo Usuário</button>
          </div>
          ${saved}${error}
          <div class="table-wrap">
            <table>
              <thead><tr><th>Usuário</th><th>Role</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="5"><div class="empty"><div class="empty-icon">👤</div><div>Nenhum usuário.</div></div></td></tr>'}</tbody>
            </table>
          </div>
        </div>

        <!-- Modal: Novo Usuário -->
        <div class="modal-overlay" id="new-user-modal">
          <div class="modal">
            <h3>Novo Usuário do Backoffice</h3>
            <form method="POST" action="/superadmin/usuarios/novo">
              <div class="form-group"><label>Nome</label><input type="text" name="name" required /></div>
              <div class="form-group"><label>E-mail</label><input type="email" name="email" required /></div>
              <div class="form-group"><label>Senha</label><input type="password" name="password" minlength="6" required /></div>
              <div class="form-group">
                <label>Role</label>
                <select name="role">
                  <option value="suporte">Suporte — só visualização</option>
                  <option value="admin">Admin — gerenciar tenants e leads</option>
                  <option value="super_admin">Super Admin — acesso total</option>
                </select>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn btn-gray" onclick="closeModal('new-user-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Modal: Editar Usuário -->
        <div class="modal-overlay" id="edit-user-modal">
          <div class="modal">
            <h3>Editar Usuário</h3>
            <form method="POST" action="/superadmin/usuarios/editar">
              <input type="hidden" name="id" id="edit-user-id" />
              <div class="form-group"><label>Nome</label><input type="text" name="name" id="edit-user-name" required /></div>
              <div class="form-group"><label>E-mail</label><input type="email" name="email" id="edit-user-email" required /></div>
              <div class="form-group"><label>Nova Senha (deixe em branco para não alterar)</label><input type="password" name="password" minlength="6" /></div>
              <div class="form-group">
                <label>Role</label>
                <select name="role" id="edit-user-role">
                  <option value="suporte">Suporte</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <input type="hidden" name="isActive" id="edit-user-active" value="1" />
              <div class="modal-actions">
                <button type="button" class="btn btn-gray" onclick="closeModal('edit-user-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      `));
    } catch (e) {
      console.error("[BO Usuarios]", e);
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--error);margin-top:40px">Erro ao carregar usuários.</p></div>`));
    }
  });

  app.post("/superadmin/usuarios/novo", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const { name, email, password, role } = req.body as { name: string; email: string; password: string; role: BORoleType };
    try {
      if (!name || !email || !password) return res.redirect("/superadmin/usuarios?error=Preencha+todos+os+campos");
      if (password.length < 6) return res.redirect("/superadmin/usuarios?error=Senha+deve+ter+m%C3%ADnimo+6+caracteres");
      const hash = await bcrypt.hash(password, 10);
      await createBoUser(name.trim(), email.toLowerCase().trim(), hash, role ?? "suporte");
      res.redirect("/superadmin/usuarios?saved=1");
    } catch (e: any) {
      const msg = e.message?.includes("Duplicate") ? "E-mail+j%C3%A1+cadastrado" : encodeURIComponent(e.message ?? "Erro");
      res.redirect(`/superadmin/usuarios?error=${msg}`);
    }
  });

  app.post("/superadmin/usuarios/editar", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const { id, name, email, password, role } = req.body as { id: string; name: string; email: string; password: string; role: string };
    try {
      const userId = parseInt(id);
      if (isNaN(userId)) return res.redirect("/superadmin/usuarios?error=ID+inv%C3%A1lido");
      const data: any = { name: name.trim(), email: email.toLowerCase().trim(), role };
      if (password && password.length >= 6) data.passwordHash = await bcrypt.hash(password, 10);
      await updateBoUser(userId, data);
      res.redirect("/superadmin/usuarios?saved=1");
    } catch (e: any) {
      res.redirect(`/superadmin/usuarios?error=${encodeURIComponent(e.message ?? "Erro")}`);
    }
  });

  app.get("/superadmin/usuarios/toggle", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const { id, active } = req.query as { id: string; active: string };
    const session = (req as any).boSession as BOSession;
    try {
      const userId = parseInt(id);
      if (!isNaN(userId)) {
        const users = await getAllBoUsers();
        const target = users.find((u: any) => u.id === userId);
        if (target && target.email !== session.email) {
          await updateBoUser(userId, { isActive: active === "1" });
        }
      }
    } catch (e) { console.error("[BO Toggle User]", e); }
    res.redirect("/superadmin/usuarios");
  });

  // ── GET /superadmin/cms ────────────────────────────────────────────────────
  app.get("/superadmin/cms", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const saved = req.query.saved ? '<div class="alert alert-success">Alterações salvas! Faça deploy para aplicar na landing page.</div>' : "";
    res.send(layout("CMS — Landing Page", session, `
      <div class="container">
        <div class="page-header">
          <div class="page-title">CMS da Landing Page</div>
          <div class="page-sub">Gerencie os conteúdos exibidos em usebarberpro.com</div>
        </div>
        ${saved}

        <div class="cms-card">
          <h3>📝 Textos Principais</h3>
          <form method="POST" action="/superadmin/cms/textos">
            <div class="cms-grid">
              <div class="form-group"><label>Headline Principal</label><input type="text" name="headline" placeholder="Chega de agenda bagunçada..." /></div>
              <div class="form-group"><label>Subtítulo</label><input type="text" name="subtitle" placeholder="O sistema completo para barbearias..." /></div>
              <div class="form-group"><label>Texto do CTA Principal</label><input type="text" name="cta_text" placeholder="Começar Gratuitamente" /></div>
              <div class="form-group"><label>Texto do CTA Secundário</label><input type="text" name="cta2_text" placeholder="Ver como funciona" /></div>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:8px">Salvar Textos</button>
          </form>
        </div>

        <div class="cms-card">
          <h3>⭐ Depoimentos</h3>
          <form method="POST" action="/superadmin/cms/depoimento">
            <div class="cms-grid">
              <div class="form-group"><label>Nome do Cliente</label><input type="text" name="name" placeholder="João Silva" required /></div>
              <div class="form-group"><label>Barbearia</label><input type="text" name="shop" placeholder="Barbearia do João" required /></div>
              <div class="form-group" style="grid-column:1/-1"><label>Depoimento</label><textarea name="text" placeholder="O sistema transformou minha barbearia..." required></textarea></div>
              <div class="form-group"><label>Nota (1-5)</label>
                <select name="rating"><option value="5">⭐⭐⭐⭐⭐ 5 estrelas</option><option value="4">⭐⭐⭐⭐ 4 estrelas</option><option value="3">⭐⭐⭐ 3 estrelas</option></select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:8px">Adicionar Depoimento</button>
          </form>

          <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
            <div style="font-size:12px;color:var(--muted);margin-bottom:12px">DEPOIMENTOS SALVOS NO BANCO</div>
            <div id="depoimentos-list" style="color:var(--muted);font-size:13px">
              Os depoimentos salvos aparecerão aqui. Esta funcionalidade requer integração com a tabela <code>landing_testimonials</code> no banco.
            </div>
          </div>
        </div>

        <div class="cms-card">
          <h3>💰 Planos Exibidos na Landing Page</h3>
          <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Os planos abaixo são exibidos na seção de preços da landing page. Edite os valores e salve para atualizar.</p>
          <form method="POST" action="/superadmin/cms/planos">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">
              ${[
                { key: "solo", label: "Solo", price: "49", desc: "1 barbeiro, agendamento online, financeiro básico" },
                { key: "team", label: "Equipe", price: "89", desc: "Até 5 barbeiros, relatórios avançados, fidelidade" },
                { key: "studio", label: "Estúdio", price: "149", desc: "Ilimitado, multi-unidade, suporte prioritário" },
              ].map((p) => `
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px">
                  <div style="font-weight:700;margin-bottom:10px;color:var(--gold)">${p.label}</div>
                  <div class="form-group"><label>Preço (R$)</label><input type="number" name="price_${p.key}" value="${p.price}" /></div>
                  <div class="form-group"><label>Descrição</label><input type="text" name="desc_${p.key}" value="${p.desc}" /></div>
                </div>
              `).join("")}
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:16px">Salvar Planos</button>
          </form>
        </div>
      </div>
    `));
  });

  // POST handlers do CMS (salvam no banco futuramente; por ora redirecionam com aviso)
  app.post("/superadmin/cms/textos", requireAuth, requireRole("super_admin"), (_req: Request, res: Response) => {
    res.redirect("/superadmin/cms?saved=1");
  });
  app.post("/superadmin/cms/depoimento", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const { name, shop, text, rating } = req.body as { name: string; shop: string; text: string; rating: string };
    try {
      const dbConn = await db.getDb();
      if (dbConn) {
        const { sql: sqlTag } = await import('drizzle-orm');
        await dbConn.execute(sqlTag`CREATE TABLE IF NOT EXISTS landing_testimonials (id SERIAL PRIMARY KEY, name VARCHAR(100), shop VARCHAR(100), text TEXT, rating INT DEFAULT 5, "isActive" BOOLEAN DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT NOW())`);
        await dbConn.execute(sqlTag`INSERT INTO landing_testimonials (name, shop, text, rating) VALUES (${name}, ${shop}, ${text}, ${parseInt(rating) || 5})`);
      }
    } catch (e) { console.error("[BO CMS Depoimento]", e); }
    res.redirect("/superadmin/cms?saved=1");
  });
  app.post("/superadmin/cms/planos", requireAuth, requireRole("super_admin"), (_req: Request, res: Response) => {
    res.redirect("/superadmin/cms?saved=1");
  });
}
