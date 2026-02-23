/**
 * Utilitário para envio de mensagens via WhatsApp
 * Usa o esquema de URL wa.me para abrir o WhatsApp com mensagem pré-preenchida
 * Para envio automático (sem interação do usuário), seria necessário a API oficial do WhatsApp Business
 */

import { Linking, Platform } from "react-native";

export interface AppointmentInfo {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  barberName: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  shopName?: string;
  shopAddress?: string;
}

const MONTHS_PT = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro"
];

function formatDatePT(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const monthName = MONTHS_PT[parseInt(m) - 1];
  return `${parseInt(d)} de ${monthName} de ${y}`;
}

function formatPhone(phone: string): string {
  // Remove tudo que não for número
  const digits = phone.replace(/\D/g, "");
  // Se não começar com 55 (Brasil), adiciona
  if (!digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export function buildConfirmationMessage(info: AppointmentInfo, template?: string | null): string {
  if (template) {
    return template
      .replace("{cliente}", info.clientName)
      .replace("{servico}", info.serviceName)
      .replace("{barbeiro}", info.barberName)
      .replace("{data}", formatDatePT(info.date))
      .replace("{hora}", info.startTime)
      .replace("{hora_fim}", info.endTime)
      .replace("{barbearia}", info.shopName ?? "Barber Pro")
      .replace("{endereco}", info.shopAddress ?? "");
  }

  return `Olá, ${info.clientName}! 🎉

Seu agendamento foi *confirmado* com sucesso!

✂️ *Serviço:* ${info.serviceName}
💈 *Barbeiro:* ${info.barberName}
📅 *Data:* ${formatDatePT(info.date)}
⏰ *Horário:* ${info.startTime} às ${info.endTime}
${info.shopAddress ? `📍 *Endereço:* ${info.shopAddress}` : ""}

Caso precise cancelar ou reagendar, entre em contato conosco.

_${info.shopName ?? "Barber Pro"}_`;
}

export function buildReminderMessage(info: AppointmentInfo, template?: string | null): string {
  if (template) {
    return template
      .replace("{cliente}", info.clientName)
      .replace("{servico}", info.serviceName)
      .replace("{barbeiro}", info.barberName)
      .replace("{data}", formatDatePT(info.date))
      .replace("{hora}", info.startTime)
      .replace("{barbearia}", info.shopName ?? "Barber Pro");
  }

  return `Olá, ${info.clientName}! 👋

Lembrete: você tem um agendamento em *1 hora*!

✂️ *Serviço:* ${info.serviceName}
💈 *Barbeiro:* ${info.barberName}
⏰ *Horário:* ${info.startTime}
${info.shopAddress ? `📍 *Endereço:* ${info.shopAddress}` : ""}

Te esperamos! 💈

_${info.shopName ?? "Barber Pro"}_`;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    const formattedPhone = formatPhone(phone);
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }

    // Fallback para web
    if (Platform.OS === "web") {
      window.open(url, "_blank");
      return true;
    }

    return false;
  } catch (error) {
    console.error("Erro ao abrir WhatsApp:", error);
    return false;
  }
}

export async function sendConfirmationWhatsApp(info: AppointmentInfo, template?: string | null): Promise<boolean> {
  const message = buildConfirmationMessage(info, template);
  return sendWhatsAppMessage(info.clientPhone, message);
}

export async function sendReminderWhatsApp(info: AppointmentInfo, template?: string | null): Promise<boolean> {
  const message = buildReminderMessage(info, template);
  return sendWhatsAppMessage(info.clientPhone, message);
}
