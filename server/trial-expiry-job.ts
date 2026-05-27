/**
 * Job de notificação de trial expirando
 *
 * Executa a cada hora. Verifica tenants com:
 *   - barberproSubscriptionStatus = 'trial' (ou null/undefined)
 *   - trialEndsAt entre hoje e daqui 3 dias
 *
 * Envia:
 *   1. E-mail ao super_admin da barbearia
 *   2. Log de link WhatsApp (para envio manual ou integração futura)
 *
 * Usa a coluna barberproTrialReminderSent (boolean) para não enviar duplicado.
 * Se a coluna não existir no banco, o job funciona sem persistência (pode reenviar).
 */

import { sendEmail, emailLayout, alertBox, ctaButton } from "./email";

const JOB_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
const DAYS_AHEAD = 3;

// Cache em memória para evitar duplicados na mesma sessão do servidor
const notifiedToday = new Set<number>();

function resetDailyCache() {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() < 61) {
    notifiedToday.clear();
  }
}

function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const fullNumber = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}

function buildTrialExpiryEmail(tenantName: string, adminName: string, daysLeft: number, trialEndsAt: Date): string {
  const dateFormatted = trialEndsAt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const urgencyColor = daysLeft <= 1 ? "#EF4444" : daysLeft <= 2 ? "#F59E0B" : "#C9A84C";
  const urgencyText = daysLeft === 0 ? "expira hoje" : daysLeft === 1 ? "expira amanhã" : `expira em ${daysLeft} dias`;

  const body = `
    ${alertBox('⏰', `Seu período de teste ${urgencyText}!`, dateFormatted, urgencyColor)}

    <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
      Olá, <strong style="color:#ECEDEE">${adminName}</strong>! O período de teste gratuito do
      <strong style="color:#ECEDEE">${tenantName}</strong> no Barber Pro ${urgencyText}.
      Para continuar usando o sistema sem interrupção, assine agora.
    </p>

    <!-- Planos -->
    <div style="margin-bottom:28px">
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div><div style="font-weight:700;color:#ECEDEE">Solo</div><div style="font-size:12px;color:#666">1 barbeiro</div></div>
        <div style="font-size:18px;font-weight:900;color:#C9A84C">R$ 49<span style="font-size:12px;font-weight:400;color:#666">/mês</span></div>
      </div>
      <div style="background:#1A1A1A;border:2px solid #C9A84C44;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div><div style="font-weight:700;color:#ECEDEE">Equipe <span style="font-size:10px;background:#C9A84C22;color:#C9A84C;padding:2px 6px;border-radius:4px;margin-left:4px">POPULAR</span></div><div style="font-size:12px;color:#666">até 5 barbeiros</div></div>
        <div style="font-size:18px;font-weight:900;color:#C9A84C">R$ 89<span style="font-size:12px;font-weight:400;color:#666">/mês</span></div>
      </div>
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:700;color:#ECEDEE">Estúdio</div><div style="font-size:12px;color:#666">barbeiros ilimitados</div></div>
        <div style="font-size:18px;font-weight:900;color:#C9A84C">R$ 149<span style="font-size:12px;font-weight:400;color:#666">/mês</span></div>
      </div>
    </div>

    ${ctaButton('Assinar agora →', 'https://usebarberpro.com/admin/configuracoes#pagamentos')}

    <p style="color:#555555;font-size:12px;text-align:center;margin:0">
      Após a assinatura, o pagamento é feito via Pix e a ativação é imediata.
    </p>`;

  return emailLayout(body, {
    headerSubtitle: 'Aviso de Trial',
    previewText: `Seu trial do Barber Pro ${urgencyText}. Assine agora para continuar.`,
  });
}

