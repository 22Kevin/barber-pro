/**
 * Barber Pro — Módulo de E-mail
 * Usa Resend API (HTTPS/443) como método principal — não bloqueado pelo Railway.
 * Fallback para SMTP nodemailer se RESEND_API_KEY não configurado.
 */

import * as nodemailer from "nodemailer";

const LOGO_URL = "https://pub-203143bd86174070b67f8f64a13a65c2.r2.dev/assets/barber-pro-icon-512.png";
export const BRAND_COLOR = "#C9A84C";
export const BRAND_NAME = "Barber Pro";
export const SITE_URL = "https://usebarberpro.com";
export const LOGO_URL_EXPORT = LOGO_URL;

// ─── Envio principal: Resend API (HTTP/443) ───────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string, from: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurado");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Resend API " + res.status + ": " + err);
  }
}

// ─── Fallback: SMTP nodemailer ────────────────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host, port, secure: port === 465, requireTLS: port === 587,
    auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    tls: { rejectUnauthorized: false },
  });
}

function getFrom(displayName?: string): string {
  const addr = process.env.SMTP_FROM ?? "noreply@usebarberpro.com";
  const name = displayName ?? BRAND_NAME;
  return addr.includes("<") ? addr : '"' + name + '" <' + addr + ">";
}

function isConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}

// ─── Envio genérico (roteamento automático) ───────────────────────────────────
export async function sendEmail(opts: {
  to: string; subject: string; html: string; text?: string; displayName?: string;
}): Promise<void> {
  if (!isConfigured()) { console.log("[email] Sem método de envio — pulando."); return; }
  const from = getFrom(opts.displayName);
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend(opts.to, opts.subject, opts.html, from);
      console.log("[email] Resend OK -> " + opts.to);
    } else {
      const t = createTransporter()!;
      await t.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
      console.log("[email] SMTP OK -> " + opts.to);
    }
  } catch (err: any) {
    console.error("[email] Erro ao enviar para " + opts.to + ":", err.message);
    throw err;
  }
}

