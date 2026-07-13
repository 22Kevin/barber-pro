/**
 * Integração Google Agenda — Barber Pro
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincronização UNIDIRECIONAL (fase 1): Barber Pro → Google Agenda.
 * Cada barbeiro conecta a própria conta e os agendamentos criados/editados/
 * cancelados no Barber Pro são refletidos automaticamente num calendário
 * dedicado ("Barber Pro") na Google Agenda dele.
 *
 * Bloqueios feitos direto na Google Agenda NÃO voltam pro Barber Pro nessa
 * fase — ver "Fase 2" no plano técnico.
 *
 * COMO ATIVAR (variáveis de ambiente no Railway):
 * - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — já configurados hoje (usados
 *   também no fluxo de cadastro via Google). Precisa apenas adicionar a URL
 *   de callback desta feature nas "Authorized redirect URIs" do OAuth Client
 *   no Google Cloud Console.
 * - GOOGLE_TOKEN_ENCRYPTION_KEY — nova, uma string aleatória de 32+
 *   caracteres, usada só pra criptografar o refresh_token guardado no banco.
 *
 * IMPORTANTE — regra de segurança deste arquivo:
 * TODA chamada à API do Google aqui é isolada com try/catch e NUNCA deve
 * impedir a criação/edição/cancelamento de um agendamento no Barber Pro.
 * Se o Google falhar, o agendamento continua funcionando normalmente — a
 * sincronização é tratada como um complemento, não uma dependência.
 */

import crypto from "crypto";
import * as db from "./db";

// ─── Configuração ─────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const ENCRYPTION_KEY_RAW = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "";

export const googleCalendarEnabled = !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET;

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.app.created";
const CALENDAR_NAME = "Barber Pro";
const TIMEZONE = "America/Sao_Paulo";

// ─── Criptografia do refresh_token ─────────────────────────────────────────────
// AES-256-GCM. Se a env var não estiver configurada, os métodos de
// criptografia lançam erro explícito em vez de salvar token em texto puro.

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY_RAW) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY não configurada — não é seguro salvar o token sem isso.");
  }
  // Deriva uma chave de 32 bytes de forma determinística a partir da env var
  return crypto.createHash("sha256").update(ENCRYPTION_KEY_RAW).digest();
}

function encryptToken(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // formato: iv:authTag:encrypted, tudo em base64
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptToken(stored: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, encryptedB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !encryptedB64) throw new Error("Token armazenado em formato inválido.");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

// ─── OAuth: iniciar conexão ─────────────────────────────────────────────────────

export function getGoogleCalendarAuthUrl(redirectUri: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPE);
  url.searchParams.set("state", state);
  // access_type=offline + prompt=consent: garante que o Google devolve um
  // refresh_token (sem prompt=consent, só vem na primeira autorização de
  // cada usuário — como pode ser reconexão, forçamos sempre)
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = await res.json() as any;
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Google não retornou refresh_token. Resposta: " + JSON.stringify(data));
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in ?? 3600 };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = await res.json() as any;
  if (!data.access_token) {
    throw new Error("Falha ao renovar access_token: " + JSON.stringify(data));
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

// ─── Fluxo NATIVO (app mobile) ──────────────────────────────────────────────
// O app usa @react-native-google-signin/google-signin com offlineAccess:true
// e o escopo de Agenda, o que retorna um "serverAuthCode" (sem precisar abrir
// nenhum navegador — é 100% nativo). Esse código é trocado por tokens da
// mesma forma que o fluxo web, só que SEM redirect_uri (esse tipo de código
// não usa redirect).
async function exchangeServerAuthCode(serverAuthCode: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: serverAuthCode,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = await res.json() as any;
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Google não retornou refresh_token (nativo). Resposta: " + JSON.stringify(data));
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in ?? 3600 };
}

// ─── Criar calendário dedicado ("Barber Pro") na conta do barbeiro ────────────

