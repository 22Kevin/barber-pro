/**
 * Barber Pro — Job de E-mail de Avaliação Pós-Atendimento
 *
 * Executa a cada 15 minutos e verifica agendamentos concluídos
 * há aproximadamente 2 horas. Para cada um, envia um e-mail de
 * convite para avaliação ao cliente (se ele tiver e-mail cadastrado).
 *
 * A flag `reminderSent` na tabela `appointments` é reutilizada como
 * indicador de "e-mail de avaliação enviado" para evitar duplicatas.
 */
import * as db from "./db";
import { sendReviewRequestEmail } from "./email";

const JOB_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

async function runReviewEmailJob() {
  try {
    // Buscar agendamentos concluídos entre 1h50min e 4h atrás (janela de segurança)
    const appointments = await db.getCompletedAppointmentsForReview(1.83, 4);
    if (appointments.length === 0) return;

    console.log(`[review-job] ${appointments.length} agendamento(s) elegível(is) para e-mail de avaliação`);

    const baseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

    for (const appt of appointments) {
      try {
        // Buscar dados do cliente
        const client = await db.getClientById(appt.clientId);
        if (!client) continue;

        // Verificar se o cliente tem conta (e-mail) para receber o e-mail
        const clientAccount = await db.getClientAccountByClientId(appt.clientId);
        const clientEmail = clientAccount?.email ?? client.email;
        if (!clientEmail) {
          // Marcar como enviado para não tentar novamente
          await db.markAppointmentReviewEmailSent(appt.id);
          continue;
        }

        // Buscar dados do serviço e barbeiro
        const service = await db.getServiceById(appt.serviceId);
        const barber = await db.getBarberById(appt.barberId);
        if (!service || !barber) continue;

        // Determinar o slug da barbearia (via tenantId do barbeiro ou configurações)
        let shopSlug = "barbearia";
        let shopName = "Barber Pro";

        // Tentar buscar o tenant pelo barbeiro
        if ((barber as any).tenantId) {
          const tenant = await db.getTenantById((barber as any).tenantId);
          if (tenant) {
            shopSlug = tenant.slug;
            shopName = tenant.name;
          }
        } else {
          // Fallback: buscar configurações globais
          const settings = await db.getShopSettings();
          if (settings) shopName = settings.shopName ?? shopName;
        }

        // Verificar se já existe avaliação para este agendamento
        const existingReview = await db.getReviewByAppointmentId(appt.id);
        if (existingReview) {
          await db.markAppointmentReviewEmailSent(appt.id);
          continue;
        }

        // Enviar e-mail de avaliação
        await sendReviewRequestEmail({
          clientEmail,
          clientName: client.name,
          shopName,
          shopSlug,
          serviceName: service.name,
          barberName: barber.name,
          appointmentId: appt.id,
          baseUrl,
        });

        // Marcar como enviado
        await db.markAppointmentReviewEmailSent(appt.id);

        console.log(`[review-job] E-mail de avaliação enviado para ${clientEmail} (agendamento #${appt.id})`);
      } catch (err) {
        console.error(`[review-job] Erro ao processar agendamento #${appt.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[review-job] Erro no job de avaliação:", err);
  }
}

export function startReviewEmailJob() {
  console.log("[review-job] Job de e-mail de avaliação iniciado (intervalo: 15 min)");
  // Executar imediatamente na inicialização (com delay de 30s para o servidor estar pronto)
  setTimeout(runReviewEmailJob, 30_000);
  // Depois executar a cada 15 minutos
  setInterval(runReviewEmailJob, JOB_INTERVAL_MS);
}