// ─── Template base ────────────────────────────────────────────────────────────
export function emailLayout(content: string, opts?: {
  headerSubtitle?: string; headerBg?: string; previewText?: string;
}): string {
  const headerBg = opts?.headerBg ?? "#0A0A0A";
  const subtitle = opts?.headerSubtitle ?? "Sistema Completo de Barbearia";
  const preview = opts?.previewText ?? "";
  return "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"><title>" + BRAND_NAME + "</title><style>body{margin:0;padding:0;background:#0A0A0A}table{border-collapse:collapse}img{border:0;display:block}a{color:" + BRAND_COLOR + "}@media only screen and (max-width:600px){.email-wrapper{width:100%!important}.email-body{padding:24px 20px!important}.btn{display:block!important;width:100%!important;text-align:center!important}}</style></head>" +
    "<body style=\"margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif\">" +
    (preview ? "<div style=\"display:none;max-height:0;overflow:hidden\">" + preview + "</div>" : "") +
    "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#0A0A0A\"><tr><td align=\"center\" style=\"padding:32px 16px\">" +
    "<table class=\"email-wrapper\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#111111;border:1px solid #222222;border-radius:20px;overflow:hidden;max-width:560px;width:100%\">" +
    "<tr><td style=\"background:" + headerBg + ";padding:32px 40px;text-align:center;border-bottom:1px solid #1E1E1E\">" +
    "<img src=\"" + LOGO_URL + "\" alt=\"" + BRAND_NAME + "\" width=\"72\" height=\"72\" style=\"border-radius:16px;margin:0 auto 16px;display:block\">" +
    "<div style=\"font-size:22px;font-weight:900;color:" + BRAND_COLOR + ";letter-spacing:2px;text-transform:uppercase\">" + BRAND_NAME + "</div>" +
    "<div style=\"font-size:12px;color:#666666;margin-top:4px\">" + subtitle + "</div></td></tr>" +
    "<tr><td class=\"email-body\" style=\"padding:36px 40px\">" + content + "</td></tr>" +
    "<tr><td style=\"background:#0A0A0A;padding:20px 40px;text-align:center;border-top:1px solid #1E1E1E\">" +
    "<div style=\"font-size:11px;color:#444444;line-height:1.6\">" + BRAND_NAME + " — <a href=\"" + SITE_URL + "\" style=\"color:" + BRAND_COLOR + ";text-decoration:none\">" + SITE_URL.replace("https://", "") + "</a><br>Eldunari Ltda &middot; CNPJ 66.991.137/0001-63 &middot; R. Maria Amélia Faleiros, 4881, Franca/SP<br>Este e-mail foi enviado automaticamente.</div>" +
    "</td></tr></table></td></tr></table></body></html>";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return day + " de " + months[parseInt(m)-1] + " de " + y;
}
function fmtTime(t: string): string { return t.substring(0,5); }

export function detailRow(label: string, value: string, valueColor = "#ECEDEE", isLast = false): string {
  const border = isLast ? "" : "border-bottom:1px solid #222222";
  return "<tr><td style=\"padding:10px 0;font-size:12px;color:#9BA1A6;text-transform:uppercase;letter-spacing:0.8px;width:42%;" + border + "\">" + label + "</td>" +
    "<td style=\"padding:10px 0;font-size:14px;font-weight:700;color:" + valueColor + ";" + border + "\">" + value + "</td></tr>";
}

export function ctaButton(label: string, href: string, bg = BRAND_COLOR, color = "#0A0A0A"): string {
  return "<div style=\"text-align:center;margin:28px 0\"><a href=\"" + href + "\" style=\"display:inline-block;background:" + bg + ";color:" + color + ";font-size:14px;font-weight:800;padding:14px 36px;border-radius:12px;text-decoration:none\">" + label + "</a></div>";
}

export function alertBox(icon: string, title: string, subtitle: string, color: string): string {
  return "<div style=\"background:" + color + "18;border:1.5px solid " + color + "44;border-radius:14px;padding:18px 20px;margin-bottom:24px;text-align:center\">" +
    "<div style=\"font-size:32px;margin-bottom:8px\">" + icon + "</div>" +
    "<div style=\"font-size:16px;font-weight:800;color:" + color + "\">" + title + "</div>" +
    "<div style=\"font-size:13px;color:#9BA1A6;margin-top:4px\">" + subtitle + "</div></div>";
}

// ─── 1. Confirmação de Agendamento ────────────────────────────────────────────
export interface BookingEmailData {
  clientName: string; clientEmail: string; shopName: string; shopSlug: string;
  serviceName: string; barberName: string; date: string; startTime: string; endTime: string;
  price?: string; shopLogoUrl?: string | null; shopPhone?: string | null;
}
export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  if (!isConfigured()) return;

  const logoHtml = data.shopLogoUrl
    ? "<img src=\"" + data.shopLogoUrl + "\" alt=\"" + data.shopName + "\" width=\"64\" height=\"64\" style=\"border-radius:14px;margin:0 auto 12px;display:block;object-fit:cover\">"
    : "<div style=\"font-size:40px;margin-bottom:12px\">✂️</div>";

  const waLink = data.shopPhone
    ? "https://wa.me/55" + data.shopPhone.replace(/\D/g, "") + "?text=" + encodeURIComponent("Olá, " + data.shopName + "! Tenho um agendamento marcado para " + data.date + " às " + data.startTime.substring(0,5) + ".")
    : null;

  const content =
    "<div style=\"text-align:center;margin-bottom:24px\">" +
    logoHtml +
    "<div style=\"font-size:18px;font-weight:700;color:#ECEDEE;margin-bottom:6px\">" + data.shopName + "</div>" +
    "</div>" +
    alertBox("✅", "Agendamento confirmado!", "Olá, " + data.clientName + "! Seu horário está reservado.", "#4ADE80") +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:20px\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" +
    detailRow("Serviço", data.serviceName) +
    detailRow("Profissional", data.barberName) +
    detailRow("Data", data.date.split("-").reverse().join("/")) +
    detailRow("Horário", data.startTime.substring(0,5) + " – " + data.endTime.substring(0,5), BRAND_COLOR) +
    (data.price ? detailRow("Valor", data.price, "#4ADE80", true) : "") +
    "</table></div>" +
    ctaButton("Ver meus agendamentos →", SITE_URL + "/pub/" + data.shopSlug) +
    (waLink
      ? "<div style=\"text-align:center;margin-top:-10px;margin-bottom:20px\"><a href=\"" + waLink + "\" style=\"display:inline-block;background:#25D36618;border:1px solid #25D36644;color:#25D366;font-size:13px;font-weight:600;padding:10px 24px;border-radius:9px;text-decoration:none\">💬 Falar com a barbearia</a></div>"
      : "") +
    "<p style=\"color:#555;font-size:12px;text-align:center\">Precisa cancelar ou reagendar? Acesse o link acima.</p>";

  await sendEmail({
    to: data.clientEmail,
    subject: "✅ Agendamento confirmado — " + data.shopName,
    html: emailLayout(content, { headerSubtitle: data.shopName, previewText: "Seu agendamento de " + data.serviceName + " está confirmado!" }),
    displayName: data.shopName,
  });
}

