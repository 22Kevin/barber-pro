const fs = require('fs');
function b64(s){return Buffer.from(s,'base64').toString('utf8');}

function applyFixes(path, pairs) {
  let content = fs.readFileSync(path, 'utf8');
  const hadCRLF = content.includes('\r\n');
  if (hadCRLF) content = content.split('\r\n').join('\n');
  let applied = 0;
  for (const [oldB64, newB64] of pairs) {
    const oldS = b64(oldB64), newS = b64(newB64);
    if (!content.includes(oldS)) { console.log('[AVISO] ' + path + ': edicao ' + (applied+1) + ' nao encontrada - pulei.'); continue; }
    content = content.replace(oldS, newS);
    applied++;
  }
  if (hadCRLF) content = content.split('\n').join('\r\n');
  fs.writeFileSync(path, content, 'utf8');
  console.log(path + ': ' + applied + '/' + pairs.length + ' edicoes aplicadas. (CRLF: ' + hadCRLF + ')');
}

applyFixes('server/admin-routes.ts', [ ['ICAgICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNoYW5nZUFwcHRTdGF0dXMoaWQsIHN0YXR1cywgYnRuKSB7CiAgICAgICAgICAgIC8vIENhbmNlbGFtZW50bzogY29uZmlybWFyIHByaW1laXJvCiAgICAgICAgICAgIGlmIChzdGF0dXMgPT09ICdjYW5jZWxsZWQnKSB7CiAgICAgICAgICAgICAgYnBDb25maXJtKHtpY29uOifinYwnLHRpdGxlOidDYW5jZWxhciBhZ2VuZGFtZW50bycsbXNnOidEZXNlamEgY2FuY2VsYXIgZXN0ZSBhZ2VuZGFtZW50bz8nLG9rTGFiZWw6J0NhbmNlbGFyIGFnZW5kYW1lbnRvJyxkYW5nZXI6dHJ1ZSxvbkNvbmZpcm06ZnVuY3Rpb24oKXsKICAgICAgICAgICAgfQogICAgICAgICAgICBidG4uZGlzYWJsZWQgPSB0cnVlOyBidG4uc3R5bGUub3BhY2l0eSA9ICcwLjUnOw==', 'ICAgICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNoYW5nZUFwcHRTdGF0dXMoaWQsIHN0YXR1cywgYnRuKSB7CiAgICAgICAgICAgIGJ0bi5kaXNhYmxlZCA9IHRydWU7IGJ0bi5zdHlsZS5vcGFjaXR5ID0gJzAuNSc7'] ]);

console.log('');
console.log("Pronto. Confira com 'git diff --stat'.");
console.log('  git add server/admin-routes.ts');
console.log('  git commit -m "fix: refactor incompleto em changeApptStatus"');
console.log('  git push');