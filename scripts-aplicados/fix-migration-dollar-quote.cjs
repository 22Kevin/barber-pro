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
    content = content.replace(oldS, () => newS);
    applied++;
  }
  if (hadCRLF) content = content.split('\n').join('\r\n');
  fs.writeFileSync(path, content, 'utf8');
  console.log(path + ': ' + applied + '/' + pairs.length + ' edicoes aplicadas. (CRLF: ' + hadCRLF + ')');
}

applyFixes('server/auto-migrate.ts', [ ['ICAgIHsgbmFtZTogIm9ubGluZV9wYXltZW50X2JpbGxpbmcuUElYX0RJUkVUTyIsIHNxbDogYERPICQgQkVHSU4gQUxURVIgVFlQRSBvbmxpbmVfcGF5bWVudF9iaWxsaW5nIEFERCBWQUxVRSBJRiBOT1QgRVhJU1RTICdQSVhfRElSRVRPJzsgRVhDRVBUSU9OIFdIRU4gb3RoZXJzIFRIRU4gbnVsbDsgRU5EICRgIH0s', 'ICAgIHsgbmFtZTogIm9ubGluZV9wYXltZW50X2JpbGxpbmcuUElYX0RJUkVUTyIsIHNxbDogYERPICRkbyQgQkVHSU4gQUxURVIgVFlQRSBvbmxpbmVfcGF5bWVudF9iaWxsaW5nIEFERCBWQUxVRSBJRiBOT1QgRVhJU1RTICdQSVhfRElSRVRPJzsgRVhDRVBUSU9OIFdIRU4gb3RoZXJzIFRIRU4gbnVsbDsgRU5EICRkbyRgIH0s'] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/auto-migrate.ts');
console.log('  git commit -m "fix: corrigir dollar-quoting na migracao PIX_DIRETO"');
console.log('  git push');