/**
 * Barber Pro — Módulo de E-mail
 *
 * Envia e-mails transacionais via SMTP (nodemailer).
 * Configuração via variáveis de ambiente:
 *   SMTP_HOST     — servidor SMTP (ex: smtp.gmail.com)
 *   SMTP_PORT     — porta (ex: 587)
 *   SMTP_USER     — usuário/e-mail remetente
 *   SMTP_PASS     — senha ou app password
 *   SMTP_FROM     — endereço "De" (padrão: SMTP_USER)
 *
 * Se as variáveis não estiverem configuradas, o envio é silenciosamente ignorado
 * (não quebra o fluxo de agendamento).
 */

import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export interface BookingEmailData {
  clientName: string;
  clientEmail: string;
  shopName: string;
  shopSlug: string;
  serviceName: string;
  barberName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
  endTime: string;
  price?: string;
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d} de ${months[parseInt(m) - 1]} de ${y}`;
}

function fmtTime(timeStr: string): string {
  return timeStr.substring(0, 5);
}

function bookingEmailHtml(data: BookingEmailData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agendamento Confirmado</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:#0A0A0A;padding:32px 40px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#C9A84C;letter-spacing:2px">${data.shopName.toUpperCase()}</div>
      <div style="font-size:13px;color:#888880;margin-top:4px">Confirmação de Agendamento</div>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px">
      <div style="font-size:24px;font-weight:800;color:#0A0A0A;margin-bottom:8px">
        Agendamento confirmado! ✅
      </div>
      <div style="font-size:15px;color:#687076;margin-bottom:32px">
        Olá, <strong>${data.clientName}</strong>! Seu agendamento foi registrado com sucesso.
      </div>

      <!-- Detalhes -->
      <div style="background:#F8F8F5;border-radius:16px;padding:24px;margin-bottom:28px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;font-size:12px;color:#687076;text-transform:uppercase;letter-spacing:0.5px;width:40%">Serviço</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#0A0A0A">${data.serviceName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:12px;color:#687076;text-transform:uppercase;letter-spacing:0.5px">Profissional</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#0A0A0A">${data.barberName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:12px;color:#687076;text-transform:uppercase;letter-spacing:0.5px">Data</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#0A0A0A">${fmtDate(data.date)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:12px;color:#687076;text-transform:uppercase;letter-spacing:0.5px">Horário</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#C9A84C">${fmtTime(data.startTime)} – ${fmtTime(data.endTime)}</td>
          </tr>
          ${data.price ? `
          <tr>
            <td style="padding:8px 0;font-size:12px;color:#687076;text-transform:uppercase;letter-spacing:0.5px">Valor</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#0A0A0A">${data.price}</td>
          </tr>` : ""}
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px">
        <a href="https://usebarberpro.com/${data.shopSlug}/meus-agendamentos"
           style="display:inline-block;background:#C9A84C;color:#0A0A0A;font-size:14px;font-weight:800;padding:14px 32px;border-radius:12px;text-decoration:none">
          Ver meus agendamentos
        </a>
      </div>

      <div style="font-size:13px;color:#687076;text-align:center">
        Precisa cancelar ou reagendar? Acesse o link acima ou entre em contato com a barbearia.
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F8F8F5;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB">
      <div style="font-size:12px;color:#9BA1A6">
        Este e-mail foi enviado automaticamente pelo sistema Barber Pro.<br>
        Por favor, não responda a este e-mail.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Envia e-mail de confirmação de agendamento.
 * Falha silenciosamente se SMTP não estiver configurado.
 */
export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP não configurado — e-mail de confirmação não enviado.");
    return;
  }

  const rawFrom = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const from = rawFrom && rawFrom.includes('<') ? rawFrom : `"${data.shopName}" <${rawFrom}>`;

  try {
    await transporter.sendMail({
      from,
      to: data.clientEmail,
      subject: `✅ Agendamento confirmado — ${data.shopName}`,
      html: bookingEmailHtml(data),
    });
    console.log(`[email] Confirmação enviada para ${data.clientEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar e-mail:", err);
    // Não propaga o erro — o agendamento já foi criado com sucesso
  }
}

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

