/**
 * Barber Pro — Job de Lembrete de Agendamento por E-mail
 * Executa a cada 30 minutos e envia e-mail 24h antes do agendamento.
 */
import * as db from "./db";
import { withRetry } from "./db";
import { sendAppointmentReminderEmail } from "./email";

const JOB_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

async function runEmailReminderJob() {
  try {
    const now = new Date();
    const nowMs = now.getTime();

    // Janela 24h: agendamentos entre 23h e 25h a partir de agora
    const window24hStart = new Date(nowMs + 23 * 60 * 60 * 1000);
    const window24hEnd   = new Date(nowMs + 25 * 60 * 60 * 1000);

    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
    const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

    const upcomingAppts = await withRetry(() => db.getUpcomingAppointmentsForReminder());
    if (!upcomingAppts.length) return;

    let sent = 0;
    for (const appt of upcomingAppts) {
      try {
        const apptDate = appt.date as string;
        const apptTime = (appt.startTime as string)?.substring(0, 5);
        if (!apptDate || !apptTime) continue;

        // Construir datetime do agendamento
        const [h, m] = apptTime.split(":").map(Number);
        const apptDt = new Date(apptDate + "T00:00:00");
        apptDt.setHours(h, m, 0, 0);
        const apptMs = apptDt.getTime();

        // Verificar se está na janela de 24h
        if (apptMs < window24hStart.getTime() || apptMs > window24hEnd.getTime()) continue;

        // Verificar se já enviamos lembrete (flag emailReminder24hSent)
        if ((appt as any).emailReminder24hSent) continue;

        // Buscar dados do cliente
        const client = appt.clientId ? await db.getClientById(appt.clientId as number) : null;
        if (!client?.email) continue;

        // Buscar dados da barbearia
        const barber = appt.barberId ? await db.getBarberById(appt.barberId as number) : null;
        if (!barber?.tenantId) continue;

        const shopSettings = await db.getShopSettings(barber.tenantId);
        const tenant = shopSettings as any;

        // Buscar nome do barbeiro e serviço
        const barberName = (appt as any).barberName || barber.name || "Profissional";
        const serviceName = (appt as any).serviceNames || (appt as any).serviceName || "Serviço";
        const endTime = (appt as any).endTime || apptTime;

        await sendAppointmentReminderEmail({
          clientEmail: client.email,
          clientName: client.name || "Cliente",
          shopName: tenant?.shopName || "Barbearia",
          shopSlug: tenant?.slug || "",
          shopLogoUrl: tenant?.logoUrl || null,
          shopPhone: tenant?.phone || null,
          serviceName,
          barberName,
          date: apptDate,
          startTime: apptTime,
          endTime,
        });

        // Marcar como enviado
        await db.markAppointmentEmailReminderSent(appt.id as number);
        sent++;
        console.log("[email-reminder] 24h enviado para " + client.email + " — agendamento #" + appt.id);
      } catch (err: any) {
        console.error("[email-reminder] Erro no agendamento #" + appt.id + ":", err.message);
      }
    }
    if (sent > 0) console.log("[email-reminder] " + sent + " lembrete(s) enviado(s)");

    // ── Lembrete push 1h antes ──────────────────────────────────────────────
    const window1hStart = new Date(nowMs + 50 * 60 * 1000);  // 50min a partir de agora
    const window1hEnd   = new Date(nowMs + 70 * 60 * 1000);  // 70min a partir de agora

    let pushSent = 0;
    for (const appt of upcomingAppts) {
      try {
        const apptDate = appt.date as string;
        const apptTime = (appt.startTime as string)?.substring(0, 5);
        if (!apptDate || !apptTime) continue;
        const [h2, m2] = apptTime.split(":").map(Number);
        const apptDt2 = new Date(apptDate + "T00:00:00");
        apptDt2.setHours(h2, m2, 0, 0);
        const apptMs2 = apptDt2.getTime();
        if (apptMs2 < window1hStart.getTime() || apptMs2 > window1hEnd.getTime()) continue;
        if ((appt as any).reminderSent) continue; // já enviou push de 1h

        // Enviar push para o cliente
        if ((appt as any).clientId) {
          const pushToken = await db.getClientPushToken((appt as any).clientId);
          if (pushToken) {
            const serviceName = (appt as any).serviceName ?? "seu serviço";
            const barberName  = (appt as any).barberName  ?? "seu barbeiro";
            await db.sendExpoPushNotification(
              pushToken,
              "⏰ Seu horário é em 1 hora!",
              `Lembrete: ${serviceName} com ${barberName} às ${apptTime}. Não se atrase! ✂️`,
              { type: "appointment_reminder", appointmentId: appt.id }
            );
            pushSent++;
          }
        }

        // Enviar push para o barbeiro também
        if ((appt as any).barberId) {
          const barberPushToken = await db.getBarberPushToken((appt as any).barberId);
          if (barberPushToken) {
            const clientName  = (appt as any).clientName  ?? "Cliente";
            const serviceName = (appt as any).serviceName ?? "serviço";
            await db.sendExpoPushNotification(
              barberPushToken,
              "📅 Agendamento em 1 hora",
              `${clientName} — ${serviceName} às ${apptTime}`,
              { type: "appointment_reminder_barber", appointmentId: appt.id }
            );
          }
        }
      } catch (err2: any) {
        console.error("[push-reminder] Erro no agendamento #" + appt.id + ":", err2.message);
      }
    }
    if (pushSent > 0) console.log("[push-reminder] " + pushSent + " lembrete(s) push enviado(s)");

  } catch (err: any) {
    console.error("[email-reminder] Erro no job:", err.message);
  }
}

export function startEmailReminderJob() {
  runEmailReminderJob();
  setInterval(runEmailReminderJob, JOB_INTERVAL_MS);
  console.log("[email-reminder] Job de lembrete por e-mail iniciado (intervalo: 30 min)");
}
