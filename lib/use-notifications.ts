import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configura o handler global — notificações aparecem mesmo com o app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Hook principal de notificações do Barber Pro.
 * Deve ser chamado uma única vez no layout raiz do app.
 * Configura o canal Android, solicita permissão e registra listeners.
 */
export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Configura canal Android (obrigatório para Android 8+)
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("barber-pro-reminders", {
        name: "Lembretes de Agendamento",
        description: "Notificações de lembrete 1 hora antes do seu agendamento",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#C9A84C",
        sound: "default",
      });
    }

    // Solicita permissão ao usuário
    requestPermissionsAsync();

    // Listener: notificação recebida com app aberto
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notificação recebida — o handler já cuida de exibir
      }
    );

    // Listener: usuário tocou na notificação
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (_response) => {
        // Aqui poderíamos navegar para a tela de agendamentos
        // Ex: router.push("/client/(tabs)/history")
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}

/**
 * Solicita permissão de notificações ao usuário.
 * Retorna true se a permissão foi concedida.
 */
export async function requestPermissionsAsync(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Agenda uma notificação de lembrete 1 hora antes do agendamento.
 *
 * @param appointmentId - ID do agendamento (usado como identificador único)
 * @param serviceName - Nome do serviço agendado
 * @param barberName - Nome do barbeiro
 * @param appointmentDate - Data e hora do agendamento (objeto Date)
 * @returns O identifier da notificação agendada, ou null se não foi possível agendar
 */
export async function scheduleAppointmentReminder(
  appointmentId: number,
  serviceName: string,
  barberName: string,
  appointmentDate: Date,
  hoursBeforeAppt: number = 1
): Promise<string | null> {
  if (Platform.OS === "web") return null;

  // Calcula o horário do lembrete conforme preferência do cliente
  const reminderDate = new Date(appointmentDate.getTime() - hoursBeforeAppt * 60 * 60 * 1000);
  const now = new Date();

  // Só agenda se o lembrete for no futuro (com pelo menos 10 segundos de margem)
  if (reminderDate.getTime() - now.getTime() < 10_000) {
    return null;
  }

  // Cancela qualquer lembrete anterior para este agendamento
  await cancelAppointmentReminder(appointmentId);

  const hoursLabel = hoursBeforeAppt === 24 ? "1 dia" : hoursBeforeAppt === 1 ? "1 hora" : `${hoursBeforeAppt} horas`;

  try {
    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return null;

    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: `appointment-reminder-${appointmentId}`,
      content: {
        title: "✂️ Lembrete de Agendamento — Barber Pro",
        body: `Seu ${serviceName} com ${barberName} começa em ${hoursLabel}!`,
        data: {
          appointmentId,
          type: "appointment_reminder",
        },
        sound: "default",
        // Android: ícone e cor
        ...(Platform.OS === "android" && {
          color: "#C9A84C",
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });

    return identifier;
  } catch (error) {
    console.warn("[Barber Pro] Erro ao agendar notificação:", error);
    return null;
  }
}

/**
 * Cancela o lembrete de um agendamento específico.
 *
 * @param appointmentId - ID do agendamento cujo lembrete deve ser cancelado
 */
export async function cancelAppointmentReminder(appointmentId: number): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await Notifications.cancelScheduledNotificationAsync(
      `appointment-reminder-${appointmentId}`
    );
  } catch {
    // Ignora erro se a notificação não existir
  }
}

/**
 * Agenda uma notificação anual de aniversário para o cliente.
 * Dispara todo ano no dia e mês de nascimento às 9h da manhã.
 *
 * @param clientId - ID do cliente (usado como identificador único)
 * @param clientName - Nome do cliente para personalizar a mensagem
 * @param birthDate - Data no formato AAAA-MM-DD
 */
export async function scheduleBirthdayNotification(
  clientId: number,
  clientName: string,
  birthDate: string
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return;
    const parts = birthDate.split("-");
    if (parts.length !== 3) return;
    const month = parseInt(parts[1], 10) - 1; // JS month é 0-indexed
    const day = parseInt(parts[2], 10);
    // Cancela notificação anterior antes de reagendar
    await cancelBirthdayNotification(clientId);
    await Notifications.scheduleNotificationAsync({
      identifier: `birthday-${clientId}`,
      content: {
        title: `🎂 Feliz Aniversário, ${clientName}!`,
        body: "Sua barbearia tem um presente especial para você hoje. Confira seus cupons!",
        data: { type: "birthday", clientId },
        sound: "default",
        ...(Platform.OS === "android" && { color: "#EAB308" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month,
        day,
        hour: 9,
        minute: 0,
      },
    });
  } catch (error) {
    console.warn("[Barber Pro] Erro ao agendar notificação de aniversário:", error);
  }
}

/**
 * Cancela a notificação de aniversário de um cliente.
 *
 * @param clientId - ID do cliente
 */
export async function cancelBirthdayNotification(clientId: number): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`birthday-${clientId}`);
  } catch {
    // Ignora erro se a notificação não existir
  }
}

