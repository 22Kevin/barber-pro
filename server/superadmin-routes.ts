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
import * as bcrypt from "bcryptjs";
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
            <a href="/superadmin" style="display:inline-block;margin-top:20px;padding:10px 24px;background:var(--gold-500);color:#0A0A0A;border-radius:10px;font-weight:700;text-decoration:none">Voltar ao Dashboard</a>
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

function layout(title: string, session: BOSession | null, body: string, extraHead = ""): string {
  if (!session) {
    return `<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>${esc(title)} — Barber Pro BO</title>
        <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:       #0a0a0a;
      --surface:  #131313;
      --surface2: #1a1a1a;
      --surface3: #222222;
      --border:   #272727;
      --border2:  #333333;
      --text:     #f0eeea;
      --text2:    #a09e99;
      --muted:    #5c5a57;
      --gold:     #c9a84c;
      --gold2:    #dbb84a;
      --gold-bg:  rgba(201,168,76,.10);
      --gold-bd:  rgba(201,168,76,.22);
      --green:    #22c55e; --green-bg: rgba(34,197,94,.10);
      --red:      #ef4444; --red-bg:   rgba(239,68,68,.10);
      --blue:     #3b82f6; --blue-bg:  rgba(59,130,246,.10);
      --amber:    #f59e0b; --amber-bg: rgba(245,158,11,.10);
      --purple:   #a855f7; --purple-bg:rgba(168,85,247,.10);
      --sidebar-w: 224px;
      --sidebar-w-sm: 60px;
      --topbar-h: 56px;
      --radius: 10px;
      --radius-lg: 14px;
    }
    html { height: 100%; }
    body { font-family: "Inter", -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; font-size: 13.5px; line-height: 1.55; }
    a { color: var(--gold); text-decoration: none; }
    a:hover { opacity: .8; }
    input, select, textarea, button { font-family: inherit; }
    ::selection { background: var(--gold-bg); color: var(--gold); }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

    /* ── Shell ──────────────────────────────────────────────────────── */
    .shell { display: flex; min-height: 100vh; }
    .content { flex: 1; min-width: 0; margin-left: var(--sidebar-w); display: flex; flex-direction: column; transition: margin-left .25s; }
    .shell.collapsed .content { margin-left: var(--sidebar-w-sm); }

    /* ── Sidebar ────────────────────────────────────────────────────── */
    .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0; width: var(--sidebar-w);
      background: var(--surface); border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      transition: width .25s, transform .25s;
      z-index: 60; overflow: hidden;
    }
    .shell.collapsed .sidebar { width: var(--sidebar-w-sm); }

    .sidebar-top { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; }

    .sidebar-logo {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 14px 14px; border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .logo-mark {
      width: 32px; height: 32px; border-radius: 9px;
      background: var(--gold-bg); border: 1px solid var(--gold-bd);
      display: flex; align-items: center; justify-content: center;
      color: var(--gold); flex-shrink: 0;
    }
    .logo-text { flex: 1; min-width: 0; overflow: hidden; }
    .logo-title { display: block; font-size: 11px; font-weight: 800; color: var(--gold); letter-spacing: 2px; white-space: nowrap; }
    .logo-sub   { display: block; font-size: 9px;  color: var(--muted); letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; margin-top: 1px; }
    .shell.collapsed .logo-text { display: none; }

    .sidebar-close-btn {
      display: none; background: none; border: none; color: var(--muted);
      cursor: pointer; padding: 4px; border-radius: 6px; transition: color .15s;
    }
    .sidebar-close-btn:hover { color: var(--text); }

    /* Collapse toggle */
    .sidebar-logo::after {
      content: "⇤";
      margin-left: auto; font-size: 12px; color: var(--muted);
      cursor: pointer; flex-shrink: 0; padding: 4px 6px;
      border-radius: 6px; transition: all .15s;
      display: block;
    }
    .sidebar-logo:hover::after { color: var(--text); background: var(--surface2); }
    .sidebar-logo { cursor: default; }
    .logo-mark, .logo-text { cursor: default; }

    /* Hack: clicking the ::after isn't possible — use a real button instead */
    .collapse-btn {
      margin-left: auto; background: none; border: none; color: var(--muted);
      cursor: pointer; padding: 4px 6px; border-radius: 6px;
      transition: all .15s; font-size: 14px; flex-shrink: 0;
    }
    .collapse-btn:hover { color: var(--text); background: var(--surface2); }
    .shell.collapsed .collapse-btn { transform: rotate(180deg); }

    /* Nav groups */
    .sidebar-nav { padding: 8px 0; }
    .nav-group { margin-bottom: 4px; }
    .nav-group-label {
      font-size: 9px; font-weight: 700; letter-spacing: 1.4px; color: var(--muted);
      text-transform: uppercase; padding: 10px 16px 4px; display: block;
      white-space: nowrap; overflow: hidden;
      transition: opacity .2s;
    }
    .shell.collapsed .nav-group-label { opacity: 0; height: 0; padding: 0; margin: 0; }

    .nav-item {
      display: flex; align-items: center; gap: 10px;
      margin: 1px 8px; padding: 7px 10px; border-radius: 8px;
      color: var(--text2); font-size: 13px; font-weight: 500;
      position: relative; transition: all .15s; white-space: nowrap;
      overflow: hidden;
    }
    .nav-item:hover { background: var(--surface2); color: var(--text); opacity: 1; }
    .nav-item.active {
      background: var(--gold-bg); color: var(--gold);
      font-weight: 600;
    }
    .nav-item.active::before {
      content: ''; position: absolute; left: 0; top: 20%; bottom: 20%;
      width: 3px; background: var(--gold); border-radius: 0 3px 3px 0;
    }
    .nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; font-style: normal; }
    .nav-label { flex: 1; }
    .shell.collapsed .nav-label { display: none; }
    .shell.collapsed .nav-item { justify-content: center; margin: 1px 6px; }
    .shell.collapsed .nav-item:hover::after {
      content: attr(data-tip);
      position: absolute; left: calc(100% + 10px); top: 50%;
      transform: translateY(-50%);
      background: var(--surface3); border: 1px solid var(--border2);
      color: var(--text); font-size: 12px; font-weight: 500;
      padding: 6px 12px; border-radius: 8px;
      white-space: nowrap; z-index: 100;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0,0,0,.4);
    }

    /* Sidebar user footer */
    .sidebar-user {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .user-avatar {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, var(--gold), var(--gold2));
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; color: #000;
    }
    .user-info { flex: 1; min-width: 0; overflow: hidden; }
    .user-name { display: block; font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { display: block; font-size: 10px; color: var(--gold); white-space: nowrap; }
    .user-logout {
      color: var(--muted); transition: color .15s;
      padding: 4px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
    }
    .user-logout:hover { color: var(--red); opacity: 1; }
    .shell.collapsed .user-info, .shell.collapsed .user-logout { display: none; }
    .shell.collapsed .sidebar-user { justify-content: center; padding: 12px 0; }
    .shell.collapsed .user-avatar { margin: 0 auto; }

    /* Mobile overlay */
    .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 59; }
    .overlay.visible { display: block; }

    /* ── Topbar ─────────────────────────────────────────────────────── */
    .topbar {
      height: var(--topbar-h); background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 12px;
      padding: 0 24px; position: sticky; top: 0; z-index: 40;
      flex-shrink: 0;
    }
    .hamburger {
      display: none; background: none; border: none;
      color: var(--text2); cursor: pointer; padding: 6px;
      border-radius: 8px; transition: all .15s;
    }
    .hamburger:hover { background: var(--surface2); color: var(--text); }
    .topbar-title { flex: 1; }
    .topbar-page { font-size: 15px; font-weight: 700; color: var(--text); }
    .topbar-right { display: flex; align-items: center; gap: 10px; }
    .topbar-search {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 8px; padding: 6px 12px;
      transition: border-color .15s;
    }
    .topbar-search:focus-within { border-color: var(--gold); }
    .topbar-search svg { color: var(--muted); flex-shrink: 0; }
    .topbar-search input {
      background: none; border: none; outline: none; color: var(--text);
      font-size: 12px; width: 160px;
    }
    .topbar-search input::placeholder { color: var(--muted); }
    .topbar-search kbd {
      font-size: 10px; color: var(--muted);
      background: var(--surface3); border: 1px solid var(--border2);
      border-radius: 4px; padding: 1px 5px;
    }
    .topbar-date { font-size: 12px; color: var(--muted); white-space: nowrap; }
    .topbar-logout {
      font-size: 12px; color: var(--muted); padding: 5px 10px;
      border-radius: 7px; border: 1px solid var(--border);
      transition: all .15s;
    }
    .topbar-logout:hover { color: var(--red); border-color: var(--red-bg); background: var(--red-bg); opacity: 1; }

    /* ── Page ───────────────────────────────────────────────────────── */
    .page-body { flex: 1; padding: 28px 28px 60px; }

    /* ── Cards & Tables ─────────────────────────────────────────────── */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px; }
    .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .card-title { font-size: 13.5px; font-weight: 700; }
    .card-sub { font-size: 12px; color: var(--muted); }
    .card-body { padding: 20px; }
    .table-wrap, .table-wrapper { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px; }
    .table-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .table-header h2, .card-title { font-size: 13.5px; font-weight: 700; }
    table, table.data-table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 20px; text-align: left; font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid var(--border); background: rgba(255,255,255,.02); white-space: nowrap; }
    td { padding: 13px 20px; font-size: 13px; color: var(--text2); border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr { transition: background .1s; }
    tr:hover td { background: rgba(255,255,255,.025); color: var(--text); }
    .table-name .name { font-weight: 600; color: var(--text); font-size: 13px; }
    .table-name .slug { font-size: 11px; color: var(--muted); font-family: monospace; margin-top: 1px; }

    /* ── KPI Grid ───────────────────────────────────────────────────── */
    .kpi-grid { display: grid; gap: 14px; margin-bottom: 22px; }
    .kpi-grid.g4 { grid-template-columns: repeat(4,1fr); }
    .kpi-grid.g6 { grid-template-columns: repeat(6,1fr); }
    .kpi-grid.g3 { grid-template-columns: repeat(3,1fr); }
    .kpi-grid.g2 { grid-template-columns: repeat(2,1fr); }
    /* compatibility */
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap: 14px; margin-bottom: 22px; }

    .kpi-card, .metric-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 18px 20px;
      position: relative; overflow: hidden;
      transition: border-color .2s, transform .2s;
    }
    .kpi-card:hover, .metric-card:hover { border-color: var(--border2); transform: translateY(-2px); }
    .kpi-card::before, .metric-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    }
    .kpi-card.gold::before, .metric-card.gold::before   { background: var(--gold); }
    .kpi-card.green::before, .metric-card.green::before  { background: var(--green); }
    .kpi-card.red::before, .metric-card.red::before    { background: var(--red); }
    .kpi-card.blue::before, .metric-card.blue::before   { background: var(--blue); }
    .kpi-card.amber::before, .metric-card.amber::before  { background: var(--amber); }
    .kpi-card.purple::before, .metric-card.purple::before { background: var(--purple); }
    .kpi-card.primary {
      background: linear-gradient(145deg, #1c1600 0%, var(--surface) 60%);
      border-color: var(--gold-bd);
    }
    .kpi-card.primary .kpi-value { color: var(--gold2); font-size: 2rem; }
    .kpi-icon { position: absolute; top: 14px; right: 14px; font-size: 20px; opacity: .35; }
    .kpi-label, .metric-label { font-size: 9.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; }
    .kpi-value, .metric-value { font-size: 1.75rem; font-weight: 900; color: var(--text); line-height: 1; margin-bottom: 4px; }
    .kpi-sub, .metric-sub { font-size: 11px; color: var(--muted); }
    .metric-icon { font-size: 18px; margin-bottom: 8px; }

    /* ── Charts ─────────────────────────────────────────────────────── */
    .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 22px; }
    .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 22px; }
    .chart-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .chart-card-title { font-size: 13.5px; font-weight: 700; }
    .chart-card-sub { font-size: 11px; color: var(--muted); }

    /* ── Badges ─────────────────────────────────────────────────────── */
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; white-space: nowrap;
    }
    .badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
    .badge-active   { background: var(--green-bg);  color: var(--green);  }  .badge-active::before  { background: var(--green); }
    .badge-trial    { background: var(--amber-bg);  color: var(--amber);  }  .badge-trial::before   { background: var(--amber); }
    .badge-suspended{ background: var(--red-bg);    color: var(--red);    }  .badge-suspended::before { background: var(--red); }
    .badge-cancelled{ background: rgba(100,100,100,.12); color: var(--muted); } .badge-cancelled::before { background: var(--muted); }
    .badge-open     { background: var(--blue-bg);   color: var(--blue);   }  .badge-open::before    { background: var(--blue); }
    .badge-low      { background: var(--amber-bg);  color: var(--amber);  }
    .badge-medium   { background: var(--blue-bg);   color: var(--blue);   }
    .badge-high     { background: var(--red-bg);    color: var(--red);    }
    .plan-solo   { color: var(--text2); }
    .plan-team   { color: var(--gold);  }
    .plan-studio { color: var(--purple); }
    .role-chip { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; }
    .role-chip.super_admin { background: var(--gold-bg);   color: var(--gold);   border: 1px solid var(--gold-bd); }
    .role-chip.admin   { background: var(--blue-bg);  color: var(--blue);   border: 1px solid rgba(59,130,246,.25); }
    .role-chip.suporte { background: var(--green-bg); color: var(--green);  border: 1px solid rgba(34,197,94,.25); }

    /* ── Buttons ────────────────────────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1px solid transparent; text-decoration: none;
      transition: all .15s; white-space: nowrap;
    }
    .btn:hover { opacity: .8; text-decoration: none; transform: translateY(-1px); }
    .btn:active { transform: none; }
    .btn-primary { background: var(--gold); color: #000; font-weight: 700; }
    .btn-primary:hover { background: var(--gold2); opacity: 1; }
    .btn-gold    { background: var(--gold-bg);   color: var(--gold);  border-color: var(--gold-bd); }
    .btn-green   { background: var(--green-bg);  color: var(--green); border-color: rgba(34,197,94,.25); }
    .btn-red     { background: var(--red-bg);    color: var(--red);   border-color: rgba(239,68,68,.25); }
    .btn-blue    { background: var(--blue-bg);   color: var(--blue);  border-color: rgba(59,130,246,.25); }
    .btn-purple  { background: var(--purple-bg); color: var(--purple); border-color: rgba(168,85,247,.25); }
    .btn-gray    { background: var(--surface2);  color: var(--text2); border-color: var(--border); }
    .btn-sm      { padding: 4px 10px; font-size: 11px; border-radius: 7px; }
    .btn-lg      { padding: 10px 20px; font-size: 14px; border-radius: 9px; }
    .btn-submit  { width: 100%; padding: 12px; background: var(--gold); color: #000; font-size: 14px; font-weight: 800; border: none; border-radius: 9px; cursor: pointer; transition: opacity .15s; }
    .btn-submit:hover { opacity: .9; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }

    /* ── Forms ──────────────────────────────────────────────────────── */
    .form-group { margin-bottom: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 5px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; }
    input[type=email], input[type=password], input[type=text], input[type=number], input[type=date], textarea, select {
      width: 100%; padding: 9px 12px; background: var(--surface2); border: 1px solid var(--border);
      border-radius: 9px; color: var(--text); font-size: 13px; outline: none;
      transition: border-color .15s;
    }
    input:focus, textarea:focus, select:focus { border-color: var(--gold); background: var(--surface); }
    textarea { resize: vertical; min-height: 90px; line-height: 1.5; }
    select { cursor: pointer; }
    .alert { padding: 11px 14px; border-radius: 9px; font-size: 13px; margin-bottom: 14px; display: flex; gap: 8px; align-items: center; }
    .alert-error   { background: var(--red-bg);   border: 1px solid rgba(239,68,68,.2);  color: var(--red); }
    .alert-success { background: var(--green-bg); border: 1px solid rgba(34,197,94,.2);  color: var(--green); }

    /* ── Filters ────────────────────────────────────────────────────── */
    .filters-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
    .filter-btn, .filter-tab {
      padding: 5px 13px; border-radius: 99px; font-size: 11.5px; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border); background: transparent;
      color: var(--muted); transition: all .15s; text-decoration: none; white-space: nowrap;
    }
    .filter-btn:hover, .filter-tab:hover { border-color: var(--border2); color: var(--text2); opacity: 1; text-decoration: none; }
    .filter-btn.active, .filter-tab.active { background: var(--gold); border-color: var(--gold); color: #000; }
    .search-wrapper { position: relative; }
    .search-wrapper svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--muted); }
    .search-input { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px 7px 32px; font-size: 12.5px; color: var(--text); outline: none; transition: border-color .15s; }
    .search-input:focus { border-color: var(--gold); }
    .search-input::placeholder { color: var(--muted); }

    /* ── Modal ──────────────────────────────────────────────────────── */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 100; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
    .modal-overlay.open { display: flex; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 26px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .modal h3 { font-size: 15px; font-weight: 800; }
    .modal-close { background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 13px; }
    .modal-close:hover { color: var(--text); }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); }

    /* ── Page header ────────────────────────────────────────────────── */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 22px; flex-wrap: wrap; }
    .page-title { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -.2px; }
    .page-sub { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
    .page-actions { display: flex; gap: 7px; align-items: center; flex-shrink: 0; }
    .breadcrumb { display: flex; align-items: center; gap: 5px; font-size: 12px; margin-bottom: 5px; }
    .bc-link { color: var(--muted); transition: color .15s; }
    .bc-link:hover { color: var(--text2); opacity: 1; }
    .bc-sep { color: var(--border2); }
    .bc-current { color: var(--text2); font-weight: 600; }

    /* ── States ─────────────────────────────────────────────────────── */
    .empty { text-align: center; padding: 56px 24px; }
    .empty-icon { font-size: 38px; margin-bottom: 12px; opacity: .4; }
    .empty-title { font-size: 14px; font-weight: 700; color: var(--text2); margin-bottom: 5px; }
    .empty-sub { font-size: 12.5px; color: var(--muted); }
    .error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 56px 24px; text-align: center; background: var(--surface); border: 1px solid rgba(239,68,68,.2); border-radius: var(--radius-lg); }
    .error-state-icon { font-size: 44px; margin-bottom: 14px; }
    .error-state-title { font-size: 16px; font-weight: 700; color: var(--red); margin-bottom: 7px; }
    .error-state-desc { font-size: 13px; color: var(--muted); margin-bottom: 18px; }

    /* ── Misc ────────────────────────────────────────────────────────── */
    .text-sm { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .text-mono { font-family: "Menlo","Monaco",monospace; font-size: 11.5px; }
    .stack-box { background: var(--bg); border: 1px solid var(--border); border-radius: 7px; padding: 9px 11px; font-size: 10.5px; font-family: monospace; color: var(--muted); white-space: pre-wrap; word-break: break-all; max-height: 110px; overflow-y: auto; margin-top: 5px; }
    .divider { height: 1px; background: var(--border); margin: 18px 0; }
    .stat-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border); }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { font-size: 12.5px; color: var(--muted); }
    .stat-value { font-size: 12.5px; font-weight: 700; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .cms-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 16px; }
    .cms-card h3 { font-size: 11px; font-weight: 700; margin-bottom: 12px; color: var(--gold); text-transform: uppercase; letter-spacing: 1px; }
    .cms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .container { max-width: 1300px; }

    /* ── Login ──────────────────────────────────────────────────────── */
    .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); }
    .login-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 40px; width: 100%; max-width: 375px; box-shadow: 0 24px 60px rgba(0,0,0,.5); }
    .login-logo { font-size: 12px; font-weight: 900; color: var(--gold); letter-spacing: 3px; text-align: center; text-transform: uppercase; }
    .login-sub { font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 28px; letter-spacing: .8px; margin-top: 4px; }

    /* ── Responsive ─────────────────────────────────────────────────── */
    @media (max-width: 1200px) {
      .kpi-grid.g6 { grid-template-columns: repeat(3,1fr); }
    }
    @media (max-width: 1024px) {
      .kpi-grid.g4 { grid-template-columns: repeat(2,1fr); }
      .kpi-grid.g6 { grid-template-columns: repeat(3,1fr); }
      .chart-grid { grid-template-columns: 1fr; }
      .three-col { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 768px) {
      .shell.collapsed .content { margin-left: 0; }
      .content { margin-left: 0 !important; }
      .sidebar { transform: translateX(-100%); width: 240px !important; }
      .sidebar.open { transform: translateX(0); }
      .sidebar-close-btn { display: flex !important; }
      .hamburger { display: flex; }
      .topbar-search kbd, .topbar-date { display: none; }
      .topbar-search input { width: 120px; }
      .page-body { padding: 18px 16px 48px; }
      .two-col, .three-col { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }
      .cms-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 580px) {
      .kpi-grid.g4, .kpi-grid.g6, .kpi-grid.g3 { grid-template-columns: 1fr 1fr; }
      .page-header { flex-direction: column; }
      th, td { padding: 10px 14px; }
    }
  </style>
    </head><body style="background:#0a0a0a">${body}</body></html>`;
  }

  const initials = session.name?.split(" ").slice(0,2).map((w:string)=>w[0]).join("").toUpperCase() || "?";
  const roleLabel = session.role === "super_admin" ? "Super Admin" : session.role === "admin" ? "Admin" : "Suporte";

  const sidebarItems = [
    { group: "PRINCIPAL", items: [
      { href: "/superadmin",          icon: "◉", label: "Dashboard",          active: title === "Dashboard" },
      { href: "/superadmin/tenants",  icon: "⬡", label: "Barbearias",         active: title.includes("Barbearia") || title.includes("Tenant") },
      { href: "/superadmin/planos",   icon: "◈", label: "Planos & Assinaturas", active: title === "Planos" },
      { href: "/superadmin/leads",    icon: "◎", label: "Leads",              active: title === "Leads" },
    ]},
    { group: "OPERACIONAL", items: [
      { href: "/superadmin/suporte",       icon: "◷", label: "Suporte",       active: title === "Suporte" },
      { href: "/superadmin/erros",         icon: "△", label: "Log de Erros",  active: title === "Erros" },
      { href: "/superadmin/monitoramento", icon: "◌", label: "Monitoramento", active: title === "Monitoramento" },
    ]},
    ...(session.role === "super_admin" ? [{ group: "CONFIGURAÇÃO", items: [
      { href: "/superadmin/usuarios",      icon: "◻", label: "Usuários BO",       active: title === "Usuários" },
      { href: "/superadmin/cms",           icon: "◧", label: "CMS / Conteúdo",    active: title.startsWith("CMS") },
      { href: "/superadmin/email-preview", icon: "◨", label: "Templates E-mail",  active: title === "E-mails" },
    ]}] : []),
  ];

  const navHtml = sidebarItems.map((group: any) => `
    <div class="nav-group">
      <span class="nav-group-label">${group.group}</span>
      ${group.items.map((item: any) => `
        <a href="${item.href}" class="nav-item${item.active ? " active" : ""}" data-tip="${esc(item.label)}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${esc(item.label)}</span>
        </a>
      `).join("")}
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)} — Barber Pro Backoffice</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
    <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:       #0a0a0a;
      --surface:  #131313;
      --surface2: #1a1a1a;
      --surface3: #222222;
      --border:   #272727;
      --border2:  #333333;
      --text:     #f0eeea;
      --text2:    #a09e99;
      --muted:    #5c5a57;
      --gold:     #c9a84c;
      --gold2:    #dbb84a;
      --gold-bg:  rgba(201,168,76,.10);
      --gold-bd:  rgba(201,168,76,.22);
      --green:    #22c55e; --green-bg: rgba(34,197,94,.10);
      --red:      #ef4444; --red-bg:   rgba(239,68,68,.10);
      --blue:     #3b82f6; --blue-bg:  rgba(59,130,246,.10);
      --amber:    #f59e0b; --amber-bg: rgba(245,158,11,.10);
      --purple:   #a855f7; --purple-bg:rgba(168,85,247,.10);
      --sidebar-w: 224px;
      --sidebar-w-sm: 60px;
      --topbar-h: 56px;
      --radius: 10px;
      --radius-lg: 14px;
    }
    html { height: 100%; }
    body { font-family: "Inter", -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; font-size: 13.5px; line-height: 1.55; }
    a { color: var(--gold); text-decoration: none; }
    a:hover { opacity: .8; }
    input, select, textarea, button { font-family: inherit; }
    ::selection { background: var(--gold-bg); color: var(--gold); }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

    /* ── Shell ──────────────────────────────────────────────────────── */
    .shell { display: flex; min-height: 100vh; }
    .content { flex: 1; min-width: 0; margin-left: var(--sidebar-w); display: flex; flex-direction: column; transition: margin-left .25s; }
    .shell.collapsed .content { margin-left: var(--sidebar-w-sm); }

    /* ── Sidebar ────────────────────────────────────────────────────── */
    .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0; width: var(--sidebar-w);
      background: var(--surface); border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      transition: width .25s, transform .25s;
      z-index: 60; overflow: hidden;
    }
    .shell.collapsed .sidebar { width: var(--sidebar-w-sm); }

    .sidebar-top { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; }

    .sidebar-logo {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 14px 14px; border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .logo-mark {
      width: 32px; height: 32px; border-radius: 9px;
      background: var(--gold-bg); border: 1px solid var(--gold-bd);
      display: flex; align-items: center; justify-content: center;
      color: var(--gold); flex-shrink: 0;
    }
    .logo-text { flex: 1; min-width: 0; overflow: hidden; }
    .logo-title { display: block; font-size: 11px; font-weight: 800; color: var(--gold); letter-spacing: 2px; white-space: nowrap; }
    .logo-sub   { display: block; font-size: 9px;  color: var(--muted); letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; margin-top: 1px; }
    .shell.collapsed .logo-text { display: none; }

    .sidebar-close-btn {
      display: none; background: none; border: none; color: var(--muted);
      cursor: pointer; padding: 4px; border-radius: 6px; transition: color .15s;
    }
    .sidebar-close-btn:hover { color: var(--text); }

    /* Collapse toggle */
    .sidebar-logo::after {
      content: "⇤";
      margin-left: auto; font-size: 12px; color: var(--muted);
      cursor: pointer; flex-shrink: 0; padding: 4px 6px;
      border-radius: 6px; transition: all .15s;
      display: block;
    }
    .sidebar-logo:hover::after { color: var(--text); background: var(--surface2); }
    .sidebar-logo { cursor: default; }
    .logo-mark, .logo-text { cursor: default; }

    /* Hack: clicking the ::after isn't possible — use a real button instead */
    .collapse-btn {
      margin-left: auto; background: none; border: none; color: var(--muted);
      cursor: pointer; padding: 4px 6px; border-radius: 6px;
      transition: all .15s; font-size: 14px; flex-shrink: 0;
    }
    .collapse-btn:hover { color: var(--text); background: var(--surface2); }
    .shell.collapsed .collapse-btn { transform: rotate(180deg); }

    /* Nav groups */
    .sidebar-nav { padding: 8px 0; }
    .nav-group { margin-bottom: 4px; }
    .nav-group-label {
      font-size: 9px; font-weight: 700; letter-spacing: 1.4px; color: var(--muted);
      text-transform: uppercase; padding: 10px 16px 4px; display: block;
      white-space: nowrap; overflow: hidden;
      transition: opacity .2s;
    }
    .shell.collapsed .nav-group-label { opacity: 0; height: 0; padding: 0; margin: 0; }

    .nav-item {
      display: flex; align-items: center; gap: 10px;
      margin: 1px 8px; padding: 7px 10px; border-radius: 8px;
      color: var(--text2); font-size: 13px; font-weight: 500;
      position: relative; transition: all .15s; white-space: nowrap;
      overflow: hidden;
    }
    .nav-item:hover { background: var(--surface2); color: var(--text); opacity: 1; }
    .nav-item.active {
      background: var(--gold-bg); color: var(--gold);
      font-weight: 600;
    }
    .nav-item.active::before {
      content: ''; position: absolute; left: 0; top: 20%; bottom: 20%;
      width: 3px; background: var(--gold); border-radius: 0 3px 3px 0;
    }
    .nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; font-style: normal; }
    .nav-label { flex: 1; }
    .shell.collapsed .nav-label { display: none; }
    .shell.collapsed .nav-item { justify-content: center; margin: 1px 6px; }
    .shell.collapsed .nav-item:hover::after {
      content: attr(data-tip);
      position: absolute; left: calc(100% + 10px); top: 50%;
      transform: translateY(-50%);
      background: var(--surface3); border: 1px solid var(--border2);
      color: var(--text); font-size: 12px; font-weight: 500;
      padding: 6px 12px; border-radius: 8px;
      white-space: nowrap; z-index: 100;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0,0,0,.4);
    }

    /* Sidebar user footer */
    .sidebar-user {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .user-avatar {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, var(--gold), var(--gold2));
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; color: #000;
    }
    .user-info { flex: 1; min-width: 0; overflow: hidden; }
    .user-name { display: block; font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { display: block; font-size: 10px; color: var(--gold); white-space: nowrap; }
    .user-logout {
      color: var(--muted); transition: color .15s;
      padding: 4px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
    }
    .user-logout:hover { color: var(--red); opacity: 1; }
    .shell.collapsed .user-info, .shell.collapsed .user-logout { display: none; }
    .shell.collapsed .sidebar-user { justify-content: center; padding: 12px 0; }
    .shell.collapsed .user-avatar { margin: 0 auto; }

    /* Mobile overlay */
    .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 59; }
    .overlay.visible { display: block; }

    /* ── Topbar ─────────────────────────────────────────────────────── */
    .topbar {
      height: var(--topbar-h); background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 12px;
      padding: 0 24px; position: sticky; top: 0; z-index: 40;
      flex-shrink: 0;
    }
    .hamburger {
      display: none; background: none; border: none;
      color: var(--text2); cursor: pointer; padding: 6px;
      border-radius: 8px; transition: all .15s;
    }
    .hamburger:hover { background: var(--surface2); color: var(--text); }
    .topbar-title { flex: 1; }
    .topbar-page { font-size: 15px; font-weight: 700; color: var(--text); }
    .topbar-right { display: flex; align-items: center; gap: 10px; }
    .topbar-search {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 8px; padding: 6px 12px;
      transition: border-color .15s;
    }
    .topbar-search:focus-within { border-color: var(--gold); }
    .topbar-search svg { color: var(--muted); flex-shrink: 0; }
    .topbar-search input {
      background: none; border: none; outline: none; color: var(--text);
      font-size: 12px; width: 160px;
    }
    .topbar-search input::placeholder { color: var(--muted); }
    .topbar-search kbd {
      font-size: 10px; color: var(--muted);
      background: var(--surface3); border: 1px solid var(--border2);
      border-radius: 4px; padding: 1px 5px;
    }
    .topbar-date { font-size: 12px; color: var(--muted); white-space: nowrap; }
    .topbar-logout {
      font-size: 12px; color: var(--muted); padding: 5px 10px;
      border-radius: 7px; border: 1px solid var(--border);
      transition: all .15s;
    }
    .topbar-logout:hover { color: var(--red); border-color: var(--red-bg); background: var(--red-bg); opacity: 1; }

    /* ── Page ───────────────────────────────────────────────────────── */
    .page-body { flex: 1; padding: 28px 28px 60px; }

    /* ── Cards & Tables ─────────────────────────────────────────────── */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px; }
    .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .card-title { font-size: 13.5px; font-weight: 700; }
    .card-sub { font-size: 12px; color: var(--muted); }
    .card-body { padding: 20px; }
    .table-wrap, .table-wrapper { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px; }
    .table-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .table-header h2, .card-title { font-size: 13.5px; font-weight: 700; }
    table, table.data-table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 20px; text-align: left; font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid var(--border); background: rgba(255,255,255,.02); white-space: nowrap; }
    td { padding: 13px 20px; font-size: 13px; color: var(--text2); border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr { transition: background .1s; }
    tr:hover td { background: rgba(255,255,255,.025); color: var(--text); }
    .table-name .name { font-weight: 600; color: var(--text); font-size: 13px; }
    .table-name .slug { font-size: 11px; color: var(--muted); font-family: monospace; margin-top: 1px; }

    /* ── KPI Grid ───────────────────────────────────────────────────── */
    .kpi-grid { display: grid; gap: 14px; margin-bottom: 22px; }
    .kpi-grid.g4 { grid-template-columns: repeat(4,1fr); }
    .kpi-grid.g6 { grid-template-columns: repeat(6,1fr); }
    .kpi-grid.g3 { grid-template-columns: repeat(3,1fr); }
    .kpi-grid.g2 { grid-template-columns: repeat(2,1fr); }
    /* compatibility */
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap: 14px; margin-bottom: 22px; }

    .kpi-card, .metric-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 18px 20px;
      position: relative; overflow: hidden;
      transition: border-color .2s, transform .2s;
    }
    .kpi-card:hover, .metric-card:hover { border-color: var(--border2); transform: translateY(-2px); }
    .kpi-card::before, .metric-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    }
    .kpi-card.gold::before, .metric-card.gold::before   { background: var(--gold); }
    .kpi-card.green::before, .metric-card.green::before  { background: var(--green); }
    .kpi-card.red::before, .metric-card.red::before    { background: var(--red); }
    .kpi-card.blue::before, .metric-card.blue::before   { background: var(--blue); }
    .kpi-card.amber::before, .metric-card.amber::before  { background: var(--amber); }
    .kpi-card.purple::before, .metric-card.purple::before { background: var(--purple); }
    .kpi-card.primary {
      background: linear-gradient(145deg, #1c1600 0%, var(--surface) 60%);
      border-color: var(--gold-bd);
    }
    .kpi-card.primary .kpi-value { color: var(--gold2); font-size: 2rem; }
    .kpi-icon { position: absolute; top: 14px; right: 14px; font-size: 20px; opacity: .35; }
    .kpi-label, .metric-label { font-size: 9.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; }
    .kpi-value, .metric-value { font-size: 1.75rem; font-weight: 900; color: var(--text); line-height: 1; margin-bottom: 4px; }
    .kpi-sub, .metric-sub { font-size: 11px; color: var(--muted); }
    .metric-icon { font-size: 18px; margin-bottom: 8px; }

    /* ── Charts ─────────────────────────────────────────────────────── */
    .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 22px; }
    .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 22px; }
    .chart-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .chart-card-title { font-size: 13.5px; font-weight: 700; }
    .chart-card-sub { font-size: 11px; color: var(--muted); }

    /* ── Badges ─────────────────────────────────────────────────────── */
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; white-space: nowrap;
    }
    .badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
    .badge-active   { background: var(--green-bg);  color: var(--green);  }  .badge-active::before  { background: var(--green); }
    .badge-trial    { background: var(--amber-bg);  color: var(--amber);  }  .badge-trial::before   { background: var(--amber); }
    .badge-suspended{ background: var(--red-bg);    color: var(--red);    }  .badge-suspended::before { background: var(--red); }
    .badge-cancelled{ background: rgba(100,100,100,.12); color: var(--muted); } .badge-cancelled::before { background: var(--muted); }
    .badge-open     { background: var(--blue-bg);   color: var(--blue);   }  .badge-open::before    { background: var(--blue); }
    .badge-low      { background: var(--amber-bg);  color: var(--amber);  }
    .badge-medium   { background: var(--blue-bg);   color: var(--blue);   }
    .badge-high     { background: var(--red-bg);    color: var(--red);    }
    .plan-solo   { color: var(--text2); }
    .plan-team   { color: var(--gold);  }
    .plan-studio { color: var(--purple); }
    .role-chip { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; }
    .role-chip.super_admin { background: var(--gold-bg);   color: var(--gold);   border: 1px solid var(--gold-bd); }
    .role-chip.admin   { background: var(--blue-bg);  color: var(--blue);   border: 1px solid rgba(59,130,246,.25); }
    .role-chip.suporte { background: var(--green-bg); color: var(--green);  border: 1px solid rgba(34,197,94,.25); }

    /* ── Buttons ────────────────────────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1px solid transparent; text-decoration: none;
      transition: all .15s; white-space: nowrap;
    }
    .btn:hover { opacity: .8; text-decoration: none; transform: translateY(-1px); }
    .btn:active { transform: none; }
    .btn-primary { background: var(--gold); color: #000; font-weight: 700; }
    .btn-primary:hover { background: var(--gold2); opacity: 1; }
    .btn-gold    { background: var(--gold-bg);   color: var(--gold);  border-color: var(--gold-bd); }
    .btn-green   { background: var(--green-bg);  color: var(--green); border-color: rgba(34,197,94,.25); }
    .btn-red     { background: var(--red-bg);    color: var(--red);   border-color: rgba(239,68,68,.25); }
    .btn-blue    { background: var(--blue-bg);   color: var(--blue);  border-color: rgba(59,130,246,.25); }
    .btn-purple  { background: var(--purple-bg); color: var(--purple); border-color: rgba(168,85,247,.25); }
    .btn-gray    { background: var(--surface2);  color: var(--text2); border-color: var(--border); }
    .btn-sm      { padding: 4px 10px; font-size: 11px; border-radius: 7px; }
    .btn-lg      { padding: 10px 20px; font-size: 14px; border-radius: 9px; }
    .btn-submit  { width: 100%; padding: 12px; background: var(--gold); color: #000; font-size: 14px; font-weight: 800; border: none; border-radius: 9px; cursor: pointer; transition: opacity .15s; }
    .btn-submit:hover { opacity: .9; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }

    /* ── Forms ──────────────────────────────────────────────────────── */
    .form-group { margin-bottom: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 5px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; }
    input[type=email], input[type=password], input[type=text], input[type=number], input[type=date], textarea, select {
      width: 100%; padding: 9px 12px; background: var(--surface2); border: 1px solid var(--border);
      border-radius: 9px; color: var(--text); font-size: 13px; outline: none;
      transition: border-color .15s;
    }
    input:focus, textarea:focus, select:focus { border-color: var(--gold); background: var(--surface); }
    textarea { resize: vertical; min-height: 90px; line-height: 1.5; }
    select { cursor: pointer; }
    .alert { padding: 11px 14px; border-radius: 9px; font-size: 13px; margin-bottom: 14px; display: flex; gap: 8px; align-items: center; }
    .alert-error   { background: var(--red-bg);   border: 1px solid rgba(239,68,68,.2);  color: var(--red); }
    .alert-success { background: var(--green-bg); border: 1px solid rgba(34,197,94,.2);  color: var(--green); }

    /* ── Filters ────────────────────────────────────────────────────── */
    .filters-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
    .filter-btn, .filter-tab {
      padding: 5px 13px; border-radius: 99px; font-size: 11.5px; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border); background: transparent;
      color: var(--muted); transition: all .15s; text-decoration: none; white-space: nowrap;
    }
    .filter-btn:hover, .filter-tab:hover { border-color: var(--border2); color: var(--text2); opacity: 1; text-decoration: none; }
    .filter-btn.active, .filter-tab.active { background: var(--gold); border-color: var(--gold); color: #000; }
    .search-wrapper { position: relative; }
    .search-wrapper svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--muted); }
    .search-input { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px 7px 32px; font-size: 12.5px; color: var(--text); outline: none; transition: border-color .15s; }
    .search-input:focus { border-color: var(--gold); }
    .search-input::placeholder { color: var(--muted); }

    /* ── Modal ──────────────────────────────────────────────────────── */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 100; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
    .modal-overlay.open { display: flex; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 26px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .modal h3 { font-size: 15px; font-weight: 800; }
    .modal-close { background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 13px; }
    .modal-close:hover { color: var(--text); }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); }

    /* ── Page header ────────────────────────────────────────────────── */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 22px; flex-wrap: wrap; }
    .page-title { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -.2px; }
    .page-sub { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
    .page-actions { display: flex; gap: 7px; align-items: center; flex-shrink: 0; }
    .breadcrumb { display: flex; align-items: center; gap: 5px; font-size: 12px; margin-bottom: 5px; }
    .bc-link { color: var(--muted); transition: color .15s; }
    .bc-link:hover { color: var(--text2); opacity: 1; }
    .bc-sep { color: var(--border2); }
    .bc-current { color: var(--text2); font-weight: 600; }

    /* ── States ─────────────────────────────────────────────────────── */
    .empty { text-align: center; padding: 56px 24px; }
    .empty-icon { font-size: 38px; margin-bottom: 12px; opacity: .4; }
    .empty-title { font-size: 14px; font-weight: 700; color: var(--text2); margin-bottom: 5px; }
    .empty-sub { font-size: 12.5px; color: var(--muted); }
    .error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 56px 24px; text-align: center; background: var(--surface); border: 1px solid rgba(239,68,68,.2); border-radius: var(--radius-lg); }
    .error-state-icon { font-size: 44px; margin-bottom: 14px; }
    .error-state-title { font-size: 16px; font-weight: 700; color: var(--red); margin-bottom: 7px; }
    .error-state-desc { font-size: 13px; color: var(--muted); margin-bottom: 18px; }

    /* ── Misc ────────────────────────────────────────────────────────── */
    .text-sm { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .text-mono { font-family: "Menlo","Monaco",monospace; font-size: 11.5px; }
    .stack-box { background: var(--bg); border: 1px solid var(--border); border-radius: 7px; padding: 9px 11px; font-size: 10.5px; font-family: monospace; color: var(--muted); white-space: pre-wrap; word-break: break-all; max-height: 110px; overflow-y: auto; margin-top: 5px; }
    .divider { height: 1px; background: var(--border); margin: 18px 0; }
    .stat-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border); }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { font-size: 12.5px; color: var(--muted); }
    .stat-value { font-size: 12.5px; font-weight: 700; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .cms-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 16px; }
    .cms-card h3 { font-size: 11px; font-weight: 700; margin-bottom: 12px; color: var(--gold); text-transform: uppercase; letter-spacing: 1px; }
    .cms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .container { max-width: 1300px; }

    /* ── Login ──────────────────────────────────────────────────────── */
    .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); }
    .login-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 40px; width: 100%; max-width: 375px; box-shadow: 0 24px 60px rgba(0,0,0,.5); }
    .login-logo { font-size: 12px; font-weight: 900; color: var(--gold); letter-spacing: 3px; text-align: center; text-transform: uppercase; }
    .login-sub { font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 28px; letter-spacing: .8px; margin-top: 4px; }

    /* ── Responsive ─────────────────────────────────────────────────── */
    @media (max-width: 1200px) {
      .kpi-grid.g6 { grid-template-columns: repeat(3,1fr); }
    }
    @media (max-width: 1024px) {
      .kpi-grid.g4 { grid-template-columns: repeat(2,1fr); }
      .kpi-grid.g6 { grid-template-columns: repeat(3,1fr); }
      .chart-grid { grid-template-columns: 1fr; }
      .three-col { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 768px) {
      .shell.collapsed .content { margin-left: 0; }
      .content { margin-left: 0 !important; }
      .sidebar { transform: translateX(-100%); width: 240px !important; }
      .sidebar.open { transform: translateX(0); }
      .sidebar-close-btn { display: flex !important; }
      .hamburger { display: flex; }
      .topbar-search kbd, .topbar-date { display: none; }
      .topbar-search input { width: 120px; }
      .page-body { padding: 18px 16px 48px; }
      .two-col, .three-col { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }
      .cms-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 580px) {
      .kpi-grid.g4, .kpi-grid.g6, .kpi-grid.g3 { grid-template-columns: 1fr 1fr; }
      .page-header { flex-direction: column; }
      th, td { padding: 10px 14px; }
    }
  </style>
  ${extraHead}
</head>
<body>
  <!-- Mobile overlay -->
  <div class="overlay" id="overlay" onclick="closeSidebar()"></div>

  <div class="shell" id="shell">
    <!-- ── Sidebar ──────────────────────────────────── -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-top">
        <!-- Logo -->
        <div class="sidebar-logo">
          <div class="logo-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 2v20M18 2v20M6 12h12"/></svg>
          </div>
          <div class="logo-text">
            <span class="logo-title">BARBER PRO</span>
            <span class="logo-sub">Backoffice</span>
          </div>
          <button class="sidebar-close-btn" onclick="closeSidebar()" title="Fechar menu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <!-- Nav -->
        <nav class="sidebar-nav">${navHtml}</nav>
      </div>

      <!-- User -->
      <div class="sidebar-user">
        <div class="user-avatar">${initials}</div>
        <div class="user-info">
          <span class="user-name">${esc(session.name)}</span>
          <span class="user-role">${roleLabel}</span>
        </div>
        <a href="/superadmin/logout" class="user-logout" title="Sair">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </a>
      </div>
    </aside>

    <!-- ── Main content ─────────────────────────────── -->
    <div class="content" id="content">

      <!-- Topbar -->
      <header class="topbar">
        <button class="hamburger" onclick="openSidebar()" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <div class="topbar-title">
          <h1 class="topbar-page">${esc(title)}</h1>
        </div>

        <div class="topbar-right">
          <form action="/superadmin/busca" method="GET" class="topbar-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" name="q" placeholder="Buscar barbearia..." autocomplete="off"/>
            <kbd>⌘K</kbd>
          </form>
          <span class="topbar-date">${new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
          <a href="/superadmin/logout" class="topbar-logout">
            Sair
          </a>
        </div>
      </header>

      <!-- Page body -->
      <main class="page-body" style="max-width:1340px">
        ${body}
      </main>
    </div>
  </div>

  <script>
    // ── Sidebar toggle ───────────────────────────────
    const SHELL = document.getElementById('shell');
    const SIDEBAR = document.getElementById('sidebar');
    const OVERLAY = document.getElementById('overlay');
    const LS_KEY = 'bp_sidebar';

    function openSidebar() {
      SIDEBAR.classList.add('open');
      OVERLAY.classList.add('visible');
    }
    function closeSidebar() {
      SIDEBAR.classList.remove('open');
      OVERLAY.classList.remove('visible');
    }
    function toggleCollapse() {
      var collapsed = SHELL.classList.toggle('collapsed');
      localStorage.setItem(LS_KEY, collapsed ? '1' : '0');
    }
    // Restore state
    if (localStorage.getItem(LS_KEY) === '1') SHELL.classList.add('collapsed');

    // Modal helpers (legacy)
    function openModal(id) { document.getElementById(id)?.classList.add('open'); }
    function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
    function openPlanModal(tid, plan) {
      document.getElementById('plan-tenant-id').value = tid;
      document.getElementById('plan-select').value = plan;
      openModal('plan-modal');
    }
    function openUserModal(id, name, email, role, active) {
      document.getElementById('edit-user-id').value = id;
      document.getElementById('edit-user-name').value = name;
      document.getElementById('edit-user-email').value = email;
      document.getElementById('edit-user-role').value = role;
      document.getElementById('edit-user-active').value = active ? '1' : '0';
      openModal('edit-user-modal');
    }
    // Keyboard shortcut ⌘K for search
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.topbar-search input')?.focus();
      }
    });
  </script>
</body>
</html>`;
}


function statusBadge(status: string): string {
  const map: Record<string, string> = {
    active:    '<span class="badge badge-active">Ativo</span>',
    trial:     '<span class="badge badge-trial">Trial</span>',
    suspended: '<span class="badge badge-suspended">Suspenso</span>',
    cancelled: '<span class="badge badge-cancelled">Cancelado</span>',
    open:      '<span class="badge badge-open">Aberto</span>',
    closed:    '<span class="badge badge-cancelled">Fechado</span>',
    low:       '<span class="badge badge-low">Baixa</span>',
    medium:    '<span class="badge badge-medium">Média</span>',
    high:      '<span class="badge badge-high">Alta</span>',
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
    super_admin: '<span class="badge" style="background:#C9A84C22;color:var(--gold-500)">Super Admin</span>',
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
      // MRR real baseado nos planos do banco
      const PLAN_PRICES: Record<string, number> = { solo: 49, team: 89, studio: 149, estudios: 149 };
      const mrr = allTenants.filter((t) => t.status === "active")
        .reduce((s, t) => s + (PLAN_PRICES[t.plan ?? "solo"] ?? 49), 0);
      const mrrTrial = allTenants.filter((t) => t.status === "trial").length;
      const churnLast30 = allTenants.filter((t) => {
        if (t.status !== "cancelled" && t.status !== "suspended") return false;
        const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
        return Date.now() - updated < 30 * 24 * 60 * 60 * 1000;
      }).length;
      const conversionRate = trial > 0 ? Math.round((active / (active + trial)) * 100) : 0;

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
          const [rows] = await dbConn.execute(sql`SELECT COUNT(*) as cnt FROM orbit_leads`) as any;
          return (rows?.[0] as any)?.cnt ?? 0;
        } catch { return 0; }
      })();

      // Últimas 5 barbearias
      const recent = allTenants.slice(0, 5).map((t) => `
        <tr>
          <td>
            <div class="table-name">
              <div class="name">${esc(t.name)}</div>
              <div class="slug">${esc(t.slug)}</div>
            </div>
          </td>
          <td>${planLabel(t.plan)}</td>
          <td>${statusBadge(t.status)}</td>
          <td style="color:var(--text-muted);font-size:12px">${new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
          <td><a href="/superadmin/tenants/${t.id}" class="btn btn-gray btn-sm">Detalhes →</a></td>
        </tr>
      `).join("");

      res.send(layout("Dashboard", session, `
        <div class="container">
          <div class="page-header">
            <div>
              <div class="page-title">📊 Dashboard da Plataforma</div>
              <div class="page-sub">Visão geral e métricas do Barber Pro em tempo real</div>
            </div>
            <div class="page-actions">
              <a href="/superadmin/tenants" class="btn btn-gray btn-sm">🏪 Barbearias</a>
              <a href="/superadmin/monitoramento" class="btn btn-gold btn-sm">📡 Monitor</a>
            </div>
          </div>

          <!-- KPIs principais -->
          <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px">
            <div class="metric-card" style="--accent-color: var(--gold-500)">
              <div class="metric-icon">💰</div>
              <div class="metric-label">MRR Real</div>
              <div class="metric-value" style="color:var(--gold-500)">R$${mrr.toLocaleString('pt-BR')}</div>
              <div class="metric-sub">receita mensal recorrente</div>
            </div>
            <div class="kpi-card green">
              <span class="kpi-icon">✅</span>
              <div class="kpi-label">Assinaturas Ativas</div>
              <div class="kpi-value" style="color:var(--green)">${active}</div>
              <div class="kpi-sub">${active} pagando mensalmente</div>
            </div>
            <div class="kpi-card amber">
              <span class="kpi-icon">⏳</span>
              <div class="kpi-label">Em Trial</div>
              <div class="kpi-value" style="color:var(--amber)">${trial}</div>
              <div class="kpi-sub">+R$${(trial*49).toLocaleString('pt-BR')}/mês potencial</div>
            </div>
            <div class="kpi-card ${churnLast30 > 0 ? 'red' : 'green'}">
              <span class="kpi-icon">📉</span>
              <div class="kpi-label">Churn (30 dias)</div>
              <div class="kpi-value" style="color:${churnLast30 > 0 ? 'var(--red)' : 'var(--green)'}">${churnLast30}</div>
              <div class="kpi-sub">${suspended} suspensos total</div>
            </div>
            <div class="kpi-card blue">
              <span class="kpi-icon">🏪</span>
              <div class="kpi-label">Total Barbearias</div>
              <div class="kpi-value" style="color:var(--blue)">${total}</div>
              <div class="kpi-sub">${total} tenants cadastrados</div>
            </div>
            <div class="kpi-card purple">
              <span class="kpi-icon">🎯</span>
              <div class="kpi-label">Leads Landing</div>
              <div class="kpi-value" style="color:var(--purple)">${totalLeads}</div>
              <div class="kpi-sub">capturados na landing page</div>
            </div>
          </div>

          <div class="chart-grid">
          <div class="chart-card">
            <div class="chart-card-header"><div class="chart-card-title">📈 Crescimento Semanal</div><div class="chart-card-sub">Novos cadastros por semana (12 sem.)</div></div>
            <div style="padding:20px 16px">
              <canvas id="growthChart" height="80"></canvas>
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-card-header"><div class="chart-card-title">💰 Evolução do MRR</div><div class="chart-card-sub">MRR acumulado (12 semanas)</div></div>
            <div style="padding:20px 16px">
              <canvas id="mrrChart" height="80"></canvas>
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
          </div>
          <div class="table-wrap">
            <div class="table-header">
              <h2>🏪 Cadastros Recentes</h2>
              <a href="/superadmin/tenants" class="btn btn-gray btn-sm">Ver todas →</a>
            </div>
            <table class="data-table">
              <thead><tr><th>Barbearia</th><th>Plano</th><th>Status</th><th>Cadastro</th><th>Ações</th></tr></thead>
              <tbody>${recent || '<tr><td colspan="5"><div class="empty"><div class="empty-icon">🏪</div><div class="empty-title">Nenhuma barbearia cadastrada</div></div></td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `));
    } catch (e) {
      console.error("[BO Dashboard]", e);
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--danger);margin-top:40px">Erro ao carregar dashboard.</p></div>`));
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
          <td style="color:var(--text-muted)">${new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
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
          <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><span class="bc-current">Barbearias</span></div>
          <div class="page-header">
            <div class="page-title">Barbearias Cadastradas</div>
            <div class="page-sub">${allTenants.length} resultado${allTenants.length !== 1 ? "s" : ""}</div>
          </div>

          <form method="GET" action="/superadmin/tenants" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
            <div style="flex:1;min-width:200px">
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">BUSCAR</label>
              <input name="search" value="${esc(searchTenant)}" placeholder="Nome ou slug da barbearia..." style="width:100%;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px" />
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">PLANO</label>
              <select name="plan" style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px">
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
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--danger);margin-top:40px">Erro ao carregar barbearias.</p></div>`));
    }
  });

  // ── GET /superadmin/tenants/action ─────────────────────────────────────────
  // ── Audit log em memória (últimas 100 ações) ────────────────────────────────
  const auditLog: { ts: string; user: string; action: string; target: string }[] = [];
  function logAction(user: string, action: string, target: string) {
    auditLog.unshift({ ts: new Date().toLocaleString("pt-BR"), user, action, target });
    if (auditLog.length > 100) auditLog.pop();
  }


  // ── GET /superadmin/tenants/:id — Detalhes da barbearia ──────────────────
  app.get("/superadmin/tenants/:id", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    try {
      const tenantId = parseInt(req.params.id);
      const allTenants = await db.getAllTenants();
      const tenant = allTenants.find((t: any) => t.id === tenantId);
      if (!tenant) { res.redirect("/superadmin/tenants"); return; }
      const dbConn = await db.getDb();
      const { sql } = await import("drizzle-orm");
      let stats = { appointments: 0, clients: 0, sales: 0, revenue: 0 };
      if (dbConn) {
        try {
          const [a, c, s] = await Promise.all([
            dbConn.execute(sql`SELECT COUNT(*) as cnt FROM appointments INNER JOIN barbers b ON b.id=appointments."barberId" WHERE b."tenantId"=${tenantId}`),
            dbConn.execute(sql`SELECT COUNT(*) as cnt FROM clients WHERE "tenantId"=${tenantId}`),
            dbConn.execute(sql`SELECT COUNT(*) as cnt, COALESCE(SUM(CAST(total AS NUMERIC)),0) as rev FROM sales WHERE "tenantId"=${tenantId} AND "paymentStatus"='paid'`),
          ]) as any[];
          stats.appointments = Number((a[0]?.[0]??a?.rows?.[0])?.cnt??0);
          stats.clients = Number((c[0]?.[0]??c?.rows?.[0])?.cnt??0);
          stats.sales = Number((s[0]?.[0]??s?.rows?.[0])?.cnt??0);
          stats.revenue = parseFloat((s[0]?.[0]??s?.rows?.[0])?.rev??0);
        } catch {}
      }
      const PLAN_PRICES: Record<string,number> = { solo:49, team:89, studio:149 };
      res.send(layout(`Barbearia — ${esc(tenant.name)}`, session, `
        <div class="container">
          <div class="breadcrumb">
            <a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">/</span>
            <a href="/superadmin/tenants" class="bc-link">Barbearias</a><span class="bc-sep">/</span>
            <span class="bc-current">${esc(tenant.name)}</span>
          </div>
          <div class="page-header">
            <div>
              <div class="page-title">${esc(tenant.name)}</div>
              <div class="page-sub">slug: <code style="font-family:monospace;color:var(--gold-400)">${esc(tenant.slug)}</code> · ID: ${tenant.id}</div>
            </div>
            <div class="page-actions">
              ${statusBadge(tenant.status)}
              <a href="/pub/${esc(tenant.slug)}" target="_blank" class="btn btn-gray btn-sm">🌐 Página pública</a>
              <a href="/superadmin/tenants/action?id=${tenant.id}&act=extend-trial" class="btn btn-gold btn-sm">⏳ Estender trial</a>
            </div>
          </div>
          <div class="metrics">
            <div class="metric-card" style="--accent-color:#60A5FA">
              <div class="metric-icon">📅</div>
              <div class="metric-label">Agendamentos</div>
              <div class="metric-value" style="color:#60A5FA">${stats.appointments.toLocaleString("pt-BR")}</div>
            </div>
            <div class="metric-card" style="--accent-color:#C084FC">
              <div class="metric-icon">👥</div>
              <div class="metric-label">Clientes</div>
              <div class="metric-value" style="color:#C084FC">${stats.clients.toLocaleString("pt-BR")}</div>
            </div>
            <div class="metric-card" style="--accent-color:var(--gold-500)">
              <div class="metric-icon">💰</div>
              <div class="metric-label">Receita Total</div>
              <div class="metric-value" style="color:var(--gold-400)">R$${Math.round(stats.revenue).toLocaleString("pt-BR")}</div>
            </div>
            <div class="metric-card" style="--accent-color:#22c55e">
              <div class="metric-icon">🛒</div>
              <div class="metric-label">Plano Atual</div>
              <div class="metric-value" style="font-size:18px">${planLabel(tenant.plan)}</div>
              <div class="metric-sub">R$${PLAN_PRICES[tenant.plan??'solo']??49}/mês</div>
            </div>
          </div>
          <div class="two-col">
            <div class="card">
              <div class="card-header"><div class="card-title">Informações</div></div>
              <div class="card-body">
                <div class="stat-row"><span class="stat-label">Status</span><span class="stat-value">${statusBadge(tenant.status)}</span></div>
                <div class="stat-row"><span class="stat-label">Criado em</span><span class="stat-value">${new Date(tenant.createdAt).toLocaleDateString("pt-BR")}</span></div>
                <div class="stat-row"><span class="stat-label">Trial até</span><span class="stat-value">${trialDaysLeft(tenant.trialEndsAt)}</span></div>
                <div class="stat-row"><span class="stat-label">Plano</span><span class="stat-value">${planLabel(tenant.plan)}</span></div>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><div class="card-title">Ações</div></div>
              <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
                ${tenant.status === "active" || tenant.status === "trial"
                  ? `<a href="/superadmin/tenants/action?id=${tenant.id}&act=suspend" class="btn btn-red" onclick="return confirm('Suspender ${esc(tenant.name)}?')">🔒 Suspender acesso</a>`
                  : `<a href="/superadmin/tenants/action?id=${tenant.id}&act=reactivate" class="btn btn-green">🔓 Reativar</a>`
                }
                <a href="/superadmin/planos/extend-trial?id=${tenant.id}" class="btn btn-gold">⏳ Estender trial</a>
              </div>
            </div>
          </div>
        </div>
      `));
    } catch (e: any) {
      res.status(500).send(layout("Erro", session, `<div class="error-state"><div class="error-state-icon">⚠️</div><h3 class="error-state-title">Erro</h3><p class="error-state-desc">${esc(e.message)}</p></div>`));
    }
  });

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
          <td style="white-space:nowrap;color:var(--text-muted)">${new Date(l.createdAt).toLocaleString("pt-BR")}</td>
          <td><span class="badge" style="background:var(--bg-input);color:var(--text-muted)">${esc(l.source ?? "browser")}</span></td>
          <td>
            <div style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.message)}</div>
            ${l.stack ? `<div class="stack-box">${esc(l.stack)}</div>` : ""}
          </td>
          <td class="text-sm text-mono" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(l.url ?? "—")}</td>
          <td style="color:var(--text-muted)">${l.tenantId ?? "—"}</td>
        </tr>
      `).join("");

      const filterBar = `
        <form method="GET" action="/superadmin/erros" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px">
          <div style="flex:1;min-width:200px">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">BUSCAR</label>
            <input name="search" value="${esc(searchErr)}" placeholder="Mensagem ou URL..." style="width:100%;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">ORIGEM</label>
            <select name="source" style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px">
              <option value="all" ${errSource === "all" ? "selected" : ""}>Todas</option>
              <option value="browser" ${errSource === "browser" ? "selected" : ""}>Browser</option>
              <option value="server" ${errSource === "server" ? "selected" : ""}>Servidor</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">DE</label>
            <input type="date" name="dateFrom" value="${esc(errDateFrom)}" style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">ATÉ</label>
            <input type="date" name="dateTo" value="${esc(errDateTo)}" style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px" />
          </div>
          <button type="submit" class="btn btn-gold">Filtrar</button>
          <a href="/superadmin/erros" class="btn btn-gray">Limpar</a>
        </form>
      `;

      res.send(layout("Erros", session, `
        <div class="container">
          <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><span class="bc-current">Erros</span></div>
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
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--danger);margin-top:40px">Erro ao carregar logs.</p></div>`));
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
          <td style="color:var(--text-muted)">${new Date(l.createdAt).toLocaleString("pt-BR")}</td>
        </tr>
      `).join("");

      const filterBar = `
        <form method="GET" action="/superadmin/leads" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px">
          <div style="flex:1;min-width:180px">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">BUSCAR</label>
            <input name="search" value="${esc(search)}" placeholder="Nome, e-mail ou telefone..." style="width:100%;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">DE</label>
            <input type="date" name="dateFrom" value="${esc(dateFrom)}" style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">ATÉ</label>
            <input type="date" name="dateTo" value="${esc(dateTo)}" style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px" />
          </div>
          <button type="submit" class="btn btn-gold">Filtrar</button>
          <a href="/superadmin/leads" class="btn btn-gray">Limpar</a>
          <a href="/superadmin/leads?export=csv${search ? '&search=' + encodeURIComponent(search) : ''}${dateFrom ? '&dateFrom=' + dateFrom : ''}${dateTo ? '&dateTo=' + dateTo : ''}" class="btn btn-gray" style="margin-left:auto">↓ Exportar CSV</a>
        </form>
      `;

      res.send(layout("Leads", session, `
        <div class="container">
          <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><span class="bc-current">Leads</span></div>
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
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--danger);margin-top:40px">Erro ao carregar leads.</p></div>`));
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
          <td style="color:var(--text-muted)">${new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
          <td>
            ${u.email !== session.email ? `
            <div class="actions">
              <button class="btn btn-gold" onclick="openUserModal(${u.id}, '${esc(u.name)}', '${esc(u.email)}', '${esc(u.role)}', ${u.isActive ? 1 : 0})">Editar</button>
              <a href="/superadmin/usuarios/toggle?id=${u.id}&active=${u.isActive ? 0 : 1}" class="btn ${u.isActive ? "btn-red" : "btn-green"}" onclick="return confirm('${u.isActive ? "Desativar" : "Ativar"} este usuário?')">${u.isActive ? "Desativar" : "Ativar"}</a>
            </div>` : '<span style="color:var(--text-muted);font-size:12px">Você</span>'}
          </td>
        </tr>
      `).join("");

      res.send(layout("Usuários", session, `
        <div class="container">
          <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><span class="bc-current">Usuários</span></div>
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
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--danger);margin-top:40px">Erro ao carregar usuários.</p></div>`));
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
        <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><span class="bc-current">CMS</span></div>
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

          <div style="margin-top:20px;border-top:1px solid var(--border-subtle);padding-top:16px">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">DEPOIMENTOS SALVOS NO BANCO</div>
            <div id="depoimentos-list" style="color:var(--text-muted);font-size:13px">
              Os depoimentos salvos aparecerão aqui. Esta funcionalidade requer integração com a tabela <code>landing_testimonials</code> no banco.
            </div>
          </div>
        </div>

        <div class="cms-card">
          <h3>💰 Planos Exibidos na Landing Page</h3>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Os planos abaixo são exibidos na seção de preços da landing page. Edite os valores e salve para atualizar.</p>
          <form method="POST" action="/superadmin/cms/planos">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">
              ${[
                { key: "solo", label: "Solo", price: "49", desc: "1 barbeiro, agendamento online, financeiro básico" },
                { key: "team", label: "Equipe", price: "89", desc: "Até 5 barbeiros, relatórios avançados, fidelidade" },
                { key: "studio", label: "Estúdio", price: "149", desc: "Ilimitado, multi-unidade, suporte prioritário" },
              ].map((p) => `
                <div style="background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:12px;padding:16px">
                  <div style="font-weight:700;margin-bottom:10px;color:var(--gold-500)">${p.label}</div>
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

  // --- Suporte Interno ---
  app.get("/superadmin/suporte", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const statusFilter = (req.query.status as string) || '';
    const tickets = await db.getAllSupportTickets(statusFilter ? { status: statusFilter } : undefined);
    const statusLabels: Record<string, string> = { open: 'Aberto', waiting_admin: 'Aguardando', answered: 'Respondido', closed: 'Fechado' };
    const statusColors: Record<string, string> = { open: '#F87171', waiting_admin: '#FBBF24', answered: '#60A5FA', closed: '#4ADE80' };
    const priorityLabels: Record<string, string> = { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baixa' };
    const priorityColors: Record<string, string> = { urgent: '#F87171', high: '#FBBF24', normal: '#60A5FA', low: '#888' };
    const openCount = tickets.filter((t: any) => ['open','waiting_admin'].includes(t.status)).length;
    res.send(layout("Suporte", session, `
        <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><span class="bc-current">Suporte</span></div>
        <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div class="page-title">Suporte Interno</div>
            <div class="page-sub">Tickets abertos pelos assinantes</div>
          </div>
          ${openCount > 0 ? `<span style="background:#F8717122;color:#F87171;border:1px solid #F8717144;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700">${openCount} aberto${openCount > 1 ? 's' : ''}</span>` : ''}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
          ${['','open','waiting_admin','answered','closed'].map(s => `<a href="/superadmin/suporte${s ? '?status='+s : ''}" class="btn ${statusFilter === s ? 'btn-gold' : 'btn-gray'}">${s ? (statusLabels[s] || s) : 'Todos'}</a>`).join('')}
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>#</th><th>Barbearia</th><th>Titulo</th><th>Categoria</th>
              <th>Status</th><th>Prioridade</th><th>Msgs</th><th>Atualizado</th><th>Acoes</th>
            </tr></thead>
            <tbody>
              ${tickets.length === 0 ? `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px">Nenhum ticket encontrado</td></tr>` : ''}
              ${tickets.map((t: any) => `
                <tr>
                  <td style="color:var(--text-muted);font-size:12px">#${t.id}</td>
                  <td><strong>${esc(t.tenantName || 'N/A')}</strong></td>
                  <td style="max-width:220px"><a href="/superadmin/suporte/${t.id}" style="color:var(--text-primary);font-weight:600">${esc(t.title)}</a></td>
                  <td><span class="badge" style="background:#C9A84C22;color:var(--gold-500)">${esc(t.category)}</span></td>
                  <td><span class="badge" style="background:${statusColors[t.status] || '#888'}22;color:${statusColors[t.status] || '#888'}">${statusLabels[t.status] || t.status}</span></td>
                  <td><span class="badge" style="background:${priorityColors[t.priority] || '#888'}22;color:${priorityColors[t.priority] || '#888'}">${priorityLabels[t.priority] || t.priority}</span></td>
                  <td style="text-align:center">${t.messageCount}</td>
                  <td style="color:var(--text-muted);font-size:12px">${new Date(t.updatedAt).toLocaleDateString('pt-BR')}</td>
                  <td class="actions">
                    <a href="/superadmin/suporte/${t.id}" class="btn btn-gold">Ver</a>
                    ${t.status !== 'closed' ? `<a href="/superadmin/suporte/${t.id}/fechar" class="btn btn-gray">Fechar</a>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `));
  });

  app.get("/superadmin/suporte/:id", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) return res.redirect("/superadmin/suporte");
    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) return res.redirect("/superadmin/suporte");
    const messages = await db.getSupportMessages(ticketId);
    const statusLabels: Record<string, string> = { open: 'Aberto', waiting_admin: 'Aguardando', answered: 'Respondido', closed: 'Fechado' };
    const statusColors: Record<string, string> = { open: '#F87171', waiting_admin: '#FBBF24', answered: '#60A5FA', closed: '#4ADE80' };
    const saved = req.query.saved === '1';
    res.send(layout("Suporte", session, `
      <div class="container" style="max-width:800px">
        <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><a href="/superadmin/suporte" class="bc-link">Suporte</a><span class="bc-sep">›</span><span class="bc-current">Ticket #${ticketId}</span></div>
        <div style="margin-bottom:20px"><a href="/superadmin/suporte" class="btn btn-gray">Voltar</a></div>
        ${saved ? `<div style="background:#4ADE8022;color:#4ADE80;border:1px solid #4ADE8044;border-radius:12px;padding:12px 18px;margin-bottom:16px">Resposta enviada!</div>` : ''}
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:16px;padding:24px;margin-bottom:20px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px">
            <div>
              <div style="font-size:18px;font-weight:800;margin-bottom:6px">${esc(ticket.title)}</div>
              <div style="font-size:12px;color:var(--text-muted)">Barbearia: <strong style="color:var(--text-primary)">${esc(ticket.tenantName || 'N/A')}</strong> &nbsp;|&nbsp; Categoria: ${esc(ticket.category)} &nbsp;|&nbsp; Prioridade: ${esc(ticket.priority)}</div>
            </div>
            <span class="badge" style="background:${statusColors[ticket.status] || '#888'}22;color:${statusColors[ticket.status] || '#888'};white-space:nowrap">${statusLabels[ticket.status] || ticket.status}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${ticket.status !== 'closed' ? `<a href="/superadmin/suporte/${ticketId}/fechar" class="btn btn-gray">Fechar Ticket</a>` : ''}
            ${ticket.status === 'open' || ticket.status === 'waiting_admin' ? `<a href="/superadmin/suporte/${ticketId}/status/answered" class="btn btn-blue">Marcar Respondido</a>` : ''}
          </div>
        </div>
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:16px;overflow:hidden;margin-bottom:20px">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle);font-weight:700;font-size:14px">Conversa (${messages.length} mensagens)</div>
          <div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px;max-height:500px;overflow-y:auto">
            ${messages.map((m: any) => `
              <div style="display:flex;flex-direction:column;align-items:${m.authorType === 'admin' ? 'flex-end' : 'flex-start'}">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">
                  ${m.authorType === 'admin' ? 'Admin' : m.authorType === 'ai' ? 'IA' : 'Cliente: ' + esc(m.authorName || '')}
                  &nbsp;|&nbsp; ${new Date(m.createdAt).toLocaleString('pt-BR')}
                </div>
                <div style="background:${m.authorType === 'admin' ? '#C9A84C22' : m.authorType === 'ai' ? '#60A5FA22' : 'var(--bg-input)'};border:1px solid ${m.authorType === 'admin' ? '#C9A84C44' : m.authorType === 'ai' ? '#60A5FA44' : 'var(--border-subtle)'};border-radius:12px;padding:10px 14px;max-width:80%;font-size:13px;line-height:1.5;white-space:pre-wrap">${esc(m.content)}</div>
              </div>
            `).join('')}
          </div>
        </div>
        ${ticket.status !== 'closed' ? `
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:16px;padding:20px">
          <div style="font-weight:700;font-size:14px;margin-bottom:12px">Responder</div>
          <form method="POST" action="/superadmin/suporte/${ticketId}/responder">
            <textarea name="content" rows="4" placeholder="Digite sua resposta..." style="width:100%;resize:vertical" required></textarea>
            <div style="margin-top:10px">
              <button type="submit" class="btn btn-primary">Enviar Resposta</button>
            </div>
          </form>
        </div>` : `<div style="text-align:center;padding:20px;color:var(--text-muted)">Ticket fechado.</div>`}
      </div>
    `));
  });

  app.post("/superadmin/suporte/:id/responder", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const ticketId = parseInt(req.params.id);
    const { content } = req.body as { content: string };
    if (!isNaN(ticketId) && content?.trim()) {
      await db.addSupportMessage({ ticketId, authorType: 'admin', authorName: session.name, content: content.trim() });
      await db.updateTicketStatus(ticketId, 'answered');
    }
    res.redirect(`/superadmin/suporte/${ticketId}?saved=1`);
  });

  app.get("/superadmin/suporte/:id/fechar", requireAuth, async (req: Request, res: Response) => {
    const ticketId = parseInt(req.params.id);
    if (!isNaN(ticketId)) await db.updateTicketStatus(ticketId, 'closed');
    res.redirect("/superadmin/suporte");
  });

  app.get("/superadmin/suporte/:id/status/:status", requireAuth, async (req: Request, res: Response) => {
    const ticketId = parseInt(req.params.id);
    const status = req.params.status;
    if (!isNaN(ticketId) && ['open','waiting_admin','answered','closed'].includes(status)) {
      await db.updateTicketStatus(ticketId, status);
    }
    res.redirect(`/superadmin/suporte/${ticketId}`);
  });

  // ── GET /superadmin/planos — Painel de Planos Barber Pro ────────────────────
  app.get("/superadmin/planos", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const saved = req.query.saved === '1';
    const error = req.query.error ? decodeURIComponent(req.query.error as string) : null;

    const activeTab = (req.query.tab as string) ?? 'todos';

    // Buscar todos os tenants com dados de assinatura
    const allTenants = await db.getAllTenants();
    const dbConn = await db.getDb();

    // Buscar dados de assinatura Barber Pro de todos os tenants
    let tenantsWithSub: any[] = [];
    if (dbConn) {
      try {
        const { sql: sqlTag } = await import('drizzle-orm');
        const rows = await dbConn.execute(sqlTag`
          SELECT
            t.id, t.name, t.slug, t.plan, t.status,
            t."barberproSubscriptionId", t."barberproSubscriptionStatus",
            t."barberproPlanName", t."barberproPlanPrice",
            t."barberproNextDueDate", t."barberproAsaasCustomerId",
            t."trialEndsAt",
            t."createdAt"
          FROM tenants t
          ORDER BY t."createdAt" DESC
        `);
        tenantsWithSub = ((rows as any).rows ?? []) as any[];
      } catch (e) {
        tenantsWithSub = allTenants.map((t: any) => t);
      }
    } else {
      tenantsWithSub = allTenants.map((t: any) => t);
    }

    // Filtrar barbearias em trial (vencimento nos próximos 7 dias ou já expirado)
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000);
    const trialList = tenantsWithSub.filter((t: any) => {
      const status = t.barberproSubscriptionStatus ?? 'trial';
      return (status === 'trial' || status === 'expired') && t.trialEndsAt;
    }).sort((a: any, b: any) => {
      const da = new Date(a.trialEndsAt).getTime();
      const db2 = new Date(b.trialEndsAt).getTime();
      return da - db2;
    });

    // Estatísticas
    const totalTenants = tenantsWithSub.length;
    const activeSubscriptions = tenantsWithSub.filter((t: any) => t.barberproSubscriptionStatus === 'active').length;
    const pendingSubscriptions = tenantsWithSub.filter((t: any) => t.barberproSubscriptionStatus === 'pending').length;
    const trialTenants = tenantsWithSub.filter((t: any) => !t.barberproSubscriptionStatus || t.barberproSubscriptionStatus === 'trial').length;

    // Churn: barbearias que cancelaram ou expiraram nos últimos 30 dias
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const churnList = tenantsWithSub.filter((t: any) => {
      const status = t.barberproSubscriptionStatus ?? 'trial';
      if (status !== 'cancelled' && status !== 'expired' && status !== 'overdue') return false;
      const refDate = t.barberproNextDueDate ? new Date(t.barberproNextDueDate + 'T12:00:00') :
                      t.trialEndsAt ? new Date(t.trialEndsAt) : null;
      if (!refDate) return status === 'cancelled';
      return refDate >= thirtyDaysAgo;
    }).sort((a: any, b: any) => {
      const da = a.barberproNextDueDate ? new Date(a.barberproNextDueDate + 'T12:00:00').getTime() : 0;
      const db2 = b.barberproNextDueDate ? new Date(b.barberproNextDueDate + 'T12:00:00').getTime() : 0;
      return db2 - da;
    });

    // Taxa de conversão e churn rate
    const conversionRate = totalTenants > 0 ? Math.round((activeSubscriptions / totalTenants) * 100) : 0;
    const churnRate = activeSubscriptions > 0 ? Math.round((churnList.length / activeSubscriptions) * 100) : 0;

    // MRR por plano
    const planPriceMap: Record<string, number> = { solo: 49, team: 89, studio: 149 };
    const activeSubs = tenantsWithSub.filter((t: any) => t.barberproSubscriptionStatus === 'active');
    const mrrTotal = activeSubs.reduce((sum: number, t: any) => {
      const price = t.barberproPlanPrice ? parseFloat(t.barberproPlanPrice) : (planPriceMap[t.barberproPlanName ?? t.plan] ?? 0);
      return sum + price;
    }, 0);

    const planCounts = { solo: 0, team: 0, studio: 0 };
    activeSubs.forEach((t: any) => {
      const p = (t.barberproPlanName ?? t.plan) as keyof typeof planCounts;
      if (p in planCounts) planCounts[p]++;
    });

    const bpStatusLabel: Record<string, string> = {
      active: '🟢 Ativa', pending: '🟡 Aguardando pagamento',
      overdue: '🔴 Em atraso', cancelled: '⚫ Cancelada',
      trial: '🟡 Trial', undefined: '⚪ Sem assinatura',
    };
    const bpStatusColor: Record<string, string> = {
      active: '#4ADE80', pending: '#FBBF24', overdue: '#F87171',
      cancelled: '#888', trial: '#FBBF24',
    };
    const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };

    res.send(layout("Planos", session, `
      <div class="container">
        <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><span class="bc-current">Planos</span></div>
        ${saved ? `<div style="background:#4ADE8022;color:#4ADE80;border:1px solid #4ADE8044;border-radius:12px;padding:12px 18px;margin-bottom:20px">✅ Plano atualizado com sucesso!</div>` : ''}
        ${error ? `<div style="background:#F8717122;color:#F87171;border:1px solid #F8717144;border-radius:12px;padding:12px 18px;margin-bottom:20px">⚠️ ${esc(error)}</div>` : ''}

        <div class="page-header">
          <div class="page-title">Planos Barber Pro</div>
          <div class="page-sub">Gerenciamento de assinaturas e planos dos assinantes</div>
        </div>

        <!-- Métricas -->
        <div class="metrics">
          <div class="metric-card">
            <div class="metric-label">MRR Total</div>
            <div class="metric-value">R$ ${mrrTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>
            <div class="metric-sub">receita mensal recorrente</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Assinaturas Ativas</div>
            <div class="metric-value" style="color:#4ADE80">${activeSubscriptions}</div>
            <div class="metric-sub">de ${totalTenants} barbearias</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Aguardando Pagamento</div>
            <div class="metric-value" style="color:#FBBF24">${pendingSubscriptions}</div>
            <div class="metric-sub">pagamentos pendentes</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Em Trial / Sem Plano</div>
            <div class="metric-value" style="color:var(--text-muted)">${trialTenants}</div>
            <div class="metric-sub">não assinantes</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Taxa de Conversão</div>
            <div class="metric-value" style="color:${conversionRate >= 50 ? '#4ADE80' : conversionRate >= 25 ? '#FBBF24' : '#F87171'}">${conversionRate}%</div>
            <div class="metric-sub">trial → assinante</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Churn (30 dias)</div>
            <div class="metric-value" style="color:${churnRate === 0 ? '#4ADE80' : churnRate <= 5 ? '#FBBF24' : '#F87171'}">${churnList.length}</div>
            <div class="metric-sub">${churnRate}% dos ativos</div>
          </div>
        </div>

        <!-- Distribuição por plano -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px">
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:14px;padding:18px 20px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px">SOLO — R$49/mês</div>
            <div style="font-size:32px;font-weight:900;color:var(--text-muted)">${planCounts.solo}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">1 barbeiro</div>
          </div>
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:14px;padding:18px 20px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px">EQUIPE — R$89/mês</div>
            <div style="font-size:32px;font-weight:900;color:var(--gold-500)">${planCounts.team}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">até 5 barbeiros</div>
          </div>
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:14px;padding:18px 20px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px">ESTÚDIO — R$149/mês</div>
            <div style="font-size:32px;font-weight:900;color:#C084FC">${planCounts.studio}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">ilimitado</div>
          </div>
        </div>

        <!-- Abas de navegação -->
        <div style="display:flex;gap:4px;margin-bottom:24px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:12px;padding:4px">
          <a href="/superadmin/planos?tab=todos" style="flex:1;text-align:center;padding:10px 16px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none;${activeTab === 'todos' ? 'background:var(--gold-500);color:#0C0C0C' : 'color:var(--text-muted)'}">
            Todas (${totalTenants})
          </a>
          <a href="/superadmin/planos?tab=trial" style="flex:1;text-align:center;padding:10px 16px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none;${activeTab === 'trial' ? 'background:var(--gold-500);color:#0C0C0C' : 'color:var(--text-muted)'}">
            Trial / Expirado (${trialList.length})
          </a>
          <a href="/superadmin/planos?tab=churn" style="flex:1;text-align:center;padding:10px 16px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none;${activeTab === 'churn' ? 'background:#F87171;color:#fff' : 'color:var(--text-muted)'}">
            Churn 30d (${churnList.length})
          </a>
        </div>

        ${activeTab === 'trial' ? `
        <!-- Tabela de barbearias em trial -->
        <div class="table-wrap">
          <div class="table-header">
            <h2>Barbearias em Trial / Expirado</h2>
            <span style="font-size:12px;color:var(--text-muted)">${trialList.length} barbearias</span>
          </div>
          <table>
            <thead><tr>
              <th>Barbearia</th>
              <th>Status</th>
              <th>Trial Expira em</th>
              <th>Dias Restantes</th>
              <th>Ações</th>
            </tr></thead>
            <tbody>
              ${trialList.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px">Nenhuma barbearia em trial</td></tr>` : ''}
              ${trialList.map((t: any) => {
                const trialEnd = new Date(t.trialEndsAt);
                const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000);
                const isExpired = daysLeft < 0;
                const isUrgent = daysLeft >= 0 && daysLeft <= 3;
                const daysColor = isExpired ? '#F87171' : isUrgent ? '#FBBF24' : '#4ADE80';
                const daysLabel = isExpired ? `Expirou há ${Math.abs(daysLeft)} dia(s)` : `${daysLeft} dia(s) restantes`;
                const status = t.barberproSubscriptionStatus ?? 'trial';
                return `
                  <tr>
                    <td>
                      <div style="font-weight:700">${esc(t.name)}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${esc(t.slug)}</div>
                    </td>
                    <td>
                      <span style="color:${isExpired ? '#F87171' : '#FBBF24'};font-weight:600;font-size:12px">
                        ${isExpired ? '🔴 Expirado' : '🟡 Trial'}
                      </span>
                    </td>
                    <td style="color:var(--text-muted);font-size:12px">${trialEnd.toLocaleDateString('pt-BR')}</td>
                    <td style="font-weight:700;color:${daysColor};font-size:13px">${daysLabel}</td>
                    <td class="actions">
                      <form method="POST" action="/superadmin/planos/extend-trial/${t.id}" style="display:inline">
                        <select name="days" style="background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);border-radius:6px;padding:4px 8px;font-size:12px;margin-right:4px">
                          <option value="7">+7 dias</option>
                          <option value="14">+14 dias</option>
                          <option value="30" selected>+30 dias</option>
                          <option value="60">+60 dias</option>
                        </select>
                        <button type="submit" class="btn btn-gold" style="font-size:12px;padding:6px 14px">Estender Trial</button>
                      </form>
                      <a href="/superadmin/planos/editar/${t.id}" class="btn btn-gray" style="font-size:12px;padding:6px 14px">Editar</a>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${activeTab === 'churn' ? `
        <!-- Tabela de churn -->
        <div class="table-wrap">
          <div class="table-header">
            <h2>Churn — Cancelamentos e Expirações (30 dias)</h2>
            <span style="font-size:12px;color:var(--text-muted)">${churnList.length} barbearia(s) • taxa: ${churnRate}% dos ativos</span>
          </div>
          <table>
            <thead><tr>
              <th>Barbearia</th>
              <th>Motivo</th>
              <th>Plano</th>
              <th>Valor Perdido/mês</th>
              <th>Data Referência</th>
              <th>Ações</th>
            </tr></thead>
            <tbody>
              ${churnList.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">🎉 Nenhum cancelamento nos últimos 30 dias!</td></tr>` : ''}
              ${churnList.map((t: any) => {
                const status = t.barberproSubscriptionStatus ?? 'cancelled';
                const planName = t.barberproPlanName ?? t.plan ?? 'solo';
                const planLabel2 = planLabelMap[planName] ?? planName;
                const planPrice2 = t.barberproPlanPrice ? parseFloat(t.barberproPlanPrice) : (planPriceMap[planName] ?? 0);
                const refDate = t.barberproNextDueDate
                  ? new Date(t.barberproNextDueDate + 'T12:00:00').toLocaleDateString('pt-BR')
                  : t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString('pt-BR') : '—';
                const motivo = status === 'cancelled' ? '⚫ Cancelamento' : status === 'expired' ? '🔴 Trial Expirado' : '🟠 Em Atraso';
                const motivoColor = status === 'cancelled' ? '#888' : status === 'expired' ? '#F87171' : '#FBBF24';
                return `
                  <tr>
                    <td>
                      <div style="font-weight:700">${esc(t.name)}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${esc(t.slug)}</div>
                    </td>
                    <td><span style="color:${motivoColor};font-weight:600;font-size:12px">${motivo}</span></td>
                    <td style="font-weight:700;color:${planName === 'studio' ? '#C084FC' : planName === 'team' ? 'var(--gold-500)' : 'var(--text-muted)'}">${planLabel2}</td>
                    <td style="font-weight:800;color:#F87171;font-size:14px">${planPrice2 > 0 ? `− R$ ${planPrice2.toFixed(2).replace('.', ',')}` : '—'}</td>
                    <td style="color:var(--text-muted);font-size:12px">${refDate}</td>
                    <td class="actions">
                      <a href="/superadmin/planos/editar/${t.id}" class="btn btn-gold" style="font-size:12px;padding:6px 14px">Reativar</a>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${activeTab === 'todos' ? `
        <!-- Tabela de assinantes -->
        <div class="table-wrap">
          <div class="table-header">
            <h2>Todas as Barbearias</h2>
            <span style="font-size:12px;color:var(--text-muted)">${totalTenants} cadastradas</span>
          </div>
          <table>
            <thead><tr>
              <th>Barbearia</th>
              <th>Plano Barber Pro</th>
              <th>Status Assinatura</th>
              <th>Valor/mês</th>
              <th>Próx. Vencimento</th>
              <th>ID Asaas</th>
              <th>Ações</th>
            </tr></thead>
            <tbody>
              ${tenantsWithSub.length === 0 ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">Nenhuma barbearia cadastrada</td></tr>` : ''}
              ${tenantsWithSub.map((t: any) => {
                const subStatus = t.barberproSubscriptionStatus ?? 'trial';
                const planName = t.barberproPlanName ?? t.plan ?? 'solo';
                const planPrice = t.barberproPlanPrice ? parseFloat(t.barberproPlanPrice) : (planPriceMap[planName] ?? 0);
                const nextDue = t.barberproNextDueDate ? new Date(t.barberproNextDueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
                const subId = t.barberproSubscriptionId ?? '';
                const statusColor = bpStatusColor[subStatus] ?? '#888';
                const statusLbl = bpStatusLabel[subStatus] ?? subStatus;
                return `
                  <tr>
                    <td>
                      <div style="font-weight:700">${esc(t.name)}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${esc(t.slug)}</div>
                    </td>
                    <td>
                      <span style="font-weight:700;color:${planName === 'studio' ? '#C084FC' : planName === 'team' ? 'var(--gold-500)' : 'var(--text-muted)'}">
                        ${planLabelMap[planName] ?? planName}
                      </span>
                    </td>
                    <td>
                      <span style="color:${statusColor};font-weight:600;font-size:12px">${statusLbl}</span>
                    </td>
                    <td style="font-weight:700;color:var(--text-primary)">
                      ${planPrice > 0 ? `R$ ${planPrice.toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                    <td style="color:var(--text-muted);font-size:12px">${nextDue}</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:monospace">
                      ${subId ? `<span title="${esc(subId)}">${esc(subId.slice(0, 12))}...</span>` : '—'}
                    </td>
                    <td class="actions">
                      <a href="/superadmin/planos/editar/${t.id}" class="btn btn-gold">Editar Plano</a>
                      ${subStatus === 'active' ? `<a href="/superadmin/planos/cancelar/${t.id}" class="btn btn-red" onclick="return confirm('Cancelar assinatura de ${esc(t.name)}?')">Cancelar</a>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
      </div>
    `));
  });

  // ── POST /superadmin/planos/extend-trial/:id — Estender trial manualmente
  app.post("/superadmin/planos/extend-trial/:id", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
    const tenantId = parseInt(req.params.id);
    if (isNaN(tenantId)) return res.redirect("/superadmin/planos?tab=trial");
    try {
      const days = parseInt((req.body as any)?.days ?? '30');
      if (isNaN(days) || days < 1 || days > 365) throw new Error('Dias inválidos');
      const dbConn = await db.getDb();
      if (!dbConn) throw new Error('Banco indisponível');
      const { sql: sqlTag } = await import('drizzle-orm');
      // Estender a partir de hoje ou da data de expiração atual, o que for maior
      await dbConn.execute(sqlTag`
        UPDATE tenants SET
          "trialEndsAt" = GREATEST(NOW(), "trialEndsAt") + INTERVAL '${days} days',
          "barberproSubscriptionStatus" = 'trial',
          "updatedAt" = NOW()
        WHERE id = ${tenantId}
      `);
      res.redirect("/superadmin/planos?tab=trial&saved=1");
    } catch (e: any) {
      res.redirect(`/superadmin/planos?tab=trial&error=${encodeURIComponent(e.message)}`);
    }
  });

  // ── GET /superadmin/planos/editar/:id — Formulário de edição de plano ────────
  app.get("/superadmin/planos/editar/:id", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    const tenantId = parseInt(req.params.id);
    if (isNaN(tenantId)) return res.redirect("/superadmin/planos");

    const dbConn = await db.getDb();
    if (!dbConn) return res.redirect("/superadmin/planos?error=Banco+indispon%C3%ADvel");

    const { sql: sqlTag } = await import('drizzle-orm');
    const rows = await dbConn.execute(sqlTag`
      SELECT id, name, slug, plan, status,
        "barberproSubscriptionId", "barberproSubscriptionStatus",
        "barberproPlanName", "barberproPlanPrice", "barberproNextDueDate"
      FROM tenants WHERE id = ${tenantId} LIMIT 1
    `);
    const tenant = ((rows as any).rows ?? [])[0];
    if (!tenant) return res.redirect("/superadmin/planos");

    const saved = req.query.saved === '1';
    res.send(layout("Planos", session, `
      <div class="container" style="max-width:600px">
        <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><a href="/superadmin/planos" class="bc-link">Planos</a><span class="bc-sep">›</span><span class="bc-current">Editar Plano</span></div>
        ${saved ? `<div style="background:#4ADE8022;color:#4ADE80;border:1px solid #4ADE8044;border-radius:12px;padding:12px 18px;margin-bottom:20px">✅ Plano atualizado!</div>` : ''}
        <div style="margin-bottom:20px"><a href="/superadmin/planos" class="btn btn-gray">← Voltar</a></div>
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:16px;padding:28px">
          <div style="font-size:18px;font-weight:800;margin-bottom:4px">${esc(tenant.name)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:24px">${esc(tenant.slug)}</div>

          <form method="POST" action="/superadmin/planos/editar/${tenantId}">
            <div class="form-group">
              <label>Plano Barber Pro</label>
              <select name="planName">
                <option value="solo" ${(tenant.barberproPlanName ?? tenant.plan) === 'solo' ? 'selected' : ''}>Solo — R$ 49/mês (1 barbeiro)</option>
                <option value="team" ${(tenant.barberproPlanName ?? tenant.plan) === 'team' ? 'selected' : ''}>Equipe — R$ 89/mês (até 5 barbeiros)</option>
                <option value="studio" ${(tenant.barberproPlanName ?? tenant.plan) === 'studio' ? 'selected' : ''}>Estúdio — R$ 149/mês (ilimitado)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Status da Assinatura</label>
              <select name="subscriptionStatus">
                <option value="trial" ${(tenant.barberproSubscriptionStatus ?? 'trial') === 'trial' ? 'selected' : ''}>Trial</option>
                <option value="active" ${tenant.barberproSubscriptionStatus === 'active' ? 'selected' : ''}>Ativa</option>
                <option value="pending" ${tenant.barberproSubscriptionStatus === 'pending' ? 'selected' : ''}>Aguardando Pagamento</option>
                <option value="overdue" ${tenant.barberproSubscriptionStatus === 'overdue' ? 'selected' : ''}>Em Atraso</option>
                <option value="cancelled" ${tenant.barberproSubscriptionStatus === 'cancelled' ? 'selected' : ''}>Cancelada</option>
              </select>
            </div>
            <div class="form-group">
              <label>Próximo Vencimento (YYYY-MM-DD)</label>
              <input type="date" name="nextDueDate" value="${esc(tenant.barberproNextDueDate ?? '')}" />
            </div>
            <div class="form-group">
              <label>ID da Assinatura Asaas (opcional)</label>
              <input type="text" name="subscriptionId" value="${esc(tenant.barberproSubscriptionId ?? '')}" placeholder="sub_xxxxxxxx" style="font-family:monospace" />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;padding:12px">Salvar Alterações</button>
          </form>
        </div>
      </div>
    `));
  });

  // ── POST /superadmin/planos/editar/:id — Salvar edição de plano ─────────────
  app.post("/superadmin/planos/editar/:id", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
    const tenantId = parseInt(req.params.id);
    if (isNaN(tenantId)) return res.redirect("/superadmin/planos");

    const { planName, subscriptionStatus, nextDueDate, subscriptionId } = req.body as {
      planName: string; subscriptionStatus: string; nextDueDate: string; subscriptionId: string;
    };

    const planPriceMap: Record<string, number> = { solo: 49, team: 89, studio: 149 };
    const planPrice = planPriceMap[planName] ?? 49;

    try {
      const dbConn = await db.getDb();
      if (!dbConn) throw new Error("Banco indisponível");
      const { sql: sqlTag } = await import('drizzle-orm');

      // Usar db.updateTenant para garantir cast correto do enum plan via Drizzle ORM
      await db.updateTenant(tenantId, {
        plan: planName as any,
        barberproPlanName: planName,
        barberproPlanPrice: String(planPrice),
        barberproSubscriptionStatus: subscriptionStatus,
        barberproNextDueDate: nextDueDate || null,
        barberproSubscriptionId: subscriptionId || null,
        updatedAt: new Date(),
      });

      res.redirect(`/superadmin/planos/editar/${tenantId}?saved=1`);
    } catch (e: any) {
      res.redirect(`/superadmin/planos?error=${encodeURIComponent(e.message)}`);
    }
  });

  // ── GET /superadmin/planos/cancelar/:id — Cancelar assinatura ────────────────────
  app.get("/superadmin/planos/cancelar/:id", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
    const tenantId = parseInt(req.params.id);
    if (isNaN(tenantId)) return res.redirect("/superadmin/planos");
    try {
      const dbConn = await db.getDb();
      if (!dbConn) throw new Error("Banco indisponível");
      const { sql: sqlTag } = await import('drizzle-orm');
      await dbConn.execute(sqlTag`
        UPDATE tenants SET
          "barberproSubscriptionStatus" = 'cancelled',
          "updatedAt" = NOW()
        WHERE id = ${tenantId}
      `);
      res.redirect("/superadmin/planos?saved=1");
    } catch (e: any) {
      res.redirect(`/superadmin/planos?error=${encodeURIComponent(e.message)}`);
    }
  });

  // ── GET /superadmin/email-preview — Preview dos templates de e-mail ───────────
  app.get("/superadmin/email-preview", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
    const template = (req.query.template as string) ?? "booking";

    const {
      emailLayout, alertBox, ctaButton, detailRow,
      sendBookingConfirmationEmail, sendBarberNotificationEmail,
    } = await import("./email");

    // Dados de exemplo para cada template
    const today = new Date();
    const dateStr = today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const dateShort = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const templates: Record<string, { title: string; html: string }> = {
      booking: {
        title: "Confirmação de Agendamento (cliente)",
        html: (() => {
          const body = `
            ${alertBox("✅", "Agendamento confirmado!", "Seu horário está reservado", "#4ADE80")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Olá, <strong style="color:#ECEDEE">João Silva</strong>! Seu agendamento na
              <strong style="color:#ECEDEE">Barbearia Exemplo</strong> está confirmado.
            </p>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${detailRow("Serviço", "Corte + Barba")}
                ${detailRow("Barbeiro", "Carlos Mendes")}
                ${detailRow("Data", dateStr)}
                ${detailRow("Horário", "14:00 — 15:00")}
                ${detailRow("Valor", "R$ 55,00", "#4ADE80", true)}
              </table>
            </div>
            ${ctaButton("Ver meu agendamento →", "https://usebarberpro.com/barbearia-exemplo")}`;
          return emailLayout(body, { headerSubtitle: "Confirmação de Agendamento", previewText: "Seu agendamento está confirmado para hoje às 14h." });
        })(),
      },
      barber: {
        title: "Notificação ao Barbeiro (novo agendamento)",
        html: (() => {
          const body = `
            ${alertBox("📅", "Novo agendamento!", dateStr, "#C9A84C")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Você tem um novo agendamento na <strong style="color:#ECEDEE">Barbearia Exemplo</strong>.
            </p>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${detailRow("Cliente", "João Silva")}
                ${detailRow("Serviço", "Corte + Barba")}
                ${detailRow("Data", dateStr)}
                ${detailRow("Horário", "14:00 — 15:00", "#C9A84C", true)}
              </table>
            </div>
            ${ctaButton("Ver agenda →", "https://usebarberpro.com/barbearia-exemplo/admin")}`;
          return emailLayout(body, { headerSubtitle: "Novo Agendamento", previewText: "João Silva agendou Corte + Barba para hoje às 14h." });
        })(),
      },
      review: {
        title: "Solicitação de Avaliação",
        html: (() => {
          const body = `
            ${alertBox("⭐", "Como foi sua experiência?", "Sua opinião é muito importante", "#FBBF24")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Olá, <strong style="color:#ECEDEE">João Silva</strong>! Esperamos que tenha gostado do atendimento na
              <strong style="color:#ECEDEE">Barbearia Exemplo</strong>. Deixe sua avaliação!
            </p>
            <div style="text-align:center;margin-bottom:28px">
              <div style="font-size:40px;letter-spacing:8px">⭐⭐⭐⭐⭐</div>
              <p style="color:#9BA1A6;font-size:13px;margin-top:8px">Clique nas estrelas para avaliar</p>
            </div>
            ${ctaButton("Avaliar atendimento →", "https://usebarberpro.com/barbearia-exemplo", "#FBBF24")}`;
          return emailLayout(body, { headerSubtitle: "Avaliação de Atendimento", previewText: "Como foi seu corte? Avalie o atendimento na Barbearia Exemplo." });
        })(),
      },
      password: {
        title: "Recuperação de Senha",
        html: (() => {
          const body = `
            ${alertBox("🔑", "Redefinir sua senha", "Solicitação de recuperação", "#C9A84C")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Olá, <strong style="color:#ECEDEE">João Silva</strong>! Recebemos uma solicitação para redefinir sua senha.
            </p>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:24px;margin-bottom:24px;text-align:center">
              <div style="font-size:11px;color:#9BA1A6;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Código de Verificação</div>
              <div style="font-size:36px;font-weight:900;color:#C9A84C;letter-spacing:8px">847291</div>
              <div style="font-size:12px;color:#555;margin-top:8px">Válido por 15 minutos</div>
            </div>
            ${ctaButton("Redefinir senha →", "https://usebarberpro.com/reset-password?token=exemplo")}`;
          return emailLayout(body, { headerSubtitle: "Recuperação de Senha", previewText: "Seu código de recuperação: 847291 (válido por 15 min)." });
        })(),
      },
      onboarding: {
        title: "Boas-vindas ao Barber Pro (onboarding)",
        html: (() => {
          const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 14);
          const trialEndStr = trialEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
          const body = `
            ${alertBox("🎉", "Bem-vindo ao Barber Pro!", "Barbearia Exemplo está pronta para decolar", "#4ADE80")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Olá, <strong style="color:#ECEDEE">João Silva</strong>! Sua barbearia foi criada com sucesso.
              Você tem <strong style="color:#C9A84C">14 dias grátis</strong> para explorar tudo.
            </p>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${detailRow("Barbearia", "Barbearia Exemplo")}
                ${detailRow("Plano selecionado", "Barber Pro Equipe — R$ 89/mês", "#C9A84C")}
                ${detailRow("Trial gratuito até", trialEndStr, "#4ADE80")}
                ${detailRow("Link de agendamento", "usebarberpro.com/barbearia-exemplo", "#60A5FA", true)}
              </table>
            </div>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:28px">
              <div style="font-size:12px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">🚀 Primeiros passos</div>
              ${["Configure seus serviços e preços","Adicione seus barbeiros e horários","Compartilhe o link de agendamento","Baixe o app Barber Pro"].map((s,i)=>`<div style="margin-bottom:10px;display:flex;align-items:flex-start;gap:10px"><span style="color:#C9A84C;font-weight:800;min-width:20px">${i+1}.</span><span style="color:#ECEDEE;font-size:13px;line-height:1.5">${s}</span></div>`).join("")}
            </div>
            ${ctaButton("Acessar meu painel →", "https://usebarberpro.com/barbearia-exemplo/admin")}`;
          return emailLayout(body, { headerSubtitle: "Bem-vindo ao Barber Pro", previewText: "Barbearia Exemplo está pronta! Acesse o painel e comece a receber agendamentos." });
        })(),
      },
      subscription: {
        title: "Boas-vindas à Assinatura (após assinar)",
        html: (() => {
          const nextDue = new Date(); nextDue.setMonth(nextDue.getMonth() + 1);
          const body = `
            ${alertBox("🌟", "Assinatura ativada!", "Barber Pro Equipe está ativo", "#4ADE80")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Olá, <strong style="color:#ECEDEE">João Silva</strong>! Sua assinatura do Barber Pro foi ativada com sucesso.
            </p>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${detailRow("Plano", "Barber Pro Equipe")}
                ${detailRow("Valor", "R$ 89,00/mês", "#4ADE80")}
                ${detailRow("Próximo vencimento", nextDue.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }), "#FBBF24", true)}
              </table>
            </div>
            ${ctaButton("Acessar o painel →", "https://usebarberpro.com/barbearia-exemplo/admin")}`;
          return emailLayout(body, { headerSubtitle: "Assinatura Ativada", previewText: "Barber Pro Equipe ativado! Acesse o painel e gerencie sua barbearia." });
        })(),
      },
      payment: {
        title: "Confirmação de Pagamento (recibo)",
        html: (() => {
          const nextDue = new Date(); nextDue.setMonth(nextDue.getMonth() + 1);
          const body = `
            ${alertBox("✅", "Pagamento confirmado!", "Sua assinatura está ativa", "#4ADE80")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Olá, <strong style="color:#ECEDEE">João Silva</strong>! Seu pagamento foi confirmado.
            </p>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${detailRow("Plano", "Barber Pro Equipe")}
                ${detailRow("Valor pago", "R$ 89,00", "#4ADE80")}
                ${detailRow("Data do pagamento", dateShort)}
                ${detailRow("Forma de pagamento", "Pix")}
                ${detailRow("Próximo vencimento", nextDue.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }), "#FBBF24", true)}
              </table>
            </div>
            ${ctaButton("Acessar o painel →", "https://usebarberpro.com/barbearia-exemplo/admin")}`;
          return emailLayout(body, { headerSubtitle: "Confirmação de Pagamento", previewText: "Pagamento de R$ 89,00 confirmado. Barber Pro Equipe ativo!" });
        })(),
      },
      trial: {
        title: "Trial Expirando (3 dias antes)",
        html: (() => {
          const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 2);
          const body = `
            ${alertBox("⏰", "Seu período de teste expira em 2 dias!", trialEnd.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }), "#F59E0B")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Olá, <strong style="color:#ECEDEE">João Silva</strong>! O período de teste da
              <strong style="color:#ECEDEE">Barbearia Exemplo</strong> expira em 2 dias.
            </p>
            <div style="margin-bottom:28px">
              ${[{n:"Solo",p:"R$ 49",d:"1 barbeiro",pop:false},{n:"Equipe",p:"R$ 89",d:"até 5 barbeiros",pop:true},{n:"Estúdio",p:"R$ 149",d:"ilimitados",pop:false}].map(pl=>`
              <div style="background:#1A1A1A;border:${pl.pop?"2px solid #C9A84C44":"1px solid #2A2A2A"};border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div><div style="font-weight:700;color:#ECEDEE">${pl.n}${pl.pop?" <span style='font-size:10px;background:#C9A84C22;color:#C9A84C;padding:2px 6px;border-radius:4px'>POPULAR</span>":""}</div><div style="font-size:12px;color:#666">${pl.d}</div></div>
                <div style="font-size:18px;font-weight:900;color:#C9A84C">${pl.p}<span style="font-size:12px;font-weight:400;color:#666">/mês</span></div>
              </div>`).join("")}
            </div>
            ${ctaButton("Assinar agora →", "https://usebarberpro.com/barbearia-exemplo/admin/configuracoes#pagamentos")}`;
          return emailLayout(body, { headerSubtitle: "Aviso de Trial", previewText: "Seu trial do Barber Pro expira em 2 dias. Assine agora para continuar." });
        })(),
      },
      lead: {
        title: "Notificação de Novo Lead",
        html: (() => {
          const body = `
            ${alertBox("📧", "Novo lead recebido!", "Alguém demonstrou interesse", "#60A5FA")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Um novo lead foi registrado via formulário da landing page.
            </p>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${detailRow("Nome", "João Silva")}
                ${detailRow("E-mail", "joao@exemplo.com")}
                ${detailRow("Telefone", "(11) 99999-9999")}
                ${detailRow("Origem", "Landing Page", "#C9A84C", true)}
              </table>
            </div>
            ${ctaButton("Ver leads no superadmin →", "https://usebarberpro.com/superadmin")}`;
          return emailLayout(body, { headerSubtitle: "Novo Lead", previewText: "João Silva demonstrou interesse no Barber Pro." });
        })(),
      },
      support: {
        title: "Novo Ticket de Suporte",
        html: (() => {
          const body = `
            ${alertBox("🎯", "Novo ticket de suporte", "#1234 — Problema com agendamento", "#C9A84C")}
            <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
              Um novo ticket foi aberto por <strong style="color:#ECEDEE">João Silva</strong> da
              <strong style="color:#ECEDEE">Barbearia Exemplo</strong>.
            </p>
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
              <div style="font-size:12px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Mensagem</div>
              <p style="color:#ECEDEE;font-size:14px;line-height:1.6;margin:0">
                Olá, estou com dificuldade para configurar os horários de trabalho dos meus barbeiros. Quando tento salvar, aparece um erro.
              </p>
            </div>
            ${ctaButton("Responder ticket →", "https://usebarberpro.com/superadmin/suporte")}`;
          return emailLayout(body, { headerSubtitle: "Suporte ao Cliente", previewText: "Novo ticket de suporte: Problema com agendamento." });
        })(),
      },
    };

    const templateList = Object.entries(templates).map(([key, t]) => ({
      key,
      title: t.title,
      active: key === template,
    }));

    const currentTemplate = templates[template] ?? templates.booking;

    res.send(layout("Preview de E-mails", null, `
      <div style="padding:16px 24px 0">
        <div class="breadcrumb"><a href="/superadmin" class="bc-link">Dashboard</a><span class="bc-sep">›</span><span class="bc-current">E-mails</span></div>
      </div>
      <div style="display:flex;gap:0;height:calc(100vh - 110px)">
        <!-- Sidebar de templates -->
        <div style="width:280px;min-width:280px;background:#111;border-right:1px solid #222;overflow-y:auto;padding:16px">
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px">Templates</div>
          ${templateList.map(t => `
            <a href="/superadmin/email-preview?template=${t.key}"
               style="display:block;padding:10px 14px;border-radius:8px;margin-bottom:4px;text-decoration:none;
                      background:${t.active ? "#C9A84C22" : "transparent"};
                      border:1px solid ${t.active ? "#C9A84C44" : "transparent"};
                      color:${t.active ? "#C9A84C" : "#9BA1A6"};
                      font-size:13px;line-height:1.4">
              ${t.title}
            </a>`).join("")}
        </div>
        <!-- Preview do template -->
        <div style="flex:1;overflow:auto;background:#0A0A0A;padding:0">
          <div style="background:#1A1A1A;border-bottom:1px solid #222;padding:12px 20px;display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:14px;color:#ECEDEE;font-weight:600">${currentTemplate.title}</div>
            <form method="POST" action="/superadmin/email-preview/send-test" style="display:flex;align-items:center;gap:10px">
              <input type="hidden" name="template" value="${template}" />
              <span style="font-size:12px;color:#666">Enviar para:</span>
              <input type="email" name="email" placeholder="seu@email.com" required
                style="background:#0A0A0A;border:1px solid #333;border-radius:8px;padding:6px 12px;color:#ECEDEE;font-size:12px;width:200px;outline:none" />
              <button type="submit"
                style="background:#C9A84C;color:#0A0A0A;border:none;border-radius:8px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer">
                Enviar teste
              </button>
            </form>
          </div>
          ${req.query.sent ? `<div style="background:#4ADE8022;border-bottom:1px solid #4ADE8044;padding:10px 20px;font-size:13px;color:#4ADE80">✅ E-mail de teste enviado para <strong>${req.query.sent}</strong></div>` : ""}
          ${req.query.error ? `<div style="background:#F8717122;border-bottom:1px solid #F8717144;padding:10px 20px;font-size:13px;color:#F87171">❌ Erro ao enviar: ${req.query.error}</div>` : ""}
          <iframe
            srcdoc="${currentTemplate.html.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"
            style="width:100%;height:calc(100vh - ${req.query.sent || req.query.error ? '158' : '120'}px);border:none;background:#0A0A0A"
            sandbox="allow-same-origin"
          ></iframe>
        </div>
      </div>
    `));
  });

  // ── POST /superadmin/email-preview/send-test — Envia e-mail de teste ─────────────────────────────
  app.post("/superadmin/email-preview/send-test", requireAuth, requireRole("super_admin", "admin"), async (req: Request, res: Response) => {
    const { template: tpl, email: toEmail } = req.body as { template: string; email: string };
    if (!tpl || !toEmail) return res.redirect("/superadmin/email-preview?error=Dados+inv%C3%A1lidos");
    try {
      const { sendEmail, emailLayout, alertBox, ctaButton, detailRow } = await import("./email");
      const today = new Date();
      const dateStr = today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      const dateShort = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

      const templateSubjects: Record<string, string> = {
        booking: "✅ [TESTE] Confirmação de Agendamento",
        barber: "📅 [TESTE] Novo Agendamento",
        review: "⭐ [TESTE] Avalie seu Atendimento",
        password: "🔑 [TESTE] Recuperação de Senha",
        onboarding: "🎉 [TESTE] Bem-vindo ao Barber Pro!",
        subscription: "🌟 [TESTE] Assinatura Ativada!",
        payment: "✅ [TESTE] Pagamento Confirmado",
        trial: "⏰ [TESTE] Seu Trial Expira em Breve",
        lead: "📧 [TESTE] Novo Lead Recebido",
        support: "🎯 [TESTE] Novo Ticket de Suporte",
        cancellation: "⚠️ [TESTE] Assinatura Cancelada",
      };

      // Gerar o HTML do template selecionado (mesmos dados de exemplo da rota GET)
      const buildHtml = (key: string): string => {
        const nextDue = new Date(); nextDue.setMonth(nextDue.getMonth() + 1);
        const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 2);
        const trialEndStr = trialEnd.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
        const nextDueStr = nextDue.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

        const bodies: Record<string, string> = {
          booking: `${alertBox("✅", "Agendamento confirmado!", "Seu horário está reservado", "#4ADE80")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Olá, <strong style="color:#ECEDEE">João Silva</strong>! Seu agendamento na <strong style="color:#ECEDEE">Barbearia Exemplo</strong> está confirmado.</p><div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px"><table width="100%" cellpadding="0" cellspacing="0">${detailRow("Serviço","Corte + Barba")}${detailRow("Barbeiro","Carlos Mendes")}${detailRow("Data",dateStr)}${detailRow("Horário","14:00 — 15:00")}${detailRow("Valor","R$ 55,00","#4ADE80",true)}</table></div>${ctaButton("Ver meu agendamento →","https://usebarberpro.com")}`,
          barber: `${alertBox("📅","Novo agendamento!",dateStr,"#C9A84C")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Você tem um novo agendamento na <strong style="color:#ECEDEE">Barbearia Exemplo</strong>.</p><div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px"><table width="100%" cellpadding="0" cellspacing="0">${detailRow("Cliente","João Silva")}${detailRow("Serviço","Corte + Barba")}${detailRow("Data",dateStr)}${detailRow("Horário","14:00 — 15:00","#C9A84C",true)}</table></div>${ctaButton("Ver agenda →","https://usebarberpro.com")}`,
          review: `${alertBox("⭐","Como foi sua experiência?","Sua opinião é muito importante","#FBBF24")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Olá, <strong style="color:#ECEDEE">João Silva</strong>! Esperamos que tenha gostado do atendimento na <strong style="color:#ECEDEE">Barbearia Exemplo</strong>.</p><div style="text-align:center;margin-bottom:28px"><div style="font-size:40px;letter-spacing:8px">⭐⭐⭐⭐⭐</div></div>${ctaButton("Avaliar atendimento →","https://usebarberpro.com","#FBBF24")}`,
          password: `${alertBox("🔑","Redefinir sua senha","Solicitação de recuperação","#C9A84C")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Olá, <strong style="color:#ECEDEE">João Silva</strong>! Recebemos uma solicitação para redefinir sua senha.</p><div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:24px;margin-bottom:24px;text-align:center"><div style="font-size:11px;color:#9BA1A6;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Código de Verificação</div><div style="font-size:36px;font-weight:900;color:#C9A84C;letter-spacing:8px">847291</div><div style="font-size:12px;color:#555;margin-top:8px">Válido por 15 minutos</div></div>${ctaButton("Redefinir senha →","https://usebarberpro.com")}`,
          onboarding: `${alertBox("🎉","Bem-vindo ao Barber Pro!","Barbearia Exemplo está pronta para decolar","#4ADE80")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Olá, <strong style="color:#ECEDEE">João Silva</strong>! Sua barbearia foi criada com sucesso. Você tem <strong style="color:#C9A84C">14 dias grátis</strong> para explorar tudo.</p><div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px"><table width="100%" cellpadding="0" cellspacing="0">${detailRow("Barbearia","Barbearia Exemplo")}${detailRow("Plano","Barber Pro Equipe — R$ 89/mês","#C9A84C")}${detailRow("Trial até",nextDueStr,"#4ADE80",true)}</table></div>${ctaButton("Acessar meu painel →","https://usebarberpro.com")}`,
          subscription: `${alertBox("🌟","Assinatura ativada!","Barber Pro Equipe está ativo","#4ADE80")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Olá, <strong style="color:#ECEDEE">João Silva</strong>! Sua assinatura foi ativada com sucesso.</p><div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px"><table width="100%" cellpadding="0" cellspacing="0">${detailRow("Plano","Barber Pro Equipe")}${detailRow("Valor","R$ 89,00/mês","#4ADE80")}${detailRow("Próximo vencimento",nextDueStr,"#FBBF24",true)}</table></div>${ctaButton("Acessar o painel →","https://usebarberpro.com")}`,
          payment: `${alertBox("✅","Pagamento confirmado!","Sua assinatura está ativa","#4ADE80")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Olá, <strong style="color:#ECEDEE">João Silva</strong>! Seu pagamento foi confirmado.</p><div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px"><table width="100%" cellpadding="0" cellspacing="0">${detailRow("Plano","Barber Pro Equipe")}${detailRow("Valor pago","R$ 89,00","#4ADE80")}${detailRow("Data",dateShort)}${detailRow("Forma","Pix")}${detailRow("Próximo vencimento",nextDueStr,"#FBBF24",true)}</table></div>${ctaButton("Acessar o painel →","https://usebarberpro.com")}`,
          trial: `${alertBox("⏰","Seu período de teste expira em 2 dias!",trialEndStr,"#F59E0B")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Olá, <strong style="color:#ECEDEE">João Silva</strong>! O período de teste da <strong style="color:#ECEDEE">Barbearia Exemplo</strong> expira em 2 dias.</p>${ctaButton("Assinar agora →","https://usebarberpro.com")}`,
          lead: `${alertBox("📧","Novo lead recebido!","Alguém demonstrou interesse","#60A5FA")}<div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px"><table width="100%" cellpadding="0" cellspacing="0">${detailRow("Nome","João Silva")}${detailRow("E-mail","joao@exemplo.com")}${detailRow("Telefone","(11) 99999-9999","#C9A84C",true)}</table></div>${ctaButton("Ver leads →","https://usebarberpro.com/superadmin")}`,
          support: `${alertBox("🎯","Novo ticket de suporte","#1234 — Problema com agendamento","#C9A84C")}<div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px"><p style="color:#ECEDEE;font-size:14px;line-height:1.6;margin:0">Olá, estou com dificuldade para configurar os horários de trabalho dos meus barbeiros.</p></div>${ctaButton("Responder ticket →","https://usebarberpro.com/superadmin/suporte")}`,
          cancellation: `${alertBox("⚠️","Assinatura cancelada","Barber Pro Equipe foi cancelado","#F87171")}<p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">Olá, <strong style="color:#ECEDEE">João Silva</strong>! A assinatura da <strong style="color:#ECEDEE">Barbearia Exemplo</strong> no Barber Pro foi cancelada.</p><div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px"><table width="100%" cellpadding="0" cellspacing="0">${detailRow("Plano cancelado","Barber Pro Equipe")}${detailRow("Data",dateShort,"#F87171")}${detailRow("Acesso","Bloqueado até nova assinatura","#F87171",true)}</table></div>${ctaButton("Reativar assinatura →","https://usebarberpro.com")}`,
        };
        const subtitles: Record<string, string> = {
          booking: "Confirmação de Agendamento", barber: "Novo Agendamento", review: "Avaliação de Atendimento",
          password: "Recuperação de Senha", onboarding: "Bem-vindo ao Barber Pro", subscription: "Assinatura Ativada",
          payment: "Confirmação de Pagamento", trial: "Aviso de Trial", lead: "Novo Lead", support: "Suporte ao Cliente",
          cancellation: "Assinatura Cancelada",
        };
        return emailLayout(bodies[key] ?? bodies.booking, { headerSubtitle: subtitles[key] ?? "Barber Pro", previewText: `[TESTE] ${subtitles[key] ?? "Barber Pro"}` });
      };

      const html = buildHtml(tpl);
      const subject = templateSubjects[tpl] ?? `[TESTE] ${tpl}`;
      await sendEmail({ to: toEmail, subject, html });
      res.redirect(`/superadmin/email-preview?template=${tpl}&sent=${encodeURIComponent(toEmail)}`);
    } catch (e: any) {
      res.redirect(`/superadmin/email-preview?template=${tpl}&error=${encodeURIComponent(e.message)}`);
    }
  });

  // ─── Busca global ─────────────────────────────────────────────────────────────

  // ── GET /superadmin/monitoramento ─────────────────────────────────────────
  app.get("/superadmin/monitoramento", requireAuth, async (req: Request, res: Response) => {
    const session = (req as any).boSession as BOSession;
    try {
      const dbConn = await db.getDb();
      const { sql } = await import("drizzle-orm");
      const uptimeSeconds = process.uptime();
      const uptimeStr = uptimeSeconds > 3600
        ? `${Math.floor(uptimeSeconds/3600)}h ${Math.floor((uptimeSeconds%3600)/60)}m`
        : `${Math.floor(uptimeSeconds/60)}m`;
      const memUsage = process.memoryUsage();
      const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

      // Stats do banco
      let dbStats = { tenants: 0, appointments: 0, clients: 0, sales: 0 };
      if (dbConn) {
        try {
          const [t, a, c, s] = await Promise.all([
            dbConn.execute(sql`SELECT COUNT(*) as cnt FROM tenants`),
            dbConn.execute(sql`SELECT COUNT(*) as cnt FROM appointments`),
            dbConn.execute(sql`SELECT COUNT(*) as cnt FROM clients`),
            dbConn.execute(sql`SELECT COUNT(*) as cnt FROM sales`),
          ]) as any[];
          dbStats = {
            tenants: Number((t[0]?.[0] ?? t?.rows?.[0])?.cnt ?? 0),
            appointments: Number((a[0]?.[0] ?? a?.rows?.[0])?.cnt ?? 0),
            clients: Number((c[0]?.[0] ?? c?.rows?.[0])?.cnt ?? 0),
            sales: Number((s[0]?.[0] ?? s?.rows?.[0])?.cnt ?? 0),
          };
        } catch {}
      }

      const recentActions = auditLog.slice(0, 20);

      res.send(layout("Monitoramento", session, `
        <div class="container">
          <div class="page-header">
            <div class="page-title">⚙️ Monitoramento</div>
            <div class="page-sub">Saúde do servidor e atividade recente</div>
          </div>

          <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px">
            <div class="metric-card" style="border-left:3px solid #4ADE80">
              <div class="metric-label">Uptime</div>
              <div class="metric-value" style="color:#4ADE80;font-size:22px">${uptimeStr}</div>
              <div class="metric-sub">servidor em execução</div>
            </div>
            <div class="metric-card" style="border-left:3px solid #60A5FA">
              <div class="metric-label">Memória Heap</div>
              <div class="metric-value" style="color:#60A5FA;font-size:22px">${memMB}MB</div>
              <div class="metric-sub">de ${memTotalMB}MB alocados</div>
            </div>
            <div class="metric-card" style="border-left:3px solid var(--gold-500)">
              <div class="metric-label">Total Agendamentos</div>
              <div class="metric-value" style="font-size:22px">${dbStats.appointments.toLocaleString('pt-BR')}</div>
              <div class="metric-sub">no banco de dados</div>
            </div>
            <div class="metric-card" style="border-left:3px solid #C084FC">
              <div class="metric-label">Total Clientes</div>
              <div class="metric-value" style="color:#C084FC;font-size:22px">${dbStats.clients.toLocaleString('pt-BR')}</div>
              <div class="metric-sub">cadastrados na plataforma</div>
            </div>
            <div class="metric-card" style="border-left:3px solid #F59E0B">
              <div class="metric-label">Total Vendas</div>
              <div class="metric-value" style="color:#F59E0B;font-size:22px">${dbStats.sales.toLocaleString('pt-BR')}</div>
              <div class="metric-sub">processadas no sistema</div>
            </div>
            <div class="metric-card" style="border-left:3px solid #4ADE80">
              <div class="metric-label">Node.js</div>
              <div class="metric-value" style="color:#4ADE80;font-size:18px">${process.version}</div>
              <div class="metric-sub">ambiente: ${process.env.NODE_ENV ?? "dev"}</div>
            </div>
          </div>

          <!-- Log de Auditoria -->
          <div class="table-wrap">
            <div class="table-header">
              <h2>📋 Log de Auditoria</h2>
              <span style="font-size:12px;color:var(--text-muted)">Últimas ${recentActions.length} ações administrativas</span>
            </div>
            ${recentActions.length === 0 ? `
              <div class="empty"><div class="empty-icon">📋</div><div>Nenhuma ação registrada ainda.</div></div>
            ` : `
              <table>
                <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Alvo</th></tr></thead>
                <tbody>
                  ${recentActions.map(a => `
                    <tr>
                      <td style="color:var(--text-muted);font-size:12px">${a.ts}</td>
                      <td><span style="color:var(--gold-500)">${esc(a.user)}</span></td>
                      <td>${esc(a.action)}</td>
                      <td style="color:var(--text-muted)">${esc(a.target)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            `}
          </div>
        </div>
      `));
    } catch (e: any) {
      res.status(500).send(layout("Erro", session, `<div class="container"><p style="color:var(--danger);margin-top:40px">Erro: ${esc(e.message)}</p></div>`));
    }
  });

  app.get("/superadmin/busca", requireAuth, async (req, res) => {
    const q = ((req.query.q as string) || "").trim();
    if (!q) return res.redirect("/superadmin/tenants");
    try {
      const rows = await db.execute(
        `SELECT id, name, slug, plan, barberproSubscriptionStatus, barberproTrialEndsAt, createdAt
         FROM tenants
         WHERE name LIKE ? OR slug LIKE ? OR id = ?
         ORDER BY name ASC LIMIT 30`,
        [`%${q}%`, `%${q}%`, isNaN(Number(q)) ? -1 : Number(q)]
      ) as any[];
      const results = Array.isArray(rows[0]) ? rows[0] : rows;
      const planLabel: Record<string, string> = { solo: "Solo", team: "Equipe", studio: "Estúdio" };
      const statusColor: Record<string, string> = { active: "#4ADE80", trial: "#FBBF24", expired: "#F87171", cancelled: "#F87171", pending: "#60A5FA" };
      const rows_html = results.length === 0
        ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhuma barbearia encontrada para "${esc(q)}"</td></tr>`
        : results.map((t: any) => `
          <tr>
            <td><a href="/superadmin/tenants/${t.id}" style="color:var(--gold-500);font-weight:600">${esc(t.name)}</a><div style="font-size:11px;color:var(--text-muted)">${esc(t.slug)}</div></td>
            <td>${planLabel[t.plan] ?? t.plan ?? "—"}</td>
            <td><span style="color:${statusColor[t.barberproSubscriptionStatus] ?? "var(--text-muted)"};font-weight:600">${t.barberproSubscriptionStatus ?? "—"}</span></td>
            <td style="font-size:12px;color:var(--text-muted)">${t.barberproTrialEndsAt ? new Date(t.barberproTrialEndsAt).toLocaleDateString("pt-BR") : "—"}</td>
            <td><a href="/superadmin/tenants/${t.id}" style="font-size:12px">Ver →</a></td>
          </tr>`).join("");
      const body = `
        <div style="margin-bottom:20px">
          <form action="/superadmin/busca" method="GET" style="display:flex;gap:8px;max-width:480px">
            <input type="text" name="q" value="${esc(q)}" placeholder="Buscar barbearia..."
              style="flex:1;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 14px;font-size:13px;color:var(--text-primary);outline:none" />
            <button type="submit" style="background:var(--gold-500);color:#000;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">Buscar</button>
          </form>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">${results.length} resultado(s) para "<strong style="color:var(--text-primary)">${esc(q)}</strong>"</div>
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:12px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid var(--border-subtle);background:var(--bg-input)">
              <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600">BARBEARIA</th>
              <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600">PLANO</th>
              <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600">STATUS</th>
              <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600">TRIAL ATÉ</th>
              <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600">AÇÃO</th>
            </tr></thead>
            <tbody>${rows_html}</tbody>
          </table>
        </div>`;
      const session = (req as any).boSession as BOSession;
      res.send(layout("Busca", session, body));
    } catch (e: any) {
      res.status(500).send("Erro: " + e.message);
    }
  });
}