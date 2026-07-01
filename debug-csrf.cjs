const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// Adicionar log detalhado + solução mais permissiva para o problema do host
patch('server/_core/index.ts',
  `    console.warn("[csrf] Bloqueado POST de origem não autorizada:", origin, req.path);
    res.status(403).json({ error: "Origem não autorizada" });`,
  `    console.warn("[csrf] BLOQUEADO — origin:", origin, "| host:", req.headers.host, "| path:", req.path, "| originHost:", (() => { try { return new URL(origin).host; } catch { return "INVALID"; } })());
    res.status(403).json({ error: "Origem não autorizada" });`,
  'log detalhado CSRF'
);

console.log('\nTotal: ' + ok);
