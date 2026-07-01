/**
 * Job de trial — notificações + bloqueio com grace period + subscription automática
 *
 * Executa a cada hora:
 *   1. Notifica tenants com trial expirando em 3 dias (email + push + WhatsApp)
 *   2. Após GRACE_PERIOD_HOURS de tolerância: bloqueia acesso e cria cobrança Asaas
 *
 * Grace period: evita bloquear barbeiros logo ao acordar quando o trial expirou
 * de madrugada. Dá 48h de tolerância antes de barrar o acesso.
 */

import { sendEmail, emailLayout, alertBox, ctaButton } from "./email";

const JOB_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
const DAYS_AHEAD = 3;
const GRACE_PERIOD_HOURS = 48; // Tolerância após expirar antes de bloquear

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

export function buildTrialExpiryEmailPublic(tenantName: string, adminName: string, daysLeft: number, trialEndsAt: Date, links?: { solo: string; team: string; studio: string; base: string }): string {
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

    <!-- CTA principal ANTES dos planos -->
    <div style="text-align:center;margin-bottom:24px">
      <a href="https://usebarberpro.com/admin/configuracoes?tab=plano"
         style="display:inline-block;background:#C9A84C;color:#0A0A0A;font-weight:800;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:0.3px">
        🚀 Assinar agora e não perder acesso →
      </a>
    </div>

    <!-- Planos disponíveis -->
    <p style="font-size:12px;color:#666;text-align:center;margin:0 0 14px">Escolha seu plano:</p>
    <div style="margin-bottom:28px">
      <a href="${links?.solo || 'https://usebarberpro.com/admin/configuracoes?tab=pagamentos&plan=solo'}" style="text-decoration:none;display:block;margin-bottom:10px">
        <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-weight:700;color:#ECEDEE">Solo</div><div style="font-size:12px;color:#666">1 barbeiro</div></div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:18px;font-weight:900;color:#C9A84C">R$49,90<span style="font-size:12px;font-weight:400;color:#666">/mês</span></div>
            <span style="font-size:11px;color:#C9A84C;border:1px solid #C9A84C44;padding:2px 8px;border-radius:6px">Escolher →</span>
          </div>
        </div>
      </a>
      <a href="${links?.team || 'https://usebarberpro.com/admin/configuracoes?tab=pagamentos&plan=team'}" style="text-decoration:none;display:block;margin-bottom:10px">
        <div style="background:#1A1A1A;border:2px solid #C9A84C44;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-weight:700;color:#ECEDEE">Equipe <span style="font-size:10px;background:#C9A84C22;color:#C9A84C;padding:2px 6px;border-radius:4px;margin-left:4px">POPULAR</span></div><div style="font-size:12px;color:#666">até 3 barbeiros</div></div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:18px;font-weight:900;color:#C9A84C">R$99,90<span style="font-size:12px;font-weight:400;color:#666">/mês</span></div>
            <span style="font-size:11px;color:#C9A84C;border:1px solid #C9A84C44;padding:2px 8px;border-radius:6px">Escolher →</span>
          </div>
        </div>
      </a>
      <a href="${links?.studio || 'https://usebarberpro.com/admin/configuracoes?tab=pagamentos&plan=studio'}" style="text-decoration:none;display:block">
        <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-weight:700;color:#ECEDEE">Estúdio</div><div style="font-size:12px;color:#666">barbeiros ilimitados</div></div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:18px;font-weight:900;color:#C9A84C">R$169,90<span style="font-size:12px;font-weight:400;color:#666">/mês</span></div>
            <span style="font-size:11px;color:#C9A84C;border:1px solid #C9A84C44;padding:2px 8px;border-radius:6px">Escolher →</span>
          </div>
        </div>
      </a>
    </div>

    <p style="color:#555555;font-size:12px;text-align:center;margin:0">
      Após a assinatura, o pagamento é feito via Pix e a ativação é imediata.
    </p>`;

  return emailLayout(body, {
    headerSubtitle: 'Aviso de Trial',
    previewText: `Seu trial do Barber Pro ${urgencyText}. Assine agora para continuar.`,
  });
}


// ─── Grace Period + Auto-Subscription ────────────────────────────────────────
async function processExpiredWithGrace(dbConn: any, graceCutoff: Date, graceCutoffStr: string, getAllBarbers: Function) {
  try {
    const { createAsaasSubscription, getOrCreateAsaasCustomer, asaasEnabled } = await import("./asaas");
    const PLAN_PRICES: Record<string, number> = { solo: 49.90, starter: 49.90, team: 99.90, studio: 169.90, estudios: 169.90 };

    // Buscar tenants cujo trial expirou há mais de GRACE_PERIOD_HOURS horas
    // Use only columns guaranteed to exist in all environments
    const expired = await (dbConn as any).execute(`
      SELECT
        t.id          AS "tenantId",
        t.name        AS "tenantName",
        t.plan        AS "plan",
        t.cnpj        AS "cnpj",
        t.phone       AS "phone",
        t."trialEndsAt",
        t."barberproSubscriptionId",
        b.id          AS "adminBarberId",
        b.email       AS "adminEmail",
        b.name        AS "adminName"
      FROM tenants t
      LEFT JOIN barbers b ON b."tenantId" = t.id AND b.role = 'super_admin'
      WHERE
        (t."barberproSubscriptionStatus" IS NULL OR t."barberproSubscriptionStatus" = 'trial')
        AND t."trialEndsAt" IS NOT NULL
        AND t."trialEndsAt" < '${graceCutoffStr}'
        AND (t."barberproSubscriptionId" IS NULL OR t."barberproSubscriptionId" = '')
      ORDER BY t."trialEndsAt" ASC
      LIMIT 20
    `);

    const rows: any[] = Array.isArray(expired) ? (expired[0] ?? expired) : (expired?.rows ?? []);
    if (!rows.length) return;

    for (const t of rows) {
      try {
        console.log(`[trial-expiry] Processando expirado com grace: ${t.tenantName} (trial terminou em ${t.trialEndsAt})`);

        const plan = t.barberproPlanName ?? t.plan ?? 'team';
        const price = PLAN_PRICES[plan] ?? 99.90;

        // 1. Marcar como expirado no banco para acionar o bloqueio
        await (dbConn as any).execute(
          `UPDATE tenants SET "barberproSubscriptionStatus" = 'expired', "updatedAt" = NOW() WHERE id = ${t.tenantId}`
        );

        // 2. Se Asaas estiver configurado, criar subscription pendente para o barbeiro pagar
        const cpfCnpj = (t.cnpj ?? "").replace(/\D/g, "");
        if (asaasEnabled && cpfCnpj.length >= 11) {
          try {
            const adminEmail = t.adminEmail ?? t.tenantEmail;
            if (adminEmail) {
              const customerId = t.barberproAsaasCustomerId
                ?? await getOrCreateAsaasCustomer({ email: adminEmail, name: t.adminName ?? t.tenantName });

              const nextDue = new Date();
              nextDue.setDate(nextDue.getDate() + 1); // Vence amanhã
              const nextDueStr = nextDue.toISOString().slice(0, 10);

              const planLabels: Record<string,string> = { solo:'Solo', starter:'Solo', team:'Equipe', studio:'Estúdio' };
              const subResult = await createAsaasSubscription({
                customer: customerId,
                billingType: 'PIX',
                value: price,
                nextDueDate: nextDueStr,
                cycle: 'MONTHLY',
                description: `Barber Pro — Plano ${planLabels[plan] ?? plan} (R$ ${price}/mês)`,
                externalReference: `tenant_${t.tenantId}_autoconv`,
              });

              // Salvar ID da subscription e mudar status para pending
              const subId = subResult.subscriptionId;
              await (dbConn as any).execute(
                `UPDATE tenants SET "barberproSubscriptionId" = '${subId}', "barberproSubscriptionStatus" = 'pending', "barberproNextDueDate" = '${nextDueStr}'::date, "updatedAt" = NOW() WHERE id = ${t.tenantId}`
              );

              console.log(`[trial-expiry] ✅ Subscription criada no Asaas para ${t.tenantName}: ${subResult.subscriptionId}`);

              // 3. Enviar email com link de pagamento (feito abaixo, fora do bloco Asaas)
            }
          } catch (asaasErr: any) {
            console.error(`[trial-expiry] Erro ao criar subscription Asaas para ${t.tenantName}:`, asaasErr.message);
          }
        } else if (asaasEnabled && cpfCnpj.length < 11) {
          // CPF/CNPJ não disponível — bloquear acesso mas não tentar criar no Asaas.
          // O barbeiro vai completar o cadastro ao clicar no magic link e pagar pela web.
          console.log(`[trial-expiry] ${t.tenantName}: sem CPF/CNPJ — bloqueando acesso, email com magic link enviado.`);
        }

        // 4. Sempre enviar email de bloqueio com magic link (independente do Asaas)
        const adminEmail = t.adminEmail;
        if (adminEmail) {
          try {
            const { generateMagicLink } = await import("./admin-routes") as any;
            const plan = t.plan ?? 'team';
            const PLAN_PRICES_2: Record<string, number> = { solo: 49.90, starter: 49.90, team: 99.90, studio: 169.90 };
            const price = PLAN_PRICES_2[plan] ?? 99.90;
            const planLabels2: Record<string,string> = { solo:'Solo', starter:'Solo', team:'Equipe', studio:'Estúdio' };

            let links;
            try { links = await generateMagicLink(t.tenantId); } catch {}

            const { sendEmail: sendMail, emailLayout, ctaButton } = await import("./email");
            const ctaUrl = links?.base ?? 'https://usebarberpro.com/admin/configuracoes?tab=pagamentos';
            const html = emailLayout(`
              <div style="text-align:center;margin-bottom:24px">
                <div style="font-size:40px;margin-bottom:12px">🔒</div>
                <h2 style="font-size:20px;font-weight:800;color:#ECEDEE;margin:0 0 8px">Seu período de teste encerrou</h2>
                <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0">
                  Olá, <strong style="color:#ECEDEE">${t.adminName ?? 'Admin'}</strong>!
                  O acesso ao <strong style="color:#ECEDEE">${t.tenantName}</strong> foi suspenso.
                  Assine um plano para reativar imediatamente.
                </p>
              </div>
              <div style="background:#1A1A1A;border:1px solid #C9A84C33;border-radius:14px;padding:20px;text-align:center;margin-bottom:24px">
                <div style="font-size:11px;color:#666;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Plano recomendado</div>
                <div style="font-size:28px;font-weight:900;color:#C9A84C">R$ ${price.toFixed(2).replace('.',',')}<span style="font-size:13px;color:#666;font-weight:400">/mês</span></div>
                <div style="font-size:12px;color:#666;margin-top:4px">Plano ${planLabels2[plan] ?? plan}</div>
              </div>
              ${links ? `
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
                <a href="${links.solo}" style="display:block;background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:12px;text-align:center;text-decoration:none">
                  <div style="font-weight:700;color:#ECEDEE;font-size:13px">Solo</div>
                  <div style="color:#C9A84C;font-size:16px;font-weight:800">R$49,90</div>
                </a>
                <a href="${links.team}" style="display:block;background:#1A1A1A;border:2px solid #C9A84C55;border-radius:10px;padding:12px;text-align:center;text-decoration:none">
                  <div style="font-weight:700;color:#C9A84C;font-size:13px">Equipe ✓</div>
                  <div style="color:#C9A84C;font-size:16px;font-weight:800">R$99,90</div>
                </a>
                <a href="${links.studio}" style="display:block;background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:12px;text-align:center;text-decoration:none">
                  <div style="font-weight:700;color:#ECEDEE;font-size:13px">Estúdio</div>
                  <div style="color:#C9A84C;font-size:16px;font-weight:800">R$169,90</div>
                </a>
              </div>` : ''}
              ${ctaButton('🚀 Reativar acesso agora →', ctaUrl)}
            `, { headerSubtitle: t.tenantName, previewText: `Reative o ${t.tenantName} — clique para assinar` });

            await sendMail({ to: adminEmail, subject: `🔒 Acesso suspenso — Reative o ${t.tenantName} no Barber Pro`, html });
            console.log(`[trial-expiry] ✅ Email de bloqueio enviado para ${adminEmail} (${t.tenantName})`);
          } catch (emailErr: any) {
            console.error(`[trial-expiry] Erro ao enviar email de bloqueio para ${t.tenantName}:`, emailErr.message);
          }
        }

      } catch (innerErr: any) {
        console.error(`[trial-expiry] Erro ao processar grace period para tenant ${t.tenantId}:`, innerErr.message);
      }
    }
  } catch (err: any) {
    console.error("[trial-expiry] Erro em processExpiredWithGrace:", err.message);
  }
}

async function runTrialExpiryJob() {
  try {
    resetDailyCache();

    const { getDb, getBarberPushToken, sendExpoPushNotification, getAllBarbers, rawQuery } = await import("./db");
    const dbConn = await getDb();
    if (!dbConn) return;

    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + DAYS_AHEAD);

    // Grace period cutoff: só bloqueia quem expirou há mais de GRACE_PERIOD_HOURS horas
    const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);
    const graceCutoffStr = graceCutoff.toISOString().slice(0, 10);

    const todayStr = today.toISOString().slice(0, 10);
    const limitStr = limitDate.toISOString().slice(0, 10);

    // ── A. Processar trials que já passaram do grace period → bloquear + cobrar ──
    await processExpiredWithGrace(dbConn, graceCutoff, graceCutoffStr, getAllBarbers);

    const rows = await (dbConn as any).execute(`
      SELECT
        t.id AS "tenantId",
        t.name AS "tenantName",
        t."trialEndsAt",
        t.phone AS "tenantPhone",
        t.cnpj AS "tenantCnpj",
        t."barberproPlanName",
        t."barberproAsaasCustomerId",
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
          // Gerar magic link para autenticação automática via email
          let magicLinks: { solo: string; team: string; studio: string; base: string } | undefined;
          try {
            const { generateMagicLink } = await import("./admin-routes") as any;
            magicLinks = await generateMagicLink(tenant.tenantId);
          } catch {}

          const html = buildTrialExpiryEmailPublic(
            tenant.tenantName,
            tenant.adminName ?? "Admin",
            daysLeft,
            trialEndsAt,
            magicLinks
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

Planos a partir de R$49,90/mês. 💈`;
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

        // Registrar email e CPF/CNPJ em used_trials quando trial expirou (daysLeft <= 0)
        if (daysLeft <= 0 && tenant.adminEmail) {
          try {
            const cleanCnpj = tenant.tenantCnpj ? tenant.tenantCnpj.replace(/\D/g, "") : null;
            await rawQuery(
              `INSERT INTO used_trials (email, "cpfCnpj", "tenantId", reason) VALUES ($1, $2, $3, 'trial_expired') ON CONFLICT DO NOTHING`,
              [tenant.adminEmail.toLowerCase(), cleanCnpj ?? null, tenantId]
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

// Manual trigger for test panel
export async function runTrialExpiryJobManual() {
  console.log("[trial-expiry] Execução manual disparada pelo superadmin");
  await runTrialExpiryJob();
}

export function startTrialExpiryJob() {
  console.log("[trial-expiry] Job iniciado (intervalo: 1h, grace period: 48h, antecedência: 3 dias)");
  setTimeout(runTrialExpiryJob, 2 * 60 * 1000);
  setInterval(runTrialExpiryJob, JOB_INTERVAL_MS);
}