function barberNotificationHtml(data: BarberNotificationEmailData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Novo Agendamento Online</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#161616;border-radius:20px;overflow:hidden;border:1px solid #2A2A2A">
    <!-- Header -->
    <div style="background:#C9A84C;padding:24px 40px;text-align:center">
      <div style="font-size:20px;font-weight:900;color:#0A0A0A;letter-spacing:1px">📅 NOVO AGENDAMENTO ONLINE</div>
      <div style="font-size:13px;color:#0A0A0A99;margin-top:4px">${data.shopName}</div>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px">
      <div style="font-size:16px;color:#F0EEE8;margin-bottom:24px">
        Olá, <strong style="color:#C9A84C">${data.barberName}</strong>! Você recebeu um novo agendamento pelo site.
      </div>

      <!-- Detalhes -->
      <div style="background:#1E1E1E;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #2A2A2A">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;font-size:11px;color:#888880;text-transform:uppercase;letter-spacing:0.5px;width:40%">Cliente</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#F0EEE8">${data.clientName}</td>
          </tr>
          ${data.clientPhone ? `
          <tr>
            <td style="padding:8px 0;font-size:11px;color:#888880;text-transform:uppercase;letter-spacing:0.5px">Telefone</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#F0EEE8">${data.clientPhone}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:8px 0;font-size:11px;color:#888880;text-transform:uppercase;letter-spacing:0.5px">Serviço</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#F0EEE8">${data.serviceName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:11px;color:#888880;text-transform:uppercase;letter-spacing:0.5px">Data</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;color:#F0EEE8">${fmtDate(data.date)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:11px;color:#888880;text-transform:uppercase;letter-spacing:0.5px">Horário</td>
            <td style="padding:8px 0;font-size:16px;font-weight:900;color:#C9A84C">${fmtTime(data.startTime)} – ${fmtTime(data.endTime)}</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px">
        <a href="https://usebarberpro.com/admin/agenda"
           style="display:inline-block;background:#C9A84C;color:#0A0A0A;font-size:14px;font-weight:800;padding:14px 32px;border-radius:12px;text-decoration:none">
          Ver agenda no painel
        </a>
      </div>

      <div style="font-size:12px;color:#888880;text-align:center">
        Este agendamento já está confirmado no sistema. Acesse o painel para gerenciá-lo.
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0C0C0C;padding:16px 40px;text-align:center;border-top:1px solid #2A2A2A">
      <div style="font-size:11px;color:#555550">
        Barber Pro — Sistema de Gestão para Barbearias
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Envia e-mail de notificação de novo agendamento ao barbeiro.
 * Falha silenciosamente se SMTP não estiver configurado ou barbeiro não tiver e-mail.
 */
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

  const rawFrom2 = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const from2 = rawFrom2 && rawFrom2.includes('<') ? rawFrom2 : `"Barber Pro" <${rawFrom2}>`;

  try {
    await transporter.sendMail({
      from: from2,
      to: data.barberEmail,
      subject: `📅 Novo agendamento: ${data.clientName} — ${fmtDate(data.date)} às ${fmtTime(data.startTime)}`,
      html: barberNotificationHtml(data),
    });
    console.log(`[email] Notificação de agendamento enviada para barbeiro ${data.barberEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar notificação ao barbeiro:", err);
  }
}

// ─── E-mail de Solicitação de Avaliação ───────────────────────────────────────
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

  const reviewUrl = `https://usebarberpro.com/${opts.shopSlug}/avaliar/${opts.appointmentId}`;
  const rawFrom3 = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const from3 = rawFrom3 && rawFrom3.includes('<') ? rawFrom3 : `"${opts.shopName}" <${rawFrom3}>`;

  const starsHtml = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<a href="${reviewUrl}?rating=${n}" style="display:inline-block;width:48px;height:48px;line-height:48px;text-align:center;font-size:28px;text-decoration:none;margin:0 4px">⭐</a>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);padding:32px 40px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">✂️</div>
      <div style="color:#D4AF37;font-size:22px;font-weight:700;letter-spacing:1px">${opts.shopName}</div>
    </div>
    <div style="padding:40px">
      <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a">Como foi sua experiência?</h2>
      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6">
        Olá, <strong>${opts.clientName}</strong>! Seu atendimento de <strong>${opts.serviceName}</strong>
        com <strong>${opts.barberName}</strong> foi concluído. Sua opinião é muito importante para nós.
      </p>
      <div style="background:#f9f9f9;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px">
        <p style="margin:0 0 16px;font-size:14px;color:#777">Toque em uma estrela para avaliar:</p>
        <div>${starsHtml}</div>
      </div>
      <div style="text-align:center">
        <a href="${reviewUrl}" style="display:inline-block;background:#D4AF37;color:#1a1a1a;font-weight:700;font-size:15px;padding:14px 36px;border-radius:50px;text-decoration:none">
          Deixar Avaliação Completa
        </a>
      </div>
      ${opts.googleMapsUrl ? `
      <div style="text-align:center;margin-top:16px">
        <a href="${opts.googleMapsUrl}" target="_blank" style="display:inline-block;background:#4285F4;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none">
          🌐 Avaliar no Google Maps
        </a>
        <p style="margin:8px 0 0;font-size:12px;color:#aaa">Sua avaliação no Google ajuda outros clientes a nos encontrar!</p>
      </div>` : ""}
    </div>
    <div style="background:#f9f9f9;padding:20px 40px;text-align:center">
      <p style="margin:0;font-size:12px;color:#aaa">
        Você recebeu este e-mail porque realizou um atendimento em ${opts.shopName}.<br>
        Se não reconhece este atendimento, ignore este e-mail.
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: from3,
      to: opts.clientEmail,
      subject: `⭐ Como foi seu atendimento em ${opts.shopName}?`,
      html,
    });
    console.log(`[email] E-mail de avaliação enviado para ${opts.clientEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar e-mail de avaliação:", err);
  }
}

// ─── E-mail de Recuperação de Senha ──────────────────────────────────────────
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
  const rawFrom4 = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const from4 = rawFrom4 && rawFrom4.includes('<') ? rawFrom4 : `"Barber Pro" <${rawFrom4}>`;
  const resetUrl = `${opts.baseUrl}/admin/reset-password?email=${encodeURIComponent(opts.toEmail)}&token=${opts.token}`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperação de Senha — Barber Pro</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#161616;border-radius:20px;overflow:hidden;border:1px solid #2A2A2A">
    <div style="background:#C9A84C;padding:28px 40px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#0A0A0A;letter-spacing:2px">BARBER PRO</div>
      <div style="font-size:13px;color:#0A0A0A99;margin-top:4px">Recuperação de Senha</div>
    </div>
    <div style="padding:36px 40px">
      <div style="font-size:22px;font-weight:800;color:#F0EEE8;margin-bottom:12px">Redefinir sua senha 🔑</div>
      <div style="font-size:15px;color:#9BA1A6;margin-bottom:28px">
        Recebemos uma solicitação para redefinir a senha da sua conta no Barber Pro.<br><br>
        Use o código abaixo ou clique no botão para criar uma nova senha. O código expira em <strong style="color:#C9A84C">15 minutos</strong>.
      </div>
      <div style="background:#1E1E1E;border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;border:1px solid #2A2A2A">
        <div style="font-size:13px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Código de verificação</div>
        <div style="font-size:40px;font-weight:900;color:#C9A84C;letter-spacing:8px">${opts.token}</div>
      </div>
      <div style="text-align:center;margin-bottom:28px">
        <a href="${resetUrl}" style="display:inline-block;background:#C9A84C;color:#0A0A0A;font-size:14px;font-weight:800;padding:14px 32px;border-radius:12px;text-decoration:none">
          Redefinir minha senha →
        </a>
      </div>
      <div style="font-size:13px;color:#555550;text-align:center">
        Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanece a mesma.
      </div>
    </div>
    <div style="background:#0C0C0C;padding:16px 40px;text-align:center;border-top:1px solid #2A2A2A">
      <div style="font-size:11px;color:#555550">Barber Pro — Sistema de Gestão para Barbearias</div>
    </div>
  </div>
</body>
</html>`;
  try {
    await transporter.sendMail({
      from: from4,
      to: opts.toEmail,
      subject: "🔑 Recuperação de senha — Barber Pro",
      html,
    });
    console.log(`[email] E-mail de recuperação enviado para ${opts.toEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar e-mail de recuperação:", err);
  }
}

// ─── Notificação de Novo Lead (Backoffice) ────────────────────────────────────
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
  const rawFrom = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const from = rawFrom && rawFrom.includes("<") ? rawFrom : `"Barber Pro" <${rawFrom}>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Novo Lead — Barber Pro</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#161616;border-radius:20px;overflow:hidden;border:1px solid #2A2A2A">
    <div style="background:#C9A84C;padding:24px 36px;text-align:center">
      <div style="font-size:20px;font-weight:900;color:#0A0A0A;letter-spacing:2px">BARBER PRO</div>
      <div style="font-size:12px;color:#0A0A0A99;margin-top:4px">Novo interesse na plataforma</div>
    </div>
    <div style="padding:32px 36px">
      <div style="font-size:20px;font-weight:800;color:#F0EEE8;margin-bottom:8px">🎯 Novo lead capturado!</div>
      <div style="font-size:14px;color:#9BA1A6;margin-bottom:24px">
        Alguém demonstrou interesse no Barber Pro e preencheu o formulário de demonstração.
      </div>
      <div style="background:#1E1E1E;border-radius:14px;padding:20px 24px;border:1px solid #2A2A2A;margin-bottom:24px">
        <div style="margin-bottom:12px">
          <div style="font-size:11px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Nome</div>
          <div style="font-size:15px;font-weight:700;color:#F0EEE8">${opts.leadName || "Não informado"}</div>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:11px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">E-mail</div>
          <div style="font-size:15px;font-weight:700;color:#C9A84C">${opts.leadEmail || "Não informado"}</div>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:11px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">WhatsApp</div>
          <div style="font-size:15px;font-weight:700;color:#F0EEE8">${opts.leadPhone || "Não informado"}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#9BA1A6;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Capturado em</div>
          <div style="font-size:13px;color:#9BA1A6">${opts.capturedAt}</div>
        </div>
      </div>
      <div style="text-align:center">
        <a href="https://usebarberpro.com/superadmin/leads" style="display:inline-block;background:#C9A84C;color:#0A0A0A;font-size:13px;font-weight:800;padding:12px 28px;border-radius:10px;text-decoration:none">
          Ver todos os leads →
        </a>
      </div>
    </div>
    <div style="background:#0C0C0C;padding:14px 36px;text-align:center;border-top:1px solid #2A2A2A">
      <div style="font-size:11px;color:#555550">Barber Pro — Backoffice</div>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to: adminEmail,
      subject: `🎯 Novo lead: ${opts.leadName || opts.leadEmail || "Visitante"} — Barber Pro`,
      html,
    });
    console.log(`[email] Notificação de lead enviada para ${adminEmail}`);
  } catch (err) {
    console.error("[email] Erro ao enviar notificação de lead:", err);
  }
}
