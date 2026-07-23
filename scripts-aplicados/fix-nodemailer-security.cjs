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

applyFixes('package.json', [ ['ICAgICJub2RlbWFpbGVyIjogIl44LjAuMSIs', 'ICAgICJub2RlbWFpbGVyIjogIl45LjAuMyIs'] ]);

console.log('');
console.log('Depois disso, roda: npm install');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add package.json');
console.log('  git commit -m "fix(security): atualizar nodemailer para 9.0.3"');
console.log('  git push');