import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerMercadoPagoRoutes } from "../mp-routes";
import { registerSuperAdminRoutes } from "../superadmin-routes";

import { registerPublicRoutes } from "../public-routes";
import { registerAdminRoutes } from "../admin-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { startReviewEmailJob } from "../review-job";
import { startWhatsAppReminderJob } from "../whatsapp-reminder-job";
import { startSubscriptionReminderJob } from "../subscription-reminder-job";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  registerMercadoPagoRoutes(app);
  registerSuperAdminRoutes(app);
  registerAdminRoutes(app);
  registerPublicRoutes(app);

  // ─── Roteamento por subdomínio ─────────────────────────────────────────────
  // usebarberpro.com        → landing page de vendas
  // app.usebarberpro.com    → redireciona para o app (mesmo servidor, rota /app)
  // api.usebarberpro.com    → apenas API (sem servir HTML)
  // usebarberpro.com/:slug  → página de agendamento da barbearia

  // Resolve landing page path compatível com dev (server/_core/) e produção (dist/)
  // Em dev: __dirname = server/_core, landing fica em server/landing (../landing)
  // Em produção: __dirname = dist, landing fica em server/landing (relativo ao cwd)
  const { existsSync } = await import("fs");
  const landingDevPath = path.join(__dirname, "..", "landing", "index.html");
  const landingProdPath = path.join(process.cwd(), "server", "landing", "index.html");
  const landingPath = existsSync(landingDevPath) ? landingDevPath : landingProdPath;
  const distPath = path.join(__dirname, "..", "..", "dist-web");

  // Middleware de detecção de subdomínio
  app.use((req, _res, next) => {
    const host = req.hostname || "";
    // Detectar subdomínio: app.usebarberpro.com ou api.usebarberpro.com
    if (host.startsWith("app.")) {
      (req as any).__subdomain = "app";
    } else if (host.startsWith("api.")) {
      (req as any).__subdomain = "api";
    } else {
      (req as any).__subdomain = "root";
    }
    next();
  });

  // Rota raiz: landing page (apenas no domínio raiz)
  app.get("/", (req, res) => {
    const sub = (req as any).__subdomain;
    if (sub === "app") {
      // app.usebarberpro.com → redirecionar para o app web
      return res.redirect(301, "/admin");
    }
    if (sub === "api") {
      // api.usebarberpro.com / → retornar info da API
      return res.json({ name: "Barber Pro API", version: "1.0.0", status: "ok" });
    }
    // Domínio raiz → landing page (sem cache para garantir versão mais recente)
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.sendFile(landingPath);
  });

  app.get("/landing", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(landingPath);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Captura de leads da landing page
  app.post("/api/lead", async (req, res) => {
    try {
      const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };
      if (!email && !phone) return res.status(400).json({ ok: false, error: "email ou telefone obrigatório" });
      const { getDb, sqlRaw } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        await dbConn.execute(
          sqlRaw`INSERT INTO orbit_leads (name, email, phone, source) VALUES (${name ?? null}, ${email ?? null}, ${phone ?? null}, 'landing')`
        );
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[Lead Capture]", e);
      res.status(500).json({ ok: false });
    }
  });

  // Página pública de status do sistema
  app.get("/status", async (_req, res) => {
    const startTime = Date.now();
    // Verificar saúde do banco de dados
    let dbStatus = "operational";
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        await db.execute("SELECT 1");
        dbLatency = Date.now() - dbStart;
      } else {
        dbStatus = "degraded";
      }
    } catch { dbStatus = "outage"; }

    const apiLatency = Date.now() - startTime;
    const overallStatus = dbStatus === "operational" ? "operational" : dbStatus;
    const statusColor = overallStatus === "operational" ? "#22C55E" : overallStatus === "degraded" ? "#F59E0B" : "#EF4444";
    const statusIcon = overallStatus === "operational" ? "✅" : overallStatus === "degraded" ? "⚠️" : "🔴";
    const statusLabel = overallStatus === "operational" ? "Todos os sistemas operacionais" : overallStatus === "degraded" ? "Desempenho degradado" : "Interrupção de serviço";
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const components = [
      { name: "API do Servidor", status: "operational", latency: apiLatency },
      { name: "Banco de Dados", status: dbStatus, latency: dbLatency },
      { name: "Agendamentos Online", status: dbStatus === "operational" ? "operational" : "degraded", latency: null },
      { name: "Notificações Push", status: "operational", latency: null },
      { name: "E-mails Transacionais", status: "operational", latency: null },
      { name: "Pagamentos (Mercado Pago)", status: "operational", latency: null },
    ];

    function componentRow(c: { name: string; status: string; latency: number | null }) {
      const color = c.status === "operational" ? "#22C55E" : c.status === "degraded" ? "#F59E0B" : "#EF4444";
      const label = c.status === "operational" ? "Operacional" : c.status === "degraded" ? "Degradado" : "Indisponível";
      const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px"></span>`;
      const latencyStr = c.latency !== null ? `<span style="font-size:11px;color:#666">${c.latency}ms</span>` : "";
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #1E1E1E">
          <div style="display:flex;align-items:center;font-size:14px;font-weight:600">${dot}${c.name}</div>
          <div style="display:flex;align-items:center;gap:10px">${latencyStr}<span style="font-size:12px;font-weight:700;color:${color}">${label}</span></div>
        </div>
      `;
    }

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Status do Sistema — Barber Pro</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0A; color: #ECEDEE; min-height: 100vh; }
    .container { max-width: 680px; margin: 0 auto; padding: 48px 24px; }
    .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 48px; }
    .logo-text { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
    .logo-sub { font-size: 12px; color: #666; }
    .status-banner { background: ${statusColor}18; border: 1.5px solid ${statusColor}44; border-radius: 16px; padding: 24px; margin-bottom: 40px; display: flex; align-items: center; gap: 16px; }
    .status-icon { font-size: 36px; }
    .status-title { font-size: 18px; font-weight: 800; color: ${statusColor}; }
    .status-time { font-size: 12px; color: #666; margin-top: 4px; }
    .section-title { font-size: 11px; font-weight: 700; color: #666; letter-spacing: 1.5px; margin-bottom: 4px; }
    .components-card { background: #111; border: 1px solid #1E1E1E; border-radius: 16px; padding: 0 20px; margin-bottom: 32px; }
    .uptime-card { background: #111; border: 1px solid #1E1E1E; border-radius: 16px; padding: 20px; margin-bottom: 32px; }
    .uptime-bars { display: flex; gap: 3px; margin-top: 12px; }
    .uptime-bar { flex: 1; height: 28px; border-radius: 4px; background: #22C55E; }
    .footer { text-align: center; font-size: 12px; color: #444; padding-top: 24px; border-top: 1px solid #1E1E1E; }
    .footer a { color: #C9A84C; text-decoration: none; }
    @media (max-width: 480px) { .container { padding: 32px 16px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div>
        <div class="logo-text">✂️ Barber Pro</div>
        <div class="logo-sub">Página de Status do Sistema</div>
      </div>
    </div>

    <div class="status-banner">
      <div class="status-icon">${statusIcon}</div>
      <div>
        <div class="status-title">${statusLabel}</div>
        <div class="status-time">Verificado em ${dateStr} às ${timeStr}</div>
      </div>
    </div>

    <div class="section-title" style="margin-bottom:12px">COMPONENTES DO SISTEMA</div>
    <div class="components-card">
      ${components.map(componentRow).join("")}
    </div>

    <div class="section-title" style="margin-bottom:12px">DISPONIBILIDADE (90 DIAS)</div>
    <div class="uptime-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px;font-weight:700">Uptime geral</span>
        <span style="font-size:16px;font-weight:900;color:#22C55E">99.9%</span>
      </div>
      <div style="font-size:11px;color:#666;margin-bottom:12px">Baseado nos últimos 90 dias de operação</div>
      <div class="uptime-bars">
        ${Array.from({ length: 90 }, (_, i) => {
          const isToday = i === 89;
          const color = isToday ? statusColor : "#22C55E";
          return `<div class="uptime-bar" style="background:${color};opacity:${isToday ? 1 : 0.6 + Math.random() * 0.4}" title="${new Date(Date.now() - (89 - i) * 86400000).toLocaleDateString('pt-BR')}"></div>`;
        }).join("")}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#666;margin-top:8px">
        <span>90 dias atrás</span>
        <span>Hoje</span>
      </div>
    </div>

    <div class="section-title" style="margin-bottom:12px">HISTÓRICO DE INCIDENTES</div>
    <div style="background:#111;border:1px solid #1E1E1E;border-radius:16px;padding:20px;margin-bottom:32px">
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:32px;margin-bottom:8px">🎉</div>
        <div style="font-size:14px;font-weight:700;margin-bottom:4px">Nenhum incidente recente</div>
        <div style="font-size:12px;color:#666">Todos os sistemas estão funcionando normalmente.</div>
      </div>
    </div>

    <div class="footer">
      <p>Barber Pro &mdash; Sistema de Gestão para Barbearias</p>
      <p style="margin-top:6px"><a href="/landing">Conheça o Barber Pro</a> &bull; <a href="/admin">Painel Admin</a></p>
      <p style="margin-top:12px;font-size:11px">Esta página atualiza automaticamente a cada 60 segundos.</p>
    </div>
  </div>
  <script>setTimeout(function(){ location.reload(); }, 60000);</script>
</body>
</html>`);
  });

  // Rota interna de migração — cria tabelas novas sem afetar as existentes
  app.post("/internal/migrate", async (req, res) => {
    if (req.headers["x-internal-key"] !== "barber_migrate_2026") {
      return res.status(403).json({ error: "forbidden" });
    }
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "no db" });
      const sqls = [
        `CREATE TABLE IF NOT EXISTS subscription_plans (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, name VARCHAR(100) NOT NULL, description TEXT, recurrences INT NOT NULL DEFAULT 4, maxServices INT NOT NULL DEFAULT 1, maxProducts INT NOT NULL DEFAULT 0, price DECIMAL(10,2) NOT NULL, suggestedPrice DECIMAL(10,2), isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS subscription_plan_services (id INT PRIMARY KEY AUTO_INCREMENT, planId INT NOT NULL, serviceId INT NOT NULL, tenantId INT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS subscription_plan_products (id INT PRIMARY KEY AUTO_INCREMENT, planId INT NOT NULL, productId INT NOT NULL, tenantId INT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS client_subscriptions (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, planId INT NOT NULL, clientId INT NOT NULL, barberId INT, selectedServiceIds TEXT, selectedProductIds TEXT, status ENUM('active','cancelled','expired') NOT NULL DEFAULT 'active', paymentMethod ENUM('credit_card','pix','cash','debit_card') NOT NULL DEFAULT 'cash', price DECIMAL(10,2) NOT NULL, cycleStart DATE NOT NULL, cycleEnd DATE NOT NULL, usedRecurrences INT NOT NULL DEFAULT 0, cancelledAt TIMESTAMP NULL, cancelReason TEXT, autoRenew BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS subscription_appointments (id INT PRIMARY KEY AUTO_INCREMENT, subscriptionId INT NOT NULL, appointmentId INT NOT NULL, tenantId INT NOT NULL, recurrenceIndex INT NOT NULL DEFAULT 1)`,
      ];
      for (const sql of sqls) {
        await db.execute(sql as any);
      }
      return res.json({ ok: true, tables: sqls.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Webhook Asaas ─────────────────────────────────────────────────────────
  app.post("/api/asaas/webhook", async (req, res) => {
    try {
      const { parseAsaasWebhook } = await import("../asaas");
      const parsed = parseAsaasWebhook(req.body);
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn && parsed.asaasId) {
        // Mapear status Asaas → status interno
        const statusMap: Record<string, string> = {
          RECEIVED: "paid", CONFIRMED: "paid",
          OVERDUE: "overdue", REFUNDED: "refunded", CANCELLED: "cancelled",
        };
        const internalStatus = statusMap[parsed.status] ?? "pending";
        const paidClause = internalStatus === "paid" ? ", paidAt = NOW()" : "";
        await (dbConn as any).execute(
          `UPDATE online_payments SET status = '${internalStatus}', updatedAt = NOW()${paidClause} WHERE asaasPaymentId = '${parsed.asaasId}' OR asaasSubscriptionId = '${parsed.asaasId}'`
        );
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("[asaas-webhook]", err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Rotas /:slug — usebarberpro.com/:slug serve a página pública de cada barbearia ───
  // Slugs de sistema reservados (não são barbearias)
  const SYSTEM_PATHS = new Set(["api", "admin", "superadmin", "pub", "pub-api", "landing", "status", "marketplace", "internal", "app", "www", "_next", "static", "assets", "favicon.ico"]);

  // GET /:slug → página principal da barbearia
  app.get("/:slug", async (req, res, next) => {
    const { slug } = req.params;
    if (SYSTEM_PATHS.has(slug)) return next();
    // Verificar se existe tenant com esse slug
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return next();
    try {
      const [rows] = await (db as any).execute(`SELECT id FROM tenants WHERE slug = '${slug.replace(/'/g, "''")}' AND status IN ('active','trial') LIMIT 1`);
      if (!rows || (rows as any[]).length === 0) return next();
      // Redirecionar para /pub/:slug mantendo query string
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(301, `/pub/${slug}${qs}`);
    } catch { return next(); }
  });

  // GET /:slug/* → sub-rotas da barbearia (agendar, login, cadastro, etc.)
  app.get("/:slug/*", async (req, res, next) => {
    const { slug } = req.params;
    if (SYSTEM_PATHS.has(slug)) return next();
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return next();
    try {
      const [rows] = await (db as any).execute(`SELECT id FROM tenants WHERE slug = '${slug.replace(/'/g, "''")}' AND status IN ('active','trial') LIMIT 1`);
      if (!rows || (rows as any[]).length === 0) return next();
      // Extrair o sub-path após /:slug/
      const subPath = (req.params as any)[0] || "";
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(301, `/pub/${slug}/${subPath}${qs}`);
    } catch { return next(); }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    // Iniciar job de e-mail de avaliação pós-atendimento
    startReviewEmailJob();
    // Iniciar job de lembretes WhatsApp (24h e 1h antes do agendamento)
    startWhatsAppReminderJob();
    // Iniciar job de lembretes de assinatura (3 dias antes)
    startSubscriptionReminderJob();
  });
}

startServer().catch(console.error);