// Procura um calendário "Barber Pro" já existente na conta do usuário antes
// de criar um novo. Evita duplicar calendários toda vez que o barbeiro
// desconecta e reconecta (ex: pra gravar um vídeo de demonstração, testar
// de novo, trocar de conta, etc.) — sem isso, cada reconexão criava um
// calendário novo e os eventos antigos ficavam "presos" no calendário
// anterior, órfão.
async function findExistingDedicatedCalendar(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=owner", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    const items = Array.isArray(data.items) ? data.items : [];
    const existing = items.find((cal: any) => cal.summary === CALENDAR_NAME);
    return existing?.id ?? null;
  } catch (e: any) {
    // Se a busca falhar por qualquer motivo, seguimos o fluxo normal
    // (cria um novo) em vez de travar a conexão inteira por causa disso.
    console.error("[google-calendar] Erro ao procurar calendário existente:", e.message);
    return null;
  }
}

async function createDedicatedCalendar(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: CALENDAR_NAME, timeZone: TIMEZONE }),
  });
  const data = await res.json() as any;
  if (!data.id) throw new Error("Falha ao criar calendário dedicado: " + JSON.stringify(data));
  return data.id as string;
}

// Reaproveita o calendário "Barber Pro" existente (se houver) em vez de
// sempre criar um novo. Esta é a função usada pelo fluxo de conexão.
async function getOrCreateDedicatedCalendar(accessToken: string): Promise<string> {
  const existingId = await findExistingDedicatedCalendar(accessToken);
  if (existingId) return existingId;
  return createDedicatedCalendar(accessToken);
}

// ─── Conectar (chamado depois do callback OAuth) ───────────────────────────────

async function finishConnection(
  barberId: number,
  tenantId: number,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const calendarId = await getOrCreateDedicatedCalendar(accessToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await db.saveGoogleCalendarConnection({
      barberId,
      tenantId,
      refreshTokenEncrypted: encryptToken(refreshToken),
      googleCalendarId: calendarId,
      accessTokenCache: accessToken,
      accessTokenExpiresAt: expiresAt,
    });
    return { ok: true };
  } catch (e: any) {
    console.error("[google-calendar] Erro ao finalizar conexão:", e.message);
    return { ok: false, error: e.message };
  }
}

export async function connectBarberCalendar(params: {
  barberId: number;
  tenantId: number;
  code: string;
  redirectUri: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(params.code, params.redirectUri);
    return await finishConnection(params.barberId, params.tenantId, accessToken, refreshToken, expiresIn);
  } catch (e: any) {
    console.error("[google-calendar] Erro ao conectar (web):", e.message);
    return { ok: false, error: e.message };
  }
}

// Conexão via app mobile nativo (sem navegador) — recebe o serverAuthCode
// obtido pelo GoogleSignin.signIn() com offlineAccess:true no app.
export async function connectBarberCalendarNative(params: {
  barberId: number;
  tenantId: number;
  serverAuthCode: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { accessToken, refreshToken, expiresIn } = await exchangeServerAuthCode(params.serverAuthCode);
    return await finishConnection(params.barberId, params.tenantId, accessToken, refreshToken, expiresIn);
  } catch (e: any) {
    console.error("[google-calendar] Erro ao conectar (nativo):", e.message);
    return { ok: false, error: e.message };
  }
}

export async function disconnectBarberCalendar(barberId: number): Promise<void> {
  try {
    await db.deleteGoogleCalendarConnection(barberId);
  } catch (e: any) {
    console.error("[google-calendar] Erro ao desconectar:", e.message);
  }
}

export async function getConnectionStatus(barberId: number): Promise<{ connected: boolean; lastSyncAt: string | null; lastSyncError: string | null }> {
  try {
    const conn = await db.getGoogleCalendarConnection(barberId);
    return {
      connected: !!conn && conn.syncEnabled,
      lastSyncAt: conn?.lastSyncAt ? new Date(conn.lastSyncAt).toISOString() : null,
      lastSyncError: conn?.lastSyncError ?? null,
    };
  } catch (e: any) {
    console.error("[google-calendar] Erro ao ler status:", e.message);
    return { connected: false, lastSyncAt: null, lastSyncError: null };
  }
}

// ─── Obter um access_token válido (usa cache, renova se preciso) ─────────────

