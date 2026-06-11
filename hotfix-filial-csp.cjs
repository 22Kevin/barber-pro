const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// 1. shop_settings não tem unique em tenantId — trocar ON CONFLICT por check-first
patch('server/db.ts',
`  await _pool.query(
    \`INSERT INTO shop_settings ("tenantId","shopName",phone,cnpj,address) VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("tenantId") DO NOTHING\`,
    [branchId, data.name, data.phone??null, data.cnpj??null, data.address??null]
  );`,
`  const existsSettings = await _pool.query(\`SELECT id FROM shop_settings WHERE "tenantId" = $1 LIMIT 1\`, [branchId]);
  if (existsSettings.rows.length === 0) {
    await _pool.query(
      \`INSERT INTO shop_settings ("tenantId","shopName",phone,cnpj,address) VALUES ($1,$2,$3,$4,$5)\`,
      [branchId, data.name, data.phone??null, data.cnpj??null, data.address??null]
    );
  }`,
'shop_settings check-first (fix ON CONFLICT)');

// 2. CSP: liberar o beacon do Cloudflare (injetado automaticamente pelo proxy) e fontes data:
patch('server/_core/index.ts',
`      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://accounts.google.com; " +`,
`      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://accounts.google.com https://static.cloudflareinsights.com; " +`,
'CSP script-src cloudflareinsights');

patch('server/_core/index.ts',
`      "font-src 'self' https://fonts.gstatic.com; " +`,
`      "font-src 'self' data: https://fonts.gstatic.com; " +`,
'CSP font-src data:');

patch('server/_core/index.ts',
`      "connect-src 'self' https://accounts.google.com; " +`,
`      "connect-src 'self' https://accounts.google.com https://cloudflareinsights.com https://static.cloudflareinsights.com; " +`,
'CSP connect-src cloudflareinsights');

console.log('\\nTotal: ' + ok + '/4');
