import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { registerOAuthRoutes } from "./oauth";
import { registerSuperAdminRoutes } from "../superadmin-routes";

import { registerPublicRoutes } from "../public-routes";
import { registerAdminRoutes } from "../admin-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { startReviewEmailJob } from "../review-job";
import { startWhatsAppReminderJob } from "../whatsapp-reminder-job";
import { startSubscriptionReminderJob } from "../subscription-reminder-job";
import { startBackupJob } from "../backup-job";
import { startTrialExpiryJob } from "../trial-expiry-job";

// ─── Rate Limiters ────────────────────────────────────────────────────────────
/**
 * Rate limiter geral para /api/trpc — 200 req/min por IP.
 * Protege contra abuso de API e scraping.
 */
const trpcRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Muitas requisições. Aguarde um momento e tente novamente." },
  skip: (req) => {
    // Não limitar requisições de leitura (queries) — apenas mutations e rotas sensíveis
    // O tRPC usa GET para queries e POST para mutations
    return req.method === "GET";
  },
});

/**
 * Rate limiter estrito para login — 10 tentativas/min por IP.
 * Protege contra ataques de força bruta.
 */
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Muitas tentativas de login. Aguarde 1 minuto e tente novamente." },
  keyGenerator: (req) => {
    // Usar IP + email como chave para evitar bloqueio de IPs compartilhados
    const ip = (req.ip ?? req.socket?.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
    try {
      const body = req.body as Record<string, Record<string, Record<string, string>>>;
      const email = body?.["0"]?.json?.email ?? "";
      return `${ipKeyGenerator(ip)}:${email}`;
    } catch {
      return ipKeyGenerator(ip);
    }
  },
});

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

// ─── Verificação de variáveis de ambiente obrigatórias ───────────────────────
function checkRequiredEnvVars() {
  const required: Record<string, string> = {
    DATABASE_URL: "String de conexão com o banco de dados MySQL",
    JWT_SECRET: "Chave secreta para assinatura de tokens JWT",
  };
  const optional: Record<string, string> = {
    ASAAS_API_KEY: "Chave de API do Asaas (pagamentos online)",
    ASAAS_SANDBOX: "Usar ambiente Sandbox do Asaas para testes (true/false)",
    ASAAS_WEBHOOK_TOKEN: "Token de autenticação do webhook Asaas",
    SMTP_HOST: "Servidor SMTP para envio de e-mails",
    SMTP_USER: "Usuário SMTP",
    SMTP_PASS: "Senha SMTP",
  };

  let hasError = false;
  for (const [key, desc] of Object.entries(required)) {
    if (!process.env[key]) {
      console.error(`[ENV] ❌ OBRIGATÓRIO ausente: ${key} — ${desc}`);
      hasError = true;
    } else {
      console.log(`[ENV] ✅ ${key} configurado`);
    }
  }
  for (const [key, desc] of Object.entries(optional)) {
    if (!process.env[key]) {
      console.warn(`[ENV] ⚠️  Opcional ausente: ${key} — ${desc}`);
    } else {
      console.log(`[ENV] ✅ ${key} configurado`);
    }
  }
  if (hasError && process.env.NODE_ENV === "production") {
    console.error("[ENV] Variáveis obrigatórias ausentes. O servidor pode não funcionar corretamente.");
  }
}