async function getValidAccessToken(barberId: number): Promise<{ accessToken: string; calendarId: string } | null> {
  const conn = await db.getGoogleCalendarConnection(barberId);
  if (!conn || !conn.syncEnabled || !conn.googleCalendarId) return null;

  const now = Date.now();
  const cachedExpiry = conn.accessTokenExpiresAt ? new Date(conn.accessTokenExpiresAt).getTime() : 0;
  // margem de 2 minutos antes de expirar de verdade
  if (conn.accessTokenCache && cachedExpiry - now > 2 * 60 * 1000) {
    return { accessToken: conn.accessTokenCache, calendarId: conn.googleCalendarId };
  }

  // Precisa renovar
  const refreshToken = decryptToken(conn.refreshTokenEncrypted);
  const { accessToken, expiresIn } = await refreshAccessToken(refreshToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  await db.updateGoogleCalendarConnectionCache(barberId, accessToken, expiresAt);
  return { accessToken, calendarId: conn.googleCalendarId };
}

// ─── Montar payload de evento a partir de um agendamento ──────────────────────

export interface AppointmentForSync {
  id: number;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM:SS" ou "HH:MM"
  endTime: string;
  clientName: string;
  serviceName: string;
  notes?: string | null;
}

function buildEventPayload(appt: AppointmentForSync) {
  const start = `${appt.date}T${appt.startTime.slice(0, 8)}-03:00`;
  const end = `${appt.date}T${appt.endTime.slice(0, 8)}-03:00`;
  return {
    summary: `${appt.clientName} — ${appt.serviceName}`,
    description: appt.notes ? `Agendado via Barber Pro.\n\n${appt.notes}` : "Agendado via Barber Pro.",
    start: { dateTime: start, timeZone: TIMEZONE },
    end: { dateTime: end, timeZone: TIMEZONE },
  };
}

// ─── Criar / editar / cancelar evento ──────────────────────────────────────────
// Todas as funções abaixo são "silenciosas": nunca lançam erro pro chamador.
// Em caso de falha, registram em lastSyncError e retornam sem interromper
// o fluxo principal do agendamento.

export async function syncAppointmentCreated(barberId: number, appt: AppointmentForSync): Promise<void> {
  if (!googleCalendarEnabled) return;
  try {
    const conn = await getValidAccessToken(barberId);
    if (!conn) return; // barbeiro não conectou o Google Agenda — nada a fazer

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventPayload(appt)),
    });
    const data = await res.json() as any;
    if (!data.id) throw new Error(JSON.stringify(data));

    await db.setAppointmentGoogleEventId(appt.id, data.id);
    await db.markGoogleCalendarSyncResult(barberId, null);
  } catch (e: any) {
    console.error(`[google-calendar] Erro ao criar evento (barbeiro ${barberId}, agendamento ${appt.id}):`, e.message);
    await db.markGoogleCalendarSyncResult(barberId, e.message).catch(() => {});
  }
}

export async function syncAppointmentUpdated(barberId: number, appt: AppointmentForSync, googleEventId: string): Promise<void> {
  if (!googleCalendarEnabled || !googleEventId) return;
  try {
    const conn = await getValidAccessToken(barberId);
    if (!conn) return;

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventPayload(appt)),
    });
    if (res.status === 404 || res.status === 410) {
      // O evento referenciado não existe mais no Google (calendário antigo
      // de uma reconexão anterior, evento apagado manualmente, etc.) —
      // em vez de falhar, cria um evento novo e atualiza a referência.
      const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildEventPayload(appt)),
      });
      const createData = await createRes.json() as any;
      if (!createData.id) throw new Error("Falha ao recriar evento: " + JSON.stringify(createData));
      await db.setAppointmentGoogleEventId(appt.id, createData.id);
    } else if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(data));
    }
    await db.markGoogleCalendarSyncResult(barberId, null);
  } catch (e: any) {
    console.error(`[google-calendar] Erro ao atualizar evento (barbeiro ${barberId}, agendamento ${appt.id}):`, e.message);
    await db.markGoogleCalendarSyncResult(barberId, e.message).catch(() => {});
  }
}

