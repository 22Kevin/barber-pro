import nodemailer from "nodemailer";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT ?? "587");
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!host || !user || !pass) {
  console.log("SMTP não configurado — variáveis ausentes. Pulando teste.");
  process.exit(0);
}

console.log(`Testando conexão SMTP: ${host}:${port} (user: ${user})`);
const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

transporter.verify((err, success) => {
  if (err) {
    console.error("Erro SMTP:", err.message);
    process.exit(1);
  } else {
    console.log("Conexão SMTP OK!");
    process.exit(0);
  }
});
