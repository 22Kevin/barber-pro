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

applyFixes('server/_core/index.ts', [ ['ICAgICAgIlVzZXItYWdlbnQ6ICoiLAogICAgICAiQWxsb3c6IC8iLAogICAgICAiRGlzYWxsb3c6IC9hZG1pbiIsCiAgICAgICJEaXNhbGxvdzogL2FkbWluLWFwaSIsCiAgICAgICJEaXNhbGxvdzogL3N1cGVyYWRtaW4iLAogICAgICAiRGlzYWxsb3c6IC9hcGkvIiwKICAgICAgIkRpc2FsbG93OiAvYXBwIiw=', 'ICAgICAgIlVzZXItYWdlbnQ6ICoiLAogICAgICAiQWxsb3c6IC8iLAogICAgICAiRGlzYWxsb3c6IC9hZG1pbiIsCiAgICAgICJEaXNhbGxvdzogL2FkbWluLWFwaSIsCiAgICAgICJEaXNhbGxvdzogL3N1cGVyYWRtaW4iLAogICAgICAiRGlzYWxsb3c6IC9hcGkvIiwKICAgICAgIkRpc2FsbG93OiAvcHViLWFwaS8iLAogICAgICAiRGlzYWxsb3c6IC9hcHAiLA=='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/_core/index.ts');
console.log('  git commit -m "fix: bloquear pub-api no robots.txt"');
console.log('  git push');