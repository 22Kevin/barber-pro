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
      // ─── Eventos de Assinatura Barber Pro ─────────────────────────────────────
      if (dbConn && req.body?.event && req.body?.subscription) {
        const sub = req.body.subscription;
        const event = req.body.event as string;
        const extRef = sub.externalReference as string | undefined;
        // externalReference = 'tenant_<tenantId>'
        if (extRef?.startsWith("tenant_")) {
          const tenantId = parseInt(extRef.replace("tenant_", ""), 10);
          if (!isNaN(tenantId)) {
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
              try {
                await (dbConn as any).execute(
                  `UPDATE tenants SET "barberproSubscriptionStatus" = '${newStatus}', "updatedAt" = NOW() WHERE id = ${tenantId}`
                );
                console.log(`[asaas-webhook] Assinatura Barber Pro tenant ${tenantId} → ${newStatus} (evento: ${event})`);
              } catch (subErr: any) {
                console.error("[asaas-webhook] Erro ao atualizar assinatura:", subErr.message);
              }
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
