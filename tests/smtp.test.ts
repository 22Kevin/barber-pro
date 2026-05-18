/**
 * Teste de validação das credenciais SMTP da Hostinger.
 * Verifica se é possível criar um transporter e verificar a conexão.
 */
import { describe, it, expect } from "vitest";
import * as nodemailer from "nodemailer";
import "./setup";

describe("SMTP Hostinger", () => {
  it("deve ter as variáveis de ambiente SMTP configuradas", () => {
    expect(process.env.SMTP_HOST).toBeTruthy();
    expect(process.env.SMTP_PORT).toBeTruthy();
    expect(process.env.SMTP_USER).toBeTruthy();
    expect(process.env.SMTP_PASS).toBeTruthy();
    expect(process.env.SMTP_FROM).toBeTruthy();

    expect(process.env.SMTP_HOST).toBe("smtp.hostinger.com");
    expect(process.env.SMTP_PORT).toBe("465");
  });

  it("deve criar um transporter nodemailer válido com as credenciais da Hostinger", async () => {
    const host = process.env.SMTP_HOST!;
    const port = parseInt(process.env.SMTP_PORT ?? "465");
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    expect(transporter).toBeTruthy();

    // Verificar a conexão SMTP (sem enviar e-mail)
    await expect(transporter.verify()).resolves.toBe(true);
  }, 15000);
});