// ─── 2. Notificação ao Barbeiro ───────────────────────────────────────────────
export interface BarberNotificationEmailData {
  barberName: string; barberEmail: string; clientName: string; clientPhone?: string;
  shopName: string; serviceName: string; date: string; startTime: string; endTime: string;
}
export async function sendBarberNotificationEmail(data: BarberNotificationEmailData): Promise<void> {
  if (!isConfigured() || !data.barberEmail) return;
  const content = alertBox("📅", "Novo agendamento online!", data.shopName, BRAND_COLOR) +
    "<p style=\"color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px\">Olá, <strong style=\"color:#ECEDEE\">" + data.barberName + "</strong>! Você recebeu um novo agendamento.</p>" +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" +
    detailRow("Cliente", data.clientName) + (data.clientPhone ? detailRow("Telefone", data.clientPhone) : "") +
    detailRow("Serviço", data.serviceName) + detailRow("Data", fmtDate(data.date)) +
    detailRow("Horário", fmtTime(data.startTime) + " – " + fmtTime(data.endTime), BRAND_COLOR, true) + "</table></div>" +
    ctaButton("Ver agenda no painel →", SITE_URL + "/admin/agenda");
  await sendEmail({ to: data.barberEmail, subject: "📅 Novo agendamento: " + data.clientName + " — " + fmtDate(data.date), html: emailLayout(content, { headerSubtitle: data.shopName }), displayName: data.shopName });
}

// ─── 3. Solicitação de Avaliação ──────────────────────────────────────────────
export async function sendReviewRequestEmail(opts: {
  clientEmail: string; clientName: string; shopName: string; shopSlug: string;
  serviceName: string; barberName: string; appointmentId: number; baseUrl: string; googleMapsUrl?: string | null;
}): Promise<void> {
  if (!isConfigured() || !opts.clientEmail) return;
  const reviewUrl = SITE_URL + "/" + opts.shopSlug + "/avaliar/" + opts.appointmentId;
  const stars = [1,2,3,4,5].map(n => "<a href=\"" + reviewUrl + "?rating=" + n + "\" style=\"display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;font-size:26px;text-decoration:none;margin:0 2px\">⭐</a>").join("");
  const content = "<div style=\"text-align:center;margin-bottom:24px\"><div style=\"font-size:36px;margin-bottom:12px\">✂️</div>" +
    "<h2 style=\"margin:0 0 8px;font-size:22px;font-weight:800;color:#ECEDEE\">Como foi sua experiência?</h2>" +
    "<p style=\"margin:0;color:#9BA1A6;font-size:14px\">Olá, <strong style=\"color:#ECEDEE\">" + opts.clientName + "</strong>! Seu atendimento de <strong style=\"color:#ECEDEE\">" + opts.serviceName + "</strong> com <strong style=\"color:#ECEDEE\">" + opts.barberName + "</strong> foi concluído.</p></div>" +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:24px;text-align:center;margin-bottom:24px\"><p style=\"margin:0 0 16px;font-size:13px;color:#9BA1A6\">Toque em uma estrela:</p><div>" + stars + "</div></div>" +
    ctaButton("Deixar avaliação completa →", reviewUrl) +
    (opts.googleMapsUrl ? "<div style=\"text-align:center;margin-top:-8px;margin-bottom:24px\"><a href=\"" + opts.googleMapsUrl + "\" style=\"display:inline-block;background:#4285F4;color:#fff;font-weight:700;font-size:13px;padding:12px 28px;border-radius:10px;text-decoration:none\">🌐 Avaliar no Google Maps</a></div>" : "");
  await sendEmail({ to: opts.clientEmail, subject: "⭐ Como foi seu atendimento em " + opts.shopName + "?", html: emailLayout(content, { headerSubtitle: opts.shopName }), displayName: opts.shopName });
}

