// Script to mark pending migrations as applied in __drizzle_migrations table
// This is needed when migrations were applied manually but not tracked by drizzle
const mysql = require('mysql2/promise');
const url = process.env.DATABASE_URL;
const fs = require('fs');
const crypto = require('crypto');

async function main() {
  const conn = await mysql.createConnection(url);
  try {
    const [rows] = await conn.execute('SELECT hash FROM `__drizzle_migrations` ORDER BY id');
    const appliedHashes = new Set(rows.map(r => r.hash));
    console.log('Currently applied migrations:', appliedHashes.size);
    
    const journal = JSON.parse(fs.readFileSync('./drizzle/meta/_journal.json', 'utf8'));
    
    let inserted = 0;
    for (const entry of journal.entries) {
      const sqlFile = './drizzle/' + entry.tag + '.sql';
      const sql = fs.readFileSync(sqlFile, 'utf8');
      const hash = crypto.createHash('sha256').update(sql).digest('hex');
      
      if (!appliedHashes.has(hash)) {
        console.log('Registering migration:', entry.idx, entry.tag);
        await conn.execute(
          'INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)',
          [hash, Date.now()]
        );
        inserted++;
      }
    }
    
    console.log('Registered', inserted, 'migrations as applied');
    console.log('Done!');
  } catch(e) {
    console.log('Error:', e.message);
    console.log(e.stack);
  }
  await conn.end();
}
main();
