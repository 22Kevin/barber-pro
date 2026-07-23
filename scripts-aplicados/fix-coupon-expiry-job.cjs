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

applyFixes('server/_core/index.ts', [ ['aW1wb3J0IHsgc3RhcnRUcmlhbEV4cGlyeUpvYiB9IGZyb20gIi4uL3RyaWFsLWV4cGlyeS1qb2IiOw==', 'aW1wb3J0IHsgc3RhcnRUcmlhbEV4cGlyeUpvYiB9IGZyb20gIi4uL3RyaWFsLWV4cGlyeS1qb2IiOwppbXBvcnQgeyBzdGFydENvdXBvbkV4cGlyeUpvYiB9IGZyb20gIi4uL2NvdXBvbi1leHBpcnktam9iIjs='], ['ICAgIHN0YXJ0VHJpYWxFeHBpcnlKb2IoKTs=', 'ICAgIHN0YXJ0VHJpYWxFeHBpcnlKb2IoKTsKICAgIHN0YXJ0Q291cG9uRXhwaXJ5Sm9iKCk7'] ]);

console.log('');
console.log('Nao esqueca de tambem colocar o arquivo NOVO server/coupon-expiry-job.ts (enviado completo).');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/_core/index.ts server/coupon-expiry-job.ts');
console.log('  git commit -m "feat: job de expiracao automatica de cupom"');
console.log('  git push');