// ─── 4. Recuperação de Senha ──────────────────────────────────────────────────
export async function sendPasswordResetEmail(opts: { toEmail: string; token: string; baseUrl: string; }): Promise<void> {
  if (!isConfigured()) return;
  const resetUrl = opts.baseUrl + "/admin/reset-password?email=" + encodeURIComponent(opts.toEmail) + "&token=" + opts.token;
  const content = alertBox("🔑", "Redefinir sua senha", "Solicitação de recuperação de acesso", "#FBBF24") +
    "<p style=\"color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px\">O código expira em <strong style=\"color:" + BRAND_COLOR + "\">15 minutos</strong>.</p>" +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:24px;text-align:center;margin-bottom:24px\">" +
    "<div style=\"font-size:12px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px\">Código de verificação</div>" +
    "<div style=\"font-size:42px;font-weight:900;color:" + BRAND_COLOR + ";letter-spacing:10px\">" + opts.token + "</div></div>" +
    ctaButton("Redefinir minha senha →", resetUrl);
  await sendEmail({ to: opts.toEmail, subject: "🔑 Recuperação de senha — " + BRAND_NAME, html: emailLayout(content, { headerSubtitle: "Recuperação de Senha" }) });
}

// ─── 5. Notificação de Novo Lead ──────────────────────────────────────────────
export async function sendLeadNotificationEmail(opts: {
  leadName: string; leadEmail: string; leadPhone: string; capturedAt: string;
}): Promise<void> {
  if (!isConfigured()) return;
  const adminEmail = process.env.SUPERADMIN_NOTIFY_EMAIL ?? "kevin.rayan25@gmail.com";
  const content = alertBox("🎯", "Novo lead capturado!", "Alguém demonstrou interesse no Barber Pro", BRAND_COLOR) +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" +
    detailRow("Nome", opts.leadName || "Não informado") + detailRow("E-mail", opts.leadEmail || "Não informado", BRAND_COLOR) +
    detailRow("WhatsApp", opts.leadPhone || "Não informado") + detailRow("Capturado em", opts.capturedAt, "#9BA1A6", true) + "</table></div>" +
    ctaButton("Ver todos os leads →", SITE_URL + "/superadmin/leads");
  await sendEmail({ to: adminEmail, subject: "🎯 Novo lead: " + (opts.leadName || opts.leadEmail || "Visitante"), html: emailLayout(content, { headerSubtitle: "Backoffice — Novo Lead" }) });
}

// ─── 6. Ticket de Suporte (para superadmin) ───────────────────────────────────
export async function sendSupportTicketNotificationEmail(opts: {
  adminEmail: string; ticketId: number; ticketTitle: string; tenantName: string; category: string; priority: string; firstMessage: string;
}): Promise<void> {
  if (!isConfigured()) return;
  const pColors: Record<string, string> = { urgent: "#F87171", high: "#FB923C", normal: "#FBBF24", low: "#4ADE80" };
  const pLabels: Record<string, string> = { urgent: "🔴 URGENTE", high: "🟠 ALTA", normal: "🟡 NORMAL", low: "🟢 BAIXA" };
  const color = pColors[opts.priority] ?? "#FBBF24";
  const content = alertBox("🎫", "Novo Ticket #" + opts.ticketId, opts.tenantName, color) +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" +
    detailRow("Barbearia", opts.tenantName) + detailRow("Assunto", opts.ticketTitle) +
    detailRow("Categoria", opts.category) + detailRow("Prioridade", pLabels[opts.priority] ?? "NORMAL", color, true) + "</table></div>" +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:16px 20px;margin-bottom:24px\"><div style=\"font-size:14px;color:#ECEDEE;line-height:1.6\">" + opts.firstMessage.substring(0, 400) + "</div></div>" +
    ctaButton("Responder ticket →", SITE_URL + "/superadmin/suporte/" + opts.ticketId);
  await sendEmail({ to: opts.adminEmail, subject: "[" + opts.priority.toUpperCase() + "] Novo Ticket #" + opts.ticketId + ": " + opts.ticketTitle, html: emailLayout(content, { headerSubtitle: "Central de Suporte" }) });
}

