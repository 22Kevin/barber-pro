/**
 * Job de lembretes de renovação de assinatura
 * Executa a cada 30 minutos, verifica assinaturas com próxima ocorrência em 3 dias
 * e envia push notification + gera link WhatsApp para o cliente
 */
import * as db from "./db";

const JOB_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const DAYS_AHEAD = 3;

// Controle para não enviar duplicado no mesmo dia
const sentToday = new Set<string>();

function resetSentDaily() {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() < 31) {
    sentToday.clear();
  }
}

function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const fullNumber = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}

async function runSubscriptionReminderJob() {
  try {
    resetSentDaily();

    const reminders = await db.getUpcomingSubscriptionReminders(DAYS_AHEAD);
    if (reminders.length === 0) return;

    let sentCount = 0;

    for (const reminder of reminders) {
      const key = `${reminder.recurringId}-${reminder.nextDate}`;
      if (sentToday.has(key)) continue;

      try {
        const client = await db.getClientById(reminder.clientId);
        if (!client) continue;

        const service = await db.getServiceById(reminder.serviceId);
        const barber = await db.getBarberById(reminder.barberId);
        if (!service || !barber) continue;

        // Buscar nome da barbearia
        let shopName = "Barber Pro";
        if ((barber as any).tenantId) {
          const tenant = await db.getTenantById((barber as any).tenantId);
          if (tenant) shopName = tenant.name;
        } else {
          const settings = await db.getShopSettings();
          if (settings?.shopName) shopName = settings.shopName;
        }

        // Formatar data
        const nextDate = new Date(reminder.nextDate + "T12:00:00");
        const dateFormatted = nextDate.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        const timeFormatted = reminder.startTime.slice(0, 5);

        // Push notification para o barbeiro
        const barberToken = await db.getBarberPushToken(reminder.barberId);
        if (barberToken) {
          await db.sendExpoPushNotification(
            barberToken,
            "📅 Assinatura — Lembrete",
            `${client.name} tem agendamento recorrente em 3 dias: ${service.name} em ${dateFormatted} às ${timeFormatted}`,
            { type: "subscription_reminder", recurringId: reminder.recurringId }
          );
        }

        // Gerar link WhatsApp para o cliente
        if (client.phone) {
          const message = `Oi ${client.name}! 📅 Lembrete da sua assinatura em *${shopName}*:\n\n✂️ *${service.name}* com ${barber.name}\n📆 ${dateFormatted} às ${timeFormatted}\n\nTe esperamos! 💈\n\nCaso precise reagendar, entre em contato conosco.`;
          const waLink = buildWhatsAppLink(client.phone, message);
          console.log(`[subscription-reminder] Cliente: ${client.name} | Próxima: ${reminder.nextDate} | WhatsApp: ${waLink}`);
        }

        sentToday.add(key);
        sentCount++;
      } catch (err) {
        console.error(`[subscription-reminder] Erro ao processar assinatura #${reminder.recurringId}:`, err);
      }
    }

    if (sentCount > 0) {
      console.log(`[subscription-reminder] ${sentCount} lembrete(s) processado(s)`);
    }
  } catch (err) {
    console.error("[subscription-reminder] Erro no job:", err);
  }
}

export function startSubscriptionReminderJob() {
  console.log("[subscription-reminder] Job de lembretes de assinatura iniciado (intervalo: 30 min, antecedência: 3 dias)");
  // Executar com delay de 90s para o servidor estar pronto
  setTimeout(runSubscriptionReminderJob, 90_000);
  // Depois executar a cada 30 minutos
  setInterval(runSubscriptionReminderJob, JOB_INTERVAL_MS);
}
