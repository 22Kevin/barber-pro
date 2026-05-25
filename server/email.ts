/**
 * Barber Pro — Módulo de E-mail
 *
 * Envia e-mails transacionais via SMTP (nodemailer).
 * Configuração via variáveis de ambiente:
 *   SMTP_HOST     — servidor SMTP (ex: smtp.hostinger.com)
 *   SMTP_PORT     — porta (ex: 465)
 *   SMTP_USER     — usuário/e-mail remetente
 *   SMTP_PASS     — senha ou app password
 *   SMTP_FROM     — endereço "De" (padrão: SMTP_USER)
 *
 * Se as variáveis não estiverem configuradas, o envio é silenciosamente ignorado.
 */

import * as nodemailer from "nodemailer";

// ─── Logo e identidade visual ────────────────────────────────────────────────
const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028442847/CHUXnjOFayrIGRtV.png";
const BRAND_COLOR = "#C9A84C";
const BRAND_NAME = "Barber Pro";
const SITE_URL = "https://usebarberpro.com";

// ─── Transporter ─────────────────────────────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: false },
  });
}

function getFrom(displayName?: string): string {
  const addr = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@usebarberpro.com";
  const name = displayName ?? BRAND_NAME;
  return addr.includes("<") ? addr : `"${name}" <${addr}>`;
}

// ─── Template Base ────────────────────────────────────────────────────────────
/**
 * Layout base de e-mail do Barber Pro.
 * Todos os templates usam esta função para garantir consistência visual.
 *
 * @param content  HTML do corpo principal (entre cabeçalho e rodapé)
 * @param opts     Opções opcionais: subtítulo do cabeçalho, cor do header
 */
