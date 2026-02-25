/**
 * Barber Pro — Backoffice Super-Admin
 *
 * Rotas protegidas por senha acessíveis em /superadmin.
 * Apenas o criador da plataforma deve ter acesso.
 *
 * Autenticação: cookie de sessão simples (não OAuth).
 */

import type { Express, Request, Response, NextFunction } from "express";
import { ENV } from "./_core/env";
import * as db from "./db";

// ─── Cookie de sessão ─────────────────────────────────────────────────────────
const SESSION_COOKIE = "sa_session";
const SESSION_VALUE = "authenticated";

function isAuthenticated(req: Request): boolean {
  const raw = req.headers.cookie ?? "";
  return raw.split(";").some((c) => {
    const [k, v] = c.trim().split("=");
    return k === SESSION_COOKIE && v === SESSION_VALUE;
  });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthenticated(req)) return next();
  res.redirect("/superadmin/login");
}

// ─── Helpers de HTML ──────────────────────────────────────────────────────────
function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Barber Pro Super-Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold: #C9A84C;
      --gold-dim: #C9A84C33;
      --bg: #0A0A0A;
      --surface: #141414;
      --surface2: #1E1E1E;
      --border: #2A2A2A;
      --text: #F0EEE8;
      --muted: #888880;
      --success: #4ADE80;
      --warning: #FBBF24;
      --error: #F87171;
      --info: #60A5FA;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
    a { color: var(--gold); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Nav */
    .nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 32px; display: flex; align-items: center; gap: 24px; height: 56px; }
    .nav-brand { font-size: 15px; font-weight: 800; color: var(--gold); letter-spacing: 2px; }
    .nav-brand span { color: var(--muted); font-weight: 400; letter-spacing: 0; }
    .nav-links { display: flex; gap: 20px; margin-left: auto; }
    .nav-links a { font-size: 13px; color: var(--muted); }
    .nav-links a:hover { color: var(--text); text-decoration: none; }

    /* Layout */
    .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
    .page-title { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
    .page-sub { font-size: 13px; color: var(--muted); margin-bottom: 32px; }

    /* Cards de métricas */
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
    .metric-label { font-size: 11px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
    .metric-value { font-size: 32px; font-weight: 900; color: var(--gold); }
    .metric-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

    /* Tabela */
    .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
    .table-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .table-header h2 { font-size: 16px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px 24px; font-size: 11px; color: var(--muted); letter-spacing: 1.2px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
    td { padding: 14px 24px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface2); }

    /* Badges de status */
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
    .badge-active { background: #4ADE8022; color: #4ADE80; }
    .badge-trial { background: #FBBF2422; color: #FBBF24; }
    .badge-suspended { background: #F8717122; color: #F87171; }
    .badge-cancelled { background: #44444422; color: #888; }

    /* Badges de plano */
    .plan-solo { color: var(--muted); }
    .plan-team { color: var(--gold); }
    .plan-studio { color: #C084FC; }

    /* Botões de ação */
    .btn { display: inline-block; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; }
    .btn:hover { text-decoration: none; opacity: 0.85; }
    .btn-activate { background: #4ADE8022; color: #4ADE80; border: 1px solid #4ADE8044; }
    .btn-suspend { background: #F8717122; color: #F87171; border: 1px solid #F8717144; }
    .btn-plan { background: var(--gold-dim); color: var(--gold); border: 1px solid #C9A84C44; }
    .btn-danger { background: #F8717122; color: #F87171; border: 1px solid #F8717144; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }

    /* Formulário de login */
    .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 40px; width: 100%; max-width: 380px; }
    .login-logo { font-size: 22px; font-weight: 900; color: var(--gold); letter-spacing: 3px; text-align: center; margin-bottom: 4px; }
    .login-sub { font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 32px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    input[type=password], input[type=text] {
      width: 100%; padding: 12px 14px; background: var(--bg); border: 1px solid var(--border);
      border-radius: 10px; color: var(--text); font-size: 14px; outline: none;
    }
    input:focus { border-color: var(--gold); }
    .btn-submit { width: 100%; padding: 13px; background: var(--gold); color: #0A0A0A; font-size: 15px; font-weight: 800; border: none; border-radius: 12px; cursor: pointer; margin-top: 8px; }
    .btn-submit:hover { opacity: 0.9; }
    .error-msg { background: #F8717122; border: 1px solid #F8717144; color: #F87171; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }

    /* Filtros */
    .filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-btn { padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--muted); text-decoration: none; }
    .filter-btn:hover { text-decoration: none; border-color: var(--gold); color: var(--gold); }
    .filter-btn.active { background: var(--gold-dim); border-color: var(--gold); color: var(--gold); }

    /* Modal de alteração de plano */
    .modal-overlay { display: none; position: fixed; inset: 0; background: #00000088; z-index: 100; align-items: center; justify-content: center; }
    .modal-overlay.open { display: flex; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 32px; width: 100%; max-width: 420px; }
    .modal h3 { font-size: 18px; font-weight: 800; margin-bottom: 16px; }
    select { width: 100%; padding: 11px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 14px; margin-bottom: 16px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-cancel-modal { padding: 9px 20px; border-radius: 10px; background: var(--surface2); color: var(--muted); border: 1px solid var(--border); cursor: pointer; font-size: 13px; }

    /* Empty state */
    .empty { text-align: center; padding: 60px 24px; color: var(--muted); }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }

    /* Responsive */
    @media (max-width: 768px) {
      .container { padding: 20px 16px; }
      th, td { padding: 10px 14px; }
      .metrics { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  ${body}
  <script>
    function openPlanModal(tenantId, currentPlan) {
      document.getElementById('plan-tenant-id').value = tenantId;
      document.getElementById('plan-select').value = currentPlan;
      document.getElementById('plan-modal').classList.add('open');
    }
    function closePlanModal() {
      document.getElementById('plan-modal').classList.remove('open');
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
  return map[status] ?? `<span class="badge">${status}</span>`;
}

function planLabel(plan: string): string {
  const map: Record<string, string> = {
    solo: '<span class="plan-solo">Solo — R$49</span>',
    team: '<span class="plan-team">Equipe — R$89</span>',
    studio: '<span class="plan-studio">Estúdio — R$149</span>',
  };
  return map[plan] ?? plan;
}

function trialDaysLeft(trialEndsAt: Date | null): string {
  if (!trialEndsAt) return "—";
  const now = new Date();
  const diff = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return '<span style="color:#F87171">Expirado</span>';
  if (diff === 0) return '<span style="color:#FBBF24">Hoje</span>';
  return `<span style="color:#FBBF24">${diff}d</span>`;
}

// ─── Registro das rotas ───────────────────────────────────────────────────────
export function registerSuperAdminRoutes(app: Express): void {
  // ── GET /superadmin/login ──────────────────────────────────────────────────
  app.get("/superadmin/login", (req: Request, res: Response) => {
    if (isAuthenticated(req)) return res.redirect("/superadmin");
    const error = req.query.error ? '<div class="error-msg">Senha incorreta. Tente novamente.</div>' : "";
    res.send(layout("Login", `
      <div class="login-wrap">
        <div class="login-card">
          <div class="login-logo">BARBER PRO</div>
          <div class="login-sub">Painel Super-Admin · Acesso restrito</div>
          ${error}
          <form method="POST" action="/superadmin/login">
            <div class="form-group">
              <label>Senha de acesso</label>
              <input type="password" name="password" placeholder="••••••••••" autofocus required />
            </div>
            <button type="submit" class="btn-submit">ENTRAR</button>
          </form>
        </div>
      </div>
    `));
  });

  // ── POST /superadmin/login ─────────────────────────────────────────────────
  app.post("/superadmin/login", (req: Request, res: Response) => {
    const { password } = req.body as { password: string };
    if (password === ENV.superadminPassword) {
      res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/superadmin; HttpOnly; SameSite=Lax; Max-Age=86400`);
      return res.redirect("/superadmin");
    }
    res.redirect("/superadmin/login?error=1");
  });

  // ── GET /superadmin/logout ─────────────────────────────────────────────────
  app.get("/superadmin/logout", (_req: Request, res: Response) => {
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/superadmin; HttpOnly; Max-Age=0`);
    res.redirect("/superadmin/login");
  });

  // ── GET /superadmin (dashboard principal) ─────────────────────────────────
  app.get("/superadmin", requireAuth, async (_req: Request, res: Response) => {
    try {
      const allTenants = await db.getAllTenants();

      // Métricas
      const total = allTenants.length;
      const active = allTenants.filter((t) => t.status === "active").length;
      const trial = allTenants.filter((t) => t.status === "trial").length;
      const suspended = allTenants.filter((t) => t.status === "suspended").length;
      const mrr = allTenants
        .filter((t) => t.status === "active")
        .reduce((sum, t) => sum + (t.plan === "solo" ? 49 : t.plan === "team" ? 89 : 149), 0);

      const rows = allTenants.map((t) => `
        <tr>
          <td>
            <div style="font-weight:700">${escapeHtml(t.name)}</div>
            <div style="font-size:11px;color:var(--muted)">${escapeHtml(t.slug)}.barberpro.com.br</div>
          </td>
          <td>${planLabel(t.plan)}</td>
          <td>${statusBadge(t.status)}</td>
          <td>${t.status === "trial" ? trialDaysLeft(t.trialEndsAt) : "—"}</td>
          <td style="font-size:11px;color:var(--muted)">${new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
          <td>
            <div class="actions">
              ${t.status !== "active" ? `<a href="/superadmin/action?id=${t.id}&action=activate" class="btn btn-activate" onclick="return confirm('Ativar ${escapeHtml(t.name)}?')">Ativar</a>` : ""}
              ${t.status !== "suspended" ? `<a href="/superadmin/action?id=${t.id}&action=suspend" class="btn btn-suspend" onclick="return confirm('Suspender ${escapeHtml(t.name)}?')">Suspender</a>` : ""}
              <button class="btn btn-plan" onclick="openPlanModal(${t.id}, '${t.plan}')">Plano</button>
            </div>
          </td>
        </tr>
      `).join("");

      const emptyState = total === 0 ? `
        <tr><td colspan="6">
          <div class="empty">
            <div class="empty-icon">🏪</div>
            <div>Nenhuma barbearia cadastrada ainda.</div>
          </div>
        </td></tr>
      ` : "";

      res.send(layout("Dashboard", `
        <nav class="nav">
          <span class="nav-brand">BARBER PRO <span>/ Super-Admin</span></span>
          <div class="nav-links">
            <a href="/superadmin">Dashboard</a>
            <a href="/superadmin/logout">Sair</a>
          </div>
        </nav>
        <div class="container">
          <div class="page-title">Dashboard da Plataforma</div>
          <div class="page-sub">Visão geral de todos os tenants cadastrados no Barber Pro</div>

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
          </div>

          <div class="table-wrap">
            <div class="table-header">
              <h2>Barbearias Cadastradas</h2>
              <span style="font-size:12px;color:var(--muted)">${total} tenant${total !== 1 ? "s" : ""}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Barbearia</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Trial</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${rows || emptyState}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal de alteração de plano -->
        <div class="modal-overlay" id="plan-modal">
          <div class="modal">
            <h3>Alterar Plano</h3>
            <form method="GET" action="/superadmin/action">
              <input type="hidden" name="action" value="change-plan" />
              <input type="hidden" name="id" id="plan-tenant-id" value="" />
              <label>Novo plano</label>
              <select name="plan" id="plan-select">
                <option value="solo">Solo — R$49/mês</option>
                <option value="team">Equipe — R$89/mês</option>
                <option value="studio">Estúdio — R$149/mês</option>
              </select>
              <div class="modal-actions">
                <button type="button" class="btn-cancel-modal" onclick="closePlanModal()">Cancelar</button>
                <button type="submit" class="btn btn-plan" style="padding:9px 20px;font-size:13px">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      `));
    } catch (err) {
      console.error("[SuperAdmin] Erro ao carregar dashboard:", err);
      res.status(500).send(layout("Erro", `<div class="container"><p style="color:var(--error);margin-top:40px">Erro ao conectar ao banco de dados. Verifique a conexão.</p></div>`));
    }
  });

  // ── GET /superadmin/action (ações de gerenciamento) ────────────────────────
  app.get("/superadmin/action", requireAuth, async (req: Request, res: Response) => {
    const { id, action, plan } = req.query as { id: string; action: string; plan?: string };
    const tenantId = parseInt(id);
    if (isNaN(tenantId)) return res.redirect("/superadmin");

    try {
      if (action === "activate") {
        await db.updateTenant(tenantId, { status: "active" });
      } else if (action === "suspend") {
        await db.updateTenant(tenantId, { status: "suspended" });
      } else if (action === "change-plan" && plan) {
        await db.updateTenant(tenantId, { plan: plan as "solo" | "team" | "studio" });
      }
    } catch (err) {
      console.error("[SuperAdmin] Erro ao executar ação:", err);
    }

    res.redirect("/superadmin");
  });
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