// ─── 7. Resposta de Ticket (para cliente) ─────────────────────────────────────
export async function sendSupportReplyNotificationEmail(opts: {
  clientEmail: string; clientName: string; ticketId: number; ticketTitle: string; replyContent: string; isAI?: boolean;
}): Promise<void> {
  if (!isConfigured()) return;
  const content = alertBox("💬", "Seu ticket recebeu uma resposta!", "Ticket #" + opts.ticketId, "#60A5FA") +
    "<p style=\"color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px\">Olá, <strong style=\"color:#ECEDEE\">" + opts.clientName + "</strong>! " + (opts.isAI ? "Nossa IA respondeu" : "Nossa equipe respondeu") + " ao seu ticket.</p>" +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px\"><div style=\"font-size:14px;color:#ECEDEE;line-height:1.6\">" + opts.replyContent.substring(0, 500) + "</div></div>" +
    ctaButton("Ver resposta completa →", SITE_URL + "/admin/suporte/" + opts.ticketId);
  await sendEmail({ to: opts.clientEmail, subject: "Re: Ticket #" + opts.ticketId + " — " + opts.ticketTitle, html: emailLayout(content, { headerSubtitle: "Central de Suporte" }) });
}

// ─── 9. Boas-vindas — Nova Barbearia ─────────────────────────────────────────
export async function sendWelcomeEmail(opts: {
  barberName: string; barberEmail: string; shopName: string; shopSlug: string; trialDays?: number;
}): Promise<void> {
  if (!isConfigured()) return;
  const trialDays = opts.trialDays ?? 14;
  const publicUrl = SITE_URL + "/pub/" + opts.shopSlug;
  const steps = [
    ["1", "Configure seus serviços e preços", "Cadastre cortes, barba e outros serviços com duração e valor."],
    ["2", "Personalize sua página pública", "Escolha cores, adicione logo e fotos. Seus clientes vão amar."],
    ["3", "Compartilhe seu link de agendamento", "Cole no Instagram e WhatsApp. Os clientes agendam sozinhos."],
    ["4", "Ative os pagamentos online", "Pix, cartão e boleto direto na sua conta. Dinheiro na hora."],
  ];
  const stepsHtml = steps.map(([n, title, desc]) =>
    "<div style=\"display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #2A2A2A\">" +
    "<div style=\"width:32px;height:32px;border-radius:50%;background:" + BRAND_COLOR + "22;border:1px solid " + BRAND_COLOR + "44;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:900;color:" + BRAND_COLOR + ";text-align:center;line-height:32px\">" + n + "</div>" +
    "<div><div style=\"color:#ECEDEE;font-size:14px;font-weight:700;margin-bottom:2px\">" + title + "</div><div style=\"color:#9BA1A6;font-size:13px\">" + desc + "</div></div></div>"
  ).join("");
  const content = "<div style=\"text-align:center;margin-bottom:32px\"><div style=\"font-size:48px;margin-bottom:16px\">✂️</div>" +
    "<h2 style=\"margin:0 0 8px;font-size:24px;font-weight:900;color:#ECEDEE\">Bem-vindo ao Barber Pro, " + opts.barberName + "!</h2>" +
    "<p style=\"margin:0;color:#9BA1A6;font-size:15px\">Sua barbearia <strong style=\"color:" + BRAND_COLOR + "\">" + opts.shopName + "</strong> está pronta.<br>Você tem <strong style=\"color:" + BRAND_COLOR + "\">" + trialDays + " dias grátis</strong> para explorar tudo.</p></div>" +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:24px;margin-bottom:24px\">" +
    "<div style=\"font-size:12px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px\">Seus próximos passos</div>" + stepsHtml + "</div>" +
    "<div style=\"background:" + BRAND_COLOR + "12;border:1.5px solid " + BRAND_COLOR + "33;border-radius:14px;padding:18px 20px;margin-bottom:28px;text-align:center\">" +
    "<div style=\"font-size:13px;color:#9BA1A6;margin-bottom:6px\">Sua página de agendamentos</div>" +
    "<a href=\"" + publicUrl + "\" style=\"font-size:15px;font-weight:700;color:" + BRAND_COLOR + ";text-decoration:none\">" + publicUrl + "</a></div>" +
    ctaButton("Acessar o painel →", SITE_URL + "/admin") +
    "<p style=\"color:#555;font-size:12px;text-align:center;margin:0\">Dúvidas? Fale com a gente pelo suporte no painel. 💪</p>";
  await sendEmail({ to: opts.barberEmail, subject: "✂️ Bem-vindo ao Barber Pro, " + opts.barberName + "! Sua barbearia está pronta.", html: emailLayout(content, { headerSubtitle: "Vamos colocar sua barbearia no próximo nível" }) });
}

