/**
 * Script de Backup Manual do PostgreSQL - Barber Pro
 *
 * Como usar:
 *   node backup_postgres.js
 *
 * O backup será salvo em: ./backups/backup_YYYY-MM-DD_HH-MM-SS.json
 *
 * Para restaurar um backup:
 *   node backup_postgres.js --restore ./backups/backup_YYYY-MM-DD_HH-MM-SS.json
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// IMPORTANTE: Usar sempre a URL publica do PostgreSQL Railway
// Nao usar process.env.DATABASE_URL pois pode apontar para o MySQL antigo
const POSTGRES_URL =
  "postgresql://postgres:gMQIkFWkfiuCJokrgvVtUJOCMZErJHum@switchyard.proxy.rlwy.net:21523/railway";

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: false,
});

async function backup() {
  const client = await pool.connect();
  try {
    const tablesResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    const tables = tablesResult.rows.map((r) => r.tablename);

    const backupData = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      tables: {},
    };

    let totalRows = 0;
    for (const table of tables) {
      const result = await client.query('SELECT * FROM "' + table + '"');
      backupData.tables[table] = result.rows;
      totalRows += result.rows.length;
      process.stdout.write("  OK " + table + ": " + result.rows.length + " registros\n");
    }

    const backupDir = path.join(__dirname, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\..+/, "");
    const filename = path.join(backupDir, "backup_" + timestamp + ".json");
    fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));

    console.log("\nBackup concluido!");
    console.log("  Tabelas: " + tables.length);
    console.log("  Registros: " + totalRows);
    console.log("  Arquivo: " + filename);
    console.log("  Tamanho: " + (fs.statSync(filename).size / 1024).toFixed(1) + " KB");

    return filename;
  } finally {
    client.release();
    await pool.end();
  }
}

async function restore(backupFile) {
  if (!fs.existsSync(backupFile)) {
    console.error("Arquivo nao encontrado: " + backupFile);
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(backupFile, "utf8"));
  console.log("\nRestaurando backup de: " + backupData.timestamp);

  const client = await pool.connect();
  try {
    await client.query("SET session_replication_role = replica");

    let totalRestored = 0;
    for (const table of Object.keys(backupData.tables)) {
      const rows = backupData.tables[table];
      if (rows.length === 0) continue;

      await client.query('DELETE FROM "' + table + '"');

      for (const row of rows) {
        const cols = Object.keys(row).map((c) => '"' + c + '"').join(", ");
        const vals = Object.keys(row).map((_, i) => "$" + (i + 1)).join(", ");
        const values = Object.values(row);
        await client.query(
          'INSERT INTO "' + table + '" (' + cols + ") VALUES (" + vals + ")",
          values
        );
      }

      totalRestored += rows.length;
      console.log("  OK " + table + ": " + rows.length + " registros restaurados");
    }

    await client.query("SET session_replication_role = DEFAULT");
    console.log("\nRestauracao concluida! " + totalRestored + " registros.");
  } finally {
    client.release();
    await pool.end();
  }
}

const args = process.argv.slice(2);
if (args[0] === "--restore" && args[1]) {
  restore(args[1]).catch((e) => {
    console.error("Erro na restauracao:", e.message);
    process.exit(1);
  });
} else {
  console.log("Iniciando backup do PostgreSQL - Barber Pro...\n");
  backup().catch((e) => {
    console.error("Erro no backup:", e.message);
    process.exit(1);
  });
}