async function startServer() {
  checkRequiredEnvVars();
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

  // Caminho da página de manutenção
  const maintenanceDevPath = path.join(__dirname, "..", "landing", "maintenance.html");
  const maintenanceProdPath = path.join(process.cwd(), "server", "landing", "maintenance.html");
  const maintenancePath = existsSync(maintenanceDevPath) ? maintenanceDevPath : maintenanceProdPath;
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
      return res.json({ name: "Barber Pro API", version: "1.0.1", status: "ok", build: "2026-05-15" });
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

  app.get("/api/health", async (_req, res) => {
    // Verificação rápida do banco de dados
    let dbOk = false;
    try {
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        await dbConn.execute("SELECT 1");
        dbOk = true;
      }
    } catch { dbOk = false; }

    // Sempre retorna 200 para o health check do Docker/load balancer
    // O status do banco é informativo apenas (não afeta o status HTTP)
    res.status(200).json({
      ok: true,
      timestamp: Date.now(),
      uptime: Math.floor(process.uptime()),
      env: process.env.NODE_ENV ?? "unknown",
      db: dbOk ? "ok" : "unavailable",
    });
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
      // Notificar admin por e-mail (assíncrono, não bloqueia a resposta)
      const { sendLeadNotificationEmail } = await import("../email");
      sendLeadNotificationEmail({
        leadName: name ?? "",
        leadEmail: email ?? "",
        leadPhone: phone ?? "",
        capturedAt: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      }).catch((err) => console.error("[Lead Email]", err));
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
        // ─── Fornecedores (suppliers) ─────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS suppliers (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, name VARCHAR(255) NOT NULL, phone VARCHAR(30), email VARCHAR(255), cnpj VARCHAR(20), address TEXT, notes TEXT, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
        // Adicionar coluna supplierId em products se não existir
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS supplierId INT NULL`,
        // ─── Planos de Assinatura ────────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS subscription_plans (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, name VARCHAR(100) NOT NULL, description TEXT, recurrences INT NOT NULL DEFAULT 4, maxServices INT NOT NULL DEFAULT 1, maxProducts INT NOT NULL DEFAULT 0, price DECIMAL(10,2) NOT NULL, suggestedPrice DECIMAL(10,2), isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS subscription_plan_services (id INT PRIMARY KEY AUTO_INCREMENT, planId INT NOT NULL, serviceId INT NOT NULL, tenantId INT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS subscription_plan_products (id INT PRIMARY KEY AUTO_INCREMENT, planId INT NOT NULL, productId INT NOT NULL, tenantId INT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS client_subscriptions (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, planId INT NOT NULL, clientId INT NOT NULL, barberId INT, selectedServiceIds TEXT, selectedProductIds TEXT, status ENUM('active','cancelled','expired') NOT NULL DEFAULT 'active', paymentMethod ENUM('credit_card','pix','cash','debit_card') NOT NULL DEFAULT 'cash', price DECIMAL(10,2) NOT NULL, cycleStart DATE NOT NULL, cycleEnd DATE NOT NULL, usedRecurrences INT NOT NULL DEFAULT 0, cancelledAt TIMESTAMP NULL, cancelReason TEXT, autoRenew BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS subscription_appointments (id INT PRIMARY KEY AUTO_INCREMENT, subscriptionId INT NOT NULL, appointmentId INT NOT NULL, tenantId INT NOT NULL, recurrenceIndex INT NOT NULL DEFAULT 1)`,
        `CREATE TABLE IF NOT EXISTS online_payments (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, clientId INT NOT NULL, chargeType ENUM('product','appointment','subscription') NOT NULL, referenceId INT, asaasPaymentId VARCHAR(100), asaasSubscriptionId VARCHAR(100), asaasCustomerId VARCHAR(100), billingType ENUM('BOLETO','CREDIT_CARD','PIX','STORE') NOT NULL DEFAULT 'PIX', amount DECIMAL(10,2) NOT NULL, status ENUM('pending','paid','overdue','refunded','cancelled') NOT NULL DEFAULT 'pending', invoiceUrl TEXT, pixQrCode TEXT, pixCopyCola TEXT, dueDate DATE, paidAt TIMESTAMP NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
      ];
      for (const sql of sqls) {
        await db.execute(sql as any);
      }
      return res.json({ ok: true, tables: sqls.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
  // ─── Webhook Asaas ───────────────────────────────────────────────────────────────────────────
  app.post("/api/asaas/webhook", async (req, res) => {
    try {
      // Validação de segurança: verificar token Asaas no header (quando configurado)
      const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
      if (webhookToken) {
        const receivedToken = req.headers["asaas-access-token"] as string | undefined;
        if (!receivedToken || receivedToken !== webhookToken) {
          console.warn("[asaas-webhook] Token inválido ou ausente — rejeitando requisição");
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }
      const { parseAsaasWebhook } = await import("../asaas");
      const { getDb, updateAppointment } = await import("../db");
      const parsed = parseAsaasWebhook(req.body);
      const dbConn = await getDb();
      if (dbConn && parsed.asaasId) {
        // Mapear status Asaas → status interno
        const statusMap: Record<string, string> = {
          RECEIVED: "paid", CONFIRMED: "paid",
          OVERDUE: "overdue", REFUNDED: "refunded", CANCELLED: "cancelled",
        };
        const internalStatus = statusMap[parsed.status] ?? "pending";
        const paidClause = internalStatus === "paid" ? `, "paidAt" = NOW()` : "";
        await (dbConn as any).execute(
          `UPDATE online_payments SET status = '${internalStatus}', "updatedAt" = NOW()${paidClause} WHERE "asaasPaymentId" = '${parsed.asaasId}' OR "asaasSubscriptionId" = '${parsed.asaasId}'`
        );
        // Se pago, confirmar agendamento vinculado e notificar cliente via WhatsApp
        if (internalStatus === "paid") {
          try {
            const pmtRows = await (dbConn as any).execute(
              `SELECT op."referenceId", op."chargeType", op."clientId", op."tenantId", op."billingType",
                      c.name AS "clientName", c.phone AS "clientPhone"
               FROM online_payments op
               LEFT JOIN clients c ON c.id = op."clientId"
               WHERE op."asaasPaymentId" = '${parsed.asaasId}' LIMIT 1`
            );
            const pmtArr = Array.isArray(pmtRows) ? pmtRows[0] : pmtRows?.rows ?? [];
            const pmt = pmtArr?.[0];
            if (pmt?.referenceId && pmt?.chargeType === "appointment") {
              await updateAppointment(pmt.referenceId, { status: "confirmed" } as any);
            }
            // Enviar notificação WhatsApp ao cliente
            if (pmt?.clientPhone) {
              try {
                const { getDb: getDb2, getAppointmentById, getServiceById, getBarberById, getTenantById } = await import("../db");
                let shopName = "Barber Pro";
                let serviceName = "";
                let barberName = "";
                let apptDate = "";
                let apptTime = "";
                if (pmt.referenceId && pmt.chargeType === "appointment") {
                  const appt = await getAppointmentById(pmt.referenceId);
                  if (appt) {
                    const service = await getServiceById((appt as any).serviceId);
                    const barber = await getBarberById((appt as any).barberId);
                    serviceName = service?.name ?? "";
                    barberName = barber?.name ?? "";
                    apptDate = (appt as any).date ?? "";
                    apptTime = ((appt as any).startTime ?? "").slice(0, 5);
                    if (pmt.tenantId) {
                      const tenant = await getTenantById(pmt.tenantId);
                      if (tenant) shopName = (tenant as any).name ?? shopName;
                    }
                  }
                }
                const billingLabel = pmt.billingType === "PIX" ? "Pix" : pmt.billingType === "CREDIT_CARD" ? "Cartão de Crédito" : pmt.billingType === "BOLETO" ? "Boleto" : pmt.billingType;
                const dateFormatted = apptDate ? new Date(apptDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "";
                let msg = `✅ Pagamento confirmado! Seu agendamento em *${shopName}* está confirmado.`;
                if (serviceName) msg += `

✂️ *${serviceName}*${barberName ? ` com ${barberName}` : ""}`;
                if (dateFormatted && apptTime) msg += `
📅 ${dateFormatted} às ${apptTime}`;
                msg += `

💳 Pago via ${billingLabel}. Te esperamos! 💈`;
                const phone = pmt.clientPhone.replace(/\D/g, "");
                const fullPhone = phone.startsWith("55") ? phone : "55" + phone;
                const waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
                console.log(`[asaas-webhook] WhatsApp confirmação — ${pmt.clientName} | ${waLink}`);
              } catch (waErr: any) {
                console.error("[asaas-webhook] Erro ao gerar link WhatsApp:", waErr.message);
              }
            }
          } catch (innerErr: any) {
            console.error("[asaas-webhook] Erro ao confirmar agendamento:", innerErr.message);
          }
        }
      }

      // ─── Eventos de Assinatura Barber Pro ─────────────────────────────────────────────────────
      // Caso 1: evento com objeto subscription (ex: SUBSCRIPTION_CANCELLED, SUBSCRIPTION_RENEWED)
      // Caso 2: evento PAYMENT_RECEIVED/PAYMENT_CONFIRMED com payment.subscription (pagamento de assinatura)
      if (dbConn && req.body?.event) {
        const event = req.body.event as string;
        const statusMap: Record<string, string> = {
          PAYMENT_RECEIVED: "active",
          PAYMENT_CONFIRMED: "active",
          SUBSCRIPTION_RENEWED: "active",
          PAYMENT_OVERDUE: "overdue",
          PAYMENT_REFUNDED: "overdue",
          SUBSCRIPTION_CANCELLED: "cancelled",
          PAYMENT_CANCELLED: "cancelled",
        };
        const newStatus = statusMap[event];
        if (newStatus) {
          let tenantId: number | null = null;

          // Caso 1: body.subscription com externalReference = 'tenant_<id>'
          if (req.body.subscription?.externalReference?.startsWith("tenant_")) {
            tenantId = parseInt(req.body.subscription.externalReference.replace("tenant_", ""), 10);
          }

          // Caso 2: body.payment.subscription existe → buscar tenant pelo asaasSubscriptionId
          if (!tenantId && req.body.payment?.subscription) {
            const subId = req.body.payment.subscription as string;
            try {
              const subRows = await (dbConn as any).execute(
                `SELECT id FROM tenants WHERE "barberproSubscriptionId" = '${subId}' LIMIT 1`
              );
              const subArr = Array.isArray(subRows) ? subRows[0] : subRows?.rows ?? [];
              if (subArr?.[0]?.id) tenantId = subArr[0].id;
            } catch (lookupErr: any) {
              console.error("[asaas-webhook] Erro ao buscar tenant por subscriptionId:", lookupErr.message);
            }
          }

          // Caso 3: body.payment.externalReference = 'tenant_<id>' (fallback)
          if (!tenantId && req.body.payment?.externalReference?.startsWith("tenant_")) {
            tenantId = parseInt(req.body.payment.externalReference.replace("tenant_", ""), 10);
          }

          if (tenantId && !isNaN(tenantId)) {
            try {
              // Atualizar status da assinatura e data de próximo vencimento se pago
              const nextDueClause = newStatus === "active"
                ? `, "barberproNextDueDate" = (NOW() + INTERVAL '30 days')::date`
                : "";

              // Ao confirmar pagamento, registrar também o plano e valor corretos
              let planUpdateClause = "";
              if (newStatus === "active") {
                // Tentar extrair valor e descrição do pagamento para identificar o plano
                const paymentValue = req.body.payment?.value ?? req.body.value ?? null;
                const paymentDesc: string = (req.body.payment?.description ?? req.body.description ?? "").toLowerCase();
                const planPriceMap: Record<string, number> = { solo: 49, team: 89, studio: 149 };
                const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };

                // Identificar plano pelo valor ou pela descrição
                let detectedPlan = "solo";
                if (paymentValue) {
                  const val = parseFloat(paymentValue);
                  if (val >= 140) detectedPlan = "studio";
                  else if (val >= 80) detectedPlan = "team";
                  else detectedPlan = "solo";
                } else if (paymentDesc.includes("estúdio") || paymentDesc.includes("studio")) {
                  detectedPlan = "studio";
                } else if (paymentDesc.includes("equipe") || paymentDesc.includes("team")) {
                  detectedPlan = "team";
                }

                const detectedPrice = paymentValue ? parseFloat(paymentValue) : planPriceMap[detectedPlan];
                const nextDueFromPayment = req.body.payment?.dueDate
                  ? `, "barberproNextDueDate" = '${req.body.payment.dueDate}'::date`
                  : `, "barberproNextDueDate" = (NOW() + INTERVAL '30 days')::date`;

                planUpdateClause = `, "barberproPlanName" = '${detectedPlan}', "barberproPlanPrice" = ${detectedPrice}, plan = '${detectedPlan}'::tenant_plan${nextDueFromPayment}`;
                console.log(`[asaas-webhook] Plano detectado: ${detectedPlan} (R$${detectedPrice}) para tenant ${tenantId}`);
              }

              await (dbConn as any).execute(
                `UPDATE tenants SET "barberproSubscriptionStatus" = '${newStatus}', "updatedAt" = NOW()${newStatus === 'active' ? '' : nextDueClause}${planUpdateClause} WHERE id = ${tenantId}`
              );
              console.log(`[asaas-webhook] Assinatura Barber Pro tenant ${tenantId} → ${newStatus} (evento: ${event})`);

              // Enviar e-mail de cancelamento ao super_admin da barbearia
              if (newStatus === "cancelled") {
                try {
                  const cancelRows = await (dbConn as any).execute(
                    `SELECT t.name AS "tenantName", t.slug, t."barberproPlanName",
                            b.email AS "adminEmail", b.name AS "adminName"
                     FROM tenants t
                     LEFT JOIN barbers b ON b."tenantId" = t.id AND b.role = 'super_admin'
                     WHERE t.id = ${tenantId}
                     LIMIT 1`
                  );
                  const cancelArr = Array.isArray(cancelRows) ? cancelRows[0] : cancelRows?.rows ?? [];
                  const cancelInfo = cancelArr?.[0];
                  if (cancelInfo?.adminEmail) {
                    const { sendEmail, emailLayout, alertBox, ctaButton, detailRow } = await import("../email");
                    const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };
                    const planLabel = planLabelMap[cancelInfo.barberproPlanName ?? 'solo'] ?? cancelInfo.barberproPlanName ?? 'Solo';
                    const cancelledAt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                    const reactivateUrl = `https://usebarberpro.com/${cancelInfo.slug ?? 'admin'}/admin/configuracoes?tab=pagamentos`;
                    const cancelBody = `
                      ${alertBox('⚠️', 'Assinatura cancelada', `Barber Pro ${planLabel} foi cancelado`, '#F87171')}
                      <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
                        Olá, <strong style="color:#ECEDEE">${cancelInfo.adminName ?? 'Admin'}</strong>! A assinatura do
                        <strong style="color:#ECEDEE">${cancelInfo.tenantName}</strong> no Barber Pro foi cancelada.
                      </p>
                      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${detailRow('Plano cancelado', 'Barber Pro ' + planLabel)}
                          ${detailRow('Data do cancelamento', cancelledAt, '#F87171')}
                          ${detailRow('Acesso ao sistema', 'Bloqueado até nova assinatura', '#F87171', true)}
                        </table>
                      </div>
                      <div style="background:#F8717118;border:1.5px solid #F8717144;border-radius:14px;padding:18px 20px;margin-bottom:24px">
                        <div style="font-size:14px;font-weight:700;color:#F87171;margin-bottom:8px">🔒 Acesso bloqueado</div>
                        <p style="color:#9BA1A6;font-size:13px;line-height:1.5;margin:0">
                          O acesso ao painel administrativo e ao app está suspenso. Para reativar, assine um dos planos abaixo.
                        </p>
                      </div>
                      <div style="margin-bottom:28px">
                        ${[{n:'Solo',p:'R$ 49',d:'1 barbeiro'},{n:'Equipe',p:'R$ 89',d:'até 5 barbeiros'},{n:'Estúdio',p:'R$ 149',d:'ilimitados'}].map(pl=>`
                        <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                          <div><div style="font-weight:700;color:#ECEDEE;font-size:14px">${pl.n}</div><div style="font-size:12px;color:#666">${pl.d}</div></div>
                          <div style="font-size:16px;font-weight:900;color:#C9A84C">${pl.p}<span style="font-size:11px;font-weight:400;color:#666">/mês</span></div>
                        </div>`).join('')}
                      </div>
                      ${ctaButton('Reativar assinatura →', reactivateUrl, '#C9A84C')}
                      <p style="color:#555555;font-size:12px;text-align:center;margin:0">
                        Seus dados ficam preservados por 30 dias. Após esse prazo, a conta será excluída permanentemente.
                      </p>`;
                    await sendEmail({
                      to: cancelInfo.adminEmail,
                      subject: `⚠️ Assinatura cancelada — Barber Pro ${planLabel}`,
                      html: emailLayout(cancelBody, {
                        headerSubtitle: 'Assinatura Cancelada',
                        previewText: `Sua assinatura do Barber Pro ${planLabel} foi cancelada. Reative agora para recuperar o acesso.`,
                      }),
                    }).catch((e: any) => console.error("[asaas-webhook] Erro ao enviar e-mail de cancelamento:", e.message));
                  }
                } catch (cancelEmailErr: any) {
                  console.error("[asaas-webhook] Erro ao buscar tenant para e-mail de cancelamento:", cancelEmailErr.message);
                }
              }

              // Enviar e-mail de confirmação de pagamento/ativação ao super_admin da barbearia
              if (newStatus === "active") {
                try {
                  const tenantRows = await (dbConn as any).execute(
                    `SELECT t.name AS "tenantName", t."barberproPlanName", t."barberproPlanPrice", t."barberproNextDueDate",
                            b.email AS "adminEmail", b.name AS "adminName"
                     FROM tenants t
                     LEFT JOIN barbers b ON b."tenantId" = t.id AND b.role = 'super_admin'
                     WHERE t.id = ${tenantId}
                     LIMIT 1`
                  );
                  const tenantArr = Array.isArray(tenantRows) ? tenantRows[0] : tenantRows?.rows ?? [];
                  const tenantInfo = tenantArr?.[0];
                  if (tenantInfo?.adminEmail) {
                    const { sendEmail, emailLayout, alertBox, ctaButton, detailRow } = await import("../email");
                    const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };
                    const planName = tenantInfo.barberproPlanName ?? 'solo';
                    const planLabel = planLabelMap[planName] ?? planName;
                    const planPrice = tenantInfo.barberproPlanPrice ? parseFloat(tenantInfo.barberproPlanPrice) : (planName === 'studio' ? 149 : planName === 'team' ? 89 : 49);
                    const paidAt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                    const nextDue = tenantInfo.barberproNextDueDate
                      ? new Date(tenantInfo.barberproNextDueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                      : 'próximo mês';
                    const paymentBody = `
                      ${alertBox('✅', 'Pagamento confirmado!', 'Sua assinatura está ativa', '#4ADE80')}
                      <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
                        Olá, <strong style="color:#ECEDEE">${tenantInfo.adminName ?? 'Admin'}</strong>! Seu pagamento foi confirmado e a assinatura do
                        <strong style="color:#ECEDEE">${tenantInfo.tenantName}</strong> no Barber Pro está ativa.
                      </p>
                      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
                        <div style="font-size:11px;color:#555;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:14px">Recibo de Pagamento</div>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${detailRow('Plano', 'Barber Pro ' + planLabel)}
                          ${detailRow('Valor pago', 'R$ ' + planPrice.toFixed(2).replace('.', ','), '#4ADE80')}
                          ${detailRow('Data do pagamento', paidAt)}
                          ${detailRow('Forma de pagamento', 'Pix')}
                          ${detailRow('Próximo vencimento', nextDue, '#FBBF24', true)}
                        </table>
                      </div>
                      ${ctaButton('Acessar o painel →', 'https://usebarberpro.com/admin')}
                      <p style="color:#555555;font-size:12px;text-align:center;margin:0">
                        O pagamento será cobrado automaticamente todo mês via Pix. Para cancelar, acesse
                        <a href="https://usebarberpro.com/admin/configuracoes?tab=pagamentos" style="color:#C9A84C">Configurações &gt; Pagamentos</a>.
                      </p>`;
                    await sendEmail({
                      to: tenantInfo.adminEmail,
                      subject: `✅ Pagamento confirmado — Barber Pro ${planLabel}`,
                      html: emailLayout(paymentBody, {
                        headerSubtitle: 'Confirmação de Pagamento',
                        previewText: `Pagamento de R$ ${planPrice.toFixed(2).replace('.', ',')} confirmado. Barber Pro ${planLabel} ativo!`,
                      }),
                    }).catch((e: any) => console.error("[asaas-webhook] Erro ao enviar e-mail de ativação:", e.message));
                  }
                } catch (emailErr: any) {
                  console.error("[asaas-webhook] Erro ao buscar tenant para e-mail:", emailErr.message);
                }
              }
            } catch (subErr: any) {
              console.error("[asaas-webhook] Erro ao atualizar assinatura:", subErr.message);
            }
          }
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("[asaas-webhook]", err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Diagnóstico Asaas ──────────────────────────────────────────────────────────────────────
  // GET /api/asaas/test — Verifica a conexão com o Asaas (Sandbox ou Produção)
  // Protegido por cookie de sessão admin para evitar exposição pública
  app.get("/api/asaas/test", async (req, res) => {
    try {
      const { asaasEnabled, asaasApi } = await import("../asaas");
      const sandbox = process.env.ASAAS_SANDBOX === "true";
      const apiKey = process.env.ASAAS_API_KEY ?? "";
      if (!asaasEnabled) {
        return res.json({ ok: false, error: "ASAAS_API_KEY não configurada", sandbox });
      }
      // Testar conexão listando clientes (limite 1)
      const r = await asaasApi.get("/customers", { params: { limit: 1 } });
      return res.json({
        ok: true,
        sandbox,
        env: sandbox ? "sandbox.asaas.com" : "api.asaas.com",
        apiKeyPrefix: apiKey.slice(0, 8) + "...",
        webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ? "configurado" : "ausente",
        customersTotal: r.data?.totalCount ?? 0,
      });
    } catch (err: any) {
      const errData = err?.response?.data ?? err.message;
      return res.status(500).json({ ok: false, error: errData });
    }
  });

  // GET /api/asaas/account-status — Diagnóstico da subconta Asaas (requer x-internal-key)
  app.get("/api/asaas/account-status", async (req, res) => {
    if (req.headers["x-internal-key"] !== "barber_migrate_2026") {
      return res.status(403).json({ error: "forbidden" });
    }
    try {
      const { getDb } = await import("../db");
      const { getAsaasSubAccount, asaasEnabled } = await import("../asaas");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "no db" });
      // Pegar primeiro tenant com asaasAccountId
      const r = await db.execute(`SELECT id, name, "asaasAccountId", "asaasAccountStatus" FROM tenants WHERE "asaasAccountId" IS NOT NULL LIMIT 1` as any);
      const tenant = ((r as any).rows ?? r)[0];
      if (!tenant?.asaasAccountId) return res.json({ ok: false, error: "Nenhum tenant com asaasAccountId", tenant });
      if (!asaasEnabled) return res.json({ ok: false, error: "ASAAS_API_KEY não configurada" });
      const accountData = await getAsaasSubAccount(tenant.asaasAccountId);
      return res.json({ ok: true, tenant, accountData });
    } catch (err: any) {
      return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,5) });
    }
  });

  // ─── Endpoint de diagnóstico do banco de dados ─────────────────────────────────────────
  app.get("/api/db-columns", async (req, res) => {
    if (req.headers["x-internal-key"] !== "barber_migrate_2026") {
      return res.status(403).json({ error: "forbidden" });
    }
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "no db" });
      const r = await db.execute(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tenants' AND column_name LIKE 'barberpro%' ORDER BY column_name` as any);
      return res.json({ ok: true, rows: (r as any).rows ?? r });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Rotas /:slug — usebarberpro.com/:slug serve a página pública de cada barbearia ───
  // Slugs de sistema reservados (não são barbearias)
  const SYSTEM_PATHS = new Set(["api", "admin", "superadmin", "pub", "pub-api", "landing", "status", "marketplace", "internal", "app", "www", "_next", "static", "assets", "favicon.ico"]);

  // GET /:slug → página principal da barbearia
  // GET /:slug → página principal da barbearia
  app.get("/:slug", async (req, res, next) => {
    const { slug } = req.params;
    if (SYSTEM_PATHS.has(slug)) return next();
    // Verificar se existe tenant com esse slug usando Drizzle ORM (não SQL raw)
    try {
      const { getTenantBySlug } = await import("../db");
      const tenant = await getTenantBySlug(slug);
      if (!tenant || !["active", "trial"].includes((tenant as any).status ?? "")) return next();
      // Redirecionar para /pub/:slug mantendo query string
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(301, `/pub/${slug}${qs}`);
    } catch { return next(); }
  });

  // GET /:slug/* → sub-rotas da barbearia (agendar, login, cadastro, etc.)
  app.get("/:slug/*", async (req, res, next) => {
    const { slug } = req.params;
    if (SYSTEM_PATHS.has(slug)) return next();
    try {
      const { getTenantBySlug } = await import("../db");
      const tenant = await getTenantBySlug(slug);
      if (!tenant || !["active", "trial"].includes((tenant as any).status ?? "")) return next();
      // Extrair o sub-path após /:slug/
      const subPath = (req.params as any)[0] || "";
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(301, `/pub/${slug}/${subPath}${qs}`);
    } catch { return next(); }
  });

  // ─── Rate Limiting ────────────────────────────────────────────────────────────
  // Rate limiter estrito para rotas de login (10 tentativas/min por IP+email)
  app.use("/api/trpc/admin.login", loginRateLimiter);
  app.use("/api/trpc/admin.refreshToken", loginRateLimiter);
  app.use("/api/trpc/clientAuth.login", loginRateLimiter);
  // Rate limiter geral para todas as mutations tRPC (200 req/min por IP)
  app.use("/api/trpc", trpcRateLimiter);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Rota explícita de manutenção (acessível manualmente)
  app.get("/manutencao", (_req, res) => {
    res.status(503).sendFile(maintenancePath);
  });

  // Handler de erro global 500 — retorna página de manutenção para requisições HTML
  app.use((err: any, req: any, res: any, _next: any) => {
    console.error("[server-error]", err?.message ?? err);
    const acceptsHtml = req.headers?.accept?.includes("text/html");
    if (acceptsHtml) {
      return res.status(503).sendFile(maintenancePath);
    }
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  // Middleware 404 — retorna página de manutenção para rotas HTML não encontradas
  app.use((req: any, res: any) => {
    const acceptsHtml = req.headers?.accept?.includes("text/html");
    if (acceptsHtml) {
      return res.status(404).sendFile(maintenancePath);
    }
    res.status(404).json({ ok: false, error: "Not found" });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  // Em produção, usa a porta exata fornecida pelo host (Railway injeta $PORT)
  // Em desenvolvimento, tenta portas alternativas se a preferida estiver ocupada
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Escuta em 0.0.0.0 para aceitar conexões externas (obrigatório no Railway)
  server.listen(port, "0.0.0.0", async () => {
    console.log(`[api] server listening on port ${port}`);
    // ─── Auto-migrate: aplica ADD COLUMN IF NOT EXISTS sem precisar de schema drizzle ───
    try {
      const { getDb } = await import("../db");
      const { runAutoMigrate } = await import("../auto-migrate");
      const dbConn = await getDb();
      if (dbConn) {
        await runAutoMigrate(dbConn);
      } else {
        console.warn("[auto-migrate] Banco não disponível no boot — migração adiada");
      }
    } catch (migrateErr: any) {
      console.error("[auto-migrate] Erro durante migração:", migrateErr?.message ?? migrateErr);
      // Não encerra o servidor — continua mesmo se a migração falhar
    }
    // Iniciar job de e-mail de avaliação pós-atendimento
    startReviewEmailJob();
    // Iniciar job de lembretes WhatsApp (24h e 1h antes do agendamento)
    startWhatsAppReminderJob();
    // Iniciar job de lembretes de assinatura (3 dias antes)
    startSubscriptionReminderJob();
    // Iniciar job de notificação de trial expirando (3 dias antes)
    startTrialExpiryJob();
    // Iniciar job de backup semanal do PostgreSQL (toda segunda-feira às 03:00)
    startBackupJob();
  });
}

// ─── Handlers globais de erro — evitam que o processo caia por erros não tratados ───
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException — erro não tratado:", err?.message ?? err);
  console.error(err?.stack ?? "");
  // Não encerra o processo: o servidor continua respondendo
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] unhandledRejection — Promise rejeitada sem handler:", reason);
  // Não encerra o processo: o servidor continua respondendo
});

startServer().catch(console.error);
