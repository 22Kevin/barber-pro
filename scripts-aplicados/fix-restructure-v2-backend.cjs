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

applyFixes('server/_core/index.ts', [ ['ICBjb25zdCBsYW5kaW5nU3VicGFnZXMgPSBbInNpc3RlbWEiLCAicGFnYW1lbnRvcyIsICJhc3NpbmF0dXJhcyIsICJjb21vLWZ1bmNpb25hIl07', 'ICBjb25zdCBsYW5kaW5nU3VicGFnZXMgPSBbInNpc3RlbWEiLCAicGFnYW1lbnRvcyIsICJhc3NpbmF0dXJhcyJdOw=='], ['ICAvLyBQw6FnaW5hcyBsZWdhaXMg4oCUIGNvbnRlw7pkbyBlbWJ1dGlkbyBubyBidW5kbGUKICAvLyDilIDilIAgU0VPOiBmYXZpY29uIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgA==', 'ICAvLyAvY29tby1mdW5jaW9uYSB2aXJvdSBzZcOnw6NvIGRhIGhvbWUgKG1lc2NsYWRhIGNvbSBBcHAgTW9iaWxlKSDigJQgbWFudMOpbSBsaW5rIGFudGlnbyBmdW5jaW9uYW5kbwogIGFwcC5nZXQoIi9jb21vLWZ1bmNpb25hIiwgKF9yZXEsIHJlcykgPT4gewogICAgcmVzLnJlZGlyZWN0KDMwMSwgIi8jY29tby1mdW5jaW9uYSIpOwogIH0pOwoKICAvLyBQw6FnaW5hcyBsZWdhaXMg4oCUIGNvbnRlw7pkbyBlbWJ1dGlkbyBubyBidW5kbGUKICAvLyDilIDilIAgU0VPOiBmYXZpY29uIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgA=='] ]);

const path = require('path');
const comoFuncionaPath = path.join('server', 'landing', 'como-funciona.html');
if (fs.existsSync(comoFuncionaPath)) { fs.unlinkSync(comoFuncionaPath); console.log('server/landing/como-funciona.html removido.'); }
else { console.log('server/landing/como-funciona.html ja nao existe.'); }

console.log('');
console.log("Confira com 'git status' / 'git diff --stat' e depois:");
console.log('  git add -A server/_core/index.ts server/landing/');
console.log('  git commit -m "feat: rotas atualizadas apos reestruturacao (como-funciona virou secao da home)"');
console.log('  git push');