// Script: verifica produtos por tenant no banco
// Uso: DATABASE_URL=<railway-url> node check-products-by-tenant.cjs
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log('\n=== Produtos por tenant ===');
    const { rows } = await client.query(`
      SELECT p.id, p.name, p."tenantId", p."stockQuantity" AS stock, p."isActive"
      FROM products p
      WHERE p."tenantId" IN (1, 2)
      ORDER BY p."tenantId", p.name
    `);
    if (!rows.length) {
      console.log('Nenhum produto encontrado para tenantId 1 ou 2.');
    } else {
      console.table(rows);
      const byTenant = rows.reduce((acc, r) => {
        acc[r.tenantId] = (acc[r.tenantId] || 0) + 1;
        return acc;
      }, {});
      console.log('\nResumo:', byTenant);
    }

    console.log('\n=== Tenants 1 e 2 ===');
    const { rows: tenants } = await client.query(`
      SELECT id, name, "displayName", plan, "parentTenantId"
      FROM tenants WHERE id IN (1, 2)
    `);
    console.table(tenants);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
