const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');

// Corrigir o &quot; que quebrou o build
const bad = `openDeleteModal(\${b.id}, '\${esc(b.name).replace(/'/g,&quot;''&quot;)}')"`;
const good = `openDeleteModal(\${b.id}, '\${esc(b.name).replace(/'/g,"''")}')"`;

if (content.includes(bad)) {
  content = content.replace(bad, good);
  console.log('OK: &quot; corrigido');
} else {
  console.log('MISS — procurando openDeleteModal...');
  const idx = content.indexOf('openDeleteModal(${b.id}');
  if (idx !== -1) console.log(JSON.stringify(content.slice(idx, idx+120)));
}

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
