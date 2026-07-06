/**
 * Atualiza o plan do tenant para 'studio' para habilitar o seletor de filiais.
 * Uso:
 *   $env:DATABASE_URL="postgres://..." ; node scripts/update-tenant-plan.mjs
 * Ou com Railway CLI:
 *   railway run node scripts/update-tenant-plan.mjs
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL não definido.");
  console.error("   Rode: $env:DATABASE_URL='postgres://...' ; node scripts/update-tenant-plan.mjs");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

// Verificar estado atual
const { rows: before } = await client.query(
  "SELECT id, name, plan, status FROM tenants WHERE id = 2"
);
console.log("Antes:", before[0] ?? "tenant id=2 não encontrado");

if (!before[0]) {
  await client.end();
  process.exit(1);
}

// Atualizar plan para studio
await client.query("UPDATE tenants SET plan = 'studio' WHERE id = 2");

// Confirmar
const { rows: after } = await client.query(
  "SELECT id, name, plan, status FROM tenants WHERE id = 2"
);
console.log("Depois:", after[0]);
console.log("✅ Pronto — plan atualizado para 'studio'");

await client.end();