/**
 * Cancela TODOS os lembretes de agendamentos agendados.
 * Útil ao fazer logout do cliente.
 */
export async function cancelAllAppointmentReminders(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const reminders = scheduled.filter(
      (n) => n.identifier.startsWith("appointment-reminder-")
    );
    await Promise.all(
      reminders.map((n) =>
        Notifications.cancelScheduledNotificationAsync(n.identifier)
      )
    );
  } catch (error) {
    console.warn("[Barber Pro] Erro ao cancelar lembretes:", error);
  }
}

/**
 * Envia uma notificação imediata para o barbeiro informando sobre um novo agendamento.
 * Disparada quando um cliente cria um agendamento pela Área do Cliente.
 *
 * @param clientName - Nome do cliente que agendou
 * @param serviceName - Nome do serviço agendado
 * @param appointmentDate - Data e hora do agendamento
 * @param appointmentId - ID do agendamento
 */
export async function notifyBarberNewAppointment(
  clientName: string,
  serviceName: string,
  appointmentDate: Date,
  appointmentId: number
): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return;

    const timeStr = appointmentDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateStr = appointmentDate.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

    await Notifications.scheduleNotificationAsync({
      identifier: `new-appointment-${appointmentId}`,
      content: {
        title: "📅 Novo Agendamento — Barber Pro",
        body: `${clientName} agendou ${serviceName} para ${timeStr} de ${dateStr}`,
        data: {
          appointmentId,
          type: "new_appointment",
        },
        sound: "default",
        ...(Platform.OS === "android" && { color: "#C9A84C" }),
      },
      trigger: null, // Disparo imediato
    });
  } catch (error) {
    console.warn("[Barber Pro] Erro ao notificar barbeiro:", error);
  }
}

/**
 * Agenda uma notificação de avaliação pós-atendimento.
 * Disparada 2 horas após o horário do atendimento, convidando o cliente a avaliar.
 *
 * @param appointmentId - ID do agendamento
 * @param serviceName - Nome do serviço realizado
 * @param barberName - Nome do barbeiro
 * @param appointmentDate - Data e horário do início do atendimento
 */
export async function scheduleReviewNotification(
  appointmentId: number,
  serviceName: string,
  barberName: string,
  appointmentDate: Date,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return;

    // Dispara 2 horas após o horário do atendimento
    const triggerDate = new Date(appointmentDate.getTime() + 2 * 60 * 60 * 1000);

    // Não agendar se o horário já passou
    if (triggerDate <= new Date()) return;

    await Notifications.scheduleNotificationAsync({
      identifier: `review-${appointmentId}`,
      content: {
        title: "⭐ Como foi seu atendimento?",
        body: `Você fez ${serviceName} com ${barberName}. Avalie sua experiência!`,
        data: {
          appointmentId,
          type: "review_request",
          screen: "/client/(tabs)/history",
        },
        sound: "default",
        ...(Platform.OS === "android" && { color: "#EAB308" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch (error) {
    console.warn("[Barber Pro] Erro ao agendar notificação de avaliação:", error);
  }
}

/**
 * Cancela a notificação de avaliação de um agendamento (ex: se o agendamento for cancelado).
 */
export async function cancelReviewNotification(appointmentId: number): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`review-${appointmentId}`);
  } catch {
    // Silencioso — pode não existir
  }
}

/**
 * Formata a data do agendamento para exibição amigável na notificação.
 * Ex: "14:30 de hoje", "09:00 de amanhã", "15:00 de sex, 28/02"
 */
export function formatAppointmentDateForNotification(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const appointmentDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (appointmentDay.getTime() === today.getTime()) {
    return `${timeStr} de hoje`;
  } else if (appointmentDay.getTime() === tomorrow.getTime()) {
    return `${timeStr} de amanhã`;
  } else {
    const dayStr = date.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
    return `${timeStr} de ${dayStr}`;
  }
}
