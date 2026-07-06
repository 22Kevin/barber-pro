const fs = require('fs');

const path = 'server/admin-routes.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '<div class=\\"brand-stat-value\\">500+</div>',
  '<div class=\\"brand-stat-value\\">14</div>'
);
content = content.replace(
  '<div class=\\"brand-stat-label\\">Barbearias</div>',
  '<div class=\\"brand-stat-label\\">Dias gr\u00e1tis</div>'
);
content = content.replace(
  '<div class=\\"brand-stat-value\\">98%</div>',
  '<div class=\\"brand-stat-value\\">5min</div>'
);
content = content.replace(
  '<div class=\\"brand-stat-label\\">Satisfa\u00e7\u00e3o</div>',
  '<div class=\\"brand-stat-label\\">Para configurar</div>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Feito!');