async function runTrialExpiryJob() {
  try {
    resetDailyCache();

    const { getDb, getBarberPushToken, sendExpoPushNotification } = await import("./db");
    const dbConn = await getDb();
    if (!dbConn) return;

    // Buscar tenants em trial com vencimento nos próximos DAYS_AHEAD dias
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + DAYS_AHEAD);

    const todayStr = today.toISOString().slice(0, 10);
    const limitStr = limitDate.toISOString().slice(0, 10);

    const rows = await (dbConn as any).execute(`
      SELECT
        t.id AS "tenantId",
        t.name AS "tenantName",
        t."trialEndsAt",
        t.phone AS "tenantPhone",
        b.id AS "adminBarberId",
        b.email AS "adminEmail",
        b.name AS "adminName",
        b.phone AS "adminPhone"
      FROM tenants t
      LEFT JOIN barbers b ON b."tenantId" = t.id AND b.role = 'super_admin'
      WHERE
        (t."barberproSubscriptionStatus" IS NULL OR t."barberproSubscriptionStatus" = 'trial')
        AND t."trialEndsAt" IS NOT NULL
        AND t."trialEndsAt"::date >= '${todayStr}'::date
        AND t."trialEndsAt"::date <= '${limitStr}'::date
      ORDER BY t."trialEndsAt" ASC
    `);

    const tenants: any[] = Array.isArray(rows) ? rows[0] ?? [] : rows?.rows ?? [];
    if (tenants.length === 0) return;

    let notifiedCount = 0;

    for (const tenant of tenants) {
      const tenantId = tenant.tenantId;
      if (notifiedToday.has(tenantId)) continue;

      try {
        const trialEndsAt = new Date(tenant.trialEndsAt);
        const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000);

        // Enviar e-mail se tiver endereço
        if (tenant.adminEmail) {
          const html = buildTrialExpiryEmail(
            tenant.tenantName,
            tenant.adminName ?? "Admin",
            daysLeft,
            trialEndsAt
          );
          await sendEmail({
            to: tenant.adminEmail,
            subject: `⏰ Seu trial do Barber Pro ${daysLeft <= 0 ? 'expirou' : `expira em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`} — ${tenant.tenantName}`,
            html,
          }).catch((e: any) => console.error(`[trial-expiry] Erro ao enviar e-mail para ${tenant.adminEmail}:`, e.message));
        }

           // Enviar push notification ao super_admin da barbearia
        if (tenant.adminBarberId) {
          try {
            const pushToken = await getBarberPushToken(tenant.adminBarberId);
            if (pushToken) {
              const urgencyText = daysLeft <= 0 ? 'expirou!' : daysLeft === 1 ? 'expira amanhã!' : `expira em ${daysLeft} dias`;
              await sendExpoPushNotification(
                pushToken,
                `⏰ Seu trial ${urgencyText}`,
                `Assine o Barber Pro para continuar usando o sistema sem interrupção.`,
                { type: 'trial_expiry', daysLeft, tenantId }
              );
              console.log(`[trial-expiry] Push enviado para ${tenant.tenantName} (barberId: ${tenant.adminBarberId})`);
            }
          } catch (pushErr: any) {
            console.error(`[trial-expiry] Erro ao enviar push para ${tenant.tenantName}:`, pushErr.message);
          }
        }

        // Gerar link WhatsApp (para envio manual ou integração futura)
        const phone = tenant.adminPhone ?? tenant.tenantPhone;
        if (phone) {
          const msg = `Olá ${tenant.adminName ?? "Admin"}! ⏰ O período de teste do *${tenant.tenantName}* no Barber Pro expira em *${daysLeft} dia${daysLeft !== 1 ? 's' : ''}*.

Para continuar usando o sistema, acesse:
https://usebarberpro.com/admin/configuracoes#pagamentos

Planos a partir de R$ 49/mês. 💈`;
          const waLink = buildWhatsAppLink(phone, msg);
          console.log(`[trial-expiry] WhatsApp para ${tenant.tenantName} (${daysLeft}d): ${waLink}`);
        }

        // Marcar como notificado (em memória + banco se coluna existir)
        notifiedToday.add(tenantId);
        try {
          await (dbConn as any).execute(
            `UPDATE tenants SET "barberproTrialReminderSent" = true WHERE id = ${tenantId}`
          );
        } catch {
          // Coluna pode não existir — ignorar silenciosamente
        }

        // Registrar email em used_trials quando trial expirou (daysLeft <= 0)
        if (daysLeft <= 0 && tenant.adminEmail) {
          try {
            await (dbConn as any).execute(
              `INSERT INTO used_trials (email, "tenantId", reason) VALUES ('${tenant.adminEmail.toLowerCase().replace(/'/g, "")}', ${tenantId}, 'trial_expired') ON CONFLICT (email) DO NOTHING`
            );
          } catch {}
        }

        notifiedCount++;
        console.log(`[trial-expiry] Notificado: ${tenant.tenantName} (${daysLeft} dias restantes)`);
      } catch (err: any) {
        console.error(`[trial-expiry] Erro ao processar tenant #${tenantId}:`, err.message);
      }
    }

    if (notifiedCount > 0) {
      console.log(`[trial-expiry] ${notifiedCount} notificação(ões) de trial enviada(s)`);
    }
  } catch (err: any) {
    console.error("[trial-expiry] Erro no job:", err.message);
  }
}

export function startTrialExpiryJob() {
  console.log("[trial-expiry] Job de notificação de trial expirando iniciado (intervalo: 1h, antecedência: 3 dias)");
  // Executar com delay de 2 minutos para o servidor estar pronto
  setTimeout(runTrialExpiryJob, 2 * 60 * 1000);
  // Depois executar a cada hora
  setInterval(runTrialExpiryJob, JOB_INTERVAL_MS);
}
