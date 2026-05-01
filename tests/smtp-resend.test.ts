/**
 * Teste de validação das credenciais SMTP do Resend.
 * Verifica se a conexão SMTP está configurada corretamente.
 *
 * Execução: pnpm test tests/smtp-resend.test.ts
 */
import { describe, it, expect } from "vitest";
import nodemailer from "nodemailer";

const skipIfNoSmtp = !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS;

describe("SMTP — Resend", () => {
  it.skipIf(skipIfNoSmtp)("Credenciais SMTP são válidas e conexão é estabelecida", async () => {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? "465"),
      secure: parseInt(process.env.SMTP_PORT ?? "465") === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // verify() testa a conexão e autenticação sem enviar e-mail
    await expect(transporter.verify()).resolves.toBe(true);
  }, 15000);
});
