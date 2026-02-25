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
        <a href="${process.env.PUBLIC_BASE_URL ?? "https://barberpro.com.br"}/pub/${data.shopSlug}/meus-agendamentos"
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

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from: `"${data.shopName}" <${from}>`,
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
