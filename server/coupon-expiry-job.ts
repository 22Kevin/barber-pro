/**
 * Job de expiração de cupom — remove o desconto da assinatura no Asaas
 * depois que o prazo (durationMonths) do cupom resgatado se esgota.
 *
 * Necessário porque o Asaas não tem um conceito nativo de "desconto por
 * N ciclos" — uma vez aplicado, o desconto fica ativo indefinidamente até
 * alguém removê-lo manualmente. Este job faz esse papel automaticamente.
 *
 * Executa 1x por dia. Não precisa de mais frequência que isso, já que a
 * granularidade do prazo é em meses.
 */

import { rawQuery } from "./db";
import { asaasApi, asaasEnabled } from "./asaas";

const JOB_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

interface ExpiredCouponRow {
  id: number;
  asaasDiscountId: string;
  tenantId: number;
  promotionId: number;
  promotionName: string;
}

async function findExpiredCouponApplications(): Promise<ExpiredCouponRow[]> {
  const rows = await rawQuery(`
    SELECT a.id, a."asaasDiscountId", a."tenantId", a."promotionId", p.name AS "promotionName"
    FROM superadmin_promotion_applications a
    JOIN superadmin_promotions p ON p.id = a."promotionId"
    WHERE a."expiredAt" IS NULL
      AND a."asaasDiscountId" IS NOT NULL
      AND p."durationMonths" IS NOT NULL
      AND a."appliedAt" + (p."durationMonths" || ' months')::interval <= NOW()
  `);
  return rows as ExpiredCouponRow[];
}

async function removeAsaasDiscount(subscriptionId: string): Promise<void> {
  // Zera o desconto (0%) em vez de tentar "remover" o campo — efeito prático
  // idêntico (assinatura volta a cobrar o valor cheio), e evita depender de
  // um comportamento de "remoção" que a API do Asaas não documenta claramente.
  await asaasApi.post(`/subscriptions/${subscriptionId}`, {
    discount: { value: 0, dueDateLimitDays: 0, type: "PERCENTAGE" },
  });
}

async function markApplicationExpired(applicationId: number): Promise<void> {
  await rawQuery(
    `UPDATE superadmin_promotion_applications SET "expiredAt" = NOW() WHERE id = $1`,
    [applicationId]
  );
}

export async function runCouponExpiryJob(): Promise<void> {
  if (!asaasEnabled) return;
  try {
    const expired = await findExpiredCouponApplications();
    if (expired.length === 0) return;

    let processed = 0;
    for (const row of expired) {
      try {
        await removeAsaasDiscount(row.asaasDiscountId);
        await markApplicationExpired(row.id);
        processed++;
        console.log(`[coupon-expiry] Desconto removido — tenant #${row.tenantId}, cupom "${row.promotionName}" (assinatura ${row.asaasDiscountId})`);
      } catch (err: any) {
        // Não marca como expirado se a chamada ao Asaas falhar - tenta de
        // novo na próxima execução do job (24h depois), evita perder o
        // registro por causa de uma falha temporária de rede.
        console.error(`[coupon-expiry] Erro ao remover desconto (application #${row.id}, tenant #${row.tenantId}):`, err?.response?.data?.errors ?? err.message);
      }
    }
    if (processed > 0) {
      console.log(`[coupon-expiry] ${processed} desconto(s) de cupom expirado(s) removido(s)`);
    }
  } catch (err: any) {
    console.error("[coupon-expiry] Erro no job:", err.message);
  }
}

// Disparo manual (útil pra testar sem esperar o intervalo, ou pro painel superadmin)
export async function runCouponExpiryJobManual() {
  console.log("[coupon-expiry] Execução manual disparada");
  await runCouponExpiryJob();
}

export function startCouponExpiryJob() {
  console.log("[coupon-expiry] Job iniciado (intervalo: 24h)");
  setTimeout(runCouponExpiryJob, 3 * 60 * 1000); // primeira execução em 3 min
  setInterval(runCouponExpiryJob, JOB_INTERVAL_MS);
}
