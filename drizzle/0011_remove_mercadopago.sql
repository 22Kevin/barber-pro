-- Remove Mercado Pago columns — all payment flows now handled by Asaas
ALTER TABLE "sales" DROP COLUMN IF EXISTS "mercadoPagoPaymentId";
ALTER TABLE "shop_settings" DROP COLUMN IF EXISTS "mercadoPagoAccessToken";
ALTER TABLE "shop_settings" DROP COLUMN IF EXISTS "mercadoPagoPublicKey";
