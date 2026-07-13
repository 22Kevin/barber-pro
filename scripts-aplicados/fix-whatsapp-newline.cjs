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

applyFixes('server/admin-routes.ts', [ ['JykuXG5cbkNvcGllIGUgY29sZSBubyBzZXUgYmFuY286XG5cbicgKyBwaXhDb2Rl', 'JykuXFxuXFxuQ29waWUgZSBjb2xlIG5vIHNldSBiYW5jbzpcXG5cXG4nICsgcGl4Q29kZQ=='] ]);

console.log('');
console.log("Pronto. Confira com 'git diff --stat' -- deve mostrar so 1 linha alterada.");
console.log('Depois:');
console.log('  git add server/admin-routes.ts');
console.log('  git commit -m "fix: quebra de linha real na mensagem do WhatsApp Pix"');
console.log('  git push');