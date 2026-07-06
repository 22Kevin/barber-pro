/**
 * migrate-image-urls.mjs
 *
 * Substitui o prefixo privado do S3/R2 pelo URL público em todas as colunas de imagem.
 *
 * Uso (dry-run — só mostra o que seria alterado):
 *   $env:DATABASE_URL="postgres://..."
 *   $env:S3_ENDPOINT="https://ACCOUNT.r2.cloudflarestorage.com"
 *   $env:S3_BUCKET="meu-bucket"
 *   $env:S3_PUBLIC_URL="https://pub-HASH.r2.dev"
 *   node scripts/migrate-image-urls.mjs
 *
 * Uso (aplica as alterações):
 *   node scripts/migrate-image-urls.mjs --apply
 */

import pg from "pg";

const DRY_RUN = !process.argv.includes("--apply");

// ─── Config ───────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const S3_ENDPOINT  = (process.env.S3_ENDPOINT  ?? "").replace(/\/+$/, "");
const S3_BUCKET    = (process.env.S3_BUCKET    ?? "").replace(/\/+$/, "");
const S3_PUBLIC_URL = (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "");

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida.");
  process.exit(1);
}
if (!S3_ENDPOINT || !S3_BUCKET) {
  console.error("❌ S3_ENDPOINT e S3_BUCKET são obrigatórios para identificar o prefixo antigo.");
  process.exit(1);
}
if (!S3_PUBLIC_URL) {
  console.error("❌ S3_PUBLIC_URL não definida. Defina com o domínio público do bucket R2.");
  process.exit(1);
}

// Prefixo antigo: endpoint + "/" + bucket
const OLD_PREFIX = `${S3_ENDPOINT}/${S3_BUCKET}`;

console.log(`
${DRY_RUN ? "🔍 DRY-RUN (nenhuma alteração será feita)" : "⚡ MODO APPLY — alterações serão gravadas"}
  Prefixo antigo : ${OLD_PREFIX}
  Prefixo novo   : ${S3_PUBLIC_URL}
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Troca prefixo em uma URL simples; retorna null se nada mudou */
function migrateUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith(OLD_PREFIX)) return null;
  return S3_PUBLIC_URL + url.slice(OLD_PREFIX.length);
}

/** Troca prefixo dentro de um JSON array de strings (ex: galleryUrls) */
function migrateJsonArray(raw) {
  if (!raw) return null;
  let arr;
  try { arr = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(arr)) return null;
  let changed = false;
  const updated = arr.map((u) => {
    const m = migrateUrl(u);
    if (m) { changed = true; return m; }
    return u;
  });
  return changed ? JSON.stringify(updated) : null;
}

// ─── Plano de migração ────────────────────────────────────────────────────────
//
// Cada entrada: { table, idCol, columns: ["col"] | [{ col, type: "json_array" }] }
//
const PLAN = [
  {
    table: "media_files",
    idCol: "id",
    columns: [{ col: "url", type: "plain" }],
  },
  {
    table: "tenants",
    idCol: "id",
    columns: [{ col: "logoUrl", type: "plain" }],
  },
  {
    table: "barbers",
    idCol: "id",
    columns: [{ col: "photoUrl", type: "plain" }],
  },
  {
    table: "clients",
    idCol: "id",
    columns: [{ col: "photoUrl", type: "plain" }],
  },
  {
    table: "shop_settings",
    idCol: "id",
    columns: [
      { col: "logoUrl",    type: "plain" },
      { col: "bannerUrl",  type: "plain" },
      { col: "seoImageUrl", type: "plain" },
      { col: "galleryUrls", type: "json_array" },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

let totalUpdated = 0;

for (const { table, idCol, columns } of PLAN) {
  // Busca todos os registros que têm ao menos uma coluna relevante
  const colNames = columns.map((c) => `"${c.col}"`).join(", ");
  const { rows } = await client.query(
    `SELECT "${idCol}", ${colNames} FROM "${table}"`
  );

  const updates = []; // { id, col, newVal }

  for (const row of rows) {
    for (const { col, type } of columns) {
      const raw = row[col];
      const newVal =
        type === "json_array" ? migrateJsonArray(raw) : migrateUrl(raw);
      if (newVal !== null) {
        updates.push({ id: row[idCol], col, oldVal: raw, newVal });
      }
    }
  }

  if (updates.length === 0) {
    console.log(`✓ ${table}: nenhuma URL para migrar`);
    continue;
  }

  console.log(`\n📋 ${table}: ${updates.length} alteração(ões)`);
  for (const u of updates) {
    console.log(`  [${u.id}] ${u.col}`);
    if (u.col === "galleryUrls") {
      const oldArr = JSON.parse(u.oldVal ?? "[]");
      const newArr = JSON.parse(u.newVal);
      for (let i = 0; i < oldArr.length; i++) {
        if (oldArr[i] !== newArr[i]) {
          console.log(`    [${i}] ${oldArr[i]}`);
          console.log(`       → ${newArr[i]}`);
        }
      }
    } else {
      console.log(`    ${u.oldVal}`);
      console.log(`    → ${u.newVal}`);
    }
  }

  if (!DRY_RUN) {
    // Aplica agrupando por coluna para minimizar queries
    const byCols = {};
    for (const u of updates) {
      (byCols[u.col] ??= []).push(u);
    }
    for (const [col, rows] of Object.entries(byCols)) {
      // UPDATE usando CASE WHEN para fazer tudo em uma query por coluna
      const caseExpr = rows
        .map((_, i) => `WHEN "${idCol}" = $${i * 2 + 1} THEN $${i * 2 + 2}::text`)
        .join(" ");
      const ids   = rows.map((r) => r.id);
      const vals  = rows.flatMap((r) => [r.id, r.newVal]);
      await client.query(
        `UPDATE "${table}" SET "${col}" = CASE ${caseExpr} END WHERE "${idCol}" = ANY($${vals.length + 1}::int[])`,
        [...vals, ids]
      );
    }
    totalUpdated += updates.length;
    console.log(`  ✅ Aplicado`);
  } else {
    totalUpdated += updates.length;
  }
}

await client.end();

console.log(`
${"─".repeat(50)}
${DRY_RUN
  ? `🔍 Dry-run concluído. ${totalUpdated} registro(s) seriam atualizados.\n   Rode com --apply para aplicar.`
  : `✅ Migração concluída. ${totalUpdated} registro(s) atualizados.`
}
`);
