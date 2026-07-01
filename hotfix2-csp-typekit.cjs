const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// ── CSP: adicionar use.typekit.net em font-src e style-src ───────────────────
patch('server/_core/index.ts',
  `"font-src 'self' data: https://fonts.gstatic.com; " +`,
  `"font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net https://p.typekit.net; " +`,
  'CSP font-src typekit'
);

patch('server/_core/index.ts',
  `"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +`,
  `"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net; " +`,
  'CSP style-src typekit'
);

patch('server/_core/index.ts',
  `"connect-src 'self' https://accounts.google.com https://cloudflareinsights.com https://static.cloudflareinsights.com; " +`,
  `"connect-src 'self' https://accounts.google.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://performance.typekit.net; " +`,
  'CSP connect-src typekit'
);

// ── db.ts: fix ON CONFLICT → check-first ────────────────────────────────────
patch('server/db.ts',
  `  await _pool.query(
    \`INSERT INTO shop_settings ("tenantId","shopName",phone,cnpj,address) VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("tenantId") DO NOTHING\`,
    [branchId, data.name, data.phone??null, data.cnpj??null, data.address??null]
  );`,
  `  const _ss = await _pool.query('SELECT id FROM shop_settings WHERE "tenantId" = $1 LIMIT 1', [branchId]);
  if (_ss.rows.length === 0) {
    await _pool.query(
      'INSERT INTO shop_settings ("tenantId","shopName",phone,cnpj,address) VALUES ($1,$2,$3,$4,$5)',
      [branchId, data.name, data.phone??null, data.cnpj??null, data.address??null]
    );
  }`,
  'db.ts ON CONFLICT fix'
);

console.log('\\nTotal: ' + ok + '/4');
