import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { subscriptionPlanRouter } from "./subscription-plan-router";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router, barberProcedure } from "./_core/trpc";
import { signBarberToken, signBarberRefreshToken, verifyBarberRefreshToken } from "./barber-jwt.js";
import * as db from "./db";
import { assertFeature, assertBarberLimit } from "./plan-features";
import { storagePut } from "./storage";
import * as crypto from "crypto";
import * as QRCode from "qrcode";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const PDFDocument = _require("pdfkit") as typeof import("pdfkit");
import { sendPasswordResetEmail, sendSupportTicketNotificationEmail, sendSupportReplyNotificationEmail, sendWelcomeEmail } from "./email";
import { invokeLLM } from "./_core/llm";
import {
  asaasEnabled,
  asaasApi,
  getOrCreateAsaasCustomer,
  createAsaasCharge,
  asaasDefaultDueDate,
  createAsaasSubAccount,
  getAsaasSubAccount,
  ensureAsaasRootCustomer,
  getAsaasSubscriptionStatus,
  cancelAsaasSubscription,
  createAsaasSubscription,
} from "./asaas";
import * as bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

/**
 * Gera um payload Pix estático (EMV/BR Code) para pagamento.
 * Usado como fallback quando a API do Mercado Pago não está disponível em dev.
 */
function generatePixPayload(params: {
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId: string;
  description: string;
  pixKey?: string;
}): string {
  const { merchantName, merchantCity, amount, txId, description } = params;
  // Usa a chave Pix configurada nas settings ou placeholder para demo
  const pixKey = params.pixKey || "barber-pro@demo.pix";
  const gui = "BR.GOV.BCB.PIX";
  const pixKeyField = `0114${pixKey.length.toString().padStart(2,"0")}${pixKey}`;
  const additionalData = `0503${txId.substring(0,25).padEnd(25,"0")}`;
  const merchantAccountInfo = `0014${gui.length.toString().padStart(2,"0")}${gui}${pixKeyField}${additionalData}`;
  const amountStr = amount.toFixed(2);
  const fields = [
    `000201`,
    `010212`,
    `26${merchantAccountInfo.length.toString().padStart(2,"0")}${merchantAccountInfo}`,
    `52040000`,
    `5303986`,
    `54${amountStr.length.toString().padStart(2,"0")}${amountStr}`,
    `5802BR`,
    `59${merchantName.substring(0,25).length.toString().padStart(2,"0")}${merchantName.substring(0,25)}`,
    `60${merchantCity.substring(0,15).length.toString().padStart(2,"0")}${merchantCity.substring(0,15)}`,
    `6207`,
  ];
  const payload = fields.join("") + "6304";
  // CRC16-CCITT
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}


function randomSuffix() {
  return crypto.randomBytes(8).toString("hex");
}