export async function syncAppointmentCancelled(barberId: number, googleEventId: string): Promise<void> {
  if (!googleCalendarEnabled || !googleEventId) return;
  try {
    const conn = await getValidAccessToken(barberId);
    if (!conn) return;

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    // 404/410 = evento já não existe no Google, tudo bem, considerar sucesso
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const data = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(data));
    }
    await db.markGoogleCalendarSyncResult(barberId, null);
  } catch (e: any) {
    console.error(`[google-calendar] Erro ao cancelar evento (barbeiro ${barberId}):`, e.message);
    await db.markGoogleCalendarSyncResult(barberId, e.message).catch(() => {});
  }
}

// Extrai data (YYYY-MM-DD) e hora (HH:MM:SS) de um Date, sempre no fuso de
// Brasília (America/Sao_Paulo) — independente do fuso em que o servidor
// (Railway, normalmente UTC) está rodando. Usa Intl.DateTimeFormat em vez de
// toISOString()/toTimeString(), que refletem UTC/fuso do servidor, não o
// horário real do Brasil.
function formatInBrazilTimezone(date: Date): { dateStr: string; timeStr: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const timeStr = `${get("hour")}:${get("minute")}:${get("second")}`;
  return { dateStr, timeStr };
}

// ─── Importar eventos existentes (calendário pessoal → bloqueios de horário) ──
// Ao contrário da sincronização normal (Barber Pro → Google), esta função lê
// os eventos que o barbeiro JÁ TINHA na agenda pessoal ("primary") ANTES de
// usar o Barber Pro, e cria um BLOQUEIO DE HORÁRIO para cada um — nunca um
// agendamento de cliente de verdade, já que não temos como saber quem é o
// cliente ou qual serviço a partir de um evento de texto livre do Google.
// Isso evita que alguém agende um horário no Barber Pro que colida com um
// compromisso que o barbeiro já tinha marcado por fora do sistema.
//
// É uma ação sob demanda (botão "Importar"), não algo que roda sozinho -
// evita duplicar toda vez que a tela é aberta. Cada evento importado guarda
// o próprio ID do Google (blockedSlots.googleEventId), então rodar de novo
// não cria duplicata do mesmo evento.
export interface ImportResult {
  imported: number;
  skipped: number;
  totalFound: number;
}

export async function importExistingEvents(barberId: number, daysAhead: number = 60): Promise<ImportResult> {
  const conn = await getValidAccessToken(barberId);
  if (!conn) return { imported: 0, skipped: 0, totalFound: 0 };

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true"); // expande eventos recorrentes em ocorrências individuais
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${conn.accessToken}` },
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error("Falha ao buscar eventos da agenda pessoal: " + JSON.stringify(data));
  }

  const events = Array.isArray(data.items) ? data.items : [];
  let imported = 0;
  let skipped = 0;

  for (const event of events) {
    // Ignora eventos cancelados, sem horário definido (evento de dia inteiro,
    // ex: "Aniversário", "Feriado") e sem id.
    if (!event.id || event.status === "cancelled") { skipped++; continue; }
    if (!event.start?.dateTime || !event.end?.dateTime) { skipped++; continue; }

    const already = await db.getBlockedSlotByGoogleEventId(barberId, event.id);
    if (already) { skipped++; continue; }

    const startDate = new Date(event.start.dateTime);
    const endDate = new Date(event.end.dateTime);
    // IMPORTANTE: usa o fuso de Brasília explicitamente (America/Sao_Paulo),
    // nunca o fuso do servidor (Railway roda em UTC) nem toISOString()/
    // toTimeString() puros - ambos dão a data/hora ERRADA quando o servidor
    // não está no mesmo fuso do Brasil (ex: 16h de Brasília vira "19:00"
    // se calculado em UTC, um bloqueio 3h fora do horário real).
    const { dateStr, timeStr: startTimeStr } = formatInBrazilTimezone(startDate);
    const { timeStr: endTimeStr } = formatInBrazilTimezone(endDate);

    try {
      await db.createBlockedSlot({
        barberId,
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        reason: `Importado da Google Agenda: ${event.summary ?? "Compromisso"}`,
        googleEventId: event.id,
      });
      imported++;
    } catch (e: any) {
      console.error(`[google-calendar] Erro ao importar evento ${event.id} (barbeiro ${barberId}):`, e.message);
      skipped++;
    }
  }

  return { imported, skipped, totalFound: events.length };
}
