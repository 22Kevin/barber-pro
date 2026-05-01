const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:gMQIkFWkfiuCJokrgvVtUJOCMZErJHum@switchyard.proxy.rlwy.net:21523/railway',
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync('./add_indexes.sql', 'utf8');
const statements = sql.split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

async function run() {
  const client = await pool.connect();
  let ok = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
      process.stdout.write('.');
    } catch(e) {
      if (e.message.includes('already exists')) {
        process.stdout.write('s');
        ok++;
      } else {
        console.error('\n❌ Erro:', e.message.substring(0, 100));
        fail++;
      }
    }
  }
  client.release();
  await pool.end();
  console.log('\n✅ Concluído:', ok, 'OK,', fail, 'falhas');
}

run().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
