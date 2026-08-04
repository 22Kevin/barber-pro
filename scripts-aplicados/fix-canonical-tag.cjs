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

applyFixes('server/public-routes.ts', [ ['ICAke3NsdWcgPyBgPG1ldGEgcHJvcGVydHk9Im9nOnVybCIgY29udGVudD0iaHR0cHM6Ly91c2ViYXJiZXJwcm8uY29tLyR7c2x1Z30iIC8+PGxpbmsgcmVsPSJjYW5vbmljYWwiIGhyZWY9Imh0dHBzOi8vdXNlYmFyYmVycHJvLmNvbS8ke3NsdWd9IiAvPmAgOiAiIn0=', 'ICAke3NsdWcgPyBgPG1ldGEgcHJvcGVydHk9Im9nOnVybCIgY29udGVudD0iaHR0cHM6Ly91c2ViYXJiZXJwcm8uY29tL3B1Yi8ke3NsdWd9IiAvPjxsaW5rIHJlbD0iY2Fub25pY2FsIiBocmVmPSJodHRwczovL3VzZWJhcmJlcnByby5jb20vcHViLyR7c2x1Z30iIC8+YCA6ICIifQ=='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/public-routes.ts');
console.log('  git commit -m "fix: corrigir tag canonica invertida"');
console.log('  git push');