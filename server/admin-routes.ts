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
import { sql } from "drizzle-orm";
import { asaasEnabled, asaasApi, createAsaasSubAccount, getAsaasSubAccount, ensureAsaasRootCustomer, createAsaasSubscription, cancelAsaasSubscription } from "./asaas";
import axios from "axios";
import PDFDocument from "pdfkit";
import bcrypt from "bcryptjs";

const ADMIN_SESSION_COOKIE = "bp_admin_session";
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 horas
const SESSION_MAX_AGE_REMEMBER = 30 * 24 * 60 * 60; // 30 dias

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
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

/**
 * Envolve qualquer handler de rota GET com try/catch global.
 * Em caso de erro de banco ou erro inesperado, exibe uma página de erro amigável
 * em vez de deixar a requisição travar ou retornar um erro 500 sem corpo.
 */
function withErrorPage(
  pageName: string,
  activeMenu: string,
  fn: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      console.error(`[${pageName}] Erro ao renderizar:`, err?.message ?? err);
      let barberName = "";
      let tenantPlan = "";
      try {
        const session = (req as any).adminSession as { barberId: number } | undefined;
        if (session?.barberId) {
          const b = await db.getBarberById(session.barberId);
          barberName = b?.name ?? "";
          if (b?.tenantId) {
            const t = await db.getTenantById(b.tenantId);
            tenantPlan = (t as any)?.plan ?? "";
          }
        }
      } catch { /* ignora */ }
      const retryUrl = req.originalUrl;
      const errorBody = `
        <div style="padding:60px 24px;text-align:center;max-width:480px;margin:0 auto">
          <div style="font-size:48px;margin-bottom:16px">⚠️</div>
          <h2 style="color:var(--text);margin-bottom:8px;font-size:20px">Erro ao carregar página</h2>
          <p style="color:var(--muted);margin-bottom:24px;font-size:14px;line-height:1.6">
            Ocorreu um problema de conexão com o banco de dados.<br>
            Aguarde alguns segundos e tente novamente.
          </p>
          <a href="${retryUrl}" class="btn btn-primary" style="display:inline-block;padding:12px 28px;background:var(--gold);color:#0C0C0C;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px">Tentar novamente</a>
        </div>
      `;
      res.status(503).send(adminLayout(pageName, activeMenu, errorBody, barberName, tenantPlan));
    }
  };
}

function monthRange(): { start: string; end: string } {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

// ─── Sessão simples (JWT-less, cookie assinado com barberId) ──────────────────────────────────────────────────────────
function encodeSession(barberId: number, role: string, maxAge = SESSION_MAX_AGE): string {
  const payload = Buffer.from(JSON.stringify({ barberId, role, ts: Date.now(), maxAge })).toString("base64url");
  return payload;
}

function decodeSession(token: string): { barberId: number; role: string } | null {
  try {
    const data = JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
    if (!data.barberId || !data.role) return null;
    // Usar maxAge armazenado no token (suporta 8h ou 30 dias)
    const maxAge = data.maxAge ?? SESSION_MAX_AGE;
    if (Date.now() - data.ts > maxAge * 1000) return null;
    return { barberId: data.barberId, role: data.role };
  } catch {
    return null;
  }
}

// ─── Middleware de autenticação ────────────────────────────────────────────────────────────
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (!token) return res.redirect("/admin/login");
  const session = decodeSession(token);
  if (!session) return res.redirect("/admin/login");
  (req as any).adminSession = session;
  next();
}

// Middleware assíncrono que verifica se a assinatura Barber Pro está ativa/trial.
// Se expirada ou cancelada, redireciona para a aba de pagamentos com aviso.
// Rotas de pagamentos e configurações são sempre permitidas para não criar loop.
async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const ALWAYS_ALLOWED = ["/admin/configuracoes", "/admin/login", "/admin/logout", "/admin/meu-perfil"];
    const isAlwaysAllowed = ALWAYS_ALLOWED.some(p => req.path === p || req.path.startsWith(p + "/") || req.path.startsWith("/admin/configuracoes/asaas"));
    if (isAlwaysAllowed) return next();

    const session = (req as any).adminSession as { barberId: number; role: string } | undefined;
    if (!session) return next();

    const barber = await db.getBarberById(session.barberId);
    if (!barber?.tenantId) return next();

    const dbConn = await db.getDb();
    if (!dbConn) return next();

    const rows = await dbConn.execute(
      `SELECT "barberproSubscriptionStatus", "trialEndsAt" FROM tenants WHERE id = ${barber.tenantId} LIMIT 1` as any
    );
    const t = ((rows as any).rows as any[])[0];
    if (!t) return next();

    const status = t.barberproSubscriptionStatus ?? 'trial';
    const trialEndsAt = t.trialEndsAt ? new Date(t.trialEndsAt) : null;
    const trialExpired = trialEndsAt && trialEndsAt < new Date();

    // Bloquear apenas se expirado ou cancelado (nunca bloquear pending/overdue para não impedir pagamento)
    const isBlocked = status === 'expired' || status === 'cancelled' || (status === 'trial' && trialExpired);
    if (isBlocked) {
      return res.redirect("/admin/configuracoes?tab=pagamentos&expired=1");
    }
    return next();
  } catch {
    return next(); // Em caso de erro, não bloquear
  }
}

// ─── Layout base do painel ────────────────────────────────────────────────────
function adminLayout(title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {
  const planBadge: Record<string, { label: string; color: string; bg: string }> = {
    solo: { label: "Solo", color: "#9BA1A6", bg: "rgba(155,161,166,0.12)" },
    team: { label: "Equipe", color: "#c9a84c", bg: "rgba(201,168,76,0.12)" },
    studio: { label: "Estúdio", color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  };
  const badge = tenantPlan ? planBadge[tenantPlan] : null;
  // Iniciais do barbeiro para avatar
  const initials = barberName
    ? barberName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : "BP";
  // Ícones SVG monocromáticos para sidebar
  const svgIcons: Record<string, string> = {
    dashboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    agenda: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    clientes: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    "lista-espera": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    assinaturas: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
    orbita: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"/></svg>`,
    servicos: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    produtos: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    estoque: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    encomendas: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    financeiro: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    relatorios: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    comissoes: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>`,
    "minhas-comissoes": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="2"/></svg>`,
    fidelidade: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    avaliacoes: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    "retorno-automatico": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    promocoes: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    "conversao-promocoes": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    "pagina-cliente": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    "meu-perfil": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    configuracoes: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    planos: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    suporte: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    fornecedores: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="17"/><line x1="9" y1="14.5" x2="15" y2="14.5"/></svg>`,
  };
  const navGroups = [
    {
      label: "OPERACIONAL",
      items: [
        { href: "/admin", icon: svgIcons.dashboard, label: "Dashboard", id: "dashboard" },
        { href: "/admin/agenda", icon: svgIcons.agenda, label: "Agenda", id: "agenda" },
        { href: "/admin/clientes", icon: svgIcons.clientes, label: "Clientes", id: "clientes" },
        { href: "/admin/lista-espera", icon: svgIcons["lista-espera"], label: "Lista de Espera", id: "lista-espera" },
        { href: "/admin/assinaturas", icon: svgIcons.assinaturas, label: "Assinaturas", id: "assinaturas" },
        { href: "/admin/planos", icon: svgIcons.planos, label: "Planos de Assinatura", id: "planos" },
        { href: "/admin/orbita", icon: svgIcons.orbita, label: "Clientes em Órbita", id: "orbita" },
      ],
    },
    {
      label: "CATÁLOGO",
      items: [
        { href: "/admin/servicos", icon: svgIcons.servicos, label: "Serviços", id: "servicos" },
        { href: "/admin/produtos", icon: svgIcons.produtos, label: "Produtos", id: "produtos" },
        { href: "/admin/estoque", icon: svgIcons.estoque, label: "Estoque", id: "estoque" },
        { href: "/admin/encomendas", icon: svgIcons.encomendas, label: "Encomendas", id: "encomendas" },
        { href: "/admin/fornecedores", icon: svgIcons.fornecedores, label: "Fornecedores", id: "fornecedores" },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { href: "/admin/financeiro", icon: svgIcons.financeiro, label: "Financeiro", id: "financeiro" },
        { href: "/admin/relatorios", icon: svgIcons.relatorios, label: "Relatórios", id: "relatorios" },
        { href: "/admin/comissoes", icon: svgIcons.comissoes, label: "Comissões", id: "comissoes" },
        { href: "/admin/minhas-comissoes", icon: svgIcons["minhas-comissoes"], label: "Minhas Comissões", id: "minhas-comissoes" },
      ],
    },
    {
      label: "MARKETING",
      items: [
        { href: "/admin/fidelidade", icon: svgIcons.fidelidade, label: "Fidelidade", id: "fidelidade" },
        { href: "/admin/avaliacoes", icon: svgIcons.avaliacoes, label: "Avaliações", id: "avaliacoes" },
        { href: "/admin/retorno-automatico", icon: svgIcons["retorno-automatico"], label: "Retorno Automático", id: "retorno-automatico" },
        { href: "/admin/promocoes", icon: svgIcons.promocoes, label: "Promoções", id: "promocoes" },
        { href: "/admin/conversao-promocoes", icon: svgIcons["conversao-promocoes"], label: "Conversão de Promoções", id: "conversao-promocoes" },
      ],
    },
    {
      label: "PÁGINA DO CLIENTE",
      items: [
        { href: "/admin/pagina-cliente", icon: svgIcons["pagina-cliente"], label: "Página do Cliente", id: "pagina-cliente" },
      ],
    },
  ];
  // Logo URL: usa S3 se disponível, senão fallback para SVG inline
  const BARBER_PRO_LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028442847/CHUXnjOFayrIGRtV.png";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} — Barber Pro Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold: #C9A84C;
      --gold-dim: rgba(201,168,76,0.12);
      --gold-glow: rgba(201,168,76,0.20);
      --bg: #080808;
      --surface: #111111;
      --surface2: #1A1A1A;
      --surface3: #222222;
      --border: #222222;
      --border2: #2E2E2E;
      --text: #F2F0EA;
      --text2: #C8C4BC;
      --muted: #7A7870;
      --success: #4ADE80;
      --warning: #FBBF24;
      --error: #F87171;
      --info: #60A5FA;
      --sidebar-w: 240px;
      --radius: 12px;
      --radius-sm: 8px;
    }
    html[data-theme="light"] {
      --bg: #F4F3EF;
      --surface: #FFFFFF;
      --surface2: #F0EEE8;
      --surface3: #E8E6E0;
      --border: #E0DDD6;
      --border2: #D0CCC4;
      --text: #1A1916;
      --text2: #4A4844;
      --muted: #7A7870;
    }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); display: flex; min-height: 100vh; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

    /* ── Sidebar ── */
    .sidebar { width: var(--sidebar-w); background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 200; transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); }
    .sidebar-logo { padding: 20px 18px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
    .sidebar-logo-icon { width: 32px; height: 32px; background: var(--gold-dim); border: 1px solid rgba(201,168,76,0.25); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
    .sidebar-logo-icon img { width: 28px; height: 28px; object-fit: contain; }
    .sidebar-logo-text { flex: 1; min-width: 0; }
    .sidebar-logo-title { font-size: 13px; font-weight: 800; color: var(--gold); letter-spacing: 1.5px; line-height: 1.2; }
    .sidebar-logo-sub { font-size: 10px; color: var(--muted); margin-top: 1px; letter-spacing: 0.3px; }
    .sidebar-nav { flex: 1; padding: 8px 0; overflow-y: auto; }
    .nav-group { margin-bottom: 2px; }
    .nav-group-label { font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 1.5px; padding: 14px 18px 5px; opacity: 0.5; text-transform: uppercase; }
    .nav-item { display: flex; align-items: center; gap: 9px; padding: 8px 18px; font-size: 13px; color: var(--muted); text-decoration: none; transition: all 0.15s ease; cursor: pointer; margin: 1px 8px; border-radius: var(--radius-sm); }
    .nav-item:hover { background: var(--surface2); color: var(--text2); }
    .nav-item.active { background: var(--gold-dim); color: var(--gold); font-weight: 600; box-shadow: inset 3px 0 0 var(--gold); }
    .nav-icon { width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .sidebar-footer { padding: 14px 18px; border-top: 1px solid var(--border); }
    .sidebar-user-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .sidebar-avatar { width: 32px; height: 32px; background: var(--gold-dim); border: 1px solid rgba(201,168,76,0.25); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--gold); flex-shrink: 0; }
    .sidebar-user-info { flex: 1; min-width: 0; }
    .sidebar-user-name { font-size: 12px; font-weight: 600; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sidebar-logout { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); text-decoration: none; transition: color 0.12s; }
    .sidebar-logout:hover { color: var(--error); }
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 150; backdrop-filter: blur(2px); }
    .sidebar-overlay.active { display: block; }

    /* ── Main ── */
    .main { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
    .topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 24px; height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 16px; position: sticky; top: 0; z-index: 100; }
    .topbar-left { display: flex; align-items: center; gap: 12px; }
    .topbar-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--muted); padding: 6px; border-radius: 6px; }
    .topbar-hamburger:hover { background: var(--surface2); color: var(--text); }
    .topbar-title { font-size: 15px; font-weight: 700; color: var(--text); }
    .topbar-right { display: flex; align-items: center; gap: 10px; }
    .topbar-date { font-size: 12px; color: var(--muted); }
    .topbar-avatar { width: 32px; height: 32px; background: var(--gold-dim); border: 1px solid rgba(201,168,76,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--gold); cursor: pointer; transition: box-shadow 0.15s; }
    .topbar-avatar:hover { box-shadow: 0 0 0 3px var(--gold-glow); }
    .content { padding: 24px; flex: 1; }

    /* ── Cards de métrica ── */
    @keyframes kpi-in {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; overflow: visible; }
    .metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; transition: border-color 0.15s, box-shadow 0.15s; animation: kpi-in 0.35s ease both; }
    .metric-card:nth-child(1) { animation-delay: 0ms; }
    .metric-card:nth-child(2) { animation-delay: 60ms; }
    .metric-card:nth-child(3) { animation-delay: 120ms; }
    .metric-card:nth-child(4) { animation-delay: 180ms; }
    /* ── Tooltip KPI ── */
    .kpi-tooltip { position:relative; cursor:default; }
    .kpi-tooltip .kpi-tip {
      visibility:hidden; opacity:0; pointer-events:none;
      position:absolute; top:calc(100% + 8px); left:50%; transform:translateX(-50%);
      background:#1e293b; border:1px solid rgba(201,168,76,0.3); border-radius:8px;
      padding:8px 12px; white-space:nowrap; font-size:12px; color:#e2e8f0;
      box-shadow:0 4px 16px rgba(0,0,0,0.4); z-index:9999;
      transition:opacity .18s ease, visibility .18s ease;
    }
    .kpi-tooltip .kpi-tip::before {
      content:''; position:absolute; bottom:100%; left:50%; transform:translateX(-50%);
      border:5px solid transparent; border-bottom-color:#1e293b;
    }
    .kpi-tooltip:hover .kpi-tip { visibility:visible; opacity:1; }
    /* ── Animação Ações Rápidas ── */
    @keyframes action-in {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .action-card { animation: action-in 0.3s ease both; }
    .action-card:nth-child(1) { animation-delay: 200ms; }
    .action-card:nth-child(2) { animation-delay: 250ms; }
    .action-card:nth-child(3) { animation-delay: 300ms; }
    .action-card:nth-child(4) { animation-delay: 350ms; }
    .action-card:nth-child(5) { animation-delay: 400ms; }
    .metric-card:hover { border-color: rgba(201,168,76,0.25); box-shadow: 0 0 0 1px rgba(201,168,76,0.08), 0 4px 16px rgba(0,0,0,0.3); }
    .metric-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .metric-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
    .metric-label { font-size: 11px; color: var(--muted); letter-spacing: 0.8px; text-transform: uppercase; font-weight: 500; }
    .metric-value { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; margin-bottom: 6px; }
    .metric-sub { font-size: 12px; color: var(--muted); }
    .metric-trend { font-size: 11px; font-weight: 600; }
    .metric-trend.up { color: var(--success); }
    .metric-trend.down { color: var(--error); }

    /* ── Tabelas ── */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 20px; }
    .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .card-title { font-size: 14px; font-weight: 700; color: var(--text); }
    .card-subtitle { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .card-body { padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 16px; font-size: 11px; color: var(--muted); letter-spacing: 0.8px; text-transform: uppercase; text-align: left; border-bottom: 1px solid var(--border); background: var(--surface2); font-weight: 600; }
    td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text2); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface2); color: var(--text); }
    .td-name { font-weight: 600; color: var(--text) !important; }
    .cell-avatar { display: flex; align-items: center; gap: 10px; }
    .avatar-initials { width: 30px; height: 30px; border-radius: 50%; background: var(--surface3); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--muted); flex-shrink: 0; }

    /* ── Badges ── */
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-success { background: rgba(74,222,128,0.1); color: var(--success); }
    .badge-warning { background: rgba(251,191,36,0.1); color: var(--warning); }
    .badge-error { background: rgba(248,113,113,0.1); color: var(--error); }
    .badge-muted { background: var(--surface2); color: var(--muted); }
    .badge-gold { background: var(--gold-dim); color: var(--gold); }
    .badge-info { background: rgba(96,165,250,0.1); color: var(--info); }

    /* ── Botões ── */
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; transition: opacity 0.12s, transform 0.1s, box-shadow 0.12s; font-family: inherit; }
    .btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .btn-primary { background: var(--gold); color: #0A0A0A; box-shadow: 0 2px 8px rgba(201,168,76,0.25); }
    .btn-primary:hover { box-shadow: 0 4px 16px rgba(201,168,76,0.35); }
    .btn-ghost { background: var(--surface2); color: var(--text); border: 1px solid var(--border2); }
    .btn-danger { background: rgba(248,113,113,0.1); color: var(--error); border: 1px solid rgba(248,113,113,0.2); }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-icon { padding: 7px; }

    /* ── Empty state ── */
    .empty { text-align: center; padding: 56px 24px; color: var(--muted); }
    .empty-icon { margin-bottom: 12px; opacity: 0.3; }
    .empty-title { font-size: 15px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
    .empty-desc { font-size: 13px; color: var(--muted); }

    /* ── Formulários ── */
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 12px; font-weight: 500; color: var(--muted); margin-bottom: 6px; letter-spacing: 0.3px; }
    .form-input { width: 100%; padding: 10px 13px; background: var(--surface2); border: 1px solid var(--border2); border-radius: var(--radius-sm); color: var(--text); font-size: 13px; font-family: inherit; transition: border-color 0.12s, box-shadow 0.12s; }
    .form-input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold-dim); }
    .form-input::placeholder { color: var(--muted); }
    select.form-input { cursor: pointer; }
    textarea.form-input { resize: vertical; min-height: 80px; }
    .form-hint { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    /* ── Alertas ── */
    .alert { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 16px; display: flex; align-items: flex-start; gap: 10px; }
    .alert-success { background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.2); color: var(--success); }
    .alert-error { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); color: var(--error); }
    .alert-warning { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2); color: var(--warning); }
    .alert-gold { background: var(--gold-dim); border: 1px solid rgba(201,168,76,0.25); color: var(--gold); }

    /* ── Section header ── */
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
    .section-title { font-size: 18px; font-weight: 800; color: var(--text); letter-spacing: -0.3px; }
    .section-subtitle { font-size: 13px; color: var(--muted); margin-top: 3px; }

    /* ── Responsivo ── */
    @media (max-width: 900px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.5); }
      .main { margin-left: 0; }
      .topbar-hamburger { display: flex; }
      .topbar-date { display: none; }
      .content { padding: 14px; }
      .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .form-row { grid-template-columns: 1fr; }
      /* Ações Rápidas: 3 colunas em tablet */
      .actions-grid-5 { grid-template-columns: repeat(3, 1fr) !important; }
      /* Tabelas: scroll horizontal */
      .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      /* Botões do link de agendamento: empilhar */
      .booking-btns { flex-wrap: wrap; }
      .booking-btns .btn { flex: 1 1 auto; min-width: 80px; justify-content: center; }
      /* Gráfico: botões de alternância */
      .chart-toggle-wrap { flex-wrap: wrap; gap: 6px; }
      /* Card Baixe o App: header */
      .app-card-header { flex-wrap: wrap; gap: 10px; }
      /* Topbar: esconder badge de plano em telas pequenas */
      .topbar-plan-badge { display: none; }
    }
    @media (max-width: 600px) {
      /* Ações Rápidas: 2 colunas em mobile */
      .actions-grid-5 { grid-template-columns: repeat(2, 1fr) !important; }
      /* Botões de ação inline: empilhar */
      .inline-action-btns { flex-direction: column; }
      /* Preview da página: altura menor */
      .page-preview-iframe-wrap { height: 180px !important; }
      /* Gráfico: padding menor */
      .chart-card-inner { padding: 16px !important; }
    }
    @media (max-width: 480px) {
      .metrics-grid { grid-template-columns: 1fr; }
      .content { padding: 10px; }
      /* Topbar: título menor */
      .topbar-title { font-size: 13px; }
      /* Cards: padding menor */
      .card-header { padding: 12px 14px; }
      .card-body { padding: 12px 14px; }
    }
    /* ─── Animações de Navegação ─────────────────────────────────────────────── */
    /* Barra de progresso na topbar */
    #nav-progress {
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 3px;
      background: linear-gradient(90deg, #C9A84C, #f0d080, #C9A84C);
      background-size: 200% 100%;
      z-index: 9999;
      transition: width 0.25s ease, opacity 0.4s ease;
      opacity: 0;
      pointer-events: none;
    }
    #nav-progress.running {
      opacity: 1;
      animation: progress-shimmer 1.2s linear infinite;
    }
    #nav-progress.done {
      width: 100% !important;
      opacity: 0;
      transition: width 0.1s ease, opacity 0.5s ease 0.1s;
    }
    @keyframes progress-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    /* Fade-in do conteúdo principal ao navegar */
    .content-enter {
      animation: content-enter 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @keyframes content-enter {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    /* Feedback visual nos links da sidebar ao clicar */
    .nav-item.nav-loading {
      opacity: 0.5;
      pointer-events: none;
    }
    @keyframes content-leave {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(-8px); }
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
  <div id="nav-progress"></div>
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">
        <img src="${BARBER_PRO_LOGO_URL}" alt="Barber Pro" style="width:28px;height:28px;object-fit:contain;border-radius:6px;" />
      </div>
      <div class="sidebar-logo-text">
        <div class="sidebar-logo-title">BARBER PRO</div>
        <div class="sidebar-logo-sub">Painel Administrativo</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${navGroups.map((group) => `
        <div class="nav-group">
          <div class="nav-group-label">${group.label}</div>
          ${group.items.map((n) => `
            <a href="${n.href}" class="nav-item ${activePage === n.id ? "active" : ""}">
              <span class="nav-icon">${n.icon}</span>
              <span>${n.label}</span>
            </a>
          `).join("")}
        </div>
      `).join("")}
    </nav>
    <div class="sidebar-footer">
      ${barberName ? `
      <div class="sidebar-user-row">
        <div class="sidebar-avatar">${initials}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${esc(barberName)}</div>
          ${badge ? `<div style="font-size:10px;color:${badge.color};font-weight:600;letter-spacing:0.5px">${badge.label}</div>` : ""}
        </div>
      </div>` : ""}
      <a href="/admin/logout" class="sidebar-logout">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sair da conta
      </a>
    </div>
  </aside>

  <div class="main">
    <div class="topbar">
      <div class="topbar-left">
        <button class="topbar-hamburger" id="hamburgerBtn" onclick="toggleSidebar()" aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="topbar-title">${esc(title)}</div>
      </div>
      <div class="topbar-right">
        <div class="topbar-date">${new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}</div>
        ${badge ? `<div style="display:inline-flex;align-items:center;gap:5px;background:${badge.bg};border:1px solid ${badge.color}33;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;color:${badge.color};letter-spacing:0.5px">${badge.label}</div>` : ""}
        <button id="theme-toggle-btn" onclick="toggleTheme()" title="Alternar tema claro/escuro" style="background:var(--surface);border:1px solid var(--border);cursor:pointer;color:var(--text);padding:7px 10px;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.2s;min-width:36px;min-height:36px;" onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text)'">
          <svg id="theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;flex-shrink:0"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg id="theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:block;flex-shrink:0"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <span id="theme-label" style="font-size:11px;font-weight:600;letter-spacing:0.3px;display:none">Escuro</span>
        </button>
        <!-- Avatar dropdown -->
        <div style="position:relative;" id="avatar-menu-wrap">
          <button id="avatar-btn" onclick="toggleAvatarMenu()" style="width:32px;height:32px;background:var(--gold-dim);border:1px solid rgba(201,168,76,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--gold);cursor:pointer;transition:box-shadow 0.15s;" title="${esc(barberName)}" onmouseover="this.style.boxShadow='0 0 0 3px var(--gold-glow)'" onmouseout="this.style.boxShadow='none'">${initials}</button>
          <div id="avatar-dropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.35);z-index:999;overflow:hidden;">
            <div style="padding:12px 16px 10px;border-bottom:1px solid var(--border);">
              <div style="font-size:13px;font-weight:700;color:var(--text);">${esc(barberName || 'Usuário')}</div>
              ${badge ? `<div style="font-size:10px;color:${badge.color};font-weight:600;margin-top:2px;">${badge.label}</div>` : ''}
            </div>
            <a href="/admin/meu-perfil" style="display:flex;align-items:center;gap:10px;padding:10px 16px;text-decoration:none;color:var(--text);font-size:13px;transition:background 0.15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Meu Perfil
            </a>
            <a href="/admin/configuracoes" style="display:flex;align-items:center;gap:10px;padding:10px 16px;text-decoration:none;color:var(--text);font-size:13px;transition:background 0.15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Configurações
            </a>
            <a href="/admin/suporte" style="display:flex;align-items:center;gap:10px;padding:10px 16px;text-decoration:none;color:var(--text);font-size:13px;transition:background 0.15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Suporte
            </a>
            <div style="border-top:1px solid var(--border);">
              <a href="/admin/logout" style="display:flex;align-items:center;gap:10px;padding:10px 16px;text-decoration:none;color:var(--error);font-size:13px;transition:background 0.15s;" onmouseover="this.style.background='rgba(239,68,68,0.08)'" onmouseout="this.style.background='transparent'">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sair da conta
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="content">
      ${breadcrumb ? `<nav style="display:flex;align-items:center;gap:6px;margin-bottom:20px;font-size:12px;">${breadcrumb.map((b, i) => i < breadcrumb.length - 1 ? `<a href="${b.href}" style="color:var(--gold);text-decoration:none;opacity:0.75;transition:opacity 0.15s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.75'">${b.label}</a><span style="color:var(--muted);font-size:13px;">›</span>` : `<span style="color:var(--text);font-weight:600;">${b.label}</span>`).join('')}</nav>` : ''}
      ${body}
    </div>
  </div>
  <script>
    // ─── Avatar dropdown ──────────────────────────────────────────────────────
    function toggleAvatarMenu() {
      var dd = document.getElementById('avatar-dropdown');
      if (!dd) return;
      var isOpen = dd.style.display !== 'none';
      dd.style.display = isOpen ? 'none' : 'block';
    }
    document.addEventListener('click', function(e) {
      var wrap = document.getElementById('avatar-menu-wrap');
      var dd = document.getElementById('avatar-dropdown');
      if (dd && wrap && !wrap.contains(e.target)) { dd.style.display = 'none'; }
    });
    // ─── Hambúrguer mobile ────────────────────────────────────────────────────
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    }
    function closeSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
    // Fechar sidebar ao clicar em link de nav (mobile)
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.addEventListener('click', function() {
        if (window.innerWidth < 900) closeSidebar();
      });
    });
    // ─── Toggle de tema ────────────────────────────────────────────────────────
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('bp_theme', next);
      updateThemeIcon(next);
    }
    function updateThemeIcon(theme) {
      var sun = document.getElementById('theme-icon-sun');
      var moon = document.getElementById('theme-icon-moon');
      var label = document.getElementById('theme-label');
      if (!sun || !moon) return;
      if (theme === 'dark') {
        sun.style.display = 'block'; moon.style.display = 'none';
        if (label) label.textContent = 'Claro';
      } else {
        sun.style.display = 'none'; moon.style.display = 'block';
        if (label) label.textContent = 'Escuro';
      }
    }
    // Inicializar ícone ao carregar
    (function() {
      var t = localStorage.getItem('bp_theme') || 'dark';
      var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      updateThemeIcon(isDark ? 'dark' : 'light');
    })();
  </script>
  <script>
    // ── Animações de navegação ──────────────────────────────────────────────
    (function() {
      var bar = document.getElementById('nav-progress');
      var mainContent = document.querySelector('.content');
      var timer = null;
      var width = 0;

      function startProgress() {
        if (!bar) return;
        clearInterval(timer);
        width = 0;
        bar.style.width = '0%';
        bar.classList.remove('done');
        bar.classList.add('running');
        timer = setInterval(function() {
          var step = width < 40 ? 8 : width < 70 ? 3 : 0.5;
          width = Math.min(width + step, 92);
          bar.style.width = width + '%';
        }, 80);
      }

      function finishProgress() {
        if (!bar) return;
        clearInterval(timer);
        bar.style.width = '100%';
        bar.classList.remove('running');
        bar.classList.add('done');
        setTimeout(function() {
          bar.classList.remove('done');
          bar.style.width = '0%';
        }, 600);
      }

      document.addEventListener('click', function(e) {
        var a = e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript') ||
            href.startsWith('http') || href.startsWith('//') ||
            a.target === '_blank') return;
        var navItem = a.closest('.nav-item');
        if (navItem) navItem.classList.add('nav-loading');
        startProgress();
      });

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          if (mainContent) mainContent.classList.add('content-enter');
          finishProgress();
        });
      } else {
        if (mainContent) mainContent.classList.add('content-enter');
        finishProgress();
      }
    })();
  </script>
</body>
</html>`;
}

// ─── Página de Login ──────────────────────────────────────────────────────────
function loginPage(error = false, errorMsg?: string, info?: string, infoEmail?: string): string {
  const REMEMBER_COOKIE = "bp_admin_remember_email";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login — Barber Pro Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold: #C9A84C;
      --gold-dim: rgba(201,168,76,0.12);
      --gold-glow: rgba(201,168,76,0.20);
      --bg: #080808;
      --surface: #111111;
      --surface2: #1A1A1A;
      --border: #222222;
      --border2: #2E2E2E;
      --text: #F2F0EA;
      --muted: #7A7870;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      -webkit-font-smoothing: antialiased;
    }
    /* ── Split layout ── */
    .login-left {
      flex: 1;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      position: relative;
      overflow: hidden;
    }
    .login-left::before {
      content: '';
      position: absolute;
      top: -120px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 600px;
      background: radial-gradient(ellipse at center, rgba(201,168,76,0.10) 0%, transparent 65%);
      pointer-events: none;
    }
    .login-left::after {
      content: '';
      position: absolute;
      bottom: -80px;
      right: -80px;
      width: 300px;
      height: 300px;
      background: radial-gradient(ellipse at center, rgba(201,168,76,0.06) 0%, transparent 70%);
      pointer-events: none;
    }
    .brand-block {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      text-align: center;
    }
    .brand-logo-wrap {
      width: 96px;
      height: 96px;
      background: var(--gold-dim);
      border: 1px solid rgba(201,168,76,0.25);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 40px rgba(201,168,76,0.12);
      overflow: hidden;
    }
    .brand-logo-wrap img {
      width: 80px;
      height: 80px;
      object-fit: contain;
    }
    .brand-name {
      font-size: 28px;
      font-weight: 900;
      color: var(--gold);
      letter-spacing: 3px;
      line-height: 1;
    }
    .brand-tagline {
      font-size: 14px;
      color: var(--muted);
      letter-spacing: 0.5px;
      line-height: 1.5;
      max-width: 280px;
    }
    .brand-divider {
      width: 40px;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
      border-radius: 2px;
    }
    .brand-stats {
      display: flex;
      gap: 32px;
      margin-top: 8px;
    }
    .brand-stat {
      text-align: center;
    }
    .brand-stat-value {
      font-size: 20px;
      font-weight: 800;
      color: var(--text);
    }
    .brand-stat-label {
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
      letter-spacing: 0.3px;
    }
    /* ── Formulário ── */
    .login-right {
      width: 440px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 40px;
      background: var(--bg);
    }
    .login-form-wrap {
      width: 100%;
      max-width: 360px;
    }
    .login-heading { font-size: 22px; font-weight: 800; color: var(--text); margin-bottom: 6px; }
    .login-sub { font-size: 13px; color: var(--muted); margin-bottom: 28px; }
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 12px; font-weight: 500; color: var(--muted); margin-bottom: 6px; letter-spacing: 0.3px; }
    .form-input { width: 100%; padding: 11px 13px; background: var(--surface2); border: 1px solid var(--border2); border-radius: 9px; color: var(--text); font-size: 14px; font-family: inherit; transition: border-color 0.12s, box-shadow 0.12s; }
    .form-input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold-dim); }
    .form-input::placeholder { color: var(--muted); }
    .remember-row { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; cursor: pointer; }
    .remember-row input[type=checkbox] { width: 15px; height: 15px; accent-color: var(--gold); cursor: pointer; }
    .remember-row span { font-size: 13px; color: var(--muted); }
    .btn-submit { width: 100%; padding: 13px; background: var(--gold); color: #0A0A0A; border: none; border-radius: 9px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.12s, transform 0.1s, box-shadow 0.12s; box-shadow: 0 2px 12px rgba(201,168,76,0.25); }
    .btn-submit:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(201,168,76,0.35); }
    .btn-submit:active { transform: translateY(0); }
    .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border2); }
    .divider span { font-size: 11px; color: var(--muted); white-space: nowrap; }
    .btn-google { width: 100%; padding: 12px 14px; background: var(--surface2); color: var(--text); border: 1px solid var(--border2); border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 9px; transition: background 0.12s, border-color 0.12s; }
    .btn-google:hover { background: #222222; border-color: #3A3A3A; }
    .login-links { display: flex; justify-content: space-between; margin-top: 20px; }
    .login-link { font-size: 12px; color: var(--muted); text-decoration: none; transition: color 0.12s; }
    .login-link:hover { color: var(--gold); }
    .alert-error { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); color: #F87171; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .alert-gold { background: var(--gold-dim); border: 1px solid rgba(201,168,76,0.25); color: var(--gold); padding: 12px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; line-height: 1.5; }
    .loading { opacity: 0.6; pointer-events: none; }
    /* ── Responsivo ── */
    @media (max-width: 768px) {
      body { flex-direction: column; }
      .login-left { display: none; }
      .login-right { width: 100%; min-height: 100vh; padding: 40px 24px; }
    }
  </style>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <!-- Lado esquerdo: marca -->
  <div class="login-left">
    <div class="brand-block">
      <div class="brand-logo-wrap">
        <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663028442847/CHUXnjOFayrIGRtV.png" alt="Barber Pro" style="width:64px;height:64px;object-fit:contain;border-radius:12px;" />
      </div>
      <div>
        <div class="brand-name">BARBER PRO</div>
      </div>
      <div class="brand-divider"></div>
      <div class="brand-tagline">Gestão completa para barbearias.<br/>Agenda, financeiro e assinaturas em um único painel.</div>
      <div class="brand-stats">
        <div class="brand-stat">
          <div class="brand-stat-value">500+</div>
          <div class="brand-stat-label">Barbearias</div>
        </div>
        <div class="brand-stat">
          <div class="brand-stat-value">98%</div>
          <div class="brand-stat-label">Satisfação</div>
        </div>
        <div class="brand-stat">
          <div class="brand-stat-value">24/7</div>
          <div class="brand-stat-label">Suporte</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Lado direito: formulário -->
  <div class="login-right">
    <div class="login-form-wrap">
      <div class="login-heading">Bem-vindo de volta</div>
      <div class="login-sub">Entre com sua conta para acessar o painel</div>
      ${info === 'already_exists' ? `<div class="alert-gold">Este e-mail já possui uma conta no Barber Pro${infoEmail ? ` (<strong>${infoEmail}</strong>)` : ''}. Faça login abaixo para acessar seu painel.</div>` : ''}
      ${error ? `<div class="alert-error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${errorMsg ?? "Email ou senha incorretos."}</div>` : ""}
      <form method="POST" action="/admin/login" id="loginForm">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" type="email" name="email" id="emailInput" placeholder="seu@email.com" required autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Senha</label>
          <input class="form-input" type="password" name="password" placeholder="••••••••" required />
        </div>
        <input type="hidden" name="remember" id="rememberInput" value="0" />
        <label class="remember-row" onclick="toggleRemember()">
          <input type="checkbox" id="rememberCheck" />
          <span>Lembrar meu e-mail neste dispositivo</span>
        </label>
        <button type="submit" class="btn-submit">Entrar no Painel</button>
      </form>
      <div class="divider"><span>ou continue com</span></div>
      <button class="btn-google" id="googleBtn" onclick="startGoogleLogin()">
        <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Entrar com Google
      </button>
      <div class="login-links">
        <a href="/admin/forgot-password" class="login-link">Esqueci minha senha</a>
        <a href="/" class="login-link">← Voltar ao app</a>
      </div>
    </div>
  </div>
  <script>
    // ─── Lembrar e-mail ───────────────────────────────────────────────────────
    const REMEMBER_KEY = "bp_admin_remember";
    const emailInput = document.getElementById("emailInput");
    const rememberCheck = document.getElementById("rememberCheck");
    const rememberInput = document.getElementById("rememberInput");

    // Restaurar e-mail salvo
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const { email, remember } = JSON.parse(saved);
        if (remember && email) {
          emailInput.value = email;
          rememberCheck.checked = true;
          rememberInput.value = "1";
        }
      }
    } catch(e) {}

    function toggleRemember() {
      // Checkbox toggle is handled by the label click natively
      setTimeout(() => {
        rememberInput.value = rememberCheck.checked ? "1" : "0";
      }, 0);
    }

    document.getElementById("loginForm").addEventListener("submit", function() {
      try {
        if (rememberCheck.checked) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: emailInput.value, remember: true }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch(e) {}
    });

    // ─── Login com Google ─────────────────────────────────────────────────────
    function startGoogleLogin() {
      const btn = document.getElementById("googleBtn");
      btn.classList.add("loading");
      btn.textContent = "Aguardando Google...";
      window.location.href = "/admin/google-login";
    }
  </script>
</body>
</html>`;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function renderDashboard(req: Request, res: Response) {
  try {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const dateStr = today();
  const tenantId = barber?.tenantId ?? null;
  const stats = await db.getDashboardStats(dateStr, tenantId);
  const yesterdayStr = yesterday();
  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);
  // ─── Próximo agendamento do dia ───────────────────────────────────────────
  const nowMinutes = (() => {
    const now = new Date();
    // Ajustar para horário de Brasília (UTC-3)
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return brt.getUTCHours() * 60 + brt.getUTCMinutes();
  })();
  const nextAppointment = appointments
    .filter((a: any) => {
      if (!a.startTime) return false;
      const [h, m] = a.startTime.split(':').map(Number);
      return (h * 60 + m) >= nowMinutes && ['scheduled', 'confirmed'].includes(a.status);
    })
    .sort((a: any, b: any) => {
      const [ah, am] = a.startTime.split(':').map(Number);
      const [bh, bm] = b.startTime.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    })[0] ?? null;
  const barbers = await db.getAllBarbers(tenantId);
  const lowStockItems = await db.getLowStockProducts(tenantId).catch((err) => {
    console.error("[Dashboard] Erro ao buscar produtos com estoque baixo:", err?.message ?? err);
    return [];
  });

  // Buscar slug e settings para o card de link e meta diária
  const dashSettings = await db.getShopSettings(tenantId).catch(() => null);
  const dailyGoal = dashSettings?.dailyGoal ?? 0;
  const dashTenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;
  const dashSlug = dashTenant?.slug ?? "";
  const dashBaseUrl = process.env.PUBLIC_BASE_URL ?? "";
  const dashBookingUrl = dashSlug ? `${dashBaseUrl}/pub/${dashSlug}/agendar` : "";
  const dashPublicUrl = dashSlug ? `${dashBaseUrl}/pub/${dashSlug}` : "";

  // ─── Dados dos últimos 7 dias para o gráfico ─────────────────────────────
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
  const totalWeekRevenue = weekDays.reduce((s, d) => s + d.revenue, 0);

  // ─── Pagamentos online pendentes ────────────────────────────────────────────
  let pendingOnlineCount = 0;
  let pendingOnlineTotal = 0;
  try {
    const dbConn = await db.getDb();
    if (dbConn && tenantId) {
      const raw = await dbConn.execute(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS total FROM online_payments WHERE "tenantId" = ${tenantId} AND status = 'pending'`) as any;
      const row = Array.isArray(raw) ? (raw[0] as any[])[0] : (raw?.rows?.[0]);
      pendingOnlineCount = parseInt(row?.cnt ?? '0', 10);
      pendingOnlineTotal = parseFloat(row?.total ?? '0');
    }
  } catch (_e) { /* silently ignore */ }

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
    <!-- 1. KPI Cards -->
    <div class="metrics-grid">
      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${statsYesterday.appointmentsToday} agendamento${statsYesterday.appointmentsToday !== 1 ? 's' : ''} · ${stats.appointmentsToday === 0 && statsYesterday.appointmentsToday === 0 ? '—' : statsYesterday.appointmentsToday === 0 ? '↑ novo' : stats.appointmentsToday > statsYesterday.appointmentsToday ? '↑ +' + Math.round((stats.appointmentsToday - statsYesterday.appointmentsToday) / statsYesterday.appointmentsToday * 100) + '%' : stats.appointmentsToday < statsYesterday.appointmentsToday ? '↓ ' + Math.round((stats.appointmentsToday - statsYesterday.appointmentsToday) / statsYesterday.appointmentsToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Agendamentos Hoje</div>
          <div class="metric-icon" style="background:var(--gold-dim)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:var(--gold)">${stats.appointmentsToday}</div>
        <div class="metric-sub">${stats.pendingAppointments} pendentes</div>
      </div>
      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${fmtCurrency(statsYesterday.revenueToday)} · ${stats.revenueToday === 0 && statsYesterday.revenueToday === 0 ? '—' : statsYesterday.revenueToday === 0 ? '↑ novo' : stats.revenueToday > statsYesterday.revenueToday ? '↑ +' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : stats.revenueToday < statsYesterday.revenueToday ? '↓ ' + Math.round((stats.revenueToday - statsYesterday.revenueToday) / statsYesterday.revenueToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Faturamento Hoje</div>
          <div class="metric-icon" style="background:rgba(74,222,128,.12)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:#4ADE80">${fmtCurrency(stats.revenueToday)}</div>
        ${dailyGoal > 0 ? (() => {
          const pct = Math.min(100, Math.round((stats.revenueToday / dailyGoal) * 100));
          const goalFmt = fmtCurrency(dailyGoal);
          const barColor = pct >= 100 ? '#22C55E' : pct >= 60 ? '#C9A84C' : '#EF4444';
          return `<div style='margin-top:6px'><div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px'><span style='font-size:10px;color:var(--muted)'>Meta: \${goalFmt}</span><span style='font-size:10px;font-weight:700;color:\${barColor}'>\${pct}%</span></div><div style='height:4px;background:var(--border);border-radius:2px;overflow:hidden'><div style='height:100%;width:\${pct}%;background:\${barColor};border-radius:2px;transition:width 0.6s ease'></div></div></div>`;
        })() : '<div class="metric-sub">vendas pagas</div>'}
      </div>
      <div class="metric-card kpi-tooltip">
        <div class="kpi-tip">Ontem: ${statsYesterday.clientsToday} cliente${statsYesterday.clientsToday !== 1 ? 's' : ''} · ${stats.clientsToday === 0 && statsYesterday.clientsToday === 0 ? '—' : statsYesterday.clientsToday === 0 ? '↑ novo' : stats.clientsToday > statsYesterday.clientsToday ? '↑ +' + Math.round((stats.clientsToday - statsYesterday.clientsToday) / statsYesterday.clientsToday * 100) + '%' : stats.clientsToday < statsYesterday.clientsToday ? '↓ ' + Math.round((stats.clientsToday - statsYesterday.clientsToday) / statsYesterday.clientsToday * 100) + '%' : '= igual'}</div>
        <div class="metric-header">
          <div class="metric-label">Clientes Atendidos</div>
          <div class="metric-icon" style="background:rgba(96,165,250,.12)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:#60A5FA">${stats.clientsToday}</div>
        <div class="metric-sub">hoje</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-label">Equipe Ativa</div>
          <div class="metric-icon" style="background:rgba(251,191,36,.12)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="metric-value" style="color:#FBBF24">${barbers.length}</div>
        <div class="metric-sub">profissionais</div>
      </div>
    </div>

    <!-- Card: Proximo Agendamento -->
    <div id="next-appt-wrap">
    ${nextAppointment ? (() => {
      const naClientName = (nextAppointment as any).clientName ?? clientMap[(nextAppointment as any).clientId] ?? 'Cliente';
      const naServiceName = (nextAppointment as any).serviceName ?? serviceMap[(nextAppointment as any).serviceId] ?? 'Servico';
      const naBarberName = barberMap[(nextAppointment as any).barberId] ?? '';
      const naTime = ((nextAppointment as any).startTime ?? '').substring(0, 5);
      const naStatusColor = (nextAppointment as any).status === 'confirmed' ? '#22C55E' : '#C9A84C';
      const naStatusLabel = (nextAppointment as any).status === 'confirmed' ? 'Confirmado' : 'Agendado';
      return `<div id="next-appt-card" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border:1px solid rgba(201,168,76,0.3);border-radius:16px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;gap:20px;box-shadow:0 4px 24px rgba(0,0,0,0.3);position:relative;overflow:hidden;transition:opacity 0.3s ease">
        <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,rgba(201,168,76,0.08) 0%,transparent 70%);pointer-events:none"></div>
        <div style="width:52px;height:52px;background:rgba(201,168,76,0.15);border:2px solid rgba(201,168,76,0.4);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px">Próximo Agendamento</span>
            <span id="next-appt-status-badge" style="font-size:10px;font-weight:700;color:${naStatusColor};background:${naStatusColor}22;border:1px solid ${naStatusColor}44;border-radius:4px;padding:1px 6px">${naStatusLabel}</span>
          </div>
          <div id="next-appt-client" style="font-size:18px;font-weight:800;color:#fff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${naClientName}</div>
          <div id="next-appt-service" style="font-size:13px;color:var(--muted)">${naServiceName}${naBarberName ? ' - ' + naBarberName : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div id="next-appt-time" style="font-size:28px;font-weight:900;color:#C9A84C;line-height:1">${naTime}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">hoje</div>
        </div>
      </div>`;
    })() : ''}
    </div>
    <!-- 2. Ações Rápidas -->
    <div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">Ações Rápidas</div>
      <div class="actions-grid-5" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
        <a href="/admin/agenda/novo" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(201,168,76,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--text);text-align:center;">Novo Agendamento</span>
        </a>
        <a href="/admin/clientes?new=1" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(33,150,243,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--text);text-align:center;">Novo Cliente</span>
        </a>
        <a href="/admin/financeiro?new=1" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(76,175,80,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--text);text-align:center;">Nova Venda</span>
        </a>
        <a href="/admin/servicos" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(156,39,176,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9C27B0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3L8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--text);text-align:center;">Serviços</span>
        </a>
        <a href="/admin/promocoes" class="action-card" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(239,68,68,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--text);text-align:center;">Nova Promoção</span>
        </a>
      </div>
    </div>

    <!-- 3. Agenda de Hoje -->
    ${lowStockItems.length > 0 ? `
    <a href="/admin/estoque" style="text-decoration:none;display:flex;align-items:center;gap:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:12px;padding:14px 16px;margin-bottom:20px;transition:background .2s;" onmouseover="this.style.background='rgba(245,158,11,.14)'" onmouseout="this.style.background='rgba(245,158,11,.08)'">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#F59E0B;">${lowStockItems.length} produto${lowStockItems.length !== 1 ? 's' : ''} com estoque baixo</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${lowStockItems.slice(0,3).map((p: any) => p.name + ' (' + (p.stockQuantity ?? 0) + ')').join(' · ')}${lowStockItems.length > 3 ? ' · ...' : ''}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </a>` : ''}
    ${pendingOnlineCount > 0 ? `
    <a href="/admin/relatorios?tab=pagamentos" style="text-decoration:none;display:flex;align-items:center;gap:12px;background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.3);border-radius:12px;padding:14px 16px;margin-bottom:20px;transition:background .2s;" onmouseover="this.style.background='rgba(96,165,250,.14)'" onmouseout="this.style.background='rgba(96,165,250,.08)'">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#60A5FA;">${pendingOnlineCount} pagamento${pendingOnlineCount !== 1 ? 's' : ''} online pendente${pendingOnlineCount !== 1 ? 's' : ''}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">Total aguardando: R$ ${pendingOnlineTotal.toFixed(2).replace('.', ',')}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </a>` : ''}
    <div class="card" style="margin-bottom:20px;overflow:hidden;">
      <div class="card-header">
        <div class="card-title">Agenda de Hoje &mdash; ${fmtDate(dateStr)}</div>
        <a href="/admin/agenda" class="btn btn-ghost btn-sm">Ver tudo</a>
      </div>
      <div class="card-body" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">${appointmentsHtml}</div>
    </div>

    <!-- 4. Gráfico de Faturamento/Agendamentos Semanal -->
    <div class="chart-card-inner" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%);pointer-events:none;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);letter-spacing:0.3px;" id="chart-title">Faturamento — Últimos 7 dias</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;" id="chart-subtitle">Total do período: <span style="color:#C9A84C;font-weight:700;" id="chart-total">${fmtCurrency(totalWeekRevenue)}</span></div>
        </div>
        <div class="chart-toggle-wrap" style="display:flex;gap:6px;flex-wrap:wrap;">
          <button id="btn-revenue" onclick="switchChart('revenue')" style="padding:6px 14px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid #C9A84C;background:#C9A84C;color:#0C0C0C;cursor:pointer;transition:all .2s;">Faturamento</button>
          <button id="btn-appointments" onclick="switchChart('appointments')" style="padding:6px 14px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .2s;">Agendamentos</button>
        </div>
      </div>
      <svg id="revenue-chart" viewBox="0 0 700 200" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;overflow:visible;" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#F5D78E" stop-opacity="1"/>
            <stop offset="100%" stop-color="#C9A84C" stop-opacity="0.7"/>
          </linearGradient>
          <linearGradient id="barGradAppt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#93C5FD" stop-opacity="1"/>
            <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.7"/>
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#C9A84C" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="areaGradAppt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
          </linearGradient>
          <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <style>
            .bar-rect { transform-origin: bottom; animation: bar-grow 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
            .bar-rect:nth-child(1) { animation-delay: 0ms; }
            .bar-rect:nth-child(2) { animation-delay: 80ms; }
            .bar-rect:nth-child(3) { animation-delay: 160ms; }
            .bar-rect:nth-child(4) { animation-delay: 240ms; }
            .bar-rect:nth-child(5) { animation-delay: 320ms; }
            .bar-rect:nth-child(6) { animation-delay: 400ms; }
            .bar-rect:nth-child(7) { animation-delay: 480ms; }
            @keyframes bar-grow { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
            .line-path { stroke-dasharray: 1000; stroke-dashoffset: 1000; animation: draw-line 1.2s ease 0.3s forwards; }
            @keyframes draw-line { to { stroke-dashoffset: 0; } }
            .area-path { opacity: 0; animation: fade-area 0.8s ease 0.8s forwards; }
            @keyframes fade-area { to { opacity: 1; } }
            .dot-point { opacity: 0; animation: pop-dot 0.3s ease both; }
            .dot-point:nth-child(1) { animation-delay: 0.9s; }
            .dot-point:nth-child(2) { animation-delay: 1.0s; }
            .dot-point:nth-child(3) { animation-delay: 1.1s; }
            .dot-point:nth-child(4) { animation-delay: 1.2s; }
            .dot-point:nth-child(5) { animation-delay: 1.3s; }
            .dot-point:nth-child(6) { animation-delay: 1.4s; }
            .dot-point:nth-child(7) { animation-delay: 1.5s; }
            @keyframes pop-dot { from { opacity:0; transform:scale(0); } to { opacity:1; transform:scale(1); } }
          </style>
        </defs>
        <!-- Grade horizontal -->
        ${[0.25, 0.5, 0.75, 1.0].map(pct => {
          const y = 160 - pct * 140;
          const val = maxRevenue * pct;
          return `<line x1="40" y1="${y}" x2="680" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,4"/>
          <text class="grid-label-rev" x="36" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--muted)">${val >= 1000 ? 'R$' + (val/1000).toFixed(1) + 'k' : 'R$' + val.toFixed(0)}</text>`;
        }).join('')}
        <!-- Barras -->
        <g id="bars-group">
          ${weekDays.map((d, i) => {
            const x = 40 + i * 92 + 18;
            const barW = 56;
            const barH = Math.max(d.revenue / maxRevenue * 140, d.revenue > 0 ? 4 : 0);
            const y = 160 - barH;
            const isToday = d.date === dateStr;
            return `<rect class="bar-rect" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" ry="6" fill="${isToday ? 'url(#barGrad)' : 'rgba(201,168,76,0.35)'}" data-rev="${d.revenue}" data-appt="0" />`;
          }).join('')}
        </g>
        <!-- Área sob a linha -->
        <path class="area-path" id="area-path" d="${(() => {
          const pts = weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0);
            return [cx, cy];
          });
          let path = `M ${pts[0][0]} 160 L ${pts[0][0]} ${pts[0][1]} `;
          for (let i = 1; i < pts.length; i++) {
            const cpx = (pts[i-1][0] + pts[i][0]) / 2;
            path += `C ${cpx} ${pts[i-1][1]} ${cpx} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]} `;
          }
          path += `L ${pts[pts.length-1][0]} 160 Z`;
          return path;
        })()}" fill="url(#areaGrad)"/>
        <!-- Linha de tendência -->
        <path class="line-path" id="line-path" d="${(() => {
          const pts = weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0);
            return [cx, cy];
          });
          let path = `M ${pts[0][0]} ${pts[0][1]} `;
          for (let i = 1; i < pts.length; i++) {
            const cpx = (pts[i-1][0] + pts[i][0]) / 2;
            path += `C ${cpx} ${pts[i-1][1]} ${cpx} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]} `;
          }
          return path;
        })()}" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Pontos na linha -->
        <g id="dots-group">
          ${weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0);
            return `<circle class="dot-point" cx="${cx}" cy="${cy}" r="4" fill="var(--surface)" stroke="#C9A84C" stroke-width="2"/>`;
          }).join('')}
        </g>
        <!-- Labels de valor -->
        <g id="labels-group">
          ${weekDays.map((d, i) => {
            const cx = 40 + i * 92 + 18 + 28;
            const cy = 160 - Math.max(d.revenue / maxRevenue * 140, 0) - 10;
            if (d.revenue === 0) return '';
            const label = d.revenue >= 1000 ? 'R$' + (d.revenue/1000).toFixed(1) + 'k' : 'R$' + d.revenue.toFixed(0);
            return `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="9" font-weight="700" fill="#C9A84C" opacity="0.9">${label}</text>`;
          }).join('')}
        </g>
        <!-- Labels dos dias -->
        ${weekDays.map((d, i) => {
          const cx = 40 + i * 92 + 18 + 28;
          const isToday = d.date === dateStr;
          return `<text x="${cx}" y="178" text-anchor="middle" font-size="11" font-weight="${isToday ? '700' : '500'}" fill="${isToday ? '#C9A84C' : 'var(--muted)'}">${d.label}</text>`;
        }).join('')}
        <!-- Linha base -->
        <line x1="40" y1="160" x2="680" y2="160" stroke="var(--border)" stroke-width="1"/>
      </svg>
      <script>
        // Dados do gráfico (injetados pelo servidor)
        var chartData = {
          revenue: [${weekDays.map(d => d.revenue).join(',')}],
          appointments: [${weekDays.map(d => d.appointmentsCount ?? 0).join(',')}],
          labels: [${weekDays.map(d => `"${d.label}"`).join(',')}],
          dates: [${weekDays.map(d => `"${d.date}"`).join(',')}],
          today: "${dateStr}"
        };
        var currentMode = 'revenue';
        function switchChart(mode) {
          if (mode === currentMode) return;
          currentMode = mode;
          var isRev = mode === 'revenue';
          // Atualizar botões
          document.getElementById('btn-revenue').style.background = isRev ? '#C9A84C' : 'transparent';
          document.getElementById('btn-revenue').style.color = isRev ? '#0C0C0C' : 'var(--muted)';
          document.getElementById('btn-revenue').style.borderColor = isRev ? '#C9A84C' : 'var(--border)';
          document.getElementById('btn-appointments').style.background = !isRev ? '#3B82F6' : 'transparent';
          document.getElementById('btn-appointments').style.color = !isRev ? '#fff' : 'var(--muted)';
          document.getElementById('btn-appointments').style.borderColor = !isRev ? '#3B82F6' : 'var(--border)';
          // Atualizar título e total
          var data = isRev ? chartData.revenue : chartData.appointments;
          var maxVal = Math.max.apply(null, data.concat([1]));
          var total = data.reduce(function(a,b){return a+b;},0);
          document.getElementById('chart-title').textContent = isRev ? 'Faturamento — Últimos 7 dias' : 'Agendamentos — Últimos 7 dias';
          var totalEl = document.getElementById('chart-total');
          totalEl.style.color = isRev ? '#C9A84C' : '#3B82F6';
          if (isRev) {
            var t = total >= 1000 ? 'R$ ' + (total/1000).toFixed(1) + 'k' : 'R$ ' + total.toFixed(2).replace('.',',');
            document.getElementById('chart-subtitle').innerHTML = 'Total do período: <span style="color:#C9A84C;font-weight:700;" id="chart-total">' + t + '</span>';
          } else {
            document.getElementById('chart-subtitle').innerHTML = 'Total do período: <span style="color:#3B82F6;font-weight:700;" id="chart-total">' + total + ' agendamento' + (total !== 1 ? 's' : '') + '</span>';
          }
          // Atualizar barras
          var bars = document.querySelectorAll('#bars-group rect');
          bars.forEach(function(bar, i) {
            var val = data[i] || 0;
            var barH = maxVal > 0 ? Math.max(val / maxVal * 140, val > 0 ? 4 : 0) : 0;
            var y = 160 - barH;
            var isToday = chartData.dates[i] === chartData.today;
            bar.setAttribute('y', y);
            bar.setAttribute('height', barH);
            bar.setAttribute('fill', isRev ? (isToday ? 'url(#barGrad)' : 'rgba(201,168,76,0.35)') : (isToday ? 'url(#barGradAppt)' : 'rgba(59,130,246,0.35)'));
          });
          // Atualizar linha e área
          var pts = data.map(function(val, i) {
            var cx = 40 + i * 92 + 18 + 28;
            var cy = maxVal > 0 ? 160 - Math.max(val / maxVal * 140, 0) : 160;
            return [cx, cy];
          });
          var linePath = 'M ' + pts[0][0] + ' ' + pts[0][1] + ' ';
          var areaPath = 'M ' + pts[0][0] + ' 160 L ' + pts[0][0] + ' ' + pts[0][1] + ' ';
          for (var i = 1; i < pts.length; i++) {
            var cpx = (pts[i-1][0] + pts[i][0]) / 2;
            linePath += 'C ' + cpx + ' ' + pts[i-1][1] + ' ' + cpx + ' ' + pts[i][1] + ' ' + pts[i][0] + ' ' + pts[i][1] + ' ';
            areaPath += 'C ' + cpx + ' ' + pts[i-1][1] + ' ' + cpx + ' ' + pts[i][1] + ' ' + pts[i][0] + ' ' + pts[i][1] + ' ';
          }
          areaPath += 'L ' + pts[pts.length-1][0] + ' 160 Z';
          document.getElementById('line-path').setAttribute('d', linePath);
          document.getElementById('line-path').style.stroke = isRev ? '#C9A84C' : '#3B82F6';
          document.getElementById('area-path').setAttribute('d', areaPath);
          document.getElementById('area-path').setAttribute('fill', isRev ? 'url(#areaGrad)' : 'url(#areaGradAppt)');
          // Atualizar pontos
          var dots = document.querySelectorAll('#dots-group circle');
          dots.forEach(function(dot, i) {
            var val = data[i] || 0;
            var cy = maxVal > 0 ? 160 - Math.max(val / maxVal * 140, 0) : 160;
            dot.setAttribute('cy', cy);
            dot.setAttribute('stroke', isRev ? '#C9A84C' : '#3B82F6');
          });
          // Atualizar labels
          var labelsG = document.getElementById('labels-group');
          labelsG.innerHTML = '';
          data.forEach(function(val, i) {
            if (val === 0) return;
            var cx = 40 + i * 92 + 18 + 28;
            var cy = maxVal > 0 ? 160 - Math.max(val / maxVal * 140, 0) - 10 : 150;
            var label = isRev ? (val >= 1000 ? 'R$' + (val/1000).toFixed(1) + 'k' : 'R$' + val.toFixed(0)) : val.toString();
            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', cx);
            text.setAttribute('y', cy);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '9');
            text.setAttribute('font-weight', '700');
            text.setAttribute('fill', isRev ? '#C9A84C' : '#3B82F6');
            text.setAttribute('opacity', '0.9');
            text.textContent = label;
            labelsG.appendChild(text);
          });
          // Atualizar grade
          var gridLabels = document.querySelectorAll('.grid-label-rev');
          gridLabels.forEach(function(el, i) {
            var pct = [0.25, 0.5, 0.75, 1.0][i];
            var val = maxVal * pct;
            el.textContent = isRev ? (val >= 1000 ? 'R$' + (val/1000).toFixed(1) + 'k' : 'R$' + val.toFixed(0)) : val.toFixed(0);
          });
        }
      </script>
    </div>

    <!-- 5. Link de Agendamento -->
    ${dashBookingUrl ? `
    <div class="card" style="background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);border:1px solid var(--gold)44;margin-bottom:20px;">
      <div class="card-header">
        <div class="card-title">Link de Agendamento Online</div>
        <a href="/admin/pagina-cliente" class="btn btn-ghost btn-sm">Configurar página</a>
      </div>
      <div class="card-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Compartilhe este link com seus clientes para que eles possam agendar online:</p>
        <div class="booking-btns" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
          <input id="dash-booking-url" class="form-input" type="text" value="${esc(dashBookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1;min-width:0" />
          <button onclick="(function(btn){navigator.clipboard.writeText(document.getElementById('dash-booking-url').value).then(()=>{var o=btn.innerHTML;btn.innerHTML='Copiado!';setTimeout(()=>btn.innerHTML=o,2000)});})(this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Copiar</button>
          <a href="${esc(dashBookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Abrir</a>
          <a href="https://wa.me/?text=${encodeURIComponent('Agende seu horário: ' + dashBookingUrl)}" target="_blank" class="btn btn-primary" style="flex-shrink:0;padding:8px 14px;font-size:12px">WhatsApp</a>
        </div>
        ${dashPublicUrl ? `
        <div style="margin-top:8px;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-weight:600;letter-spacing:0.3px;">PREVIEW DA SUA PÁGINA</div>
          <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border);position:relative;">
            <div style="background:var(--surface2);padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);">
              <div style="display:flex;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#EF4444;"></div><div style="width:10px;height:10px;border-radius:50%;background:#F59E0B;"></div><div style="width:10px;height:10px;border-radius:50%;background:#22C55E;"></div></div>
              <div style="flex:1;background:var(--surface);border-radius:6px;padding:4px 10px;font-size:10px;color:var(--muted);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(dashPublicUrl)}</div>
              <a href="${esc(dashPublicUrl)}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;">Abrir ↗</a>
            </div>
            <div class="page-preview-iframe-wrap" style="height:280px;overflow:hidden;position:relative;">
              <iframe src="${esc(dashPublicUrl)}" style="width:100%;height:100%;border:none;pointer-events:none;transform-origin:top left" scrolling="no" loading="lazy" title="Preview da sua página"></iframe>
              <a href="${esc(dashPublicUrl)}" target="_blank" style="position:absolute;inset:0;display:block;cursor:pointer" title="Abrir página pública"></a>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- 6. Card: Baixe o App -->
    <div id="download-app-card" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);border:1px solid rgba(201,168,76,0.25);border-radius:16px;padding:0;margin-bottom:20px;display:none;overflow:hidden;position:relative">
      <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(201,168,76,0.12) 0%,transparent 70%);pointer-events:none"></div>
      <div style="position:absolute;bottom:-60px;left:-20px;width:180px;height:180px;background:radial-gradient(circle,rgba(96,165,250,0.06) 0%,transparent 70%);pointer-events:none"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px 0">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.05));border:1px solid rgba(201,168,76,0.3);display:flex;align-items:center;justify-content:center;font-size:22px">📱</div>
          <div>
            <div style="font-size:15px;font-weight:800;color:#F1F5F9;letter-spacing:-0.3px">Baixe o App no Celular</div>
            <div style="font-size:11px;color:rgba(201,168,76,0.8);margin-top:2px;font-weight:500">Gerencie sua barbearia de qualquer lugar</div>
          </div>
        </div>
        <button onclick="document.getElementById('download-app-card').style.display='none'" style="background:rgba(255,255,255,0.06);border:none;color:rgba(241,245,249,0.5);cursor:pointer;padding:6px;border-radius:8px;font-size:16px;line-height:1;transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">✕</button>
      </div>
      <div id="app-content-android" style="display:none;padding:16px 20px 20px">
        <div style="display:flex;gap:20px;align-items:flex-start">
          <div style="flex-shrink:0">
            <img src="/admin/app-qrcode" alt="QR Code" style="width:120px;height:120px;border-radius:12px;border:2px solid rgba(201,168,76,0.3);background:#fff;padding:4px" />
          </div>
          <div style="flex:1">
            <div style="font-size:12px;color:rgba(148,163,184,0.8);margin-bottom:14px;line-height:1.5">Escaneie o QR Code com a câmera do seu celular Android para baixar o app Barber Pro:</div>
            <a href="https://play.google.com/store/apps/details?id=space.manus.barber.app" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(34,197,94,0.3);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 16px rgba(34,197,94,0.4)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 12px rgba(34,197,94,0.3)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5v-17c0-.83 1-.83 1.5-.5l14 8.5c.5.3.5 1 0 1.3l-14 8.5c-.5.3-1.5.3-1.5-.8z"/></svg>
              Google Play →
            </a>
          </div>
        </div>
      </div>
      <div id="app-content-ios" style="display:none;padding:16px 20px 20px">
        <div style="display:flex;gap:16px;align-items:center;background:rgba(255,255,255,0.04);border-radius:12px;padding:14px;border:1px solid rgba(255,255,255,0.08)">
          <div style="font-size:28px">🍎</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#F1F5F9;margin-bottom:4px">iPhone — App Store</div>
            <div style="font-size:12px;color:rgba(148,163,184,0.7);line-height:1.4">Em breve disponível na App Store.<br>Aguarde novidades!</div>
          </div>
        </div>
      </div>
      <div id="app-content-desktop" style="display:none;padding:16px 20px 20px">
        <div style="display:flex;gap:16px;align-items:center;background:rgba(255,255,255,0.04);border-radius:12px;padding:14px;border:1px solid rgba(255,255,255,0.08)">
          <div style="font-size:28px">💻</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#F1F5F9;margin-bottom:4px">Acesse pelo celular</div>
            <div style="font-size:12px;color:rgba(148,163,184,0.7);line-height:1.4">O app está disponível para Android.<br>Acesse esta página pelo seu celular para baixar.</div>
          </div>
        </div>
      </div>
    </div>
    <script>
      (function() {
        var card = document.getElementById('download-app-card');
        var ua = navigator.userAgent;
        var isAndroid = /Android/i.test(ua);
        var isIOS = /iPhone|iPad|iPod/i.test(ua);
        card.style.display = 'block';
        if (isAndroid) { document.getElementById('app-content-android').style.display = 'block'; }
        else if (isIOS) { document.getElementById('app-content-ios').style.display = 'block'; }
        else { document.getElementById('app-content-desktop').style.display = 'block'; }
      })();
    </script>
    <script>
      /* Polling automático do card Próximo Agendamento — atualiza a cada 60s */
      (function() {
        function renderNextAppt(d) {
          if (!d || !d.clientName) return '';
          var statusColor = d.status === 'confirmed' ? '#22C55E' : '#C9A84C';
          var statusLabel = d.status === 'confirmed' ? 'Confirmado' : 'Agendado';
          var service = d.serviceName || '';
          if (d.barberName) service += ' - ' + d.barberName;
          return '<div id="next-appt-card" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border:1px solid rgba(201,168,76,0.3);border-radius:16px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;gap:20px;box-shadow:0 4px 24px rgba(0,0,0,0.3);position:relative;overflow:hidden;opacity:0;transition:opacity 0.4s ease">'
            + '<div style="position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,rgba(201,168,76,0.08) 0%,transparent 70%);pointer-events:none"></div>'
            + '<div style="width:52px;height:52px;background:rgba(201,168,76,0.15);border:2px solid rgba(201,168,76,0.4);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
            + '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
            + '</div>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
            + '<span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px">Pr\u00f3ximo Agendamento</span>'
            + '<span style="font-size:10px;font-weight:700;color:' + statusColor + ';background:' + statusColor + '22;border:1px solid ' + statusColor + '44;border-radius:4px;padding:1px 6px">' + statusLabel + '</span>'
            + '</div>'
            + '<div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.clientName + '</div>'
            + '<div style="font-size:13px;color:var(--muted)">' + service + '</div>'
            + '</div>'
            + '<div style="text-align:right;flex-shrink:0">'
            + '<div style="font-size:28px;font-weight:900;color:#C9A84C;line-height:1">' + d.startTime + '</div>'
            + '<div style="font-size:11px;color:var(--muted);margin-top:2px">hoje</div>'
            + '</div>'
            + '</div>';
        }
        function refreshNextAppt() {
          var wrap = document.getElementById('next-appt-wrap');
          if (!wrap) return;
          fetch('/admin-api/next-appointment', { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(d) {
              var oldCard = document.getElementById('next-appt-card');
              if (d && d.clientName) {
                /* Tem próximo agendamento */
                if (oldCard) {
                  /* Atualizar campos inline com fade */
                  oldCard.style.opacity = '0';
                  setTimeout(function() {
                    var el;
                    el = document.getElementById('next-appt-client'); if (el) el.textContent = d.clientName;
                    var svc = d.serviceName || ''; if (d.barberName) svc += ' - ' + d.barberName;
                    el = document.getElementById('next-appt-service'); if (el) el.textContent = svc;
                    el = document.getElementById('next-appt-time'); if (el) el.textContent = d.startTime;
                    var statusColor = d.status === 'confirmed' ? '#22C55E' : '#C9A84C';
                    var statusLabel = d.status === 'confirmed' ? 'Confirmado' : 'Agendado';
                    el = document.getElementById('next-appt-status-badge');
                    if (el) { el.textContent = statusLabel; el.style.color = statusColor; el.style.background = statusColor + '22'; el.style.borderColor = statusColor + '44'; }
                    oldCard.style.opacity = '1';
                  }, 300);
                } else {
                  /* Card não existe ainda — inserir HTML completo */
                  wrap.innerHTML = renderNextAppt(d);
                  var newCard = document.getElementById('next-appt-card');
                  if (newCard) { setTimeout(function() { newCard.style.opacity = '1'; }, 50); }
                }
              } else {
                /* Não há próximo agendamento — remover card se existir */
                if (oldCard) {
                  oldCard.style.opacity = '0';
                  setTimeout(function() { wrap.innerHTML = ''; }, 350);
                }
              }
            })
            .catch(function() { /* silencioso */ });
        }
        setInterval(refreshNextAppt, 60000);
      })();
    </script>
  `;
  res.send(adminLayout("Dashboard", "dashboard", body, barber?.name, dashTenant?.plan ?? ""));
  } catch (dashErr: any) {
    console.error("[Dashboard] Erro ao renderizar:", dashErr?.message ?? dashErr);
    res.status(500).send(`<h2>Erro ao carregar o dashboard. <a href="/admin">Tentar novamente</a></h2>`);
  }
}

// ─── Agenda ───────────────────────────────────────────────────────────────────
async function renderAgenda(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
  const dateStr = (req.query.date as string) || today();
  const filterBarberId = req.query.barberId ? parseInt(req.query.barberId as string) : null;
  const planSaved = req.query.planSaved === "1";
  const filterSearch = ((req.query.q as string) || "").toLowerCase().trim();
  const allAppointments = await db.getAllAppointmentsByDate(dateStr, tenantId);
  const barbers = await db.getAllBarbers(tenantId);
  const allClientsForModal = await db.getAllClients(tenantId);
  let agendaPlans: any[] = [];
  try {
    const dbConn = await db.getDb();
    if (dbConn && tenantId) {
      const rawP = await dbConn.execute(sql`SELECT id, name, price, recurrences FROM subscription_plans WHERE "tenantId" = ${tenantId} AND "isActive" = true ORDER BY name`) as any;
      agendaPlans = Array.isArray(rawP) ? (rawP[0] as any[]) : (rawP?.rows ?? []);
    }
  } catch(e) { /* planos indisponíveis */ }
  // Buscar datas com agendamentos no mês para indicador visual
  let datesWithAppointments: Set<string> = new Set();
  try {
    const dbConn2 = await db.getDb();
    if (dbConn2 && tenantId) {
      const selDate2 = new Date(dateStr + "T12:00:00");
      const monthStart = `${selDate2.getFullYear()}-${String(selDate2.getMonth()+1).padStart(2,"0")}-01`;
      const monthEnd = `${selDate2.getFullYear()}-${String(selDate2.getMonth()+1).padStart(2,"0")}-31`;
      const rawDates = await dbConn2.execute(sql`SELECT DISTINCT date FROM appointments WHERE "tenantId" = ${tenantId} AND date >= ${monthStart} AND date <= ${monthEnd} AND status != 'cancelled'`) as any;
      const dateRows = Array.isArray(rawDates) ? (rawDates[0] as any[]) : (rawDates?.rows ?? []);
      datesWithAppointments = new Set(dateRows.map((r: any) => String(r.date).substring(0,10)));
    }
  } catch(e) { /* datas indisponíveis */ }

  // Carregar todos os clientes e serviços do dia
  const services = await db.getAllServices(false, tenantId);
  const clients = await db.getAllClients(tenantId);
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

  // Calendário mensal completo (igual ao app)
  const selDate = new Date(dateStr + "T12:00:00");
  const calYear = selDate.getFullYear();
  const calMonth = selDate.getMonth();
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const todayStr = today();
  // Gerar células do calendário
  const calCells: string[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) calCells.push('');
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(calMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    calCells.push(`${calYear}-${mm}-${dd}`);
  }
  // Mês anterior e próximo para navegação
  const prevMonthDate = new Date(calYear, calMonth - 1, 1);
  const nextMonthDate = new Date(calYear, calMonth + 1, 1);
  const prevMonthStr = prevMonthDate.toISOString().split("T")[0].substring(0, 7) + "-01";
  const nextMonthStr = nextMonthDate.toISOString().split("T")[0].substring(0, 7) + "-01";
  const calendarHtml = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px 18px;width:100%;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <a href="/admin/agenda?date=${prevMonthStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" style="text-decoration:none;color:var(--gold);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(201,168,76,0.1);transition:background .15s;" onmouseover="this.style.background='rgba(201,168,76,0.2)'" onmouseout="this.style.background='rgba(201,168,76,0.1)'" title="Mês anterior">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </a>
        <div style="text-align:center;">
          <div style="font-size:17px;font-weight:800;color:var(--text);letter-spacing:-0.3px;">${monthNames[calMonth]}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:500;">${calYear}</div>
        </div>
        <a href="/admin/agenda?date=${nextMonthStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" style="text-decoration:none;color:var(--gold);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(201,168,76,0.1);transition:background .15s;" onmouseover="this.style.background='rgba(201,168,76,0.2)'" onmouseout="this.style.background='rgba(201,168,76,0.1)'" title="Próximo mês">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:8px;">
        ${dayLabels.map(d => `<div style="text-align:center;font-size:10px;font-weight:700;color:var(--muted);padding:6px 0;text-transform:uppercase;letter-spacing:0.5px;">${d}</div>`).join("")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
        ${calCells.map(d => {
          if (!d) return `<div></div>`;
          const isSelected = d === dateStr;
          const isToday = d === todayStr;
          const dayNum = parseInt(d.split("-")[2]);
          return `<a href="/admin/agenda?date=${d}${filterBarberId ? '&barberId=' + filterBarberId : ''}" style="text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;aspect-ratio:1;border-radius:10px;font-size:14px;font-weight:${isSelected || isToday ? '800' : '500'};color:${isSelected ? '#0A0A0A' : isToday ? 'var(--gold)' : 'var(--text)'};background:${isSelected ? 'var(--gold)' : isToday ? 'rgba(201,168,76,0.12)' : 'transparent'};border:${isToday && !isSelected ? '1.5px solid var(--gold)' : '1.5px solid transparent'};transition:all .15s;" onmouseover="if(this.style.background!='var(--gold)')this.style.background='rgba(201,168,76,0.08)'" onmouseout="if(this.style.background!='var(--gold)')this.style.background='${isSelected ? 'var(--gold)' : isToday ? 'rgba(201,168,76,0.12)' : 'transparent'}'">${dayNum}<span style="width:5px;height:5px;border-radius:50%;background:${isSelected ? 'rgba(10,10,10,0.6)' : 'var(--gold)'};margin-top:3px;opacity:${datesWithAppointments.has(d) ? '1' : '0'};display:block;"></span></a>`;
        }).join("")}
      </div>
    </div>`;

  // Filtros
  const filtersHtml = `
    <form method="GET" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;align-items:center">
      <input type="hidden" name="date" value="${dateStr}" />
      <select name="barberId" onchange="this.form.submit()" style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;min-width:120px">
        <option value="">Todos os profissionais</option>
        ${barbers.map((b: any) => `<option value="${b.id}"${filterBarberId === b.id ? " selected" : ""}>${esc(b.name)}</option>`).join("")}
      </select>
      <div style="display:flex;flex:1;min-width:120px;gap:8px">
        <input type="text" name="q" value="${esc(filterSearch)}" placeholder="Buscar por nome ou telefone..."
          style="flex:1;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px" />
        <button type="submit" class="btn btn-primary" style="padding:8px 16px;font-size:13px">Buscar</button>
        ${filterSearch || filterBarberId ? `<a href="/admin/agenda?date=${dateStr}" class="btn btn-ghost" style="padding:8px 12px;font-size:13px"></a>` : ""}
      </div>
      <button type="button" onclick="document.getElementById('planModal').style.display='flex'" class="btn btn-ghost" style="padding:8px 16px;font-size:13px;white-space:nowrap;border:1px solid var(--gold);color:var(--gold);display:inline-flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Plano
      </button>
      <button type="button" onclick="document.getElementById('newApptModal').style.display='flex'" class="btn btn-primary" style="padding:8px 18px;font-size:13px;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Novo
      </button>
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

  const planModalHtml = `
    <!-- Modal Atribuir Plano -->
    <div id="planModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
      <div style="background:var(--surface);border-radius:16px;padding:28px;width:520px;max-width:90vw;max-height:90vh;overflow-y:auto;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text);">Atribuir Plano de Assinatura</h2>
            <p style="font-size:13px;color:var(--muted);margin-top:4px;">Selecione o cliente e o plano para criar a assinatura</p>
          </div>
          <button onclick="document.getElementById('planModal').style.display='none'" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;line-height:1;">&#10005;</button>
        </div>
        ${agendaPlans.length === 0 ? '<div style="text-align:center;padding:24px;color:var(--muted);font-size:14px;">Nenhum plano ativo. <a href="/admin/planos" style="color:var(--gold);">Criar plano</a></div>' : `
        <form method="POST" action="/admin/assinaturas/nova" id="planAssignForm">
          <input type="hidden" name="fromAgenda" value="1" />
          <input type="hidden" name="returnDate" value="${dateStr}" />
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;display:block;">Cliente *</label>
            <input type="hidden" name="clientId" id="planClientIdHidden" required />
            <div style="position:relative;margin-bottom:8px;">
              <input type="text" id="clientSearchInput" placeholder="Buscar por nome ou telefone..." autocomplete="off"
                style="width:100%;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;box-sizing:border-box;"
                oninput="filterClients(this.value)"
                onfocus="document.getElementById('planClientList').style.display='block'"
                onblur="setTimeout(()=>{document.getElementById('planClientList').style.display='none'},200)" />
              <div id="planClientList" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:10px;max-height:200px;overflow-y:auto;z-index:300;box-shadow:0 8px 24px rgba(0,0,0,0.4);margin-top:4px;">
                ${allClientsForModal.map((c: any) => `<div class="plan-client-item" data-id="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone ?? '')}" onclick="choosePlanClient(this)" style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;" onmouseover="this.style.background='rgba(201,168,76,0.08)'" onmouseout="this.style.background=''"><strong style="color:var(--text)">${esc(c.name)}</strong>${c.phone ? `<span style="color:var(--muted);font-size:12px">${esc(c.phone)}</span>` : ''}</div>`).join('')}
              </div>
            </div>
            <div id="planClientChosen" style="display:none;padding:10px 14px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);border-radius:10px;font-size:13px;color:var(--text);display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span id="planClientChosenName"></span>
              <button type="button" onclick="clearPlanClientChoice()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:0 4px;line-height:1;">×</button>
            </div>
            <script>
              function filterClients(q) {
                q = q.toLowerCase();
                document.querySelectorAll('.plan-client-item').forEach(function(el) {
                  const n = el.dataset.name.toLowerCase(), p = (el.dataset.phone || '').toLowerCase();
                  el.style.display = (n.includes(q) || p.includes(q)) ? '' : 'none';
                });
                document.getElementById('planClientList').style.display = 'block';
              }
              function choosePlanClient(el) {
                document.getElementById('planClientIdHidden').value = el.dataset.id;
                document.getElementById('clientSearchInput').value = el.dataset.name + (el.dataset.phone ? ' — ' + el.dataset.phone : '');
                document.getElementById('planClientList').style.display = 'none';
                const chosen = document.getElementById('planClientChosen');
                document.getElementById('planClientChosenName').textContent = el.dataset.name + (el.dataset.phone ? ' — ' + el.dataset.phone : '');
                chosen.style.display = 'flex';
              }
              function clearPlanClientChoice() {
                document.getElementById('planClientIdHidden').value = '';
                document.getElementById('clientSearchInput').value = '';
                document.getElementById('planClientChosen').style.display = 'none';
              }
            </script>
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;display:block;">Plano *</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${agendaPlans.map((plan: any) => `
              <label style="display:flex;align-items:center;gap:12px;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px 16px;cursor:pointer;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
                <input type="radio" name="planId" value="${plan.id}" required style="accent-color:var(--gold);width:16px;height:16px;flex-shrink:0;" />
                <div style="flex:1;">
                  <div style="font-size:14px;font-weight:700;color:var(--text);">${esc(plan.name)}</div>
                  <div style="font-size:12px;color:var(--muted);margin-top:2px;">${plan.recurrences} recorrências</div>
                </div>
                <div style="font-size:18px;font-weight:900;color:var(--gold);">R$ ${parseFloat(plan.price).toFixed(2)}</div>
              </label>`).join('')}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label" style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;display:block;">Data de início *</label>
              <input type="date" name="startDate" class="form-input" value="${dateStr}" required style="width:100%;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;display:block;">Forma de pagamento</label>
              <select name="paymentMethod" class="form-input" style="width:100%;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;">
                <option value="cash">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="credit_card">Cartão de crédito</option>
                <option value="debit_card">Cartão de débito</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:20px;">
            <button type="button" onclick="document.getElementById('planModal').style.display='none'" class="btn" style="flex:1;padding:10px;">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1;padding:10px;">Confirmar Assinatura</button>
          </div>
        </form>`}
      </div>
    </div>
  `;

  const body = `
    <!-- Header moderno da Agenda -->
    <style>
      .agenda-page { display:grid; grid-template-columns: 340px 1fr; gap:28px; align-items:flex-start; }
      @media(max-width:960px){ .agenda-page{ grid-template-columns:1fr; } }
      .agenda-left-panel { display:flex; flex-direction:column; gap:16px; }
      .agenda-panel-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:18px; }
      .agenda-appt-card-new { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px 18px; cursor:pointer; transition:border-color .15s, box-shadow .15s, transform .1s; display:flex; align-items:center; gap:14px; }
      .agenda-appt-card-new:hover { border-color:rgba(201,168,76,0.5); box-shadow:0 4px 20px rgba(0,0,0,0.25); transform:translateY(-1px); }
      .agenda-day-nav-link { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border:1px solid var(--border); border-radius:10px; text-decoration:none; color:var(--text); background:var(--bg); transition:all .15s; }
      .agenda-day-nav-link:hover { border-color:var(--gold); color:var(--gold); background:rgba(201,168,76,0.08); }
      .agenda-today-link { display:block; text-align:center; padding:9px; background:var(--bg); border:1px solid var(--border); border-radius:12px; text-decoration:none; color:var(--muted); font-size:12px; font-weight:700; transition:all .15s; letter-spacing:0.3px; }
      .agenda-today-link:hover { border-color:var(--gold); color:var(--gold); }
      .agenda-view-toggle { display:flex; gap:4px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:4px; width:fit-content; margin-bottom:18px; }
      .agenda-view-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; border:none; }
      .agenda-filter-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:18px; }
      .agenda-filter-bar select, .agenda-filter-bar input[type=text] { padding:9px 14px; background:var(--surface); border:1px solid var(--border); border-radius:12px; color:var(--text); font-size:13px; transition:border-color .15s; }
      .agenda-filter-bar select:focus, .agenda-filter-bar input[type=text]:focus { outline:none; border-color:var(--gold); }
    </style>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <div style="width:4px;height:30px;background:var(--gold);border-radius:2px;flex-shrink:0;"></div>
          <h1 style="font-size:28px;font-weight:900;color:var(--text);margin:0;letter-spacing:-0.5px;">${fmtDate(dateStr)}</h1>
        </div>
        <p style="font-size:13px;color:var(--muted);margin:0 0 0 14px;">${appointments.length === 0 ? 'Nenhum agendamento' : appointments.length + ' agendamento' + (appointments.length !== 1 ? 's' : '')}${filterSearch || filterBarberId ? " — filtrado" : ""}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button onclick="document.getElementById('planModal').style.display='flex'" style="display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border:1.5px solid var(--gold);background:transparent;color:var(--gold);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='rgba(201,168,76,0.1)'" onmouseout="this.style.background='transparent'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Plano
        </button>
        <button type="button" onclick="document.getElementById('newApptModal').style.display='flex'" style="display:inline-flex;align-items:center;gap:7px;padding:10px 22px;background:var(--gold);color:#0A0A0A;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;transition:opacity .15s;box-shadow:0 4px 16px rgba(201,168,76,0.3);" onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Novo Agendamento
        </button>
      </div>
    </div>

    <!-- Layout dois painéis -->
    <div class="agenda-page">

      <!-- Painel esquerdo: calendário + navegação de dia -->
      <div class="agenda-left-panel">
        ${calendarHtml}
        <!-- Navegação de dia -->
        <div class="agenda-panel-card" style="padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <a href="/admin/agenda?date=${prevDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" class="agenda-day-nav-link" title="Dia anterior">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </a>
            <input type="date" value="${dateStr}" onchange="location.href='/admin/agenda?date='+this.value+'${filterBarberId ? '&barberId=' + filterBarberId : ''}'"
              style="flex:1;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;text-align:center;font-weight:600;" />
            <a href="/admin/agenda?date=${nextDate.toISOString().split("T")[0]}${filterBarberId ? "&barberId=" + filterBarberId : ""}" class="agenda-day-nav-link" title="Próximo dia">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
          <a href="/admin/agenda?date=${todayStr}${filterBarberId ? '&barberId=' + filterBarberId : ''}" class="agenda-today-link">📅 Ir para Hoje</a>
        </div>
      </div>

      <!-- Painel direito: filtros + lista de agendamentos -->
      <div style="min-width:0;">
        <!-- Filtros modernos -->
        <form method="GET" class="agenda-filter-bar">
          <input type="hidden" name="date" value="${dateStr}" />
          <select name="barberId" onchange="this.form.submit()" style="min-width:180px;">
            <option value="">Todos os profissionais</option>
            ${barbers.map((b: any) => `<option value="${b.id}"${filterBarberId === b.id ? " selected" : ""}>${esc(b.name)}</option>`).join("")}
          </select>
          <div style="display:flex;flex:1;min-width:200px;gap:8px;">
            <input type="text" name="q" value="${esc(filterSearch)}" placeholder="Buscar por nome ou telefone..." style="flex:1;" />
            <button type="submit" class="btn btn-primary" style="padding:9px 18px;font-size:13px;white-space:nowrap;border-radius:12px;">Buscar</button>
            ${filterSearch || filterBarberId ? `<a href="/admin/agenda?date=${dateStr}" class="btn btn-ghost" style="padding:9px 14px;font-size:13px;border-radius:12px;">✕ Limpar</a>` : ""}
          </div>
        </form>

        <!-- Toggle de vista (pill) -->
        <div class="agenda-view-toggle">
          <button type="button" id="btnViewCards" onclick="setView('cards')" class="agenda-view-btn" style="background:var(--gold);color:#0A0A0A;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Cards
          </button>
          <button type="button" id="btnViewTimeline" onclick="setView('timeline')" class="agenda-view-btn" style="background:transparent;color:var(--muted);">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Linha do Tempo
          </button>
        </div>
        <!-- Vista Cards -->
        <div id="viewCards">
        ${appointments.length === 0
          ? `<div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:60px 40px;text-align:center;color:var(--muted);">
               <div style="width:72px;height:72px;border-radius:20px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               </div>
               <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">Nenhum agendamento</div>
               <div style="font-size:13px;color:var(--muted);">Não há agendamentos para ${fmtDate(dateStr)}${filterSearch || filterBarberId ? " com os filtros aplicados" : ""}.</div>
               <button type="button" onclick="document.getElementById('newApptModal').style.display='flex'" style="margin-top:20px;display:inline-flex;align-items:center;gap:7px;padding:10px 22px;background:var(--gold);color:#0A0A0A;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">
                 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                 Criar Agendamento
               </button>
             </div>`
          : `<div style="display:flex;flex-direction:column;gap:10px">
              ${appointments.map((a: any) => {
                const statusColors: Record<string, {bg:string;border:string;text:string}> = {
                  scheduled:        {bg:"rgba(201,168,76,0.08)",  border:"rgba(201,168,76,0.3)",  text:"#C9A84C"},
                  confirmed:        {bg:"rgba(76,175,80,0.08)",   border:"rgba(76,175,80,0.3)",   text:"#4CAF50"},
                  in_progress:      {bg:"rgba(33,150,243,0.08)",  border:"rgba(33,150,243,0.3)",  text:"#2196F3"},
                  completed:        {bg:"rgba(136,136,128,0.08)", border:"rgba(136,136,128,0.3)", text:"#888880"},
                  cancelled:        {bg:"rgba(244,67,54,0.08)",   border:"rgba(244,67,54,0.3)",   text:"#F44336"},
                  no_show:          {bg:"rgba(255,152,0,0.08)",   border:"rgba(255,152,0,0.3)",   text:"#FF9800"},
                  pending_approval: {bg:"rgba(255,107,53,0.08)",  border:"rgba(255,107,53,0.3)",  text:"#FF6B35"},
                };
                const statusLabels: Record<string,string> = {
                  scheduled:"Agendado", confirmed:"Confirmado", in_progress:"Em andamento",
                  completed:"Concluído", cancelled:"Cancelado", no_show:"Não compareceu",
                  pending_approval:"Aguarda aprovação"
                };
                const sc = statusColors[a.status] ?? {bg:"rgba(136,136,128,0.08)",border:"rgba(136,136,128,0.3)",text:"#888880"};
                const sl = statusLabels[a.status] ?? a.status;
                const serviceNames = a.serviceNames ?? a.serviceName ?? "—";
                const initials = (a.clientName ?? '?').split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase();
                return `<div id="appt-card-${a.id}" onclick="openEditModal(${JSON.stringify({id:a.id,clientName:a.clientName??'',clientPhone:a.clientPhone??'',serviceId:a.serviceId,serviceName:serviceNames,barberId:a.barberId,barberName:a.barberName??'',date:a.date,startTime:a.startTime??'',endTime:a.endTime??'',status:a.status,notes:a.notes??''})})" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px 18px;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .1s;display:flex;align-items:center;gap:14px;" onmouseover="this.style.borderColor='rgba(201,168,76,0.5)';this.style.boxShadow='0 4px 20px rgba(0,0,0,0.25)';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='var(--border)';this.style.boxShadow='none';this.style.transform='none'">
                  <!-- Horário -->
                  <div style="flex-shrink:0;text-align:center;min-width:52px;">
                    <div style="font-size:20px;font-weight:900;color:var(--text);line-height:1;letter-spacing:-0.5px;">${a.startTime?.substring(0,5) ?? "—"}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:3px;font-weight:500;">${a.endTime?.substring(0,5) ?? ""}</div>
                  </div>
                  <!-- Barra colorida de status -->
                  <div style="width:3px;height:48px;border-radius:2px;background:${sc.text};flex-shrink:0;"></div>
                  <!-- Avatar com inicial -->
                  <div style="width:42px;height:42px;border-radius:12px;background:${sc.bg};border:1px solid ${sc.border};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:${sc.text};flex-shrink:0;">${initials}</div>
                  <!-- Info principal -->
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.clientName ?? "—")}</div>
                    <div style="font-size:12px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(serviceNames)}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:2px;opacity:0.7;">${esc(a.barberName ?? "—")}</div>
                  </div>
                  <!-- Badge de status -->
                  <div style="flex-shrink:0;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${sc.bg};border:1px solid ${sc.border};color:${sc.text};white-space:nowrap;">${sl}</div>
                  <!-- Seta -->
                  <div style="flex-shrink:0;color:var(--muted);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>`;
              }).join("")}
            </div>`
        }
        </div>
        <!-- Vista Linha do Tempo -->
        <div id="viewTimeline" style="display:none">
          ${(() => {
            if (appointments.length === 0) return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--muted);font-size:14px">Nenhum agendamento para ${fmtDate(dateStr)}.</div>`;
            // Gerar slots de 30min das 07:00 às 22:00
            const slots: string[] = [];
            for (let h = 7; h < 22; h++) {
              slots.push(`${String(h).padStart(2,"0")}:00`);
              slots.push(`${String(h).padStart(2,"0")}:30`);
            }
            const apptBySlot: Record<string, any[]> = {};
            appointments.forEach((a: any) => {
              const t = a.startTime?.substring(0,5);
              if (t) {
                if (!apptBySlot[t]) apptBySlot[t] = [];
                apptBySlot[t].push(a);
              }
            });
            const statusColors: Record<string, string> = {
              scheduled:"#C9A84C", confirmed:"#4CAF50", in_progress:"#2196F3",
              completed:"#888880", cancelled:"#F44336", no_show:"#FF9800", pending_approval:"#FF6B35"
            };
            return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden">
              ${slots.map(slot => {
                const appts = apptBySlot[slot] ?? [];
                const isHour = slot.endsWith(":00");
                return `<div style="display:flex;align-items:stretch;border-bottom:1px solid ${isHour ? 'var(--border)' : 'rgba(255,255,255,0.04)'}">
                  <div style="width:52px;flex-shrink:0;padding:${isHour ? '10px' : '4px'} 12px;font-size:${isHour ? '12' : '10'}px;font-weight:${isHour ? '700' : '400'};color:${isHour ? 'var(--muted)' : 'rgba(136,136,128,0.4)'};text-align:right;border-right:1px solid var(--border)">${slot}</div>
                  <div style="flex:1;padding:4px 12px;min-height:${isHour ? '40' : '24'}px;display:flex;flex-direction:column;gap:4px">
                    ${appts.map((a: any) => {
                      const sc = statusColors[a.status] ?? "#888880";
                      const serviceNames = a.serviceNames ?? a.serviceName ?? "—";
                      return `<div onclick="openEditModal(${JSON.stringify({id:a.id,clientName:a.clientName??'',clientPhone:a.clientPhone??'',serviceId:a.serviceId,serviceName:serviceNames,barberId:a.barberId,barberName:a.barberName??'',date:a.date,startTime:a.startTime??'',endTime:a.endTime??'',status:a.status,notes:a.notes??''})})" style="background:${sc}18;border-left:3px solid ${sc};border-radius:0 8px 8px 0;padding:6px 10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px" onmouseover="this.style.background='${sc}30'" onmouseout="this.style.background='${sc}18'">
                        <div>
                          <div style="font-size:12px;font-weight:700;color:var(--text)">${esc(a.clientName ?? "—")}</div>
                          <div style="font-size:11px;color:var(--muted)">${esc(serviceNames)} · ${a.startTime?.substring(0,5)} – ${a.endTime?.substring(0,5)}</div>
                        </div>
                        <div style="font-size:11px;font-weight:600;color:${sc}">${esc(a.barberName ?? "")}</div>
                      </div>`;
                    }).join("")}
                  </div>
                </div>`;
              }).join("")}
            </div>`;
          })()}
        </div>
        <!-- Modal Editar/Reagendar Agendamento -->
        <div id="editApptModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;position:relative">
            <button type="button" onclick="closeEditModal()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;line-height:1">×</button>
            <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px">Editar Agendamento</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:20px">Altere os dados e salve para reagendar</div>
            <form id="editApptForm" onsubmit="submitEditAppt(event)">
              <input type="hidden" id="editApptId" name="id" />
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Cliente</label>
                <div id="editApptClient" style="padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:14px;color:var(--text)"></div>
              </div>
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Serviço</label>
                <select id="editApptService" name="serviceId" style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box">
                  ${services.map((s: any) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
                </select>
              </div>
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Profissional</label>
                <select id="editApptBarber" name="barberId" style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box">
                  ${barbers.map((b: any) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}
                </select>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Data</label>
                  <input type="date" id="editApptDate" name="date" style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Horário</label>
                  <input type="time" id="editApptTime" name="startTime" style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
                </div>
              </div>
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Status</label>
                <select id="editApptStatus" name="status" style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box">
                  <option value="scheduled">Agendado</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="no_show">Não compareceu</option>
                </select>
              </div>
              <div style="margin-bottom:20px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Observações</label>
                <input type="text" id="editApptNotes" name="notes" placeholder="Observações opcionais" style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
              </div>
              <div id="editApptError" style="display:none;padding:10px 14px;background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.3);border-radius:10px;color:#F44336;font-size:13px;margin-bottom:14px"></div>
              <div style="display:flex;gap:12px">
                <button type="button" onclick="closeEditModal()" style="flex:1;padding:12px;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>
                <button type="submit" id="editApptSubmitBtn" style="flex:1;padding:12px;background:var(--gold);border:none;border-radius:10px;color:#0A0A0A;font-size:14px;font-weight:700;cursor:pointer">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
        <!-- Modal Novo Agendamento (overlay) -->
        <div id="newApptModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;position:relative">
            <button type="button" onclick="document.getElementById('newApptModal').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;line-height:1">×</button>
            <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px">Novo Agendamento</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:20px">Crie um agendamento manualmente</div>
            <form method="POST" action="/admin/agenda/novo">
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Cliente *</label>
                <input type="hidden" name="clientId" id="newApptClientId" required />
                <div style="position:relative">
                  <input type="text" id="newApptClientSearch" placeholder="Buscar cliente por nome ou telefone..." autocomplete="off"
                    style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box"
                    oninput="filterNewClients(this.value)"
                    onfocus="document.getElementById('newApptClientDropdown').style.display='block'"
                    onblur="setTimeout(()=>{document.getElementById('newApptClientDropdown').style.display='none'},200)" />
                  <div id="newApptClientDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:10px;max-height:200px;overflow-y:auto;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,0.4);margin-top:4px">
                    ${clients.map((c: any) => `<div class="new-appt-client-opt" data-id="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone ?? '')}" onclick="selectNewApptClient(this)" style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center" onmouseover="this.style.background='rgba(201,168,76,0.08)'" onmouseout="this.style.background=''"><strong style="color:var(--text)">${esc(c.name)}</strong>${c.phone ? `<span style="color:var(--muted);font-size:12px">${esc(c.phone)}</span>` : ''}</div>`).join("")}
                  </div>
                </div>
              </div>
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Serviço *</label>
                <select name="serviceId" required style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box">
                  <option value="">Selecione o serviço</option>
                  ${services.map((s: any) => `<option value="${s.id}">${esc(s.name)} — ${fmtCurrency(s.price)} (${s.duration ?? 30}min)</option>`).join("")}
                </select>
              </div>
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Profissional *</label>
                <select name="barberId" required style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box">
                  <option value="">Selecione o profissional</option>
                  ${barbers.map((b: any) => `<option value="${b.id}"${b.id === session.barberId ? " selected" : ""}>${esc(b.name)}</option>`).join("")}
                </select>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Data *</label>
                  <input type="date" name="date" value="${dateStr}" required style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Horário *</label>
                  <input type="time" name="startTime" required style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
                </div>
              </div>
              <div style="margin-bottom:20px">
                <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Observações</label>
                <input type="text" name="notes" placeholder="Observações opcionais" style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
              </div>
              <div style="display:flex;gap:12px">
                <button type="button" onclick="document.getElementById('newApptModal').style.display='none'" style="flex:1;padding:12px;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>
                <button type="submit" style="flex:1;padding:12px;background:var(--gold);border:none;border-radius:10px;color:#0A0A0A;font-size:14px;font-weight:700;cursor:pointer">Criar Agendamento</button>
              </div>
            </form>
          </div>
        </div>
        <script>
          // Toggle de vista
          function setView(v) {
            document.getElementById('viewCards').style.display = v === 'cards' ? 'block' : 'none';
            document.getElementById('viewTimeline').style.display = v === 'timeline' ? 'block' : 'none';
            document.getElementById('btnViewCards').style.background = v === 'cards' ? 'var(--gold)' : 'transparent';
            document.getElementById('btnViewCards').style.color = v === 'cards' ? '#0A0A0A' : 'var(--muted)';
            document.getElementById('btnViewTimeline').style.background = v === 'timeline' ? 'var(--gold)' : 'var(--surface)';
            document.getElementById('btnViewTimeline').style.color = v === 'timeline' ? '#0A0A0A' : 'var(--muted)';
            document.getElementById('btnViewTimeline').style.border = v === 'timeline' ? 'none' : '1px solid var(--border)';
            localStorage.setItem('agendaView', v);
          }
          // Restaurar vista salva
          (function() {
            const saved = localStorage.getItem('agendaView');
            if (saved === 'timeline') setView('timeline');
          })();
          // Modal Editar Agendamento
          function openEditModal(data) {
            document.getElementById('editApptId').value = data.id;
            document.getElementById('editApptClient').textContent = data.clientName + (data.clientPhone ? ' — ' + data.clientPhone : '');
            document.getElementById('editApptDate').value = data.date;
            document.getElementById('editApptTime').value = data.startTime;
            document.getElementById('editApptNotes').value = data.notes || '';
            // Selecionar serviço
            const svcSel = document.getElementById('editApptService');
            for (let i = 0; i < svcSel.options.length; i++) {
              if (svcSel.options[i].value == data.serviceId) { svcSel.selectedIndex = i; break; }
            }
            // Selecionar barbeiro
            const barberSel = document.getElementById('editApptBarber');
            for (let i = 0; i < barberSel.options.length; i++) {
              if (barberSel.options[i].value == data.barberId) { barberSel.selectedIndex = i; break; }
            }
            // Selecionar status
            const statusSel = document.getElementById('editApptStatus');
            for (let i = 0; i < statusSel.options.length; i++) {
              if (statusSel.options[i].value === data.status) { statusSel.selectedIndex = i; break; }
            }
            document.getElementById('editApptError').style.display = 'none';
            document.getElementById('editApptModal').style.display = 'flex';
          }
          function closeEditModal() {
            document.getElementById('editApptModal').style.display = 'none';
          }
          async function submitEditAppt(e) {
            e.preventDefault();
            const btn = document.getElementById('editApptSubmitBtn');
            btn.disabled = true; btn.textContent = 'Salvando...';
            const id = document.getElementById('editApptId').value;
            const serviceId = document.getElementById('editApptService').value;
            const barberId = document.getElementById('editApptBarber').value;
            const date = document.getElementById('editApptDate').value;
            const startTime = document.getElementById('editApptTime').value;
            const status = document.getElementById('editApptStatus').value;
            const notes = document.getElementById('editApptNotes').value;
            try {
              const r = await fetch('/admin-api/appointment-edit', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                credentials: 'include',
                body: JSON.stringify({id: parseInt(id), serviceId: parseInt(serviceId), barberId: parseInt(barberId), date, startTime, status, notes})
              });
              if (!r.ok) { const e2 = await r.json(); throw new Error(e2.error || 'Erro ao salvar'); }
              closeEditModal();
              location.reload();
            } catch(err) {
              const errEl = document.getElementById('editApptError');
              errEl.textContent = err.message;
              errEl.style.display = 'block';
              btn.disabled = false; btn.textContent = 'Salvar Alterações';
            }
          }
          // Busca de cliente no modal Novo Agendamento
          function filterNewClients(q) {
            q = q.toLowerCase();
            document.querySelectorAll('.new-appt-client-opt').forEach(el => {
              const n = el.dataset.name.toLowerCase(), p = (el.dataset.phone || '').toLowerCase();
              el.style.display = (n.includes(q) || p.includes(q)) ? '' : 'none';
            });
            document.getElementById('newApptClientDropdown').style.display = 'block';
          }
          function selectNewApptClient(el) {
            document.getElementById('newApptClientId').value = el.dataset.id;
            document.getElementById('newApptClientSearch').value = el.dataset.name + (el.dataset.phone ? ' — ' + el.dataset.phone : '');
            document.getElementById('newApptClientDropdown').style.display = 'none';
          }
        </script>
    ${planModalHtml}
    ${planSaved ? `<div id="planSavedToast" style="position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#22C55E;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,0.25);display:flex;align-items:center;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Assinatura criada com sucesso!</div><script>setTimeout(function(){var t=document.getElementById('planSavedToast');if(t)t.style.display='none';},4000);</script>` : ''}
  `;
  const tenantObj = barber?.tenantId ? await db.getTenantById(barber.tenantId) : null;
  const _tp = (tenantObj as any)?.plan ?? "";
  const tenantSlug = (tenantObj as any)?.slug ?? "";
  res.send(adminLayout(`Agenda — ${fmtDate(dateStr)}`, "agenda", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Agenda",href:"/admin/agenda"}]));
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
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Cliente salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Cliente excluído com sucesso!</div>` : ""}

    ${birthdayToday.length > 0 ? `
    <div style="background:linear-gradient(135deg,#C9A84C22,#C9A84C11);border:1px solid #C9A84C44;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
      <span style="font-size:24px"></span>
      <div>
        <div style="font-weight:700;color:#C9A84C;font-size:14px">Aniversariantes de hoje!</div>
        <div style="font-size:13px;color:var(--text);margin-top:2px">${birthdayToday.map((c: any) => esc(c.name)).join(", ")}</div>
      </div>
    </div>` : ""}

    <!-- Barra de ações -->
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;align-items:center">
      <form method="GET" style="display:flex;flex:1;min-width:120px;gap:8px">
        <input type="text" name="q" value="${esc(search)}" placeholder="Buscar por nome ou telefone..."
          style="flex:1;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px" />
        <button type="submit" class="btn btn-primary" style="padding:8px 16px;font-size:13px">Buscar</button>
        ${search ? `<a href="/admin/clientes" class="btn btn-ghost" style="padding:8px 12px;font-size:13px"></a>` : ""}
      </form>
      <select onchange="location.href='/admin/clientes?status='+this.value+'${search ? '&q=' + encodeURIComponent(search) : ''}'"
        style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px">
        <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>Todos os status</option>
        <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>Ativos</option>
        <option value="inactive" ${filterStatus === 'inactive' ? 'selected' : ''}>Inativos</option>
      </select>
      <a href="/admin/clientes?aniversariantes=1" class="btn ${filterBirthday ? 'btn-primary' : 'btn-ghost'}" style="padding:8px 14px;font-size:13px">
         Aniversariantes (${birthdayMonth.length})
      </a>
      <a href="/admin/export/clientes.csv" class="btn btn-ghost" style="padding:8px 12px;font-size:13px">↓ CSV</a>
      <button onclick="document.getElementById('newClientModal').style.display='flex'" class="btn btn-primary" style="padding:8px 18px;font-size:13px;white-space:nowrap">+ Novo Cliente</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">${filterBirthday ? `Aniversariantes de ${new Date().toLocaleString('pt-BR', {month:'long'})}` : 'Clientes'} (${filtered.length})</div>
      </div>
      <div class="card-body"><div class="table-wrap">
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
                      ${isToday ? '<span style="font-size:14px;margin-left:6px"></span>' : ''}
                    </td>
                    <td>${esc(c.phone ?? '—')}</td>
                    <td style="color:var(--muted);font-size:12px">${esc(c.email ?? '—')}</td>
                    <td>${filterBirthday ? `<strong style="color:#C9A84C">${bdFormatted}</strong>` : `<span class="badge badge-gold">${c.loyaltyPoints ?? c.totalPoints ?? 0} pts</span>`}</td>
                    <td>${c.isActive !== false ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-muted">Inativo</span>'}</td>
                    <td style="white-space:nowrap">
                       <a href="/admin/clientes/${c.id}" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;margin-right:4px">Ver</a>
                      ${c.phone ? `<a href="https://wa.me/${(c.phone).replace(/\D/g,'')}" target="_blank" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;margin-right:4px;color:#25D366">WhatsApp</a>` : ''}
                      <button onclick="openEditClient(${c.id},'${esc(c.name).replace(/'/g,"\\'")}','${esc(c.phone ?? '')}','${esc(c.email ?? '')}','${c.birthDate ?? ''}','${esc(c.notes ?? '')}'" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;margin-right:4px">Editar</button>
                      <form method="POST" action="/admin/clientes/${c.id}/excluir" style="display:inline" onsubmit="return confirm('Excluir ${esc(c.name).replace(/'/g,"\\'")}'? Esta ação não pode ser desfeita.')">
                        <button type="submit" class="btn" style="font-size:11px;padding:4px 10px;background:#EF444422;color:#F87171;border:none">Excluir</button>
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
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">Novo Cliente</h2>
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
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">Editar Cliente</h2>
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
  res.send(adminLayout("Clientes", "clientes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Clientes",href:"/admin/clientes"}]));
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
        <div class="card-title">${editService ? "Editar Serviço" : "Novo Serviço"}</div>
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
            <label class="form-label">Foto / Vídeo <span style="color:var(--muted);font-weight:400">(opcional)</span></label>
            <input type="file" id="svc-media-file" accept="image/*,video/*" style="display:none" onchange="svcPreviewMedia(this)" />
            <div style="display:flex;align-items:center;gap:12px">
              <button type="button" onclick="document.getElementById('svc-media-file').click()" class="btn" style="padding:10px 18px;background:var(--surface2);color:var(--text)">Selecionar arquivo</button>
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
              <td style="font-weight:700;color:var(--gold)">R$ ${parseFloat(s.price).toFixed(2).replace(".", ",")}</td>
              <td>${s.durationMinutes} min</td>
              <td>${s.isActive ? `<span class="badge badge-success">Ativo</span>` : `<span class="badge badge-muted">Inativo</span>`}</td>
              <td>
                <div style="display:flex;gap:8px">
                  <a href="/admin/servicos?edit=${s.id}" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">Editar</a>
                  <form method="POST" action="/admin/servicos/toggle" style="display:inline" onsubmit="return confirm('Alterar status?')">
                    <input type="hidden" name="id" value="${s.id}" />
                    <input type="hidden" name="isActive" value="${!s.isActive}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">${s.isActive ? "Desativar" : "Ativar"}</button>
                  </form>
                  <form method="POST" action="/admin/servicos/delete" style="display:inline" onsubmit="return confirm('Excluir este serviço? Esta ação não pode ser desfeita.')">
                    <input type="hidden" name="id" value="${s.id}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:#EF444422;color:#F87171">Excluir</button>
                  </form>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Serviço salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Serviço excluído com sucesso!</div>` : ""}
    ${formHtml}
    <div class="card">
      <div class="card-header" style="gap:12px">
        <div class="card-title">Serviços Cadastrados (${services.length})</div>
        <input type="text" id="svc-search" placeholder="Buscar por nome..." oninput="(function(){const q=document.getElementById('svc-search').value.toLowerCase();document.querySelectorAll('#svc-table tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?'':'none';});})()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;min-width:200px" />
      </div>
      <div class="card-body"><div class="table-wrap"><div id="svc-table">${tableHtml}</div></div>
    </div>
  `;
  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Serviços", "servicos", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Serviços",href:"/admin/servicos"}]));
}

async function renderProdutos(req: Request, res: Response) {
  try {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
  const products = await db.getAllProductsWithMedia(false, tenantId);
  const suppliers = tenantId ? await db.getSuppliersByTenant(tenantId) : [];
  const saved = req.query.saved === "1";
  const deleted = req.query.deleted === "1";
  const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
  const editProduct = editId ? products.find((p: any) => p.id === editId) : null;

  const formHtml = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">${editProduct ? "Editar Produto" : "Novo Produto"}</div>
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
            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label">Fornecedor *</label>
              ${suppliers.length === 0
                ? `<div style="padding:10px;background:var(--surface2);border-radius:8px;font-size:13px;color:var(--muted)">Nenhum fornecedor cadastrado. <a href="/admin/fornecedores" style="color:var(--gold)">Cadastre um fornecedor primeiro</a>.</div><input type="hidden" name="supplierId" value="" />`
                : `<select class="form-input" name="supplierId" required>
                    <option value="">Selecione o fornecedor...</option>
                    ${suppliers.map((s: any) => `<option value="${s.id}" ${(editProduct as any)?.supplierId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
                  </select>`
              }
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
            <label class="form-label">Foto / Vídeo <span style="color:var(--muted);font-weight:400">(opcional)</span></label>
            <input type="file" id="prd-media-file" accept="image/*,video/*" style="display:none" onchange="prdPreviewMedia(this)" />
            <div style="display:flex;align-items:center;gap:12px">
              <button type="button" onclick="document.getElementById('prd-media-file').click()" class="btn" style="padding:10px 18px;background:var(--surface2);color:var(--text)">Selecionar arquivo</button>
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
              <td style="font-weight:700;color:var(--gold)">R$ ${parseFloat(p.price).toFixed(2).replace(".", ",")}</td>
              <td>
                <span style="color:${p.stockQuantity <= p.minStockAlert ? "var(--error)" : "var(--success)"}">
                  ${p.stockQuantity} un.
                </span>
                ${p.stockQuantity <= p.minStockAlert ? `<br><small style="color:var(--error)">Estoque baixo</small>` : ""}
              </td>
              <td>${p.isActive ? `<span class="badge badge-success">Ativo</span>` : `<span class="badge badge-muted">Inativo</span>`}</td>
              <td>
                <div style="display:flex;gap:8px">
                  <a href="/admin/produtos?edit=${p.id}" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">Editar</a>
                  <form method="POST" action="/admin/produtos/toggle" style="display:inline" onsubmit="return confirm('Alterar status?')">
                    <input type="hidden" name="id" value="${p.id}" />
                    <input type="hidden" name="isActive" value="${!p.isActive}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">${p.isActive ? "Desativar" : "Ativar"}</button>
                  </form>
                  <form method="POST" action="/admin/produtos/delete" style="display:inline" onsubmit="return confirm('Excluir este produto?')">
                    <input type="hidden" name="id" value="${p.id}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:#EF444422;color:#F87171">Excluir</button>
                  </form>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Produto salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Produto excluído com sucesso!</div>` : ""}
    ${formHtml}
    <div class="card">
      <div class="card-header" style="gap:12px">
        <div class="card-title">Produtos Cadastrados (${products.length})</div>
        <input type="text" id="prod-search" placeholder="Buscar por nome..." oninput="(function(){const q=document.getElementById('prod-search').value.toLowerCase();document.querySelectorAll('#prod-table tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?'':'none';});})()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;min-width:200px" />
      </div>
      <div class="card-body"><div class="table-wrap"><div id="prod-table">${tableHtml}</div></div>
    </div>
  `;
  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Produtos", "produtos", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Produtos",href:"/admin/produtos"}]));
  } catch (err: any) {
    console.error('[renderProdutos] Erro:', err?.message);
    res.send(adminLayout("Produtos", "produtos", `<div style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="color:var(--text);margin-bottom:8px">Erro ao carregar página</h2><p style="color:var(--muted);margin-bottom:20px">Ocorreu um problema de conexão com o banco de dados. Aguarde alguns segundos e tente novamente.</p><a href="/admin/produtos" class="btn btn-primary">Tentar novamente</a></div>`));
  }
}

// ─── Financeiro ───────────────────────────────────────────────────────────────
async function renderFinanceiro(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const tenantId = barber?.tenantId ?? null;
   const activeTab = (req.query.tab as string) || "resumo";
  const pmtStatus = (req.query.pmtStatus as string) || "all"; // filtro de status para aba pagamentos
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

  const pmLabels: Record<string, string> = { cash: "Dinheiro", credit_card: "Cartão Crédito", debit_card: "Cartão Débito", pix: "Pix", mercado_pago: "Online (legado)", asaas: "Online (Asaas)", other: "Outro" };

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
      <div class="card-header"><div class="card-title">Receita por Dia</div></div>
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
        <div class="card-header"><div class="card-title">Por Barbeiro</div></div>
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
        <div class="card-header"><div class="card-title">Formas de Pagamento</div></div>
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
      <div class="card-header"><div class="card-title">Vendas (${salesData.length})</div></div>
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
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">Nova Venda</h2>
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
      <div class="card-header"><div class="card-title">Despesas (${expenses.length})</div></div>
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
                        <button type="submit" class="btn" style="font-size:11px;padding:4px 10px;background:#EF444422;color:#F87171;border:none"></button>
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
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">Nova Despesa</h2>
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

  // ─── Aba Pagamentos Online ─────────────────────────────────────────────────
  let tabPagamentos = '';
  if (activeTab === "pagamentos") {
    const dbConn = await db.getDb();
    let pmtRows: any[] = [];
    if (dbConn && tenantId) {
      const pmtStatusFilter = pmtStatus !== "all" ? pmtStatus : null;
      const pmtQueryObj = pmtStatusFilter
        ? sql`SELECT op.id, op."billingType", op.amount, op.status, op."createdAt", op."paidAt", op."invoiceUrl",
               op."chargeType", op."referenceId", op."asaasPaymentId",
               c.name AS clientName
        FROM online_payments op
        LEFT JOIN clients c ON c.id = op."clientId"
        WHERE op."tenantId" = ${tenantId}
          AND op."createdAt" >= ${start} AND op."createdAt" <= CONCAT(${end}, ' 23:59:59')
          AND op.status = ${pmtStatusFilter}
        ORDER BY op."createdAt" DESC
        LIMIT 200`
        : sql`SELECT op.id, op."billingType", op.amount, op.status, op."createdAt", op."paidAt", op."invoiceUrl",
               op."chargeType", op."referenceId", op."asaasPaymentId",
               c.name AS clientName
        FROM online_payments op
        LEFT JOIN clients c ON c.id = op."clientId"
        WHERE op."tenantId" = ${tenantId}
          AND op."createdAt" >= ${start} AND op."createdAt" <= CONCAT(${end}, ' 23:59:59')
        ORDER BY op."createdAt" DESC
        LIMIT 200`;
      const raw = await dbConn.execute(pmtQueryObj) as any;
      pmtRows = Array.isArray(raw) ? (raw[0] as any[]) : (raw?.rows ?? []);
    }
    const totalPaid = pmtRows.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
    const totalPending = pmtRows.filter((p: any) => p.status === 'pending').reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
    const billingLabel = (bt: string) => bt === 'PIX' ? 'Pix' : bt === 'CREDIT_CARD' ? 'Cartão' : bt === 'BOLETO' ? 'Boleto' : bt;
    const statusBadge = (s: string) => {
      if (s === 'paid') return '<span style="background:#22C55E22;color:#4ADE80;border:1px solid #22C55E44;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700"> Pago</span>';
      if (s === 'pending') return '<span style="background:#F59E0B22;color:#FBBF24;border:1px solid #F59E0B44;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">⏳ Pendente</span>';
      if (s === 'overdue') return '<span style="background:#EF444422;color:#F87171;border:1px solid #EF444444;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700"> Vencido</span>';
      if (s === 'refunded') return '<span style="background:#6366F122;color:#818CF8;border:1px solid #6366F144;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">↩ Estornado</span>';
      if (s === 'cancelled') return '<span style="background:#6B728022;color:#9BA1A6;border:1px solid #6B728044;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">Cancelado</span>';
      return s;
    };
    const fmtDate = (d: any) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const fmtBRL = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');
    const tenantForSlug = tenantId ? await db.getTenantById(tenantId) : null;
    const tenantSlug = (tenantForSlug as any)?.slug ?? '';
    // Build payments table HTML separately to avoid nested template literals (esbuild compat)
    let pmtTableHtml = '';
    if (pmtRows.length === 0) {
      pmtTableHtml = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:14px">Nenhum pagamento online no período.</div>';
    } else {
      const pmtRowsHtml = pmtRows.map((p: any, i: number) => {
        const payLink = tenantSlug && p.referenceId ? '/pub/' + tenantSlug + '/pagar/' + p.referenceId : (p.invoiceUrl || '');
        const cancelBtn = (p.status === 'pending' && p.asaasPaymentId)
          ? '<button onclick="cancelAsaasCharge(\'' + p.asaasPaymentId + '\',this)" style="background:#EF444422;color:#F87171;border:1px solid #EF444444;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap">Cancelar</button>'
          : '';
        const resendBtn = (p.status === 'pending' && payLink)
          ? '<a href="https://wa.me/?text=' + encodeURIComponent('Olá! Segue o link para pagamento do seu agendamento: ' + payLink) + '" target="_blank" rel="noopener" style="display:inline-block;background:#25D36622;color:#25D366;border:1px solid #25D36644;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap;margin-right:4px">WhatsApp</a>'
          : '';
        const rowBg = i % 2 === 0 ? 'transparent' : 'var(--surface2)';
        return '<tr id="pmt-row-' + p.asaasPaymentId + '" style="border-bottom:1px solid var(--border);background:' + rowBg + '">'
          + '<td style="padding:12px 16px;color:var(--text);font-weight:600">' + (p.clientName || '—') + '</td>'
          + '<td style="padding:12px 16px;color:var(--text)">' + billingLabel(p.billingType) + '</td>'
          + '<td style="padding:12px 16px;text-align:right;font-weight:700;color:var(--text)">' + fmtBRL(parseFloat(p.amount)) + '</td>'
          + '<td style="padding:12px 16px;text-align:center" id="pmt-status-' + p.asaasPaymentId + '">' + statusBadge(p.status) + '</td>'
          + '<td style="padding:12px 16px;color:var(--muted);font-size:12px">' + fmtDate(p.createdAt) + '</td>'
          + '<td style="padding:12px 16px;color:var(--muted);font-size:12px">' + fmtDate(p.paidAt) + '</td>'
          + '<td style="padding:12px 16px;text-align:center;white-space:nowrap">' + resendBtn + cancelBtn + '</td>'
          + '</tr>';
      }).join('');
      pmtTableHtml = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden">'
        + '<div style="overflow-x:auto">'
        + '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table style="width:100%;border-collapse:collapse;font-size:13px">'
        + '<thead><tr style="border-bottom:1px solid var(--border);background:var(--surface2)">'
        + '<th style="padding:12px 16px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.6px">Cliente</th>'
        + '<th style="padding:12px 16px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.6px">Método</th>'
        + '<th style="padding:12px 16px;text-align:right;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.6px">Valor</th>'
        + '<th style="padding:12px 16px;text-align:center;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.6px">Status</th>'
        + '<th style="padding:12px 16px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.6px">Data</th>'
        + '<th style="padding:12px 16px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.6px">Pago em</th>'
        + '<th style="padding:12px 16px;text-align:center;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.6px">Ações</th>'
        + '</tr></thead>'
        + '<tbody>' + pmtRowsHtml + '</tbody>'
        + '</table></div></div>'
        + '<script>'
        + 'async function cancelAsaasCharge(asaasPaymentId, btn) {'
        + '  if (!confirm("Cancelar esta cobrança no Asaas? Esta ação não pode ser desfeita.")) return;'
        + '  btn.disabled = true; btn.textContent = "⏳ Cancelando...";'
        + '  try {'
        + '    const r = await fetch("/admin-api/cancel-asaas-charge", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ asaasPaymentId }) });'
        + '    const data = await r.json();'
        + '    if (!r.ok) throw new Error(data.error || "Erro ao cancelar");'
        + '    const statusCell = document.getElementById("pmt-status-" + asaasPaymentId);'
        + '    if (statusCell) statusCell.innerHTML = "<span style=\"background:#6B728022;color:#9BA1A6;border:1px solid #6B728044;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700\">Cancelado</span>";'
        + '    btn.style.display = "none";'
        + '  } catch(e) { alert("Erro: " + e.message); btn.disabled = false; btn.textContent = "Cancelar"; }'
        + '}'
        + '</script>';
    }
    tabPagamentos = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;min-width:240px">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">
            <div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:6px">Total Recebido</div>
            <div style="font-size:22px;font-weight:900;color:#4ADE80">${fmtBRL(totalPaid)}</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">
            <div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:6px">⏳ Pendente</div>
            <div style="font-size:22px;font-weight:900;color:#FBBF24">${fmtBRL(totalPending)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;align-self:flex-end">
          <select onchange="location.href='/admin/financeiro?tab=pagamentos&period=${period}&pmtStatus='+this.value"
            style="padding:7px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">
            ${[{v:'all',l:'Todos os status'},{v:'paid',l:'\u2705 Pago'},{v:'pending',l:'\u23f3 Pendente'},{v:'overdue',l:'\u26a0\ufe0f Vencido'},{v:'cancelled',l:'\u2716 Cancelado'},{v:'refunded',l:'\u21a9 Estornado'}].map(o => '<option value="' + o.v + '"' + (pmtStatus === o.v ? ' selected' : '') + '>' + o.l + '</option>').join('')}
          </select>
          <a href="/admin/export/pagamentos-online.csv?start=${start}&end=${end}${pmtStatus !== 'all' ? '&status=' + pmtStatus : ''}" class="btn btn-ghost" style="font-size:12px;padding:6px 14px;white-space:nowrap">↓ Exportar CSV</a>
        </div>
      </div>
      ${pmtTableHtml}
    `;
  }
    const tabs = [
    { id: "resumo", label: "Resumo" },
    { id: "receitas", label: "Receitas" },
    { id: "despesas", label: "Despesas" },
    { id: "pagamentos", label: "Pagamentos Online" },
  ];
  const tabNav = `
    <div style="display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:0">
      ${tabs.map(t => `
        <a href="/admin/financeiro?tab=${t.id}&period=${period}" style="padding:10px 20px;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px 8px 0 0;border:1px solid ${activeTab === t.id ? 'var(--border)' : 'transparent'};border-bottom:${activeTab === t.id ? '1px solid var(--surface)' : '1px solid var(--border)'};background:${activeTab === t.id ? 'var(--surface)' : 'transparent'};color:${activeTab === t.id ? '#C9A84C' : 'var(--muted)'};margin-bottom:-1px">${t.label}</a>
      `).join("")}
    </div>
  `;

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Lançamento salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Lançamento excluído!</div>` : ""}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <h2 style="font-size:20px;font-weight:700;margin:0">Financeiro</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <select onchange="location.href='/admin/financeiro?tab=${activeTab}&period='+this.value"
          style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">${periodOptions}</select>
        <a href="/admin/export/financeiro.csv?period=${period}" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">↓ CSV</a>
      </div>
    </div>
    ${tabNav}
    ${activeTab === "resumo" ? tabResumo : activeTab === "receitas" ? tabReceitas : activeTab === "pagamentos" ? tabPagamentos : tabDespesas}
  `;

  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Financeiro", "financeiro", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Financeiro",href:"/admin/financeiro"}]));
}

// ─── Configurações ────────────────────────────────────────────
async function renderConfiguracoes(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const settings = await db.getShopSettings(barber?.tenantId);
  const saved = req.query.saved === "1";
  const slugSaved = req.query.slugsaved === "1";
  const slugError = req.query.slugerror as string | undefined;
  const configError = req.query.error as string | undefined;
  const activeTab = (req.query.tab as string) ?? "dados";

  // Buscar tenant para obter o slug
  const tenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;
  const currentSlug = tenant?.slug ?? "";
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "";
  const publicUrl = currentSlug ? `https://usebarberpro.com/${currentSlug}` : "";
  const bookingUrl = currentSlug ? `https://usebarberpro.com/${currentSlug}/agendar` : "";
  const shopNameForShare = settings?.shopName ?? "Minha Barbearia";

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
      <div class="form-group" style="margin-top:4px">
        <label class="form-label">Meta Diária de Faturamento (R$)</label>
        <input class="form-input" type="number" name="dailyGoal" min="0" step="1" value="${settings?.dailyGoal ?? 0}" placeholder="Ex: 500" />
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Exibe uma barra de progresso no Dashboard. Deixe 0 para desativar.</div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">Salvar Dados</button>
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
      <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">Salvar Visual</button>
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
              <div class="card-title"> ${esc(b.name)}</div>
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
                <button type="submit" class="btn btn-primary" style="margin-top:16px;padding:10px 24px">Salvar Horários de ${esc(b.name)}</button>
              </form>
            </div>
          </div>`;
      }).join('');

  // Aba: Equipe
  const tabEquipe = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Profissionais Cadastrados</div>
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
      <div class="card-header"><div class="card-title">Novo Profissional</div></div>
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
    ${slugSaved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> URL atualizada com sucesso!</div>` : ""}
    ${slugError ? `<div style="background:#EF444422;border:1px solid #EF444444;color:var(--error);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> ${esc(slugError)}</div>` : ""}

    <!-- Card principal: link de agendamento -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">Link de Agendamento Online</div></div>
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
                  <button onclick="copyUrl('url-vitrine')" class="btn btn-ghost" style="flex-shrink:0;padding:8px 12px;font-size:12px">Copiar</button>
                  <a href="${esc(publicUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 12px;font-size:12px">Abrir</a>
                </div>
              </div>
              <div style="margin-bottom:12px">
                <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:6px">LINK DIRETO PARA AGENDAMENTO</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <input id="url-booking" class="form-input" type="text" value="${esc(bookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
                  <button onclick="copyUrl('url-booking')" class="btn btn-ghost" style="flex-shrink:0;padding:8px 12px;font-size:12px">Copiar</button>
                  <a href="${esc(bookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 12px;font-size:12px">Abrir</a>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <a href="https://wa.me/?text=${encodeURIComponent('Olá! Agende seu horário na ' + shopNameForShare + ' pelo link abaixo:\n\n' + bookingUrl + '\n\nEscolha o dia, horário e serviço diretamente pelo site. É rápido e fácil!')}" target="_blank" class="btn btn-primary" style="font-size:12px;padding:8px 16px">Compartilhar no WhatsApp</a>
                ${qrDataUrl ? `<a href="${qrDataUrl}" download="qrcode-agendamento.png" class="btn btn-ghost" style="font-size:12px;padding:8px 16px">⬇️ Baixar QR Code</a>` : ""}
              </div>
            </div>
          </div>
        ` : `<div style="color:var(--muted);font-size:13px">Não foi possível gerar o link. Verifique as configurações do servidor.</div>`}
      </div>
    </div>

    <!-- Card: personalizar slug -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">Personalizar URL</div></div>
      <div class="card-body">
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px">O identificador da URL (“slug”) é a parte final do link que identifica sua barbearia. Use apenas letras minúsculas, números e hífens.</div>
        <form method="POST" action="/admin/configuracoes/slug">
          <div style="display:flex;align-items:center;gap:0;margin-bottom:16px">
            <div style="padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-right:none;border-radius:8px 0 0 8px;font-size:12px;color:var(--muted);white-space:nowrap;font-family:monospace">usebarberpro.com/</div>
            <input class="form-input" type="text" name="slug" value="${esc(currentSlug)}" required pattern="[a-z0-9\\-]+" title="Apenas letras minúsculas, números e hífens" style="border-radius:0 8px 8px 0;font-family:monospace;font-size:14px" placeholder="nome-da-barbearia" />
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:16px">Atenção: Ao alterar o slug, o link antigo deixará de funcionar. Atualize todos os locais onde o link foi compartilhado.</div>
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
        if (btn) { const orig = btn.textContent; btn.textContent = 'Copiado!'; setTimeout(() => btn.textContent = orig, 2000); }
      });
    }
    </script>
  `;

  // ─── Aba: Pagamentos Online (Subconta Asaas) ─────────────────────────────────
  const asaasStatus = tenant?.asaasAccountStatus ?? 'not_configured';
  const asaasConfigured = !!tenant?.asaasAccountId;
  const statusLabel: Record<string, string> = {
    not_configured: '⚪ Não configurado',
    pending: '🟡 Aguardando aprovação do Asaas',
    active: '🟢 Ativo — Pagamentos online habilitados',
    rejected: '🔴 Reprovado — Verifique os dados e tente novamente',
  };
  const statusColor: Record<string, string> = {
    not_configured: 'var(--muted)',
    pending: '#FBBF24',
    active: 'var(--success)',
    rejected: 'var(--error)',
  };

  // Histórico de pagamentos da assinatura Barber Pro (busca no Asaas)
  let bpPaymentHistory: any[] = [];
  const bpSubIdForHistory = (tenant as any)?.barberproSubscriptionId ?? null;
  if (bpSubIdForHistory) {
    try {
      const { asaasEnabled, asaasApi } = await import('../asaas');
      if (asaasEnabled) {
        const histResp = await asaasApi.get(`/payments?subscription=${bpSubIdForHistory}&limit=12`);
        bpPaymentHistory = histResp.data?.data ?? [];
      }
    } catch (_) { /* silencioso */ }
  }

  // Dados da assinatura Barber Pro
  const bpStatus = (tenant as any)?.barberproSubscriptionStatus ?? 'trial';
  const isExpiredParam = (req as any).query?.expired === '1';
  const bpPlanName = (tenant as any)?.barberproPlanName ?? 'starter';
  const bpPlanPrice = parseFloat((tenant as any)?.barberproPlanPrice ?? 0);
  const bpNextDue = (tenant as any)?.barberproNextDueDate ?? null;
  const bpSubId = (tenant as any)?.barberproSubscriptionId ?? null;
  const bpStatusLabel: Record<string, string> = {
    trial: '🟡 Período de avaliação',
    active: '🟢 Assinatura ativa',
    overdue: '🔴 Pagamento em atraso',
    cancelled: '⚪ Assinatura cancelada',
    pending: '🟡 Aguardando pagamento',
    expired: '🔴 Trial expirado',
  };
  const bpStatusColor: Record<string, string> = {
    trial: '#FBBF24', active: 'var(--success)', overdue: 'var(--error)', cancelled: 'var(--muted)', pending: '#FBBF24', expired: 'var(--error)',
  };
  // Mapeamento dos planos reais do sistema (solo/team/studio) para exibição
  const bpPlanLabel: Record<string, string> = {
    solo: 'Solo', team: 'Equipe', studio: 'Estúdio',
    starter: 'Starter', professional: 'Professional', premium: 'Premium', // legado
  };
  const bpPlanPriceMap: Record<string, number> = { solo: 49, team: 89, studio: 149 };
  // Plano real do tenant (campo plan da tabela tenants)
  const tenantRealPlan = (tenant as any)?.plan ?? 'solo';
  // Se o tenant ainda não tem plano Barber Pro registrado, usar o plano real do tenant
  const effectivePlanName = (bpPlanName === 'starter' || !bpPlanName) ? tenantRealPlan : bpPlanName;
  const effectivePlanPrice = bpPlanPrice > 0 ? bpPlanPrice : (bpPlanPriceMap[tenantRealPlan] ?? 49);
  const bpNextDueFmt = bpNextDue ? new Date(bpNextDue + 'T12:00:00').toLocaleDateString('pt-BR') : null;

  const tabPagamentos = `
    <div style="max-width:640px">

      <!-- Assinatura Barber Pro -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:var(--muted);margin-bottom:12px">ASSINATURA BARBER PRO</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
          <div>
            <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px">${bpPlanLabel[effectivePlanName] ?? effectivePlanName}</div>
            <div style="font-size:13px;font-weight:600;color:${bpStatusColor[bpStatus] ?? 'var(--muted)'}">${bpStatusLabel[bpStatus] ?? bpStatus}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px">R$ ${effectivePlanPrice.toFixed(2)}/mês</div>
            ${bpNextDueFmt ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">Próximo vencimento: ${bpNextDueFmt}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
            ${bpStatus === 'trial' || bpStatus === 'cancelled' ? `
              <div id="subscribe-widget" style="display:flex;flex-direction:column;gap:10px;align-items:flex-end;width:100%">
                <!-- Seletor de plano -->
                <select id="sub-plan" style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;width:100%">
                  <option value="solo" ${tenantRealPlan === 'solo' ? 'selected' : ''}>Solo — R$ 49/mês (1 barbeiro)</option>
                  <option value="team" ${tenantRealPlan === 'team' ? 'selected' : ''}>Equipe — R$ 89/mês (até 5 barbeiros)</option>
                  <option value="studio" ${tenantRealPlan === 'studio' ? 'selected' : ''}>Estúdio — R$ 149/mês (ilimitado)</option>
                </select>
                <!-- Seletor de forma de pagamento -->
                <div style="display:flex;gap:6px;width:100%">
                  <button type="button" class="pay-method-btn active" data-method="PIX" onclick="selectPayMethod('PIX')" style="flex:1;padding:8px 6px;border-radius:8px;border:1.5px solid var(--primary);background:var(--primary);color:var(--bg);font-size:12px;font-weight:600;cursor:pointer">Pix</button>
                  <button type="button" class="pay-method-btn" data-method="CREDIT_CARD" onclick="selectPayMethod('CREDIT_CARD')" style="flex:1;padding:8px 6px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;font-weight:600;cursor:pointer">Crédito</button>
                  <button type="button" class="pay-method-btn" data-method="UNDEFINED" onclick="selectPayMethod('UNDEFINED')" style="flex:1;padding:8px 6px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;font-weight:600;cursor:pointer">Débito</button>
                </div>
                <!-- Formulário de cartão (oculto por padrão) -->
                <div id="card-form-area" style="display:none;width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-top:2px">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:var(--muted);margin-bottom:10px">DADOS DO CARTÃO</div>
                  <!-- Número do cartão com bandeira -->
                  <div style="position:relative;margin-bottom:10px">
                    <input id="card-number" type="text" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19"
                      style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 42px 8px 10px;font-size:13px;font-family:monospace" />
                    <span id="card-brand-icon" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:16px"></span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                    <input id="card-expiry" type="text" inputmode="numeric" placeholder="MM/AAAA" maxlength="7"
                      style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px" />
                    <input id="card-cvv" type="text" inputmode="numeric" placeholder="CVV" maxlength="4"
                      style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px" />
                  </div>
                  <input id="card-holder" type="text" placeholder="Nome no cartão (como impresso)" maxlength="50"
                    style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px;margin-bottom:10px" />
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:var(--muted);margin-bottom:8px">DADOS DO TITULAR</div>
                  <input id="card-cpf" type="text" inputmode="numeric" placeholder="CPF do titular" maxlength="14"
                    style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px;margin-bottom:8px" />
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    <input id="card-cep" type="text" inputmode="numeric" placeholder="CEP" maxlength="9"
                      style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px" />
                    <input id="card-addr-num" type="text" placeholder="Número" maxlength="10"
                      style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px" />
                  </div>
                  <div style="font-size:10px;color:var(--muted);margin-top:8px">🔒 Dados transmitidos com criptografia SSL diretamente ao Asaas.</div>
                </div>
                <!-- Botão de assinatura -->
                <button id="sub-btn" type="button" onclick="submitSubscription()" class="btn btn-primary" style="font-size:13px;padding:10px 20px;width:100%;white-space:nowrap">Assinar agora via Pix</button>
              </div>
            ` : ''}
            ${bpStatus === 'active' ? `
              <form method="POST" action="/admin/configuracoes/asaas/upgrade-plan" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
                <select name="newPlan" style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer">
                  <option value="solo" ${effectivePlanName === 'solo' ? 'selected' : ''}>Solo — R$ 49/mês (1 barbeiro)</option>
                  <option value="team" ${effectivePlanName === 'team' ? 'selected' : ''}>Equipe — R$ 89/mês (até 5 barbeiros)</option>
                  <option value="studio" ${effectivePlanName === 'studio' ? 'selected' : ''}>Estúdio — R$ 149/mês (ilimitado)</option>
                </select>
                <button type="submit" class="btn btn-ghost" style="font-size:12px;padding:8px 16px" onclick="return confirm('Alterar o plano cancelará a assinatura atual e criará uma nova. Confirmar?')">Alterar plano</button>
              </form>
            ` : ''}
            ${bpStatus === 'active' && bpSubId ? `
              <form method="POST" action="/admin/configuracoes/asaas/cancel-subscription" onsubmit="return confirm('Tem certeza que deseja cancelar a assinatura?')">
                <button type="submit" class="btn btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--error);border-color:var(--error)">Cancelar assinatura</button>
              </form>
            ` : ''}
            ${bpStatus === 'overdue' ? `
              <div style="font-size:12px;color:var(--error);text-align:right">⚠️ Regularize o pagamento<br>para manter o acesso</div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Histórico de Pagamentos da Assinatura -->
      ${bpPaymentHistory.length > 0 ? `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:var(--muted);margin-bottom:14px">HISTÓRICO DE PAGAMENTOS</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:600">Data</th>
              <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:600">Valor</th>
              <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:600">Forma</th>
              <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:600">Status</th>
            </tr>
          </thead>
          <tbody>
            ${bpPaymentHistory.map((p: any) => {
              const pmtDate = p.dueDate ? new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
              const pmtValue = p.value ? 'R$ ' + Number(p.value).toFixed(2).replace('.', ',') : '-';
              const pmtBilling = p.billingType === 'PIX' ? 'Pix' : p.billingType === 'CREDIT_CARD' ? 'Cartão' : p.billingType === 'BOLETO' ? 'Boleto' : (p.billingType ?? '-');
              const pmtStatusMap: Record<string, string> = { RECEIVED: '✅ Pago', CONFIRMED: '✅ Pago', PENDING: '⏳ Pendente', OVERDUE: '⚠️ Vencido', REFUNDED: '↩ Estornado', CANCELLED: '✖ Cancelado' };
              const pmtStatusColor: Record<string, string> = { RECEIVED: '#4ADE80', CONFIRMED: '#4ADE80', PENDING: '#FBBF24', OVERDUE: '#F87171', REFUNDED: '#9BA1A6', CANCELLED: '#9BA1A6' };
              const pmtStatusLabel = pmtStatusMap[p.status] ?? p.status;
              const pmtStatusClr = pmtStatusColor[p.status] ?? 'var(--muted)';
              return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 8px;color:var(--text)">${pmtDate}</td>
                <td style="padding:10px 8px;color:var(--text);font-weight:600">${pmtValue}</td>
                <td style="padding:10px 8px;color:var(--muted)">${pmtBilling}</td>
                <td style="padding:10px 8px;font-weight:600;color:${pmtStatusClr}">${pmtStatusLabel}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Status conta de pagamentos -->
      <!-- Status atual -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:var(--muted);margin-bottom:8px">STATUS DA CONTA DE PAGAMENTOS</div>
        <div style="font-size:15px;font-weight:600;color:${statusColor[asaasStatus] ?? 'var(--muted)'}">${statusLabel[asaasStatus] ?? asaasStatus}</div>
        ${asaasConfigured ? `
          <div style="margin-top:12px;font-size:12px;color:var(--muted)">
            ID da subconta: <code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:11px">${esc(tenant?.asaasAccountId ?? '')}</code>
          </div>
          ${asaasStatus === 'pending' ? `
            <form method="POST" action="/admin/configuracoes/asaas/sync" style="margin-top:12px">
              <button type="submit" class="btn btn-ghost" style="font-size:12px;padding:8px 16px">↻ Verificar status de aprovação</button>
            </form>
          ` : ''}
        ` : ''}
      </div>

      ${asaasStatus === 'active' ? `
        <div style="background:#4ADE8011;border:1px solid #4ADE8033;border-radius:12px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:var(--text)">
          ✅ Sua conta de pagamentos está ativa. Os clientes já podem pagar online via Pix ou cartão de crédito diretamente na página de agendamento.
        </div>
      ` : ''}

      ${asaasStatus !== 'active' ? `
        <!-- Formulário de configuração -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px">
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Configurar Pagamentos Online</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:20px;line-height:1.5">
            Preencha os dados abaixo para criar sua conta de recebimentos. O dinheiro dos seus clientes será depositado diretamente na sua conta bancária.
            Você precisará de CPF ou CNPJ e um número de celular válido.
          </div>

          <form method="POST" action="/admin/configuracoes/asaas/setup" id="asaas-setup-form">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">Nome completo / Razão social *</label>
                <input class="form-input" type="text" name="name" value="${esc(settings?.shopName ?? '')}" required placeholder="Ex: João Silva ou Barbearia Silva Ltda" />
              </div>
              <div class="form-group">
                <label class="form-label">E-mail *</label>
                <input class="form-input" type="email" name="email" required placeholder="contato@barbearia.com" />
              </div>
              <div class="form-group">
                <label class="form-label">Celular *</label>
                <input class="form-input" type="text" name="mobilePhone" required placeholder="(11) 99999-9999"
                  value="${esc(tenant?.asaasMobilePhone ?? settings?.phone ?? '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">CPF ou CNPJ *</label>
                <input class="form-input" type="text" name="cpfCnpj" required placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  value="${esc(tenant?.asaasCpfCnpj ?? tenant?.cnpj ?? '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Tipo de empresa</label>
                <select class="form-input" name="companyType" id="companyTypeSelect">
                  <option value="">Pessoa Física (CPF)</option>
                  <option value="MEI" ${tenant?.asaasCompanyType === 'MEI' ? 'selected' : ''}>MEI</option>
                  <option value="LIMITED" ${tenant?.asaasCompanyType === 'LIMITED' ? 'selected' : ''}>Ltda / S.A.</option>
                  <option value="INDIVIDUAL" ${tenant?.asaasCompanyType === 'INDIVIDUAL' ? 'selected' : ''}>Empresário Individual</option>
                  <option value="ASSOCIATION" ${tenant?.asaasCompanyType === 'ASSOCIATION' ? 'selected' : ''}>Associação / ONG</option>
                </select>
              </div>
              <div class="form-group" id="birthDateGroup">
                <label class="form-label">Data de nascimento <span style="color:var(--muted);font-size:11px">(obrigatório para PF)</span></label>
                <input class="form-input" type="date" name="birthDate" value="${esc(tenant?.asaasBirthDate ?? '')}" />
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">Renda / Faturamento mensal (R$) *</label>
                <input class="form-input" type="number" name="incomeValue" required min="1" step="0.01"
                  placeholder="Ex: 5000.00"
                  value="${esc(tenant?.asaasIncomeValue ? String(tenant.asaasIncomeValue) : '')}" />
                <div style="font-size:11px;color:var(--muted);margin-top:4px">Informe sua renda mensal ou faturamento estimado da barbearia. Exigido pelo Asaas para compliance financeiro.</div>
              </div>
            </div>

            <div style="border-top:1px solid var(--border);margin:20px 0"></div>
            <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:var(--muted);margin-bottom:12px">ENDEREÇO (OPCIONAL)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">Endereço</label>
                <input class="form-input" type="text" name="address" value="${esc(settings?.address ?? '')}" placeholder="Rua, Avenida..." />
              </div>
              <div class="form-group">
                <label class="form-label">Número</label>
                <input class="form-input" type="text" name="addressNumber" value="${esc(settings?.addressNumber ?? '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Bairro</label>
                <input class="form-input" type="text" name="province" placeholder="Bairro" />
              </div>
              <div class="form-group">
                <label class="form-label">CEP</label>
                <input class="form-input" type="text" name="postalCode" value="${esc(settings?.cep ?? '')}" placeholder="00000-000" />
              </div>
            </div>

            <div style="background:#0A7EA411;border:1px solid #0A7EA433;border-radius:10px;padding:12px 16px;margin:16px 0;font-size:12px;color:var(--muted);line-height:1.6">
              🔒 Seus dados são enviados diretamente ao Asaas (empresa regulamentada pelo Banco Central) e armazenados com segurança.
              O Barber Pro não armazena dados bancários — apenas o ID da sua conta de recebimentos.
            </div>

            <button type="submit" class="btn btn-primary" style="padding:12px 28px;width:100%" id="asaas-submit-btn">
              Criar conta de recebimentos
            </button>
          </form>

          <script>
          const companyTypeSelect = document.getElementById('companyTypeSelect');
          const birthDateGroup = document.getElementById('birthDateGroup');
          function toggleBirthDate() {
            birthDateGroup.style.display = companyTypeSelect.value ? 'none' : 'block';
          }
          companyTypeSelect.addEventListener('change', toggleBirthDate);
          toggleBirthDate();

          // Máscara CPF/CNPJ
          const cpfCnpjInput = document.querySelector('input[name="cpfCnpj"]');
          if (cpfCnpjInput) {
            cpfCnpjInput.addEventListener('input', function() {
              let v = this.value.replace(/\D/g, '').substring(0, 14);
              if (v.length <= 11) {
                v = v.replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
              } else {
                v = v.replace(/(\d{2})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{4})(\d{1,2})$/, '$1/$2')
                     .replace(/(\d{2})$/, '-$1');
              }
              this.value = v;
            });
          }

          // Máscara celular
          const phoneInput = document.querySelector('input[name="mobilePhone"]');
          if (phoneInput) {
            phoneInput.addEventListener('input', function() {
              let v = this.value.replace(/\D/g, '').substring(0, 11);
              if (v.length >= 11) v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
              else if (v.length >= 7) v = v.replace(/(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3');
              else if (v.length >= 3) v = v.replace(/(\d{2})(\d+)/, '($1) $2');
              this.value = v;
            });
          }

          document.getElementById('asaas-setup-form').addEventListener('submit', function() {
            const btn = document.getElementById('asaas-submit-btn');
            btn.textContent = 'Criando conta...';
            btn.disabled = true;
          });
          </script>
        </div>
      ` : ''}
    </div>

    <script>
    // ── Seletor de forma de pagamento ──────────────────────────────────────────
    var _selectedMethod = localStorage.getItem('barberpro_preferredBillingType') || 'PIX';

    // Restaurar forma de pagamento preferida ao carregar
    document.addEventListener('DOMContentLoaded', function() {
      if (_selectedMethod !== 'PIX') { selectPayMethod(_selectedMethod); }
    });

    function selectPayMethod(method) {
      _selectedMethod = method;
      try { localStorage.setItem('barberpro_preferredBillingType', method); } catch(e) {}
      // Atualizar visual dos botões
      document.querySelectorAll('.pay-method-btn').forEach(function(btn) {
        var isActive = btn.getAttribute('data-method') === method;
        btn.style.border = isActive ? '1.5px solid var(--primary)' : '1.5px solid var(--border)';
        btn.style.background = isActive ? 'var(--primary)' : 'var(--bg)';
        btn.style.color = isActive ? 'var(--bg)' : 'var(--text)';
      });
      // Mostrar/ocultar formulário de cartão
      var cardArea = document.getElementById('card-form-area');
      if (cardArea) {
        cardArea.style.display = (method === 'CREDIT_CARD' || method === 'UNDEFINED') ? 'block' : 'none';
      }
      // Atualizar texto do botão
      var btn = document.getElementById('sub-btn');
      if (btn) {
        var labels = { PIX: 'Assinar agora via Pix', CREDIT_CARD: 'Assinar com Cartão de Crédito', UNDEFINED: 'Assinar com Cartão de Débito' };
        btn.textContent = labels[method] || 'Assinar agora';
      }
    }

    // ── Detecção de bandeira por número do cartão ──────────────────────────────
    function detectCardBrand(num) {
      var n = num.replace(/\D/g, '');
      if (/^4011|^4312|^4389|^4514|^4573|^4576|^5041|^5066|^5090|^6277|^6362|^6363|^6504|^6505|^6516|^6550/.test(n)) return { icon: '\uD83D\uDFE1', name: 'Elo' };
      if (/^606282|^3841/.test(n)) return { icon: '\uD83D\uDFE0', name: 'Hipercard' };
      if (/^3[47]/.test(n)) return { icon: '\u2B50', name: 'Amex' };
      if (/^30[0-5]|^36|^38/.test(n)) return { icon: '\uD83D\uDCB3', name: 'Diners' };
      if (/^5[1-5]|^2[2-7]/.test(n)) return { icon: '\uD83D\uDD34', name: 'Mastercard' };
      if (/^4/.test(n)) return { icon: '\uD83D\uDFE6', name: 'Visa' };
      return null;
    }

    var cardNumberInput = document.getElementById('card-number');
    if (cardNumberInput) {
      cardNumberInput.addEventListener('input', function() {
        // Formatar com espaços a cada 4 dígitos
        var v = this.value.replace(/\D/g, '').substring(0, 16);
        this.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
        // Detectar bandeira
        var brand = detectCardBrand(v);
        var icon = document.getElementById('card-brand-icon');
        if (icon) icon.textContent = brand ? brand.icon : '';
      });
    }

    // Máscara de validade MM/AAAA
    var cardExpiryInput = document.getElementById('card-expiry');
    if (cardExpiryInput) {
      cardExpiryInput.addEventListener('input', function() {
        var v = this.value.replace(/\D/g, '').substring(0, 6);
        if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
        this.value = v;
      });
    }

    // Máscara CPF
    var cardCpfInput = document.getElementById('card-cpf');
    if (cardCpfInput) {
      cardCpfInput.addEventListener('input', function() {
        var v = this.value.replace(/\D/g, '').substring(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        this.value = v;
      });
    }

    // Máscara CEP
    var cardCepInput = document.getElementById('card-cep');
    if (cardCepInput) {
      cardCepInput.addEventListener('input', function() {
        var v = this.value.replace(/\D/g, '').substring(0, 8);
        if (v.length > 5) v = v.substring(0, 5) + '-' + v.substring(5);
        this.value = v;
      });
    }

    // ── Submissão via fetch (para capturar IP do cliente) ──────────────────────
    function submitSubscription() {
      var plan = document.getElementById('sub-plan') ? document.getElementById('sub-plan').value : 'solo';
      var method = _selectedMethod;
      var btn = document.getElementById('sub-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

      var payload = { selectedPlan: plan, billingType: method };

      if (method === 'CREDIT_CARD' || method === 'UNDEFINED') {
        var numRaw = (document.getElementById('card-number').value || '').replace(/\D/g, '');
        var expiry = (document.getElementById('card-expiry').value || '').split('/');
        var cvv = (document.getElementById('card-cvv').value || '').trim();
        var holder = (document.getElementById('card-holder').value || '').trim();
        var cpf = (document.getElementById('card-cpf').value || '').replace(/\D/g, '');
        var cep = (document.getElementById('card-cep').value || '').replace(/\D/g, '');
        var addrNum = (document.getElementById('card-addr-num').value || '').trim();

        if (!numRaw || numRaw.length < 13) { alert('Número do cartão inválido.'); if (btn) { btn.disabled = false; btn.textContent = method === 'CREDIT_CARD' ? 'Assinar com Cartão de Crédito' : 'Assinar com Cartão de Débito'; } return; }
        if (!expiry[0] || !expiry[1] || expiry[1].length < 4) { alert('Data de validade inválida. Use MM/AAAA.'); if (btn) { btn.disabled = false; } return; }
        if (!cvv) { alert('CVV obrigatório.'); if (btn) { btn.disabled = false; } return; }
        if (!holder) { alert('Nome no cartão obrigatório.'); if (btn) { btn.disabled = false; } return; }
        if (!cpf || cpf.length < 11) { alert('CPF do titular obrigatório.'); if (btn) { btn.disabled = false; } return; }
        if (!cep || cep.length < 8) { alert('CEP obrigatório.'); if (btn) { btn.disabled = false; } return; }
        if (!addrNum) { alert('Número do endereço obrigatório.'); if (btn) { btn.disabled = false; } return; }

        payload.cardNumber = numRaw;
        payload.cardExpiryMonth = expiry[0];
        payload.cardExpiryYear = expiry[1];
        payload.cardCvv = cvv;
        payload.cardHolder = holder;
        payload.cardCpf = cpf;
        payload.cardCep = cep;
        payload.cardAddrNum = addrNum;
      }

      fetch('/admin/configuracoes/asaas/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(r) {
        // Se o servidor redirecionar, seguir o redirect
        if (r.redirected) { window.location.href = r.url; return; }
        return r.json().then(function(data) {
          if (data.redirect) { window.location.href = data.redirect; }
          else if (data.error) { alert('Erro: ' + data.error); if (btn) { btn.disabled = false; btn.textContent = 'Assinar agora'; } }
          else { window.location.href = '/admin/configuracoes?tab=pagamentos&saved=1'; }
        });
      }).catch(function(err) {
        alert('Erro de conexão. Tente novamente.');
        if (btn) { btn.disabled = false; btn.textContent = 'Assinar agora'; }
      });
    }
    </script>
  `;

  const tabs = [
    { id: 'dados', label: 'Dados' },
    { id: 'horarios', label: 'Horários' },
    { id: 'equipe', label: 'Equipe' },
    { id: 'pagamentos', label: '💳 Pagamentos' },
  ];

  const tabContent: Record<string, string> = {
    dados: tabDados,
    horarios: tabHorarios,
    equipe: tabEquipe,
    pagamentos: tabPagamentos,
  };

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Configurações salvas com sucesso!</div>` : ""}
    ${isExpiredParam ? `<div style="background:#EF444422;border:1.5px solid #EF444466;color:#F87171;padding:16px 20px;border-radius:12px;margin-bottom:20px;font-size:14px;line-height:1.6">
      <strong>🔴 Seu período de teste expirou.</strong><br>
      Para continuar usando o Barber Pro, assine um dos planos abaixo. O acesso será restaurado imediatamente após a confirmação do pagamento.
    </div>` : ""}
    ${configError ? `<div style="background:#F8717122;border:1px solid #F8717144;color:var(--error);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">⚠️ ${esc(configError)}</div>` : ""}

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
  res.send(adminLayout("Configurações", "configuracoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Configurações",href:"/admin/configuracoes"}]));
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
          <div style="position:relative">
            <input type="text" id="clientSearch" class="form-input" placeholder="Buscar cliente por nome ou telefone..." autocomplete="off"
              oninput="filterClients(this.value)" onfocus="showClientList()" onblur="setTimeout(hideClientList,200)"
              style="padding-right:36px" />
            <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none"></span>
            <input type="hidden" name="clientId" id="clientId" required />
            <div id="clientDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:10px;max-height:220px;overflow-y:auto;z-index:100;box-shadow:0 4px 16px #0004;margin-top:4px">
              ${clients.map((c: any) => `<div class="client-opt" data-id="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone ?? '')}" onclick="selectClient(this)" style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--gold-dim)'" onmouseout="this.style.background=''"><strong>${esc(c.name)}</strong>${c.phone ? `<span style='color:var(--muted);margin-left:8px'>${esc(c.phone)}</span>` : ''}</div>`).join("")}
            </div>
          </div>
          <script>
            function showClientList(){document.getElementById('clientDropdown').style.display='block';}
            function hideClientList(){document.getElementById('clientDropdown').style.display='none';}
            function filterClients(q){
              q=q.toLowerCase();
              document.querySelectorAll('.client-opt').forEach(el=>{
                const n=el.dataset.name.toLowerCase(),p=(el.dataset.phone||'').toLowerCase();
                el.style.display=(n.includes(q)||p.includes(q))?'':'none';
              });
              document.getElementById('clientDropdown').style.display='block';
            }
            function selectClient(el){
              document.getElementById('clientSearch').value=el.dataset.name+(el.dataset.phone?' — '+el.dataset.phone:'');
              document.getElementById('clientId').value=el.dataset.id;
              hideClientList();
            }
          </script>
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
  res.send(adminLayout("Novo Agendamento", "agenda", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Agenda",href:"/admin/agenda"},{label:"Novo Agendamento",href:"/admin/novo-agendamento"}]));
}

// ─── Relatórios ───────────────────────────────────────────────────────────────
async function renderRelatorios(req: Request, res: Response) {
  try {
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
  const pmLabels: Record<string, string> = { cash: "Dinheiro", credit_card: "Cartão Crédito", debit_card: "Cartão Débito", pix: "Pix", mercado_pago: "Online (legado)", asaas: "Online (Asaas)", other: "Outro" };
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
  // Encomendas no período
  const allOrders = await db.getProductOrdersByTenant(tenantId ?? 0);
  const ordersInPeriod = allOrders.filter((o: any) => {
    const d = new Date(o.createdAt);
    return d >= startDate && d <= endDate;
  });
  const ordersTotal = ordersInPeriod.length;
  const ordersDelivered = ordersInPeriod.filter((o: any) => o.status === 'delivered').length;
  const ordersPending = ordersInPeriod.filter((o: any) => ['received','confirmed','preparing','ready'].includes(o.status)).length;
  const ordersCancelled = ordersInPeriod.filter((o: any) => o.status === 'cancelled').length;
  // Produtos mais encomendados
  const productMap: Record<string, { name: string; count: number }> = {};
  ordersInPeriod.forEach((o: any) => {
    const key = String(o.productId);
    if (!productMap[key]) productMap[key] = { name: o.productName ?? 'Produto', count: 0 };
    productMap[key].count += (o.quantity ?? 1);
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 5);
  const topProductsRows = topProducts.map(p => `<tr><td>${esc(p.name)}</td><td style="text-align:right">${p.count} un.</td></tr>`).join('') || '<tr><td colspan="2" style="text-align:center;color:var(--muted)">Sem encomendas no período</td></tr>';
  const ordersReportHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px">
      <div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:#C9A84C">${ordersTotal}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Total</div>
      </div>
      <div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:#4ADE80">${ordersDelivered}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Entregues</div>
      </div>
      <div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:#F59E0B">${ordersPending}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Em aberto</div>
      </div>
      <div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--error)">${ordersCancelled}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Cancelados</div>
      </div>
    </div>
    <div style="margin-top:8px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--muted)">PRODUTOS MAIS ENCOMENDADOS</div>
      <table><thead><tr><th>Produto</th><th style="text-align:right">Qtd</th></tr></thead><tbody>${topProductsRows}</tbody></table>
    </div>`;
  // Buscar cobranças vencidas (Asaas)
  let overdueRows: any[] = [];
  try {
    const dbConn = await db.getDb();
    if (dbConn && tenantId) {
      const rawOverdue = await dbConn.execute(sql`
        SELECT op.id, op.amount, op."dueDate", op."invoiceUrl", op."asaasPaymentId",
               c.name AS clientName, c.phone AS clientPhone
        FROM online_payments op
        LEFT JOIN clients c ON c.id = op."clientId"
        WHERE op."tenantId" = ${tenantId}
          AND op.status = 'overdue'
        ORDER BY op."dueDate" ASC
        LIMIT 100
      `) as any;
      overdueRows = Array.isArray(rawOverdue) ? (rawOverdue[0] as any[]) : (rawOverdue?.rows ?? []);
    }
  } catch (overdueErr: any) {
    console.error("[relatorios] Erro ao buscar inadimpl\u00eancia:", overdueErr.message);
  }

  // ─── Pagamentos Online: totais por método e lista recente ───────────────────
  let onlineByMethod: { pix: number; card: number; pixCount: number; cardCount: number } = { pix: 0, card: 0, pixCount: 0, cardCount: 0 };
  let onlinePaymentsList: any[] = [];
  let onlineTotalPaid = 0;
  let onlineTotalPending = 0;
  let onlineTotalOverdue = 0;
  try {
    const dbConn2 = await db.getDb();
    if (dbConn2 && tenantId) {
      // Totais por método (período selecionado)
      const rawByMethod = await dbConn2.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN "paymentMethod" = 'pix' AND status = 'paid' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) AS pix_total,
          COALESCE(SUM(CASE WHEN "paymentMethod" = 'credit_card' AND status = 'paid' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) AS card_total,
          COUNT(CASE WHEN "paymentMethod" = 'pix' AND status = 'paid' THEN 1 END) AS pix_count,
          COUNT(CASE WHEN "paymentMethod" = 'credit_card' AND status = 'paid' THEN 1 END) AS card_count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) AS total_paid,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) AS total_pending,
          COALESCE(SUM(CASE WHEN status = 'overdue' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) AS total_overdue
        FROM online_payments
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= NOW() - ${sql.raw(`INTERVAL '${days} days'`)}
      `) as any;
      const methodRow = Array.isArray(rawByMethod) ? (rawByMethod[0] as any[])?.[0] : (rawByMethod?.rows?.[0] ?? null);
      if (methodRow) {
        onlineByMethod = {
          pix: parseFloat(methodRow.pix_total ?? '0'),
          card: parseFloat(methodRow.card_total ?? '0'),
          pixCount: parseInt(methodRow.pix_count ?? '0'),
          cardCount: parseInt(methodRow.card_count ?? '0'),
        };
        onlineTotalPaid = parseFloat(methodRow.total_paid ?? '0');
        onlineTotalPending = parseFloat(methodRow.total_pending ?? '0');
        onlineTotalOverdue = parseFloat(methodRow.total_overdue ?? '0');
      }
      // Lista de pagamentos recentes (últimos 50)
      const rawList = await dbConn2.execute(sql`
        SELECT op.id, op.amount, op."paymentMethod", op.status, op."createdAt", op."asaasPaymentId", op."invoiceUrl",
               c.name AS clientName
        FROM online_payments op
        LEFT JOIN clients c ON c.id = op."clientId"
        WHERE op."tenantId" = ${tenantId}
          AND op."createdAt" >= NOW() - ${sql.raw(`INTERVAL '${days} days'`)}
        ORDER BY op."createdAt" DESC
        LIMIT 50
      `) as any;
      onlinePaymentsList = Array.isArray(rawList) ? (rawList[0] as any[]) : (rawList?.rows ?? []);
    }
  } catch (onlineErr: any) {
    console.error('[relatorios] Erro ao buscar pagamentos online:', onlineErr?.message);
  }

  // Gráfico de barras Pix vs Cartão
  const onlineMaxVal = Math.max(onlineByMethod.pix, onlineByMethod.card, 1);
  const pixBarH = Math.round((onlineByMethod.pix / onlineMaxVal) * 120);
  const cardBarH = Math.round((onlineByMethod.card / onlineMaxVal) * 120);
  const onlineChartSvg = `<svg viewBox="0 0 300 180" style="width:100%;max-width:320px" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pixGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4ADE80" stop-opacity="1"/>
        <stop offset="100%" stop-color="#16A34A" stop-opacity="0.7"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#60A5FA" stop-opacity="1"/>
        <stop offset="100%" stop-color="#2563EB" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <!-- Grid lines -->
    <line x1="40" y1="20" x2="280" y2="20" stroke="#33333388" stroke-width="1" stroke-dasharray="4,3"/>
    <line x1="40" y1="70" x2="280" y2="70" stroke="#33333388" stroke-width="1" stroke-dasharray="4,3"/>
    <line x1="40" y1="120" x2="280" y2="120" stroke="#33333388" stroke-width="1" stroke-dasharray="4,3"/>
    <!-- Axes -->
    <line x1="40" y1="20" x2="40" y2="140" stroke="#555" stroke-width="1"/>
    <line x1="40" y1="140" x2="280" y2="140" stroke="#555" stroke-width="1"/>
    <!-- Pix bar -->
    <rect x="70" y="${140 - pixBarH}" width="60" height="${pixBarH}" fill="url(#pixGrad)" rx="6"/>
    <text x="100" y="${140 - pixBarH - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#4ADE80">R$ ${onlineByMethod.pix.toFixed(2).replace('.', ',')}</text>
    <!-- Card bar -->
    <rect x="170" y="${140 - cardBarH}" width="60" height="${cardBarH}" fill="url(#cardGrad)" rx="6"/>
    <text x="200" y="${140 - cardBarH - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#60A5FA">R$ ${onlineByMethod.card.toFixed(2).replace('.', ',')}</text>
    <!-- Labels -->
    <text x="100" y="158" text-anchor="middle" font-size="12" font-weight="600" fill="#4ADE80">Pix</text>
    <text x="200" y="158" text-anchor="middle" font-size="12" font-weight="600" fill="#60A5FA">Cartão</text>
    <!-- Y axis labels -->
    <text x="36" y="24" text-anchor="end" font-size="9" fill="#888">R$ ${fmt(onlineMaxVal)}</text>
    <text x="36" y="74" text-anchor="end" font-size="9" fill="#888">R$ ${fmt(onlineMaxVal / 2)}</text>
    <text x="36" y="124" text-anchor="end" font-size="9" fill="#888">R$ 0</text>
  </svg>`;

  // Tabela de pagamentos online
  const pmMethodLabels: Record<string, string> = { pix: 'Pix', credit_card: 'Cartão de Crédito', debit_card: 'Cartão de Débito' };
  const pmStatusLabels: Record<string, { label: string; color: string; bg: string }> = {
    paid: { label: 'Pago', color: '#4ADE80', bg: '#4ADE8022' },
    pending: { label: 'Pendente', color: '#F59E0B', bg: '#F59E0B22' },
    overdue: { label: 'Vencido', color: '#F87171', bg: '#F8717122' },
    cancelled: { label: 'Cancelado', color: '#9CA3AF', bg: '#9CA3AF22' },
    refunded: { label: 'Estornado', color: '#A78BFA', bg: '#A78BFA22' },
  };
  const onlineTableRows = onlinePaymentsList.map((p: any) => {
    const dt = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '—';
    const val = parseFloat(p.amount ?? '0').toFixed(2).replace('.', ',');
    const method = pmMethodLabels[p.paymentMethod] ?? (p.paymentMethod ?? '—');
    const stInfo = pmStatusLabels[p.status] ?? { label: p.status ?? '—', color: '#9CA3AF', bg: '#9CA3AF22' };
    const verifyBtn = p.asaasPaymentId && (p.status === 'pending' || p.status === 'overdue')
      ? `<button onclick="verifyPayment('${p.asaasPaymentId}', this)" style="padding:3px 10px;font-size:11px;border-radius:6px;border:1px solid #C9A84C44;background:transparent;color:#C9A84C;cursor:pointer;transition:all .2s" onmouseover="this.style.background='#C9A84C22'" onmouseout="this.style.background='transparent'">Verificar</button>`
      : '';
    return `<tr>
      <td style="font-size:12px;color:var(--muted)">${dt}</td>
      <td style="font-weight:600">${esc(p.clientName ?? '—')}</td>
      <td style="text-align:right;font-weight:700">R$ ${val}</td>
      <td style="font-size:12px">${method}</td>
      <td><span style="background:${stInfo.bg};color:${stInfo.color};border:1px solid ${stInfo.color}44;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">${stInfo.label}</span></td>
      <td>${verifyBtn}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Nenhum pagamento online no período.</td></tr>';

  const onlinePaymentsHtml = `
    <!-- KPIs de pagamentos online -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px">
      <div style="background:var(--surface2,var(--surface));border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#4ADE80">R$ ${fmt(onlineTotalPaid)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Recebido</div>
      </div>
      <div style="background:var(--surface2,var(--surface));border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#F59E0B">R$ ${fmt(onlineTotalPending)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Pendente</div>
      </div>
      <div style="background:var(--surface2,var(--surface));border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#F87171">R$ ${fmt(onlineTotalOverdue)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Vencido</div>
      </div>
      <div style="background:var(--surface2,var(--surface));border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:var(--text)">${onlineByMethod.pixCount + onlineByMethod.cardCount}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Pagamentos</div>
      </div>
    </div>
    <!-- Gráfico Pix vs Cartão -->
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;margin-bottom:20px;flex-wrap:wrap">
      <div>${onlineChartSvg}</div>
      <div>
        <div style="margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:12px;height:12px;border-radius:3px;background:#4ADE80;flex-shrink:0"></div>
            <span style="font-size:13px;font-weight:600">Pix</span>
            <span style="margin-left:auto;font-size:13px;font-weight:700;color:#4ADE80">R$ ${fmt(onlineByMethod.pix)}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);padding-left:20px">${onlineByMethod.pixCount} transaç${onlineByMethod.pixCount !== 1 ? 'ões' : 'ão'}</div>
        </div>
        <div style="margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:12px;height:12px;border-radius:3px;background:#60A5FA;flex-shrink:0"></div>
            <span style="font-size:13px;font-weight:600">Cartão de Crédito</span>
            <span style="margin-left:auto;font-size:13px;font-weight:700;color:#60A5FA">R$ ${fmt(onlineByMethod.card)}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);padding-left:20px">${onlineByMethod.cardCount} transaç${onlineByMethod.cardCount !== 1 ? 'ões' : 'ão'}</div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;font-weight:700">Total Recebido</span>
            <span style="font-size:16px;font-weight:800;color:#C9A84C">R$ ${fmt(onlineByMethod.pix + onlineByMethod.card)}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- Tabela de pagamentos -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="font-size:13px;font-weight:700;color:var(--muted)">ÚLTIMOS ${Math.min(onlinePaymentsList.length, 50)} PAGAMENTOS</div>
      <div style="display:flex;gap:8px;align-items:center">
        <a href="/admin/export/pagamentos-online.csv?start=${startStr}&end=${endStr}" class="btn btn-ghost" style="font-size:12px;padding:6px 14px;white-space:nowrap;text-decoration:none">↓ Exportar CSV</a>
        <button id="btn-verify-all" onclick="verifyAllPending()" style="padding:6px 14px;font-size:12px;font-weight:600;border-radius:8px;border:1px solid #C9A84C44;background:transparent;color:#C9A84C;cursor:pointer;transition:all .2s" onmouseover="this.style.background='#C9A84C22'" onmouseout="this.style.background='transparent'">
          ↻ Verificar Pendentes
        </button>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table id="online-payments-table">
        <thead><tr><th>Data</th><th>Cliente</th><th style="text-align:right">Valor</th><th>Método</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${onlineTableRows}</tbody>
      </table>
    </div>
    <script>
      async function verifyPayment(asaasId, btn) {
        btn.disabled = true;
        btn.textContent = '...';
        try {
          const res = await fetch('/pub-api/asaas-payment-status?id=' + asaasId);
          const data = await res.json();
          if (data.status) {
            const statusMap = { RECEIVED: 'Pago', CONFIRMED: 'Pago', PENDING: 'Pendente', OVERDUE: 'Vencido', REFUNDED: 'Estornado', CANCELLED: 'Cancelado' };
            btn.closest('tr').querySelector('td:nth-child(5) span').textContent = statusMap[data.status] || data.status;
            btn.textContent = '✓';
            btn.style.color = '#4ADE80';
          } else {
            btn.textContent = 'Erro';
          }
        } catch(e) {
          btn.textContent = 'Erro';
          btn.disabled = false;
        }
      }
      async function verifyAllPending() {
        const btns = document.querySelectorAll('#online-payments-table button');
        for (const btn of btns) {
          if (btn.textContent.trim() === 'Verificar') {
            await verifyPayment(btn.getAttribute('onclick').match(/'([^']+)'/)[1], btn);
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }
    </script>`;


  const body = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <h2 style="font-size:20px;font-weight:700;margin:0">Relatórios</h2>
      <form method="GET" style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;color:var(--muted)">Período:</label>
        <select name="period" onchange="this.form.submit()" style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">${periodOptions}</select>
        <a href="/admin/export/financeiro.csv?period=${period}" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">↓ Exportar CSV</a>
        <a href="/admin/export/relatorio.pdf?period=${period}" class="btn btn-primary" style="font-size:12px;padding:6px 12px"> Exportar PDF</a>
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
      <div class="card-header"><div class="card-title">Faturamento por Dia</div></div>
      <div class="card-body" style="overflow-x:auto">${chartSvg}</div>
    </div>
    <!-- Gráfico de linha (apenas para períodos curtos) -->
    ${lineSvg ? `<div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">Tendência de Faturamento</div></div>
      <div class="card-body" style="overflow-x:auto">${lineSvg}</div>
    </div>` : ""}
    <!-- Grid ranking + barbeiros + pizza -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <div class="card">
        <div class="card-header"><div class="card-title">Serviços Mais Vendidos</div></div>
        <div class="card-body">${rankingRows}</div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Desempenho por Barbeiro</div></div>
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
      <div class="card-header"><div class="card-title">Formas de Pagamento</div></div>
      <div class="card-body">${pieSvg}</div>
    </div>
    <!-- Encomendas -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">Encomendas de Produtos</div></div>
      <div class="card-body">${ordersReportHtml}</div>
    </div>
    <!-- Pagamentos Online -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header" style="justify-content:space-between">
        <div class="card-title">💳 Pagamentos Online (Asaas)</div>
        <span style="font-size:12px;color:var(--muted)">${onlinePaymentsList.length} registro${onlinePaymentsList.length !== 1 ? 's' : ''} no período</span>
      </div>
      <div class="card-body">${onlinePaymentsHtml}</div>
    </div>
    <!-- Inadimplência -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header" style="justify-content:space-between">
        <div class="card-title"> Cobranças Vencidas (Asaas)</div>
        <span style="font-size:12px;color:var(--muted)">${overdueRows.length} cliente${overdueRows.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="card-body">
        ${overdueRows.length === 0
          ? '<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px"> Nenhuma cobrança vencida no momento.</div>'
          : (() => {
              const rows = overdueRows.map((o: any) => {
                const daysOverdue = o.dueDate ? Math.floor((Date.now() - new Date(o.dueDate).getTime()) / 86400000) : '\u2014';
                const phone = (o.clientPhone || '').replace(/\D/g, '');
                const fullPhone = phone.startsWith('55') ? phone : '55' + phone;
                const payLink = o.invoiceUrl || '';
                const waMsg = encodeURIComponent('Olá ' + (o.clientName || '') + '! Identificamos uma cobrança em aberto no valor de R$ ' + parseFloat(o.amount).toFixed(2).replace('.', ',') + '. Acesse o link para regularizar: ' + payLink);
                const waBtn = phone ? '<a href="https://wa.me/' + fullPhone + '?text=' + waMsg + '" target="_blank" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:#25D366;border-color:#25D36644">Cobrar</a>' : '';
                const dueDateFmt = o.dueDate ? new Date(o.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '\u2014';
                return '<tr><td style="font-weight:600">' + esc(o.clientName || '\u2014') + '</td><td style="color:var(--muted);font-size:12px">' + esc(o.clientPhone || '\u2014') + '</td><td style="text-align:right;font-weight:700;color:#F87171">R$ ' + parseFloat(o.amount).toFixed(2).replace('.', ',') + '</td><td style="color:var(--muted);font-size:12px">' + dueDateFmt + '</td><td style="text-align:center"><span style="background:#EF444422;color:#F87171;border:1px solid #EF444444;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">' + daysOverdue + ' dias</span></td><td>' + waBtn + '</td></tr>';
              }).join('');
              return '<table><thead><tr><th>Cliente</th><th>Telefone</th><th style="text-align:right">Valor</th><th>Vencimento</th><th>Dias em atraso</th><th>Ações</th></tr></thead><tbody>' + rows + '</tbody></table>';
            })()
        }
      </div>
    </div>
  `;
  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Relatórios", "relatorios", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Relatórios",href:"/admin/relatorios"}]));
  } catch (err: any) {
    console.error('[renderRelatorios] Erro:', err?.message);
    res.send(adminLayout("Relatórios", "relatorios", `<div style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="color:var(--text);margin-bottom:8px">Erro ao carregar página</h2><p style="color:var(--muted);margin-bottom:20px">Ocorreu um problema de conexão com o banco de dados. Aguarde alguns segundos e tente novamente.</p><a href="/admin/relatorios" class="btn btn-primary">Tentar novamente</a></div>`));
  }
}

// ──// ─── Página do Cliente ───────────────────────────────────────────
async function renderPaginaCliente(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const settings = await db.getShopSettings(barber?.tenantId);
  const saved = req.query.saved === "1";
  const trackingSaved = req.query.trackingsaved === "1";
  const seoSaved = req.query.seosaved === "1";

  // Buscar tenant para slug
  const tenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;
  const currentSlug = tenant?.slug ?? "";
  const publicUrl = currentSlug ? `https://usebarberpro.com/${currentSlug}` : "";
  const bookingUrl = currentSlug ? `https://usebarberpro.com/${currentSlug}/agendar` : "";
  const shopNameForShare = settings?.shopName ?? "Minha Barbearia";

  // Gerar QR Code
  let qrDataUrl = "";
  if (bookingUrl) {
    try {
      const QRCode = await import("qrcode");
      qrDataUrl = await QRCode.default.toDataURL(bookingUrl, { width: 280, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
    } catch { /* sem QR Code */ }
  }

  // ─── Verificar se a barbearia tem horários cadastrados ─────────────────────
  let hasWorkingHours = false;
  try {
    if (barber?.id) {
      const wh = await db.getWorkingHours(barber.id);
      hasWorkingHours = wh.some((h: any) => h.isWorking);
    }
  } catch { /* ignora */ }
  const blocoAvisoHorarios = !hasWorkingHours ? `
    <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.4);border-radius:12px;padding:14px 18px;margin-bottom:24px;display:flex;align-items:flex-start;gap:12px">
      <span style="font-size:20px;flex-shrink:0;margin-top:1px">⚠️</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#fbbf24;margin-bottom:4px">Horários de funcionamento não cadastrados</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Sem horários cadastrados, o badge <strong>Aberto/Fechado</strong> não aparece na sua página pública e os clientes não conseguem visualizar quando a barbearia está aberta. <a href="/admin/configuracoes?tab=horarios" style="color:#fbbf24;text-decoration:underline">Cadastrar horários agora →</a></div>
      </div>
    </div>
  ` : "";
  // ─── Bloco 1: Compartilhar sua Página ─────────────────────────────────────
  const blocoCompartilhar = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">🔗</span>
          <div class="card-title">Compartilhar sua Página</div>
        </div>
      </div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--muted);margin-bottom:20px">Compartilhe estes links com seus clientes para que eles possam agendar online diretamente pela página da sua barbearia.</p>
        ${bookingUrl ? `
          <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">PÁGINA PRINCIPAL DA BARBEARIA</div>
            <div style="display:flex;gap:8px">
              <input id="url-vitrine" class="form-input" type="text" value="${esc(publicUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
              <button onclick="copyUrl('url-vitrine', this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Copiar</button>
              <a href="${esc(publicUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Abrir</a>
            </div>
          </div>
          <div style="margin-bottom:20px">
            <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">LINK DIRETO PARA AGENDAMENTO</div>
            <div style="display:flex;gap:8px">
              <input id="url-booking" class="form-input" type="text" value="${esc(bookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
              <button onclick="copyUrl('url-booking', this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Copiar</button>
              <a href="${esc(bookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Abrir</a>
            </div>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:16px">
            <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:12px">COMPARTILHAR</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <a href="https://wa.me/?text=${encodeURIComponent('Agende seu horário online: ' + bookingUrl)}" target="_blank" class="btn btn-primary" style="font-size:13px;padding:10px 18px;display:flex;align-items:center;gap:6px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L.057 23.776a.5.5 0 0 0 .614.614l5.929-1.465A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.695-.5-5.24-1.374l-.375-.216-3.878.959.975-3.764-.237-.388A9.945 9.945 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                WhatsApp
              </a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}" target="_blank" class="btn btn-ghost" style="font-size:13px;padding:10px 18px;display:flex;align-items:center;gap:6px;background:#1877F2;color:#fff;border-color:#1877F2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </a>
              <button onclick="(function(){var msg='Olá! Agende seu horário na ${esc(shopNameForShare)} pelo link abaixo:\n\n${esc(bookingUrl)}\n\nEscolha o dia, horário e serviço diretamente pelo site. É rápido e fácil!';navigator.clipboard.writeText(msg).then(function(){var b=event.target.closest('button');var o=b.innerHTML;b.innerHTML='✔ Copiado!';setTimeout(function(){b.innerHTML=o;},2500);}).catch(function(){prompt('Copie a mensagem abaixo:',msg);});})()" class="btn btn-ghost" style="font-size:13px;padding:10px 18px;display:flex;align-items:center;gap:6px">
                📲 Mensagem pronta
              </button>
            </div>
          </div>
        ` : `<div style="color:var(--muted);font-size:13px">Nenhum link disponível. Aguarde a configuração do sistema.</div>`}
      </div>
    </div>
    <script>
    function copyUrl(id, btn) {
      var el = document.getElementById(id);
      if (!el) return;
      navigator.clipboard.writeText(el.value).then(function() {
        var orig = btn.textContent;
        btn.textContent = 'Copiado!';
        setTimeout(function() { btn.textContent = orig; }, 2000);
      });
    }
    </script>
  `;

  // ─── Bloco 2: QR Code da Barbearia ──────────────────────────────────────────
  const blocoQrCode = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">📱</span>
          <div class="card-title">QR Code da Barbearia</div>
        </div>
      </div>
      <div class="card-body">
        ${qrDataUrl ? `
          <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
            <div style="background:#fff;padding:16px;border-radius:16px;border:1px solid var(--border);display:inline-block">
              <img src="${qrDataUrl}" width="200" height="200" alt="QR Code" style="display:block" />
            </div>
            <p style="font-size:13px;color:var(--muted);text-align:center;max-width:320px">Imprima este QR Code e coloque na barbearia. Seus clientes escaneiam e já vão direto para o agendamento online.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
              <a href="${qrDataUrl}" download="qrcode-agendamento.png" class="btn btn-primary" style="font-size:13px;padding:10px 20px">⬇️ Baixar PNG</a>
              <button onclick="(function(){navigator.clipboard.writeText('${esc(bookingUrl)}').then(function(){var b=event.target.closest('button');var o=b.textContent;b.textContent='Copiado!';setTimeout(function(){b.textContent=o;},2000);});})()" class="btn btn-ghost" style="font-size:13px;padding:10px 20px">🔗 Copiar link</button>
            </div>
          </div>
        ` : `<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">QR Code não disponível. Configure o link da barbearia primeiro.</div>`}
      </div>
    </div>
  `;

  // ─── Bloco 3: Aparência ──────────────────────────────────────────────────────
  const currentColor = esc(settings?.primaryColor ?? "#C9A84C");
  const currentBgColor = esc((settings as any)?.backgroundColor ?? "#0A0A0A");
  const currentFont = esc(settings?.fontStyle ?? "moderno");
  const currentLogo = esc(settings?.logoUrl ?? "");
  const currentBanner = esc(settings?.bannerUrl ?? "");
  const shopNameDisplay = esc(settings?.shopName ?? "Minha Barbearia");
  // Suporte a ambos os formatos: JSON (APP) e texto com \n (WEB legado)
  function parseGalleryUrls(raw: string | null | undefined): string[] {
    if (!raw) return [];
    const s = raw.trim();
    if (s.startsWith('[')) {
      try { return (JSON.parse(s) as string[]).filter(Boolean); } catch {}
    }
    return s.split('\n').map(u => u.trim()).filter(Boolean);
  }
  const galleryList = parseGalleryUrls(settings?.galleryUrls);

  const blocoAparencia = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">🎨</span>
          <div class="card-title">Aparência</div>
        </div>
      </div>
      <div class="card-body">
        ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:24px;font-size:14px">✔ Configurações visuais salvas com sucesso!</div>` : ""}

        <!-- Layout: Formulário + Preview lado a lado -->
        <div style="display:grid;grid-template-columns:1fr 360px;gap:32px;align-items:start">

          <!-- ===== COLUNA ESQUERDA: FORMULÁRIO ===== -->
          <form id="visualForm" method="POST" action="/admin/pagina-cliente/visual" onsubmit="return handleVisualSubmit(event)">
            <input type="hidden" name="primaryColor" id="fPrimaryColor" value="${currentColor}" />
            <input type="hidden" name="backgroundColor" id="fBackgroundColor" value="${currentBgColor}" />
            <input type="hidden" name="fontStyle" id="fFontStyle" value="${currentFont}" />
            <input type="hidden" name="logoUrl" id="fLogoUrl" value="${currentLogo}" />
            <input type="hidden" name="bannerUrl" id="fBannerUrl" value="${currentBanner}" />
            <input type="hidden" name="galleryUrls" id="fGalleryUrls" value="" />
            <input type="hidden" name="logoBase64" id="fLogoBase64" value="" />
            <input type="hidden" name="logoMime" id="fLogoMime" value="" />
            <input type="hidden" name="bannerBase64" id="fBannerBase64" value="" />
            <input type="hidden" name="bannerMime" id="fBannerMime" value="" />
            <input type="hidden" name="galleryBase64List" id="fGalleryBase64List" value="" />
            <input type="hidden" name="galleryMimeList" id="fGalleryMimeList" value="" />

            <!-- SEÇÃO 1: Cores -->
            <div style="margin-bottom:28px">
              <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)">🎨 Cor Principal</div>

              <div style="margin-bottom:14px">
                <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Escolha uma cor pré-definida:</div>
                <div style="display:flex;flex-wrap:wrap;gap:10px" id="colorSwatches">
                  ${["#C9A84C","#E63946","#2196F3","#4CAF50","#9C27B0","#FF5722","#00BCD4","#FF9800","#607D8B","#000000","#FFFFFF"].map(c =>
                    `<button type="button" onclick="selectColor('${c}')" title="${c}" style="width:36px;height:36px;border-radius:50%;background:${c};border:3px solid ${c === (settings?.primaryColor ?? '#C9A84C') ? '#fff' : 'transparent'};box-shadow:${c === (settings?.primaryColor ?? '#C9A84C') ? '0 0 0 3px var(--gold)' : '0 0 0 1px var(--border)'};cursor:pointer;transition:all 0.15s" id="swatch-${c.replace('#','')}"></button>`
                  ).join('')}
                </div>
              </div>

              <div style="background:var(--surface2);border-radius:10px;padding:14px;border:1px solid var(--border)">
                <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Ou escolha uma cor personalizada:</div>
                <div style="display:flex;align-items:center;gap:12px">
                  <input type="color" id="pcColorPicker" value="${currentColor}" oninput="selectColor(this.value)" style="width:48px;height:48px;border:2px solid var(--border);border-radius:10px;background:none;cursor:pointer;padding:3px" />
                  <div style="flex:1">
                    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Código Hex</div>
                    <input class="form-input" type="text" id="pcColorHex" value="${currentColor}" oninput="if(/^#[0-9A-Fa-f]{6}$/.test(this.value)){selectColor(this.value)}" placeholder="#C9A84C" style="font-family:monospace;font-size:14px;letter-spacing:1px" />
                  </div>
                  <div id="colorPreviewBox" style="width:48px;height:48px;border-radius:10px;background:${currentColor};border:1px solid var(--border);flex-shrink:0"></div>
                </div>
              </div>
            </div>

            <!-- SEÇÃO 1b: Cor de Fundo -->
            <div style="margin-bottom:28px">
              <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)">🌑 Cor de Fundo da Página</div>

              <div style="margin-bottom:14px">
                <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Escolha uma cor pré-definida:</div>
                <div style="display:flex;flex-wrap:wrap;gap:10px" id="bgSwatches">
                  ${["#0A0A0A","#111827","#1a1a2e","#0f172a","#1c1c1c","#18181b","#1e1b4b","#0c0a09","#ffffff","#f8f9fa","#f1f5f9"].map(c =>
                    `<button type="button" onclick="selectBgColor('${c}')" title="${c}" style="width:36px;height:36px;border-radius:50%;background:${c};border:3px solid ${c === ((settings as any)?.backgroundColor ?? '#0A0A0A') ? '#fff' : 'transparent'};box-shadow:${c === ((settings as any)?.backgroundColor ?? '#0A0A0A') ? '0 0 0 3px var(--gold)' : '0 0 0 1px var(--border)'};cursor:pointer;transition:all 0.15s" id="bgswatch-${c.replace('#','')}"></button>`
                  ).join('')}
                </div>
              </div>

              <div style="background:var(--surface2);border-radius:10px;padding:14px;border:1px solid var(--border)">
                <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Ou escolha uma cor personalizada:</div>
                <div style="display:flex;align-items:center;gap:12px">
                  <input type="color" id="bgColorPicker" value="${currentBgColor}" oninput="selectBgColor(this.value)" style="width:48px;height:48px;border:2px solid var(--border);border-radius:10px;background:none;cursor:pointer;padding:3px" />
                  <div style="flex:1">
                    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Código Hex</div>
                    <input class="form-input" type="text" id="bgColorHex" value="${currentBgColor}" oninput="if(/^#[0-9A-Fa-f]{6}$/.test(this.value)){selectBgColor(this.value)}" placeholder="#0A0A0A" style="font-family:monospace;font-size:14px;letter-spacing:1px" />
                  </div>
                  <div id="bgColorPreviewBox" style="width:48px;height:48px;border-radius:10px;background:${currentBgColor};border:1px solid var(--border);flex-shrink:0"></div>
                </div>
              </div>
            </div>

            <!-- SEÇÃO 2: Estilo de Texto -->
            <div style="margin-bottom:28px">
              <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)">🔤 Estilo de Texto</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px" id="fontOptions">
                ${[
                  {id:"moderno", label:"Moderno", css:"'Inter', sans-serif", desc:"Limpo e moderno"},
                  {id:"classico", label:"Clássico", css:"'Georgia', serif", desc:"Tradicional"},
                  {id:"elegante", label:"Elegante", css:"'Playfair Display', serif", desc:"Sofisticado"},
                  {id:"bold", label:"Bold", css:"'Oswald', sans-serif", desc:"Forte e marcante"},
                  {id:"minimalista", label:"Minimalista", css:"'Raleway', sans-serif", desc:"Sutil e clean"},
                  {id:"urbano", label:"Urbano", css:"'Bebas Neue', cursive", desc:"Street style"},
                ].map(f =>
                  `<button type="button" onclick="selectFont('${f.id}')" id="font-${f.id}" style="padding:12px 8px;border-radius:10px;border:2px solid ${(settings?.fontStyle ?? 'moderno') === f.id ? 'var(--gold)' : 'var(--border)'};background:${(settings?.fontStyle ?? 'moderno') === f.id ? 'rgba(201,168,76,0.12)' : 'var(--surface2)'};cursor:pointer;text-align:center;transition:all 0.15s">
                    <div style="font-family:${f.css};font-size:15px;color:var(--text);margin-bottom:3px">${f.label}</div>
                    <div style="font-size:10px;color:var(--muted)">${f.desc}</div>
                  </button>`
                ).join('')}
              </div>
            </div>

            <!-- SEÇÃO 3: Logo -->
            <div style="margin-bottom:28px">
              <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)">📷 Logo da Barbearia</div>
              <div style="display:flex;align-items:center;gap:16px;background:var(--surface2);border-radius:12px;padding:16px;border:1px solid var(--border)">
                <div id="logoPreviewWrap" style="width:80px;height:80px;border-radius:50%;border:3px solid var(--border);overflow:hidden;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  ${currentLogo ? `<img src="${currentLogo}" style="width:100%;height:100%;object-fit:cover" />` : `<span style="font-size:32px">✂️</span>`}
                </div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">${currentLogo ? 'Logo atual' : 'Nenhum logo adicionado'}</div>
                  <div style="font-size:11px;color:var(--muted);margin-bottom:12px">${currentLogo ? 'Escolha outro para substituir.' : 'JPG, PNG ou WebP. Recomendado: 400×400px.'}</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <label for="logoFileInput" class="btn btn-ghost" style="cursor:pointer;font-size:13px">📷 Escolher foto</label>
                    ${currentLogo ? `<button type="button" onclick="removeLogo()" style="background:#EF444422;color:#EF4444;border:1px solid #EF444444;border-radius:8px;font-size:12px;padding:6px 14px;cursor:pointer">× Remover</button>` : ''}
                  </div>
                  <input type="file" id="logoFileInput" accept="image/*" style="display:none" onchange="handleLogoUpload(this)" />
                  <div id="logoFileName" style="font-size:11px;color:var(--success);margin-top:6px;min-height:16px"></div>
                </div>
              </div>
            </div>

            <!-- SEÇÃO 4: Banner -->
            <div style="margin-bottom:28px">
              <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)">🖼️ Imagem de Capa (Banner)</div>
              <div id="bannerPreviewWrap" style="width:100%;height:140px;border-radius:12px;border:2px dashed var(--border);overflow:hidden;background:${currentBanner ? `url('${currentBanner}') center/cover` : 'var(--surface2)'};display:flex;align-items:center;justify-content:center;margin-bottom:10px;cursor:pointer;position:relative" onclick="document.getElementById('bannerFileInput').click()">
                ${currentBanner ? `` : `<div style="text-align:center;color:var(--muted)"><div style="font-size:36px">🖼️</div><div style="font-size:13px;margin-top:6px;font-weight:500">Clique para escolher a imagem de capa</div><div style="font-size:11px;margin-top:4px">Recomendado: 1200×400px</div></div>`}
                <div id="bannerOverlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.5);display:${currentBanner ? 'flex' : 'none'};align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:600;opacity:0;transition:opacity 0.2s;gap:8px" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">📷 Trocar imagem</div>
              </div>
              <input type="file" id="bannerFileInput" accept="image/*" style="display:none" onchange="handleBannerUpload(this)" />
              <div id="bannerFileName" style="font-size:11px;color:var(--success);margin-top:4px;min-height:16px"></div>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="font-size:11px;color:var(--muted)">Aparece no topo da página do cliente.</div>
                ${currentBanner ? `<button type="button" onclick="removeBanner()" style="background:none;border:none;color:#EF4444;font-size:12px;cursor:pointer;padding:0;font-weight:500">× Remover banner</button>` : ''}
              </div>
            </div>

            <!-- SEÇÃO 5: Galeria -->
            <div style="margin-bottom:28px">
              <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)">🖼️ Galeria de Fotos</div>
              <div id="galleryGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
                ${galleryList.map((url, i) => `
                  <div style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;border:1px solid var(--border)">
                    <img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover" />
                    <button type="button" onclick="removeGalleryItem(${i})" style="position:absolute;top:5px;right:5px;background:rgba(0,0,0,0.75);color:#fff;border:none;border-radius:50%;width:24px;height:24px;font-size:13px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center">×</button>
                  </div>`).join('')}
                <label for="galleryFileInput" style="aspect-ratio:1;border-radius:10px;border:2px dashed var(--border);background:var(--surface2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);gap:4px">
                  <span style="font-size:28px">+</span>
                  <span style="font-size:12px;font-weight:500">Adicionar</span>
                </label>
              </div>
              <input type="file" id="galleryFileInput" accept="image/*" multiple style="display:none" onchange="handleGalleryUpload(this)" />
              <div style="font-size:11px;color:var(--muted)">Selecione várias fotos de uma vez. Máximo recomendado: 12 fotos.</div>
            </div>

            <!-- Botão Salvar + Visualizar -->
            <div style="padding-top:4px;padding-bottom:8px;display:flex;flex-direction:column;gap:10px">
              <button type="submit" class="btn btn-primary" style="width:100%;padding:14px 32px;font-size:15px;font-weight:700">💾 Salvar Aparência</button>
              ${publicUrl ? `<a href="${esc(publicUrl)}" target="_blank" class="btn btn-ghost" style="width:100%;padding:12px 32px;font-size:14px;font-weight:600;text-align:center;text-decoration:none;display:block">👁 Visualizar minha página</a>` : ""}
            </div>
          </form>

          <!-- ===== COLUNA DIREITA: PREVIEW ===== -->
          <div style="position:sticky;top:20px">
            <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:12px;text-transform:uppercase">Preview em Tempo Real</div>
            <div id="livePreview" style="border-radius:16px;overflow:hidden;border:1px solid var(--border);box-shadow:0 4px 24px rgba(0,0,0,0.25);background:#fff">
              <!-- Banner -->
              <div id="pvBanner" style="height:120px;background:${currentBanner ? `url('${currentBanner}') center/cover` : 'linear-gradient(135deg,#1a1a1a,#2d2d2d)'};position:relative;display:flex;align-items:flex-end;padding:14px">
                <div id="pvLogo" style="width:60px;height:60px;border-radius:50%;border:3px solid #fff;overflow:hidden;background:#222;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.4)">
                  ${currentLogo ? `<img src="${currentLogo}" style="width:100%;height:100%;object-fit:cover" />` : `<span style="font-size:24px">✂️</span>`}
                </div>
              </div>
              <!-- Info -->
              <div style="padding:16px;background:${currentBgColor};transition:background 0.2s" id="pvInfoSection">
                <div id="pvName" style="font-size:18px;font-weight:700;color:${(() => { const r=parseInt(currentBgColor.slice(1,3),16)||10, g=parseInt(currentBgColor.slice(3,5),16)||10, b=parseInt(currentBgColor.slice(5,7),16)||10; return (r*299+g*587+b*114)/1000 > 128 ? '#111' : '#fff'; })()};margin-bottom:3px;font-family:'Inter',sans-serif">${shopNameDisplay}</div>
                <div class="pv-sub" style="font-size:12px;color:${(() => { const r=parseInt(currentBgColor.slice(1,3),16)||10, g=parseInt(currentBgColor.slice(3,5),16)||10, b=parseInt(currentBgColor.slice(5,7),16)||10; return (r*299+g*587+b*114)/1000 > 128 ? '#555' : '#aaa'; })()};margin-bottom:14px">Barbearia &bull; Agendamento Online</div>
                <div id="pvBtn" style="display:inline-block;padding:10px 22px;background:${currentColor};color:#fff;border-radius:8px;font-size:13px;font-weight:700;font-family:'Inter',sans-serif">Agendar Agora</div>
              </div>
              <!-- Galeria mini -->
              ${galleryList.length > 0 ? `
              <div style="padding:0 16px 16px">
                <div style="font-size:11px;color:#999;margin-bottom:8px;font-weight:600">GALERIA</div>
                <div id="pvGallery" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
                  ${galleryList.slice(0,4).map(url => `<img src="${esc(url)}" style="aspect-ratio:1;width:100%;object-fit:cover;border-radius:6px" />`).join('')}
                </div>
              </div>` : `<div id="pvGallery" style="padding:0 16px 16px"><div style="font-size:11px;color:#bbb">Galeria vazia</div></div>`}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:10px;text-align:center">Assim seus clientes verão a página</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fontes do Google para preview -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Oswald:wght@600&family=Raleway:wght@600&family=Bebas+Neue&display=swap" rel="stylesheet">

    <script>
    // Estado atual
    var _color = '${currentColor}';
    var _bgColor = '${currentBgColor}';
    var _font = '${currentFont}';
    var _logoUrl = '${currentLogo}';
    var _bannerUrl = '${currentBanner}';
    var _galleryUrls = ${JSON.stringify(galleryList)};
    var _newGalleryFiles = []; // {base64, mime, previewUrl}

    var fontCssMap = {
      moderno: "'Inter', sans-serif",
      classico: "'Georgia', serif",
      elegante: "'Playfair Display', serif",
      bold: "'Oswald', sans-serif",
      minimalista: "'Raleway', sans-serif",
      urbano: "'Bebas Neue', cursive"
    };

    function selectColor(c) {
      _color = c;
      document.getElementById('fPrimaryColor').value = c;
      document.getElementById('pcColorHex').value = c;
      try { document.getElementById('pcColorPicker').value = c; } catch(e){}
      // Atualizar caixa de preview da cor
      var cpb = document.getElementById('colorPreviewBox');
      if (cpb) cpb.style.background = c;
      // Atualizar swatches
      document.querySelectorAll('#colorSwatches button').forEach(function(btn) {
        var bc = btn.title;
        btn.style.border = '3px solid ' + (bc === c ? '#fff' : 'transparent');
        btn.style.boxShadow = bc === c ? '0 0 0 3px var(--gold)' : '0 0 0 1px var(--border)';
      });
      // Preview ao vivo
      document.getElementById('pvBtn').style.background = c;
    }

    function selectBgColor(c) {
      _bgColor = c;
      document.getElementById('fBackgroundColor').value = c;
      document.getElementById('bgColorHex').value = c;
      try { document.getElementById('bgColorPicker').value = c; } catch(e){}
      // Atualizar caixa de preview
      var cpb = document.getElementById('bgColorPreviewBox');
      if (cpb) cpb.style.background = c;
      // Atualizar swatches
      document.querySelectorAll('#bgSwatches button').forEach(function(btn) {
        var bc = btn.title;
        btn.style.border = '3px solid ' + (bc === c ? '#fff' : 'transparent');
        btn.style.boxShadow = bc === c ? '0 0 0 3px var(--gold)' : '0 0 0 1px var(--border)';
      });
      // Preview ao vivo — fundo do card de info
      var pvInfo = document.getElementById('pvInfoSection');
      if (pvInfo) pvInfo.style.background = c;
      // Ajustar cor do texto do preview baseado no brilho do fundo
      var r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
      var brightness = (r*299 + g*587 + b*114) / 1000;
      var textColor = brightness > 128 ? '#111' : '#fff';
      var mutedColor = brightness > 128 ? '#555' : '#aaa';
      var pvName = document.getElementById('pvName');
      if (pvName) pvName.style.color = textColor;
      var pvSub = document.querySelector('#livePreview .pv-sub');
      if (pvSub) pvSub.style.color = mutedColor;
    }

    function selectFont(id) {
      _font = id;
      document.getElementById('fFontStyle').value = id;
      document.querySelectorAll('#fontOptions button').forEach(function(btn) {
        var sel = btn.id === 'font-' + id;
        btn.style.borderColor = sel ? 'var(--gold)' : 'var(--border)';
        btn.style.background = sel ? 'rgba(201,168,76,0.12)' : 'var(--surface2)';
      });
      var css = fontCssMap[id] || fontCssMap.moderno;
      document.getElementById('pvName').style.fontFamily = css;
      document.getElementById('pvBtn').style.fontFamily = css;
    }

    function handleLogoUpload(input) {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        var dataUrl = e.target.result;
        var base64 = dataUrl.split(',')[1];
        document.getElementById('fLogoBase64').value = base64;
        document.getElementById('fLogoMime').value = file.type;
        // Preview
        var wrap = document.getElementById('logoPreviewWrap');
        wrap.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover" />';
        // Live preview
        document.getElementById('pvLogo').innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover" />';
      };
      reader.readAsDataURL(file);
    }

    function handleBannerUpload(input) {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        var dataUrl = e.target.result;
        var base64 = dataUrl.split(',')[1];
        document.getElementById('fBannerBase64').value = base64;
        document.getElementById('fBannerMime').value = file.type;
        // Preview wrap
        var wrap = document.getElementById('bannerPreviewWrap');
        wrap.style.background = "url('" + dataUrl + "') center/cover";
        wrap.innerHTML = '<div id="bannerOverlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:600;opacity:0;transition:opacity 0.2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">📷 Trocar imagem</div>';
        // Live preview
        document.getElementById('pvBanner').style.background = "url('" + dataUrl + "') center/cover";
      };
      reader.readAsDataURL(file);
    }

    function handleGalleryUpload(input) {
      var files = Array.from(input.files);
      files.forEach(function(file) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var dataUrl = e.target.result;
          _newGalleryFiles.push({ base64: dataUrl.split(',')[1], mime: file.type, previewUrl: dataUrl });
          renderGalleryGrid();
          updateGalleryPreview();
        };
        reader.readAsDataURL(file);
      });
      input.value = '';
    }

    function removeGalleryItem(idx) {
      // idx < _galleryUrls.length: remove URL existente; else: remove novo arquivo
      if (idx < _galleryUrls.length) {
        _galleryUrls.splice(idx, 1);
      } else {
        _newGalleryFiles.splice(idx - _galleryUrls.length, 1);
      }
      renderGalleryGrid();
      updateGalleryPreview();
    }

    function renderGalleryGrid() {
      var grid = document.getElementById('galleryGrid');
      var allItems = _galleryUrls.map(function(url, i) {
        return '<div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid var(--border)"><img src="' + url + '" style="width:100%;height:100%;object-fit:cover" /><button type="button" onclick="removeGalleryItem(' + i + ')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer;line-height:1">×</button></div>';
      }).concat(_newGalleryFiles.map(function(f, j) {
        var idx = _galleryUrls.length + j;
        return '<div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:2px solid var(--gold)"><img src="' + f.previewUrl + '" style="width:100%;height:100%;object-fit:cover" /><button type="button" onclick="removeGalleryItem(' + idx + ')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer;line-height:1">×</button></div>';
      }));
      grid.innerHTML = allItems.join('') + '<label for="galleryFileInput" style="aspect-ratio:1;border-radius:8px;border:2px dashed var(--border);background:var(--surface2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);font-size:12px;gap:4px"><span style="font-size:22px">+</span><span>Adicionar</span></label>';
    }

    function updateGalleryPreview() {
      var pvGallery = document.getElementById('pvGallery');
      var allUrls = _galleryUrls.concat(_newGalleryFiles.map(function(f){ return f.previewUrl; }));
      if (allUrls.length === 0) {
        pvGallery.style.display = 'none';
        pvGallery.innerHTML = '';
      } else {
        pvGallery.style.display = 'block';
        pvGallery.innerHTML = '<div style="font-size:11px;color:#999;margin-bottom:8px;font-weight:600;padding:0 16px">GALERIA</div>'
          + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:0 16px 16px">'
          + allUrls.slice(0,4).map(function(url) {
            return '<img src="' + url + '" style="aspect-ratio:1;width:100%;object-fit:cover;border-radius:6px" />';
          }).join('')
          + '</div>';
      }
    }

    function removeLogo() {
      _logoUrl = '';
      document.getElementById('fLogoUrl').value = '';
      document.getElementById('fLogoBase64').value = '';
      document.getElementById('fLogoMime').value = '';
      var wrap = document.getElementById('logoPreviewWrap');
      wrap.innerHTML = '<span style="font-size:28px;color:var(--muted)">✂️</span>';
      document.getElementById('pvLogo').innerHTML = '<span style="font-size:22px">✂️</span>';
    }

    function removeBanner() {
      _bannerUrl = '';
      document.getElementById('fBannerUrl').value = '';
      document.getElementById('fBannerBase64').value = '';
      document.getElementById('fBannerMime').value = '';
      var wrap = document.getElementById('bannerPreviewWrap');
      wrap.style.background = 'var(--surface2)';
      wrap.innerHTML = '<div style="text-align:center;color:var(--muted)"><div style="font-size:28px">🖼️</div><div style="font-size:12px;margin-top:4px">Clique para escolher</div></div>';
      document.getElementById('pvBanner').style.background = 'linear-gradient(135deg,#1a1a1a,#2d2d2d)';
    }

    function prepareVisualSubmit() {
      // Sincronizar URLs atuais (podem ter sido removidas)
      document.getElementById('fLogoUrl').value = _logoUrl;
      document.getElementById('fBannerUrl').value = _bannerUrl;
      // Atualizar galleryUrls como JSON (compatível com APP)
      document.getElementById('fGalleryUrls').value = JSON.stringify(_galleryUrls);
      document.getElementById('fGalleryBase64List').value = _newGalleryFiles.map(function(f){ return f.base64; }).join('||');
      document.getElementById('fGalleryMimeList').value = _newGalleryFiles.map(function(f){ return f.mime; }).join('||');
    }

    function handleVisualSubmit(e) {
      e.preventDefault();
      prepareVisualSubmit();
      var form = document.getElementById('visualForm');
      var btn = form.querySelector('button[type="submit"]');
      var origText = btn.innerHTML;
      btn.innerHTML = '⏳ Salvando...';
      btn.disabled = true;
      var data = new FormData(form);
      fetch('/admin/pagina-cliente/visual', {
        method: 'POST',
        body: new URLSearchParams(data)
      }).then(function(r) {
        btn.innerHTML = origText;
        btn.disabled = false;
        if (r.ok || r.redirected) {
          // Mostrar toast de sucesso
          var toast = document.createElement('div');
          toast.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#22C55E;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,0.25);display:flex;align-items:center;gap:10px;animation:fadeInUp 0.3s ease';
          toast.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Aparência salva com sucesso!';
          document.body.appendChild(toast);
          setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3500);
          // Limpar novos arquivos de galeria (já foram enviados)
          _newGalleryFiles = [];
        } else {
          alert('Erro ao salvar. Tente novamente.');
        }
      }).catch(function() {
        btn.innerHTML = origText;
        btn.disabled = false;
        alert('Erro de conexão. Tente novamente.');
      });
      return false;
    }
    </script>
    <style>
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateX(-50%) translateY(16px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    </style>
  `;

  // ─── Bloco 4: Configurações Extras (recolhido por padrão) ────────────────────
  const blocoExtras = `
    <details class="card" style="margin-bottom:24px">
      <summary style="display:flex;align-items:center;gap:10px;padding:16px 20px;cursor:pointer;list-style:none;border-radius:12px">
        <span style="font-size:20px">⚙️</span>
        <span style="font-size:15px;font-weight:700;color:var(--text)">Configurações Extras</span>
        <span style="margin-left:auto;font-size:12px;color:var(--muted)">SEO, Rastreamento, Domínio, Marketplace</span>
      </summary>
      <div style="padding:0 20px 20px">
        <div style="border-top:1px solid var(--border);padding-top:20px">

          <!-- SEO -->
          <div style="margin-bottom:28px">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Título e Descrição da Página</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Como sua página aparece no Google e quando compartilhada no WhatsApp e redes sociais.</div>
            ${seoSaved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:13px"> Salvo com sucesso!</div>` : ""}
            <form method="POST" action="/admin/pagina-cliente/seo">
              <div class="form-group">
                <label class="form-label">Título da Página <span style="color:var(--muted);font-weight:400">(até 60 caracteres)</span></label>
                <input class="form-input" type="text" name="seoTitle" value="${esc(settings?.seoTitle ?? "")}" placeholder="Ex: Barbearia do João — Cortes modernos em São Paulo" maxlength="100" />
              </div>
              <div class="form-group">
                <label class="form-label">Descrição <span style="color:var(--muted);font-weight:400">(até 160 caracteres)</span></label>
                <textarea class="form-input" name="seoDescription" rows="3" placeholder="Ex: Agende seu corte online! Barbearia especializada em cortes modernos, barba e bigode." maxlength="300" style="resize:vertical">${esc(settings?.seoDescription ?? "")}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Imagem de Compartilhamento <span style="color:var(--muted);font-weight:400">(1200×630px ideal)</span></label>
                <input type="hidden" name="seoImageUrl" id="fSeoImageUrl" value="${esc(settings?.seoImageUrl ?? "")}" />
                <input type="hidden" name="seoImageBase64" id="fSeoImageBase64" value="" />
                <input type="hidden" name="seoImageMime" id="fSeoImageMime" value="" />
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px">
                  ${settings?.seoImageUrl ? `
                  <div style="width:80px;height:42px;border-radius:6px;overflow:hidden;border:1px solid var(--border);flex-shrink:0">
                    <img id="seoImgPreview" src="${esc(settings.seoImageUrl)}" style="width:100%;height:100%;object-fit:cover" />
                  </div>` : `<div id="seoImgPreviewWrap" style="width:80px;height:42px;border-radius:6px;border:1px dashed var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;color:var(--muted)">🖼️</div>`}
                  <div style="flex:1">
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                      <label for="seoImageFileInput" class="btn btn-ghost" style="cursor:pointer;font-size:12px;padding:6px 12px">📷 Escolher imagem</label>
                      ${settings?.seoImageUrl ? `<button type="button" onclick="removeSeoImage()" style="background:#EF444422;color:#EF4444;border:1px solid #EF444444;border-radius:8px;font-size:12px;padding:6px 12px;cursor:pointer">× Remover</button>` : ''}
                    </div>
                  </div>
                </div>
                <input type="file" id="seoImageFileInput" accept="image/*" style="display:none" onchange="handleSeoImageUpload(this)" />
                <div id="seoImageFileName" style="font-size:11px;color:var(--success);margin-top:4px;min-height:16px"></div>
                <div style="font-size:11px;color:var(--muted)">Imagem exibida quando o link é compartilhado no WhatsApp, Facebook e Instagram.</div>
              </div>
              <button type="submit" class="btn btn-primary" style="padding:10px 24px" onclick="prepareSeoSubmit()">Salvar</button>
            </form>
            <script>
            function handleSeoImageUpload(input) {
              var file = input.files[0];
              if (!file) return;
              var reader = new FileReader();
              reader.onload = function(e) {
                var dataUrl = e.target.result;
                document.getElementById('fSeoImageBase64').value = dataUrl.split(',')[1];
                document.getElementById('fSeoImageMime').value = file.type;
                var wrap = document.getElementById('seoImgPreviewWrap') || document.getElementById('seoImgPreview');
                if (wrap) { wrap.outerHTML = '<img id="seoImgPreview" src="' + dataUrl + '" style="width:80px;height:42px;object-fit:cover;border-radius:6px;border:1px solid var(--border)" />'; }
                var seoNameEl = document.getElementById('seoImageFileName');
                if (seoNameEl) seoNameEl.textContent = '✓ ' + file.name;
              };
              reader.readAsDataURL(file);
            }
            function removeSeoImage() {
              document.getElementById('fSeoImageUrl').value = '';
              document.getElementById('fSeoImageBase64').value = '';
              document.getElementById('fSeoImageMime').value = '';
              var img = document.getElementById('seoImgPreview');
              if (img) img.outerHTML = '<div id="seoImgPreviewWrap" style="width:80px;height:42px;border-radius:6px;border:1px dashed var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;color:var(--muted)">🖼️</div>';
            }
            function prepareSeoSubmit() {
              // fSeoImageUrl já está sincronizado; base64 e mime são enviados separadamente
            }
            </script>
          </div>

          <div style="border-top:1px solid var(--border);margin-bottom:28px;padding-top:24px">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Rastreamento (Google Analytics / Facebook Pixel)</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Acompanhe as visitas e conversões da sua página de agendamento.</div>
            ${trackingSaved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:13px"> Salvo com sucesso!</div>` : ""}
            <form method="POST" action="/admin/pagina-cliente/rastreamento">
              <div class="form-group">
                <label class="form-label">Google Analytics 4 — Measurement ID</label>
                <input class="form-input" type="text" name="ga4MeasurementId" value="${esc(settings?.ga4MeasurementId ?? "")}" placeholder="G-XXXXXXXXXX" style="font-family:monospace" />
              </div>
              <div class="form-group">
                <label class="form-label">Facebook Pixel ID</label>
                <input class="form-input" type="text" name="facebookPixelId" value="${esc(settings?.facebookPixelId ?? "")}" placeholder="123456789012345" style="font-family:monospace" />
              </div>
              <button type="submit" class="btn btn-primary" style="padding:10px 24px">Salvar</button>
            </form>
          </div>

          <div style="border-top:1px solid var(--border);padding-top:24px">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Domínio Personalizado</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Configure um domínio próprio para a página de agendamento (ex: <code>agendamento.minhabarbearia.com.br</code>).</div>
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
      </div>
    </details>
  `;

  // ─── Montar body final sem abas ──────────────────────────────────────────────
  const body = blocoAvisoHorarios + blocoCompartilhar + blocoQrCode + blocoAparencia + blocoExtras;

  const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Página do Cliente", "pagina-cliente", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Página do Cliente",href:"/admin/pagina-cliente"}]));
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
          ${(client as any).birthdate ? `<div style="color:var(--muted);font-size:12px;margin-top:2px"> ${new Date((client as any).birthdate + "T12:00:00").toLocaleDateString("pt-BR")}</div>` : ""}
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
        <div class="card-header"><div class="card-title">Histórico de Agendamentos</div></div>
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
  res.send(adminLayout(`Cliente: ${(client as any).name}`, "clientes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Clientes",href:"/admin/clientes"},{label:(client as any).name,href:"#"}]));
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

  // POST /api/error-log — Ingestão de erros do browser (sem autenticação)
  app.post("/api/error-log", async (req: Request, res: Response) => {
    try {
      const { message, stack, url, userAgent, tenantId, context, source } = req.body ?? {};
      if (!message) return res.status(400).json({ ok: false });
      await db.insertErrorLog({
        source: source ?? "browser",
        message: String(message).slice(0, 2000),
        stack: stack ? String(stack).slice(0, 5000) : undefined,
        url: url ? String(url).slice(0, 500) : undefined,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : undefined,
        tenantId: tenantId ?? undefined,
        context: context ? JSON.stringify(context) : undefined,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[error-log]", e);
      res.status(500).json({ ok: false });
    }
  });

  // GET /admin/login
  app.get("/admin/login", (req: Request, res: Response) => {
    const token = (req as any).cookies?.[ADMIN_SESSION_COOKIE];
    if (token && decodeSession(token)) return res.redirect("/admin");
    const errorMsg = req.query.msg ? decodeURIComponent(req.query.msg as string) : undefined;
    const info = req.query.info as string | undefined;
    const infoEmail = req.query.email ? decodeURIComponent(req.query.email as string) : undefined;
    res.send(loginPage(req.query.error === "1", errorMsg, info, infoEmail));
  });

  // POST /admin/login
  app.post("/admin/login", async (req: Request, res: Response) => {
    try {
      const { email, password, remember } = req.body ?? {};
      if (!email || !password) return res.redirect("/admin/login?error=1");

      const barber = await db.getBarberByEmail(email);
      console.log(`[login] email=${email} found=${!!barber} isActive=${barber?.isActive} hasHash=${!!barber?.passwordHash}`);
      if (!barber || !barber.isActive || !barber.passwordHash) return res.redirect("/admin/login?error=1");

      const valid = await bcrypt.compare(password, barber.passwordHash);
      console.log(`[login] valid=${valid}`);
      if (!valid) return res.redirect("/admin/login?error=1");

      const rememberMe = remember === "1" || remember === "true";
      const maxAge = rememberMe ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE;
      const token = encodeSession(barber.id, barber.role);
      res.setHeader("Set-Cookie", `${ADMIN_SESSION_COOKIE}=${token}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
      res.redirect("/admin");
    } catch (err) {
      console.error("[login] Unexpected error:", err);
      res.redirect("/admin/login?error=1");
    }
  });

  // GET /admin/google-signup — inicia o fluxo OAuth do Google para cadastro de nova barbearia
  app.get("/admin/google-signup", (req: Request, res: Response) => {
    const appId = process.env.VITE_APP_ID ?? "";
    const portalUrl = process.env.VITE_OAUTH_PORTAL_URL ?? "https://manus.im";
    const baseUrl = process.env.PUBLIC_BASE_URL ?? `https://${req.headers.host}`;
    const redirectUri = `${baseUrl}/admin/google-signup-callback`;
    const state = Buffer.from(redirectUri).toString("base64");
    const url = new URL(`${portalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    res.redirect(url.toString());
  });

  // GET /admin/google-signup-callback — recebe o code e redireciona para landing com dados pré-preenchidos
  app.get("/admin/google-signup-callback", async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      if (!code || !state) return res.redirect("/?signup_error=1");
      const { sdk } = await import("./_core/sdk.js");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.email) return res.redirect("/?signup_error=1");
      // Verificar se já existe conta com este e-mail
      const existingBarber = await db.getBarberByEmail(userInfo.email);
      if (existingBarber) {
        // Já tem conta — redirecionar para login com aviso
        return res.redirect(`/admin/login?info=already_exists&email=${encodeURIComponent(userInfo.email)}`);
      }
      // Redirecionar para landing com dados do Google para pré-preencher o modal
      const params = new URLSearchParams({
        google_signup: "1",
        name: userInfo.name ?? "",
        email: userInfo.email,
        openId: (userInfo as any).openId ?? "",
      });
      res.redirect(`/?${params.toString()}#cadastro`);
    } catch (err) {
      console.error("[google-signup-callback] Error:", err);
      res.redirect("/?signup_error=1");
    }
  });

  // GET /admin/google-login — inicia o fluxo OAuth do Google via Manus
  app.get("/admin/google-login", (req: Request, res: Response) => {
    const appId = process.env.VITE_APP_ID ?? "";
    const portalUrl = process.env.VITE_OAUTH_PORTAL_URL ?? "https://manus.im";
    const baseUrl = process.env.PUBLIC_BASE_URL ?? `https://${req.headers.host}`;
    const redirectUri = `${baseUrl}/admin/google-callback`;
    const state = Buffer.from(redirectUri).toString("base64");
    const url = new URL(`${portalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    res.redirect(url.toString());
  });

  // GET /admin/google-callback — recebe o code do OAuth e faz login
  app.get("/admin/google-callback", async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      if (!code || !state) return res.redirect("/admin/login?error=1");

      // Trocar code por token via SDK do Manus
      const { sdk } = await import("./_core/sdk.js");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.email) {
        return res.redirect("/admin/login?error=1&msg=" + encodeURIComponent("E-mail não retornado pelo Google."));
      }

      // Buscar barbeiro pelo email
      let barber = await db.getBarberByEmail(userInfo.email);
      if (!barber && userInfo.openId) {
        barber = await db.getBarberByGoogleId(userInfo.openId);
      }

      if (!barber || !barber.isActive) {
        const msg = encodeURIComponent(`Nenhuma conta encontrada para ${userInfo.email}. Solicite ao administrador que cadastre sua conta.`);
        return res.redirect("/admin/login?error=1&msg=" + msg);
      }

      // Vincular googleId se ainda não estiver vinculado
      if (userInfo.openId && !(barber as any).googleId) {
        await db.updateBarber(barber.id, { googleId: userInfo.openId } as any);
      }

      const token = encodeSession(barber.id, barber.role);
      res.setHeader("Set-Cookie", `${ADMIN_SESSION_COOKIE}=${token}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_REMEMBER}`);
      res.redirect("/admin");
    } catch (err) {
      console.error("[google-callback] Error:", err);
      res.redirect("/admin/login?error=1&msg=" + encodeURIComponent("Erro ao autenticar com Google. Tente novamente."));
    }
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
    .info-banner { background: #C9A84C22; border: 1px solid #C9A84C44; color: #C9A84C; padding: 12px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; line-height: 1.5; }
    .success { background: #22C55E22; border: 1px solid #22C55E44; color: #4ADE80; padding: 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; text-align: center; line-height: 1.6; }
    .back { display: block; text-align: center; margin-top: 20px; font-size: 12px; color: #888880; text-decoration: none; }
    .back:hover { color: #C9A84C; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">BARBER PRO</div>
    <div class="subtitle">Recuperar Senha</div>
    ${sent ? `<div class="success">E-mail enviado!<br>Verifique sua caixa de entrada e use o código para redefinir sua senha.<br><small style="color:#9BA1A6">(Verifique também a pasta de spam)</small></div>` : ""}
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
    .info-banner { background: #C9A84C22; border: 1px solid #C9A84C44; color: #C9A84C; padding: 12px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; line-height: 1.5; }
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
    const hash = await bcrypt.hash(password, 10);
    const barber = await db.getBarberByEmail(email);
    if (!barber) return res.redirect("/admin/login?error=1");
    await db.updateBarber(barber.id, { passwordHash: hash });
    res.redirect("/admin/login?reset=1");
  });

  // POST /admin/configuracoes (salvar)
  app.post("/admin/configuracoes", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const tab = (req.query.tab as string) ?? "dados";
    const body = req.body ?? {};
    if (tab === "visual") {
      const { primaryColor, bannerUrl, logoUrl, galleryUrls } = body;
      await db.upsertShopSettings({ primaryColor, bannerUrl, logoUrl, galleryUrls }, tenantId);
    } else {
      // tab === "dados" (padrão)
      const { shopName, phone, whatsapp, instagram, address, addressNumber, addressComplement, cep, googleMapsUrl, pixKey, dailyGoal } = body;
      const dailyGoalNum = dailyGoal ? parseInt(dailyGoal, 10) || 0 : 0;
      await db.upsertShopSettings({ shopName, phone, whatsapp, instagram, address, addressNumber, addressComplement, cep, googleMapsUrl, pixKey, dailyGoal: dailyGoalNum } as any, tenantId);
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
      const session = (req as any).adminSession;
      const currentBarber = await db.getBarberById(session.barberId);
      const tenantId = currentBarber?.tenantId ?? null;
      const { name, email, password, phone } = req.body ?? {};
      if (!name || !email || !password) {
        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Preencha+todos+os+campos"); return;
      }
      if (password.length < 6) {
        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Senha+deve+ter+m%C3%ADnimo+6+caracteres"); return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await db.createBarber({ name, email, phone: phone || null, passwordHash, role: "barber", isActive: true, tenantId });
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

  // ─── Rotas Asaas ────────────────────────────────────────────────────────────────────────
  // POST /admin/configuracoes/asaas/setup — Criar subconta Asaas
  app.post("/admin/configuracoes/asaas/setup", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      if (!barber?.tenantId) {
        res.redirect("/admin/configuracoes?tab=pagamentos&error=Tenant+n%C3%A3o+encontrado"); return;
      }
      if (!asaasEnabled) {
        res.redirect("/admin/configuracoes?tab=pagamentos&error=Pagamentos+online+n%C3%A3o+configurados+no+servidor"); return;
      }
      const { name, email, cpfCnpj, companyType, mobilePhone, birthDate, address, addressNumber, province, postalCode, incomeValue } = req.body ?? {};
      if (!name || !email || !cpfCnpj || !mobilePhone) {
        res.redirect("/admin/configuracoes?tab=pagamentos&error=Preencha+todos+os+campos+obrigat%C3%B3rios"); return;
      }
      if (!incomeValue || isNaN(parseFloat(incomeValue)) || parseFloat(incomeValue) <= 0) {
        res.redirect("/admin/configuracoes?tab=pagamentos&error=Preencha+o+campo+de+renda%2Ffaturamento+mensal"); return;
      }

      const dbConn = await db.getDb();
      if (!dbConn) { res.redirect("/admin/configuracoes?tab=pagamentos&error=Banco+de+dados+indispon%C3%ADvel"); return; }

      // Verificar se já tem subconta ativa
      const tenantRows = await dbConn.execute(sql`SELECT "asaasAccountId", "asaasAccountStatus" FROM tenants WHERE id = ${barber.tenantId} LIMIT 1`);
      const existingTenant = ((tenantRows as any).rows as any[])[0];
      if (existingTenant?.asaasAccountId && existingTenant?.asaasAccountStatus === 'active') {
        res.redirect("/admin/configuracoes?tab=pagamentos&saved=1"); return;
      }

      // Criar subconta no Asaas
      const subAccount = await createAsaasSubAccount({
        name: name.trim(),
        email: email.trim(),
        cpfCnpj: cpfCnpj.replace(/\D/g, ""),
        companyType: companyType || undefined,
        mobilePhone: mobilePhone.replace(/\D/g, ""),
        birthDate: birthDate || undefined,
        address: address || undefined,
        addressNumber: addressNumber || undefined,
        province: province || undefined,
        postalCode: postalCode ? postalCode.replace(/\D/g, "") : undefined,
        incomeValue: parseFloat(incomeValue),
      });

      // Salvar credenciais no banco
      await dbConn.execute(sql`
        UPDATE tenants SET
          "asaasAccountId" = ${subAccount.id},
          "asaasApiKey" = ${subAccount.apiKey},
          "asaasWalletId" = ${subAccount.walletId},
          "asaasAccountStatus" = 'pending',
          "asaasCpfCnpj" = ${cpfCnpj},
          "asaasCompanyType" = ${companyType || null},
          "asaasMobilePhone" = ${mobilePhone},
          "asaasBirthDate" = ${birthDate || null},
          "updatedAt" = NOW()
        WHERE id = ${barber.tenantId}
      `);

      res.redirect("/admin/configuracoes?tab=pagamentos&saved=1");
    } catch (e: any) {
      const msg = encodeURIComponent(e?.response?.data?.errors?.[0]?.description ?? e.message ?? "Erro ao criar conta");
      res.redirect(`/admin/configuracoes?tab=pagamentos&error=${msg}`);
    }
  });

  // POST /admin/configuracoes/asaas/sync — Sincronizar status da subconta
  app.post("/admin/configuracoes/asaas/sync", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      if (!barber?.tenantId) { res.redirect("/admin/configuracoes?tab=pagamentos"); return; }

      const dbConn = await db.getDb();
      if (!dbConn) { res.redirect("/admin/configuracoes?tab=pagamentos"); return; }

      const rows = await dbConn.execute(sql`SELECT "asaasAccountId" FROM tenants WHERE id = ${barber.tenantId} LIMIT 1`);
      const tenant = ((rows as any).rows as any[])[0];
      if (!tenant?.asaasAccountId) { res.redirect("/admin/configuracoes?tab=pagamentos"); return; }

      const accountData = await getAsaasSubAccount(tenant.asaasAccountId);
      // A API Asaas pode retornar accountStatus no nível raiz OU dentro de commercialInfo.
      // Se nenhum desses campos estiver presente mas a conta existe (tem walletId e accountNumber),
      // a conta está ativa (aprovada automaticamente no Asaas Sandbox e em contas já aprovadas).
      const rawStatus = (accountData as any).accountStatus
        ?? (accountData as any).commercialInfo?.status
        ?? null;
      let normalizedStatus: string;
      if (rawStatus === "APPROVED") {
        normalizedStatus = "active";
      } else if (rawStatus === "REJECTED") {
        normalizedStatus = "rejected";
      } else if (rawStatus === "PENDING" || rawStatus === "IN_ANALYSIS") {
        normalizedStatus = "pending";
      } else {
        // Sem campo de status: conta existe e tem walletId → está ativa
        const hasWallet = !!(accountData as any).walletId;
        const hasAccount = !!(accountData as any).accountNumber?.account;
        normalizedStatus = (hasWallet || hasAccount) ? "active" : "pending";
      }

      await dbConn.execute(sql`UPDATE tenants SET "asaasAccountStatus" = ${normalizedStatus}, "updatedAt" = NOW() WHERE id = ${barber.tenantId}`);
      res.redirect("/admin/configuracoes?tab=pagamentos&saved=1");
    } catch (e: any) {
      console.error('[asaas/sync] Erro ao sincronizar status:', e?.message ?? e);
      res.redirect("/admin/configuracoes?tab=pagamentos&error=" + encodeURIComponent('Erro ao verificar status: ' + (e?.message ?? 'Tente novamente')));
    }
  });

  // POST /admin/configuracoes/asaas/subscribe — Criar assinatura Barber Pro
  app.post("/admin/configuracoes/asaas/subscribe", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      if (!barber?.tenantId) { res.redirect("/admin/configuracoes?tab=pagamentos&error=Tenant+n%C3%A3o+encontrado"); return; }

      const dbConn = await db.getDb();
      if (!dbConn) { res.redirect("/admin/configuracoes?tab=pagamentos&error=Banco+de+dados+indispon%C3%ADvel"); return; }

      const tenantRows = await dbConn.execute(sql`SELECT * FROM tenants WHERE id = ${barber.tenantId} LIMIT 1`);
      const tenantData = ((tenantRows as any).rows as any[])[0];
      if (!tenantData) { res.redirect("/admin/configuracoes?tab=pagamentos&error=Tenant+n%C3%A3o+encontrado"); return; }

      // Verificar se já tem assinatura ativa
      if (tenantData.barberproSubscriptionStatus === 'active' && tenantData.barberproSubscriptionId) {
        res.redirect("/admin/configuracoes?tab=pagamentos&saved=1"); return;
      }

      // Garantir que o cliente existe na conta raiz do Asaas
      const cpfCnpjRaw = (tenantData.asaasCpfCnpj ?? tenantData.cnpj ?? '').replace(/\D/g, '');
      if (!cpfCnpjRaw || cpfCnpjRaw.length < 11) {
        res.redirect("/admin/configuracoes?tab=pagamentos&error=" + encodeURIComponent(
          "Para assinar, primeiro configure sua conta de pagamentos preenchendo CPF/CNPJ na seção abaixo."
        ));
        return;
      }
      // Validar dígitos verificadores do CPF/CNPJ
      const isCpfCnpjValid = (() => {
        const d = cpfCnpjRaw;
        if (d.length === 11) {
          if (/^(\d)\1{10}$/.test(d)) return false;
          let s = 0; for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
          let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
          if (r !== parseInt(d[9])) return false;
          s = 0; for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
          r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
          return r === parseInt(d[10]);
        }
        if (d.length === 14) {
          if (/^(\d)\1{13}$/.test(d)) return false;
          const calc = (str: string, w: number[]) => { let s = 0; for (let i = 0; i < w.length; i++) s += parseInt(str[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
          if (calc(d, [5,4,3,2,9,8,7,6,5,4,3,2]) !== parseInt(d[12])) return false;
          return calc(d, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(d[13]);
        }
        return false;
      })();
      if (!isCpfCnpjValid) {
        const cpfCnpjErrMsg = cpfCnpjRaw.length === 11
          ? 'CPF inválido. Verifique os dígitos na seção "Configurar Pagamentos Online" abaixo.'
          : 'CNPJ inválido. Verifique os dígitos na seção "Configurar Pagamentos Online" abaixo.';
        res.redirect("/admin/configuracoes?tab=pagamentos&error=" + encodeURIComponent(cpfCnpjErrMsg));
        return;
      }
      const asaasCustomerId = await ensureAsaasRootCustomer({
        name: tenantData.name ?? 'Barbearia',
        email: tenantData.email ?? `tenant${barber.tenantId}@barberpro.app`,
        cpfCnpj: cpfCnpjRaw,
        mobilePhone: (tenantData.asaasMobilePhone ?? tenantData.phone ?? '').replace(/\D/g, ''),
        tenantId: barber.tenantId,
      });

      // Plano selecionado pelo usuário no formulário (ou plano real do tenant como fallback)
      // Aceita tanto JSON (via fetch) quanto form-urlencoded (fallback)
      const isJson = req.headers['content-type']?.includes('application/json');
      const rawPlan = (req.body as any)?.selectedPlan;
      const selectedPlan: string = (Array.isArray(rawPlan) ? rawPlan[rawPlan.length - 1] : rawPlan) ?? tenantData.plan ?? 'solo';
      const rawBilling = ((req.body as any)?.billingType ?? 'PIX') as string;
      const allowedBillings = ['PIX', 'CREDIT_CARD', 'UNDEFINED'];
      const billingType: string = allowedBillings.includes(rawBilling) ? rawBilling : 'PIX';
      const planPriceMap: Record<string, number> = { solo: 49, team: 89, studio: 149 };
      const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };
      const planPrice = planPriceMap[selectedPlan] ?? 49;
      const planLabel = planLabelMap[selectedPlan] ?? selectedPlan;

      // Dados do cartão (presentes apenas quando billingType é CREDIT_CARD ou UNDEFINED)
      const body = req.body as any;
      const hasCard = billingType === 'CREDIT_CARD' || billingType === 'UNDEFINED';
      const creditCardData = hasCard ? {
        holderName: (body.cardHolder ?? '').trim(),
        number: (body.cardNumber ?? '').replace(/\D/g, ''),
        expiryMonth: (body.cardExpiryMonth ?? '').trim(),
        expiryYear: (body.cardExpiryYear ?? '').trim(),
        ccv: (body.cardCvv ?? '').trim(),
      } : undefined;
      // Validar CPF do titular do cartão
      if (hasCard) {
        const cardCpfDigits = (body.cardCpf ?? '').replace(/\D/g, '');
        if (cardCpfDigits.length === 11) {
          const isCardCpfValid = (() => {
            const d = cardCpfDigits;
            if (/^(\d)\1{10}$/.test(d)) return false;
            let s = 0; for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
            let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
            if (r !== parseInt(d[9])) return false;
            s = 0; for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
            r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
            return r === parseInt(d[10]);
          })();
          if (!isCardCpfValid) {
            if (isJson) { res.status(400).json({ error: 'CPF do titular do cartão inválido. Verifique os dígitos.' }); return; }
            res.redirect('/admin/configuracoes?tab=pagamentos&error=' + encodeURIComponent('CPF do titular do cartão inválido. Verifique os dígitos.'));
            return;
          }
        }
      }
      const creditCardHolderInfo = hasCard ? {
        name: (body.cardHolder ?? tenantData.name ?? '').trim(),
        email: tenantData.email ?? `tenant${barber.tenantId}@barberpro.app`,
        cpfCnpj: (body.cardCpf ?? cpfCnpjRaw).replace(/\D/g, ''),
        postalCode: (body.cardCep ?? '').replace(/\D/g, ''),
        addressNumber: (body.cardAddrNum ?? '').trim(),
        phone: (tenantData.asaasMobilePhone ?? tenantData.phone ?? '').replace(/\D/g, ''),
      } : undefined;
      // IP do cliente (enviado pelo fetch do frontend via JSON ou header)
      const remoteIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        ?? req.socket.remoteAddress
        ?? '127.0.0.1';

      // Criar assinatura recorrente mensal
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const nextDue = nextMonth.toISOString().slice(0, 10);

      const subscriptionId = await createAsaasSubscription({
        customer: asaasCustomerId,
        billingType: billingType as 'PIX' | 'CREDIT_CARD' | 'UNDEFINED',
        value: planPrice,
        nextDueDate: nextDue,
        cycle: 'MONTHLY',
        description: `Barber Pro — Plano ${planLabel} (R$ ${planPrice}/mês)`,
        externalReference: `tenant_${barber.tenantId}`,
        ...(creditCardData ? { creditCard: creditCardData } : {}),
        ...(creditCardHolderInfo ? { creditCardHolderInfo } : {}),
        ...(hasCard ? { remoteIp } : {}),
      });

      // Atualizar o plano real do tenant também (para manter consistência)
      // Nota: usamos sql.raw para o cast do enum tenant_plan para evitar parâmetros duplicados
      await dbConn.execute(sql`
        UPDATE tenants SET
          plan = ${sql.raw(selectedPlan)}::tenant_plan,
          "barberproSubscriptionId" = ${subscriptionId},
          "barberproSubscriptionStatus" = 'pending',
          "barberproPlanName" = ${selectedPlan},
          "barberproPlanPrice" = ${planPrice},
          "barberproNextDueDate" = ${nextDue},
          "updatedAt" = NOW()
        WHERE id = ${barber.tenantId}
      `);

      // Enviar e-mail de boas-vindas / confirmação de assinatura
      try {
        const adminBarber = await db.getBarberById(session.barberId);
        if (tenantData.email || adminBarber?.email) {
          const { sendEmail } = await import("../email");
          const recipientEmail = tenantData.email ?? adminBarber?.email;
          const recipientName = adminBarber?.name ?? tenantData.name ?? 'Admin';
          const planLabelFull = planLabelMap[selectedPlan] ?? selectedPlan;
          await sendEmail({
            to: recipientEmail,
            subject: `🎉 Assinatura Barber Pro criada — Plano ${planLabelFull}`,
            html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#1a1a1a,#0A0A0A);padding:32px;text-align:center;border-bottom:1px solid #222">
      <div style="font-size:28px;font-weight:900;color:#C9A84C;letter-spacing:-1px">✂️ BARBER PRO</div>
      <div style="font-size:13px;color:#666;margin-top:4px">Sistema Completo de Barbearia</div>
    </div>
    <div style="padding:32px">
      <div style="background:#C9A84C18;border:1.5px solid #C9A84C44;border-radius:12px;padding:16px 20px;margin-bottom:24px;text-align:center">
        <div style="font-size:24px;margin-bottom:8px">🎉</div>
        <div style="font-size:16px;font-weight:800;color:#C9A84C">Assinatura criada com sucesso!</div>
        <div style="font-size:13px;color:#888;margin-top:4px">Plano ${planLabelFull} — R$ ${planPrice}/mês</div>
      </div>
      <p style="color:#ECEDEE;font-size:15px;line-height:1.6;margin:0 0 16px">Olá, <strong style="color:#C9A84C">${recipientName}</strong>!</p>
      <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 20px">
        Sua assinatura do <strong style="color:#ECEDEE">Barber Pro — Plano ${planLabelFull}</strong> foi criada.
        Agora é só efetuar o pagamento via Pix para ativar o acesso completo.
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:12px;color:#666;margin-bottom:8px">RESUMO DA ASSINATURA</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#9BA1A6;font-size:13px">Plano</span>
          <span style="color:#ECEDEE;font-weight:700;font-size:13px">${planLabelFull}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#9BA1A6;font-size:13px">Valor mensal</span>
          <span style="color:#C9A84C;font-weight:700;font-size:13px">R$ ${planPrice},00</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:#9BA1A6;font-size:13px">Forma de pagamento</span>
          <span style="color:#ECEDEE;font-weight:700;font-size:13px">Pix (mensal)</span>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="https://usebarberpro.com/admin/configuracoes?tab=pagamentos"
           style="display:inline-block;background:#C9A84C;color:#000;font-weight:800;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none">
          PAGAR VIA PIX →
        </a>
      </div>
      <p style="color:#555;font-size:12px;text-align:center;margin:0">Após a confirmação do pagamento, o acesso será ativado automaticamente.</p>
    </div>
    <div style="background:#0A0A0A;padding:20px;text-align:center;border-top:1px solid #1a1a1a">
      <div style="font-size:11px;color:#444">Barber Pro — <a href="https://usebarberpro.com" style="color:#C9A84C;text-decoration:none">usebarberpro.com</a></div>
    </div>
  </div>
</body></html>`,
          }).catch((emailErr: any) => console.error('[asaas/subscribe] Erro ao enviar e-mail de boas-vindas:', emailErr.message));
        }
      } catch (emailErr: any) {
        console.error('[asaas/subscribe] Erro ao buscar dados para e-mail:', emailErr.message);
      }

      // Buscar o primeiro pagamento da assinatura para redirecionar para o link de pagamento
      try {
        const paymentsRes = await asaasApi.get(`/subscriptions/${subscriptionId}/payments?limit=1`);
        const firstPayment = paymentsRes.data?.data?.[0];
        if (firstPayment?.invoiceUrl) {
          // Para cartão de crédito/débito aprovado na criação, não há invoice a pagar
          if (hasCard && firstPayment.status === 'CONFIRMED') {
            if (isJson) { res.json({ redirect: '/admin/configuracoes?tab=pagamentos&saved=1' }); return; }
            res.redirect('/admin/configuracoes?tab=pagamentos&saved=1'); return;
          }
          if (isJson) { res.json({ redirect: firstPayment.invoiceUrl }); return; }
          res.redirect(firstPayment.invoiceUrl);
          return;
        }
      } catch (payErr) {
        console.error('[asaas/subscribe] Erro ao buscar pagamento:', (payErr as any).message);
      }

      if (isJson) { res.json({ redirect: '/admin/configuracoes?tab=pagamentos&saved=1' }); return; }
      res.redirect("/admin/configuracoes?tab=pagamentos&saved=1");
    } catch (e: any) {
      console.error('[asaas/subscribe]', e.message);
      if ((req.headers['content-type'] ?? '').includes('application/json')) {
        res.status(400).json({ error: e.message });
      } else {
        res.redirect(`/admin/configuracoes?tab=pagamentos&error=${encodeURIComponent(e.message)}`);
      }
    }
  });

  // POST /admin/configuracoes/asaas/cancel-subscription — Cancelar assinatura Barber Pro
  app.post("/admin/configuracoes/asaas/cancel-subscription", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      if (!barber?.tenantId) { res.redirect("/admin/configuracoes?tab=pagamentos"); return; }

      const dbConn = await db.getDb();
      if (!dbConn) { res.redirect("/admin/configuracoes?tab=pagamentos"); return; }

      const rows = await dbConn.execute(sql`SELECT "barberproSubscriptionId" FROM tenants WHERE id = ${barber.tenantId} LIMIT 1`);
      const t = ((rows as any).rows as any[])[0];
      if (t?.barberproSubscriptionId) {
        await cancelAsaasSubscription(t.barberproSubscriptionId);
      }

      await dbConn.execute(sql`
        UPDATE tenants SET
          "barberproSubscriptionStatus" = 'cancelled',
          "updatedAt" = NOW()
        WHERE id = ${barber.tenantId}
      `);

      res.redirect("/admin/configuracoes?tab=pagamentos&saved=1");
    } catch (e: any) {
      console.error('[asaas/cancel-subscription]', e.message);
      res.redirect("/admin/configuracoes?tab=pagamentos");
    }
  });

  // POST /admin/configuracoes/asaas/upgrade-plan — Alterar plano da assinatura Barber Pro
  app.post("/admin/configuracoes/asaas/upgrade-plan", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      if (!barber?.tenantId) { res.redirect("/admin/configuracoes?tab=pagamentos"); return; }

      const newPlan = (req.body as any)?.newPlan ?? 'solo';
      const planPriceMap: Record<string, number> = { solo: 49, team: 89, studio: 149 };
      const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };
      const newPrice = planPriceMap[newPlan] ?? 49;
      const newLabel = planLabelMap[newPlan] ?? newPlan;

      const dbConn = await db.getDb();
      if (!dbConn) { res.redirect("/admin/configuracoes?tab=pagamentos"); return; }

      // Buscar dados do tenant
      const tenantRows = await dbConn.execute(sql`
        SELECT "barberproSubscriptionId", "barberproAsaasCustomerId", "asaasAccountId",
               "asaasMobilePhone", phone, name, cnpj
        FROM tenants WHERE id = ${barber.tenantId} LIMIT 1
      `);
      const tenantData = ((tenantRows as any).rows as any[])[0];
      if (!tenantData) { res.redirect("/admin/configuracoes?tab=pagamentos"); return; }

      // 1. Cancelar assinatura atual no Asaas (se existir)
      if (tenantData.barberproSubscriptionId) {
        try {
          await cancelAsaasSubscription(tenantData.barberproSubscriptionId);
        } catch (cancelErr: any) {
          console.warn('[asaas/upgrade-plan] Erro ao cancelar assinatura antiga:', cancelErr.message);
        }
      }

      // 2. Garantir que o customer Asaas existe
      const asaasCustomerId = await ensureAsaasCustomer({
        name: (await db.getBarberById(session.barberId) as any)?.name ?? tenantData.name,
        cpfCnpj: tenantData.cnpj ?? '',
        mobilePhone: (tenantData.asaasMobilePhone ?? tenantData.phone ?? '').replace(/\D/g, ''),
        tenantId: barber.tenantId,
      });

      // 3. Criar nova assinatura com o plano selecionado
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const nextDue = nextMonth.toISOString().slice(0, 10);

      const newSubId = await createAsaasSubscription({
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: newPrice,
        nextDueDate: nextDue,
        cycle: 'MONTHLY',
        description: `Barber Pro — Plano ${newLabel} (R$ ${newPrice}/mês)`,
        externalReference: `tenant_${barber.tenantId}`,
      });

      // 4. Atualizar o banco com o novo plano
      await dbConn.execute(sql`
        UPDATE tenants SET
          plan = ${sql.raw(newPlan)}::tenant_plan,
          "barberproSubscriptionId" = ${newSubId},
          "barberproSubscriptionStatus" = 'pending',
          "barberproPlanName" = ${newPlan},
          "barberproPlanPrice" = ${newPrice},
          "barberproNextDueDate" = ${nextDue},
          "updatedAt" = NOW()
        WHERE id = ${barber.tenantId}
      `);

      // 5. Redirecionar para o link de pagamento Pix da nova assinatura
      try {
        const paymentsRes = await asaasApi.get(`/subscriptions/${newSubId}/payments?limit=1`);
        const firstPayment = paymentsRes.data?.data?.[0];
        if (firstPayment?.invoiceUrl) {
          res.redirect(firstPayment.invoiceUrl);
          return;
        }
        if (firstPayment?.id) {
          const pixRes = await asaasApi.get(`/payments/${firstPayment.id}/pixQrCode`);
          if (pixRes.data?.payload) {
            res.redirect(`/admin/configuracoes?tab=pagamentos&pix=${encodeURIComponent(pixRes.data.payload)}&saved=1`);
            return;
          }
        }
      } catch (payErr: any) {
        console.warn('[asaas/upgrade-plan] Erro ao buscar link de pagamento:', payErr.message);
      }

      res.redirect("/admin/configuracoes?tab=pagamentos&saved=1");
    } catch (e: any) {
      console.error('[asaas/upgrade-plan]', e.message);
      res.redirect(`/admin/configuracoes?tab=pagamentos&error=${encodeURIComponent(e.message)}`);
    }
  });

  // Criar agendamento (admin web)
  app.get("/admin/agenda/novo", requireAdminAuth, withErrorPage("Novo Agendamento", "agenda", renderNovoAgendamento));
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
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const tenantId = barber?.tenantId ?? null;
      const { id, status } = req.body as { id: number; status: string };
      const validStatuses = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
      if (!id || !validStatuses.includes(status)) {
        res.status(400).json({ error: "Parâmetros inválidos" });
        return;
      }
      // Verificar se o agendamento pertence ao tenant correto
      if (tenantId != null) {
        const appt = await db.getAppointmentById(id);
        const apptBarber = appt ? await db.getBarberById(appt.barberId) : null;
        if (!apptBarber || apptBarber.tenantId !== tenantId) {
          res.status(403).json({ error: "Acesso negado" });
          return;
        }
      }
      await db.updateAppointmentStatus(id, status);
      // Se confirmando, retornar dados do cliente para WhatsApp de confirmação
      let whatsappData: Record<string, any> | null = null;
      if (status === "confirmed") {
        try {
          const appt = await db.getAppointmentById(id);
          if (appt?.clientId) {
            const client = await db.getClientById(appt.clientId);
            const svc = appt.serviceId ? await db.getServiceById(appt.serviceId) : null;
            const apptBarber = appt.barberId ? await db.getBarberById(appt.barberId) : null;
            if (client?.phone) {
              const phone = client.phone.replace(/\D/g, "");
              const dateFormatted = appt.date.split("-").reverse().join("/");
              const msg = encodeURIComponent(`Ol\u00e1 ${client.name}! \u2705 Seu agendamento foi *confirmado*!\n\n\u2702\ufe0f *Servi\u00e7o:* ${svc?.name ?? "Servi\u00e7o"}\n\ud83d\udc64 *Profissional:* ${apptBarber?.name ?? "Profissional"}\n\ud83d\udcc5 *Data:* ${dateFormatted}\n\ud83d\udd50 *Hor\u00e1rio:* ${appt.startTime}\n\nTe esperamos! \ud83d\ude0a`);
              whatsappData = { phone, waLink: `https://wa.me/55${phone}?text=${msg}`, clientName: client.name };
            }
          }
        } catch {}
      }
      res.json({ ok: true, whatsapp: whatsappData });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // POST /admin-api/appointment-edit — Editar agendamento (data, horário, serviço, barbeiro, status)
  app.post("/admin-api/appointment-edit", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const tenantId = barber?.tenantId ?? null;
      const { id, serviceId, barberId: bId, date, startTime, status, notes } = req.body as {
        id: number; serviceId: number; barberId: number; date: string;
        startTime: string; status: "scheduled"|"confirmed"|"in_progress"|"completed"|"cancelled"|"no_show"|"pending_approval"; notes?: string;
      };
      if (!id || !serviceId || !bId || !date || !startTime) {
        res.status(400).json({ error: "Preencha todos os campos obrigatórios" }); return;
      }
      // Verificar se o agendamento pertence ao tenant
      if (tenantId != null) {
        const appt = await db.getAppointmentById(id);
        const apptBarber = appt ? await db.getBarberById(appt.barberId) : null;
        if (!apptBarber || apptBarber.tenantId !== tenantId) {
          res.status(403).json({ error: "Acesso negado" }); return;
        }
      }
      // Calcular endTime baseado na duração do serviço
      const svc = await db.getServiceById(serviceId);
      const duration = svc?.durationMinutes ?? 30;
      const [h, m] = startTime.split(":").map(Number);
      const endTotal = h * 60 + m + duration;
      const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
      await db.updateAppointment(id, {
        serviceId: Number(serviceId),
        barberId: Number(bId),
        date,
        startTime,
        endTime,
        status,
        notes: notes ?? "",
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Middleware global de verificação de assinatura ativa para todas as rotas /admin (exceto configurações e login)
  app.use("/admin", requireAdminAuth, requireActiveSubscription);

  // Rotas protegidas
  app.get("/admin", requireAdminAuth, withErrorPage("Dashboard", "dashboard", renderDashboard));
  app.get("/admin/agenda", requireAdminAuth, withErrorPage("Agenda", "agenda", renderAgenda));
  app.get("/admin/clientes", requireAdminAuth, withErrorPage("Clientes", "clientes", renderClientes));

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

  app.get("/admin/servicos", requireAdminAuth, withErrorPage("Serviços", "servicos", renderServicos));
  app.get("/admin/financeiro", requireAdminAuth, withErrorPage("Financeiro", "financeiro", renderFinanceiro));

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

  app.get("/admin/configuracoes", requireAdminAuth, withErrorPage("Configurações", "configuracoes", renderConfiguracoes));
  app.get("/admin/relatorios", requireAdminAuth, withErrorPage("Relatórios", "relatorios", renderRelatorios));
  app.get("/admin/pagina-cliente", requireAdminAuth, withErrorPage("Página do Cliente", "pagina-cliente", renderPaginaCliente));

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
      const {
        primaryColor, backgroundColor, fontStyle,
        logoUrl: logoUrlRaw, bannerUrl: bannerUrlRaw, galleryUrls: galleryUrlsRaw,
        logoBase64, logoMime,
        bannerBase64, bannerMime,
        galleryBase64List, galleryMimeList,
      } = req.body ?? {};

      const { storagePut } = await import("./storage");
      const tenantId = barber?.tenantId;

      // Upload do logo
      let finalLogoUrl = logoUrlRaw || null;
      if (logoBase64 && logoMime) {
        try {
          const buf = Buffer.from(logoBase64, "base64");
          const ext = logoMime.includes("png") ? "png" : logoMime.includes("webp") ? "webp" : "jpg";
          const key = `shop/${tenantId ?? 0}/logo-${Date.now()}.${ext}`;
          const { url } = await storagePut(key, buf, logoMime);
          finalLogoUrl = url;
        } catch (e) { console.error("Erro upload logo:", e); }
      }

      // Upload do banner
      let finalBannerUrl = bannerUrlRaw || null;
      if (bannerBase64 && bannerMime) {
        try {
          const buf = Buffer.from(bannerBase64, "base64");
          const ext = bannerMime.includes("png") ? "png" : bannerMime.includes("webp") ? "webp" : "jpg";
          const key = `shop/${tenantId ?? 0}/banner-${Date.now()}.${ext}`;
          const { url } = await storagePut(key, buf, bannerMime);
          finalBannerUrl = url;
        } catch (e) { console.error("Erro upload banner:", e); }
      }

      // Upload das fotos novas da galeria
      let finalGalleryUrls = galleryUrlsRaw || "";
      if (galleryBase64List && galleryMimeList) {
        const base64Arr = galleryBase64List.split("||").filter(Boolean);
        const mimeArr = galleryMimeList.split("||").filter(Boolean);
        const newUrls: string[] = [];
        for (let i = 0; i < base64Arr.length; i++) {
          try {
            const buf = Buffer.from(base64Arr[i], "base64");
            const mime = mimeArr[i] || "image/jpeg";
            const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
            const key = `shop/${tenantId ?? 0}/gallery-${Date.now()}-${i}.${ext}`;
            const { url } = await storagePut(key, buf, mime);
            newUrls.push(url);
          } catch (e) { console.error("Erro upload galeria:", e); }
        }
        if (newUrls.length > 0) {
          const existing = (finalGalleryUrls || "").split("\n").map((u: string) => u.trim()).filter(Boolean);
          finalGalleryUrls = [...existing, ...newUrls].join("\n");
        }
      }

      // Converter galleryUrls para formato JSON (compatível com APP)
      let finalGalleryJson: string | null = null;
      if (finalGalleryUrls) {
        const urls = finalGalleryUrls.split('\n').map((u: string) => u.trim()).filter(Boolean);
        finalGalleryJson = urls.length > 0 ? JSON.stringify(urls) : null;
      }

      await db.upsertShopSettings({
        primaryColor: primaryColor || null,
        backgroundColor: backgroundColor || null,
        fontStyle: fontStyle || "moderno",
        logoUrl: finalLogoUrl,
        bannerUrl: finalBannerUrl,
        galleryUrls: finalGalleryJson,
      } as any, tenantId);

      res.redirect("/admin/pagina-cliente?saved=1");
    } catch (e: any) {
      console.error("Erro ao salvar visual:", e);
      res.redirect("/admin/pagina-cliente");
    }
  });

  // POST /admin/pagina-cliente/dominio — Salvar domínio customizado
  app.post("/admin/pagina-cliente/dominio", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const { customDomain } = req.body ?? {};
      await db.upsertShopSettings({ customDomain: customDomain || null }, barber?.tenantId);
      res.redirect("/admin/pagina-cliente");
    } catch (e: any) {
      res.redirect("/admin/pagina-cliente");
    }
  });

  // POST /admin/pagina-cliente/rastreamento — Salvar GA4 e Pixel
  app.post("/admin/pagina-cliente/rastreamento", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const { ga4MeasurementId, facebookPixelId } = req.body ?? {};
      await db.upsertShopSettings({ ga4MeasurementId: ga4MeasurementId || null, facebookPixelId: facebookPixelId || null }, barber?.tenantId);
      res.redirect("/admin/pagina-cliente?trackingsaved=1");
    } catch (e: any) {
      res.redirect("/admin/pagina-cliente");
    }
  });

   // POST /admin/pagina-cliente/seo — Salvar configurações de SEO
  app.post("/admin/pagina-cliente/seo", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const { seoTitle, seoDescription, seoImageUrl, seoImageBase64, seoImageMime } = req.body ?? {};

      // Upload da imagem de compartilhamento se fornecida
      let finalSeoImageUrl = seoImageUrl?.trim() || null;
      if (seoImageBase64 && seoImageMime) {
        try {
          const { storagePut } = await import("./storage");
          const buf = Buffer.from(seoImageBase64, "base64");
          const ext = seoImageMime.includes("png") ? "png" : seoImageMime.includes("webp") ? "webp" : "jpg";
          const key = `shop/${barber?.tenantId ?? 0}/seo-image-${Date.now()}.${ext}`;
          const { url } = await storagePut(key, buf, seoImageMime);
          finalSeoImageUrl = url;
        } catch (e) { console.error("Erro upload seo image:", e); }
      }

      await db.upsertShopSettings({
        seoTitle: seoTitle?.trim() || null,
        seoDescription: seoDescription?.trim() || null,
        seoImageUrl: finalSeoImageUrl,
      }, barber?.tenantId);
      res.redirect("/admin/pagina-cliente?seosaved=1");
    } catch (e: any) {
      console.error("Erro ao salvar SEO:", e);
      res.redirect("/admin/pagina-cliente");
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
    const { name, description, price, productType, stockQuantity, minStockAlert, isActive, mediaBase64, mediaMime, supplierId } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    const supplierIdNum = supplierId ? parseInt(supplierId) : null;
    let productId: number;
    if (editId) {
      await db.updateProduct(editId, { name, description, price, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true", supplierId: supplierIdNum } as any);
      productId = editId;
    } else {
      const newProduct = await db.createProduct({ name, description, price, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true", supplierId: supplierIdNum } as any);
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

  app.get("/admin/clientes/:id", requireAdminAuth, withErrorPage("Detalhe do Cliente", "clientes", renderClienteDetalhe));

  // ─── Fidelidade ────────────────────────────────────────────────────────────
  app.get("/admin/fidelidade", requireAdminAuth, withErrorPage("Fidelidade", "fidelidade", async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const activeTab = (req.query.tab as string) || "programa";
    const tenantId = barber?.tenantId ?? null;
    const [config, rewards, allCoupons] = await Promise.all([
      db.getLoyaltyConfig(tenantId),
      db.getLoyaltyRewards(tenantId),
      db.getAllCoupons(tenantId),
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
      { id: "recompensas", label: "Recompensas" },
      { id: "cupons", label: "Cupons" },
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
          <span class="card-title">Recompensas</span>
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
        <button onclick="document.getElementById('new-coupon-form').style.display='block';this.style.display='none'" class="btn btn-primary"> Novo Cupão</button>
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
        <div class="card-header"><span class="card-title">Todos os Cupons</span><span style="color:var(--muted);font-size:12px">${allCoupons.length} cupons</span></div>
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
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">Salvo com sucesso!</div>` : ""}
      ${tabNav}
      ${activeTab === "programa" ? tabPrograma : activeTab === "recompensas" ? tabRecompensas : tabCupons}
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Fidelidade", "fidelidade", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Fidelidade",href:"/admin/fidelidade"}]));
  }));

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
  app.get("/admin/cupons", requireAdminAuth, withErrorPage("Cupons", "cupons", async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const tenantId = barber?.tenantId ?? null;
    const allCoupons = await db.getAllCoupons(tenantId);
    const saved = req.query.saved === "1";
    const body = `
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE80;border-radius:10px;padding:12px 18px;margin-bottom:20px;color:#4ADE80;font-size:13px;">Salvo com sucesso.</div>` : ""}
      <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
        <button onclick="document.getElementById('new-coupon-form').style.display='block';this.style.display='none';" class="btn btn-primary"> Novo Cupão</button>
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
        <div class="card-header"><span class="card-title">Todos os Cupons</span><span style="color:var(--muted);font-size:12px;">${allCoupons.length} cupons</span></div>
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
  res.send(adminLayout("Cupons", "cupons", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Fidelidade",href:"/admin/fidelidade"},{label:"Cupons",href:"/admin/cupons"}]));
  }));

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
  app.get("/admin/avaliacoes", requireAdminAuth, withErrorPage("Avaliações", "avaliacoes", async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const tenantId = barber?.tenantId ?? null;
    const recentReviews = await db.getRecentReviews(100, tenantId);
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
          <div class="card-header"><span class="card-title">Avaliações Recentes</span></div>
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
  res.send(adminLayout("Avaliações", "avaliacoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Avaliações",href:"/admin/avaliacoes"}]));
  }));

  // ─── Comissões ────────────────────────────────────────────────────────────
  app.get("/admin/comissoes", requireAdminAuth, withErrorPage("Comissões", "comissoes", async (req: Request, res: Response) => {
    const barber = await db.getBarberById((req as any).adminSession.barberId);
    const tenantId = barber?.tenantId ?? null;
    const configs = await db.listCommissionConfigs(tenantId);
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

    const summaryAll = await db.getCommissionSummary(start, end, barber?.tenantId);
    const summary = filterBarberId ? summaryAll.filter((s: any) => s.barberId === filterBarberId) : summaryAll;
    const totalCommission = summary.reduce((s: number, b: any) => s + b.totalCommission, 0);
    const totalGross = summary.reduce((s: number, b: any) => s + b.totalGross, 0);

    const periodOptions = [
      { v: "month", l: "Este mês" }, { v: "week", l: "Últimos 7 dias" }, { v: "90", l: "Últimos 90 dias" },
    ].map(o => `<option value="${o.v}" ${period === o.v ? "selected" : ""}>${o.l}</option>`).join("");

    const barberOptions = [`<option value="">Todos os funcionários</option>`,
      ...allBarbers.map((b: any) => `<option value="${b.id}" ${filterBarberId === b.id ? "selected" : ""}>${esc(b.name)}</option>`)].join("");

    const body = `
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Comissões atualizadas.</div>` : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <h2 style="font-size:20px;font-weight:700;margin:0">Comissões</h2>
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
          <div class="card-header"><span class="card-title">Taxas de Comissão</span></div>
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
            <span class="card-title">Resumo por Funcionário</span>
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
  res.send(adminLayout("Comissões", "comissoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Comissões",href:"/admin/comissoes"}]));
  }));

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
  app.get("/admin/lista-espera", requireAdminAuth, withErrorPage("Lista de Espera", "lista-espera", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const dateParam = (req.query.date as string) || today();
    const tenantId = barber?.tenantId ?? null;
    const entries = await db.listWaitlistByDate(dateParam, barber?.tenantId);
    const allClients = await db.getAllClients(tenantId);
    const allBarbers = await db.getAllBarbers(tenantId);
    const allServices = await db.getAllServices(true, tenantId);
    const saved = req.query.saved === "1";
    const removed = req.query.removed === "1";
    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h1 style="font-size:24px;font-weight:700;color:var(--text);">Lista de Espera</h1>
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
  res.send(adminLayout("Lista de Espera", "lista-espera", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Lista de Espera",href:"/admin/lista-espera"}]));
  }));

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

  // ─── Assinaturas ────────────────────────────────────────────────────────────
  app.get("/admin/assinaturas", requireAdminAuth, withErrorPage("Assinaturas", "assinaturas", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const allRecurring = await db.getAllRecurringAppointments(tenantId);
    const cancelledList = await db.getCancelledRecurringAppointments(tenantId);
    const stats = await db.getSubscriptionStats(tenantId);
    const allClients = await db.getAllClients(tenantId);
    const allBarbers = await db.getAllBarbers(tenantId);
    const allServices = await db.getAllServices(true, tenantId);
    const cancelledMsg = req.query.cancelled === "1";
    const created = req.query.created === "1";
    const viewTab = (req.query.tab as string) || "active";
    const searchQ = ((req.query.q as string) || "").toLowerCase();
    const filtered = searchQ
      ? allRecurring.filter((r: any) =>
          (r.clientName || "").toLowerCase().includes(searchQ) ||
          (r.serviceName || "").toLowerCase().includes(searchQ) ||
          (r.barberName || "").toLowerCase().includes(searchQ))
      : allRecurring;
    const filteredCancelled = searchQ
      ? cancelledList.filter((r: any) =>
          (r.clientName || "").toLowerCase().includes(searchQ) ||
          (r.serviceName || "").toLowerCase().includes(searchQ) ||
          (r.barberName || "").toLowerCase().includes(searchQ))
      : cancelledList;
    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h1 style="font-size:24px;font-weight:700;color:var(--text);">Assinaturas</h1>
          <p style="color:var(--muted);font-size:14px;margin-top:4px;">Clientes com agendamentos periódicos configurados</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <a href="/admin/planos" class="btn btn-ghost" style="border:1px solid var(--gold);color:var(--gold);display:flex;align-items:center;gap:6px;padding:8px 16px;font-size:13px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Planos
          </a>
          <button onclick="document.getElementById('newRecModal').style.display='flex'" class="btn btn-primary">+ Nova Assinatura</button>
        </div>
      </div>
      ${cancelledMsg ? '<div class="alert alert-success">Assinatura cancelada com sucesso.</div>' : ""}
      ${created ? '<div class="alert alert-success">Assinatura criada! Agendamentos gerados automaticamente.</div>' : ""}

      <!-- Dashboard de métricas -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:900;color:var(--gold);">${stats.totalActive}</div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Ativas</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:900;color:#22C55E;">R$ ${stats.estimatedMRR.toFixed(0)}</div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">MRR</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:900;color:var(--error);">${stats.totalCancelled}</div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Canceladas</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:900;color:#F59E0B;">${stats.cancelRate}%</div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Churn</div>
        </div>
      </div>

      <!-- Tabs: Ativas / Encerradas -->
      <div style="display:flex;gap:0;margin-bottom:16px;background:var(--surface);border-radius:12px;border:1px solid var(--border);overflow:hidden;">
        <a href="/admin/assinaturas?tab=active${searchQ ? '&q=' + encodeURIComponent(searchQ) : ''}" style="flex:1;padding:10px;text-align:center;font-size:13px;font-weight:700;text-decoration:none;transition:all .2s;${viewTab === 'active' ? 'background:var(--gold);color:#0A0A0A;' : 'color:var(--muted);'}">
          Ativas (${stats.totalActive})
        </a>
        <a href="/admin/assinaturas?tab=cancelled${searchQ ? '&q=' + encodeURIComponent(searchQ) : ''}" style="flex:1;padding:10px;text-align:center;font-size:13px;font-weight:700;text-decoration:none;transition:all .2s;${viewTab === 'cancelled' ? 'background:var(--gold);color:#0A0A0A;' : 'color:var(--muted);'}">
          Encerradas (${stats.totalCancelled})
        </a>
      </div>

      ${(viewTab === 'active' ? allRecurring : cancelledList).length > 3 ? `
      <div style="margin-bottom:16px;">
        <form method="GET" action="/admin/assinaturas" style="display:flex;gap:8px;align-items:center;">
          <input type="hidden" name="tab" value="${esc(viewTab)}" />
          <div style="flex:1;position:relative;">
            <input type="text" name="q" value="${esc(searchQ)}" placeholder="Buscar por cliente, serviço ou barbeiro..."
              class="form-input" style="padding-left:36px;" />
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);">&#128269;</span>
          </div>
          <button type="submit" class="btn btn-primary" style="padding:8px 16px;">Buscar</button>
          ${searchQ ? '<a href="/admin/assinaturas?tab=' + esc(viewTab) + '" class="btn" style="padding:8px 16px;">Limpar</a>' : ""}
        </form>
      </div>
      ` : ""}

      ${viewTab === 'cancelled' ? `
      <!-- Lista de encerradas -->
      <div class="card">
        <table>
          <thead><tr><th>Cliente</th><th>Barbeiro</th><th>Serviço</th><th>Intervalo</th><th>Ocorrências</th><th>Cancelada em</th><th>Motivo</th></tr></thead>
          <tbody>
            ${filteredCancelled.length === 0 ? '<tr><td colspan="7" class="empty">Nenhuma assinatura encerrada.</td></tr>' : filteredCancelled.map((r: any) => {
              const cancelDate = r.cancelledAt ? new Date(r.cancelledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
              return `
              <tr>
                <td><strong>${esc(r.clientName)}</strong></td>
                <td>${esc(r.barberName)}</td>
                <td>${esc(r.serviceName)}</td>
                <td>A cada ${r.intervalWeeks} semana(s)</td>
                <td>${r.occurrences}x</td>
                <td style="color:var(--error);font-weight:600;">${cancelDate}</td>
                <td style="max-width:200px;">${r.cancelReason ? esc(r.cancelReason) : '<span style="color:var(--muted);">—</span>'}</td>
              </tr>
            `}).join("")}
          </tbody>
        </table>
      </div>
      ` : `
      <!-- Lista de ativas -->
      <div class="card">
        <table>
          <thead><tr><th>Cliente</th><th>Barbeiro</th><th>Serviço</th><th>Início</th><th>Horário</th><th>Intervalo</th><th>Ocorrências</th><th>Ações</th></tr></thead>
          <tbody>
            ${filtered.length === 0 ? '<tr><td colspan="8" class="empty">Nenhuma assinatura encontrada.</td></tr>' : filtered.map((r: any) => `
              <tr>
                <td><strong>${esc(r.clientName)}</strong></td>
                <td>${esc(r.barberName)}</td>
                <td>${esc(r.serviceName)}</td>
                <td>${fmtDate(r.startDate)}</td>
                <td>${r.startTime?.toString().slice(0,5) ?? "—"}</td>
                <td>A cada ${r.intervalWeeks} semana(s)</td>
                <td>${r.occurrences}x</td>
                <td>
                  <button class="btn btn-sm" style="background:var(--error);color:#fff;border:none;" onclick="openCancelModal(${r.id}, '${esc(r.clientName).replace(/'/g, "\\'")}')">Cancelar</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      `}

      <!-- Modal de Cancelamento com Motivo -->
      <div id="cancelModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:16px;padding:28px;width:480px;max-width:90vw;border:1px solid var(--border);">
          <h2 style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px;">Cancelar Assinatura</h2>
          <p style="font-size:13px;color:var(--muted);margin-bottom:16px;">Cancelar a assinatura de <strong id="cancelClientName" style="color:var(--text);"></strong>? Os agendamentos já criados não serão removidos.</p>
          <form method="POST" action="/admin/assinaturas/cancelar" id="cancelForm">
            <input type="hidden" name="id" id="cancelId" />
            <div class="form-group">
              <label class="form-label" style="text-transform:uppercase;letter-spacing:0.8px;font-size:11px;">Motivo (opcional)</label>
              <textarea name="reason" class="form-input" rows="3" placeholder="Ex: Cliente solicitou cancelamento, mudou de horário..." style="resize:vertical;"></textarea>
            </div>
            <div style="display:flex;gap:12px;margin-top:16px;">
              <button type="button" onclick="document.getElementById('cancelModal').style.display='none'" class="btn" style="flex:1;">Voltar</button>
              <button type="submit" class="btn" style="flex:2;background:var(--error);color:#fff;border:none;font-weight:700;">Cancelar Assinatura</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Nova Assinatura -->
      <div id="newRecModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:16px;padding:28px;width:560px;max-width:90vw;max-height:90vh;overflow-y:auto;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="font-size:18px;font-weight:700;color:var(--text);">Nova Assinatura</h2>
            <button onclick="document.getElementById('newRecModal').style.display='none'" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;">&#10005;</button>
          </div>
          <form method="POST" action="/admin/assinaturas" id="recForm">
            <div class="form-group">
              <label class="form-label">Cliente *</label>
              <div class="custom-select-wrapper" id="csw-client">
                <input type="hidden" name="clientId" id="cs-client-val" required />
                <div class="cs-trigger" onclick="toggleCS('csw-client')">
                  <span class="cs-label" id="cs-client-label">Selecione um cliente...</span>
                  <span class="cs-arrow">&#9662;</span>
                </div>
                <div class="cs-dropdown" style="display:none;">
                  <input type="text" class="cs-search" placeholder="Buscar cliente..." oninput="filterCS('csw-client', this.value)" />
                  <div class="cs-options">
                    ${allClients.map(c => '<div class="cs-option" data-value="' + c.id + '" data-search="' + esc(c.name.toLowerCase()) + ' ' + (c.phone ?? '').toLowerCase() + '" data-wrapper="csw-client" data-val-id="cs-client-val" data-lbl-id="cs-client-label" onclick="selectCS(this,this.dataset.wrapper,this.dataset.valId,this.dataset.lblId)">' + esc(c.name) + (c.phone ? ' <span style="color:var(--muted);font-size:12px;">&#183; ' + esc(c.phone) + '</span>' : '') + '</div>').join("")}
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Barbeiro *</label>
              <div class="custom-select-wrapper" id="csw-barber">
                <input type="hidden" name="barberId" id="cs-barber-val" required />
                <div class="cs-trigger" onclick="toggleCS('csw-barber')">
                  <span class="cs-label" id="cs-barber-label">Selecione um barbeiro...</span>
                  <span class="cs-arrow">&#9662;</span>
                </div>
                <div class="cs-dropdown" style="display:none;">
                  <input type="text" class="cs-search" placeholder="Buscar barbeiro..." oninput="filterCS('csw-barber', this.value)" />
                  <div class="cs-options">
                    ${allBarbers.map(b => '<div class="cs-option" data-value="' + b.id + '" data-search="' + esc(b.name.toLowerCase()) + '" data-wrapper="csw-barber" data-val-id="cs-barber-val" data-lbl-id="cs-barber-label" onclick="selectCS(this,this.dataset.wrapper,this.dataset.valId,this.dataset.lblId)">' + esc(b.name) + '</div>').join("")}
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Serviço *</label>
              <div class="custom-select-wrapper" id="csw-service">
                <input type="hidden" name="serviceId" id="cs-service-val" required />
                <div class="cs-trigger" onclick="toggleCS('csw-service')">
                  <span class="cs-label" id="cs-service-label">Selecione um serviço...</span>
                  <span class="cs-arrow">&#9662;</span>
                </div>
                <div class="cs-dropdown" style="display:none;">
                  <input type="text" class="cs-search" placeholder="Buscar serviço..." oninput="filterCS('csw-service', this.value)" />
                  <div class="cs-options">
                    ${allServices.map(s => '<div class="cs-option" data-value="' + s.id + '" data-search="' + esc(s.name.toLowerCase()) + '" data-duration="' + ((s as any).durationMinutes ?? 60) + '" onclick="selectCSService(this,' + ((s as any).durationMinutes ?? 60) + ')">' + esc(s.name) + ' <span style="color:var(--muted);font-size:12px;">&#183; ' + ((s as any).durationMinutes ?? 60) + 'min</span></div>').join("")}
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Data de Início *</label>
              <input type="hidden" name="startDate" id="recStartDate" required />
              <div id="calendarWidget" style="background:var(--bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;"></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Horário Início *</label>
                <div class="time-picker-wrapper" id="tp-start">
                  <div class="tp-trigger" onclick="toggleTP('tp-start')">
                    <span id="tp-start-label">09:00</span>
                    <span class="cs-arrow">&#9662;</span>
                  </div>
                  <input type="hidden" name="startTime" id="recStartTime" value="09:00" required />
                  <div class="tp-dropdown" style="display:none;">
                    <div class="tp-columns">
                      <div class="tp-col" id="tp-start-hours"></div>
                      <div class="tp-col" id="tp-start-mins"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Horário Fim <span style="font-size:11px;color:var(--muted)">(automático)</span></label>
                <div class="tp-trigger" style="opacity:0.5;cursor:default;">
                  <span id="tp-end-label">10:00</span>
                </div>
                <input type="hidden" name="endTime" id="recEndTime" value="10:00" required />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Intervalo (semanas)</label>
                <input type="number" name="intervalWeeks" id="recIntervalWeeks" value="2" min="1" max="12" class="form-input" onchange="updatePreview()" />
              </div>
              <div class="form-group">
                <label class="form-label">Nº de Ocorrências</label>
                <input type="number" name="occurrences" id="recOccurrences" value="4" min="1" max="52" class="form-input" onchange="updatePreview()" />
              </div>
            </div>

            <div id="datesPreview" style="display:none;margin-bottom:16px;">
              <label class="form-label" style="margin-bottom:8px;">Datas que serão geradas</label>
              <div id="datesPreviewList" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
            </div>

            <div class="form-group">
              <label class="form-label">Observações</label>
              <input type="text" name="notes" class="form-input" placeholder="Opcional" />
            </div>
            <div style="display:flex;gap:12px;margin-top:20px;">
              <button type="button" onclick="document.getElementById('newRecModal').style.display='none'" class="btn" style="flex:1;">Cancelar</button>
              <button type="submit" class="btn btn-primary" style="flex:1;">Criar Assinatura</button>
            </div>
          </form>
        </div>
      </div>

      <style>
        .custom-select-wrapper{position:relative}
        .cs-trigger{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color .2s}
        .cs-trigger:hover,.cs-trigger.active{border-color:var(--gold)}
        .cs-arrow{color:var(--gold);font-size:12px}
        .cs-label{color:var(--muted);font-size:14px}
        .cs-label.selected{color:var(--text);font-weight:600}
        .cs-dropdown{position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--surface);border:1px solid var(--gold);border-radius:10px;margin-top:4px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.3)}
        .cs-search{width:100%;padding:10px 14px;border:none;border-bottom:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;outline:none}
        .cs-options{max-height:180px;overflow-y:auto}
        .cs-option{padding:10px 14px;cursor:pointer;font-size:14px;color:var(--text);transition:background .15s}
        .cs-option:hover{background:var(--gold);color:#0A0A0A}
        .cs-option.hidden{display:none}
        .cs-option.selected{background:rgba(201,168,76,.15);font-weight:600;border-left:3px solid var(--gold)}
        .time-picker-wrapper{position:relative}
        .tp-trigger{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;cursor:pointer;color:var(--text);font-weight:600;font-size:16px}
        .tp-trigger:hover{border-color:var(--gold)}
        .tp-dropdown{position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--surface);border:1px solid var(--gold);border-radius:10px;margin-top:4px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.3)}
        .tp-columns{display:flex}
        .tp-col{flex:1;max-height:180px;overflow-y:auto}
        .tp-col+.tp-col{border-left:1px solid var(--border)}
        .tp-item{padding:8px 14px;cursor:pointer;font-size:14px;text-align:center;color:var(--text);transition:background .15s}
        .tp-item:hover{background:var(--gold);color:#0A0A0A}
        .tp-item.active{background:var(--gold);color:#0A0A0A;font-weight:700}
        #calendarWidget .cal-nav{display:flex;justify-content:space-between;align-items:center;padding:12px}
        #calendarWidget .cal-nav button{background:rgba(201,168,76,.1);border:none;color:var(--gold);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:14px}
        #calendarWidget .cal-nav button:hover{background:rgba(201,168,76,.25)}
        #calendarWidget .cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
        #calendarWidget .cal-day-header{text-align:center;font-size:11px;font-weight:700;color:var(--muted);padding:6px 0}
        #calendarWidget .cal-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;border-radius:8px;margin:1px;transition:all .15s;color:var(--text)}
        #calendarWidget .cal-cell:hover:not(.disabled):not(.selected){background:rgba(201,168,76,.15)}
        #calendarWidget .cal-cell.selected{background:var(--gold);color:#0A0A0A;font-weight:800}
        #calendarWidget .cal-cell.today{border:1px solid var(--gold);color:var(--gold)}
        #calendarWidget .cal-cell.disabled{opacity:.3;cursor:default}
        #calendarWidget .cal-selected-row{display:flex;align-items:center;gap:6px;padding:10px 14px;border-top:1px solid var(--border);font-size:12px;color:var(--gold);font-weight:600}
      </style>

      <script>
        function toggleCS(wId){var w=document.getElementById(wId),dd=w.querySelector('.cs-dropdown'),tr=w.querySelector('.cs-trigger'),isOpen=dd.style.display!=='none';document.querySelectorAll('.cs-dropdown').forEach(function(d){d.style.display='none'});document.querySelectorAll('.cs-trigger').forEach(function(t){t.classList.remove('active')});if(!isOpen){dd.style.display='block';tr.classList.add('active');var s=w.querySelector('.cs-search');if(s)s.focus()}}
        function filterCS(wId,q){document.getElementById(wId).querySelectorAll('.cs-option').forEach(function(o){o.classList.toggle('hidden',!(o.dataset.search||'').includes(q.toLowerCase()))})}
        function selectCS(el,wId,valId,lblId){var v=el.dataset.value;document.getElementById(valId).value=v;var lbl=document.getElementById(lblId);lbl.textContent=el.textContent.trim();lbl.classList.add('selected');document.getElementById(wId).querySelectorAll('.cs-option').forEach(function(o){o.classList.toggle('selected',o.dataset.value===v)});document.getElementById(wId).querySelector('.cs-dropdown').style.display='none';document.getElementById(wId).querySelector('.cs-trigger').classList.remove('active');updatePreview()}
        function selectCSService(el,dur){selectCS(el,'csw-service','cs-service-val','cs-service-label');window._serviceDuration=dur;calcEndTime()}
        document.addEventListener('click',function(e){if(!e.target.closest('.custom-select-wrapper')&&!e.target.closest('.time-picker-wrapper')){document.querySelectorAll('.cs-dropdown,.tp-dropdown').forEach(function(d){d.style.display='none'});document.querySelectorAll('.cs-trigger').forEach(function(t){t.classList.remove('active')})}});

        window._serviceDuration=60;window._startH=9;window._startM=0;
        function buildTimePicker(){var hC=document.getElementById('tp-start-hours'),mC=document.getElementById('tp-start-mins');hC.innerHTML='';mC.innerHTML='';for(var h=0;h<24;h++){var el=document.createElement('div');el.className='tp-item'+(h===window._startH?' active':'');el.textContent=String(h).padStart(2,'0')+'h';el.onclick=(function(hh){return function(){window._startH=hh;updateStartTime();buildTimePicker()}})(h);hC.appendChild(el)}for(var m=0;m<60;m+=5){var el2=document.createElement('div');el2.className='tp-item'+(m===window._startM?' active':'');el2.textContent=String(m).padStart(2,'0')+'min';el2.onclick=(function(mm){return function(){window._startM=mm;updateStartTime();buildTimePicker();toggleTP('tp-start')}})(m);mC.appendChild(el2)}}
        function updateStartTime(){var t=String(window._startH).padStart(2,'0')+':'+String(window._startM).padStart(2,'0');document.getElementById('recStartTime').value=t;document.getElementById('tp-start-label').textContent=t;calcEndTime()}
        function calcEndTime(){var total=window._startH*60+window._startM+(window._serviceDuration||60);var hh=String(Math.floor(total/60)%24).padStart(2,'0');var mm=String(total%60).padStart(2,'0');var endT=hh+':'+mm;document.getElementById('recEndTime').value=endT;document.getElementById('tp-end-label').textContent=endT}
        function toggleTP(id){var w=document.getElementById(id),dd=w.querySelector('.tp-dropdown');dd.style.display=dd.style.display==='none'?'block':'none'}
        buildTimePicker();

        var MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        var WDAYS=['D','S','T','Q','Q','S','S'];
        var calYear=new Date().getFullYear(),calMonth=new Date().getMonth(),calSelected='';
        function renderCalendar(){var today=new Date().toISOString().slice(0,10);var firstDay=new Date(calYear,calMonth,1).getDay();var daysInMonth=new Date(calYear,calMonth+1,0).getDate();var html='<div class="cal-nav"><button onclick="calPrev()">&#9664;</button><span style="font-weight:700;color:var(--text);">'+MONTHS[calMonth]+' '+calYear+'</span><button onclick="calNext()">&#9654;</button></div><div class="cal-grid">';WDAYS.forEach(function(d){html+='<div class="cal-day-header">'+d+'</div>'});for(var i=0;i<firstDay;i++)html+='<div class="cal-cell"></div>';for(var d=1;d<=daysInMonth;d++){var mm=String(calMonth+1).padStart(2,'0');var dd=String(d).padStart(2,'0');var ds=calYear+'-'+mm+'-'+dd;var isPast=ds<today;var isToday=ds===today;var isSel=ds===calSelected;var cls='cal-cell';if(isSel)cls+=' selected';else if(isToday)cls+=' today';if(isPast)cls+=' disabled';html+='<div class="'+cls+'" onclick="'+(isPast?'':"calSelect('"+ds+"')")+'">'+d+'</div>'}html+='</div>';if(calSelected){var dt=new Date(calSelected+'T12:00:00');var fmt=dt.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});html+='<div class="cal-selected-row">&#128197; '+fmt+'</div>'}document.getElementById('calendarWidget').innerHTML=html}
        function calPrev(){if(calMonth===0){calMonth=11;calYear--}else calMonth--;renderCalendar()}
        function calNext(){if(calMonth===11){calMonth=0;calYear++}else calMonth++;renderCalendar()}
        function calSelect(d){calSelected=d;document.getElementById('recStartDate').value=d;renderCalendar();updatePreview()}
        renderCalendar();

        function updatePreview(){var sd=document.getElementById('recStartDate').value;var iv=parseInt(document.getElementById('recIntervalWeeks').value)||2;var oc=parseInt(document.getElementById('recOccurrences').value)||4;var pv=document.getElementById('datesPreview');var pl=document.getElementById('datesPreviewList');if(!sd){pv.style.display='none';return}pv.style.display='block';var dates=[];var d=new Date(sd+'T12:00:00');for(var i=0;i<oc;i++){dates.push(new Date(d));d.setDate(d.getDate()+iv*7)}pl.innerHTML=dates.map(function(dt){var label=dt.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});return '<span style="background:rgba(201,168,76,.12);color:var(--gold);padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;">'+label+'</span>'}).join('')}

        function openCancelModal(id,name){document.getElementById('cancelId').value=id;document.getElementById('cancelClientName').textContent=name;document.getElementById('cancelModal').style.display='flex'}
        document.addEventListener('click',function(e){if(e.target.id==='cancelModal')document.getElementById('cancelModal').style.display='none'});
      </script>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
    res.send(adminLayout("Assinaturas", "assinaturas", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Assinaturas",href:"/admin/assinaturas"}]));
  }));

    app.post("/admin/assinaturas", requireAdminAuth, async (req: Request, res: Response) => {
    const { clientId, barberId, serviceId, startDate, startTime, endTime, intervalWeeks, occurrences, notes } = req.body;
    if (!clientId || !barberId || !serviceId || !startDate || !startTime || !endTime) {
      res.redirect("/admin/assinaturas?error=Preencha+todos+os+campos+obrigatórios"); return;
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
      res.redirect("/admin/assinaturas?created=1");
    } catch (e: any) {
      res.redirect(`/admin/assinaturas?error=${encodeURIComponent(e.message)}`);
    }
  });

  app.post("/admin/assinaturas/cancelar", requireAdminAuth, async (req: Request, res: Response) => {
    const { id, reason } = req.body;
    if (id) await db.cancelRecurringWithReason(parseInt(id), reason || undefined);
    res.redirect("/admin/assinaturas?cancelled=1");
  });

  // Rota para atribuir plano de assinatura diretamente da Agenda
  app.post("/admin/assinaturas/nova", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId;
    const { clientId, planId, startDate, paymentMethod, returnDate } = req.body;
    if (!clientId || !planId || !startDate) {
      const rd = returnDate || today();
      res.redirect(`/admin/agenda?date=${rd}&error=Preencha+todos+os+campos`); return;
    }
    try {
      const dbConn = await db.getDb();
      if (!dbConn || !tenantId) throw new Error("Banco indisponível");
      // Buscar dados do plano
      const planRows = await dbConn.execute(sql`SELECT id, name, price, recurrences, "selectedServiceIds", "selectedProductIds" FROM subscription_plans WHERE id = ${parseInt(planId)} AND "tenantId" = ${tenantId} LIMIT 1`) as any;
      const planData = Array.isArray(planRows) ? (planRows[0] as any[])[0] : (planRows?.rows ?? [])[0];
      if (!planData) throw new Error("Plano não encontrado");
      const price = parseFloat(planData.price) || 0;
      const selectedServiceIds: number[] = (() => { try { return JSON.parse(planData.selectedServiceIds || "[]"); } catch { return []; } })();
      const selectedProductIds: number[] = (() => { try { return JSON.parse(planData.selectedProductIds || "[]"); } catch { return []; } })();
      const now = new Date();
      const cycleEndDate = new Date(now);
      cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
      const cycleEnd = cycleEndDate.toISOString().split("T")[0];
      await dbConn.execute(sql`
        INSERT INTO client_subscriptions
          ("tenantId", "planId", "clientId", "barberId", "selectedServiceIds", "selectedProductIds",
           status, "paymentMethod", price, "cycleStart", "cycleEnd", "autoRenew")
        VALUES (
          ${tenantId}, ${parseInt(planId)}, ${parseInt(clientId)}, ${session.barberId},
          ${JSON.stringify(selectedServiceIds)}, ${JSON.stringify(selectedProductIds)},
          'active', ${paymentMethod || 'cash'}, ${price},
          ${startDate}, ${cycleEnd}, ${false}
        )
      `);
      const rd = returnDate || today();
      res.redirect(`/admin/agenda?date=${rd}&planSaved=1`);
    } catch (e: any) {
      const rd = returnDate || today();
      res.redirect(`/admin/agenda?date=${rd}&error=${encodeURIComponent(e.message)}`);
    }
  });


  // ─── Planos de Assinatura ────────────────────────────────────────────────────
  app.get("/admin/planos", requireAdminAuth, withErrorPage("Planos de Assinatura", "planos", async (req: Request, res: Response) => {
    try {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const saved = req.query.saved === "1";
    const deleted = req.query.deleted === "1";
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    const errorMsg = req.query.error ? decodeURIComponent(req.query.error as string) : null;
    let plans: any[] = [];
    const allServices = await db.getAllServices(true, tenantId);
    const allProducts = await db.getAllProducts(true, tenantId);
    try {
      const dbConn = await db.getDb();
      if (dbConn && tenantId) {
        const rawPlans = await dbConn.execute(sql`
          SELECT sp.*,
            (SELECT COUNT(*) FROM client_subscriptions WHERE "planId" = sp.id AND status = 'active') as "activeSubscribers"
          FROM subscription_plans sp
          WHERE sp."tenantId" = ${tenantId}
          ORDER BY sp."createdAt" DESC
        `) as any;
        const planRows = Array.isArray(rawPlans) ? (rawPlans[0] as any[]) : (rawPlans?.rows ?? []);
        for (const plan of planRows) {
          const pid = parseInt(String(plan.id), 10);
          const rawSvcs = await dbConn.execute(sql`
            SELECT sps."serviceId", s.name FROM subscription_plan_services sps
            JOIN services s ON s.id = sps."serviceId"
            WHERE sps."planId" = ${pid}
          `) as any;
          const rawProds = await dbConn.execute(sql`
            SELECT spp."productId", p.name FROM subscription_plan_products spp
            JOIN products p ON p.id = spp."productId"
            WHERE spp."planId" = ${pid}
          `) as any;
          plan.services = Array.isArray(rawSvcs) ? (rawSvcs[0] as any[]) : (rawSvcs?.rows ?? []);
          plan.products = Array.isArray(rawProds) ? (rawProds[0] as any[]) : (rawProds?.rows ?? []);
        }
        plans = planRows;
      }
    } catch (e: any) {
      console.error("[planos] Erro ao buscar planos:", e.message);
    }
    const editPlan = editId ? plans.find((p: any) => p.id === editId) : null;
    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h1 style="font-size:24px;font-weight:700;color:var(--text);">Planos de Assinatura</h1>
          <p style="color:var(--muted);font-size:14px;margin-top:4px;">Gerencie os planos disponíveis para seus clientes</p>
        </div>
        <div style="display:flex;gap:10px;">
          <a href="/admin/assinaturas" class="btn btn-ghost" style="font-size:13px;">Ver Assinaturas</a>
          <button onclick="document.getElementById('planModal').style.display='flex'" class="btn btn-primary">+ Novo Plano</button>
        </div>
      </div>
      ${saved ? '<div class="alert alert-success">Plano salvo com sucesso.</div>' : ""}
      ${deleted ? '<div class="alert alert-success">Plano excluído com sucesso.</div>' : ""}
      ${errorMsg ? `<div class="alert alert-error">${esc(errorMsg)}</div>` : ""}
      ${plans.length === 0 ? `
        <div class="card"><div class="card-body"><div class="empty">Nenhum plano criado ainda. Clique em "+ Novo Plano" para começar.</div></div></div>
      ` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px;">
          ${plans.map((plan: any) => `
            <div style="background:var(--surface);border:1px solid ${plan.isActive ? 'var(--border)' : '#333'};border-radius:16px;padding:20px;opacity:${plan.isActive ? '1' : '0.6'};">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div>
                  <div style="font-size:16px;font-weight:700;color:var(--text);">${esc(plan.name)}</div>
                  ${plan.description ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${esc(plan.description)}</div>` : ""}
                </div>
                <span style="background:${plan.isActive ? 'rgba(74,222,128,.12)' : 'rgba(122,120,112,.12)'};color:${plan.isActive ? '#4ADE80' : 'var(--muted)'};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">${plan.isActive ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div style="font-size:28px;font-weight:900;color:var(--gold);margin-bottom:12px;">R$ ${parseFloat(plan.price).toFixed(2)}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
                <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
                  <div style="font-size:18px;font-weight:800;color:var(--text);">${plan.recurrences}</div>
                  <div style="font-size:10px;color:var(--muted);font-weight:600;">Recorrências</div>
                </div>
                <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
                  <div style="font-size:18px;font-weight:800;color:var(--text);">${plan.maxServices}</div>
                  <div style="font-size:10px;color:var(--muted);font-weight:600;">Serviços</div>
                </div>
                <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
                  <div style="font-size:18px;font-weight:800;color:#4ADE80;">${plan.activeSubscribers ?? 0}</div>
                  <div style="font-size:10px;color:var(--muted);font-weight:600;">Assinantes</div>
                </div>
              </div>
              ${(plan.services ?? []).length > 0 ? `<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Serviços: ${plan.services.map((s: any) => esc(s.name)).join(', ')}</div>` : ""}
              <div style="display:flex;gap:8px;">
                <a href="/admin/planos?edit=${plan.id}" class="btn btn-ghost" style="flex:1;text-align:center;font-size:12px;padding:6px;">Editar</a>
                <form method="POST" action="/admin/planos/${plan.id}/toggle" style="flex:1;">
                  <button type="submit" class="btn btn-ghost" style="width:100%;font-size:12px;padding:6px;">${plan.isActive ? 'Desativar' : 'Ativar'}</button>
                </form>
                ${(plan.activeSubscribers ?? 0) === 0 ? `
                <form method="POST" action="/admin/planos/${plan.id}/excluir" onsubmit="return confirm('Excluir plano?')" style="flex:0;">
                  <button type="submit" class="btn" style="font-size:12px;padding:6px 10px;background:#EF444422;color:#F87171;border:none;">Excluir</button>
                </form>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `}
      <!-- Modal Novo/Editar Plano -->
      <div id="planModal" style="display:${editPlan ? 'flex' : 'none'};position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:16px;padding:28px;width:560px;max-width:90vw;max-height:90vh;overflow-y:auto;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="font-size:18px;font-weight:700;color:var(--text);">${editPlan ? 'Editar Plano' : 'Novo Plano'}</h2>
            <button onclick="document.getElementById('planModal').style.display='none'" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;">&#10005;</button>
          </div>
          <form method="POST" action="${editPlan ? '/admin/planos/' + editPlan.id + '/editar' : '/admin/planos'}">
            <div class="form-group">
              <label class="form-label">Nome do Plano *</label>
              <input type="text" name="name" class="form-input" value="${esc(editPlan?.name ?? '')}" required placeholder="Ex: Plano Mensal Premium" />
            </div>
            <div class="form-group">
              <label class="form-label">Descrição</label>
              <input type="text" name="description" class="form-input" value="${esc(editPlan?.description ?? '')}" placeholder="Opcional" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Preço (R$) *</label>
                <input type="number" name="price" class="form-input" value="${editPlan?.price ?? ''}" required min="0" step="0.01" />
              </div>
              <div class="form-group">
                <label class="form-label">Recorrências *</label>
                <input type="number" name="recurrences" class="form-input" value="${editPlan?.recurrences ?? 4}" required min="1" max="31" />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Máx. Serviços</label>
                <input type="number" name="maxServices" class="form-input" value="${editPlan?.maxServices ?? 1}" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Máx. Produtos</label>
                <input type="number" name="maxProducts" class="form-input" value="${editPlan?.maxProducts ?? 0}" min="0" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Serviços incluídos</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;max-height:160px;overflow-y:auto;">
                ${allServices.map((s: any) => {
                  const checked = editPlan?.services?.some((es: any) => es.serviceId === s.id) ? 'checked' : '';
                  return `<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text);cursor:pointer;min-width:140px;"><input type="checkbox" name="serviceIds" value="${s.id}" ${checked} style="accent-color:var(--gold);width:14px;height:14px;" />${esc(s.name)}</label>`;
                }).join("")}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Produtos incluídos</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;max-height:120px;overflow-y:auto;">
                ${allProducts.length === 0 ? '<span style="font-size:13px;color:var(--muted);">Nenhum produto cadastrado</span>' : allProducts.map((p: any) => {
                  const checked = editPlan?.products?.some((ep: any) => ep.productId === p.id) ? 'checked' : '';
                  return `<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text);cursor:pointer;min-width:140px;"><input type="checkbox" name="productIds" value="${p.id}" ${checked} style="accent-color:var(--gold);width:14px;height:14px;" />${esc(p.name)}</label>`;
                }).join("")}
              </div>
            </div>
            <div style="display:flex;gap:12px;margin-top:20px;">
              <button type="button" onclick="document.getElementById('planModal').style.display='none'" class="btn" style="flex:1;">Cancelar</button>
              <button type="submit" class="btn btn-primary" style="flex:1;">${editPlan ? 'Salvar Alterações' : 'Criar Plano'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
    res.send(adminLayout("Planos de Assinatura", "planos", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Planos de Assinatura",href:"/admin/planos"}]));
    } catch (err: any) {
      console.error('[/admin/planos] Erro:', err?.message);
      res.send(adminLayout("Planos de Assinatura", "planos", `<div style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="color:var(--text);margin-bottom:8px">Erro ao carregar página</h2><p style="color:var(--muted);margin-bottom:20px">Ocorreu um problema de conexão com o banco de dados. Aguarde alguns segundos e tente novamente.</p><a href="/admin/planos" class="btn btn-primary">Tentar novamente</a></div>`));
    }
  }));

  app.post("/admin/planos", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    if (!tenantId) { res.redirect("/admin/planos?error=Tenant+não+encontrado"); return; }
    const { name, description, price, recurrences, maxServices, maxProducts } = req.body;
    const serviceIds: number[] = Array.isArray(req.body.serviceIds) ? req.body.serviceIds.map(Number) : req.body.serviceIds ? [Number(req.body.serviceIds)] : [];
    const productIds: number[] = Array.isArray(req.body.productIds) ? req.body.productIds.map(Number) : req.body.productIds ? [Number(req.body.productIds)] : [];
    if (!name || !price) { res.redirect("/admin/planos?error=Preencha+nome+e+preço"); return; }
    try {
      const dbConn = await db.getDb();
      if (!dbConn) throw new Error("DB indisponível");
      const rawInsert = await dbConn.execute(sql`
        INSERT INTO subscription_plans ("tenantId", name, description, recurrences, "maxServices", "maxProducts", price, "isActive", "createdAt", "updatedAt")
        VALUES (${tenantId}, ${name}, ${description || null}, ${parseInt(recurrences) || 4}, ${parseInt(maxServices) || 1}, ${parseInt(maxProducts) || 0}, ${parseFloat(price)}, true, NOW(), NOW())
        RETURNING id
      `) as any;
      const rows = Array.isArray(rawInsert) ? (rawInsert[0] as any[]) : (rawInsert?.rows ?? []);
      const planId = rows[0]?.id;
      if (planId) {
        for (const sid of serviceIds) await dbConn.execute(sql`INSERT INTO subscription_plan_services ("planId", "serviceId", "tenantId") VALUES (${planId}, ${sid}, ${tenantId})`);
        for (const pid of productIds) await dbConn.execute(sql`INSERT INTO subscription_plan_products ("planId", "productId", "tenantId") VALUES (${planId}, ${pid}, ${tenantId})`);
      }
      res.redirect("/admin/planos?saved=1");
    } catch (e: any) { res.redirect(`/admin/planos?error=${encodeURIComponent(e.message)}`); }
  });

  app.post("/admin/planos/:id/editar", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const planId = parseInt(req.params.id);
    if (!tenantId) { res.redirect("/admin/planos?error=Tenant+não+encontrado"); return; }
    const { name, description, price, recurrences, maxServices, maxProducts } = req.body;
    const serviceIds: number[] = Array.isArray(req.body.serviceIds) ? req.body.serviceIds.map(Number) : req.body.serviceIds ? [Number(req.body.serviceIds)] : [];
    const productIds: number[] = Array.isArray(req.body.productIds) ? req.body.productIds.map(Number) : req.body.productIds ? [Number(req.body.productIds)] : [];
    try {
      const dbConn = await db.getDb();
      if (!dbConn) throw new Error("DB indisponível");
      await dbConn.execute(sql`UPDATE subscription_plans SET name=${name}, description=${description || null}, recurrences=${parseInt(recurrences) || 4}, "maxServices"=${parseInt(maxServices) || 1}, "maxProducts"=${parseInt(maxProducts) || 0}, price=${parseFloat(price)}, "updatedAt"=NOW() WHERE id=${planId} AND "tenantId"=${tenantId}`);
      await dbConn.execute(sql`DELETE FROM subscription_plan_services WHERE "planId"=${planId}`);
      await dbConn.execute(sql`DELETE FROM subscription_plan_products WHERE "planId"=${planId}`);
      for (const sid of serviceIds) await dbConn.execute(sql`INSERT INTO subscription_plan_services ("planId", "serviceId", "tenantId") VALUES (${planId}, ${sid}, ${tenantId})`);
      for (const pid of productIds) await dbConn.execute(sql`INSERT INTO subscription_plan_products ("planId", "productId", "tenantId") VALUES (${planId}, ${pid}, ${tenantId})`);
      res.redirect("/admin/planos?saved=1");
    } catch (e: any) { res.redirect(`/admin/planos?error=${encodeURIComponent(e.message)}`); }
  });

  app.post("/admin/planos/:id/toggle", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const planId = parseInt(req.params.id);
    try {
      const dbConn = await db.getDb();
      if (dbConn && tenantId) await dbConn.execute(sql`UPDATE subscription_plans SET "isActive" = NOT "isActive", "updatedAt"=NOW() WHERE id=${planId} AND "tenantId"=${tenantId}`);
      res.redirect("/admin/planos?saved=1");
    } catch (e: any) { res.redirect(`/admin/planos?error=${encodeURIComponent(e.message)}`); }
  });

  app.post("/admin/planos/:id/excluir", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const planId = parseInt(req.params.id);
    try {
      const dbConn = await db.getDb();
      if (!dbConn || !tenantId) throw new Error("DB indisponível");
      const rawCheck = await dbConn.execute(sql`SELECT COUNT(*) as cnt FROM client_subscriptions WHERE "planId"=${planId} AND status='active'`) as any;
      const rows = Array.isArray(rawCheck) ? (rawCheck[0] as any[]) : (rawCheck?.rows ?? []);
      const cnt = Number(rows[0]?.cnt ?? 0);
      if (cnt > 0) { res.redirect(`/admin/planos?error=${encodeURIComponent('Não é possível excluir um plano com ' + cnt + ' assinatura(s) ativa(s).')}`); return; }
      await dbConn.execute(sql`DELETE FROM subscription_plan_services WHERE "planId"=${planId}`);
      await dbConn.execute(sql`DELETE FROM subscription_plan_products WHERE "planId"=${planId}`);
      await dbConn.execute(sql`DELETE FROM subscription_plans WHERE id=${planId} AND "tenantId"=${tenantId}`);
      res.redirect("/admin/planos?deleted=1");
    } catch (e: any) { res.redirect(`/admin/planos?error=${encodeURIComponent(e.message)}`); }
  });

  // ─── Estoque ─────────────────────────────────────────────────────────────────
  app.get("/admin/estoque", requireAdminAuth, withErrorPage("Estoque", "estoque", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const activeTab = (req.query.tab as string) || "todos";
    const saved = req.query.saved === "1";
    const searchProd = ((req.query.q as string) || "").toLowerCase();

    // Buscar todos os produtos (incluindo inativos para histórico)
    const allProducts = await db.getStockProducts(tenantId);
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
      { id: "todos", label: "Todos" },
      { id: "venda", label: "Venda" },
      { id: "interno", label: "Uso Interno" },
      { id: "historico", label: "Histórico" },
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
        ${searchProd ? `<a href="/admin/estoque?tab=${activeTab}" class="btn btn-ghost" style="padding:8px 12px"></a>` : ""}
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
                  <a href="/admin/estoque/${p.id}/historico" class="btn btn-ghost" style="font-size:12px;padding:4px 10px"></a>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;

    const histTable = `
      <div class="card">
        <div class="card-header"><div class="card-title">Últimas Movimentações</div></div>
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
          <h1 style="font-size:24px;font-weight:700;color:var(--text)">Controle de Estoque</h1>
          <p style="color:var(--muted);font-size:14px;margin-top:4px">Movimentações e alertas de estoque dos produtos</p>
        </div>
        <a href="/admin/export/estoque.csv" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">↓ Exportar CSV</a>
      </div>
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Movimentação registrada!</div>` : ""}
      ${lowStock.length > 0 ? `
        <div style="background:rgba(239,68,68,0.1);border:1px solid var(--error);color:var(--error);border-radius:8px;padding:12px 16px;margin-bottom:20px">
          <strong>${lowStock.length} produto(s) com estoque baixo:</strong> ${lowStock.map((p: any) => esc(p.name)).join(", ")}
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
  res.send(adminLayout("Estoque", "estoque", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Estoque",href:"/admin/estoque"}]));
  }));

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

    // ─── Histórico de Estoque ─────────────────────────────────────────────
  app.get("/admin/estoque/:id/historico", requireAdminAuth, withErrorPage("Histórico de Estoque", "estoque", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) { res.redirect("/admin/estoque"); return; }

    // Buscar produto
    const products = await db.getAllProductsWithMedia(false, tenantId);
    const product = products.find(p => p.id === productId);
    if (!product) { res.redirect("/admin/estoque"); return; }

    // Buscar movimentações
    const movements = await db.getStockMovements(productId);

    const typeLabel: Record<string, string> = {
      in: "<span style='color:var(--success);font-weight:600'>Entrada</span>",
      out: "<span style='color:var(--error);font-weight:600'>Saída</span>",
      adjustment: "<span style='color:var(--warning);font-weight:600'>Ajuste</span>",
    };

    const rows = movements.length === 0
      ? `<tr><td colspan="5" class="empty">Nenhuma movimentação registrada.</td></tr>`
      : movements.map(m => `
        <tr>
          <td>${new Date(m.createdAt ?? m.date).toLocaleDateString("pt-BR")}</td>
          <td>${typeLabel[m.type] ?? m.type}</td>
          <td style="font-weight:700">${m.quantity > 0 ? "+" : ""}${m.quantity}</td>
          <td>${esc(m.reason ?? "—")}</td>
          <td style="color:var(--muted);font-size:12px">${esc((m as any).barberName ?? "—")}</td>
        </tr>
      `).join("");

    const body = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <a href="/admin/estoque" class="btn btn-ghost" style="padding:8px 14px;font-size:13px">← Voltar</a>
        <div>
          <h1 style="font-size:22px;font-weight:700">Histórico — ${esc(product.name)}</h1>
          <p style="color:var(--muted);font-size:13px;margin-top:2px">Estoque atual: <strong style="color:var(--gold)">${product.stockQuantity ?? 0} unid.</strong></p>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Movimentações (últimas 50)</span>
          <span style="color:var(--muted);font-size:12px">${movements.length} registro(s)</span>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Qtd</th><th>Motivo</th><th>Responsável</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
    res.send(adminLayout(`Histórico — ${esc(product.name)}`, "estoque", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Estoque",href:"/admin/estoque"},{label:`Histórico — ${esc(product.name)}`,href:"#"}]));
  }));

  // ─── Retorno Automático ─────────────────────────────────────────────
  app.get("/admin/retorno-automatico", requireAdminAuth, withErrorPage("Retorno Automático", "retorno-automatico", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const configs = await db.listReturnMessageConfigs(tenantId);
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
        <h1 style="font-size:24px;font-weight:700;color:var(--text);">Retorno Automático</h1>
        <p style="color:var(--muted);font-size:14px;margin-top:4px;">Configure mensagens automáticas de retorno por WhatsApp após o atendimento</p>
      </div>
      ${saved ? `<div class="alert alert-success">Configuração salva com sucesso.</div>` : ""}
      ${deleted ? `<div class="alert alert-success">Configuração removida.</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <!-- Adicionar nova config -->
        <div class="card">
          <div class="card-header"><span class="card-title">Nova Configuração</span></div>
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
                <textarea name="messageTemplate" class="form-input" rows="4" required placeholder="Olá {nome}! Já faz um tempo desde o seu último {servico}. Que tal agendar uma visita? :)"></textarea>
              </div>
              <div class="form-group" style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" name="isActive" id="isActive" value="1" checked style="width:16px;height:16px;" />
                <label for="isActive" style="color:var(--text);font-size:14px;">Ativo</label>
              </div>
              <button type="submit" class="btn btn-primary" style="width:100%;">Salvar Configuração</button>
            </form>
          </div>
        </div>
        <!-- Lista de configs -->
        <div class="card">
          <div class="card-header"><span class="card-title">Configurações Ativas</span></div>
          <div class="card-body" style="padding:0;">
            ${configsWithService.length === 0 ? `<p style="padding:20px;color:var(--muted);font-size:13px;">Nenhuma configuração de retorno cadastrada.</p>` : configsWithService.map(c => `
              <div style="padding:16px;border-bottom:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <strong style="color:var(--text);">${esc(c.serviceName)}</strong>
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
  res.send(adminLayout("Retorno Automático", "retorno-automatico", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Retorno Automático",href:"/admin/retorno-automatico"}]));
  }));

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
  app.get("/admin/promocoes", requireAdminAuth, withErrorPage("Promoções", "promocoes", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const allClients = await db.getAllClients(tenantId);
    const activeClients = allClients.filter((c: any) => c.isActive);
    const promotionList = await db.listPromotions(tenantId);
    const sent = req.query.sent === "1";
    const AUDIENCE_OPTIONS = [
      { value: "all", label: "Todos os clientes ativos", icon: "" },
      { value: "inactive_30", label: "Inativos há 30 dias", icon: "⏳" },
      { value: "inactive_60", label: "Inativos há 60 dias", icon: "⏰" },
      { value: "birthday_month", label: "Aniversariantes do mês", icon: "" },
    ];
    const body = `
      ${sent ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px"> Promoção enviada com sucesso!</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
        <!-- Formulário de envio -->
        <div class="card">
          <div class="card-header"><div class="card-title">Nova Promoção</div></div>
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
                  <option value="individual">Cliente específico</option>
                </select>
              </div>
              <div id="client-select-group" style="display:none" class="form-group">
                <label class="form-label">Buscar cliente</label>
                <input type="text" id="client-search-input" class="form-input" placeholder="Digite o nome ou telefone..." oninput="filterClients()" autocomplete="off" style="margin-bottom:8px">
                <input type="hidden" name="clientId" id="client-id-hidden">
                <div id="client-selected-badge" style="display:none;background:var(--primary-10,rgba(10,126,164,0.1));border:1.5px solid var(--primary,#0a7ea4);border-radius:10px;padding:10px 14px;margin-bottom:8px;display:none;align-items:center;gap:10px">
                  
                  <span id="client-selected-name" style="flex:1;font-weight:700;color:var(--primary,#0a7ea4);font-size:14px"></span>
                  <button type="button" onclick="clearClientSelection()" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--muted)"></button>
                </div>
                <div id="client-dropdown" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;display:none;max-height:220px;overflow-y:auto">
                  ${activeClients.map((c: any) => `<div class="client-option" data-id="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone ?? "")}" onclick="selectClient(this)" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background=''"><strong style="font-size:14px">${esc(c.name)}</strong>${c.phone ? `<br><small style="color:var(--muted)">${esc(c.phone)}</small>` : ""}</div>`).join("")}
                  <div id="client-no-results" style="display:none;padding:12px;color:var(--muted);font-size:13px;text-align:center">Nenhum cliente encontrado.</div>
                </div>
              </div>
              <script>
                function toggleClientSelect(){
                  const v=document.getElementById('audience-select').value;
                  const grp=document.getElementById('client-select-group');
                  grp.style.display=v==='individual'?'block':'none';
                  if(v!=='individual'){clearClientSelection();}
                }
                function filterClients(){
                  const q=document.getElementById('client-search-input').value.toLowerCase().trim();
                  const dropdown=document.getElementById('client-dropdown');
                  const opts=dropdown.querySelectorAll('.client-option');
                  let visible=0;
                  opts.forEach(o=>{
                    const name=o.getAttribute('data-name').toLowerCase();
                    const phone=o.getAttribute('data-phone').toLowerCase();
                    const show=q===''||name.includes(q)||phone.includes(q);
                    o.style.display=show?'block':'none';
                    if(show)visible++;
                  });
                  document.getElementById('client-no-results').style.display=visible===0?'block':'none';
                  dropdown.style.display=q.length>0?'block':'none';
                }
                function selectClient(el){
                  const id=el.getAttribute('data-id');
                  const name=el.getAttribute('data-name');
                  document.getElementById('client-id-hidden').value=id;
                  document.getElementById('client-selected-name').textContent=name;
                  const badge=document.getElementById('client-selected-badge');
                  badge.style.display='flex';
                  document.getElementById('client-dropdown').style.display='none';
                  document.getElementById('client-search-input').value='';
                }
                function clearClientSelection(){
                  document.getElementById('client-id-hidden').value='';
                  document.getElementById('client-selected-name').textContent='';
                  document.getElementById('client-selected-badge').style.display='none';
                  document.getElementById('client-search-input').value='';
                  document.getElementById('client-dropdown').style.display='none';
                }
              </script>
              <button type="submit" class="btn btn-primary" style="width:100%;padding:14px;margin-top:8px">Enviar Promoção</button>
            </form>
          </div>
        </div>
        <!-- Histórico -->
        <div class="card">
          <div class="card-header"><div class="card-title">Histórico de Promoções</div></div>
          <div class="card-body">
            ${promotionList.length === 0
              ? `<div style="text-align:center;padding:40px;color:var(--muted)">Nenhuma promoção enviada ainda.</div>`
              : `<table class="table"><thead><tr><th>Título</th><th>Público</th><th>Destinatários</th><th>Data</th></tr></thead><tbody>
                ${promotionList.map((p: any) => `<tr>
                  <td><strong>${esc(p.title)}</strong><br><small style="color:var(--muted)">${esc((p.message ?? "").substring(0, 60))}${(p.message ?? "").length > 60 ? "..." : ""}</small></td>
                  <td>${p.targetAudience === 'specific_client' ? 'Cliente específico' : (AUDIENCE_OPTIONS.find(o => o.value === p.targetAudience)?.label ?? p.targetAudience)}</td>
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
    res.send(adminLayout("Promoções", "promocoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Promoções",href:"/admin/promocoes"}]));
  }));

  app.post("/admin/promocoes", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const { title, message, targetAudience, clientId } = req.body;
    if (!title || !message) { res.redirect("/admin/promocoes?error=1"); return; }
    let recipientCount = 1;
    if (targetAudience === "individual" || targetAudience === "specific_client") {
      if (!clientId) { res.redirect("/admin/promocoes?error=1"); return; }
      await db.createPromotion({ title, message, targetAudience: "specific_client", createdBy: session.barberId, recipientCount: 1, specificClientId: Number(clientId) });
    } else {
      const audience = targetAudience as "all" | "inactive_30" | "inactive_60" | "birthday_month";
      recipientCount = await db.getPromotionRecipientCount(audience);
      await db.createPromotion({ title, message, targetAudience: audience, createdBy: session.barberId, recipientCount });
    }
    res.redirect("/admin/promocoes?sent=1");
  });

  // ─── Conversão de Promoções ──────────────────────────────────────────
  app.get("/admin/conversao-promocoes", requireAdminAuth, withErrorPage("Conversão de Promoções", "conversao-promocoes", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const report = await db.getPromotionConversionReport(tenantId);
    const totalSent = report.reduce((s, p) => s + (p.recipientCount ?? 0), 0);
    const totalConversions = report.reduce((s, p) => s + (p.conversions ?? 0), 0);
    const avgRate = report.length > 0 ? Math.round(report.reduce((s, p) => s + (p.conversionRate ?? 0), 0) / report.length) : 0;
    const body = `
      <div style="margin-bottom:24px;">
        <h1 style="font-size:24px;font-weight:700;color:var(--text);">Conversão de Promoções</h1>
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
          <p style="color:var(--muted);font-size:13px;"><strong>Dica:</strong> Promoções para clientes inativos tendem a ter maior taxa de conversão. Considere segmentar seu público para melhores resultados.</p>
        </div>
      ` : ""}
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Conversão de Promoções", "conversao-promocoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Promoções",href:"/admin/promocoes"},{label:"Conversão",href:"/admin/conversao-promocoes"}]));
  }));

  // ─── Meu Perfil ──────────────────────────────────────────────────────────────
  app.get("/admin/meu-perfil", requireAdminAuth, withErrorPage("Meu Perfil", "meu-perfil", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    if (!barber) { res.redirect("/admin/login"); return; }
    const saved = req.query.saved === "1";
    const pwChanged = req.query.pw === "1";
    const pwError = req.query.pwerr as string | undefined;
    const body = `
      <div style="margin-bottom:24px;">
        <h1 style="font-size:24px;font-weight:700;color:var(--text);">Meu Perfil</h1>
        <p style="color:var(--muted);font-size:14px;margin-top:4px;">Gerencie suas informações pessoais e senha de acesso</p>
      </div>
      ${saved ? `<div class="alert alert-success">Perfil atualizado com sucesso.</div>` : ""}
      ${pwChanged ? `<div class="alert alert-success">Senha alterada com sucesso.</div>` : ""}
      ${pwError ? `<div class="alert" style="background:rgba(239,68,68,0.1);border:1px solid var(--error);color:var(--error);border-radius:8px;padding:12px 16px;margin-bottom:16px;">${esc(decodeURIComponent(pwError))}</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <!-- Dados pessoais -->
        <div class="card">
          <div class="card-header"><span class="card-title">Dados Pessoais</span></div>
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
          <div class="card-header"><span class="card-title">Alterar Senha</span></div>
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
        <div class="card-header"><span class="card-title">Tema Visual</span></div>
        <div class="card-body" style="padding:20px;">
          <p style="color:var(--muted);font-size:13px;margin-bottom:16px;">Escolha o tema visual do painel administrativo. A preferência é salva no navegador.</p>
          <div style="display:flex;gap:12px;">
            <button onclick="setTheme('light')" id="theme-light" class="btn btn-ghost" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;">
              <span style="font-size:24px;">Claro</span>
              <span style="font-size:12px;font-weight:600;">Claro</span>
            </button>
            <button onclick="setTheme('dark')" id="theme-dark" class="btn btn-ghost" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;">
              <span style="font-size:24px;">Escuro</span>
              <span style="font-size:12px;font-weight:600;">Escuro</span>
            </button>
            <button onclick="setTheme('system')" id="theme-system" class="btn btn-ghost" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;">
              <span style="font-size:24px;">Auto</span>
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
  res.send(adminLayout("Meu Perfil", "meu-perfil", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Meu Perfil",href:"/admin/meu-perfil"}]));
  }));
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
    const valid = await bcrypt.compare(currentPassword, barber.passwordHash);
    if (!valid) { res.redirect("/admin/meu-perfil?pwerr=Senha+atual+incorreta"); return; }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.updateBarber(session.barberId, { passwordHash: newHash });
    res.redirect("/admin/meu-perfil?pw=1");
  });

  // ─── Chat WhatsApp ────────────────────────────────────────────────────────────
  app.get("/admin/chat", requireAdminAuth, withErrorPage("Chat", "chat", async (req: Request, res: Response) => {
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
        <h2 style="font-size:20px;font-weight:700;margin:0">Chat WhatsApp</h2>
        <span style="font-size:12px;color:var(--muted)">${allChatClients.length} cliente(s)</span>
      </div>
      <form method="GET" style="display:flex;gap:8px;margin-bottom:16px">
        <input type="text" name="q" value="${esc(searchQ)}" placeholder="Buscar por nome ou telefone..."
          style="flex:1;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
        <button type="submit" class="btn btn-primary" style="padding:10px 18px">Buscar</button>
        ${searchQ ? `<a href="/admin/chat" class="btn btn-ghost" style="padding:10px 14px"></a>` : ""}
      </form>
      ${searchQ ? `<div style="font-size:12px;color:var(--muted);margin-bottom:12px">${chatClients.length} resultado(s) para "${esc(searchQ)}"</div>` : ""}
      <div class="card" style="padding:0;overflow:hidden">
        ${clientRows || `<div style="padding:40px;text-align:center;color:var(--muted)">${searchQ ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado.'}</div>`}
      </div>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
  res.send(adminLayout("Chat WhatsApp", "chat", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Chat WhatsApp",href:"/admin/chat"}]));
  }));

  app.get("/admin/chat/:clientId", requireAdminAuth, withErrorPage("Chat", "chat", async (req: Request, res: Response) => {
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
  res.send(adminLayout(`Chat — ${client.name}`, "chat", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Chat WhatsApp",href:"/admin/chat"},{label:client.name,href:"#"}]));
  }));

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
      <div style="font-size:48px;color:var(--muted)">&#9993;</div>
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

  // GET /admin/export/pagamentos-online.csv — Exportar pagamentos online em CSV
  app.get("/admin/export/pagamentos-online.csv", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const dbConn = await db.getDb();
    if (!dbConn || !tenantId) { res.status(400).send("Tenant não encontrado"); return; }
    const startParam = (req.query.start as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const endParam = (req.query.end as string) || new Date().toISOString().slice(0, 10);
    const raw = await dbConn.execute(sql`
      SELECT op.id, op."billingType", op.amount, op.status, op."createdAt", op."paidAt", op."invoiceUrl",
             op."chargeType", op."referenceId", op."asaasPaymentId",
             c.name AS clientName, c.phone AS clientPhone
      FROM online_payments op
      LEFT JOIN clients c ON c.id = op."clientId"
      WHERE op."tenantId" = ${tenantId}
        AND op."createdAt" >= ${startParam} AND op."createdAt" <= CONCAT(${endParam}, ' 23:59:59')
      ORDER BY op."createdAt" DESC
      LIMIT 1000
    `) as any;
    const rows = Array.isArray(raw) ? (raw[0] as any[]) : (raw?.rows ?? []);
    const billingLabel = (bt: string) => bt === 'PIX' ? 'Pix' : bt === 'CREDIT_CARD' ? 'Cartão de Crédito' : bt === 'BOLETO' ? 'Boleto' : bt;
    const statusLabel = (s: string) => ({ paid: 'Pago', pending: 'Pendente', overdue: 'Vencido', refunded: 'Estornado', cancelled: 'Cancelado' }[s] ?? s);
    const fmtDateCsv = (d: any) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const csvRows = [
      ["ID", "Cliente", "Telefone", "Método de Pagamento", "Valor (R$)", "Status", "ID Asaas", "Data de Criação", "Data de Pagamento", "Link da Fatura"],
      ...rows.map((p: any) => [
        p.id, p.clientName || '', p.clientPhone || '',
        billingLabel(p.billingType), parseFloat(p.amount).toFixed(2).replace('.', ','),
        statusLabel(p.status), p.asaasPaymentId || '',
        fmtDateCsv(p.createdAt), fmtDateCsv(p.paidAt), p.invoiceUrl || ''
      ])
    ];
    const csv = csvRows.map((r: any[]) => r.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pagamentos-online-${startParam}-${endParam}.csv"`);
    res.send("﻿" + csv);
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
      const pmLabels: Record<string, string> = { cash: "Dinheiro", credit_card: "Cartão Crédito", debit_card: "Cartão Débito", pix: "Pix", mercado_pago: "Online (legado)", asaas: "Online (Asaas)", other: "Outro" };
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
  app.get("/admin/minhas-comissoes", requireAdminAuth, withErrorPage("Minhas Comissões", "minhas-comissoes", async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const { start, end } = monthRange();
    const allSummary = await db.getCommissionSummary(start, end, barber?.tenantId);
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
          <span class="card-title">Minhas Comissões</span>
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
    res.send(adminLayout("Minhas Comissões", "minhas-comissoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Minhas Comissões",href:"/admin/minhas-comissoes"}]));
  }));


  // ─── Clientes em Órbita ──────────────────────────────────────────────────────
  app.get("/admin/orbita", requireAdminAuth, withErrorPage("Clientes em Órbita", "orbita", async (req: Request, res: Response) => {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    if (!tenantId) { res.redirect("/admin"); return; }

    const filter = (req.query.filter as string) || "week";
    const status = req.query.status as string || "all";
    const converted = status === "converted" ? true : status === "pending" ? false : undefined;

    let leads: any[] = [], stats: any = { todayCount: 0, weekConverted: 0, conversionRate: 0, newLast24h: 0 }, chartData: any[] = [];
    try {
      [leads, stats, chartData] = await Promise.all([
        db.listOrbitLeads(tenantId, filter as any, converted),
        db.getOrbitStats(tenantId),
        db.getOrbitDailyChart(tenantId, 30),
      ]);
    } catch (queryErr: any) {
      console.error("[orbita] query error (tabela pode não existir ainda):", (queryErr as any)?.message);
      // Continua com dados vazios — não derruba o servidor
    }

    const body = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">EM ÓRBITA HOJE</div>
          <div class="metric-value" style="color:var(--gold)">${stats.todayCount}</div>
          <div class="metric-sub">clientes acessaram sua barbearia</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">CONVERTIDOS (7 DIAS)</div>
          <div class="metric-value" style="color:var(--success)">${stats.weekConverted}</div>
          <div class="metric-sub">agendaram após visitar</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">TAXA DE CONVERSÃO</div>
          <div class="metric-value" style="color:var(--warning)">${stats.conversionRate}%</div>
          <div class="metric-sub">visitantes → clientes</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">NOVOS (24H)</div>
          <div class="metric-value">${stats.newLast24h}</div>
          <div class="metric-sub">leads nas últimas 24 horas</div>
        </div>
      </div>

      <!-- Gráfico -->
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><span class="card-title">Leads vs Conversões (30 dias)</span></div>
        <div class="card-body" style="padding:20px;">
          <canvas id="orbitChart" height="200"></canvas>
        </div>
      </div>

      <!-- Filtros -->
      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
        <a href="/admin/orbita?filter=today&status=${status}" class="btn ${filter === "today" ? "btn-primary" : ""}" style="font-size:12px;">Hoje</a>
        <a href="/admin/orbita?filter=week&status=${status}" class="btn ${filter === "week" ? "btn-primary" : ""}" style="font-size:12px;">7 dias</a>
        <a href="/admin/orbita?filter=month&status=${status}" class="btn ${filter === "month" ? "btn-primary" : ""}" style="font-size:12px;">30 dias</a>
        <span style="width:1px;background:var(--border);margin:0 4px;"></span>
        <a href="/admin/orbita?filter=${filter}&status=all" class="btn ${status === "all" ? "btn-primary" : ""}" style="font-size:12px;">Todos</a>
        <a href="/admin/orbita?filter=${filter}&status=pending" class="btn ${status === "pending" ? "btn-primary" : ""}" style="font-size:12px;">Pendentes</a>
        <a href="/admin/orbita?filter=${filter}&status=converted" class="btn ${status === "converted" ? "btn-primary" : ""}" style="font-size:12px;">Convertidos</a>
      </div>

      <!-- Tabela -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Clientes em Órbita (${leads.length})</span>
        </div>
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>Acesso em</th>
                <th>Fonte</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              ${leads.length === 0 ? '<tr><td colspan="6" class="empty">Nenhum lead encontrado neste período.</td></tr>' : leads.map((l: any) => `
                <tr>
                  <td style="font-weight:600;">${esc(l.clientName || "Sem nome")}</td>
                  <td>${esc(l.clientPhone || "—")}</td>
                  <td>${l.loginAt ? new Date(l.loginAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td><span class="badge ${l.source === "geo" ? "badge-gold" : "badge-muted"}">${l.source === "geo" ? "GPS" : "Link"}</span></td>
                  <td>${l.convertedAt ? '<span class="badge badge-success">Convertido</span>' : '<span class="badge badge-warning">Pendente</span>'}</td>
                  <td>${l.clientPhone ? `<a href="https://wa.me/55${(l.clientPhone || "").replace(/\\D/g, "")}?text=${encodeURIComponent("Olá " + (l.clientName || "") + "! Vi que você acessou nossa barbearia. Que tal agendar um horário?")}" target="_blank" class="btn btn-sm" style="background:#25D366;color:#fff;border:none;font-size:11px;">WhatsApp</a>` : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
      <script>
        const chartData = ${JSON.stringify(chartData)};
        const ctx = document.getElementById('orbitChart');
        if (ctx && chartData.length > 0) {
          new Chart(ctx, {
            type: 'line',
            data: {
              labels: chartData.map(d => {
                const [y,m,dd] = d.date.split('-');
                return dd + '/' + m;
              }),
              datasets: [
                {
                  label: 'Leads',
                  data: chartData.map(d => d.leads),
                  borderColor: '#C9A84C',
                  backgroundColor: '#C9A84C22',
                  fill: true,
                  tension: 0.3,
                },
                {
                  label: 'Conversões',
                  data: chartData.map(d => d.conversions),
                  borderColor: '#4ADE80',
                  backgroundColor: '#4ADE8022',
                  fill: true,
                  tension: 0.3,
                },
              ],
            },
            options: {
              responsive: true,
              plugins: {
                legend: { labels: { color: '#F0EEE8', font: { size: 12 } } },
              },
              scales: {
                x: { ticks: { color: '#888880', font: { size: 10 } }, grid: { color: '#2A2A2A' } },
                y: { ticks: { color: '#888880', stepSize: 1 }, grid: { color: '#2A2A2A' }, beginAtZero: true },
              },
            },
          });
        }
      </script>
    `;
    const _tp = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
    res.send(adminLayout("Clientes em Órbita", "orbita", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Clientes em Órbita",href:"/admin/orbita"}]));
  }));

  // ─── Encomendas de Produtos ────────────────────────────────────────────────
  app.get("/admin/encomendas", requireAdminAuth, withErrorPage("Encomendas", "encomendas", async (req: Request, res: Response) => {
    try {
    const session = (req as any).adminSession;
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const statusFilter = (req.query.status as string) || "all";
    const orders = await db.getProductOrdersByTenant(tenantId ?? 0, statusFilter);
    const enriched = await Promise.all(orders.map(async (o: any) => {
      const product = await db.getProductById(o.productId);
      const client = await db.getClientById(o.clientId);
      return { ...o, product, client };
    }));
    const statusLabels: Record<string, string> = {
      received: "Recebido", confirmed: "Confirmado", preparing: "Em preparo",
      ready: "Pronto p/ retirada", delivered: "Entregue", cancelled: "Cancelado"
    };
    const statusColors: Record<string, string> = {
      received: "#F59E0B", confirmed: "#3B82F6", preparing: "#8B5CF6",
      ready: "#10B981", delivered: "#22C55E", cancelled: "#EF4444"
    };
    const orderRows = enriched.map((o: any) => {
      const label = statusLabels[o.status] ?? o.status;
      const color = statusColors[o.status] ?? "#888";
      const date = new Date(o.createdAt).toLocaleDateString("pt-BR");
      const clientPhone = (o.client?.phone ?? "").replace(/\D/g, "");
      const waMsg = encodeURIComponent(`Ol\u00e1 ${o.client?.name ?? ""}! Seu pedido de ${o.quantity}x ${o.product?.name ?? "produto"} est\u00e1 com status: *${label}*.`);
      const waLink = clientPhone ? `<a href="https://wa.me/55${clientPhone}?text=${waMsg}" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">\uD83D\uDCF2 WhatsApp</a>` : "";
      const statusOptions = Object.entries(statusLabels).map(([v, l]) =>
        `<option value="${v}" ${o.status === v ? "selected" : ""}>${l}</option>`
      ).join("");
      return `<tr>
        <td><strong>${esc(o.client?.name ?? "\u2014")}</strong><br><small style="color:var(--muted)">${esc(o.client?.phone ?? "")}</small></td>
        <td>${esc(o.product?.name ?? "\u2014")}<br><small style="color:var(--muted)">Qtd: ${o.quantity}${o.note ? " \u00b7 " + esc(o.note) : ""}</small></td>
        <td><span style="background:${color}22;color:${color};padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700">${label}</span></td>
        <td>${date}</td>
        <td>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;cursor:pointer">
              ${statusOptions}
            </select>
            ${waLink}
          </div>
        </td>
      </tr>`;
    }).join("");
    const filterBtns = ["all","received","confirmed","preparing","ready","delivered","cancelled"].map(s => {
      const lb: Record<string,string> = {all:"Todos",received:"Recebidos",confirmed:"Confirmados",preparing:"Em preparo",ready:"Prontos",delivered:"Entregues",cancelled:"Cancelados"};
      return `<a href="/admin/encomendas?status=${s}" class="btn ${statusFilter===s?"btn-primary":"btn-ghost"}" style="font-size:13px;padding:8px 16px">${lb[s]}</a>`;
    }).join("");
    const body = `
      <div style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
          <h1 style="font-size:24px;font-weight:700;color:var(--text)">Encomendas de Produtos</h1>
          <div style="font-size:14px;color:var(--muted)">${enriched.length} pedido(s)</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">${filterBtns}</div>
        ${enriched.length === 0
          ? `<div class="card" style="text-align:center;padding:48px"><div style="font-size:48px;margin-bottom:12px;color:var(--muted)">&#9993;</div><p style="color:var(--muted)">Nenhuma encomenda encontrada</p></div>`
          : `<div class="card" style="overflow-x:auto"><table class="table"><thead><tr><th>Cliente</th><th>Produto</th><th>Status</th><th>Data</th><th>A\u00e7\u00f5es</th></tr></thead><tbody>${orderRows}</tbody></table></div>`}
      </div>
      <script>
        function updateOrderStatus(id, status) {
          fetch('/admin-api/order-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, status: status })
          }).then(function(r){ return r.json(); }).then(function(data) {
            if (data.success) { window.location.reload(); }
            else { alert('Erro: ' + (data.error || 'Erro desconhecido')); }
          });
        }
      </script>
    `;
    const _tp2 = barber?.tenantId ? (await db.getTenantById(barber.tenantId))?.plan ?? "" : "";
    res.send(adminLayout("Encomendas", "encomendas", body, barber?.name, _tp2, [{label:"Dashboard",href:"/admin"},{label:"Encomendas",href:"/admin/encomendas"}]));
    } catch (err: any) {
      console.error('[/admin/encomendas] Erro:', err?.message);
      res.send(adminLayout("Encomendas", "encomendas", `<div style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="color:var(--text);margin-bottom:8px">Erro ao carregar página</h2><p style="color:var(--muted);margin-bottom:20px">Ocorreu um problema de conexão com o banco de dados. Aguarde alguns segundos e tente novamente.</p><a href="/admin/encomendas" class="btn btn-primary">Tentar novamente</a></div>`));
    }
  }));

  app.post("/admin-api/order-status", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { id, status } = req.body;
      if (!id || !status) { res.status(400).json({ error: "Dados incompletos" }); return; }
      await db.updateProductOrderStatus(parseInt(id), status);
      if (status === "delivered") {
        const order = await db.getProductOrderById(parseInt(id));
        if (order) {
          const product = await db.getProductById(order.productId);
          if (product) {
            const newStock = Math.max(0, (product.stockQuantity ?? 0) - order.quantity);
            await db.updateProduct(order.productId, { stockQuantity: newStock });
          }
        }
      }
       res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /admin/app-qrcode — Gera QR Code para download do app (Play Store)
  app.get("/admin/app-qrcode", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const playStoreUrl = process.env.PLAY_STORE_URL ?? "https://play.google.com/store/apps/details?id=space.manus.barber.app";
      const QRCode = await import("qrcode");
      const qrBuffer = await QRCode.default.toBuffer(playStoreUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(qrBuffer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /admin-api/cancel-asaas-charge — Cancelar cobrança Asaas pendente
  app.post("/admin-api/cancel-asaas-charge", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { asaasPaymentId } = req.body;
      if (!asaasPaymentId) { res.status(400).json({ error: "asaasPaymentId é obrigatório" }); return; }
      if (!asaasEnabled) { res.status(503).json({ error: "Asaas não configurado" }); return; }
      const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? "";
      const ASAAS_SANDBOX = process.env.ASAAS_SANDBOX === "true";
      const ASAAS_BASE_URL = ASAAS_SANDBOX ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
      await axios.delete(`${ASAAS_BASE_URL}/payments/${asaasPaymentId}`, {
        headers: { "access_token": ASAAS_API_KEY, "Content-Type": "application/json" },
        timeout: 15000,
      });
      const dbConn = await db.getDb();
      if (dbConn) {
        await dbConn.execute(sql`UPDATE online_payments SET status = 'cancelled', updatedAt = NOW() WHERE asaasPaymentId = ${asaasPaymentId}`);
      }
      res.json({ ok: true });
    } catch (e: any) {
      const msg = e?.response?.data?.errors?.[0]?.description || e?.response?.data?.description || e.message;
      console.error("[cancel-asaas-charge]", msg);
      res.status(500).json({ error: msg });
    }
  });
  // POST /admin-api/payment-link — Buscar ou gerar link de pagamento para reenvio por WhatsApp
  app.post("/admin-api/payment-link", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { appointmentId, slug } = req.body;
      if (!appointmentId || !slug) { res.status(400).json({ error: "appointmentId e slug são obrigatórios" }); return; }
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const tenantId = barber?.tenantId ?? null;
      // Buscar dados do agendamento
      const appt = await db.getAppointmentById(parseInt(appointmentId));
      if (!appt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
      // Buscar dados do cliente
      const client = appt.clientId ? await db.getClientById(appt.clientId) : null;
      // Buscar configurações da loja
      const settings = await db.getShopSettings(tenantId);
      // Verificar se já existe pagamento pendente no banco
      const dbConn = await db.getDb();
      let existingPayment: any = null;
      if (dbConn && tenantId) {
        const raw = await dbConn.execute(sql`
          SELECT invoiceUrl, asaasPaymentId FROM online_payments
          WHERE tenantId = ${tenantId} AND referenceId = ${parseInt(appointmentId)} AND status = 'pending'
          ORDER BY createdAt DESC LIMIT 1
        `) as any;
        const rows = Array.isArray(raw) ? (raw[0] as any[]) : (raw?.rows ?? []);
        if (rows.length > 0) existingPayment = rows[0];
      }
      // Montar URL de pagamento — usar invoiceUrl do Asaas se disponível, senão link da página pública
      const baseUrl = process.env.PUBLIC_URL || `https://usebarberpro.com`;
      const publicPayUrl = `${baseUrl}/pub/${slug}`;
      const paymentUrl = existingPayment?.invoiceUrl || publicPayUrl;
      res.json({
        ok: true,
        paymentUrl,
        clientName: (client as any)?.name || '',
        clientPhone: (client as any)?.phone || '',
        shopName: settings?.shopName || '',
        hasExistingCharge: !!existingPayment,
      });
    } catch (e: any) {
      console.error("[payment-link]", e.message);
      res.status(500).json({ error: e.message });
    }
  });
  // GET /admin-api/next-appointment — Retorna JSON com o próximo agendamento do dia
  app.get("/admin-api/next-appointment", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      const barber = await db.getBarberById(session.barberId);
      const tenantId = barber?.tenantId ?? null;
      const dateStr = today();
      const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);
      const barbers = await db.getAllBarbers(tenantId);
      const barberMap: Record<number, string> = Object.fromEntries(barbers.map((b) => [b.id, b.name]));
      // Calcular hora atual em BRT (UTC-3)
      const nowMinutes = (() => {
        const now = new Date();
        const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        return brt.getUTCHours() * 60 + brt.getUTCMinutes();
      })();
      const next = appointments
        .filter((a: any) => {
          if (!a.startTime) return false;
          const [h, m] = a.startTime.split(':').map(Number);
          return (h * 60 + m) >= nowMinutes && ['scheduled', 'confirmed'].includes(a.status);
        })
        .sort((a: any, b: any) => {
          const [ah, am] = a.startTime.split(':').map(Number);
          const [bh, bm] = b.startTime.split(':').map(Number);
          return (ah * 60 + am) - (bh * 60 + bm);
        })[0] ?? null;
      if (!next) { res.json({ clientName: null }); return; }
      res.json({
        clientName: (next as any).clientName ?? 'Cliente',
        serviceName: (next as any).serviceName ?? (next as any).serviceNames ?? '',
        barberName: barberMap[(next as any).barberId] ?? '',
        startTime: ((next as any).startTime ?? '').substring(0, 5),
        status: (next as any).status ?? 'scheduled',
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /admin/download-apk — Redireciona para o APK ou Play Store
  app.get("/admin/download-apk", requireAdminAuth, (req: Request, res: Response) => {
    const apkUrl = process.env.APK_DOWNLOAD_URL ?? process.env.PLAY_STORE_URL ?? "https://play.google.com/store/apps/details?id=space.manus.barber.app";
    res.redirect(apkUrl);
  });

  // ─── Fornecedores ─────────────────────────────────────────────────────────
  app.get("/admin/fornecedores", requireAdminAuth, withErrorPage("Fornecedores", "fornecedores", async (req: Request, res: Response) => {
    try {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const _tp = tenantId ? (await db.getTenantById(tenantId))?.plan ?? "" : "";
    const suppliers = tenantId ? await db.getSuppliersByTenant(tenantId) : [];
    const saved = req.query.saved === "1";
    const deleted = req.query.deleted === "1";
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    const editSupplier = editId ? suppliers.find((s: any) => s.id === editId) : null;

    const formHtml = `
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div class="card-title">${editSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</div>
        </div>
        <div class="card-body" style="padding:24px">
          <form method="POST" action="/admin/fornecedores${editSupplier ? `?edit=${editSupplier.id}` : ""}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group">
                <label class="form-label">Nome do Fornecedor *</label>
                <input class="form-input" type="text" name="name" value="${esc((editSupplier as any)?.name ?? "")}" required />
              </div>
              <div class="form-group">
                <label class="form-label">CNPJ</label>
                <input class="form-input" type="text" name="cnpj" value="${esc((editSupplier as any)?.cnpj ?? "")}" placeholder="00.000.000/0000-00" />
              </div>
              <div class="form-group">
                <label class="form-label">Telefone / WhatsApp</label>
                <input class="form-input" type="text" name="phone" value="${esc((editSupplier as any)?.phone ?? "")}" placeholder="(00) 00000-0000" />
              </div>
              <div class="form-group">
                <label class="form-label">E-mail</label>
                <input class="form-input" type="email" name="email" value="${esc((editSupplier as any)?.email ?? "")}" placeholder="email@fornecedor.com" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Endereço</label>
              <input class="form-input" type="text" name="address" value="${esc((editSupplier as any)?.address ?? "")}" placeholder="Rua, número, cidade" />
            </div>
            <div class="form-group">
              <label class="form-label">Observações</label>
              <textarea class="form-input" name="notes" rows="3" style="resize:vertical">${esc((editSupplier as any)?.notes ?? "")}</textarea>
            </div>
            <div style="display:flex;gap:12px;margin-top:8px">
              <button type="submit" class="btn btn-primary" style="padding:12px 28px">${editSupplier ? "Salvar Alterações" : "Criar Fornecedor"}</button>
              ${editSupplier ? `<a href="/admin/fornecedores" class="btn" style="padding:12px 20px;background:var(--surface2);color:var(--text)">Cancelar</a>` : ""}
            </div>
          </form>
        </div>
      </div>
    `;

    const tableHtml = suppliers.length === 0
      ? `<div style="text-align:center;padding:40px;color:var(--muted)">Nenhum fornecedor cadastrado ainda.</div>`
      : `<table class="table">
          <thead><tr><th>Nome</th><th>CNPJ</th><th>Telefone / WhatsApp</th><th>E-mail</th><th>Endereço</th><th>Ações</th></tr></thead>
          <tbody>
            ${suppliers.map((s: any) => `
              <tr>
                <td><strong>${esc(s.name)}</strong>${s.notes ? `<br><small style="color:var(--muted)">${esc(s.notes.substring(0, 60))}${s.notes.length > 60 ? "..." : ""}</small>` : ""}</td>
                <td style="color:var(--muted);font-size:13px">${esc(s.cnpj ?? "—")}</td>
                <td>${s.phone ? `<a href="https://wa.me/55${s.phone.replace(/\D/g,"")}" target="_blank" style="color:var(--gold);text-decoration:none">📱 ${esc(s.phone)}</a>` : `<span style="color:var(--muted)">—</span>`}</td>
                <td style="color:var(--muted);font-size:13px">${esc(s.email ?? "—")}</td>
                <td style="color:var(--muted);font-size:13px">${esc(s.address ?? "—")}</td>
                <td>
                  <div style="display:flex;gap:8px">
                    <a href="/admin/fornecedores/${s.id}" class="btn" style="padding:6px 14px;font-size:12px;background:var(--gold);color:#0A0A0A">Ver detalhes</a>
                    <a href="/admin/fornecedores?edit=${s.id}" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">Editar</a>
                    <form method="POST" action="/admin/fornecedores/delete" style="display:inline" onsubmit="return confirm('Excluir este fornecedor?')">
                      <input type="hidden" name="id" value="${s.id}" />
                      <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:#EF444422;color:#F87171">Excluir</button>
                    </form>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;

    const body = `
      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✓ Fornecedor salvo com sucesso!</div>` : ""}
      ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✓ Fornecedor excluído com sucesso!</div>` : ""}
      ${formHtml}
      <div class="card">
        <div class="card-header">
          <div class="card-title">Fornecedores Cadastrados (${suppliers.length})</div>
        </div>
        <div class="card-body" style="padding:0">
          ${tableHtml}
        </div>
      </div>
    `;
    res.send(adminLayout("Fornecedores", "fornecedores", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Fornecedores",href:"/admin/fornecedores"}]));
    } catch (err: any) {
      console.error('[/admin/fornecedores] Erro:', err?.message);
      res.send(adminLayout("Fornecedores", "fornecedores", `<div style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="color:var(--text);margin-bottom:8px">Erro ao carregar página</h2><p style="color:var(--muted);margin-bottom:20px">Ocorreu um problema de conexão com o banco de dados. Aguarde alguns segundos e tente novamente.</p><a href="/admin/fornecedores" class="btn btn-primary">Tentar novamente</a></div>`));
    }
  }));

  app.post("/admin/fornecedores", requireAdminAuth, async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    if (!tenantId) { res.redirect("/admin/fornecedores"); return; }
    const { name, cnpj, phone, email, address, notes } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    if (editId) {
      await db.updateSupplier(editId, { name, cnpj: cnpj || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null });
    } else {
      await db.createSupplier({ tenantId, name, cnpj: cnpj || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null, isActive: true });
    }
    res.redirect("/admin/fornecedores?saved=1");
  });

  app.post("/admin/fornecedores/delete", requireAdminAuth, async (req: Request, res: Response) => {
    const { id } = req.body;
    await db.deleteSupplier(parseInt(id));
    res.redirect("/admin/fornecedores?deleted=1");
  });

  // ─── Detalhes do Fornecedor (/admin/fornecedores/:id) ─────────────────────────
  app.get("/admin/fornecedores/:id", requireAdminAuth, withErrorPage("Detalhe do Fornecedor", "fornecedores", async (req: Request, res: Response) => {
    const session = (req as any).adminSession as { barberId: number; role: string };
    const barber = await db.getBarberById(session.barberId);
    const tenantId = barber?.tenantId ?? null;
    const _tp = tenantId ? (await db.getTenantById(tenantId))?.plan ?? "" : "";
    const supplierId = parseInt(req.params.id);
    if (isNaN(supplierId)) { res.redirect("/admin/fornecedores"); return; }

    const supplier = await db.getSupplierById(supplierId);
    if (!supplier) { res.redirect("/admin/fornecedores"); return; }

    // Período padrão: últimos 12 meses e ano atual
    const now = new Date();
    const startDate12m = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);
    const startDateThisYear = `${now.getFullYear()}-01-01`;

    const [supplierProducts, supplierHistory, financialData12m, financialDataYear] = await Promise.all([
      db.getProductsBySupplier(supplierId, tenantId),
      tenantId ? db.getStockMovementsBySupplier(supplierId, tenantId, 50) : Promise.resolve([]),
      tenantId ? db.getExpensesBySupplier(tenantId, startDate12m, endDate) : Promise.resolve([]),
      tenantId ? db.getExpensesBySupplier(tenantId, startDateThisYear, endDate) : Promise.resolve([]),
    ]);

    const totalEntradas = supplierHistory.reduce((s: number, m: any) => s + (m.quantity > 0 ? m.quantity : 0), 0);
    const totalProdutos = supplierProducts.length;
    const lowStockCount = supplierProducts.filter((p: any) => p.isActive && (p.stockQuantity ?? p.stock ?? 0) <= (p.minStockAlert ?? 5)).length;

    // Dados financeiros deste fornecedor específico
    const finData12m = (financialData12m as any[]).find((f: any) => f.id === supplierId);
    const finDataYear = (financialDataYear as any[]).find((f: any) => f.id === supplierId);
    const totalCompras12m: number = finData12m?.totalReplenishments ?? 0;
    const totalComprasYear: number = finDataYear?.totalReplenishments ?? 0;
    const totalPedidos12m: number = finData12m?.replenishmentCount ?? 0;

    const infoCard = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div class="card" style="padding:20px">
          <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Fornecedor</div>
          <div style="font-size:22px;font-weight:800;color:var(--text)">${esc(supplier.name)}</div>
          ${supplier.cnpj ? `<div style="font-size:13px;color:var(--muted);margin-top:4px">CNPJ: ${esc(supplier.cnpj)}</div>` : ""}
          ${supplier.phone ? `<div style="margin-top:8px"><a href="https://wa.me/55${supplier.phone.replace(/\D/g,"")}" target="_blank" style="color:#25D366;font-size:13px;text-decoration:none">📱 ${esc(supplier.phone)}</a></div>` : ""}
          ${supplier.email ? `<div style="font-size:13px;color:var(--muted);margin-top:4px">✉ ${esc(supplier.email)}</div>` : ""}
          ${supplier.address ? `<div style="font-size:13px;color:var(--muted);margin-top:4px">📍 ${esc(supplier.address)}</div>` : ""}
          ${supplier.notes ? `<div style="font-size:13px;color:var(--muted);margin-top:8px;font-style:italic">${esc(supplier.notes)}</div>` : ""}
        </div>
        <div style="display:grid;grid-template-rows:1fr 1fr;gap:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="card" style="padding:16px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:var(--gold)">${totalProdutos}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px">Produtos vinculados</div>
            </div>
            <div class="card" style="padding:16px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:var(--success)">${totalEntradas}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px">Unidades recebidas</div>
            </div>
          </div>
          <div class="card" style="padding:16px;text-align:center;background:${lowStockCount > 0 ? "#FF980012" : "var(--surface)"};border-color:${lowStockCount > 0 ? "#FF980044" : "var(--border)"}">
            <div style="font-size:28px;font-weight:800;color:${lowStockCount > 0 ? "#FF9800" : "var(--success)"}">⚠ ${lowStockCount}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px">Produtos com estoque baixo</div>
          </div>
        </div>
      </div>
    `;

    const productsTable = supplierProducts.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--muted)">Nenhum produto vinculado a este fornecedor.</div>`
      : `<table class="table">
          <thead><tr><th>Produto</th><th>Tipo</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${supplierProducts.map((p: any) => {
              const stock = p.stockQuantity ?? p.stock ?? 0;
              const minAlert = p.minStockAlert ?? 5;
              const isLow = p.isActive && stock <= minAlert;
              const stockColor = stock === 0 ? "#F44336" : isLow ? "#FF9800" : "#4CAF50";
              return `<tr>
                <td><strong>${esc(p.name)}</strong>${p.description ? `<br><small style="color:var(--muted)">${esc(p.description.substring(0,60))}${p.description.length>60?"...":""}</small>` : ""}</td>
                <td><span style="background:${p.productType==="sale"?"#0a7ea422":"#C9A84C22"};color:${p.productType==="sale"?"#0a7ea4":"#C9A84C"};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${p.productType==="sale"?"Venda":"Uso Interno"}</span></td>
                <td style="font-weight:700;color:var(--gold)">R$ ${parseFloat(p.price).toFixed(2).replace(".",",")}</td>
                <td><span style="color:${stockColor};font-weight:700">${stock}</span>${isLow?` <span style="font-size:11px;color:#FF9800">⚠ baixo</span>`:""}</td>
                <td><span style="background:${p.isActive?"#4ADE8022":"#EF444422"};color:${p.isActive?"#4ADE80":"#F87171"};padding:3px 10px;border-radius:20px;font-size:12px">${p.isActive?"Ativo":"Inativo"}</span></td>
                <td><a href="/admin/produtos?edit=${p.id}" class="btn" style="padding:5px 12px;font-size:12px;background:var(--surface2);color:var(--text)">Editar</a></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`;

    const historyTable = supplierHistory.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--muted)">Nenhuma entrada de estoque registrada para este fornecedor.</div>`
      : `<table class="table">
          <thead><tr><th>Data</th><th>Produto</th><th>Qtd. Recebida</th><th>Responsável</th><th>Observação</th></tr></thead>
          <tbody>
            ${supplierHistory.map((m: any) => `
              <tr>
                <td style="color:var(--muted);font-size:13px">${m.date ? new Date(m.date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                <td><strong>${esc(m.productName ?? "—")}</strong></td>
                <td><span style="color:#4ADE80;font-weight:700">+${m.quantity}</span></td>
                <td style="color:var(--muted);font-size:13px">${esc(m.barberName ?? "—")}</td>
                <td style="color:var(--muted);font-size:13px">${esc(m.reason ?? "—")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;

    const body = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <a href="/admin/fornecedores" style="color:var(--muted);text-decoration:none;font-size:13px">← Fornecedores</a>
        <span style="color:var(--border)">/</span>
        <span style="font-size:13px;color:var(--text)">${esc(supplier.name)}</span>
        <a href="/admin/fornecedores?edit=${supplier.id}" class="btn" style="margin-left:auto;padding:8px 18px;font-size:13px;background:var(--surface2);color:var(--text)">Editar fornecedor</a>
        ${supplier.phone ? `<a href="https://wa.me/55${supplier.phone.replace(/\D/g,"")}" target="_blank" class="btn" style="padding:8px 18px;font-size:13px;background:#25D36622;color:#25D366;border:1px solid #25D36644">📱 WhatsApp</a>` : ""}
      </div>
      ${infoCard}
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div class="card-title">💰 Resumo Financeiro de Compras</div>
          <span style="font-size:12px;color:var(--muted)">Valor estimado: qtd. recebida × preço do produto</span>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
            <div style="text-align:center;padding:16px;background:var(--surface2);border-radius:12px">
              <div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Últimos 12 meses</div>
              <div style="font-size:24px;font-weight:800;color:var(--gold)">R$ ${totalCompras12m.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px">${totalPedidos12m} reposição${totalPedidos12m !== 1 ? "s" : ""}</div>
            </div>
            <div style="text-align:center;padding:16px;background:var(--surface2);border-radius:12px">
              <div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Ano atual (${now.getFullYear()})</div>
              <div style="font-size:24px;font-weight:800;color:var(--success)">R$ ${totalComprasYear.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px">${finDataYear?.replenishmentCount ?? 0} reposição${(finDataYear?.replenishmentCount ?? 0) !== 1 ? "s" : ""}</div>
            </div>
            <div style="text-align:center;padding:16px;background:var(--surface2);border-radius:12px">
              <div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Ticket médio / pedido</div>
              <div style="font-size:24px;font-weight:800;color:var(--warning)">${totalPedidos12m > 0 ? `R$ ${(totalCompras12m / totalPedidos12m).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px">média por entrada</div>
            </div>
          </div>
          ${totalCompras12m === 0 ? `<div style="margin-top:16px;padding:12px;background:#F59E0B11;border:1px solid #F59E0B33;border-radius:8px;font-size:13px;color:var(--muted)">Nenhuma compra registrada nos últimos 12 meses. Ao repor estoque, selecione o fornecedor para que os valores apareçam aqui.</div>` : ""}
        </div>
      </div>
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div class="card-title">Produtos Vinculados (${totalProdutos})</div>
          <a href="/admin/produtos" class="btn" style="padding:6px 14px;font-size:12px;background:var(--gold);color:#0A0A0A">+ Novo produto</a>
        </div>
        <div class="card-body" style="padding:0">${productsTable}</div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Histórico de Entradas de Estoque (${supplierHistory.length})</div>
        </div>
        <div class="card-body" style="padding:0">${historyTable}</div>
      </div>
    `;
    res.send(adminLayout(`${esc(supplier.name)} — Fornecedor`, "fornecedores", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Fornecedores",href:"/admin/fornecedores"},{label:esc(supplier.name),href:"#"}]));
  }));
}
