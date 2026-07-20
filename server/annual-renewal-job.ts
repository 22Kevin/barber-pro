/**
 * Job de renovação do plano anual — lembra a barbearia antes do fim dos
 * 365 dias, e bloqueia o acesso (mesmo mecanismo já usado pro trial) se
 * passar do prazo sem renovar manualmente.
 *
 * Diferente do plano mensal (recorrente, cobrado automaticamente pelo
 * Asaas), o plano anual é um pagamento único — não existe cobrança
 * automática de renovação. Por isso esse job existe: sem ele, a barbearia
 * simplesmente continuaria com acesso liberado para sempre depois dos
 * 365 dias, mesmo sem pagar de novo.
 *
 * Executa 1x por dia (a granularidade do prazo é em dias, não faz sentido
 * rodar com mais frequência que isso).
 */

import { rawQuery } from "./db";
import { sendEmail, emailLayout, ctaButton } from "./email";

const JOB_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas
const REMINDER_DAYS_BEFORE = 14; // avisa 14 dias antes do vencimento
const GRACE_PERIOD_DAYS = 7;     // tolerância após vencer, antes de bloquear

const PLAN_LABELS: Record<string, string> = { solo: "Solo", team: "Equipe", studio: "Estúdio" };

interface AnnualTenantRow {
  tenantId: number;
  tenantName: string;
  planName: string;
  planPrice: string;
  nextDueDate: string;
  adminEmail: string | null;
  adminName: string | null;
}

async function findTenantsNeedingReminder(): Promise<AnnualTenantRow[]> {
  const rows = await rawQuery(`
    SELECT
      t.id AS "tenantId", t.name AS "tenantName",
      t."barberproPlanName" AS "planName", t."barberproPlanPrice" AS "planPrice",
      t."barberproNextDueDate" AS "nextDueDate",
      b.email AS "adminEmail", b.name AS "adminName"
    FROM tenants t
    LEFT JOIN barbers b ON b."tenantId" = t.id AND b.role = 'super_admin'
    WHERE t."barberproBillingCycle" = 'annual'
      AND t."barberproSubscriptionStatus" = 'active'
      AND t."barberproNextDueDate" IS NOT NULL
      AND t."barberproNextDueDate"::date <= (CURRENT_DATE + ${REMINDER_DAYS_BEFORE})
      AND t."barberproNextDueDate"::date >= CURRENT_DATE
    ORDER BY t."barberproNextDueDate" ASC
    LIMIT 50
  `);
  return rows as AnnualTenantRow[];
}

async function findExpiredPastGrace(): Promise<AnnualTenantRow[]> {
  const rows = await rawQuery(`
    SELECT
      t.id AS "tenantId", t.name AS "tenantName",
      t."barberproPlanName" AS "planName", t."barberproPlanPrice" AS "planPrice",
      t."barberproNextDueDate" AS "nextDueDate",
      b.email AS "adminEmail", b.name AS "adminName"
    FROM tenants t
    LEFT JOIN barbers b ON b."tenantId" = t.id AND b.role = 'super_admin'
    WHERE t."barberproBillingCycle" = 'annual'
      AND t."barberproSubscriptionStatus" = 'active'
      AND t."barberproNextDueDate" IS NOT NULL
      AND t."barberproNextDueDate"::date < (CURRENT_DATE - ${GRACE_PERIOD_DAYS})
    ORDER BY t."barberproNextDueDate" ASC
    LIMIT 20
  `);
  return rows as AnnualTenantRow[];
}

// Cache em memória pra não mandar o mesmo lembrete varias vezes no mesmo dia
// (o job roda 1x por dia, mas por segurança/reinicios do servidor)
const remindedToday = new Set<number>();
function resetDailyCacheIfNeeded() {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() < 61) remindedToday.clear();
}