async function hashPassword(password: string): Promise<string> {
  if (!bcrypt) throw new Error("bcryptjs not available");
  return bcrypt.hash(password, 10);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!bcrypt) return password === hash;
  return bcrypt.compare(password, hash);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    // Aliases para admin.login e admin.googleLogin (o app chama auth.login)
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const barber = await db.getBarberByEmail(input.email);
        if (!barber || !barber.isActive) throw new Error("Credenciais inválidas");
        if (!barber.passwordHash) throw new Error("Senha não configurada");
        const valid = await comparePassword(input.password, barber.passwordHash);
        if (!valid) throw new Error("Credenciais inválidas");
        const payload = { barberId: barber.id, tenantId: barber.tenantId ?? null, role: barber.role as any };
        const [token, refreshToken] = await Promise.all([signBarberToken(payload), signBarberRefreshToken(payload)]);
        const tenant = barber.tenantId ? await db.getTenantById(barber.tenantId) : null;
        return { id: barber.id, name: barber.name, email: barber.email, phone: barber.phone, photoUrl: barber.photoUrl, role: barber.role, specialties: barber.specialties, tenantId: barber.tenantId, tenantPlan: tenant?.plan ?? null, token, refreshToken };
      }),
    googleLogin: publicProcedure
      .input(z.object({
        idToken: z.string().optional(),
        googleId: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        photoUrl: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        let googleId = input.googleId;
        let email = input.email;
        let name = input.name;
        let photoUrl = input.photoUrl;

        // Se veio idToken, decodificar para extrair dados
        if (input.idToken && (!googleId || !email)) {
          try {
            const parts = input.idToken.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            googleId = googleId ?? payload.sub;
            email = email ?? payload.email;
            name = name ?? payload.name ?? payload.given_name;
            photoUrl = photoUrl ?? payload.picture;
          } catch (e) {
            throw new Error("Token Google inválido");
          }
        }

        if (!googleId || !email) throw new Error("Dados do Google incompletos");

        let barber = await db.getBarberByGoogleId(googleId);
        let barber2 = await db.getBarberByGoogleId(googleId);
        if (!barber2) {
          barber2 = await db.getBarberByEmail(email);
          if (barber2) {
            await db.updateBarber(barber2.id, { googleId } as any);
            barber2 = { ...barber2, googleId } as any;
          }
        }
        if (!barber2 || !barber2.isActive) throw new Error("Nenhuma conta de barbeiro encontrada para este e-mail Google. Solicite ao administrador que cadastre sua conta com o e-mail: " + email);
        if (photoUrl && !barber2.photoUrl) await db.updateBarber(barber2.id, { photoUrl } as any);
        const payload = { barberId: barber2.id, tenantId: barber2.tenantId ?? null, role: barber2.role as any };
        const [token, refreshToken] = await Promise.all([signBarberToken(payload), signBarberRefreshToken(payload)]);
        const tenant2 = barber2.tenantId ? await db.getTenantById(barber2.tenantId) : null;
        return { id: barber2.id, name: barber2.name, email: barber2.email, phone: barber2.phone, photoUrl: photoUrl ?? barber2.photoUrl, role: barber2.role, specialties: barber2.specialties, tenantId: barber2.tenantId, tenantPlan: tenant2?.plan ?? null, token, refreshToken };
      }),
  }),

  admin: router({
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const barber = await db.getBarberByEmail(input.email);
        if (!barber || !barber.isActive) throw new Error("Credenciais inválidas");
        if (!barber.passwordHash) throw new Error("Senha não configurada");
        const valid = await comparePassword(input.password, barber.passwordHash);
        if (!valid) throw new Error("Credenciais inválidas");
        const payload = { barberId: barber.id, tenantId: barber.tenantId ?? null, role: barber.role as any };
        const [token, refreshToken] = await Promise.all([signBarberToken(payload), signBarberRefreshToken(payload)]);
        const tenantAdmin = barber.tenantId ? await db.getTenantById(barber.tenantId) : null;
        return { id: barber.id, name: barber.name, email: barber.email, phone: barber.phone, photoUrl: barber.photoUrl, role: barber.role, specialties: barber.specialties, tenantId: barber.tenantId, tenantPlan: tenantAdmin?.plan ?? null, token, refreshToken };
      }),
    setup: publicProcedure
      .input(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const existing = await db.getBarberByEmail(input.email);
        if (existing) throw new Error("Email já cadastrado");
        const passwordHash = await hashPassword(input.password);
        const id = await db.createBarber({ name: input.name, email: input.email, passwordHash, role: "super_admin", isActive: true });
        return { id, name: input.name, email: input.email, role: "super_admin" as const };
      }),
    checkSetup: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      const allBarbers = await db.getAllBarbers(input?.tenantId);
      return { hasAdmin: allBarbers.some((b: any) => b.role === "super_admin") };
    }),
    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const barber = await db.getBarberByEmail(input.email);
        // Por segurança, não revelamos se o e-mail existe ou não
        if (!barber || !barber.isActive) return { success: true };
        const token = await db.createPasswordResetToken(input.email);
        const baseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
        await sendPasswordResetEmail({ toEmail: input.email, token, baseUrl });
        return { success: true };
      }),
    verifyResetToken: publicProcedure
      .input(z.object({ email: z.string().email(), token: z.string().length(6) }))
      .mutation(async ({ input }) => {
        const valid = await db.validatePasswordResetToken(input.email, input.token);
        if (!valid) throw new Error("Código inválido ou expirado. Solicite um novo código.");
        return { success: true };
      }),
    resetPassword: publicProcedure
      .input(z.object({ email: z.string().email(), token: z.string().length(6), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const consumed = await db.consumePasswordResetToken(input.email, input.token);
        if (!consumed) throw new Error("Código inválido ou expirado. Solicite um novo código.");
        const barber = await db.getBarberByEmail(input.email);
        if (!barber) throw new Error("Conta não encontrada.");
        const passwordHash = await hashPassword(input.newPassword);
        await db.updateBarber(barber.id, { passwordHash } as any);
        return { success: true, message: "Senha redefinida com sucesso!" };
      }),

    // Renova o access token usando um refresh token válido
    refreshToken: publicProcedure
      .input(z.object({ refreshToken: z.string() }))
      .mutation(async ({ input }) => {
        const decoded = await verifyBarberRefreshToken(input.refreshToken);
        if (!decoded) throw new TRPCError({ code: "UNAUTHORIZED", message: "Refresh token inválido ou expirado. Faça login novamente." });
        // Verificar se o barbeiro ainda está ativo
        const barber = await db.getBarberById(decoded.barberId);
        if (!barber || !(barber as any).isActive) throw new TRPCError({ code: "UNAUTHORIZED", message: "Conta inativa. Faça login novamente." });
        const payload = { barberId: decoded.barberId, tenantId: decoded.tenantId, role: decoded.role };
        const [newToken, newRefreshToken] = await Promise.all([signBarberToken(payload), signBarberRefreshToken(payload)]);
        return { token: newToken, refreshToken: newRefreshToken };
      }),

    // Login com Google — autentica barbeiro via Google ID
    googleLogin: publicProcedure
      .input(z.object({
        googleId: z.string(),
        email: z.string().email(),
        name: z.string(),
        photoUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Buscar barbeiro pelo googleId
        let barber = await db.getBarberByGoogleId(input.googleId);

        // Se não encontrou pelo googleId, tentar pelo email
        if (!barber) {
          barber = await db.getBarberByEmail(input.email);
          if (barber) {
            // Vincular googleId à conta existente
            await db.updateBarber(barber.id, { googleId: input.googleId } as any);
            barber = { ...barber, googleId: input.googleId } as any;
          }
        }

        if (!barber || !barber.isActive) {
          throw new Error(
            "Nenhuma conta de barbeiro encontrada para este e-mail Google. " +
            "Solicite ao administrador que cadastre sua conta com o e-mail: " + input.email
          );
        }

        // Atualizar foto se ainda não tiver
        if (input.photoUrl && !barber.photoUrl) {
          await db.updateBarber(barber.id, { photoUrl: input.photoUrl } as any);
        }

        const payload = { barberId: barber.id, tenantId: barber.tenantId ?? null, role: barber.role as any };
        const [token, refreshToken] = await Promise.all([signBarberToken(payload), signBarberRefreshToken(payload)]);
        return {
          id: barber.id,
          name: barber.name,
          email: barber.email,
          phone: barber.phone,
          photoUrl: input.photoUrl ?? barber.photoUrl,
          role: barber.role,
          specialties: barber.specialties,
          tenantId: barber.tenantId,
          token,
          refreshToken,
        };
      }),
  }),

  barbers: router({
    list: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(({ input }) => db.getAllBarbers(input?.tenantId)),
    listAll: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(({ input }) => db.getAllBarbersIncludingInactive(input?.tenantId)),
    reactivate: barberProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.reactivateBarber(input.id)),
    create: barberProcedure
      .input(z.object({ name: z.string().min(2), email: z.string().email().optional(), phone: z.string().optional(), password: z.string().min(6), role: z.enum(["super_admin", "barber", "receptionist"]).default("barber"), specialties: z.string().optional(), tenantId: z.number().optional().nullable() }))
      .mutation(async ({ input }) => {
        // Validação de limite de barbeiros por plano
        if (input.tenantId != null) {
          const tenant = await db.getTenantById(input.tenantId);
          if (tenant) {
            const existing = await db.getAllBarbersIncludingInactive(input.tenantId);
            const activeBarbers = existing.filter((b) => b.isActive);
            try {
              assertBarberLimit(tenant.plan, activeBarbers.length);
            } catch (e: any) {
              throw new TRPCError({ code: "FORBIDDEN", message: "Limite de barbeiros atingido para o seu plano. Faça upgrade para adicionar mais profissionais." });
            }
          }
        }
        const passwordHash = await hashPassword(input.password);
        return db.createBarber({ ...input, passwordHash, isActive: true });
      }),
    update: barberProcedure
      .input(z.object({ id: z.number(), name: z.string().min(2).optional(), email: z.string().email().optional().nullable(), phone: z.string().optional().nullable(), photoUrl: z.string().optional().nullable(), role: z.enum(["super_admin", "barber", "receptionist"]).optional(), specialties: z.string().optional().nullable(), isActive: z.boolean().optional(), password: z.string().min(6).optional() }))
      .mutation(async ({ input }) => {
        const { id, password, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (password) updateData.passwordHash = await hashPassword(password);
        await db.updateBarber(id, updateData as any);
        return { success: true };
      }),
    delete: barberProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteBarber(input.id)),
    savePushToken: publicProcedure
      .input(z.object({ barberId: z.number(), pushToken: z.string() }))
      .mutation(({ input }) => db.saveBarberPushToken(input.barberId, input.pushToken)),
    workingHours: router({
      get: publicProcedure.input(z.object({ barberId: z.number() })).query(({ input }) => db.getWorkingHours(input.barberId)),
      upsert: barberProcedure
        .input(z.object({ barberId: z.number(), dayOfWeek: z.number().min(0).max(6), startTime: z.string(), endTime: z.string(), lunchStart: z.string().optional().nullable(), lunchEnd: z.string().optional().nullable(), isWorking: z.boolean() }))
        .mutation(({ input }) => { const { barberId, dayOfWeek, ...data } = input; return db.upsertWorkingHours(barberId, dayOfWeek, data); }),
    }),
  }),

  clients: router({
    list: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(({ input }) => db.getAllClients(input?.tenantId)),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getClientById(input.id)),
    create: publicProcedure
      .input(z.object({ name: z.string().min(2), phone: z.string().min(8), email: z.string().email().optional().nullable(), birthDate: z.string().optional().nullable(), notes: z.string().optional().nullable(), tenantId: z.number().optional().nullable() }))
      .mutation(({ input }) => db.createClient({ ...input, isActive: true })),
    update: publicProcedure
      .input(z.object({ id: z.number(), name: z.string().min(2).optional(), phone: z.string().min(8).optional(), email: z.string().email().optional().nullable(), birthDate: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateClient(id, data); }),
    appointments: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) => db.getClientAppointments(input.clientId)),
    sales: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) => db.getClientSales(input.clientId)),
    birthdayToday: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      const allClients = await db.getAllClients(input?.tenantId);
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();
      return allClients.filter((c: any) => {
        if (!c.birthDate) return false;
        const parts = c.birthDate.split("-");
        return parseInt(parts[1], 10) === todayMonth && parseInt(parts[2], 10) === todayDay;
      });
    }),
    birthdayThisMonth: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      const allClients = await db.getAllClients(input?.tenantId);
      const currentMonth = new Date().getMonth() + 1;
      return allClients.filter((c: any) => {
        if (!c.birthDate) return false;
        return parseInt(c.birthDate.split("-")[1], 10) === currentMonth;
      }).sort((a: any, b: any) => {
        const dayA = parseInt(a.birthDate.split("-")[2], 10);
        const dayB = parseInt(b.birthDate.split("-")[2], 10);
        return dayA - dayB;
      });
    }),
  }),

  categories: router({
    list: publicProcedure.input(z.object({ type: z.enum(["service", "product"]) })).query(({ input }) => db.getCategoriesByType(input.type)),
    create: barberProcedure.input(z.object({ name: z.string().min(1), type: z.enum(["service", "product"]) })).mutation(({ input }) => db.createCategory(input.name, input.type)),
  }),

  services: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllServices(input.activeOnly, input.tenantId)),
    listWithMedia: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllServicesWithMedia(input.activeOnly, input.tenantId)),
    listWithMediaAndRatings: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllServicesWithMediaAndRatings(input.activeOnly, input.tenantId)),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getServiceById(input.id)),
    create: barberProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional().nullable(), price: z.string(), durationMinutes: z.number().min(5), categoryId: z.number().optional().nullable(), isActive: z.boolean().default(true), tenantId: z.number().optional().nullable() }))
      .mutation(({ input }) => db.createService(input as any)),
    update: barberProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), description: z.string().optional().nullable(), price: z.string().optional(), durationMinutes: z.number().min(5).optional(), categoryId: z.number().optional().nullable(), isActive: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateService(id, data as any); }),
    delete: barberProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteService(input.id)),
    media: router({
      list: publicProcedure.input(z.object({ serviceId: z.number() })).query(({ input }) => db.getMediaByEntity("service", input.serviceId)),
      delete: barberProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteMediaFile(input.id)),
    }),
  }),

  products: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllProducts(input.activeOnly, input.tenantId)),
    listWithMedia: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllProductsWithMedia(input.activeOnly, input.tenantId)),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getProductById(input.id)),
    create: barberProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional().nullable(), price: z.string(), costPrice: z.string().optional().nullable(), stock: z.number().min(0).default(0), categoryId: z.number().optional().nullable(), isActive: z.boolean().default(true), tenantId: z.number().optional().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const productId = await db.createProduct(input as any);
        // Registrar despesa do estoque inicial automaticamente
        if (input.stock > 0 && input.costPrice && parseFloat(input.costPrice) > 0) {
          const totalCost = parseFloat(input.costPrice) * input.stock;
          const today = new Date().toISOString().slice(0, 10);
          await db.createExpense({
            category: "Estoque",
            description: `Estoque inicial: ${input.name} (${input.stock}x R$${parseFloat(input.costPrice).toFixed(2)})`,
            amount: totalCost.toFixed(2),
            date: today,
            barberId: ctx?.barberId ?? null,
            tenantId: input.tenantId ?? null,
          } as any);
        }
        return productId;
      }),
    update: barberProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), description: z.string().optional().nullable(), price: z.string().optional(), costPrice: z.string().optional().nullable(), stock: z.number().min(0).optional(), categoryId: z.number().optional().nullable(), isActive: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateProduct(id, data as any); }),
    media: router({
      list: publicProcedure.input(z.object({ productId: z.number() })).query(({ input }) => db.getMediaByEntity("product", input.productId)),
      delete: barberProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteMediaFile(input.id)),
    }),
  }),

  upload: router({
    media: publicProcedure
      .input(z.object({ entityType: z.enum(["service", "product"]), entityId: z.number(), fileBase64: z.string(), mimeType: z.string(), mediaType: z.enum(["image", "video"]), order: z.number().optional() }))
      .mutation(async ({ input }) => {
        const ext = input.mimeType.split("/")[1] || "jpg";
        const key = `barber-pro/${input.entityType}s/${input.entityId}-${randomSuffix()}.${ext}`;
        const buffer = Buffer.from(input.fileBase64, "base64");
        const { url } = await storagePut(key, buffer, input.mimeType);
        const id = await db.addMediaFile({ entityType: input.entityType, entityId: input.entityId, url, type: input.mediaType, order: input.order ?? 0 });
        return { id, url };
      }),
    shopImage: publicProcedure
      .input(z.object({ fileBase64: z.string(), mimeType: z.string(), imageType: z.enum(["logo", "gallery"]) }))
      .mutation(async ({ input }) => {
        const ext = input.mimeType.split("/")[1] || "jpg";
        const key = `barber-pro/shop/${input.imageType}-${randomSuffix()}.${ext}`;
        const buffer = Buffer.from(input.fileBase64, "base64");
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url };
      }),
    profilePhoto: publicProcedure
      .input(z.object({ fileBase64: z.string(), mimeType: z.string() }))
      .mutation(async ({ input }) => {
        const ext = input.mimeType.split("/")[1] || "jpg";
        const key = `barber-pro/profiles/avatar-${randomSuffix()}.${ext}`;
        const buffer = Buffer.from(input.fileBase64, "base64");
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url };
      }),
  }),

  appointments: router({
    byDate: publicProcedure.input(z.object({ barberId: z.number(), date: z.string() })).query(({ input }) => db.getAppointmentsByDate(input.barberId, input.date)),
    byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getAppointmentById(input.id)),
    allByDate: publicProcedure.input(z.object({ date: z.string(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllAppointmentsByDate(input.date, input.tenantId)),
    allByDateRange: publicProcedure.input(z.object({ startDate: z.string(), endDate: z.string(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllAppointmentsByDateRangeFullForTenant(input.startDate, input.endDate, input.tenantId)),
    nextByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) => db.getNextClientAppointment(input.clientId)),
    byDateRange: publicProcedure.input(z.object({ barberId: z.number(), startDate: z.string(), endDate: z.string() })).query(({ input }) => db.getAppointmentsByDateRange(input.barberId, input.startDate, input.endDate)),
    datesWithAppointments: publicProcedure.input(z.object({ barberId: z.number().optional(), startDate: z.string(), endDate: z.string(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllAppointmentsByDateRangeForTenant(input.startDate, input.endDate, input.tenantId)),
    checkAvailability: publicProcedure
      .input(z.object({ barberId: z.number(), date: z.string(), startTime: z.string(), endTime: z.string(), excludeId: z.number().optional() }))
      .query(({ input }) => db.checkSlotAvailability(input.barberId, input.date, input.startTime, input.endTime, input.excludeId)),
    create: publicProcedure
      .input(z.object({ clientId: z.number(), barberId: z.number(), serviceId: z.number(), serviceNames: z.string().optional().nullable(), date: z.string(), startTime: z.string(), endTime: z.string(), notes: z.string().optional().nullable(), status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show", "pending_approval"]).default("confirmed") }))
      .mutation(async ({ input }) => {
        const available = await db.checkSlotAvailability(input.barberId, input.date, input.startTime, input.endTime);
        if (!available) throw new Error("Horário não disponível. Por favor, escolha outro horário.");

        // ── Regra de horário limite ──────────────────────────────────────────────
        // Verifica se o endTime ultrapassa o horário de fechamento do barbeiro naquele dia
        const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const dayOfWeek = new Date(input.date + "T12:00:00").getDay();
        const wh = await db.getWorkingHoursForDay(input.barberId, dayOfWeek);
        let exceedsClosingTime = false;
        let overtimeMinutes = 0;
        let closingTime = "";
        if (wh) {
          const closeMin = toMin(wh.endTime);
          const endMin = toMin(input.endTime);
          if (endMin > closeMin) {
            exceedsClosingTime = true;
            overtimeMinutes = endMin - closeMin;
            closingTime = wh.endTime;
          }
        }

        // Se ultrapassa o horário de fechamento, cria como pending_approval
        const finalStatus = exceedsClosingTime ? "pending_approval" : "confirmed";
        const apptId = await db.createAppointment({ ...input, status: finalStatus } as any);

        // Notifica o barbeiro via Expo Push
        const pushToken = await db.getBarberPushToken(input.barberId);
        if (pushToken) {
          const client = await db.getClientById(input.clientId);
          const service = await db.getServiceById(input.serviceId);
          const clientName = client?.name ?? "Cliente";
          const serviceName = input.serviceNames ?? service?.name ?? "Serviço";
          if (exceedsClosingTime) {
            // Notificação especial: precisa de aprovação
            const endHHMM = input.endTime.substring(0, 5);
            const closeHHMM = closingTime.substring(0, 5);
            const extraH = Math.floor(overtimeMinutes / 60);
            const extraM = overtimeMinutes % 60;
            const extraStr = extraH > 0 ? `${extraH}h${extraM > 0 ? extraM + "min" : ""}` : `${extraM}min`;
            await db.sendExpoPushNotification(
              pushToken,
              "⚠️ Agendamento aguarda sua aprovação",
              `${clientName} quer agendar ${serviceName} às ${input.startTime.substring(0, 5)} (término às ${endHHMM}, ${extraStr} após o fechamento às ${closeHHMM}). Abra a agenda para aprovar.`,
              { appointmentId: apptId, screen: "agenda", type: "pending_approval" }
            );
            // Notificar super_admins do tenant (exceto o próprio barbeiro)
            try {
              const barberForTenant = await db.getBarberById(input.barberId);
              const allBarbers = await db.getAllBarbers(barberForTenant?.tenantId ?? null);
              const admins = (allBarbers as any[]).filter((b: any) => b.role === "super_admin" && b.id !== input.barberId);
              for (const admin of admins.slice(0, 3)) {
                const adminToken = await db.getBarberPushToken(admin.id);
                if (adminToken) {
                  await db.sendExpoPushNotification(
                    adminToken,
                    "⚠️ Agendamento aguarda aprovação",
                    `${clientName} quer agendar ${serviceName} às ${input.startTime.substring(0, 5)} (${extraStr} após fechamento). Abra a agenda para aprovar.`,
                    { appointmentId: apptId, screen: "agenda", type: "pending_approval" }
                  );
                }
              }
            } catch {}
          } else {
            await db.sendExpoPushNotification(
              pushToken,
              "📅 Novo agendamento",
              `${clientName} agendou ${serviceName} para ${input.date} às ${input.startTime}`,
              { appointmentId: apptId, screen: "agenda" }
            );
          }
        }
        return { apptId, requiresApproval: exceedsClosingTime, overtimeMinutes, closingTime };
      }),
    update: barberProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show", "pending_approval"]).optional(),
        notes: z.string().optional().nullable(),
        reminderSent: z.boolean().optional(),
        whatsappConfirmationSent: z.boolean().optional(),
        serviceId: z.number().optional(),
        serviceNames: z.string().optional().nullable(),
        endTime: z.string().optional(),
      }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateAppointment(id, data as any); }),
    approveOvertime: barberProcedure
      .input(z.object({ id: z.number(), approve: z.boolean(), clientPushToken: z.string().optional() }))
      .mutation(async ({ input }) => {
        if (input.approve) {
          await db.updateAppointment(input.id, { status: "confirmed" } as any);
          // Notifica o cliente que foi aprovado
          if (input.clientPushToken) {
            await db.sendExpoPushNotification(
              input.clientPushToken,
              "✅ Agendamento confirmado!",
              "Seu agendamento foi aprovado pelo barbeiro. Até lá!",
              { screen: "history" }
            );
          }
        } else {
          await db.updateAppointment(input.id, { status: "cancelled", cancelReason: "Horário fora do expediente" } as any);
          // Notifica o cliente que foi recusado
          if (input.clientPushToken) {
            await db.sendExpoPushNotification(
              input.clientPushToken,
              "❌ Agendamento não aprovado",
              "O barbeiro não pôde confirmar o horário solicitado. Por favor, escolha outro horário.",
              { screen: "book" }
            );
          }
        }
        return { success: true };
      }),
    cancelWithReason: barberProcedure
      .input(z.object({ id: z.number(), reason: z.string().optional(), clientPushToken: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.updateAppointment(input.id, { status: "cancelled", cancelReason: input.reason ?? null } as any);
        // Notifica o cliente se tiver token
        if (input.clientPushToken) {
          const reasonText = input.reason ? ` Motivo: ${input.reason}.` : "";
          await db.sendExpoPushNotification(
            input.clientPushToken,
            "❌ Agendamento cancelado",
            `Seu agendamento foi cancelado pela barbearia.${reasonText} Que tal reagendar?`,
            { screen: "book" }
          );
        }
        return { success: true };
      }),
    getPaymentStatus: publicProcedure
      .input(z.object({ appointmentId: z.number(), tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        // Busca a venda vinculada ao agendamento
        const today = new Date();
        const startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 5);
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);
        const allSales = await db.getSalesByDateRange(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0],
          undefined,
          input.tenantId
        );
        const sale = (allSales as any[]).find((s) => s.appointmentId === input.appointmentId) ?? null;
        if (!sale) return { paid: false, sale: null };
        return {
          paid: sale.paymentStatus === "paid",
          sale: {
            id: sale.id,
            paymentStatus: sale.paymentStatus,
            paymentMethod: sale.paymentMethod,
            total: sale.total,
            createdAt: sale.createdAt,
          },
        };
      }),
    registerPayment: barberProcedure
      .input(z.object({
        appointmentId: z.number(),
        barberId: z.number(),
        clientId: z.number().optional().nullable(),
        serviceId: z.number(),
        serviceName: z.string(),
        servicePrice: z.number(),
        paymentMethod: z.enum(["cash", "credit_card", "debit_card", "pix", "asaas", "other"]),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const numPrice = isNaN(input.servicePrice) ? 0 : input.servicePrice;
        const total = numPrice.toFixed(2);
        const saleId = await db.createSale(
          {
            clientId: input.clientId ?? null,
            barberId: input.barberId,
            appointmentId: input.appointmentId,
            subtotal: total,
            discount: "0",
            total,
            paymentMethod: input.paymentMethod,
            paymentStatus: "paid",
            notes: input.notes ?? null,
          } as any,
          [
            {
              itemType: "service",
              itemId: input.serviceId,
              itemName: input.serviceName,
              quantity: 1,
              unitPrice: total,
              total,
            },
          ]
        );
        // Atualizar status do agendamento para "completed" após registrar pagamento
        try {
          await db.updateAppointmentStatus(input.appointmentId, "completed");
        } catch { /* não bloquear se falhar */ }
        return { saleId };
      }),
    blockedSlots: router({
      get: publicProcedure.input(z.object({ barberId: z.number(), date: z.string() })).query(({ input }) => db.getBlockedSlots(input.barberId, input.date)),
      create: barberProcedure.input(z.object({ barberId: z.number(), date: z.string(), startTime: z.string(), endTime: z.string(), reason: z.string().optional() })).mutation(({ input }) => db.createBlockedSlot(input)),
      delete: barberProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteBlockedSlot(input.id)),
    }),
  }),

  sales: router({
    byDateRange: publicProcedure.input(z.object({ startDate: z.string(), endDate: z.string(), barberId: z.number().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getSalesByDateRange(input.startDate, input.endDate, input.barberId, input.tenantId)),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getSaleById(input.id)),
    create: barberProcedure
      .input(z.object({ clientId: z.number().optional().nullable(), barberId: z.number(), appointmentId: z.number().optional().nullable(), subtotal: z.string(), discount: z.string().default("0"), total: z.string(), paymentMethod: z.enum(["cash", "credit_card", "debit_card", "pix", "asaas", "other"]), paymentStatus: z.enum(["pending", "paid", "cancelled", "refunded"]).default("paid"), couponCode: z.string().optional().nullable(), notes: z.string().optional().nullable(), items: z.array(z.object({ itemType: z.enum(["service", "product"]), itemId: z.number(), itemName: z.string(), quantity: z.number().min(1), unitPrice: z.string(), total: z.string() })) }))
      .mutation(async ({ input }) => {
        const { items, ...saleData } = input;
        const saleId = await db.createSale(saleData as any, items);
        // Record stock movement (out) for each product item sold
        const today = new Date().toISOString().slice(0, 10);
        for (const item of items) {
          if (item.itemType === "product" && item.itemId) {
            try {
              await db.addStockMovement({
                productId: item.itemId,
                type: "out",
                quantity: item.quantity,
                reason: `Venda #${saleId} — ${item.itemName}`,
                barberId: input.barberId ?? undefined,
                date: today,
              } as any);
            } catch { /* não bloquear a venda se o movimento falhar */ }
          }
        }
        return saleId;
      }),
  }),

  expenses: router({
    byDateRange: publicProcedure.input(z.object({ startDate: z.string(), endDate: z.string(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getExpensesByDateRange(input.startDate, input.endDate, input.tenantId)),
    create: barberProcedure
      .input(z.object({ category: z.string().min(1), description: z.string().min(1), amount: z.string(), date: z.string(), paymentMethod: z.string().optional().nullable(), barberId: z.number().optional().nullable() }))
      .mutation(({ input }) => db.createExpense(input as any)),
    update: barberProcedure
      .input(z.object({ id: z.number(), category: z.string().optional(), description: z.string().optional(), amount: z.string().optional(), date: z.string().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateExpense(id, data as any); }),
    delete: barberProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteExpense(input.id)),
  }),

  coupons: router({
    list: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(({ input }) => db.getAllCoupons(input?.tenantId)),
    validate: publicProcedure
      .input(z.object({ code: z.string(), orderValue: z.number() }))
      .query(async ({ input }) => {
        const coupon = await db.getCouponByCode(input.code);
        if (!coupon || !coupon.isActive) return { valid: false, message: "Cupom inválido ou inativo" };
        if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { valid: false, message: "Cupom esgotado" };
        const today = new Date().toISOString().split("T")[0];
        if (coupon.validFrom && today < coupon.validFrom) return { valid: false, message: "Cupom ainda não está válido" };
        if (coupon.validUntil && today > coupon.validUntil) return { valid: false, message: "Cupom expirado" };
        if (coupon.minOrderValue && input.orderValue < parseFloat(coupon.minOrderValue)) return { valid: false, message: `Valor mínimo: R$ ${coupon.minOrderValue}` };
        const discount = coupon.discountType === "percent" ? (input.orderValue * parseFloat(coupon.discountValue)) / 100 : parseFloat(coupon.discountValue);
        return { valid: true, coupon, discountAmount: discount };
      }),
    create: barberProcedure
      .input(z.object({ code: z.string().min(3), description: z.string().optional(), discountType: z.enum(["percent", "fixed"]), discountValue: z.string(), minOrderValue: z.string().optional(), maxUses: z.number().optional(), validFrom: z.string().optional(), validUntil: z.string().optional(), tenantId: z.number().optional().nullable() }))
      .mutation(async ({ input }) => {
        if (input.tenantId != null) {
          const tenant = await db.getTenantById(input.tenantId);
          assertFeature(tenant?.plan, "coupons");
        }
        return db.createCoupon(input);
      }),
    update: barberProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean().optional(), description: z.string().optional(), maxUses: z.number().optional().nullable(), validUntil: z.string().optional().nullable() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateCoupon(id, data as any); }),
    toggle: barberProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const coupons = await db.getAllCoupons();
        const coupon = (coupons as any[]).find((c: any) => c.id === input.id);
        if (!coupon) throw new Error("Cupom não encontrado");
        return db.updateCoupon(input.id, { isActive: !coupon.isActive } as any);
      }),
    inactive: publicProcedure
      .input(z.object({ tenantId: z.number(), days: z.number().default(30) }))
      .query(async ({ input }) => {
        const db2 = await db.getDb();
        if (!db2) return [];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - input.days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        // Get all clients with their last appointment date
        const result = await db2.execute(sql`
          SELECT c.id, c.name, c.phone,
            MAX(a.date) as "lastVisit",
            CASE WHEN MAX(a.date) IS NULL THEN NULL
              ELSE (CURRENT_DATE - MAX(a.date)::date)
            END as "daysSince"
          FROM clients c
          LEFT JOIN appointments a ON a."clientId" = c.id
            AND a.status NOT IN ('cancelled', 'no_show')
          WHERE c."tenantId" = ${input.tenantId}
          GROUP BY c.id, c.name, c.phone
          HAVING MAX(a.date) IS NULL OR MAX(a.date)::date < ${cutoffStr}::date
          ORDER BY "lastVisit" ASC NULLS FIRST
          LIMIT 100
        `) as any;
        const rows = Array.isArray(result) ? result[0] ?? result : result?.rows ?? [];
        return rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          lastVisit: r.lastVisit ?? null,
          daysSince: r.daysSince != null ? Number(r.daysSince) : null,
        }));
      }),
    getAvailableForClient: publicProcedure
      .input(z.object({ clientId: z.number().optional().nullable(), orderValue: z.number(), tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        const today = new Date().toISOString().split("T")[0];
        const allCoupons = await db.getAllCoupons(input.tenantId);
        const validCoupons = allCoupons.filter((c: any) => {
          if (!c.isActive) return false;
          if (c.maxUses !== null && c.usedCount >= c.maxUses) return false;
          if (c.validFrom && today < c.validFrom) return false;
          if (c.validUntil && today > c.validUntil) return false;
          if (c.minOrderValue && input.orderValue < parseFloat(c.minOrderValue)) return false;
          return true;
        });
        let redeemableRewards: any[] = [];
        if (input.clientId) {
          const client = await db.getClientById(input.clientId);
          const rewards = await db.getLoyaltyRewards(input.tenantId);
          const config = await db.getLoyaltyConfig(input.tenantId);
          if (config?.isActive && client) {
            redeemableRewards = (rewards as any[]).filter((r: any) => r.isActive && (client.totalPoints ?? 0) >= r.pointsRequired);
          }
        }
        return { coupons: validCoupons, redeemableRewards };
      }),
  }),
  loyalty: router({
    getConfig: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(({ input }) => db.getLoyaltyConfig(input?.tenantId)),
    updateConfig: barberProcedure
      .input(z.object({ isActive: z.boolean(), pointsPerService: z.number().min(0), pointsPerReal: z.string(), pointsExpireMonths: z.number().min(0), tenantId: z.number().optional().nullable() }))
      .mutation(({ input }) => db.upsertLoyaltyConfig(input)),
    rewards: router({
      list: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(({ input }) => db.getLoyaltyRewards(input?.tenantId)),
      create: barberProcedure
        .input(z.object({ name: z.string().min(1), description: z.string().optional(), pointsRequired: z.number().min(1), rewardType: z.enum(["free_service", "discount_percent", "discount_fixed", "free_product"]), rewardValue: z.string().optional(), tenantId: z.number().optional().nullable() }))
        .mutation(({ input }) => db.createLoyaltyReward(input)),
      update: barberProcedure
        .input(z.object({ id: z.number(), name: z.string().optional(), pointsRequired: z.number().optional(), isActive: z.boolean().optional() }))
        .mutation(({ input }) => { const { id, ...data } = input; return db.updateLoyaltyReward(id, data as any); }),
    }),
    addPoints: publicProcedure
      .input(z.object({ clientId: z.number(), points: z.number(), type: z.enum(["earned", "redeemed", "expired", "adjusted"]), description: z.string().optional(), saleId: z.number().optional() }))
      .mutation(({ input }) => db.addClientPoints(input.clientId, input.points, input.type, input.description, input.saleId)),
  }),

  settings: router({
    get: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(({ input }) => db.getShopSettings(input?.tenantId)),
    generateQr: publicProcedure
      .input(z.object({ url: z.string() }))
      .query(async ({ input }) => {
        try {
          const qrDataUrl = await QRCode.toDataURL(input.url, { width: 300, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
          return { qrDataUrl };
        } catch {
          return { qrDataUrl: "" };
        }
      }),
    getByTenant: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return db.getShopSettings(input.tenantId);
      }),
    openStatus: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(({ input }) => db.getShopOpenStatus(input?.tenantId)),
    update: barberProcedure
      .input(z.object({ shopName: z.string().optional(), address: z.string().optional().nullable(), phone: z.string().optional().nullable(), whatsapp: z.string().optional().nullable(), whatsappMessageTemplate: z.string().optional().nullable(), reminderMessageTemplate: z.string().optional().nullable(), instagram: z.string().optional().nullable(), cnpj: z.string().optional().nullable(), googleMapsUrl: z.string().optional().nullable(), pixKey: z.string().optional().nullable(), galleryUrls: z.string().optional().nullable(), cep: z.string().optional().nullable(), addressNumber: z.string().optional().nullable(), addressComplement: z.string().optional().nullable(), logoUrl: z.string().optional().nullable(), primaryColor: z.string().optional().nullable(), bannerUrl: z.string().optional().nullable(), customDomain: z.string().optional().nullable(), ga4MeasurementId: z.string().optional().nullable(), facebookPixelId: z.string().optional().nullable(), seoTitle: z.string().optional().nullable(), seoDescription: z.string().optional().nullable(), seoImageUrl: z.string().optional().nullable(), fontStyle: z.string().optional().nullable(), tenantId: z.number().optional().nullable() }))
      .mutation(({ input }) => { const { tenantId, ...data } = input; return db.upsertShopSettings(data, tenantId); }),
  }),

  dashboard: router({
    stats: publicProcedure.input(z.object({ date: z.string(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getDashboardStats(input.date, input.tenantId)),
  }),

  // ─── Área do Cliente ────────────────────────────────────────────────────────
  clientAuth: router({
    register: publicProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().min(8),
        password: z.string().min(6),
        birthDate: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getClientAccountByEmail(input.email);
        if (existing) throw new Error("Email já cadastrado");
        const passwordHash = await hashPassword(input.password);
        const clientId = await db.createClient({ name: input.name, email: input.email, phone: input.phone, birthDate: input.birthDate, isActive: true });
        await db.createClientAccount({ clientId, email: input.email, passwordHash });
        const client = await db.getClientById(clientId);
        return { id: clientId, tenantId: client?.tenantId ?? null, preferredTenantId: client?.preferredTenantId ?? null, name: input.name, email: input.email, phone: input.phone, totalPoints: 0, client };
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const account = await db.getClientAccountByEmail(input.email);
        if (!account || !account.isActive) throw new Error("Credenciais inválidas");
        const valid = await comparePassword(input.password, account.passwordHash);
        if (!valid) throw new Error("Credenciais inválidas");
        const client = await db.getClientById(account.clientId);
        if (!client) throw new Error("Cliente não encontrado");
        return { id: client.id, tenantId: client.tenantId, preferredTenantId: client.preferredTenantId ?? null, name: client.name, email: client.email, phone: client.phone, totalPoints: client.totalPoints, birthDate: client.birthDate, photoUrl: client.photoUrl };
      }),
    updateProfile: publicProcedure
      .input(z.object({ clientId: z.number(), name: z.string().min(2).optional(), phone: z.string().optional(), birthDate: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
      .mutation(async ({ input }) => {
        const { clientId, ...data } = input;
        await db.updateClient(clientId, data);
        return { success: true };
      }),
    uploadPhoto: publicProcedure
      .input(z.object({ clientId: z.number(), fileBase64: z.string(), mimeType: z.string() }))
      .mutation(async ({ input }) => {
        const ext = input.mimeType.split("/")[1] || "jpg";
        const key = `barber-pro/clients/photo-${input.clientId}-${randomSuffix()}.${ext}`;
        const buffer = Buffer.from(input.fileBase64, "base64");
        const { url } = await storagePut(key, buffer, input.mimeType);
        await db.updateClient(input.clientId, { photoUrl: url });
        return { url };
      }),
    changePassword: publicProcedure
      .input(z.object({ clientId: z.number(), currentPassword: z.string(), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const account = await db.getClientAccountByClientId(input.clientId);
        if (!account) throw new Error("Conta não encontrada");
        const valid = await comparePassword(input.currentPassword, account.passwordHash);
        if (!valid) throw new Error("Senha atual incorreta");
        const passwordHash = await hashPassword(input.newPassword);
        await db.updateClientAccount(account.id, { passwordHash });
        return { success: true };
      }),
    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        // Verifica se o email existe
        const account = await db.getClientAccountByEmail(input.email);
        if (!account) {
          // Por segurança, não revelamos se o email existe ou não
          return { success: true, message: "Se este e-mail estiver cadastrado, você receberá o código de recuperação." };
        }
        const token = await db.createPasswordResetToken(input.email);
        // Em produção, enviar por e-mail. Por ora, retornamos o token para exibição no app.
        return { success: true, token, message: "Código gerado com sucesso." };
      }),
    verifyResetToken: publicProcedure
      .input(z.object({ email: z.string().email(), token: z.string().length(6) }))
      .mutation(async ({ input }) => {
        const valid = await db.validatePasswordResetToken(input.email, input.token);
        if (!valid) throw new Error("Código inválido ou expirado. Solicite um novo código.");
        return { success: true };
      }),
    resetPassword: publicProcedure
      .input(z.object({ email: z.string().email(), token: z.string().length(6), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const consumed = await db.consumePasswordResetToken(input.email, input.token);
        if (!consumed) throw new Error("Código inválido ou expirado. Solicite um novo código.");
        const account = await db.getClientAccountByEmail(input.email);
        if (!account) throw new Error("Conta não encontrada.");
        const passwordHash = await hashPassword(input.newPassword);
        await db.updateClientAccount(account.id, { passwordHash });
        return { success: true, message: "Senha redefinida com sucesso!" };
      }),
    googleLogin: publicProcedure
      .input(z.object({
        googleId: z.string(),
        email: z.string().email(),
        name: z.string(),
        photoUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Check if account exists by email
        let account = await db.getClientAccountByEmail(input.email);
        if (!account) {
          // Create client and account (no password for Google users)
          const clientId = await db.createClient({ name: input.name, email: input.email, phone: "", isActive: true });
          const passwordHash = await hashPassword(randomSuffix()); // random password, not used
          await db.createClientAccount({ clientId, email: input.email, passwordHash, googleId: input.googleId });
          account = await db.getClientAccountByEmail(input.email);
        } else {
          // Update googleId if not set
          await db.updateClientAccount(account.id, { googleId: input.googleId });
        }
        const client = await db.getClientById(account!.clientId);
        if (!client) throw new Error("Cliente não encontrado");
        // Update photo if provided
        if (input.photoUrl && !client.photoUrl) {
          await db.updateClient(client.id, { photoUrl: input.photoUrl });
        }
        return { id: client.id, tenantId: client.tenantId, preferredTenantId: client.preferredTenantId ?? null, name: client.name, email: client.email, phone: client.phone ?? "", totalPoints: client.totalPoints, birthDate: client.birthDate, photoUrl: input.photoUrl ?? client.photoUrl };
      }),
    getBirthdayCoupon: publicProcedure
      .input(z.object({ birthDate: z.string(), tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        // Verifica se o mês de nascimento é o mês atual
        if (!input.birthDate) return null;
        const birthMonth = parseInt(input.birthDate.split("-")[1], 10);
        const currentMonth = new Date().getMonth() + 1;
        if (birthMonth !== currentMonth) return null;
        // Busca cupão de aniversário ativo (código começa com ANIV)
        const allCoupons = await db.getAllCoupons(input.tenantId);
        const birthdayCoupon = allCoupons.find((c: any) => c.isActive && c.code.startsWith("ANIV"));
        return birthdayCoupon ?? null;
      }),
    setPreferredTenant: publicProcedure
      .input(z.object({ clientId: z.number(), tenantId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        await db.updateClient(input.clientId, { preferredTenantId: input.tenantId });
        return { success: true };
      }),
    getPreferredTenant: publicProcedure
      .input(z.object({ tenantId: z.number().nullable().optional() }))
      .query(async ({ input }) => {
        if (!input.tenantId) return null;
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) return null;
        return { id: tenant.id, name: tenant.name, slug: tenant.slug, logoUrl: tenant.logoUrl ?? null };
      }),
    saveConsent: publicProcedure
      .input(z.object({
        clientId: z.number(),
        tenantId: z.number(),
        consentType: z.string().optional(),
        termsVersion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.saveClientConsent({
          clientId: input.clientId,
          tenantId: input.tenantId,
          consentType: input.consentType ?? "lgpd_contact_sharing",
          termsVersion: input.termsVersion ?? "1.0",
        });
        return { success: true };
      }),
    savePushToken: publicProcedure
      .input(z.object({ clientId: z.number(), pushToken: z.string() }))
      .mutation(({ input }) => db.saveClientPushToken(input.clientId, input.pushToken)),
  }),

  reviews: router({
    recent: publicProcedure
      .input(z.object({ limit: z.number().optional(), tenantId: z.number().optional() }))
      .query(({ input }) => db.getRecentReviews(input.limit ?? 5, input.tenantId)),
    byService: publicProcedure
      .input(z.object({ serviceId: z.number(), tenantId: z.number().optional().nullable() }))
      .query(({ input }) => db.getReviewsByService(input.serviceId, input.tenantId)),
    byProduct: publicProcedure
      .input(z.object({ productId: z.number(), tenantId: z.number().optional().nullable() }))
      .query(({ input }) => db.getReviewsByProduct(input.productId, input.tenantId)),
    byClient: publicProcedure
      .input(z.object({ clientId: z.number(), tenantId: z.number().optional().nullable() }))
      .query(({ input }) => db.getReviewsByClient(input.clientId, input.tenantId)),
    create: publicProcedure
      .input(z.object({ tenantId: z.number(), clientId: z.number(), serviceId: z.number().optional().nullable(), appointmentId: z.number().optional().nullable(), productId: z.number().optional().nullable(), orderId: z.number().optional().nullable(), rating: z.number().min(1).max(5), comment: z.string().optional() }))
      .mutation(({ input }) => db.createReview(input)),
  }),

  export: router({
    clientsCsv: publicProcedure
      .input(z.object({ tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        const allClients = await db.getAllClients(input.tenantId);
        const rows = [
          ["ID", "Nome", "Telefone", "Email", "Data Nasc.", "Ativo", "Cadastrado em"],
          ...allClients.map((c: any) => [
            String(c.id), c.name, c.phone ?? "", c.email ?? "", c.birthDate ?? "",
            c.isActive ? "Sim" : "Não",
            new Date(c.createdAt).toLocaleDateString("pt-BR")
          ])
        ];
        return rows.map(r => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      }),
    financeiroCsv: publicProcedure
      .input(z.object({ tenantId: z.number().optional().nullable(), days: z.number().optional() }))
      .query(async ({ input }) => {
        const days = input.days ?? 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        const startStr = startDate.toISOString().slice(0, 10);
        const endStr = endDate.toISOString().slice(0, 10);
        const salesData = await db.getSalesByDateRange(startStr, endStr, undefined, input.tenantId);
        const expensesData = await db.getExpensesByDateRange(startStr, endStr, input.tenantId);
        const rows = [
          ["Data", "Tipo", "Descrição", "Valor", "Forma de Pagamento", "Status"],
          ...salesData.map((s: any) => [
            new Date(s.createdAt).toLocaleDateString("pt-BR"), "Receita",
            s.notes ?? "Venda", String(s.total), s.paymentMethod, s.paymentStatus
          ]),
          ...expensesData.map((e: any) => [
            e.date, "Despesa", e.description, `-${e.amount}`, e.paymentMethod ?? "", "pago"
          ])
        ];
        return rows.map(r => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      }),
    estoqueCsv: publicProcedure
      .input(z.object({ tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        const products = await db.getAllProducts(false, input.tenantId);
        const rows = [
          ["ID", "Nome", "Tipo", "Preço", "Estoque Atual", "Alerta Mínimo", "Ativo"],
          ...products.map((p: any) => [
            String(p.id), p.name, p.productType === "sale" ? "Venda" : "Uso Interno",
            String(p.price), String(p.stockQuantity), String(p.minStockAlert), p.isActive ? "Sim" : "Não"
          ])
        ];
        return rows.map(r => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      }),
  }),

  chat: router({
    clients: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(({ input }) => db.getChatClients(input.tenantId)),
    history: publicProcedure
      .input(z.object({ tenantId: z.number(), clientId: z.number() }))
      .query(({ input }) => db.getChatHistory(input.tenantId, input.clientId)),
    sendMessage: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        clientId: z.number(),
        barberId: z.number().optional(),
        direction: z.enum(["outgoing", "incoming"]),
        message: z.string().min(1),
      }))
      .mutation(({ input }) => db.saveChatMessage({
        tenantId: input.tenantId,
        clientId: input.clientId,
        barberId: input.barberId ?? 0,
        direction: input.direction,
        message: input.message,
        sentAt: new Date(),
      })),
  }),

  slots: router({
    available: publicProcedure
      .input(z.object({ barberId: z.number(), date: z.string(), durationMinutes: z.number() }))
      .query(({ input }) => db.getAvailableSlots(input.barberId, input.date, input.durationMinutes)),
  }),

   pointsHistory: router({
    byClient: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => db.getClientPointsHistory(input.clientId)),
  }),
  payments: router({
    pendingList: publicProcedure
      .input(z.object({ tenantId: z.number().optional().nullable() }).optional())
      .query(async ({ input }) => {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 30);
        const allSales = await db.getSalesByDateRange(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0],
          undefined,
          input?.tenantId
        );
        return (allSales as any[]).filter((s) =>
          s.paymentStatus === "pending" && s.paymentMethod === "asaas"
        );
      }),

    getSaleByAppointment: publicProcedure
      .input(z.object({ appointmentId: z.number(), tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 5);
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);
        const allSales = await db.getSalesByDateRange(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0],
          undefined,
          input.tenantId
        );
        return (allSales as any[]).find((s) => s.appointmentId === input.appointmentId) ?? null;
      }),
  }),

  reports: router({
    revenue: publicProcedure
      .input(z.object({ period: z.enum(["week", "month", "year"]).default("month"), tenantId: z.number() }))
      .query(async ({ input }) => {
      const today = new Date();
      const labels: string[] = [];
      const data: number[] = [];
      if (input.period === "week") {
        // Últimos 7 dias
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          const sales = await db.getSalesByDateRange(dateStr, dateStr, undefined, input.tenantId);
          const total = (sales as any[]).filter(s => s.paymentStatus === "paid").reduce((sum: number, s: any) => sum + parseFloat(s.total || "0"), 0);
          labels.push(["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()]);
          data.push(total);
        }
      } else if (input.period === "month") {
        // Últimas 4 semanas
        for (let i = 3; i >= 0; i--) {
          const end = new Date(today);
          end.setDate(today.getDate() - i * 7);
          const start = new Date(end);
          start.setDate(end.getDate() - 6);
          const sales = await db.getSalesByDateRange(start.toISOString().split("T")[0], end.toISOString().split("T")[0], undefined, input.tenantId);
          const total = (sales as any[]).filter(s => s.paymentStatus === "paid").reduce((sum: number, s: any) => sum + parseFloat(s.total || "0"), 0);
          labels.push(`Sem ${4 - i}`);
          data.push(total);
        }
      } else {
        // Últimos 12 meses
        const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
          const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
          const end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${lastDay}`;
          const sales = await db.getSalesByDateRange(start, end, undefined, input.tenantId);
          const total = (sales as any[]).filter(s => s.paymentStatus === "paid").reduce((sum: number, s: any) => sum + parseFloat(s.total || "0"), 0);
          labels.push(MONTHS[d.getMonth()]);
          data.push(total);
        }
      }
      const totalRevenue = data.reduce((a, b) => a + b, 0);
      return { labels, data, totalRevenue };
    }),

    topServices: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const sales = await db.getSalesByDateRange(input.startDate, input.endDate, undefined, input.tenantId);
      const paidSales = (sales as any[]).filter(s => s.paymentStatus === "paid");
      const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
      // Build from sale items if available in sale data
      for (const sale of paidSales) {
        if (sale.items && Array.isArray(sale.items)) {
          for (const item of sale.items) {
            if (item.itemType === "service") {
              if (!serviceMap[item.itemName]) serviceMap[item.itemName] = { name: item.itemName, count: 0, revenue: 0 };
              serviceMap[item.itemName].count += item.quantity ?? 1;
              serviceMap[item.itemName].revenue += parseFloat(item.total ?? "0");
            }
          }
        }
      }
      return Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }),

    topClients: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const sales = await db.getSalesByDateRange(input.startDate, input.endDate, undefined, input.tenantId);
      const paidSales = (sales as any[]).filter(s => s.paymentStatus === "paid" && s.clientId);
      const clientMap: Record<number, { clientId: number; count: number; revenue: number }> = {};
      for (const sale of paidSales) {
        const cid = sale.clientId;
        if (!clientMap[cid]) clientMap[cid] = { clientId: cid, count: 0, revenue: 0 };
        clientMap[cid].count += 1;
        clientMap[cid].revenue += parseFloat(sale.total ?? "0");
      }
      const allClients = await db.getAllClients(input.tenantId);
      const clientsById: Record<number, any> = {};
      for (const c of allClients as any[]) clientsById[c.id] = c;
      return Object.values(clientMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(c => ({ ...c, name: clientsById[c.clientId]?.name ?? "Cliente", phone: clientsById[c.clientId]?.phone ?? "" }));
    }),

    barberOccupancy: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string(), tenantId: z.number() }))
    .query(async ({ input }) => {
      const allBarbers = await db.getAllBarbers(input.tenantId);
      const result: {
        barberId: number; name: string; appointments: number; revenue: number;
        completed: number; cancelled: number; noShow: number; occupancyPct: number;
      }[] = [];

      // Calcular dias no período para estimar slots disponíveis
      const start = new Date(input.startDate + "T12:00:00");
      const end = new Date(input.endDate + "T12:00:00");
      const daysDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

      for (const barber of allBarbers as any[]) {
        // Receita
        const sales = await db.getSalesByDateRange(input.startDate, input.endDate, barber.id, input.tenantId);
        const paidSales = (sales as any[]).filter((s: any) => s.paymentStatus === "paid");
        const revenue = paidSales.reduce((sum: number, s: any) => sum + parseFloat(s.total ?? "0"), 0);

        // Agendamentos por status no período (todos os status)
        const allAppts = await db.getAllAppointmentsByDateRange(barber.id, input.startDate, input.endDate, input.tenantId);
        const allApptsAny = allAppts as any[];
        const completed = allApptsAny.filter((a: any) => a.status === "completed").length;
        const cancelled = allApptsAny.filter((a: any) => a.status === "cancelled").length;
        const noShow = allApptsAny.filter((a: any) => a.status === "no_show").length;
        const totalAppts = allApptsAny.length;

        // Horários de trabalho para estimar slots (1 slot = 30min)
        const workingHrs = await db.getWorkingHours(barber.id);
        const workingDaysPerWeek = (workingHrs as any[]).filter((h: any) => h.isWorking).length || 5;
        const estimatedWorkingDays = Math.max(1, Math.round(daysDiff * (workingDaysPerWeek / 7)));
        const estimatedSlots = estimatedWorkingDays * 16; // 16 slots de 30min por diaútil
        const occupancyPct = Math.min(100, Math.round((completed / estimatedSlots) * 100));

        result.push({ barberId: barber.id, name: barber.name, appointments: totalAppts, revenue, completed, cancelled, noShow, occupancyPct });
      }
      return result.sort((a, b) => b.revenue - a.revenue);
    }),
    exportPdf: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string(), period: z.string().optional(), tenantId: z.number() }))
    .mutation(async ({ input }) => {
      const settings = await db.getShopSettings(input.tenantId).catch(() => null) as any;
      const shopName = settings?.shopName || "Barber Pro";
      const shopCnpj = settings?.cnpj || "";
      const shopAddress = settings?.address || "";
      // Receitas
      const sales = await db.getSalesByDateRange(input.startDate, input.endDate, undefined, input.tenantId);
      const paidSales = (sales as any[]).filter(s => s.paymentStatus === "paid");
      const totalRevenue = paidSales.reduce((sum: number, s: any) => sum + parseFloat(s.total ?? "0"), 0);
      // Despesas
      const expenses = await db.getExpensesByDateRange(input.startDate, input.endDate, input.tenantId);
      const totalExpenses = (expenses as any[]).reduce((sum: number, e: any) => sum + parseFloat(e.amount ?? "0"), 0);
      const netProfit = totalRevenue - totalExpenses;
      // Top serviços
      const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
      for (const sale of paidSales) {
        if (sale.items && Array.isArray(sale.items)) {
          for (const item of sale.items) {
            if (item.itemType === "service") {
              if (!serviceMap[item.itemName]) serviceMap[item.itemName] = { name: item.itemName, count: 0, revenue: 0 };
              serviceMap[item.itemName].count += item.quantity ?? 1;
              serviceMap[item.itemName].revenue += parseFloat(item.total ?? "0");
            }
          }
        }
      }
      const topServices = Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      // Gera PDF
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      const pdfPromise = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
      const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}` ;
      const fmtDate = (d: string) => d.split("-").reverse().join("/");
      const gold = "#C9A84C";
      // Cabeçalho
      doc.fontSize(20).fillColor(gold).text(shopName, { align: "center" });
      if (shopCnpj) doc.fontSize(10).fillColor("#555").text(`CNPJ: ${shopCnpj}`, { align: "center" });
      if (shopAddress) doc.fontSize(10).fillColor("#555").text(shopAddress, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(14).fillColor("#222").text(`Relatório Financeiro — ${fmtDate(input.startDate)} a ${fmtDate(input.endDate)}`, { align: "center" });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(gold).lineWidth(1.5).stroke();
      doc.moveDown(1);
      // DRE simplificado
      doc.fontSize(13).fillColor(gold).text("DRE Simplificado");
      doc.moveDown(0.3);
      const dreRows = [
        { label: "(+) Receita Bruta", value: totalRevenue, bold: false },
        { label: "(-) Despesas Operacionais", value: totalExpenses, bold: false },
        { label: "(=) Resultado Líquido", value: netProfit, bold: true },
      ];
      for (const row of dreRows) {
        const color = row.label.startsWith("(=") ? (netProfit >= 0 ? "#22C55E" : "#EF4444") : "#222";
        doc.fontSize(row.bold ? 12 : 11).fillColor(color);
        const y = doc.y;
        doc.text(row.label, 50, y, { continued: true, width: 350 });
        doc.text(fmt(row.value), { align: "right" });
      }
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
      doc.moveDown(1);
      // Resumo de pagamentos
      const byMethod: Record<string, number> = {};
      for (const s of paidSales) {
        const m = s.paymentMethod || "outros";
        byMethod[m] = (byMethod[m] || 0) + parseFloat(s.total ?? "0");
      }
      doc.fontSize(13).fillColor(gold).text("Receitas por Forma de Pagamento");
      doc.moveDown(0.3);
      const methodLabels: Record<string, string> = { cash: "Dinheiro", card: "Cartão", pix: "Pix", credit_card: "Cartão de Crédito", debit_card: "Cartão de Débito", outros: "Outros" };
      for (const [method, value] of Object.entries(byMethod)) {
        doc.fontSize(11).fillColor("#222");
        const y = doc.y;
        doc.text(methodLabels[method] || method, 50, y, { continued: true, width: 350 });
        doc.text(fmt(value), { align: "right" });
      }
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
      doc.moveDown(1);
      // Top serviços
      if (topServices.length > 0) {
        doc.fontSize(13).fillColor(gold).text("Serviços Mais Vendidos");
        doc.moveDown(0.3);
        for (const svc of topServices) {
          doc.fontSize(11).fillColor("#222");
          const y = doc.y;
          doc.text(`${svc.name} (${svc.count}x)`, 50, y, { continued: true, width: 350 });
          doc.text(fmt(svc.revenue), { align: "right" });
        }
        doc.moveDown(1);
      }
      // Despesas detalhadas
      if ((expenses as any[]).length > 0) {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
        doc.moveDown(1);
        doc.fontSize(13).fillColor(gold).text("Despesas Detalhadas");
        doc.moveDown(0.3);
        for (const exp of expenses as any[]) {
          doc.fontSize(10).fillColor("#555");
          const y = doc.y;
          doc.text(`${fmtDate(exp.date)} — ${exp.category}: ${exp.description}`, 50, y, { continued: true, width: 350 });
          doc.text(fmt(parseFloat(exp.amount ?? "0")), { align: "right" });
        }
        doc.moveDown(1);
      }
      // Rodapé
      doc.moveDown(1);
      doc.fontSize(9).fillColor("#aaa").text(`Gerado em ${new Date().toLocaleString("pt-BR")} · ${shopName}`, { align: "center" });
      doc.end();
      const pdfBuffer = await pdfPromise;
      return { pdfBase64: pdfBuffer.toString("base64") };
    }),
    ordersTimeline: publicProcedure
    .input(z.object({ tenantId: z.number(), period: z.enum(["week", "month", "year"]).default("month") }))
    .query(async ({ input }) => {
      const orders = await db.getProductOrdersByTenant(input.tenantId);
      const today = new Date();
      const labels: string[] = [];
      const data: number[] = [];
      if (input.period === "week") {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          const count = (orders as any[]).filter((o) => {
            const od = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
            return od === dateStr;
          }).length;
          labels.push(["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()]);
          data.push(count);
        }
      } else if (input.period === "month") {
        for (let i = 3; i >= 0; i--) {
          const end = new Date(today);
          end.setDate(today.getDate() - i * 7);
          const start = new Date(end);
          start.setDate(end.getDate() - 6);
          const startStr = start.toISOString().split("T")[0];
          const endStr = end.toISOString().split("T")[0];
          const count = (orders as any[]).filter((o) => {
            const od = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
            return od >= startStr && od <= endStr;
          }).length;
          labels.push(`Sem ${4 - i}`);
          data.push(count);
        }
      } else {
        const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
          const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
          const end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${lastDay}`;
          const count = (orders as any[]).filter((o) => {
            const od = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
            return od >= start && od <= end;
          }).length;
          labels.push(MONTHS[d.getMonth()]);
          data.push(count);
        }
      }
      const total = data.reduce((a, b) => a + b, 0);
      return { labels, data, total };
    }),
    ordersSummary: publicProcedure
    .input(z.object({ tenantId: z.number(), startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      const orders = await db.getProductOrdersByTenant(input.tenantId);
      const filtered = (orders as any[]).filter((o) => {
        const d = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
        return d >= input.startDate && d <= input.endDate;
      });
      const delivered = filtered.filter((o) => o.status === "delivered");
      const cancelled = filtered.filter((o) => o.status === "cancelled");
      const pending = filtered.filter((o) => !["delivered", "cancelled"].includes(o.status));
      const totalRevenue = delivered.reduce((sum: number, o: any) => sum + parseFloat(o.totalPrice ?? "0"), 0);
      // Produtos mais encomendados
      const productMap: Record<string, { name: string; count: number; revenue: number }> = {};
      for (const o of filtered) {
        const name = o.productName ?? "Produto";
        if (!productMap[name]) productMap[name] = { name, count: 0, revenue: 0 };
        productMap[name].count += o.quantity ?? 1;
        if (o.status === "delivered") productMap[name].revenue += parseFloat(o.totalPrice ?? "0");
      }
      const topProducts = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 5);
      return {
        total: filtered.length,
        delivered: delivered.length,
        cancelled: cancelled.length,
        pending: pending.length,
        totalRevenue,
        topProducts,
      };
    }),
    exportOrdersPdf: publicProcedure
    .input(z.object({ tenantId: z.number(), startDate: z.string(), endDate: z.string() }))
    .mutation(async ({ input }) => {
      const settings = await db.getShopSettings(input.tenantId).catch(() => null) as any;
      const shopName = settings?.shopName || "Barber Pro";
      const orders = await db.getProductOrdersByTenant(input.tenantId);
      const filtered = (orders as any[]).filter((o) => {
        const d = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
        return d >= input.startDate && d <= input.endDate;
      });
      const delivered = filtered.filter((o) => o.status === "delivered");
      const cancelled = filtered.filter((o) => o.status === "cancelled");
      const pending = filtered.filter((o) => !["delivered", "cancelled"].includes(o.status));
      const totalRevenue = delivered.reduce((sum: number, o: any) => sum + parseFloat(o.totalPrice ?? "0"), 0);
      const productMap: Record<string, { name: string; count: number; revenue: number }> = {};
      for (const o of filtered) {
        const name = o.productName ?? "Produto";
        if (!productMap[name]) productMap[name] = { name, count: 0, revenue: 0 };
        productMap[name].count += o.quantity ?? 1;
        if (o.status === "delivered") productMap[name].revenue += parseFloat(o.totalPrice ?? "0");
      }
      const topProducts = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 10);
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      const pdfPromise = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
      const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}` ;
      const fmtDate = (d: string) => d.split("-").reverse().join("/");
      const gold = "#C9A84C";
      doc.fontSize(20).fillColor(gold).text(shopName, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(14).fillColor("#222").text(`Relatório de Encomendas — ${fmtDate(input.startDate)} a ${fmtDate(input.endDate)}`, { align: "center" });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(gold).lineWidth(1.5).stroke();
      doc.moveDown(1);
      doc.fontSize(13).fillColor(gold).text("Resumo do Período");
      doc.moveDown(0.3);
      const kpiRows = [
        { label: "Total de Encomendas", value: filtered.length.toString() },
        { label: "Entregues", value: delivered.length.toString() },
        { label: "Em Aberto", value: pending.length.toString() },
        { label: "Canceladas", value: cancelled.length.toString() },
        { label: "Receita Gerada (Entregas)", value: fmt(totalRevenue) },
      ];
      for (const row of kpiRows) {
        doc.fontSize(11).fillColor("#222");
        const y = doc.y;
        doc.text(row.label, 50, y, { continued: true, width: 350 });
        doc.text(row.value, { align: "right" });
      }
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
      doc.moveDown(1);
      if (topProducts.length > 0) {
        doc.fontSize(13).fillColor(gold).text("Produtos Mais Encomendados");
        doc.moveDown(0.3);
        for (const p of topProducts) {
          doc.fontSize(11).fillColor("#222");
          const y = doc.y;
          doc.text(`${p.name} (${p.count}x)`, 50, y, { continued: true, width: 350 });
          doc.text(fmt(p.revenue), { align: "right" });
        }
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
        doc.moveDown(1);
      }
      if (delivered.length > 0) {
        doc.fontSize(13).fillColor(gold).text("Encomendas Entregues");
        doc.moveDown(0.3);
        for (const o of delivered) {
          doc.fontSize(10).fillColor("#555");
          const y = doc.y;
          const dateStr = o.createdAt ? fmtDate(new Date(o.createdAt).toISOString().split("T")[0]) : "";
          doc.text(`${dateStr} — ${o.productName ?? "Produto"} (${o.quantity}x) — ${o.clientName ?? "Cliente"}`, 50, y, { continued: true, width: 350 });
          doc.text(fmt(parseFloat(o.totalPrice ?? "0")), { align: "right" });
        }
        doc.moveDown(1);
      }
      doc.fontSize(9).fillColor("#aaa").text(`Gerado em ${new Date().toLocaleString("pt-BR")} · ${shopName}`, { align: "center" });
      doc.end();
      const pdfBuffer = await pdfPromise;
      return { pdfBase64: pdfBuffer.toString("base64") };
    }),
    expensesBySupplier: publicProcedure
    .input(z.object({ tenantId: z.number(), startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      return db.getExpensesBySupplier(input.tenantId, input.startDate, input.endDate);
    }),

  // DRE simplificado com comparativo ao período anterior
    dreComparative: publicProcedure
    .input(z.object({ tenantId: z.number(), startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      // Período atual
      const salesCurrent = await db.getSalesByDateRange(input.startDate, input.endDate, undefined, input.tenantId);
      const paidCurrent = (salesCurrent as any[]).filter(s => s.paymentStatus === "paid");
      const revenue = paidCurrent.reduce((s: number, x: any) => s + parseFloat(x.total ?? "0"), 0);
      const salesCount = paidCurrent.length;
      const ticketAvg = salesCount > 0 ? revenue / salesCount : 0;
      const expensesCurrent = await db.getExpensesByDateRange(input.startDate, input.endDate, input.tenantId);
      const expenses = (expensesCurrent as any[]).reduce((s: number, x: any) => s + parseFloat(x.amount ?? "0"), 0);
      const netProfit = revenue - expenses;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      // Período anterior (mesmo intervalo de dias)
      const startD = new Date(input.startDate + "T12:00:00");
      const endD = new Date(input.endDate + "T12:00:00");
      const daysDiff = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1);
      const prevEnd = new Date(startD);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (daysDiff - 1));
      const prevStartStr = prevStart.toISOString().split("T")[0];
      const prevEndStr = prevEnd.toISOString().split("T")[0];

      const salesPrev = await db.getSalesByDateRange(prevStartStr, prevEndStr, undefined, input.tenantId);
      const paidPrev = (salesPrev as any[]).filter(s => s.paymentStatus === "paid");
      const prevRevenue = paidPrev.reduce((s: number, x: any) => s + parseFloat(x.total ?? "0"), 0);
      const prevSalesCount = paidPrev.length;
      const prevTicketAvg = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;
      const expensesPrev = await db.getExpensesByDateRange(prevStartStr, prevEndStr, input.tenantId);
      const prevExpenses = (expensesPrev as any[]).reduce((s: number, x: any) => s + parseFloat(x.amount ?? "0"), 0);
      const prevNetProfit = prevRevenue - prevExpenses;
      const prevMargin = prevRevenue > 0 ? (prevNetProfit / prevRevenue) * 100 : 0;

      function pctChange(curr: number, prev: number) {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
      }

      return {
        revenue, expenses, netProfit, margin, ticketAvg, salesCount,
        prevRevenue, prevExpenses, prevNetProfit, prevMargin, prevTicketAvg, prevSalesCount,
        revenueChange: pctChange(revenue, prevRevenue),
        expensesChange: pctChange(expenses, prevExpenses),
        netProfitChange: pctChange(netProfit, prevNetProfit),
        ticketAvgChange: pctChange(ticketAvg, prevTicketAvg),
      };
    }),

  // Breakdown de despesas por categoria
    expensesByCategory: publicProcedure
    .input(z.object({ tenantId: z.number(), startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      const expList = await db.getExpensesByDateRange(input.startDate, input.endDate, input.tenantId);
      const catMap: Record<string, { category: string; total: number; count: number }> = {};
      for (const exp of expList as any[]) {
        const cat = exp.category || "Outros";
        if (!catMap[cat]) catMap[cat] = { category: cat, total: 0, count: 0 };
        catMap[cat].total += parseFloat(exp.amount ?? "0");
        catMap[cat].count += 1;
      }
      const totalExpenses = Object.values(catMap).reduce((s, c) => s + c.total, 0);
      return Object.values(catMap)
        .sort((a, b) => b.total - a.total)
        .map(c => ({ ...c, pct: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0 }));
    }),

  // Ticket médio por sub-período (para gráfico de tendência)
    ticketAvgTimeline: publicProcedure
    .input(z.object({ tenantId: z.number(), period: z.enum(["week", "month", "year"]).default("month") }))
    .query(async ({ input }) => {
      const today = new Date();
      const labels: string[] = [];
      const data: number[] = [];
      const counts: number[] = [];

      if (input.period === "week") {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          const sales = await db.getSalesByDateRange(dateStr, dateStr, undefined, input.tenantId);
          const paid = (sales as any[]).filter(s => s.paymentStatus === "paid");
          const total = paid.reduce((s: number, x: any) => s + parseFloat(x.total ?? "0"), 0);
          const avg = paid.length > 0 ? total / paid.length : 0;
          labels.push(["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()]);
          data.push(avg);
          counts.push(paid.length);
        }
      } else if (input.period === "month") {
        for (let i = 3; i >= 0; i--) {
          const end = new Date(today);
          end.setDate(today.getDate() - i * 7);
          const start = new Date(end);
          start.setDate(end.getDate() - 6);
          const sales = await db.getSalesByDateRange(start.toISOString().split("T")[0], end.toISOString().split("T")[0], undefined, input.tenantId);
          const paid = (sales as any[]).filter(s => s.paymentStatus === "paid");
          const total = paid.reduce((s: number, x: any) => s + parseFloat(x.total ?? "0"), 0);
          const avg = paid.length > 0 ? total / paid.length : 0;
          labels.push(`Sem ${4 - i}`);
          data.push(avg);
          counts.push(paid.length);
        }
      } else {
        const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
          const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
          const end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${lastDay}`;
          const sales = await db.getSalesByDateRange(start, end, undefined, input.tenantId);
          const paid = (sales as any[]).filter(s => s.paymentStatus === "paid");
          const total = paid.reduce((s: number, x: any) => s + parseFloat(x.total ?? "0"), 0);
          const avg = paid.length > 0 ? total / paid.length : 0;
          labels.push(MONTHS[d.getMonth()]);
          data.push(avg);
          counts.push(paid.length);
        }
      }
      return { labels, data, counts };
    }),

  // Projeção de receita do mês atual
    revenueProjection: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;
      const todayStr = today.toISOString().split("T")[0];

      // Receita acumulada no mês até hoje
      const salesSoFar = await db.getSalesByDateRange(monthStart, todayStr, undefined, input.tenantId);
      const paidSoFar = (salesSoFar as any[]).filter(s => s.paymentStatus === "paid");
      const revenueSoFar = paidSoFar.reduce((s: number, x: any) => s + parseFloat(x.total ?? "0"), 0);

      // Projeção linear: (receita_até_hoje / dias_passados) * dias_do_mês
      const dailyAvg = dayOfMonth > 0 ? revenueSoFar / dayOfMonth : 0;
      const projected = dailyAvg * daysInMonth;
      const progressPct = (dayOfMonth / daysInMonth) * 100;

      // Mês anterior para comparativo
      const prevMonthStart = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, "0")}-01`;
      const prevMonthDays = new Date(month === 0 ? year - 1 : year, month === 0 ? 12 : month, 0).getDate();
      const prevMonthEnd = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, "0")}-${prevMonthDays}`;
      const salesPrevMonth = await db.getSalesByDateRange(prevMonthStart, prevMonthEnd, undefined, input.tenantId);
      const paidPrevMonth = (salesPrevMonth as any[]).filter(s => s.paymentStatus === "paid");
      const revenuePrevMonth = paidPrevMonth.reduce((s: number, x: any) => s + parseFloat(x.total ?? "0"), 0);

      const projectionVsPrev = revenuePrevMonth > 0
        ? ((projected - revenuePrevMonth) / revenuePrevMonth) * 100
        : 0;

      return {
        revenueSoFar,
        projected,
        dailyAvg,
        progressPct,
        dayOfMonth,
        daysInMonth,
        revenuePrevMonth,
        projectionVsPrev,
        monthStart,
        monthEnd,
      };
    }),
  }),

  // ─── Mensagens de Retorno Automáticas ────────────────────────────────────────
  returnMessages: router({
    list: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.listReturnMessageConfigs(input?.tenantId);
    }),
    upsert: publicProcedure
      .input(z.object({
        serviceId: z.number(),
        delayDays: z.number().min(1).max(365),
        messageTemplate: z.string().min(1),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        return db.upsertReturnMessageConfig(input);
      }),
    delete: publicProcedure
      .input(z.object({ serviceId: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteReturnMessageConfig(input.serviceId);
      }),
  }),

  // ─── Promoções e Notícias ─────────────────────────────────────────────────────
  promotions: router({
    list: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.listPromotions(input?.tenantId);
    }),
    send: publicProcedure
      .input(z.object({
        title: z.string().min(1),
        message: z.string().min(1),
        targetAudience: z.enum(["all", "inactive_30", "inactive_60", "birthday_month", "specific_client"]),
        specificClientId: z.number().optional().nullable(),
        createdBy: z.number(),
        tenantId: z.number().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const recipientCount = await db.getPromotionRecipientCount(
          input.targetAudience,
          input.specificClientId ?? undefined,
          input.tenantId
        );
        return db.createPromotion({
          title: input.title,
          message: input.message,
          targetAudience: input.targetAudience,
          specificClientId: input.specificClientId ?? null,
          createdBy: input.createdBy,
          recipientCount,
          tenantId: input.tenantId,
        });
      }),
  }),

  // ─── Lista de Espera ──────────────────────────────────────────────────────────
  waitlist: router({
    listByDate: publicProcedure
      .input(z.object({ date: z.string(), tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        return db.listWaitlistByDate(input.date, input.tenantId);
      }),
    join: publicProcedure
      .input(z.object({
        clientId: z.number(),
        date: z.string(),
        barberId: z.number().optional(),
        serviceId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.joinWaitlist(input);
      }),
    leave: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.leaveWaitlist(input.id);
      }),
    myEntry: publicProcedure
      .input(z.object({ clientId: z.number(), date: z.string() }))
      .query(async ({ input }) => {
        return db.getWaitlistEntry(input.clientId, input.date);
      }),
  }),

  // ─── Comissões ───────────────────────────────────────────────────────────────
  commissions: router({
    getConfig: publicProcedure
      .input(z.object({ barberId: z.number() }))
      .query(async ({ input }) => {
        return db.getCommissionConfig(input.barberId);
      }),
    listConfigs: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.listCommissionConfigs(input?.tenantId);
    }),
    saveConfig: publicProcedure
      .input(z.object({
        barberId: z.number(),
        defaultRate: z.number().min(0).max(100),
      }))
      .mutation(async ({ input }) => {
        return db.upsertCommissionConfig(input);
      }),
    listEntries: publicProcedure
      .input(z.object({
        barberId: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
        tenantId: z.number().optional().nullable(),
      }))
      .query(async ({ input }) => {
        return db.listCommissionEntries(input);
      }),
    summary: publicProcedure
      .input(z.object({ startDate: z.string(), endDate: z.string(), tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        return db.getCommissionSummary(input.startDate, input.endDate, input.tenantId);
      }),
  }),

  recurring: router({
    create: publicProcedure
      .input(z.object({
        clientId: z.number(),
        barberId: z.number(),
        serviceId: z.number(),
        startDate: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        intervalWeeks: z.number().min(1).max(52),
        occurrences: z.number().min(2).max(24),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createRecurringAppointments(input);
      }),
    listByClient: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getRecurringAppointments(input.clientId);
      }),
    cancel: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.cancelRecurring(input.id);
      }),
    listAll: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.getAllRecurringAppointments(input?.tenantId);
    }),
    listCancelled: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.getCancelledRecurringAppointments(input?.tenantId);
    }),
    cancelWithReason: publicProcedure
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        return db.cancelRecurringWithReason(input.id, input.reason);
      }),
    stats: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.getSubscriptionStats(input?.tenantId);
    }),
  }),

  promotionConversion: router({
    report: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.getPromotionConversionReport(input?.tenantId);
    }),
  }),

  stock: router({
    list: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.getStockProducts(input?.tenantId);
    }),
    addMovement: publicProcedure
      .input(z.object({
        productId: z.number(),
        type: z.enum(["in", "out", "adjustment"]),
        quantity: z.number().min(1),
        reason: z.string().optional(),
        barberId: z.number().optional(),
        date: z.string(),
      }))
      .mutation(async ({ input }) => {
        return db.addStockMovement(input);
      }),
    movements: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return db.getStockMovements(input.productId);
      }),
    consumptionAverage: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return db.getStockConsumptionAverage(input.productId);
      }),
    lowStock: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.getLowStockProducts(input?.tenantId);
    }),
    restock: publicProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number().min(1),
        unitCost: z.number().min(0).optional(),
        updateCostPrice: z.boolean().optional().default(false),
        paymentMethod: z.string().optional(),
        note: z.string().optional(),
        barberId: z.number().optional(),
        tenantId: z.number().optional().nullable(),
        supplierId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const today = new Date().toISOString().slice(0, 10);
        const product = await db.getProductById(input.productId);
        const productName = product?.name ?? "Produto";

        // 1. Registrar entrada no histórico de estoque
        await db.addStockMovement({
          productId: input.productId,
          type: "in",
          quantity: input.quantity,
          reason: input.note ?? "Reposição de estoque",
          barberId: input.barberId,
          date: today,
          supplierId: input.supplierId,
        } as any);

        // 2. Criar despesa financeira automaticamente
        if (input.unitCost && input.unitCost > 0) {
          const totalCost = input.unitCost * input.quantity;
          await db.createExpense({
            category: "Estoque",
            description: `Reposição: ${productName} (${input.quantity}x R$${input.unitCost.toFixed(2)})${input.note ? ` — ${input.note}` : ""}`,
            amount: String(totalCost.toFixed(2)),
            date: today,
            paymentMethod: input.paymentMethod ?? null,
            barberId: input.barberId ?? null,
            tenantId: input.tenantId ?? null,
          } as any);
        }

        // 3. Atualizar preço de custo do produto (se diferente do atual)
        if (input.unitCost && input.unitCost > 0) {
          const currentCost = product?.costPrice ? parseFloat(String(product.costPrice)) : null;
          const isSameCost = currentCost !== null && Math.abs(currentCost - input.unitCost) < 0.001;
          if (!isSameCost || input.updateCostPrice) {
            await db.updateProduct(input.productId, { costPrice: input.unitCost.toFixed(2) } as any);
          }
        }

        return { success: true };
      }),
  }),
  // ─── Onboarding SaaS (criação de novo tenant) ─────────────────────────────
  onboarding: router({
    register: publicProcedure
      .input(z.object({
        plan: z.enum(["solo", "team", "studio"]).default("solo"),
        shop: z.object({
          name: z.string().min(2, "Nome da barbearia é obrigatório"),
          phone: z.string().min(8, "Telefone é obrigatório"),
          cnpj: z.string().optional(),
          instagram: z.string().optional(),
          cep: z.string().optional(),
          address: z.string().optional(),
          addressNumber: z.string().optional(),
          addressComplement: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
        }),
        schedule: z.object({
          workDays: z.array(z.number().min(0).max(6)),
          openTime: z.string(),
          closeTime: z.string(),
          lunchStart: z.string().optional(),
          lunchEnd: z.string().optional(),
        }),
        admin: z.object({
          name: z.string().min(2, "Nome é obrigatório"),
          email: z.string().email("Email inválido"),
          password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
        }),
      }))
      .mutation(async ({ input }) => {
        // 1. Verificar se email já está em uso globalmente
        const existingBarber = await db.getBarberByEmail(input.admin.email);
        if (existingBarber) throw new Error("Este email já está cadastrado");

                // 1b. Verificar se este email ou CPF/CNPJ já usou o trial gratuito
        {
          const cleanCpfCnpj = input.shop.cnpj ? input.shop.cnpj.replace(/\D/g, "") : null;
          const safeEmail = input.admin.email.toLowerCase().replace(/'/g, "''");

          // Checar por email — usa rawQuery (pool pg direto) para evitar parametrização automática
          const emailRows = await db.rawQuery(
            `SELECT id FROM used_trials WHERE email = '${safeEmail}' LIMIT 1`
          );
          if (emailRows.length > 0) {
            throw new Error("Este e-mail já utilizou o período de teste gratuito. Para continuar, assine um dos planos diretamente.");
          }

          // Checar por CPF/CNPJ
          if (cleanCpfCnpj && cleanCpfCnpj.length >= 11) {
            const safeCpfCnpj = cleanCpfCnpj.replace(/'/g, "''");
            const cpfRows = await db.rawQuery(
              `SELECT id FROM used_trials WHERE "cpfCnpj" = '${safeCpfCnpj}' LIMIT 1`
            );
            if (cpfRows.length > 0) {
              throw new Error("Este CPF/CNPJ já utilizou o período de teste gratuito. Para continuar, assine um dos planos diretamente.");
            }
          }
        }
        // 2. Gerar slug único para o tenant
        const baseSlug = input.shop.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .substring(0, 50);
        let slug = baseSlug;
        let attempt = 0;
        while (await db.getTenantBySlug(slug)) {
          attempt++;
          slug = `${baseSlug}-${attempt}`;
        }
        // 3. Criar tenant
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 dias de trial
        const tenantId = await db.createTenant({
          slug,
          name: input.shop.name,
          phone: input.shop.phone,
          cnpj: input.shop.cnpj,
          address: input.shop.address,
          cep: input.shop.cep,
          addressNumber: input.shop.addressNumber,
          addressComplement: input.shop.addressComplement,
          city: input.shop.city,
          state: input.shop.state,
          plan: input.plan,
          status: "trial",
          trialEndsAt,
        });
        // 4. Criar configurações da loja
        await db.createShopSettingsForTenant(tenantId, {
          shopName: input.shop.name,
          phone: input.shop.phone,
          cnpj: input.shop.cnpj,
          instagram: input.shop.instagram,
          cep: input.shop.cep,
          address: input.shop.address,
          addressNumber: input.shop.addressNumber,
          addressComplement: input.shop.addressComplement,
        });
        // 5. Criar barbeiro admin (super_admin)
        const passwordHash = await hashPassword(input.admin.password);
        const barberId = await db.createBarber({
          tenantId,
          name: input.admin.name,
          email: input.admin.email,
          passwordHash,
          role: "super_admin",
          isActive: true,
        });
        // 6. Criar horários de trabalho para o admin (usando os dias selecionados)
        for (const dayOfWeek of input.schedule.workDays) {
          await db.upsertWorkingHours(barberId, dayOfWeek, {
            startTime: input.schedule.openTime,
            endTime: input.schedule.closeTime,
            lunchStart: input.schedule.lunchStart ?? null,
            lunchEnd: input.schedule.lunchEnd ?? null,
            isWorking: true,
          });
        }
        // 7. Enviar e-mail de boas-vindas ao novo dono da barbearia
        sendWelcomeEmail({
          barberName: input.admin.name,
          barberEmail: input.admin.email,
          shopName: input.shop.name,
          shopSlug: slug,
          trialDays: 14,
        }).catch((e: any) => console.error("[welcome-email] Erro:", e.message));

        // 8. Retornar dados do admin para login automático
        return {
          tenantId,
          tenantSlug: slug,
          admin: {
            id: barberId,
            name: input.admin.name,
            email: input.admin.email,
            role: "super_admin" as const,
            tenantId,
          },
        };
      }),
    checkSlug: publicProcedure
      .input(z.object({ slug: z.string().min(2) }))
      .query(async ({ input }) => {
        const existing = await db.getTenantBySlug(input.slug);
        return { available: !existing };
      }),
    updateSlug: barberProcedure
      .input(z.object({ slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hifens") }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.barber.tenantId;
        if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant não encontrado." });
        const existing = await db.getTenantBySlug(input.slug);
        if (existing && existing.id !== tenantId) {
          throw new TRPCError({ code: "CONFLICT", message: "Este slug já está em uso por outra barbearia." });
        }
        await db.updateTenant(tenantId, { slug: input.slug });
        return { success: true, slug: input.slug };
      }),
    listTenants: publicProcedure.query(async () => {
      return db.getAllTenants();
    }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getTenantById(input.id);
      }),
    nearby: publicProcedure
      .input(z.object({ lat: z.number(), lng: z.number(), radiusKm: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getNearbyTenants(input.lat, input.lng, input.radiusKm ?? 50);
      }),
  }),
  orbit: router({
    registerLogin: publicProcedure
      .input(z.object({
        clientId: z.number(),
        tenantId: z.number(),
        source: z.enum(["link", "geo"]).default("link"),
      }))
      .mutation(async ({ input }) => {
        await db.upsertOrbitLead(input.clientId, input.tenantId, input.source);
        const barbersList = await db.getAllBarbers(input.tenantId);
        const client = await db.getClientById(input.clientId);
        const clientName = client?.name ?? "Novo cliente";
        for (const barber of barbersList) {
          if (barber.pushToken) {
            await db.sendExpoPushNotification(
              barber.pushToken,
              "\uD83D\uDC64 Novo cliente em \u00f3rbita",
              `${clientName} acabou de acessar sua barbearia`,
              { type: "orbit_lead", clientId: input.clientId, tenantId: input.tenantId },
              { channelId: "orbit" }
            );
          }
        }
        return { ok: true };
      }),
    markConverted: publicProcedure
      .input(z.object({ clientId: z.number(), tenantId: z.number() }))
      .mutation(async ({ input }) => {
        await db.markOrbitLeadConverted(input.clientId, input.tenantId);
        return { ok: true };
      }),
    list: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        filter: z.enum(["today", "week", "month"]).default("week"),
        converted: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        return db.listOrbitLeads(input.tenantId, input.filter, input.converted);
      }),
    stats: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return db.getOrbitStats(input.tenantId);
      }),
    dailyChart: publicProcedure
      .input(z.object({ tenantId: z.number(), days: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getOrbitDailyChart(input.tenantId, input.days ?? 30);
      }),
  }),

  subscriptionPlans: subscriptionPlanRouter,
  productOrders: router({
    list: publicProcedure
      .input(z.object({ tenantId: z.number(), status: z.string().optional() }))
      .query(({ input }) => db.getProductOrdersByTenant(input.tenantId, input.status)),
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getProductOrderById(input.id)),
    updateStatus: publicProcedure
      .input(z.object({ id: z.number(), status: z.string(), estimatedDays: z.number().optional(), cancelReason: z.string().optional(), paymentMethod: z.string().optional(), barberId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const extra: { estimatedDays?: number; cancelReason?: string; paymentMethod?: string; barberId?: number } = {};
        if (input.estimatedDays !== undefined) extra.estimatedDays = input.estimatedDays;
        if (input.cancelReason !== undefined) extra.cancelReason = input.cancelReason;
        if (input.paymentMethod !== undefined) extra.paymentMethod = input.paymentMethod;
        if (input.barberId !== undefined) extra.barberId = input.barberId;
        // Buscar dados da encomenda antes de atualizar (para notificação)
        const orderBefore = await db.getProductOrderById(input.id);
        await db.updateProductOrderStatus(input.id, input.status as any, Object.keys(extra).length > 0 ? extra : undefined);

        // Abater estoque ao confirmar pedido
        if (input.status === "confirmed" && orderBefore) {
          try {
            const product = await db.getProductById((orderBefore as any).productId);
            if (product && product.stockQuantity != null && product.stockQuantity > 0) {
              const qty = (orderBefore as any).quantity ?? 1;
              const newStock = Math.max(0, product.stockQuantity - qty);
              await db.updateProduct(product.id, { stockQuantity: newStock });
              console.log(`[productOrders] Estoque "${product.name}": ${product.stockQuantity} → ${newStock}`);
            }
          } catch (stockErr: any) {
            console.error("[productOrders] Erro ao abater estoque:", stockErr.message);
          }
        }
        // Enviar notificação push ao cliente
        if (orderBefore?.clientId) {
          const pushToken = await db.getClientPushToken(orderBefore.clientId);
          if (pushToken) {
            const statusMessages: Record<string, { title: string; body: string }> = {
              confirmed: { title: "✅ Encomenda confirmada", body: `Seu pedido de ${orderBefore.productName ?? "produto"} foi confirmado pela barbearia!${input.estimatedDays ? ` Prazo estimado: ${input.estimatedDays} dias.` : ""}` },
              in_progress: { title: "🔧 Em preparo", body: `Seu pedido de ${orderBefore.productName ?? "produto"} está sendo preparado.` },
              ready: { title: "🎉 Pronto para retirada!", body: `Seu pedido de ${orderBefore.productName ?? "produto"} está pronto! Compareça à barbearia para retirar.` },
              delivered: { title: "📦 Entregue", body: `Seu pedido de ${orderBefore.productName ?? "produto"} foi entregue. Obrigado!` },
              cancelled: { title: "❌ Encomenda cancelada", body: `Seu pedido de ${orderBefore.productName ?? "produto"} foi cancelado.${input.cancelReason ? ` Motivo: ${input.cancelReason}` : ""}` },
            };
            const msg = statusMessages[input.status];
            if (msg) {
              await db.sendExpoPushNotification(pushToken, msg.title, msg.body, { orderId: input.id, screen: "orders" });
            }
          }
        }
        return { ok: true };
      }),
    pendingCount: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const orders = await db.getProductOrdersByTenant(input.tenantId, undefined);
        const pending = (orders as any[]).filter((o) => !["delivered", "cancelled"].includes(o.status));
        return { count: pending.length };
      }),
    myOrders: publicProcedure
      .input(z.object({ clientId: z.number(), tenantId: z.number() }))
      .query(({ input }) => db.getProductOrdersByClient(input.clientId, input.tenantId)),
    cancelByClient: publicProcedure
      .input(z.object({ id: z.number(), clientId: z.number() }))
      .mutation(async ({ input }) => {
        const order = await db.getProductOrderById(input.id);
        if (!order || (order as any).clientId !== input.clientId) throw new Error("Encomenda não encontrada");
        if ((order as any).status !== "received") throw new Error("Apenas encomendas com status 'Recebido' podem ser canceladas pelo cliente");
        await db.updateProductOrderStatus(input.id, "cancelled", { cancelReason: "Cancelado pelo cliente" });
        return { ok: true };
      }),
  }),

  asaasPayments: router({
    createPix: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        clientId: z.number(),
        clientName: z.string(),
        clientEmail: z.string().optional().nullable(),
        clientPhone: z.string().optional().nullable(),
        clientCpf: z.string().optional().nullable(),
        appointmentId: z.number().optional().nullable(),
        amount: z.number(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!asaasEnabled) throw new Error("Pagamento online não configurado. Configure ASAAS_API_KEY.");
        // Buscar asaasApiKey da subconta do tenant (se configurada)
        const dbConn2 = await db.getDb();
        let subAccountApiKey: string | undefined;
        if (dbConn2) {
          const tenantRow = await dbConn2.execute(sql`SELECT "asaasApiKey" FROM tenants WHERE id = ${input.tenantId} LIMIT 1`);
          const tenantData = (tenantRow as any)?.rows?.[0];
          subAccountApiKey = tenantData?.asaasApiKey || undefined;
        }
        const asaasCustomerId = await getOrCreateAsaasCustomer({
          name: input.clientName,
          email: input.clientEmail ?? undefined,
          mobilePhone: input.clientPhone ?? undefined,
          cpfCnpj: input.clientCpf ?? undefined,
          externalReference: String(input.clientId),
        }, subAccountApiKey);
        const charge = await createAsaasCharge({
          customer: asaasCustomerId,
          billingType: "PIX",
          value: input.amount,
          dueDate: asaasDefaultDueDate(),
          description: input.description || "Agendamento Barber Pro",
          externalReference: input.appointmentId ? String(input.appointmentId) : undefined,
        }, subAccountApiKey);
        const dbConn = await db.getDb();
        if (dbConn) {
          await dbConn.execute(sql`
            INSERT INTO online_payments ("tenantId", "clientId", "chargeType", "referenceId", "asaasPaymentId", "asaasCustomerId", "billingType", amount, status, "invoiceUrl", "pixQrCode", "pixCopyCola", "dueDate")
            VALUES (${input.tenantId}, ${input.clientId}, 'appointment', ${input.appointmentId ?? null}, ${charge.id}, ${asaasCustomerId}, 'PIX', ${input.amount}, 'pending', ${charge.invoiceUrl ?? null}, ${charge.pixQrCode ?? null}, ${charge.pixCopyCola ?? null}, ${charge.dueDate})
          `);
        }
        return {
          paymentId: charge.id,
          pixQrCode: charge.pixQrCode ?? null,
          pixCopyCola: charge.pixCopyCola ?? null,
          invoiceUrl: charge.invoiceUrl ?? null,
          value: charge.value,
          dueDate: charge.dueDate,
        };
      }),
    createCard: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        clientId: z.number(),
        clientName: z.string(),
        clientEmail: z.string().optional().nullable(),
        clientPhone: z.string().optional().nullable(),
        clientCpf: z.string(),
        clientAddressNumber: z.string(),
        clientPostalCode: z.string(),
        appointmentId: z.number().optional().nullable(),
        amount: z.number(),
        description: z.string().optional(),
        cardHolderName: z.string(),
        cardNumber: z.string(),
        cardExpMonth: z.string(),
        cardExpYear: z.string(),
        cardCvv: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (!asaasEnabled) throw new Error("Pagamento online não configurado. Configure ASAAS_API_KEY.");
        // Buscar asaasApiKey da subconta do tenant (se configurada)
        const dbConn2 = await db.getDb();
        let subAccountApiKey: string | undefined;
        if (dbConn2) {
          const tenantRow = await dbConn2.execute(sql`SELECT "asaasApiKey" FROM tenants WHERE id = ${input.tenantId} LIMIT 1`);
          const tenantData = (tenantRow as any)?.rows?.[0];
          subAccountApiKey = tenantData?.asaasApiKey || undefined;
        }
        const asaasCustomerId = await getOrCreateAsaasCustomer({
          name: input.clientName,
          email: input.clientEmail ?? undefined,
          mobilePhone: input.clientPhone ?? undefined,
          cpfCnpj: input.clientCpf,
          externalReference: String(input.clientId),
          addressNumber: input.clientAddressNumber,
          postalCode: input.clientPostalCode,
        }, subAccountApiKey);
        const charge = await createAsaasCharge({
          customer: asaasCustomerId,
          billingType: "CREDIT_CARD",
          value: input.amount,
          dueDate: asaasDefaultDueDate(),
          description: input.description || "Agendamento Barber Pro",
          externalReference: input.appointmentId ? String(input.appointmentId) : undefined,
          creditCard: {
            holderName: input.cardHolderName,
            number: input.cardNumber.replace(/\s/g, ""),
            expiryMonth: input.cardExpMonth,
            expiryYear: input.cardExpYear,
            ccv: input.cardCvv,
          },
          creditCardHolderInfo: {
            name: input.cardHolderName,
            email: input.clientEmail || "cliente@barberpro.com",
            cpfCnpj: input.clientCpf.replace(/\D/g, ""),
            postalCode: input.clientPostalCode.replace(/\D/g, ""),
            addressNumber: input.clientAddressNumber,
            phone: input.clientPhone?.replace(/\D/g, "") || "",
          },
        });
        const dbConn = await db.getDb();
        if (dbConn) {
          await dbConn.execute(sql`
            INSERT INTO online_payments ("tenantId", "clientId", "chargeType", "referenceId", "asaasPaymentId", "asaasCustomerId", "billingType", amount, status, "invoiceUrl", "dueDate")
            VALUES (${input.tenantId}, ${input.clientId}, 'appointment', ${input.appointmentId ?? null}, ${charge.id}, ${asaasCustomerId}, 'CREDIT_CARD', ${input.amount}, ${charge.status ?? 'pending'}, ${charge.invoiceUrl ?? null}, ${charge.dueDate})
          `);
        }
        return {
          paymentId: charge.id,
          status: charge.status,
          invoiceUrl: charge.invoiceUrl ?? null,
          value: charge.value,
        };
      }),
    checkStatus: publicProcedure
      .input(z.object({ paymentId: z.string() }))
      .query(async ({ input }) => {
        const r = await asaasApi.get(`/payments/${input.paymentId}`);
        return { status: r.data.status as string };
      }),
    listByTenant: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) return [];
        const { tenantId, startDate, endDate, status } = input;
        const rows = status && status !== "all"
          ? await dbConn.execute(sql`
              SELECT op.id, op."billingType", op.amount, op.status, op."dueDate", op."createdAt", op."paidAt",
                     op."invoiceUrl", op."chargeType", op."referenceId", op."asaasPaymentId",
                     c.name AS "clientName", c.phone AS "clientPhone"
              FROM online_payments op
              LEFT JOIN clients c ON c.id = op."clientId"
              WHERE op."tenantId" = ${tenantId}
                AND (${startDate ?? null} IS NULL OR DATE(op."createdAt") >= ${startDate ?? null})
                AND (${endDate ?? null} IS NULL OR DATE(op."createdAt") <= ${endDate ?? null})
                AND op.status = ${status}
              ORDER BY op."createdAt" DESC LIMIT 200
            `)
          : await dbConn.execute(sql`
              SELECT op.id, op."billingType", op.amount, op.status, op."dueDate", op."createdAt", op."paidAt",
                     op."invoiceUrl", op."chargeType", op."referenceId", op."asaasPaymentId",
                     c.name AS "clientName", c.phone AS "clientPhone"
              FROM online_payments op
              LEFT JOIN clients c ON c.id = op."clientId"
              WHERE op."tenantId" = ${tenantId}
                AND (${startDate ?? null} IS NULL OR DATE(op."createdAt") >= ${startDate ?? null})
                AND (${endDate ?? null} IS NULL OR DATE(op."createdAt") <= ${endDate ?? null})
              ORDER BY op."createdAt" DESC LIMIT 200
            `);
        return ((rows as any).rows as any[]).map((p: any) => ({
          id: p.id,
          billingType: p.billingType ?? "PIX",
          amount: parseFloat(p.amount ?? "0"),
          status: p.status ?? "pending",
          dueDate: p.dueDate,
          createdAt: p.createdAt,
          paidAt: p.paidAt ?? null,
          invoiceUrl: p.invoiceUrl ?? null,
          asaasPaymentId: p.asaasPaymentId ?? null,
          clientName: p.clientName ?? "—",
          clientPhone: p.clientPhone ?? null,
        }));
      }),
    listOverdue: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) return [];
        const rows = await dbConn.execute(sql`
          SELECT op.id, op."billingType", op.amount, op.status, op."dueDate", op."createdAt",
                 op."invoiceUrl", op."asaasPaymentId",
                 c.name AS "clientName", c.phone AS "clientPhone"
          FROM online_payments op
          LEFT JOIN clients c ON c.id = op."clientId"
          WHERE op."tenantId" = ${input.tenantId}
            AND op.status = 'overdue'
          ORDER BY op."dueDate" ASC LIMIT 100
        `);
        return ((rows as any).rows as any[]).map((p: any) => ({
          id: p.id,
          billingType: p.billingType ?? "PIX",
          amount: parseFloat(p.amount ?? "0"),
          status: "overdue",
          dueDate: p.dueDate,
          createdAt: p.createdAt,
          invoiceUrl: p.invoiceUrl ?? null,
          asaasPaymentId: p.asaasPaymentId ?? null,
          clientName: p.clientName ?? "—",
          clientPhone: p.clientPhone ?? null,
        }));
      }),
    cancelCharge: publicProcedure
      .input(z.object({ asaasPaymentId: z.string(), tenantId: z.number() }))
      .mutation(async ({ input }) => {
        if (asaasEnabled) {
          try { await asaasApi.delete(`/payments/${input.asaasPaymentId}`); } catch {}
        }
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("DB unavailable");
        await dbConn.execute(sql`UPDATE online_payments SET status = 'cancelled', "updatedAt" = NOW() WHERE "asaasPaymentId" = ${input.asaasPaymentId} AND "tenantId" = ${input.tenantId}`);
        return { ok: true };
      }),
    getPaymentLink: publicProcedure
      .input(z.object({ appointmentId: z.number(), tenantId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) return null;
        const rows = await dbConn.execute(sql`
          SELECT "invoiceUrl", "pixCopyCola", status
          FROM online_payments
          WHERE "referenceId" = ${String(input.appointmentId)} AND "tenantId" = ${input.tenantId}
          ORDER BY "createdAt" DESC LIMIT 1
        `);
        const p = ((rows as any).rows as any[])[0];
        if (!p) return null;
        return {
          invoiceUrl: p.invoiceUrl ?? null,
          pixCopyCola: p.pixCopyCola ?? null,
          status: p.status ?? "pending",
        };
      }),

    // ─── Configuração de Subconta Asaas ──────────────────────────────────────
    getSubAccountStatus: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) return null;
        const rows = await dbConn.execute(sql`
          SELECT "asaasAccountId", "asaasWalletId", "asaasAccountStatus",
                 "asaasCpfCnpj", "asaasCompanyType", "asaasMobilePhone", "asaasBirthDate"
          FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const t = ((rows as any).rows as any[])[0];
        if (!t) return null;
        return {
          accountId: t.asaasAccountId ?? null,
          walletId: t.asaasWalletId ?? null,
          status: t.asaasAccountStatus ?? "not_configured",
          cpfCnpj: t.asaasCpfCnpj ?? null,
          companyType: t.asaasCompanyType ?? null,
          mobilePhone: t.asaasMobilePhone ?? null,
          birthDate: t.asaasBirthDate ?? null,
        };
      }),

    setupSubAccount: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        name: z.string().min(2),
        email: z.string().email(),
        cpfCnpj: z.string().min(11).max(18),
        companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).optional(),
        mobilePhone: z.string().min(10),
        birthDate: z.string().optional(), // YYYY-MM-DD
        address: z.string().optional(),
        addressNumber: z.string().optional(),
        province: z.string().optional(),
        postalCode: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!asaasEnabled) throw new Error("ASAAS_API_KEY não configurada no servidor.");
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("DB unavailable");

        // Verificar se já tem subconta configurada
        const existing = await dbConn.execute(sql`
          SELECT "asaasAccountId", "asaasAccountStatus" FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const existingTenant = ((existing as any).rows as any[])[0];
        if (existingTenant?.asaasAccountId && existingTenant?.asaasAccountStatus === "active") {
          return { ok: true, message: "Subconta já configurada e ativa.", alreadyExists: true };
        }

        // Criar subconta no Asaas
        const subAccount = await createAsaasSubAccount({
          name: input.name,
          email: input.email,
          cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
          companyType: input.companyType,
          mobilePhone: input.mobilePhone.replace(/\D/g, ""),
          birthDate: input.birthDate,
          address: input.address,
          addressNumber: input.addressNumber,
          province: input.province,
          postalCode: input.postalCode?.replace(/\D/g, ""),
        });

        // Salvar credenciais no banco
        await dbConn.execute(sql`
          UPDATE tenants SET
            "asaasAccountId" = ${subAccount.id},
            "asaasApiKey" = ${subAccount.apiKey},
            "asaasWalletId" = ${subAccount.walletId},
            "asaasAccountStatus" = 'pending',
            "asaasCpfCnpj" = ${input.cpfCnpj},
            "asaasCompanyType" = ${input.companyType ?? null},
            "asaasMobilePhone" = ${input.mobilePhone},
            "asaasBirthDate" = ${input.birthDate ?? null},
            "updatedAt" = NOW()
          WHERE id = ${input.tenantId}
        `);

        return {
          ok: true,
          accountId: subAccount.id,
          walletId: subAccount.walletId,
          message: "Subconta criada com sucesso. Aguardando aprovação do Asaas.",
          alreadyExists: false,
        };
      }),

     syncSubAccountStatus: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("DB unavailable");
        const rows = await dbConn.execute(sql`
          SELECT "asaasAccountId" FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const tenant = ((rows as any).rows as any[])[0];
        if (!tenant?.asaasAccountId) throw new Error("Subconta não configurada.");
        const accountData = await getAsaasSubAccount(tenant.asaasAccountId);
        const status = accountData.commercialInfo?.status ?? "pending";
        const normalizedStatus = status === "APPROVED" ? "active" : status === "REJECTED" ? "rejected" : "pending";
        await dbConn.execute(sql`
          UPDATE tenants SET "asaasAccountStatus" = ${normalizedStatus}, "updatedAt" = NOW()
          WHERE id = ${input.tenantId}
        `);
        return { status: normalizedStatus };
      }),

    // ─── Assinatura Barber Pro ────────────────────────────────────────────────
    createBarberproSubscription: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        planName: z.string(),           // 'solo' | 'team' | 'studio'
        planPrice: z.number(),          // valor em reais
        billingType: z.enum(["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"]).default("PIX"),
        ownerName: z.string(),
        ownerEmail: z.string().email(),
        ownerCpfCnpj: z.string().min(11),
        ownerMobilePhone: z.string().optional(),
        // Dados opcionais de cartão de crédito/débito
        cardNumber: z.string().optional(),
        cardExpiryMonth: z.string().optional(),
        cardExpiryYear: z.string().optional(),
        cardCvv: z.string().optional(),
        cardHolder: z.string().optional(),
        cardCpf: z.string().optional(),
        cardCep: z.string().optional(),
        cardAddrNum: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!asaasEnabled) throw new Error("ASAAS_API_KEY não configurada.");
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("DB unavailable");

        // Validar CPF/CNPJ com dígitos verificadores
        const cpfCnpjDigits = input.ownerCpfCnpj.replace(/\D/g, "");
        const isValidCpfCnpj = (() => {
          const d = cpfCnpjDigits;
          if (d.length === 11) {
            if (/^(\d)\1{10}$/.test(d)) return false;
            let s = 0; for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
            let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
            if (r !== parseInt(d[9])) return false;
            s = 0; for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
            r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
            return r === parseInt(d[10]);
          }
          if (d.length === 14) {
            if (/^(\d)\1{13}$/.test(d)) return false;
            const calc = (str: string, w: number[]) => { let s = 0; for (let i = 0; i < w.length; i++) s += parseInt(str[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
            if (calc(d, [5,4,3,2,9,8,7,6,5,4,3,2]) !== parseInt(d[12])) return false;
            return calc(d, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(d[13]);
          }
          return false;
        })();
        if (!isValidCpfCnpj) {
          throw new Error(cpfCnpjDigits.length === 11 ? "CPF inválido. Verifique os dígitos." : "CNPJ inválido. Verifique os dígitos.");
        }

        // Verificar se já tem assinatura ativa
        const existing = await dbConn.execute(sql`
          SELECT "barberproSubscriptionId", "barberproSubscriptionStatus"
          FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const existingTenant = ((existing as any).rows as any[])[0];
        if (existingTenant?.barberproSubscriptionId && existingTenant?.barberproSubscriptionStatus === "active") {
          return { ok: true, message: "Assinatura já ativa.", alreadyExists: true };
        }

        // Criar ou buscar cliente na conta raiz do Asaas
        const customerId = await ensureAsaasRootCustomer({
          name: input.ownerName,
          email: input.ownerEmail,
          cpfCnpj: input.ownerCpfCnpj,
          mobilePhone: input.ownerMobilePhone,
          tenantId: input.tenantId,
        });

        // Calcular próximo vencimento (amanhã)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextDueDate = tomorrow.toISOString().split("T")[0];

        // Montar dados de cartão se fornecidos
        const isCard = input.billingType === "CREDIT_CARD" || input.billingType === "UNDEFINED";
        const creditCard = isCard && input.cardNumber ? {
          holderName: input.cardHolder ?? input.ownerName,
          number: input.cardNumber.replace(/\D/g, ""),
          expiryMonth: input.cardExpiryMonth ?? "",
          expiryYear: input.cardExpiryYear ?? "",
          ccv: input.cardCvv ?? "",
        } : undefined;
        const creditCardHolderInfo = isCard && input.cardNumber ? {
          name: input.cardHolder ?? input.ownerName,
          email: input.ownerEmail,
          cpfCnpj: (input.cardCpf ?? input.ownerCpfCnpj).replace(/\D/g, ""),
          postalCode: (input.cardCep ?? "").replace(/\D/g, ""),
          addressNumber: input.cardAddrNum ?? "",
          phone: input.ownerMobilePhone ?? "",
        } : undefined;
        const remoteIp = (ctx as any)?.req?.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim()
          ?? (ctx as any)?.req?.socket?.remoteAddress
          ?? "127.0.0.1";

        // Criar assinatura recorrente mensal
        const subResult = await createAsaasSubscription({
          customer: customerId,
          billingType: input.billingType as "PIX" | "CREDIT_CARD" | "UNDEFINED",
          value: input.planPrice,
          nextDueDate,
          cycle: "MONTHLY",
          description: `Barber Pro — Plano ${input.planName}`,
          externalReference: `tenant_${input.tenantId}`,
          ...(creditCard ? { creditCard } : {}),
          ...(creditCardHolderInfo ? { creditCardHolderInfo } : {}),
          ...(isCard ? { remoteIp } : {}),
        });
        const subscriptionId = subResult.subscriptionId;

        // Salvar no banco
        await dbConn.execute(sql`
          UPDATE tenants SET
            "barberproSubscriptionId" = ${subscriptionId},
            "barberproSubscriptionStatus" = 'pending',
            "barberproPlanName" = ${input.planName},
            "barberproPlanPrice" = ${input.planPrice},
            "barberproNextDueDate" = ${nextDueDate}::DATE,
            "barberproAsaasCustomerId" = ${customerId},
            "updatedAt" = NOW()
          WHERE id = ${input.tenantId}
        `);

        // Enviar e-mail de confirmação com código Pix (se Pix)
        if (input.billingType === "PIX" && subResult.pixCopyCola && input.ownerEmail) {
          import("./email").then(({ sendEmail, emailLayout, alertBox, ctaButton, detailRow }) => {
            const planLabels: Record<string, string> = { solo: "Solo", team: "Equipe", studio: "Estúdio" };
            const planPrices: Record<string, string> = { solo: "R$ 49/mês", team: "R$ 89/mês", studio: "R$ 149/mês" };
            const planLabel = planLabels[input.planName.toLowerCase()] ?? input.planName;
            const planPrice = planPrices[input.planName.toLowerCase()] ?? `R$ ${input.planPrice}/mês`;
            const pixCode = subResult.pixCopyCola!;

            const body = `
              <h2 style="margin:0 0 8px;font-size:22px;color:#C9A84C">Finalize seu pagamento via Pix</h2>
              <p style="margin:0 0 20px;color:#9BA1A6;font-size:15px">
                Olá, ${input.ownerName}! Sua assinatura do <strong>Barber Pro</strong> foi criada com sucesso.
                Realize o pagamento via Pix para ativar seu acesso.
              </p>
              ${detailRow("Plano", planLabel)}
              ${detailRow("Valor", planPrice)}
              ${detailRow("Vencimento", nextDueDate)}
              ${alertBox("warning", `
                <strong>Pix Copia e Cola</strong><br/>
                <span style="font-family:monospace;font-size:12px;word-break:break-all;color:#ECEDEE">${pixCode}</span>
              `)}
              <p style="margin:16px 0 8px;color:#9BA1A6;font-size:13px">
                Copie o código acima e cole no app do seu banco para pagar. O acesso será liberado automaticamente após a confirmação.
              </p>
              <p style="margin:0;color:#687076;font-size:12px">
                ⚠️ O código Pix expira em 30 minutos. Se expirar, acesse o sistema e gere um novo código.
              </p>
            `;
            sendEmail({
              to: input.ownerEmail,
              subject: `💳 Barber Pro — Pague via Pix para ativar o Plano ${planLabel}`,
              html: emailLayout(body, {
                title: "Pagamento Pix — Barber Pro",
                previewText: `Seu código Pix para ativar o Plano ${planLabel} do Barber Pro`,
              }),
            }).catch(() => {});
          }).catch(() => {});
        }

        return {
          ok: true,
          subscriptionId,
          customerId,
          nextDueDate,
          message: `Assinatura criada. Primeira cobrança em ${nextDueDate}.`,
          alreadyExists: false,
          // Dados do QR Code Pix (presentes apenas quando billingType === 'PIX')
          pixQrCode: subResult.pixQrCode ?? null,
          pixCopyCola: subResult.pixCopyCola ?? null,
          pixPaymentId: subResult.pixPaymentId ?? null,
          invoiceUrl: subResult.invoiceUrl ?? null,
        };
      }),

    getBarberproSubscription: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) return null;
        const rows = await dbConn.execute(sql`
          SELECT "barberproSubscriptionId", "barberproSubscriptionStatus",
                 "barberproPlanName", "barberproPlanPrice",
                 "barberproNextDueDate", "barberproAsaasCustomerId", "barberproTrialEndsAt"
          FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const t = ((rows as any).rows as any[])[0];
        if (!t) return null;
        return {
          subscriptionId: t.barberproSubscriptionId ?? null,
          status: t.barberproSubscriptionStatus ?? "trial",
          planName: t.barberproPlanName ?? "starter",
          planPrice: t.barberproPlanPrice ? parseFloat(t.barberproPlanPrice) : 0,
          nextDueDate: t.barberproNextDueDate ?? null,
          customerId: t.barberproAsaasCustomerId ?? null,
          trialEndsAt: t.barberproTrialEndsAt ?? null,
        };
      }),

    syncBarberproSubscription: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("DB unavailable");
        const rows = await dbConn.execute(sql`
          SELECT "barberproSubscriptionId" FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const tenant = ((rows as any).rows as any[])[0];
        if (!tenant?.barberproSubscriptionId) throw new Error("Assinatura não encontrada.");
        const sub = await getAsaasSubscriptionStatus(tenant.barberproSubscriptionId);
        // ACTIVE = ativa, INACTIVE = cancelada, EXPIRED = expirada
        const statusMap: Record<string, string> = {
          ACTIVE: "active",
          INACTIVE: "cancelled",
          EXPIRED: "expired",
          OVERDUE: "overdue",
        };
        const normalizedStatus = statusMap[sub.status] ?? "pending";
        await dbConn.execute(sql`
          UPDATE tenants SET
            "barberproSubscriptionStatus" = ${normalizedStatus},
            "barberproNextDueDate" = ${sub.nextDueDate}::DATE,
            "updatedAt" = NOW()
          WHERE id = ${input.tenantId}
        `);
        return { status: normalizedStatus, nextDueDate: sub.nextDueDate };
      }),

    getBarberproPaymentLink: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        if (!asaasEnabled) return null;
        const dbConn = await db.getDb();
        if (!dbConn) return null;
        const rows = await dbConn.execute(sql`
          SELECT "barberproSubscriptionId" FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const tenant = ((rows as any).rows as any[])[0];
        if (!tenant?.barberproSubscriptionId) return null;
        try {
          const paymentsRes = await asaasApi.get(`/subscriptions/${tenant.barberproSubscriptionId}/payments?limit=1`);
          const firstPayment = paymentsRes.data?.data?.[0];
          if (!firstPayment) return null;
          if (firstPayment.invoiceUrl) return { paymentLink: firstPayment.invoiceUrl as string, type: 'invoice' as const, pixQrCode: null, pixCopyCola: null };
          if (firstPayment.id) {
            const pixRes = await asaasApi.get(`/payments/${firstPayment.id}/pixQrCode`);
            if (pixRes.data?.encodedImage) {
              return { paymentLink: null, type: 'pix' as const, pixQrCode: pixRes.data.encodedImage as string, pixCopyCola: pixRes.data.payload as string };
            }
          }
          return null;
        } catch (e: any) {
          console.warn('[getBarberproPaymentLink]', e.message);
          return null;
        }
      }),
    cancelBarberproSubscription: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("DB unavailable");
        const rows = await dbConn.execute(sql`
          SELECT "barberproSubscriptionId" FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const tenant = ((rows as any).rows as any[])[0];
        if (!tenant?.barberproSubscriptionId) throw new Error("Assinatura não encontrada.");
        await cancelAsaasSubscription(tenant.barberproSubscriptionId);
        await dbConn.execute(sql`
          UPDATE tenants SET
            "barberproSubscriptionStatus" = 'cancelled',
            "updatedAt" = NOW()
          WHERE id = ${input.tenantId}
        `);
        return { ok: true };
      }),

    upgradeBarberproSubscription: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        newPlan: z.enum(['solo', 'team', 'studio']),
      }))
      .mutation(async ({ input }) => {
        if (!asaasEnabled) throw new Error('ASAAS_API_KEY não configurada.');
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error('DB unavailable');

        const planPriceMap: Record<string, number> = { solo: 49, team: 89, studio: 149 };
        const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };
        const newPrice = planPriceMap[input.newPlan];
        const newLabel = planLabelMap[input.newPlan];

        // Buscar dados do tenant
        const tenantRows = await dbConn.execute(sql`
          SELECT "barberproSubscriptionId", "barberproAsaasCustomerId",
                 "asaasMobilePhone", phone, name, cnpj
          FROM tenants WHERE id = ${input.tenantId} LIMIT 1
        `);
        const tenantData = ((tenantRows as any).rows as any[])[0];
        if (!tenantData) throw new Error('Tenant não encontrado.');

        // 1. Cancelar assinatura atual
        if (tenantData.barberproSubscriptionId) {
          try { await cancelAsaasSubscription(tenantData.barberproSubscriptionId); } catch {}
        }

        // 2. Garantir customer Asaas
        const asaasCustomerId = await ensureAsaasCustomer({
          name: tenantData.name ?? 'Cliente',
          cpfCnpj: tenantData.cnpj ?? '',
          mobilePhone: (tenantData.asaasMobilePhone ?? tenantData.phone ?? '').replace(/\D/g, ''),
          tenantId: input.tenantId,
        });

        // 3. Criar nova assinatura
        const today = new Date();
        const nextDue = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()).toISOString().slice(0, 10);
        const newSubResult = await createAsaasSubscription({
          customer: asaasCustomerId,
          billingType: 'PIX',
          value: newPrice,
          nextDueDate: nextDue,
          cycle: 'MONTHLY',
          description: `Barber Pro — Plano ${newLabel} (R$ ${newPrice}/mês)`,
          externalReference: `tenant_${input.tenantId}`,
        });
        const newSubId = newSubResult.subscriptionId;

        // 4. Atualizar banco via Drizzle ORM (evita cast de enum incorreto)
        await db.updateTenant(input.tenantId, {
          plan: input.newPlan as any,
          barberproSubscriptionId: newSubId,
          barberproSubscriptionStatus: 'pending',
          barberproPlanName: newLabel,
          barberproPlanPrice: String(newPrice),
          barberproNextDueDate: nextDue,
          updatedAt: new Date(),
        });

        return {
          paymentLink: newSubResult.invoiceUrl ?? null,
          pixQrCode: newSubResult.pixQrCode ?? null,
          pixCopyCola: newSubResult.pixCopyCola ?? null,
          pixPaymentId: newSubResult.pixPaymentId ?? null,
        };
      }),
  }),
  suppliers: router({
    list: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(({ input }) => db.getSuppliersByTenant(input.tenantId)),
    create: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        cnpj: z.string().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => db.createSupplier(input as any)),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        cnpj: z.string().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateSupplier(id, data as any);
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteSupplier(input.id)),
    products: publicProcedure
      .input(z.object({ supplierId: z.number(), tenantId: z.number().optional() }))
      .query(({ input }) => db.getProductsBySupplier(input.supplierId, input.tenantId)),
    history: publicProcedure
      .input(z.object({ supplierId: z.number(), tenantId: z.number(), limit: z.number().optional() }))
      .query(({ input }) => db.getStockMovementsBySupplier(input.supplierId, input.tenantId, input.limit)),
  }),

  // ─── Suporte Interno ─────────────────────────────────────────────────────────
  support: router({
    createTicket: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        title: z.string().min(5).max(255),
        category: z.string().default('other'),
        priority: z.string().optional(),
        firstMessage: z.string().min(10),
        authorName: z.string().optional(),
        authorEmail: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        const ticketId = await db.createSupportTicket(input);

        // IA de primeira resposta (assíncrono, não bloqueia o cliente)
        (async () => {
          try {
            const KNOWLEDGE_BASE = `
Você é o assistente de suporte do Barber Pro, sistema de gestão para barbearias.

Base de conhecimento:
- Agendamento: o app permite agendar, cancelar e reagendar. Conflitos são bloqueados automaticamente.
- Financeiro: controle de caixa, comissões, relatórios de faturamento.
- Estoque: controle de produtos para venda e uso interno.
- Fidelidade: programa de pontos configurável.
- WhatsApp: confirmações e lembretes automáticos via Z-API.
- Planos: Solo (1 barbeiro), Equipe (5 barbeiros), Studio (ilimitado).
- Pagamentos: Asaas (cartão, Pix).
- Suporte: responda de forma clara, objetiva e amigável em português.
- Se não souber a resposta, diga que a equipe de suporte entrará em contato em breve.
`;
            const aiResp = await invokeLLM({
              messages: [
                { role: 'system', content: KNOWLEDGE_BASE },
                { role: 'user', content: `Título: ${input.title}\nCategoria: ${input.category}\nMensagem: ${input.firstMessage}` },
              ],
            });
            const aiText = typeof aiResp === 'string' ? aiResp : (aiResp as any)?.choices?.[0]?.message?.content ?? '';
            if (aiText && aiText.length > 10) {
              await db.addSupportMessage({
                ticketId,
                authorType: 'ai',
                authorName: 'IA Assistente',
                content: aiText,
              });
              await db.updateTicketStatus(ticketId, 'answered');
              // Notificar cliente por e-mail se tiver e-mail
              if (input.authorEmail) {
                const ticket = await db.getSupportTicketById(ticketId);
                await sendSupportReplyNotificationEmail({
                  clientEmail: input.authorEmail,
                  clientName: input.authorName ?? 'Cliente',
                  ticketId,
                  ticketTitle: ticket?.title ?? input.title,
                  replyContent: aiText,
                  isAI: true,
                });
              }
            }
          } catch (e) {
            console.error('[support-ai] Erro na resposta automática:', e);
          }

          // Notificar admin por e-mail
          try {
            const tenant = await db.getTenantById(input.tenantId);
            const adminEmail = process.env.SUPPORT_ADMIN_EMAIL ?? process.env.SMTP_USER;
            if (adminEmail) {
              await sendSupportTicketNotificationEmail({
                adminEmail,
                ticketId,
                ticketTitle: input.title,
                tenantName: tenant?.name ?? `Tenant #${input.tenantId}`,
                category: input.category,
                priority: input.priority ?? 'normal',
                firstMessage: input.firstMessage,
              });
            }
          } catch (e) {
            console.error('[support-email] Erro ao notificar admin:', e);
          }
        })();

        return { ticketId };
      }),

    getMyTickets: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(({ input }) => db.getSupportTicketsByTenant(input.tenantId)),

    getTicketMessages: publicProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(({ input }) => db.getSupportMessages(input.ticketId)),

    getTicketById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getSupportTicketById(input.id)),

    sendMessage: publicProcedure
      .input(z.object({
        ticketId: z.number(),
        content: z.string().min(1),
        authorName: z.string().optional(),
        authorEmail: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.addSupportMessage({
          ticketId: input.ticketId,
          authorType: 'client',
          authorName: input.authorName,
          content: input.content,
        });
        await db.updateTicketStatus(input.ticketId, 'waiting_admin');
        return { ok: true };
      }),

    closeTicket: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateTicketStatus(input.id, 'closed');
        return { ok: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
