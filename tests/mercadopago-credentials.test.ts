import { describe, it, expect } from "vitest";

describe("Mercado Pago credentials", () => {
  it("MP_ACCESS_TOKEN deve estar definido e ter formato válido", () => {
    const token = process.env.MP_ACCESS_TOKEN;
    expect(token).toBeDefined();
    expect(token).toMatch(/^APP_USR-|^TEST-/);
  });

  it("MP_PUBLIC_KEY deve estar definido e ter formato válido", () => {
    const key = process.env.MP_PUBLIC_KEY;
    expect(key).toBeDefined();
    expect(key).toMatch(/^APP_USR-|^TEST-/);
  });

  it("deve conseguir inicializar o SDK do Mercado Pago com o Access Token", async () => {
    const { MercadoPagoConfig } = await import("mercadopago");
    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
    expect(client).toBeDefined();
  });
});
