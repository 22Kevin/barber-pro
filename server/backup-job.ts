/**
 * Barber Pro — Job de Backup Automático Semanal do PostgreSQL
 *
 * Executa toda segunda-feira às 03:00 (horário de Brasília, UTC-3).
 * Faz backup completo de todas as tabelas do banco de dados PostgreSQL
 * e salva em ./backups/ como arquivo JSON.
 *
 * Notificação: envia e-mail para BACKUP_NOTIFY_EMAIL (se configurado)
 * com o resultado do backup (sucesso ou falha).
 *
 * Variáveis de ambiente:
 *   DATABASE_URL          — URL de conexão com o PostgreSQL
 *   BACKUP_NOTIFY_EMAIL   — E-mail para notificação de backup (opcional)
 *   SMTP_HOST / SMTP_USER / SMTP_PASS — Configuração SMTP para notificação
 */
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Intervalo semanal: 7 dias em ms
const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// Calcular ms até a próxima segunda-feira às 03:00 (horário de Brasília = UTC-3)
function msUntilNextMondayAt3am(): number {
  // Hora atual em UTC-3 (Brasília)
  const nowUtc = Date.now();
  const nowBrasilia = new Date(nowUtc - 3 * 60 * 60 * 1000);

  // Próxima segunda-feira às 03:00 em Brasília
  const target = new Date(nowBrasilia);
  target.setUTCHours(3, 0, 0, 0); // 03:00 UTC-3 = 06:00 UTC

  // Ajustar para a próxima segunda-feira (dayOfWeek: 0=Dom, 1=Seg, ...)
  const dayOfWeek = target.getUTCDay(); // dia da semana em UTC (que é dia de Brasília)
  const daysUntilMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7 || 7;
  target.setUTCDate(target.getUTCDate() + daysUntilMonday);

  // Se já passou das 03:00 hoje e hoje é segunda, agendar para a próxima semana
  const diffMs = target.getTime() - nowBrasilia.getTime();
  if (diffMs <= 0) {
    target.setUTCDate(target.getUTCDate() + 7);
    return target.getTime() - nowBrasilia.getTime();
  }
  return diffMs;
}

async function runBackup(): Promise<{ success: boolean; filename?: string; tables: number; rows: number; sizeKb: number; error?: string }> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return { success: false, tables: 0, rows: 0, sizeKb: 0, error: "DATABASE_URL não configurado" };
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    console.log("[backup-job] Iniciando backup semanal do PostgreSQL...");

    const tablesResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    const tables = tablesResult.rows.map((r: { tablename: string }) => r.tablename);

    const backupData: {
      timestamp: string;
      version: string;
      tables: Record<string, unknown[]>;
    } = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      tables: {},
    };

    let totalRows = 0;
    for (const table of tables) {
      const result = await client.query(`SELECT * FROM "${table}"`);
      backupData.tables[table] = result.rows;
      totalRows += result.rows.length;
      console.log(`[backup-job]   ${table}: ${result.rows.length} registros`);
    }

    // Salvar arquivo de backup
    const backupDir = path.join(__dirname, "..", "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\..+/, "");
    const filename = path.join(backupDir, `backup_${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));

    const sizeKb = Math.round(fs.statSync(filename).size / 1024);

    // Manter apenas os últimos 8 backups (2 meses)
    const backupFiles = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("backup_") && f.endsWith(".json"))
      .sort()
      .reverse();
    if (backupFiles.length > 8) {
      const toDelete = backupFiles.slice(8);
      for (const f of toDelete) {
        fs.unlinkSync(path.join(backupDir, f));
        console.log(`[backup-job] Backup antigo removido: ${f}`);
      }
    }

    console.log(`[backup-job] Backup concluído: ${tables.length} tabelas, ${totalRows} registros, ${sizeKb} KB`);
    console.log(`[backup-job] Arquivo: ${filename}`);

    return { success: true, filename, tables: tables.length, rows: totalRows, sizeKb };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[backup-job] Erro no backup:", errorMsg);
    return { success: false, tables: 0, rows: 0, sizeKb: 0, error: errorMsg };
  } finally {
    client.release();
    await pool.end();
  }
}

async function sendBackupNotification(result: { success: boolean; filename?: string; tables: number; rows: number; sizeKb: number; error?: string }): Promise<void> {
  const notifyEmail = process.env.BACKUP_NOTIFY_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!notifyEmail || !smtpHost || !smtpUser || !smtpPass) {
    // Sem configuração de e-mail, apenas log
    if (!notifyEmail) {
      console.log("[backup-job] BACKUP_NOTIFY_EMAIL não configurado — notificação por e-mail desativada");
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: parseInt(process.env.SMTP_PORT ?? "587") === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const subject = result.success
    ? `✅ Backup Barber Pro concluído — ${new Date().toLocaleDateString("pt-BR")}`
    : `❌ FALHA no Backup Barber Pro — ${new Date().toLocaleDateString("pt-BR")}`;

  const body = result.success
    ? `
<h2>✅ Backup Semanal Concluído</h2>
<p><strong>Data:</strong> ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
<p><strong>Tabelas:</strong> ${result.tables}</p>
<p><strong>Registros:</strong> ${result.rows.toLocaleString("pt-BR")}</p>
<p><strong>Tamanho:</strong> ${result.sizeKb} KB</p>
<p><strong>Arquivo:</strong> ${result.filename ? path.basename(result.filename) : "—"}</p>
<hr>
<p style="color:#666;font-size:12px">Barber Pro — Backup automático semanal (toda segunda-feira às 03:00)</p>
`
    : `
<h2>❌ Falha no Backup Semanal</h2>
<p><strong>Data:</strong> ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
<p><strong>Erro:</strong> ${result.error}</p>
<p>Por favor, verifique os logs do servidor e execute o backup manualmente se necessário.</p>
<hr>
<p style="color:#666;font-size:12px">Barber Pro — Backup automático semanal</p>
`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? smtpUser,
      to: notifyEmail,
      subject,
      html: body,
    });
    console.log(`[backup-job] Notificação enviada para ${notifyEmail}`);
  } catch (err) {
    console.error("[backup-job] Erro ao enviar notificação:", err instanceof Error ? err.message : err);
  }
}

async function runBackupWithNotification(): Promise<void> {
  const result = await runBackup();
  await sendBackupNotification(result);
}

export function startBackupJob(): void {
  const msUntilFirst = msUntilNextMondayAt3am();
  const hoursUntilFirst = Math.round(msUntilFirst / (1000 * 60 * 60));

  console.log(`[backup-job] Job de backup semanal iniciado`);
  console.log(`[backup-job] Próximo backup: segunda-feira às 03:00 (Brasília) — em ~${hoursUntilFirst}h`);

  // Agendar para a próxima segunda-feira às 03:00
  setTimeout(() => {
    // Executar o primeiro backup
    runBackupWithNotification();
    // Depois repetir semanalmente
    setInterval(runBackupWithNotification, WEEKLY_INTERVAL_MS);
  }, msUntilFirst);
}

// Exportar para uso manual (ex: node -e "require('./backup-job').runBackup()")
export { runBackup, runBackupWithNotification };
