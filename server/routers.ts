import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import crypto from "crypto";

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
    create: publicProcedure
      .input(z.object({ name: z.string().min(2), email: z.string().email().optional(), phone: z.string().optional(), password: z.string().min(6), role: z.enum(["super_admin", "barber", "receptionist"]).default("barber"), specialties: z.string().optional() }))
      .mutation(async ({ input }) => {
        const passwordHash = await hashPassword(input.password);
        return db.createBarber({ ...input, passwordHash, isActive: true });
      }),
    update: publicProcedure
      .input(z.object({ id: z.number(), name: z.string().min(2).optional(), email: z.string().email().optional().nullable(), phone: z.string().optional().nullable(), role: z.enum(["super_admin", "barber", "receptionist"]).optional(), specialties: z.string().optional().nullable(), isActive: z.boolean().optional(), password: z.string().min(6).optional() }))
      .mutation(async ({ input }) => {
        const { id, password, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (password) updateData.passwordHash = await hashPassword(password);
        await db.updateBarber(id, updateData as any);
        return { success: true };
      }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteBarber(input.id)),
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
  }),

  categories: router({
    list: publicProcedure.input(z.object({ type: z.enum(["service", "product"]) })).query(({ input }) => db.getCategoriesByType(input.type)),
    create: publicProcedure.input(z.object({ name: z.string().min(1), type: z.enum(["service", "product"]) })).mutation(({ input }) => db.createCategory(input.name, input.type)),
  }),

  services: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().optional() })).query(({ input }) => db.getAllServices(input.activeOnly)),
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
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().optional() })).query(({ input }) => db.getAllProducts(input.activeOnly)),
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
  }),

  appointments: router({
    byDate: publicProcedure.input(z.object({ barberId: z.number(), date: z.string() })).query(({ input }) => db.getAppointmentsByDate(input.barberId, input.date)),
    allByDate: publicProcedure.input(z.object({ date: z.string() })).query(({ input }) => db.getAllAppointmentsByDate(input.date)),
    byDateRange: publicProcedure.input(z.object({ barberId: z.number(), startDate: z.string(), endDate: z.string() })).query(({ input }) => db.getAppointmentsByDateRange(input.barberId, input.startDate, input.endDate)),
    checkAvailability: publicProcedure
      .input(z.object({ barberId: z.number(), date: z.string(), startTime: z.string(), endTime: z.string(), excludeId: z.number().optional() }))
      .query(({ input }) => db.checkSlotAvailability(input.barberId, input.date, input.startTime, input.endTime, input.excludeId)),
    create: publicProcedure
      .input(z.object({ clientId: z.number(), barberId: z.number(), serviceId: z.number(), date: z.string(), startTime: z.string(), endTime: z.string(), notes: z.string().optional().nullable(), status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).default("scheduled") }))
      .mutation(async ({ input }) => {
        const available = await db.checkSlotAvailability(input.barberId, input.date, input.startTime, input.endTime);
        if (!available) throw new Error("Horário não disponível. Por favor, escolha outro horário.");
        return db.createAppointment(input as any);
      }),
    update: publicProcedure
      .input(z.object({ id: z.number(), status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(), notes: z.string().optional().nullable(), reminderSent: z.boolean().optional(), whatsappConfirmationSent: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateAppointment(id, data as any); }),
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
    update: publicProcedure
      .input(z.object({ shopName: z.string().optional(), address: z.string().optional().nullable(), phone: z.string().optional().nullable(), whatsapp: z.string().optional().nullable(), mercadoPagoAccessToken: z.string().optional().nullable(), mercadoPagoPublicKey: z.string().optional().nullable(), whatsappMessageTemplate: z.string().optional().nullable(), reminderMessageTemplate: z.string().optional().nullable() }))
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
  }),

  reviews: router({
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
});

export type AppRouter = typeof appRouter;
