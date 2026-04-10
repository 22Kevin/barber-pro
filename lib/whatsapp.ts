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
  /** Lista de nomes de serviços quando há múltiplos selecionados */
  serviceNames?: string[];
  /** Duração total em minutos (soma de todos os serviços) */
  totalDuration?: number;
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

/** Monta o bloco de serviços para a mensagem WhatsApp */
function buildServiceBlock(info: AppointmentInfo): string {
  const hasMultiple = info.serviceNames && info.serviceNames.length > 1;
  if (hasMultiple) {
    const list = info.serviceNames!.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
    const duration = info.totalDuration ? ` _(${info.totalDuration} min no total)_` : "";
    return `✂️ *Serviços:*\n${list}${duration}`;
  }
  const duration = info.totalDuration ? ` _(${info.totalDuration} min)_` : "";
  return `✂️ *Serviço:* ${info.serviceName}${duration}`;
}

export function buildConfirmationMessage(info: AppointmentInfo, template?: string | null): string {
  const serviceForTemplate = info.serviceNames && info.serviceNames.length > 1
    ? info.serviceNames.join(" + ")
    : info.serviceName;

  if (template) {
    return template
      .replace("{cliente}", info.clientName)
      .replace("{servico}", serviceForTemplate)
      .replace("{barbeiro}", info.barberName)
      .replace("{data}", formatDatePT(info.date))
      .replace("{hora}", info.startTime)
      .replace("{hora_fim}", info.endTime)
      .replace("{barbearia}", info.shopName ?? "Barber Pro")
      .replace("{endereco}", info.shopAddress ?? "");
  }

  return `Olá, ${info.clientName}! 🎉

Seu agendamento foi *confirmado* com sucesso!

${buildServiceBlock(info)}
💈 *Barbeiro:* ${info.barberName}
📅 *Data:* ${formatDatePT(info.date)}
⏰ *Horário:* ${info.startTime} às ${info.endTime}
${info.shopAddress ? `📍 *Endereço:* ${info.shopAddress}` : ""}

Caso precise cancelar ou reagendar, entre em contato conosco.

_${info.shopName ?? "Barber Pro"}_`;
}

export function buildReminderMessage(info: AppointmentInfo, template?: string | null): string {
  const serviceForTemplate = info.serviceNames && info.serviceNames.length > 1
    ? info.serviceNames.join(" + ")
    : info.serviceName;

  if (template) {
    return template
      .replace("{cliente}", info.clientName)
      .replace("{servico}", serviceForTemplate)
      .replace("{barbeiro}", info.barberName)
      .replace("{data}", formatDatePT(info.date))
      .replace("{hora}", info.startTime)
      .replace("{barbearia}", info.shopName ?? "Barber Pro");
  }

  return `Olá, ${info.clientName}! 👋

Lembrete: você tem um agendamento em *1 hora*!

${buildServiceBlock(info)}
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
