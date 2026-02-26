import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import crypto from "crypto";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";

function getMpClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN não configurado");
  return new MercadoPagoConfig({ accessToken });
}

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

let bcrypt: any;
try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }

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
        return { id: barber.id, name: barber.name, email: barber.email, phone: barber.phone, photoUrl: barber.photoUrl, role: barber.role, specialties: barber.specialties };
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
    checkSetup: publicProcedure.query(async () => {
      const allBarbers = await db.getAllBarbers();
      return { hasAdmin: allBarbers.some((b: any) => b.role === "super_admin") };
    }),
  }),

  barbers: router({
    list: publicProcedure.query(() => db.getAllBarbers()),
    listAll: publicProcedure.query(() => db.getAllBarbersIncludingInactive()),
    reactivate: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.reactivateBarber(input.id)),
    create: publicProcedure
      .input(z.object({ name: z.string().min(2), email: z.string().email().optional(), phone: z.string().optional(), password: z.string().min(6), role: z.enum(["super_admin", "barber", "receptionist"]).default("barber"), specialties: z.string().optional(), tenantId: z.number().optional().nullable() }))
      .mutation(async ({ input }) => {
        // Validação de limite de barbeiros por plano
        if (input.tenantId != null) {
          const tenant = await db.getTenantById(input.tenantId);
          if (tenant) {
            const limits: Record<string, number> = { solo: 1, team: 5, studio: Infinity };
            const limit = limits[tenant.plan] ?? Infinity;
            if (limit !== Infinity) {
              const existing = await db.getAllBarbersIncludingInactive(input.tenantId);
              const activeBarbers = existing.filter((b) => b.isActive);
              if (activeBarbers.length >= limit) {
                const planNames: Record<string, string> = { solo: "Solo (máx. 1 barbeiro)", team: "Equipe (máx. 5 barbeiros)" };
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: `Limite de barbeiros atingido para o plano ${planNames[tenant.plan] ?? tenant.plan}. Faça upgrade do plano para adicionar mais profissionais.`,
                });
              }
            }
          }
        }
        const passwordHash = await hashPassword(input.password);
        return db.createBarber({ ...input, passwordHash, isActive: true });
      }),
    update: publicProcedure
      .input(z.object({ id: z.number(), name: z.string().min(2).optional(), email: z.string().email().optional().nullable(), phone: z.string().optional().nullable(), photoUrl: z.string().optional().nullable(), role: z.enum(["super_admin", "barber", "receptionist"]).optional(), specialties: z.string().optional().nullable(), isActive: z.boolean().optional(), password: z.string().min(6).optional() }))
      .mutation(async ({ input }) => {
        const { id, password, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (password) updateData.passwordHash = await hashPassword(password);
        await db.updateBarber(id, updateData as any);
        return { success: true };
      }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteBarber(input.id)),
    savePushToken: publicProcedure
      .input(z.object({ barberId: z.number(), pushToken: z.string() }))
      .mutation(({ input }) => db.saveBarberPushToken(input.barberId, input.pushToken)),
    workingHours: router({
      get: publicProcedure.input(z.object({ barberId: z.number() })).query(({ input }) => db.getWorkingHours(input.barberId)),
      upsert: publicProcedure
        .input(z.object({ barberId: z.number(), dayOfWeek: z.number().min(0).max(6), startTime: z.string(), endTime: z.string(), lunchStart: z.string().optional().nullable(), lunchEnd: z.string().optional().nullable(), isWorking: z.boolean() }))
        .mutation(({ input }) => { const { barberId, dayOfWeek, ...data } = input; return db.upsertWorkingHours(barberId, dayOfWeek, data); }),
    }),
  }),

  clients: router({
    list: publicProcedure.query(() => db.getAllClients()),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getClientById(input.id)),
    create: publicProcedure
      .input(z.object({ name: z.string().min(2), phone: z.string().min(8), email: z.string().email().optional().nullable(), birthDate: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
      .mutation(({ input }) => db.createClient({ ...input, isActive: true })),
    update: publicProcedure
      .input(z.object({ id: z.number(), name: z.string().min(2).optional(), phone: z.string().min(8).optional(), email: z.string().email().optional().nullable(), birthDate: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateClient(id, data); }),
    appointments: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) => db.getClientAppointments(input.clientId)),
    sales: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) => db.getClientSales(input.clientId)),
    birthdayToday: publicProcedure.query(async () => {
      const allClients = await db.getAllClients();
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();
      return allClients.filter((c: any) => {
        if (!c.birthDate) return false;
        const parts = c.birthDate.split("-");
        return parseInt(parts[1], 10) === todayMonth && parseInt(parts[2], 10) === todayDay;
      });
    }),
    birthdayThisMonth: publicProcedure.query(async () => {
      const allClients = await db.getAllClients();
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
    create: publicProcedure.input(z.object({ name: z.string().min(1), type: z.enum(["service", "product"]) })).mutation(({ input }) => db.createCategory(input.name, input.type)),
  }),

  services: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllServices(input.activeOnly, input.tenantId)),
    listWithMedia: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllServicesWithMedia(input.activeOnly, input.tenantId)),
    listWithMediaAndRatings: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllServicesWithMediaAndRatings(input.activeOnly, input.tenantId)),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getServiceById(input.id)),
    create: publicProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional().nullable(), price: z.string(), durationMinutes: z.number().min(5), categoryId: z.number().optional().nullable(), isActive: z.boolean().default(true) }))
      .mutation(({ input }) => db.createService(input as any)),
    update: publicProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), description: z.string().optional().nullable(), price: z.string().optional(), durationMinutes: z.number().min(5).optional(), categoryId: z.number().optional().nullable(), isActive: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateService(id, data as any); }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteService(input.id)),
    media: router({
      list: publicProcedure.input(z.object({ serviceId: z.number() })).query(({ input }) => db.getMediaByEntity("service", input.serviceId)),
      delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteMediaFile(input.id)),
    }),
  }),

  products: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllProducts(input.activeOnly, input.tenantId)),
    listWithMedia: publicProcedure.input(z.object({ activeOnly: z.boolean().optional(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllProductsWithMedia(input.activeOnly, input.tenantId)),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getProductById(input.id)),
    create: publicProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional().nullable(), price: z.string(), stock: z.number().min(0).default(0), categoryId: z.number().optional().nullable(), isActive: z.boolean().default(true) }))
      .mutation(({ input }) => db.createProduct(input as any)),
    update: publicProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), description: z.string().optional().nullable(), price: z.string().optional(), stock: z.number().min(0).optional(), categoryId: z.number().optional().nullable(), isActive: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateProduct(id, data as any); }),
    media: router({
      list: publicProcedure.input(z.object({ productId: z.number() })).query(({ input }) => db.getMediaByEntity("product", input.productId)),
      delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteMediaFile(input.id)),
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
    allByDate: publicProcedure.input(z.object({ date: z.string(), tenantId: z.number().optional().nullable() })).query(({ input }) => db.getAllAppointmentsByDate(input.date, input.tenantId)),
    nextByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) => db.getNextClientAppointment(input.clientId)),
    byDateRange: publicProcedure.input(z.object({ barberId: z.number(), startDate: z.string(), endDate: z.string() })).query(({ input }) => db.getAppointmentsByDateRange(input.barberId, input.startDate, input.endDate)),
    checkAvailability: publicProcedure
      .input(z.object({ barberId: z.number(), date: z.string(), startTime: z.string(), endTime: z.string(), excludeId: z.number().optional() }))
      .query(({ input }) => db.checkSlotAvailability(input.barberId, input.date, input.startTime, input.endTime, input.excludeId)),
    create: publicProcedure
      .input(z.object({ clientId: z.number(), barberId: z.number(), serviceId: z.number(), date: z.string(), startTime: z.string(), endTime: z.string(), notes: z.string().optional().nullable(), status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).default("confirmed") }))
      .mutation(async ({ input }) => {
        const available = await db.checkSlotAvailability(input.barberId, input.date, input.startTime, input.endTime);
        if (!available) throw new Error("Horário não disponível. Por favor, escolha outro horário.");
        // Confirma automaticamente (sem etapa de confirmação manual)
        const apptId = await db.createAppointment({ ...input, status: "confirmed" } as any);
        // Notifica o barbeiro via Expo Push (server-side, funciona com app fechado)
        const pushToken = await db.getBarberPushToken(input.barberId);
        if (pushToken) {
          const client = await db.getClientById(input.clientId);
          const service = await db.getServiceById(input.serviceId);
          const clientName = client?.name ?? "Cliente";
          const serviceName = service?.name ?? "Serviço";
          await db.sendExpoPushNotification(
            pushToken,
            "📅 Novo agendamento",
            `${clientName} agendou ${serviceName} para ${input.date} às ${input.startTime}`,
            { appointmentId: apptId, screen: "agenda" }
          );
        }
        return apptId;
      }),
    update: publicProcedure
      .input(z.object({ id: z.number(), status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(), notes: z.string().optional().nullable(), reminderSent: z.boolean().optional(), whatsappConfirmationSent: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateAppointment(id, data as any); }),
    cancelWithReason: publicProcedure
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
      .input(z.object({ appointmentId: z.number() }))
      .query(async ({ input }) => {
        // Busca a venda vinculada ao agendamento
        const today = new Date();
        const startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 5);
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);
        const allSales = await db.getSalesByDateRange(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
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
    registerPayment: publicProcedure
      .input(z.object({
        appointmentId: z.number(),
        barberId: z.number(),
        clientId: z.number().optional().nullable(),
        serviceId: z.number(),
        serviceName: z.string(),
        servicePrice: z.number(),
        paymentMethod: z.enum(["cash", "credit_card", "debit_card", "pix", "mercado_pago", "other"]),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const total = input.servicePrice.toFixed(2);
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
        return { saleId };
      }),
    blockedSlots: router({
      get: publicProcedure.input(z.object({ barberId: z.number(), date: z.string() })).query(({ input }) => db.getBlockedSlots(input.barberId, input.date)),
      create: publicProcedure.input(z.object({ barberId: z.number(), date: z.string(), startTime: z.string(), endTime: z.string(), reason: z.string().optional() })).mutation(({ input }) => db.createBlockedSlot(input)),
      delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteBlockedSlot(input.id)),
    }),
  }),

  sales: router({
    byDateRange: publicProcedure.input(z.object({ startDate: z.string(), endDate: z.string(), barberId: z.number().optional() })).query(({ input }) => db.getSalesByDateRange(input.startDate, input.endDate, input.barberId)),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getSaleById(input.id)),
    create: publicProcedure
      .input(z.object({ clientId: z.number().optional().nullable(), barberId: z.number(), appointmentId: z.number().optional().nullable(), subtotal: z.string(), discount: z.string().default("0"), total: z.string(), paymentMethod: z.enum(["cash", "credit_card", "debit_card", "pix", "mercado_pago", "other"]), paymentStatus: z.enum(["pending", "paid", "cancelled", "refunded"]).default("paid"), couponCode: z.string().optional().nullable(), notes: z.string().optional().nullable(), items: z.array(z.object({ itemType: z.enum(["service", "product"]), itemId: z.number(), itemName: z.string(), quantity: z.number().min(1), unitPrice: z.string(), total: z.string() })) }))
      .mutation(({ input }) => { const { items, ...saleData } = input; return db.createSale(saleData as any, items); }),
  }),

  expenses: router({
    byDateRange: publicProcedure.input(z.object({ startDate: z.string(), endDate: z.string() })).query(({ input }) => db.getExpensesByDateRange(input.startDate, input.endDate)),
    create: publicProcedure
      .input(z.object({ category: z.string().min(1), description: z.string().min(1), amount: z.string(), date: z.string(), paymentMethod: z.string().optional().nullable(), barberId: z.number().optional().nullable() }))
      .mutation(({ input }) => db.createExpense(input as any)),
    update: publicProcedure
      .input(z.object({ id: z.number(), category: z.string().optional(), description: z.string().optional(), amount: z.string().optional(), date: z.string().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateExpense(id, data as any); }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteExpense(input.id)),
  }),

  coupons: router({
    list: publicProcedure.query(() => db.getAllCoupons()),
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
    create: publicProcedure
      .input(z.object({ code: z.string().min(3), description: z.string().optional(), discountType: z.enum(["percent", "fixed"]), discountValue: z.string(), minOrderValue: z.string().optional(), maxUses: z.number().optional(), validFrom: z.string().optional(), validUntil: z.string().optional() }))
      .mutation(({ input }) => db.createCoupon(input)),
    update: publicProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean().optional(), description: z.string().optional(), maxUses: z.number().optional().nullable(), validUntil: z.string().optional().nullable() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateCoupon(id, data as any); }),
    getAvailableForClient: publicProcedure
      .input(z.object({ clientId: z.number().optional().nullable(), orderValue: z.number() }))
      .query(async ({ input }) => {
        const today = new Date().toISOString().split("T")[0];
        const allCoupons = await db.getAllCoupons();
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
          const rewards = await db.getLoyaltyRewards();
          const config = await db.getLoyaltyConfig();
          if (config?.isActive && client) {
            redeemableRewards = (rewards as any[]).filter((r: any) => r.isActive && (client.totalPoints ?? 0) >= r.pointsRequired);
          }
        }
        return { coupons: validCoupons, redeemableRewards };
      }),
  }),
  loyalty: router({
    getConfig: publicProcedure.query(() => db.getLoyaltyConfig()),
    updateConfig: publicProcedure
      .input(z.object({ isActive: z.boolean(), pointsPerService: z.number().min(0), pointsPerReal: z.string(), pointsExpireMonths: z.number().min(0) }))
      .mutation(({ input }) => db.upsertLoyaltyConfig(input)),
    rewards: router({
      list: publicProcedure.query(() => db.getLoyaltyRewards()),
      create: publicProcedure
        .input(z.object({ name: z.string().min(1), description: z.string().optional(), pointsRequired: z.number().min(1), rewardType: z.enum(["free_service", "discount_percent", "discount_fixed", "free_product"]), rewardValue: z.string().optional() }))
        .mutation(({ input }) => db.createLoyaltyReward(input)),
      update: publicProcedure
        .input(z.object({ id: z.number(), name: z.string().optional(), pointsRequired: z.number().optional(), isActive: z.boolean().optional() }))
        .mutation(({ input }) => { const { id, ...data } = input; return db.updateLoyaltyReward(id, data as any); }),
    }),
    addPoints: publicProcedure
      .input(z.object({ clientId: z.number(), points: z.number(), type: z.enum(["earned", "redeemed", "expired", "adjusted"]), description: z.string().optional(), saleId: z.number().optional() }))
      .mutation(({ input }) => db.addClientPoints(input.clientId, input.points, input.type, input.description, input.saleId)),
  }),

  settings: router({
    get: publicProcedure.query(() => db.getShopSettings()),
    openStatus: publicProcedure.query(() => db.getShopOpenStatus()),
    update: publicProcedure
      .input(z.object({ shopName: z.string().optional(), address: z.string().optional().nullable(), phone: z.string().optional().nullable(), whatsapp: z.string().optional().nullable(), mercadoPagoAccessToken: z.string().optional().nullable(), mercadoPagoPublicKey: z.string().optional().nullable(), whatsappMessageTemplate: z.string().optional().nullable(), reminderMessageTemplate: z.string().optional().nullable(), instagram: z.string().optional().nullable(), cnpj: z.string().optional().nullable(), googleMapsUrl: z.string().optional().nullable(), pixKey: z.string().optional().nullable(), galleryUrls: z.string().optional().nullable(), cep: z.string().optional().nullable(), addressNumber: z.string().optional().nullable(), addressComplement: z.string().optional().nullable(), logoUrl: z.string().optional().nullable(), primaryColor: z.string().optional().nullable(), bannerUrl: z.string().optional().nullable() }))
      .mutation(({ input }) => db.upsertShopSettings(input)),
  }),

  dashboard: router({
    stats: publicProcedure.input(z.object({ date: z.string() })).query(({ input }) => db.getDashboardStats(input.date)),
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
        return { id: clientId, name: input.name, email: input.email, phone: input.phone, totalPoints: 0, client };
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
        return { id: client.id, name: client.name, email: client.email, phone: client.phone, totalPoints: client.totalPoints, birthDate: client.birthDate, photoUrl: client.photoUrl };
      }),
    updateProfile: publicProcedure
      .input(z.object({ clientId: z.number(), name: z.string().min(2).optional(), phone: z.string().optional(), birthDate: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
      .mutation(async ({ input }) => {
        const { clientId, ...data } = input;
        await db.updateClient(clientId, data);
        return { success: true };
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
        return { id: client.id, name: client.name, email: client.email, phone: client.phone ?? "", totalPoints: client.totalPoints, birthDate: client.birthDate, photoUrl: input.photoUrl ?? client.photoUrl };
      }),
    getBirthdayCoupon: publicProcedure
      .input(z.object({ birthDate: z.string() }))
      .query(async ({ input }) => {
        // Verifica se o mês de nascimento é o mês atual
        if (!input.birthDate) return null;
        const birthMonth = parseInt(input.birthDate.split("-")[1], 10);
        const currentMonth = new Date().getMonth() + 1;
        if (birthMonth !== currentMonth) return null;
        // Busca cupom de aniversário ativo (código começa com ANIV)
        const allCoupons = await db.getAllCoupons();
        const birthdayCoupon = allCoupons.find((c: any) => c.isActive && c.code.startsWith("ANIV"));
        return birthdayCoupon ?? null;
      }),
  }),

  reviews: router({
    recent: publicProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(({ input }) => db.getRecentReviews(input.limit ?? 5)),
    byService: publicProcedure
      .input(z.object({ serviceId: z.number() }))
      .query(({ input }) => db.getReviewsByService(input.serviceId)),
    byClient: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => db.getReviewsByClient(input.clientId)),
    create: publicProcedure
      .input(z.object({ clientId: z.number(), serviceId: z.number(), appointmentId: z.number().optional(), rating: z.number().min(1).max(5), comment: z.string().optional() }))
      .mutation(({ input }) => db.createReview(input)),
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
    createPreference: publicProcedure
      .input(z.object({
        appointmentId: z.number(),
        serviceId: z.number(),
        serviceName: z.string(),
        servicePrice: z.number(),
        clientName: z.string(),
        clientEmail: z.string().optional(),
        barberId: z.number(),
        clientId: z.number(),
        date: z.string(),
        startTime: z.string(),
      }))
      .mutation(async ({ input }) => {
        const mpClient = getMpClient();
        const preference = new Preference(mpClient);
        const apiBaseUrl = process.env.API_PUBLIC_URL || "https://3000-ij7sp94mctpcjw0w9i9s9-ea9c4082.us2.manus.computer";
        const result = await preference.create({
          body: {
            items: [{
              id: String(input.serviceId),
              title: input.serviceName,
              quantity: 1,
              unit_price: input.servicePrice,
              currency_id: "BRL",
            }],
            payer: input.clientEmail ? { name: input.clientName, email: input.clientEmail } : undefined,
            external_reference: JSON.stringify({
              appointmentId: input.appointmentId,
              clientId: input.clientId,
              barberId: input.barberId,
              serviceId: input.serviceId,
              servicePrice: input.servicePrice,
              date: input.date,
              startTime: input.startTime,
            }),
            notification_url: `${apiBaseUrl}/api/mp/webhook`,
            back_urls: {
              success: `${apiBaseUrl}/api/mp/success`,
              failure: `${apiBaseUrl}/api/mp/failure`,
              pending: `${apiBaseUrl}/api/mp/pending`,
            },
            auto_return: "approved",
          },
        });
        return {
          preferenceId: result.id,
          initPoint: result.init_point,
          sandboxInitPoint: result.sandbox_init_point,
        };
      }),
    createPixPayment: publicProcedure
      .input(z.object({
        serviceId: z.number(),
        serviceName: z.string(),
        servicePrice: z.number(),
        clientName: z.string(),
        clientEmail: z.string().optional(),
        clientCpf: z.string().optional().nullable(),
        appointmentId: z.number().optional().nullable(),
        barberId: z.number(),
        clientId: z.number(),
        date: z.string(),
        startTime: z.string(),
      }))
      .mutation(async ({ input }) => {
        const apiBaseUrl = process.env.API_PUBLIC_URL || "https://3000-ij7sp94mctpcjw0w9i9s9-ea9c4082.us2.manus.computer";
        const txId = `BP${Date.now().toString(36).toUpperCase()}`;

        // Tenta via Mercado Pago primeiro
        try {
          const mpClient = getMpClient();
          const payment = new Payment(mpClient);
          const result = await payment.create({
            body: {
              transaction_amount: input.servicePrice,
              description: input.serviceName,
              payment_method_id: "pix",
              payer: {
                email: input.clientEmail || "cliente@barberpro.com",
                first_name: input.clientName.split(" ")[0],
                last_name: input.clientName.split(" ").slice(1).join(" ") || input.clientName.split(" ")[0],
                identification: input.clientCpf
                  ? { type: "CPF", number: input.clientCpf.replace(/\D/g, "") }
                  : { type: "CPF", number: "00000000000" },
              },
              external_reference: JSON.stringify({
                appointmentId: input.appointmentId,
                clientId: input.clientId,
                barberId: input.barberId,
                serviceId: input.serviceId,
                servicePrice: input.servicePrice,
                date: input.date,
                startTime: input.startTime,
              }),
              notification_url: `${apiBaseUrl}/api/mp/webhook`,
            },
          });
          const pixData = (result as any).point_of_interaction?.transaction_data;
          return {
            paymentId: String(result.id),
            status: result.status,
            qrCode: pixData?.qr_code ?? null,
            qrCodeBase64: pixData?.qr_code_base64 ?? null,
            expiresAt: (result as any).date_of_expiration ?? null,
            isFallback: false,
          };
        } catch (mpErr: any) {
          // Fallback: gera QR Code Pix local (EMV/BR Code)
          // Busca a chave Pix configurada nas settings ou usa placeholder
          const settings = await db.getShopSettings().catch(() => null);
          const shopName = (settings as any)?.shopName || "Barber Pro";
          const shopCity = "SAO PAULO";
          const configuredPixKey = (settings as any)?.pixKey || undefined;
          const pixPayload = generatePixPayload({
            merchantName: shopName.toUpperCase().substring(0, 25),
            merchantCity: shopCity,
            amount: input.servicePrice,
            txId,
            description: input.serviceName,
            pixKey: configuredPixKey,
          });

          // Gera QR Code como base64 PNG
          const qrBase64 = await QRCode.toDataURL(pixPayload, {
            errorCorrectionLevel: "M",
            margin: 2,
            width: 300,
            color: { dark: "#000000", light: "#ffffff" },
          });
          // Remove o prefixo data:image/png;base64,
          const qrCodeBase64 = qrBase64.replace(/^data:image\/png;base64,/, "");

          // Expira em 30 minutos
          const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

          return {
            paymentId: txId,
            status: "pending",
            qrCode: pixPayload,
            qrCodeBase64,
            expiresAt,
            isFallback: true,
          };
        }
      }),

    pendingList: publicProcedure
      .query(async () => {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 30);
        const allSales = await db.getSalesByDateRange(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        );
        return (allSales as any[]).filter((s) =>
          s.paymentStatus === "pending" && s.paymentMethod === "mercado_pago"
        );
      }),

    getSaleByAppointment: publicProcedure
      .input(z.object({ appointmentId: z.number() }))
      .query(async ({ input }) => {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 5);
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);
        const allSales = await db.getSalesByDateRange(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        );
        return (allSales as any[]).find((s) => s.appointmentId === input.appointmentId) ?? null;
      }),
  }),

  reports: router({
    revenue: publicProcedure
      .input(z.object({ period: z.enum(["week", "month", "year"]).default("month") }))
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
          const sales = await db.getSalesByDateRange(dateStr, dateStr);
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
          const sales = await db.getSalesByDateRange(start.toISOString().split("T")[0], end.toISOString().split("T")[0]);
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
          const sales = await db.getSalesByDateRange(start, end);
          const total = (sales as any[]).filter(s => s.paymentStatus === "paid").reduce((sum: number, s: any) => sum + parseFloat(s.total || "0"), 0);
          labels.push(MONTHS[d.getMonth()]);
          data.push(total);
        }
      }
      const totalRevenue = data.reduce((a, b) => a + b, 0);
      return { labels, data, totalRevenue };
    }),

  topServices: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      const sales = await db.getSalesByDateRange(input.startDate, input.endDate);
      const paidSales = (sales as any[]).filter(s => s.paymentStatus === "paid");
      const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
      for (const sale of paidSales) {
        const allSalesWithItems = await db.getSalesByDateRange(input.startDate, input.endDate);
        break; // just to get the structure
      }
      // Use saleItems via direct query approach
      const allSales = paidSales;
      // Build from sale items if available in sale data
      for (const sale of allSales) {
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
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      const sales = await db.getSalesByDateRange(input.startDate, input.endDate);
      const paidSales = (sales as any[]).filter(s => s.paymentStatus === "paid" && s.clientId);
      const clientMap: Record<number, { clientId: number; count: number; revenue: number }> = {};
      for (const sale of paidSales) {
        const cid = sale.clientId;
        if (!clientMap[cid]) clientMap[cid] = { clientId: cid, count: 0, revenue: 0 };
        clientMap[cid].count += 1;
        clientMap[cid].revenue += parseFloat(sale.total ?? "0");
      }
      const allClients = await db.getAllClients();
      const clientsById: Record<number, any> = {};
      for (const c of allClients as any[]) clientsById[c.id] = c;
      return Object.values(clientMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(c => ({ ...c, name: clientsById[c.clientId]?.name ?? "Cliente", phone: clientsById[c.clientId]?.phone ?? "" }));
    }),

  barberOccupancy: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      const allBarbers = await db.getAllBarbers();
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
        const sales = await db.getSalesByDateRange(input.startDate, input.endDate, barber.id);
        const paidSales = (sales as any[]).filter((s: any) => s.paymentStatus === "paid");
        const revenue = paidSales.reduce((sum: number, s: any) => sum + parseFloat(s.total ?? "0"), 0);

        // Agendamentos por status no período (todos os status)
        const allAppts = await db.getAllAppointmentsByDateRange(barber.id, input.startDate, input.endDate);
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
    .input(z.object({ startDate: z.string(), endDate: z.string(), period: z.string().optional() }))
    .mutation(async ({ input }) => {
      const settings = await db.getShopSettings().catch(() => null) as any;
      const shopName = settings?.shopName || "Barber Pro";
      const shopCnpj = settings?.cnpj || "";
      const shopAddress = settings?.address || "";
      // Receitas
      const sales = await db.getSalesByDateRange(input.startDate, input.endDate);
      const paidSales = (sales as any[]).filter(s => s.paymentStatus === "paid");
      const totalRevenue = paidSales.reduce((sum: number, s: any) => sum + parseFloat(s.total ?? "0"), 0);
      // Despesas
      const expenses = await db.getExpensesByDateRange(input.startDate, input.endDate);
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
  }),

  // ─── Mensagens de Retorno Automáticas ────────────────────────────────────────
  returnMessages: router({
    list: publicProcedure.query(async () => {
      return db.listReturnMessageConfigs();
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
    list: publicProcedure.query(async () => {
      return db.listPromotions();
    }),
    send: publicProcedure
      .input(z.object({
        title: z.string().min(1),
        message: z.string().min(1),
        targetAudience: z.enum(["all", "inactive_30", "inactive_60", "birthday_month"]),
        createdBy: z.number(),
      }))
      .mutation(async ({ input }) => {
        const count = await db.getPromotionRecipientCount(input.targetAudience);
        return db.createPromotion({ ...input, recipientCount: count });
      }),
  }),

  // ─── Lista de Espera ──────────────────────────────────────────────────────────
  waitlist: router({
    listByDate: publicProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        return db.listWaitlistByDate(input.date);
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
    listConfigs: publicProcedure.query(async () => {
      return db.listCommissionConfigs();
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
      }))
      .query(async ({ input }) => {
        return db.listCommissionEntries(input);
      }),
    summary: publicProcedure
      .input(z.object({ startDate: z.string(), endDate: z.string() }))
      .query(async ({ input }) => {
        return db.getCommissionSummary(input.startDate, input.endDate);
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
    listAll: publicProcedure.query(async () => {
      return db.getAllRecurringAppointments();
    }),
  }),

  promotionConversion: router({
    report: publicProcedure.query(async () => {
      return db.getPromotionConversionReport();
    }),
  }),

  stock: router({
    list: publicProcedure.query(async () => {
      return db.getStockProducts();
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
    lowStock: publicProcedure.query(async () => {
      return db.getLowStockProducts();
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
        // 7. Retornar dados do admin para login automático
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
    listTenants: publicProcedure.query(async () => {
      return db.getAllTenants();
    }),
  }),
});
export type AppRouter = typeof appRouter;
