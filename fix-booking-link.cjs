const fs = require('fs');
function b64(s){return Buffer.from(s,'base64').toString('utf8');}

function applyFixes(path, pairs) {
  let content = fs.readFileSync(path, 'utf8');
  const hadCRLF = content.includes('\r\n');
  if (hadCRLF) content = content.split('\r\n').join('\n');
  let applied = 0;
  for (const [oldB64, newB64] of pairs) {
    const oldS = b64(oldB64), newS = b64(newB64);
    const matchCount = content.split(oldS).length - 1;
    if (matchCount === 0) { console.log('[AVISO] ' + path + ': edicao nao encontrada - pulei.'); continue; }
    content = content.split(oldS).join(newS);
    applied += matchCount;
  }
  if (hadCRLF) content = content.split('\n').join('\r\n');
  fs.writeFileSync(path, content, 'utf8');
  console.log(path + ': ' + applied + ' edicoes aplicadas (todas as ocorrencias). (CRLF: ' + hadCRLF + ')');
}

applyFixes('server/admin-routes.ts', [ ['Y29uc3QgYm9va2luZ1VybCA9IGN1cnJlbnRTbHVnID8gYGh0dHBzOi8vdXNlYmFyYmVycHJvLmNvbS8ke2N1cnJlbnRTbHVnfS9hZ2VuZGFyYCA6ICIiOw==', 'Y29uc3QgYm9va2luZ1VybCA9IGN1cnJlbnRTbHVnID8gYGh0dHBzOi8vdXNlYmFyYmVycHJvLmNvbS9wdWIvJHtjdXJyZW50U2x1Z30vYWdlbmRhcmAgOiAiIjs='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/admin-routes.ts');
console.log('  git commit -m "fix: link direto de agendamento apontava errado"');
console.log('  git push');