async function sendReminderEmail(t: AnnualTenantRow) {
  if (!t.adminEmail) return;
  const dueDateFormatted = new Date(t.nextDueDate).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const planLabel = PLAN_LABELS[t.planName] ?? t.planName ?? "—";
  const daysLeft = Math.ceil((new Date(t.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const html = emailLayout(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:40px;margin-bottom:12px">📅</div>
      <h2 style="font-size:20px;font-weight:800;color:#ECEDEE;margin:0 0 8px">Seu plano anual vence em breve</h2>
      <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0">
        Olá, <strong style="color:#ECEDEE">${t.adminName ?? "Admin"}</strong>!
        O plano anual do <strong style="color:#ECEDEE">${t.tenantName}</strong> vence em
        <strong style="color:#C9A84C">${daysLeft} dia${daysLeft === 1 ? "" : "s"}</strong> (${dueDateFormatted}).
      </p>
    </div>
    <div style="background:#1A1A1A;border:1px solid #C9A84C33;border-radius:14px;padding:20px;text-align:center;margin-bottom:24px">
      <div style="font-size:11px;color:#666;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Plano atual</div>
      <div style="font-size:22px;font-weight:900;color:#C9A84C">${planLabel}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Pagamento único anual — sem renovação automática</div>
    </div>
    <p style="color:#9BA1A6;font-size:13px;line-height:1.6;margin:0 0 20px;text-align:center">
      Como o plano anual é um pagamento único, ele <strong style="color:#ECEDEE">não renova sozinho</strong>.
      Renove agora pelo painel para não perder o acesso.
    </p>
    ${ctaButton("Renovar plano anual →", "https://usebarberpro.com/admin/configuracoes?tab=pagamentos")}
  `, {
    headerSubtitle: t.tenantName,
    previewText: `Seu plano anual vence em ${daysLeft} dias — renove pra não perder o acesso`,
  });

  try {
    await sendEmail({
      to: t.adminEmail,
      subject: `📅 Seu plano anual vence em ${daysLeft} dias — ${t.tenantName}`,
      html,
    });
    console.log(`[annual-renewal] Lembrete enviado: ${t.tenantName} (vence em ${dueDateFormatted})`);
  } catch (e: any) {
    console.error(`[annual-renewal] Erro ao enviar lembrete para ${t.tenantName}:`, e.message);
  }
}

async function sendBlockedEmail(t: AnnualTenantRow) {
  if (!t.adminEmail) return;
  const planLabel = PLAN_LABELS[t.planName] ?? t.planName ?? "—";

  const html = emailLayout(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:40px;margin-bottom:12px">🔒</div>
      <h2 style="font-size:20px;font-weight:800;color:#ECEDEE;margin:0 0 8px">Seu plano anual venceu</h2>
      <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0">
        Olá, <strong style="color:#ECEDEE">${t.adminName ?? "Admin"}</strong>!
        O acesso ao <strong style="color:#ECEDEE">${t.tenantName}</strong> foi suspenso porque o plano
        anual (<strong style="color:#ECEDEE">${planLabel}</strong>) venceu há mais de ${GRACE_PERIOD_DAYS} dias
        e não foi renovado.
      </p>
    </div>
    <p style="color:#9BA1A6;font-size:13px;line-height:1.6;margin:0 0 20px;text-align:center">
      Renove agora pra reativar o acesso imediatamente.
    </p>
    ${ctaButton("🚀 Renovar e reativar agora →", "https://usebarberpro.com/admin/configuracoes?tab=pagamentos")}
  `, {
    headerSubtitle: t.tenantName,
    previewText: `Acesso suspenso — renove o plano anual do ${t.tenantName}`,
  });

  try {
    await sendEmail({
      to: t.adminEmail,
      subject: `🔒 Acesso suspenso — Renove o plano anual do ${t.tenantName}`,
      html,
    });
    console.log(`[annual-renewal] Email de bloqueio enviado: ${t.tenantName}`);
  } catch (e: any) {
    console.error(`[annual-renewal] Erro ao enviar email de bloqueio para ${t.tenantName}:`, e.message);
  }
}

export async function runAnnualRenewalJob(): Promise<void> {
  resetDailyCacheIfNeeded();
  try {
    // 1. Lembretes pra quem está chegando perto do vencimento
    const needingReminder = await findTenantsNeedingReminder();
    for (const t of needingReminder) {
      if (remindedToday.has(t.tenantId)) continue;
      await sendReminderEmail(t);
      remindedToday.add(t.tenantId);
    }

    // 2. Bloquear quem passou do prazo + tolerância, sem renovar
    const expiredPastGrace = await findExpiredPastGrace();
    for (const t of expiredPastGrace) {
      try {
        await rawQuery(
          `UPDATE tenants SET "barberproSubscriptionStatus" = 'expired', "updatedAt" = NOW() WHERE id = $1`,
          [t.tenantId]
        );
        await sendBlockedEmail(t);
        console.log(`[annual-renewal] Bloqueado por falta de renovação: ${t.tenantName} (venceu em ${t.nextDueDate})`);
      } catch (e: any) {
        console.error(`[annual-renewal] Erro ao bloquear tenant ${t.tenantId}:`, e.message);
      }
    }

    if (needingReminder.length > 0 || expiredPastGrace.length > 0) {
      console.log(`[annual-renewal] ${needingReminder.length} lembrete(s), ${expiredPastGrace.length} bloqueio(s)`);
    }
  } catch (err: any) {
    console.error("[annual-renewal] Erro no job:", err.message);
  }
}

// Disparo manual (pra testar sem esperar o intervalo, ou pelo painel superadmin)
export async function runAnnualRenewalJobManual() {
  console.log("[annual-renewal] Execução manual disparada");
  await runAnnualRenewalJob();
}

export function startAnnualRenewalJob() {
  console.log(`[annual-renewal] Job iniciado (intervalo: 24h, lembrete: ${REMINDER_DAYS_BEFORE}d antes, tolerância: ${GRACE_PERIOD_DAYS}d)`);
  setTimeout(runAnnualRenewalJob, 4 * 60 * 1000); // primeira execução em 4 min
  setInterval(runAnnualRenewalJob, JOB_INTERVAL_MS);
}
