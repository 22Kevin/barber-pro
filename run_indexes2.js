const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:gMQIkFWkfiuCJokrgvVtUJOCMZErJHum@switchyard.proxy.rlwy.net:21523/railway',
  ssl: { rejectUnauthorized: false }
});

// Índices que falharam ou precisam de correção
const statements = [
  // waitlist não tem tenantId - usar barberId que está disponível
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waitlist_barber_date ON waitlist("barberId", date)',
  // sales não tem tenantId - usar barberId
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_barber_id ON sales("barberId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_created_at ON sales("createdAt")',
  // expenses já tem tenantId - o erro foi no date (é "date" minúsculo - verificar)
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_date ON expenses(date)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_tenant_date ON expenses("tenantId", date)',
];

async function run() {
  const client = await pool.connect();
  let ok = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
      console.log('✅', stmt.substring(0, 70));
    } catch(e) {
      if (e.message.includes('already exists')) {
        ok++;
        console.log('⏭️  Já existe:', stmt.substring(0, 70));
      } else {
        console.error('❌ Erro:', e.message.substring(0, 100));
        console.error('   SQL:', stmt.substring(0, 70));
        fail++;
      }
    }
  }
  client.release();
  await pool.end();
  console.log('\nConcluído:', ok, 'OK,', fail, 'falhas');
}

run().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
