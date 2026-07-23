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

applyFixes('app/admin/(tabs)/integracoes.tsx', [ ['ICAgICAgYXdhaXQgR29vZ2xlU2lnbmluLmNvbmZpZ3VyZSh7CiAgICAgICAgd2ViQ2xpZW50SWQ6IFdFQl9DTElFTlRfSUQsCiAgICAgICAgaW9zQ2xpZW50SWQ6IElPU19DTElFTlRfSUQgfHwgdW5kZWZpbmVkLAogICAgICAgIG9mZmxpbmVBY2Nlc3M6IHRydWUsCiAgICAgICAgc2NvcGVzOiBbQ0FMRU5EQVJfU0NPUEVdLAogICAgICB9KTs=', 'ICAgICAgYXdhaXQgR29vZ2xlU2lnbmluLmNvbmZpZ3VyZSh7CiAgICAgICAgd2ViQ2xpZW50SWQ6IFdFQl9DTElFTlRfSUQsCiAgICAgICAgaW9zQ2xpZW50SWQ6IElPU19DTElFTlRfSUQgfHwgdW5kZWZpbmVkLAogICAgICAgIG9mZmxpbmVBY2Nlc3M6IHRydWUsCiAgICAgICAgZm9yY2VDb2RlRm9yUmVmcmVzaFRva2VuOiB0cnVlLAogICAgICAgIHNjb3BlczogW0NBTEVOREFSX1NDT1BFXSwKICAgICAgfSk7'] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add \"app/admin/(tabs)/integracoes.tsx\"');
console.log('  git commit -m "fix: forcar refresh_token na conexao Google Agenda"');
console.log('  git push');