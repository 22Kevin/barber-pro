/**
 * Integração Asaas — Barber Pro
 * ─────────────────────────────────────────────────────────────────────────────
 * Este arquivo centraliza toda a comunicação com a API do Asaas.
 *
 * COMO ATIVAR:
 * 1. Crie sua conta em https://www.asaas.com
 * 2. Acesse: Minha Conta → Integrações → Gerar chave de API
 * 3. Adicione a chave como variável de ambiente: ASAAS_API_KEY
 * 4. Para ambiente de testes, use a chave de SANDBOX e defina ASAAS_SANDBOX=true
 *
 * TIPOS DE COBRANÇA SUPORTADOS:
 * - Cobrança avulsa (produto) — BOLETO, CREDIT_CARD, PIX
 * - Cobrança por agendamento — PIX ou BOLETO
 * - Cobrança recorrente mensal (assinatura) — BOLETO, CREDIT_CARD, PIX
 */

import axios from "axios";

// ─── Configuração ─────────────────────────────────────────────────────────────

const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? "";
const ASAAS_SANDBOX = process.env.ASAAS_SANDBOX === "true";
const ASAAS_BASE_URL = ASAAS_SANDBOX
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3";

export const asaasEnabled = !!ASAAS_API_KEY;

const asaasApi = axios.create({
  baseURL: ASAAS_BASE_URL,
  headers: {
    "access_token": ASAAS_API_KEY,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AsaasBillingType = "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED";

export interface AsaasCustomerPayload {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string; // clientId no nosso sistema
}

export interface AsaasChargePayload {
  customer: string;           // ID do cliente no Asaas
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;            // YYYY-MM-DD
  description: string;
  externalReference?: string; // appointmentId ou orderId no nosso sistema
  postalService?: boolean;
}

export interface AsaasSubscriptionPayload {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;        // YYYY-MM-DD — data da primeira cobrança
  cycle: "MONTHLY";
  description: string;
  externalReference?: string; // subscriptionId no nosso sistema
}

export interface AsaasPaymentResult {
  id: string;
  status: "PENDING" | "RECEIVED" | "CONFIRMED" | "OVERDUE" | "REFUNDED" | "CANCELLED";
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  pixCopyCola?: string;
  value: number;
  dueDate: string;
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

/**
 * Cria ou recupera um cliente no Asaas pelo externalReference (clientId).
 * Evita duplicatas buscando pelo externalReference antes de criar.
 */
export async function getOrCreateAsaasCustomer(payload: AsaasCustomerPayload): Promise<string> {
  if (!asaasEnabled) throw new Error("Asaas não configurado. Adicione ASAAS_API_KEY.");
  // Buscar por externalReference para evitar duplicata
  if (payload.externalReference) {
    try {
      const search = await asaasApi.get(`/customers?externalReference=${payload.externalReference}`);
      const existing = search.data?.data?.[0];
      if (existing?.id) return existing.id;
    } catch {}
  }
  const res = await asaasApi.post("/customers", payload);
  return res.data.id as string;
}

// ─── Cobranças Avulsas ────────────────────────────────────────────────────────

/**
 * Cria uma cobrança avulsa (produto ou agendamento).
 * Retorna o ID da cobrança e os dados de pagamento (Pix, boleto, etc.).
 */
export async function createAsaasCharge(payload: AsaasChargePayload): Promise<AsaasPaymentResult> {
  if (!asaasEnabled) throw new Error("Asaas não configurado. Adicione ASAAS_API_KEY.");
  const res = await asaasApi.post("/payments", payload);
  const data = res.data;
  // Para Pix, buscar QR Code
  let pixQrCode: string | undefined;
  let pixCopyCola: string | undefined;
  if (payload.billingType === "PIX" && data.id) {
    try {
      const pixRes = await asaasApi.get(`/payments/${data.id}/pixQrCode`);
      pixQrCode = pixRes.data?.encodedImage;
      pixCopyCola = pixRes.data?.payload;
    } catch {}
  }
  return {
    id: data.id,
    status: data.status,
    invoiceUrl: data.invoiceUrl,
    bankSlipUrl: data.bankSlipUrl,
    pixQrCode,
    pixCopyCola,
    value: data.value,
    dueDate: data.dueDate,
  };
}

// ─── Assinaturas Recorrentes ──────────────────────────────────────────────────

/**
 * Cria uma assinatura mensal recorrente no Asaas.
 * Retorna o ID da assinatura no Asaas.
 */
export async function createAsaasSubscription(payload: AsaasSubscriptionPayload): Promise<string> {
  if (!asaasEnabled) throw new Error("Asaas não configurado. Adicione ASAAS_API_KEY.");
  const res = await asaasApi.post("/subscriptions", payload);
  return res.data.id as string;
}

/**
 * Cancela uma assinatura recorrente no Asaas.
 */
export async function cancelAsaasSubscription(asaasSubscriptionId: string): Promise<void> {
  if (!asaasEnabled) return;
  await asaasApi.delete(`/subscriptions/${asaasSubscriptionId}`);
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export type AsaasWebhookEvent =
  | "PAYMENT_RECEIVED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_CANCELLED"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_CANCELLED";

export interface AsaasWebhookPayload {
  event: AsaasWebhookEvent;
  payment?: {
    id: string;
    externalReference?: string;
    value: number;
    status: string;
    customer: string;
  };
  subscription?: {
    id: string;
    externalReference?: string;
    status: string;
  };
}

/**
 * Processa um evento de webhook recebido do Asaas.
 * Retorna o tipo de evento e os dados relevantes para atualização no banco.
 */
export function parseAsaasWebhook(body: AsaasWebhookPayload): {
  type: "payment" | "subscription";
  event: AsaasWebhookEvent;
  externalReference?: string;
  asaasId: string;
  status: string;
} {
  if (body.payment) {
    return {
      type: "payment",
      event: body.event,
      externalReference: body.payment.externalReference,
      asaasId: body.payment.id,
      status: body.payment.status,
    };
  }
  if (body.subscription) {
    return {
      type: "subscription",
      event: body.event,
      externalReference: body.subscription.externalReference,
      asaasId: body.subscription.id,
      status: body.subscription.status,
    };
  }
  throw new Error("Webhook Asaas sem dados de pagamento ou assinatura");
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

/** Formata uma data para o padrão YYYY-MM-DD exigido pelo Asaas */
export function asaasDate(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

/** Retorna a data de vencimento padrão (3 dias a partir de hoje) */
export function asaasDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return asaasDate(d);
}
