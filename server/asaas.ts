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

export const asaasApi = axios.create({
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
  address?: string;
  addressNumber?: string;
  postalCode?: string;
}

export interface AsaasCreditCardInfo {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone?: string;
}

export interface AsaasChargePayload {
  customer: string;           // ID do cliente no Asaas
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;            // YYYY-MM-DD
  description: string;
  externalReference?: string; // appointmentId ou orderId no nosso sistema
  postalService?: boolean;
  creditCard?: AsaasCreditCardInfo;
  creditCardHolderInfo?: AsaasCreditCardHolderInfo;
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

// ─── Subcontas ────────────────────────────────────────────────────────────────

export type AsaasCompanyType = "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";

export interface AsaasSubAccountPayload {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string;        // YYYY-MM-DD (obrigatório para PF)
  companyType?: AsaasCompanyType; // obrigatório para PJ
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;         // bairro
  postalCode?: string;
}

export interface AsaasSubAccountResult {
  id: string;          // accountId da subconta
  apiKey: string;      // chave de API da subconta (salvar imediatamente — não pode ser recuperada depois)
  walletId: string;    // usado para split de pagamentos
  accountNumber?: {
    agency: string;
    account: string;
    accountDigit: string;
  };
}

/**
 * Cria uma subconta Asaas vinculada à conta raiz.
 * IMPORTANTE: O apiKey retornado deve ser salvo imediatamente — o Asaas não permite recuperá-lo depois.
 */
export async function createAsaasSubAccount(
  payload: AsaasSubAccountPayload
): Promise<AsaasSubAccountResult> {
  const response = await asaasApi.post("/v3/accounts", payload);
  const data = response.data;
  return {
    id: data.id,
    apiKey: data.apiKey,
    walletId: data.walletId,
    accountNumber: data.accountNumber,
  };
}

/**
 * Busca os dados de uma subconta Asaas pelo ID.
 */
export async function getAsaasSubAccount(accountId: string): Promise<{
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  commercialInfo?: { status: string };
  walletId: string;
}> {
  const response = await asaasApi.get(`/v3/accounts/${accountId}`);
  return response.data;
}

/**
 * Cria uma instância do cliente Asaas usando a apiKey de uma subconta específica.
 * Usado para criar cobranças em nome da subconta (barbearia).
 */
const ASAAS_BASE_URL_V3 = ASAAS_SANDBOX
  ? "https://sandbox.asaas.com/api"
  : "https://api.asaas.com";

export function getAsaasSubAccountApi(subAccountApiKey: string) {
  return axios.create({
    baseURL: ASAAS_BASE_URL_V3,
    headers: {
      "access_token": subAccountApiKey,
      "Content-Type": "application/json",
      "User-Agent": "BarberPro/1.0",
    },
    timeout: 15000,
  });
}

/**
 * Cria ou busca um cliente na conta RAIZ do Asaas (para cobrar a mensalidade do Barber Pro).
 * Busca primeiro pelo cpfCnpj para evitar duplicatas.
 * Retorna o customerId do Asaas.
 */
export async function ensureAsaasRootCustomer(params: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  tenantId: number;
}): Promise<string> {
  if (!asaasEnabled) throw new Error("Asaas não configurado. Adicione ASAAS_API_KEY.");
  const cpfCnpjClean = params.cpfCnpj.replace(/\D/g, "");

  // Busca por externalReference (tenantId) primeiro
  try {
    const search = await asaasApi.get(`/customers`, {
      params: { externalReference: `tenant_${params.tenantId}` },
    });
    if (search.data?.data?.length > 0) {
      return search.data.data[0].id as string;
    }
  } catch {}

  // Busca por CPF/CNPJ
  try {
    const search = await asaasApi.get(`/customers`, {
      params: { cpfCnpj: cpfCnpjClean },
    });
    if (search.data?.data?.length > 0) {
      return search.data.data[0].id as string;
    }
  } catch {}

  // Cria novo cliente
  const res = await asaasApi.post("/customers", {
    name: params.name,
    email: params.email,
    cpfCnpj: cpfCnpjClean,
    mobilePhone: params.mobilePhone,
    externalReference: `tenant_${params.tenantId}`,
  });
  return res.data.id as string;
}

/**
 * Busca o status atual de uma assinatura no Asaas.
 */
export async function getAsaasSubscriptionStatus(subscriptionId: string): Promise<{
  id: string;
  status: string;
  nextDueDate: string;
  value: number;
}> {
  if (!asaasEnabled) throw new Error("Asaas não configurado.");
  const res = await asaasApi.get(`/subscriptions/${subscriptionId}`);
  return {
    id: res.data.id,
    status: res.data.status,
    nextDueDate: res.data.nextDueDate,
    value: res.data.value,
  };
}
