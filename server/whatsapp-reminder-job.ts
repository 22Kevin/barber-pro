/**
 * Barber Pro — Job de Lembretes WhatsApp
 *
 * Executa a cada 10 minutos e verifica agendamentos futuros que precisam
 * de lembrete via WhatsApp. Envia dois lembretes:
 *   - 24h antes: lembrete do dia seguinte
 *   - 1h antes: lembrete de última hora
 *
 * O lembrete é gerado como um link wa.me com mensagem pré-formatada.
 * Como não há integração com API de WhatsApp Business, o job registra
 * os lembretes a serem enviados em um log e, opcionalmente, pode ser
 * expandido para usar a API oficial no futuro.
 *
 * Para barbearias com whatsapp configurado nas shopSettings, o sistema
 * gera o link e registra no console. A tela de agendamentos do admin
 * pode exibir um badge "Lembrete pendente" para o barbeiro enviar manualmente.
 */
import * as db from "./db";

const JOB_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

function formatPhone(phone: string): string {
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, "");
  // Se não começa com 55 (Brasil), adiciona
  if (!digits.startsWith("55") && digits.length <= 11) {
    return `55${digits}`;
  }
  return digits;
}

function buildReminderLink(phone: string, message: string): string {
  const formattedPhone = formatPhone(phone);
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMsg}`;
}

async function runWhatsAppReminderJob() {
  try {
    const now = new Date();
    const nowMs = now.getTime();

    // Janela de 24h: agendamentos entre 23h e 25h a partir de agora
    const window24hStart = new Date(nowMs + 23 * 60 * 60 * 1000);
    const window24hEnd = new Date(nowMs + 25 * 60 * 60 * 1000);

    // Janela de 1h: agendamentos entre 50min e 70min a partir de agora
    const window1hStart = new Date(nowMs + 50 * 60 * 1000);
    const window1hEnd = new Date(nowMs + 70 * 60 * 1000);

    // Formatar datas para comparação
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

    // Buscar todos os agendamentos futuros ativos
    const upcomingAppts = await db.getUpcomingAppointmentsForReminder();
    if (upcomingAppts.length === 0) return;

    let sent24h = 0;
    let sent1h = 0;

    for (const appt of upcomingAppts) {
      try {
        // Construir datetime do agendamento
        const apptDatetime = new Date(`${appt.date}T${appt.startTime}`);
        const apptMs = apptDatetime.getTime();

        // Verificar janela de 24h
        const needs24h = !appt.whatsappReminder24hSent &&
          apptMs >= window24hStart.getTime() &&
          apptMs <= window24hEnd.getTime();

        // Verificar janela de 1h
        const needs1h = !appt.whatsappReminder1hSent &&
          apptMs >= window1hStart.getTime() &&
          apptMs <= window1hEnd.getTime();

        if (!needs24h && !needs1h) continue;

        // Buscar dados do cliente
        const client = await db.getClientById(appt.clientId);
        if (!client || !client.phone) {
          // Sem telefone, marcar como enviado para não tentar novamente
          if (needs24h) await db.markWhatsAppReminder24hSent(appt.id);
          if (needs1h) await db.markWhatsAppReminder1hSent(appt.id);
          continue;
        }

        // Buscar dados do serviço e barbeiro
        const service = await db.getServiceById(appt.serviceId);
        const barber = await db.getBarberById(appt.barberId);
        if (!service || !barber) continue;

        // Buscar configurações da barbearia (para nome e template de mensagem)
        let shopName = "Barber Pro";
        let shopSlug = "barbearia";
        let reminderTemplate = "";

        if ((barber as any).tenantId) {
          const tenant = await db.getTenantById((barber as any).tenantId);
          if (tenant) {
            shopSlug = tenant.slug;
            shopName = tenant.name;
          }
          const settings = await db.getShopSettingsByTenantId((barber as any).tenantId);
          if (settings?.reminderMessageTemplate) {
            reminderTemplate = settings.reminderMessageTemplate;
          }
        } else {
          const settings = await db.getShopSettings();
          if (settings) {
            shopName = settings.shopName ?? shopName;
            if (settings.reminderMessageTemplate) {
              reminderTemplate = settings.reminderMessageTemplate;
            }
          }
        }

        // Formatar data e hora do agendamento
        const apptDateFormatted = apptDatetime.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        const apptTimeFormatted = appt.startTime.slice(0, 5);

        if (needs24h) {
          const message = reminderTemplate
            ? reminderTemplate
                .replace("{cliente}", client.name)
                .replace("{servico}", service.name)
                .replace("{data}", apptDateFormatted)
                .replace("{hora}", apptTimeFormatted)
                .replace("{barbearia}", shopName)
            : `Oi ${client.name}! 👋 Lembrando que amanhã você tem um agendamento em *${shopName}*:\n\n✂️ *${service.name}* com ${barber.name}\n📅 ${apptDateFormatted} às ${apptTimeFormatted}\n\nAté lá! 😊`;

          const waLink = buildReminderLink(client.phone, message);
          console.log(`[whatsapp-reminder] 24h — Cliente: ${client.name} | Agendamento #${appt.id} | Link: ${waLink}`);
          await db.markWhatsAppReminder24hSent(appt.id);
          sent24h++;
        }

        if (needs1h) {
          const message = `Oi ${client.name}! ⏰ Seu agendamento em *${shopName}* é em 1 hora!\n\n✂️ *${service.name}* com ${barber.name}\n🕐 Hoje às ${apptTimeFormatted}\n\nTe esperamos! 💈`;
          const waLink = buildReminderLink(client.phone, message);
          console.log(`[whatsapp-reminder] 1h — Cliente: ${client.name} | Agendamento #${appt.id} | Link: ${waLink}`);
          await db.markWhatsAppReminder1hSent(appt.id);
          sent1h++;
        }
      } catch (err) {
        console.error(`[whatsapp-reminder] Erro ao processar agendamento #${appt.id}:`, err);
      }
    }

    if (sent24h > 0 || sent1h > 0) {
      console.log(`[whatsapp-reminder] Lembretes processados: ${sent24h} de 24h, ${sent1h} de 1h`);
    }
  } catch (err) {
    console.error("[whatsapp-reminder] Erro no job:", err);
  }
}

export function startWhatsAppReminderJob() {
  console.log("[whatsapp-reminder] Job de lembretes WhatsApp iniciado (intervalo: 10 min)");
  // Executar com delay de 60s para o servidor estar pronto
  setTimeout(runWhatsAppReminderJob, 60_000);
  // Depois executar a cada 10 minutos
  setInterval(runWhatsAppReminderJob, JOB_INTERVAL_MS);
}