function emailLayout(content: string, opts?: {
  headerSubtitle?: string;
  headerBg?: string;
  previewText?: string;
}): string {
  const headerBg = opts?.headerBg ?? "#0A0A0A";
  const subtitle = opts?.headerSubtitle ?? "Sistema Completo de Barbearia";
  const preview = opts?.previewText ?? "";

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${BRAND_NAME}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin: 0; padding: 0; background: #0A0A0A; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    a { color: ${BRAND_COLOR}; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; }
      .email-body { padding: 24px 20px !important; }
      .btn { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  ${preview ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0A0A0A">
    <tr>
      <td align="center" style="padding:32px 16px">

        <!-- Card -->
        <table class="email-wrapper" width="560" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#111111;border:1px solid #222222;border-radius:20px;overflow:hidden;max-width:560px;width:100%">

          <!-- Header -->
          <tr>
            <td style="background:${headerBg};padding:32px 40px;text-align:center;border-bottom:1px solid #1E1E1E">
              <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="72" height="72"
                   style="border-radius:16px;margin:0 auto 16px;display:block" />
              <div style="font-size:22px;font-weight:900;color:${BRAND_COLOR};letter-spacing:2px;text-transform:uppercase">${BRAND_NAME}</div>
              <div style="font-size:12px;color:#666666;margin-top:4px;letter-spacing:0.5px">${subtitle}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-body" style="padding:36px 40px">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0A0A0A;padding:20px 40px;text-align:center;border-top:1px solid #1E1E1E">
              <div style="font-size:11px;color:#444444;line-height:1.6">
                ${BRAND_NAME} — <a href="${SITE_URL}" style="color:${BRAND_COLOR};text-decoration:none">${SITE_URL.replace("https://", "")}</a><br>
                Este e-mail foi enviado automaticamente. Por favor, não responda a esta mensagem.
              </div>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper -->

</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d} de ${months[parseInt(m) - 1]} de ${y}`;
}

function fmtTime(timeStr: string): string {
  return timeStr.substring(0, 5);
}

/** Linha de detalhe reutilizável para tabelas de resumo */
function detailRow(label: string, value: string, valueColor = "#ECEDEE", isLast = false): string {
  return `
    <tr>
      <td style="padding:10px 0;font-size:12px;color:#9BA1A6;text-transform:uppercase;letter-spacing:0.8px;width:42%;${!isLast ? "border-bottom:1px solid #222222" : ""}">${label}</td>
      <td style="padding:10px 0;font-size:14px;font-weight:700;color:${valueColor};${!isLast ? "border-bottom:1px solid #222222" : ""}">${value}</td>
    </tr>`;
}

/** Botão CTA padrão */
function ctaButton(label: string, href: string, bg = BRAND_COLOR, color = "#0A0A0A"): string {
  return `
    <div style="text-align:center;margin:28px 0">
      <a href="${href}" class="btn"
         style="display:inline-block;background:${bg};color:${color};font-size:14px;font-weight:800;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:0.3px">
        ${label}
      </a>
    </div>`;
}

/** Caixa de alerta colorida */
function alertBox(icon: string, title: string, subtitle: string, color: string): string {
  return `
    <div style="background:${color}18;border:1.5px solid ${color}44;border-radius:14px;padding:18px 20px;margin-bottom:24px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">${icon}</div>
      <div style="font-size:16px;font-weight:800;color:${color}">${title}</div>
      <div style="font-size:13px;color:#9BA1A6;margin-top:4px">${subtitle}</div>
    </div>`;
}

// ─── 1. Confirmação de Agendamento (para o cliente) ───────────────────────────
export interface BookingEmailData {
  clientName: string;
  clientEmail: string;
  shopName: string;
  shopSlug: string;
  serviceName: string;
  barberName: string;
  date: string;
  startTime: string;
  endTime: string;
  price?: string;
}

export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP não configurado — e-mail de confirmação não enviado.");
    return;
  }

  const content = `
    ${alertBox("✅", "Agendamento confirmado!", `Olá, ${data.clientName}! Seu horário está reservado.`, "#4ADE80")}

    <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
      Seu agendamento em <strong style="color:#ECEDEE">${data.shopName}</strong> foi registrado com sucesso.
      Confira os detalhes abaixo.
    </p>

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Serviço", data.serviceName)}
        ${detailRow("Profissional", data.barberName)}
        ${detailRow("Data", fmtDate(data.date))}
        ${detailRow("Horário", `${fmtTime(data.startTime)} – ${fmtTime(data.endTime)}`, BRAND_COLOR)}
        ${data.price ? detailRow("Valor", data.price, "#4ADE80", true) : ""}
      </table>
    </div>

    ${ctaButton("Ver meus agendamentos →", `${SITE_URL}/${data.shopSlug}/meus-agendamentos`)}

    <p style="color:#555555;font-size:12px;text-align:center;margin:0">
      Precisa cancelar ou reagendar? Acesse o link acima ou entre em contato com a barbearia.
    </p>`;

  try {
    await transporter.sendMail({
      from: getFrom(data.shopName),
      to: data.clientEmail,
      subject: `✅ Agendamento confirmado — ${data.shopName}`,
      html: emailLayout(content, {
        headerSubtitle: data.shopName,
        previewText: `Seu agendamento de ${data.serviceName} em ${fmtDate(data.date)} às ${fmtTime(data.startTime)} está confirmado!`,
      }),
    });
    console.log(`[email] Confirmação enviada para ${data.clientEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar e-mail de confirmação:", err);
  }
}

// ─── 2. Notificação de Novo Agendamento (para o barbeiro) ────────────────────
export interface BarberNotificationEmailData {
  barberName: string;
  barberEmail: string;
  clientName: string;
  clientPhone?: string;
  shopName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
}

export async function sendBarberNotificationEmail(data: BarberNotificationEmailData): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP não configurado — notificação ao barbeiro não enviada.");
    return;
  }
  if (!data.barberEmail) {
    console.log("[email] Barbeiro sem e-mail cadastrado — notificação não enviada.");
    return;
  }

  const content = `
    ${alertBox("📅", "Novo agendamento online!", `${data.shopName}`, BRAND_COLOR)}

    <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
      Olá, <strong style="color:#ECEDEE">${data.barberName}</strong>! Você recebeu um novo agendamento pelo site.
    </p>

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Cliente", data.clientName)}
        ${data.clientPhone ? detailRow("Telefone", data.clientPhone) : ""}
        ${detailRow("Serviço", data.serviceName)}
        ${detailRow("Data", fmtDate(data.date))}
        ${detailRow("Horário", `${fmtTime(data.startTime)} – ${fmtTime(data.endTime)}`, BRAND_COLOR, true)}
      </table>
    </div>

    ${ctaButton("Ver agenda no painel →", `${SITE_URL}/admin/agenda`)}

    <p style="color:#555555;font-size:12px;text-align:center;margin:0">
      Este agendamento já está confirmado no sistema. Acesse o painel para gerenciá-lo.
    </p>`;

  try {
    await transporter.sendMail({
      from: getFrom(data.shopName),
      to: data.barberEmail,
      subject: `📅 Novo agendamento: ${data.clientName} — ${fmtDate(data.date)} às ${fmtTime(data.startTime)}`,
      html: emailLayout(content, {
        headerSubtitle: data.shopName,
        previewText: `${data.clientName} agendou ${data.serviceName} para ${fmtDate(data.date)} às ${fmtTime(data.startTime)}.`,
      }),
    });
    console.log(`[email] Notificação de agendamento enviada para barbeiro ${data.barberEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar notificação ao barbeiro:", err);
  }
}

// ─── 3. Solicitação de Avaliação ──────────────────────────────────────────────
export async function sendReviewRequestEmail(opts: {
  clientEmail: string;
  clientName: string;
  shopName: string;
  shopSlug: string;
  serviceName: string;
  barberName: string;
  appointmentId: number;
  baseUrl: string;
  googleMapsUrl?: string | null;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP não configurado — e-mail de avaliação não enviado.");
    return;
  }
  if (!opts.clientEmail) return;

  const reviewUrl = `${SITE_URL}/${opts.shopSlug}/avaliar/${opts.appointmentId}`;
  const starsHtml = [1, 2, 3, 4, 5]
    .map(n => `<a href="${reviewUrl}?rating=${n}" style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;font-size:26px;text-decoration:none;margin:0 2px">⭐</a>`)
    .join("");

  const content = `
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:36px;margin-bottom:12px">✂️</div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ECEDEE">Como foi sua experiência?</h2>
      <p style="margin:0;color:#9BA1A6;font-size:14px;line-height:1.6">
        Olá, <strong style="color:#ECEDEE">${opts.clientName}</strong>! Seu atendimento de
        <strong style="color:#ECEDEE">${opts.serviceName}</strong> com
        <strong style="color:#ECEDEE">${opts.barberName}</strong> foi concluído.
      </p>
    </div>

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:24px;text-align:center;margin-bottom:24px">
      <p style="margin:0 0 16px;font-size:13px;color:#9BA1A6">Toque em uma estrela para avaliar:</p>
      <div>${starsHtml}</div>
    </div>

    ${ctaButton("Deixar avaliação completa →", reviewUrl)}

    ${opts.googleMapsUrl ? `
    <div style="text-align:center;margin-top:-8px;margin-bottom:24px">
      <a href="${opts.googleMapsUrl}" style="display:inline-block;background:#4285F4;color:#fff;font-weight:700;font-size:13px;padding:12px 28px;border-radius:10px;text-decoration:none">
        🌐 Avaliar no Google Maps
      </a>
      <p style="margin:8px 0 0;font-size:11px;color:#555555">Sua avaliação no Google ajuda outros clientes a nos encontrar!</p>
    </div>` : ""}

    <p style="color:#555555;font-size:12px;text-align:center;margin:0">
      Você recebeu este e-mail porque realizou um atendimento em ${opts.shopName}.<br>
      Se não reconhece este atendimento, ignore este e-mail.
    </p>`;

  try {
    await transporter.sendMail({
      from: getFrom(opts.shopName),
      to: opts.clientEmail,
      subject: `⭐ Como foi seu atendimento em ${opts.shopName}?`,
      html: emailLayout(content, {
        headerSubtitle: opts.shopName,
        previewText: `Avalie seu atendimento de ${opts.serviceName} com ${opts.barberName}.`,
      }),
    });
    console.log(`[email] E-mail de avaliação enviado para ${opts.clientEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar e-mail de avaliação:", err);
  }
}

// ─── 4. Recuperação de Senha ──────────────────────────────────────────────────
export async function sendPasswordResetEmail(opts: {
  toEmail: string;
  token: string;
  baseUrl: string;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP não configurado — e-mail de recuperação não enviado.");
    return;
  }

  const resetUrl = `${opts.baseUrl}/admin/reset-password?email=${encodeURIComponent(opts.toEmail)}&token=${opts.token}`;

  const content = `
    ${alertBox("🔑", "Redefinir sua senha", "Solicitação de recuperação de acesso", "#FBBF24")}

    <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
      Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color:#ECEDEE">${BRAND_NAME}</strong>.
      Use o código abaixo ou clique no botão. O código expira em <strong style="color:${BRAND_COLOR}">15 minutos</strong>.
    </p>

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:24px;text-align:center;margin-bottom:24px">
      <div style="font-size:12px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px">Código de verificação</div>
      <div style="font-size:42px;font-weight:900;color:${BRAND_COLOR};letter-spacing:10px;font-variant-numeric:tabular-nums">${opts.token}</div>
    </div>

    ${ctaButton("Redefinir minha senha →", resetUrl)}

    <p style="color:#555555;font-size:12px;text-align:center;margin:0">
      Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanece a mesma.
    </p>`;

  try {
    await transporter.sendMail({
      from: getFrom(),
      to: opts.toEmail,
      subject: "🔑 Recuperação de senha — Barber Pro",
      html: emailLayout(content, {
        headerSubtitle: "Recuperação de Senha",
        previewText: "Seu código de recuperação de senha do Barber Pro.",
      }),
    });
    console.log(`[email] E-mail de recuperação enviado para ${opts.toEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar e-mail de recuperação:", err);
  }
}

// ─── 5. Notificação de Novo Lead ──────────────────────────────────────────────
export async function sendLeadNotificationEmail(opts: {
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  capturedAt: string;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP não configurado — notificação de lead não enviada.");
    return;
  }

  const adminEmail = process.env.SUPERADMIN_NOTIFY_EMAIL ?? "kevin.rayan25@gmail.com";

  const content = `
    ${alertBox("🎯", "Novo lead capturado!", "Alguém demonstrou interesse no Barber Pro", BRAND_COLOR)}

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Nome", opts.leadName || "Não informado")}
        ${detailRow("E-mail", opts.leadEmail || "Não informado", BRAND_COLOR)}
        ${detailRow("WhatsApp", opts.leadPhone || "Não informado")}
        ${detailRow("Capturado em", opts.capturedAt, "#9BA1A6", true)}
      </table>
    </div>

    ${ctaButton("Ver todos os leads →", `${SITE_URL}/superadmin/leads`)}`;

  try {
    await transporter.sendMail({
      from: getFrom(),
      to: adminEmail,
      subject: `🎯 Novo lead: ${opts.leadName || opts.leadEmail || "Visitante"} — Barber Pro`,
      html: emailLayout(content, {
        headerSubtitle: "Backoffice — Novo Lead",
        previewText: `${opts.leadName || opts.leadEmail} demonstrou interesse no Barber Pro.`,
      }),
    });
    console.log(`[email] Notificação de lead enviada para ${adminEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar notificação de lead:", err);
  }
}

// ─── 6. Ticket de Suporte — Novo Ticket (para o superadmin) ──────────────────
export async function sendSupportTicketNotificationEmail(opts: {
  adminEmail: string;
  ticketId: number;
  ticketTitle: string;
  tenantName: string;
  category: string;
  priority: string;
  firstMessage: string;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) return;

  const priorityLabels: Record<string, string> = { urgent: "🔴 URGENTE", high: "🟠 ALTA", normal: "🟡 NORMAL", low: "🟢 BAIXA" };
  const priorityColors: Record<string, string> = { urgent: "#F87171", high: "#FB923C", normal: "#FBBF24", low: "#4ADE80" };
  const pLabel = priorityLabels[opts.priority] ?? "🟡 NORMAL";
  const pColor = priorityColors[opts.priority] ?? "#FBBF24";

  const content = `
    ${alertBox("🎫", `Novo Ticket #${opts.ticketId}`, opts.tenantName, pColor)}

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Barbearia", opts.tenantName)}
        ${detailRow("Assunto", opts.ticketTitle)}
        ${detailRow("Categoria", opts.category)}
        ${detailRow("Prioridade", pLabel, pColor, true)}
      </table>
    </div>

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:16px 20px;margin-bottom:24px">
      <div style="font-size:11px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Mensagem inicial</div>
      <div style="font-size:14px;color:#ECEDEE;line-height:1.6">${opts.firstMessage.substring(0, 400)}${opts.firstMessage.length > 400 ? "..." : ""}</div>
    </div>

    ${ctaButton("Responder ticket →", `${SITE_URL}/superadmin/suporte/${opts.ticketId}`)}`;

  try {
    await transporter.sendMail({
      from: getFrom("Barber Pro Suporte"),
      to: opts.adminEmail,
      subject: `[${opts.priority.toUpperCase()}] Novo Ticket #${opts.ticketId}: ${opts.ticketTitle}`,
      html: emailLayout(content, {
        headerSubtitle: "Central de Suporte",
        previewText: `Novo ticket de ${opts.tenantName}: ${opts.ticketTitle}`,
      }),
    });
    console.log(`[email] Notificação de ticket #${opts.ticketId} enviada para ${opts.adminEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar notificação de ticket:", err);
  }
}

// ─── 7. Ticket de Suporte — Resposta (para o cliente) ────────────────────────
export async function sendSupportReplyNotificationEmail(opts: {
  clientEmail: string;
  clientName: string;
  ticketId: number;
  ticketTitle: string;
  replyContent: string;
  isAI?: boolean;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) return;

  const content = `
    ${alertBox("💬", "Seu ticket recebeu uma resposta!", `Ticket #${opts.ticketId}`, "#60A5FA")}

    <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
      Olá, <strong style="color:#ECEDEE">${opts.clientName}</strong>!
      ${opts.isAI ? "Nossa IA assistente respondeu" : "Nossa equipe respondeu"} ao seu ticket.
    </p>

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
      <div style="font-size:11px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Assunto: ${opts.ticketTitle}</div>
      <div style="font-size:14px;color:#ECEDEE;line-height:1.6">${opts.replyContent.substring(0, 500)}${opts.replyContent.length > 500 ? "..." : ""}</div>
    </div>

    ${ctaButton("Ver resposta completa →", `${SITE_URL}/admin/suporte/${opts.ticketId}`)}

    <p style="color:#555555;font-size:12px;text-align:center;margin:0">
      Para continuar a conversa, acesse o painel de suporte pelo link acima.
    </p>`;

  try {
    await transporter.sendMail({
      from: getFrom("Barber Pro Suporte"),
      to: opts.clientEmail,
      subject: `Re: Ticket #${opts.ticketId} — ${opts.ticketTitle}`,
      html: emailLayout(content, {
        headerSubtitle: "Central de Suporte",
        previewText: `Resposta ao seu ticket: ${opts.ticketTitle}`,
      }),
    });
    console.log(`[email] Resposta ao ticket #${opts.ticketId} enviada para ${opts.clientEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar resposta de ticket:", err);
  }
}

// ─── 8. Função genérica (usada pelo webhook Asaas e jobs internos) ────────────
/**
 * Envia um e-mail com HTML customizado (sem usar o emailLayout base).
 * Use para e-mails já formatados externamente (webhook Asaas, trial-expiry-job etc.)
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  displayName?: string;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email] SMTP não configurado — e-mail para ${opts.to} não enviado.`);
    return;
  }
  try {
    await transporter.sendMail({
      from: getFrom(opts.displayName),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    console.log(`[email] E-mail enviado para ${opts.to}: ${opts.subject}`);
  } catch (err) {
    console.error("[email] Erro ao enviar e-mail genérico:", err);
    throw err;
  }
}

// ─── 9. Boas-vindas — Nova Barbearia ─────────────────────────────────────────
export async function sendWelcomeEmail(opts: {
  barberName: string;
  barberEmail: string;
  shopName: string;
  shopSlug: string;
  trialDays?: number;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP não configurado — e-mail de boas-vindas não enviado.");
    return;
  }

  const trialDays = opts.trialDays ?? 14;
  const panelUrl = `${SITE_URL}/admin`;
  const publicUrl = `${SITE_URL}/pub/${opts.shopSlug}`;

  const content = `
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:48px;margin-bottom:16px">✂️</div>
      <h2 style="margin:0 0 8px;font-size:24px;font-weight:900;color:#ECEDEE">
        Bem-vindo ao Barber Pro, ${opts.barberName}!
      </h2>
      <p style="margin:0;color:#9BA1A6;font-size:15px;line-height:1.6">
        Sua barbearia <strong style="color:${BRAND_COLOR}">${opts.shopName}</strong> está pronta.<br>
        Você tem <strong style="color:${BRAND_COLOR}">${trialDays} dias grátis</strong> para explorar tudo.
      </p>
    </div>

    <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:24px;margin-bottom:24px">
      <div style="font-size:12px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">Seus próximos passos</div>

      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #2A2A2A">
        <div style="width:32px;height:32px;border-radius:50%;background:${BRAND_COLOR}22;border:1px solid ${BRAND_COLOR}44;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:900;color:${BRAND_COLOR}">1</div>
        <div><div style="color:#ECEDEE;font-size:14px;font-weight:700;margin-bottom:2px">Configure seus serviços e preços</div><div style="color:#9BA1A6;font-size:13px">Cadastre cortes, barba e outros serviços com duração e valor.</div></div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #2A2A2A">
        <div style="width:32px;height:32px;border-radius:50%;background:${BRAND_COLOR}22;border:1px solid ${BRAND_COLOR}44;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:900;color:${BRAND_COLOR}">2</div>
        <div><div style="color:#ECEDEE;font-size:14px;font-weight:700;margin-bottom:2px">Personalize sua página pública</div><div style="color:#9BA1A6;font-size:13px">Escolha as cores, adicione logo e fotos. Seus clientes vão amar.</div></div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #2A2A2A">
        <div style="width:32px;height:32px;border-radius:50%;background:${BRAND_COLOR}22;border:1px solid ${BRAND_COLOR}44;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:900;color:${BRAND_COLOR}">3</div>
        <div><div style="color:#ECEDEE;font-size:14px;font-weight:700;margin-bottom:2px">Compartilhe seu link de agendamento</div><div style="color:#9BA1A6;font-size:13px">Cole no Instagram, WhatsApp e onde quiser. Os clientes agendam sozinhos.</div></div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="width:32px;height:32px;border-radius:50%;background:${BRAND_COLOR}22;border:1px solid ${BRAND_COLOR}44;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:900;color:${BRAND_COLOR}">4</div>
        <div><div style="color:#ECEDEE;font-size:14px;font-weight:700;margin-bottom:2px">Ative os pagamentos online</div><div style="color:#9BA1A6;font-size:13px">Pix, cartão e boleto direto na sua conta. Dinheiro na hora.</div></div>
      </div>
    </div>

    <div style="background:${BRAND_COLOR}12;border:1.5px solid ${BRAND_COLOR}33;border-radius:14px;padding:18px 20px;margin-bottom:28px;text-align:center">
      <div style="font-size:13px;color:#9BA1A6;margin-bottom:6px">Sua página de agendamentos</div>
      <a href="${publicUrl}" style="font-size:15px;font-weight:700;color:${BRAND_COLOR};text-decoration:none;word-break:break-all">${publicUrl}</a>
      <div style="font-size:12px;color:#666;margin-top:6px">Compartilhe este link com seus clientes</div>
    </div>

    ${ctaButton("Acessar o painel →", panelUrl)}

    <p style="color:#555555;font-size:12px;text-align:center;margin:0">
      Dúvidas? Fale com a gente pelo WhatsApp ou pelo suporte no painel.<br>
      Estamos aqui para ajudar você a crescer. 💪
    </p>`;

  try {
    await transporter.sendMail({
      from: getFrom(),
      to: opts.barberEmail,
      subject: `✂️ Bem-vindo ao Barber Pro, ${opts.barberName}! Sua barbearia está pronta.`,
      html: emailLayout(content, {
        headerSubtitle: "Vamos colocar sua barbearia no próximo nível",
        previewText: `Olá ${opts.barberName}! Sua barbearia ${opts.shopName} está pronta no Barber Pro. Veja seus próximos passos.`,
      }),
    });
    console.log(`[email] Boas-vindas enviado para ${opts.barberEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar e-mail de boas-vindas:", err);
  }
}


export { emailLayout, ctaButton, alertBox, detailRow, BRAND_COLOR, BRAND_NAME, SITE_URL, LOGO_URL };