// ─── Exportar para uso externo ────────────────────────────────────────────────
export { getFrom };

// ─── 10. Lembrete de agendamento (24h antes) ──────────────────────────────────
export async function sendAppointmentReminderEmail(opts: {
  clientEmail: string;
  clientName: string;
  shopName: string;
  shopSlug: string;
  shopLogoUrl?: string | null;
  shopPhone?: string | null;
  serviceName: string;
  barberName: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<void> {
  if (!isConfigured() || !opts.clientEmail) return;

  const shopHeaderHtml = opts.shopLogoUrl
    ? "<img src=\"" + opts.shopLogoUrl + "\" alt=\"" + opts.shopName + "\" width=\"64\" height=\"64\" style=\"border-radius:14px;margin:0 auto 12px;display:block;object-fit:cover\">"
    : "<div style=\"width:64px;height:64px;border-radius:14px;background:#1A1A1A;border:1px solid #C9A84C33;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px\">✂️</div>";

  const fmtDatePT = (d: string) => {
    const [y, m, day] = d.split("-");
    const months = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const days = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
    const dt = new Date(parseInt(y), parseInt(m)-1, parseInt(day));
    return days[dt.getDay()] + ", " + day + " de " + months[parseInt(m)-1];
  };

  const waLink = opts.shopPhone
    ? "https://wa.me/55" + opts.shopPhone.replace(/\D/g, "") + "?text=" + encodeURIComponent("Olá! Tenho um agendamento amanhã às " + opts.startTime.substring(0,5) + " e gostaria de confirmar.")
    : null;

  const content =
    "<div style=\"text-align:center;margin-bottom:24px\">" +
    shopHeaderHtml +
    "<div style=\"font-size:18px;font-weight:700;color:#ECEDEE;margin-bottom:6px\">" + opts.shopName + "</div>" +
    "<div style=\"display:inline-block;background:#FBBF2418;border:1px solid #FBBF2444;border-radius:20px;padding:5px 16px;font-size:13px;color:#FBBF24;font-weight:600\">⏰ Lembrete de agendamento</div>" +
    "</div>" +
    "<p style=\"color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 20px;text-align:center\">Olá, <strong style=\"color:#ECEDEE\">" + opts.clientName + "</strong>! Seu horário é <strong style=\"color:#ECEDEE\">amanhã</strong>.</p>" +
    "<div style=\"background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:20px\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" +
    detailRow("Data", fmtDatePT(opts.date)) +
    detailRow("Horário", opts.startTime.substring(0,5) + " – " + opts.endTime.substring(0,5), BRAND_COLOR) +
    detailRow("Serviço", opts.serviceName) +
    detailRow("Profissional", opts.barberName, "#ECEDEE", true) +
    "</table></div>" +
    ctaButton("Ver detalhes do agendamento →", SITE_URL + "/pub/" + opts.shopSlug) +
    (waLink
      ? "<div style=\"text-align:center;margin-top:-10px;margin-bottom:20px\"><a href=\"" + waLink + "\" style=\"display:inline-block;background:#25D36618;border:1px solid #25D36644;color:#25D366;font-size:13px;font-weight:600;padding:10px 24px;border-radius:9px;text-decoration:none\">💬 Falar com a barbearia</a></div>"
      : "") +
    "<p style=\"color:#555;font-size:12px;text-align:center\">Precisa cancelar? Entre em contato com a barbearia o quanto antes.</p>";

  const html = emailLayout(content, {
    headerSubtitle: opts.shopName,
    previewText: "Lembrete: " + opts.serviceName + " amanhã às " + opts.startTime.substring(0,5) + " — " + opts.shopName,
  });

  await sendEmail({
    to: opts.clientEmail,
    subject: "⏰ Lembrete: seu horário é amanhã às " + opts.startTime.substring(0,5) + " — " + opts.shopName,
    html,
    displayName: opts.shopName,
  });
}
