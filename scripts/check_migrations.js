const mysql = require('mysql2/promise');
const url = process.env.DATABASE_URL;
const fs = require('fs');
const crypto = require('crypto');

async function main() {
  const conn = await mysql.createConnection(url);
  try {
    const [rows] = await conn.execute('SELECT hash FROM `__drizzle_migrations` ORDER BY id');
    const appliedHashes = new Set(rows.map(r => r.hash));
    console.log('Applied count:', appliedHashes.size);
    
    const journal = JSON.parse(fs.readFileSync('./drizzle/meta/_journal.json', 'utf8'));
    
    for (const entry of journal.entries) {
      const sqlFile = './drizzle/' + entry.tag + '.sql';
      const sql = fs.readFileSync(sqlFile, 'utf8');
      const hash = crypto.createHash('sha256').update(sql).digest('hex');
      const applied = appliedHashes.has(hash);
      if (applied) {
        console.log('APPLIED:', entry.idx, entry.tag);
      } else {
        console.log('PENDING:', entry.idx, entry.tag, '- hash:', hash.slice(0,16));
      }
    }
    console.log('Done checking');
  } catch(e) {
    console.log('Error:', e.message);
  }
  await conn.end();
}
main();
