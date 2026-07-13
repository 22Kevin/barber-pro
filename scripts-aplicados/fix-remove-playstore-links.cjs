const fs = require('fs');
function b64(s){return Buffer.from(s,'base64').toString('utf8');}

function applyOnce(content, oldS, newS, label) {
  const idx = content.indexOf(oldS);
  if (idx === -1) { console.log('[AVISO] nao encontrado: ' + label); return content; }
  return content.slice(0, idx) + newS + content.slice(idx + oldS.length);
}

const path = 'server/landing/index.html';
let content = fs.readFileSync(path, 'utf8');
const hadCRLF = content.includes('\r\n');
if (hadCRLF) content = content.split('\r\n').join('\n');

// 4 substituicoes de abertura <a ...> -> <span ...>
content = applyOnce(content, b64('PGEgaHJlZj0iaHR0cHM6Ly9wbGF5Lmdvb2dsZS5jb20vc3RvcmUvYXBwcy9kZXRhaWxzP2lkPWNvbS5lbGR1bmFyaS5iYXJiZXJwcm8iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIG5vcmVmZXJyZXIiIHN0eWxlPSJkaXNwbGF5OmlubGluZS1ibG9jazttYXJnaW4tdG9wOjEycHg7b3BhY2l0eTowLjg1O3RyYW5zaXRpb246b3BhY2l0eSAwLjJzLCB0cmFuc2Zvcm0gMC4yczsiIG9ubW91c2VvdmVyPSJ0aGlzLnN0eWxlLm9wYWNpdHk9JzEnO3RoaXMuc3R5bGUudHJhbnNmb3JtPSdzY2FsZSgxLjAzKSciIG9ubW91c2VvdXQ9InRoaXMuc3R5bGUub3BhY2l0eT0nMC44NSc7dGhpcy5zdHlsZS50cmFuc2Zvcm09J3NjYWxlKDEpJyI+'), b64('PHNwYW4gc3R5bGU9ImRpc3BsYXk6aW5saW5lLWJsb2NrO21hcmdpbi10b3A6MTJweDtjdXJzb3I6ZGVmYXVsdDsiPg=='), 'abertura 1');
content = applyOnce(content, b64('PGEgaHJlZj0iaHR0cHM6Ly9wbGF5Lmdvb2dsZS5jb20vc3RvcmUvYXBwcy9kZXRhaWxzP2lkPWNvbS5lbGR1bmFyaS5iYXJiZXJwcm8iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIG5vcmVmZXJyZXIiIGNsYXNzPSJhcHAtc3RvcmUtYmFkZ2UiPg=='), b64('PHNwYW4gY2xhc3M9ImFwcC1zdG9yZS1iYWRnZSIgc3R5bGU9ImN1cnNvcjpkZWZhdWx0OyI+'), 'abertura 2');
content = applyOnce(content, b64('PGEgaHJlZj0iaHR0cHM6Ly9wbGF5Lmdvb2dsZS5jb20vc3RvcmUvYXBwcy9kZXRhaWxzP2lkPWNvbS5lbGR1bmFyaS5iYXJiZXJwcm8iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIG5vcmVmZXJyZXIiIGNsYXNzPSJhcHAtc3RvcmUtYmFkZ2UiIHN0eWxlPSJtYXJnaW4tdG9wOjE4cHg7ZGlzcGxheTppbmxpbmUtYmxvY2siPg=='), b64('PHNwYW4gY2xhc3M9ImFwcC1zdG9yZS1iYWRnZSIgc3R5bGU9Im1hcmdpbi10b3A6MThweDtkaXNwbGF5OmlubGluZS1ibG9jaztjdXJzb3I6ZGVmYXVsdDsiPg=='), 'abertura 3');
content = applyOnce(content, b64('PGEgaHJlZj0iaHR0cHM6Ly9wbGF5Lmdvb2dsZS5jb20vc3RvcmUvYXBwcy9kZXRhaWxzP2lkPWNvbS5lbGR1bmFyaS5iYXJiZXJwcm8iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIG5vcmVmZXJyZXIiIGNsYXNzPSJmb290ZXItc3RvcmUtYmFkZ2UiPg=='), b64('PHNwYW4gY2xhc3M9ImZvb3Rlci1zdG9yZS1iYWRnZSIgc3R5bGU9ImN1cnNvcjpkZWZhdWx0OyI+'), 'abertura 4');

// fechamentos </a> -> </span> (2 padroes de indentacao, 4 ocorrencias no total)
for (const [oldB64, newB64] of [
  ['cGxheXN0b3JlLXNvb24tZmlsbCI+PC9zcGFuPjwvc3Bhbj48L3NwYW4+PC9zcGFuPgogICAgICA8L2E+', 'cGxheXN0b3JlLXNvb24tZmlsbCI+PC9zcGFuPjwvc3Bhbj48L3NwYW4+PC9zcGFuPgogICAgICA8L3NwYW4+'],
  ['cGxheXN0b3JlLXNvb24tZmlsbCI+PC9zcGFuPjwvc3Bhbj48L3NwYW4+PC9zcGFuPgogICAgICAgIDwvYT4=', 'cGxheXN0b3JlLXNvb24tZmlsbCI+PC9zcGFuPjwvc3Bhbj48L3NwYW4+PC9zcGFuPgogICAgICAgIDwvc3Bhbj4='],
]) {
  const oldS = b64(oldB64), newS = b64(newB64);
  let idx;
  while ((idx = content.indexOf(oldS)) !== -1) {
    content = content.slice(0, idx) + newS + content.slice(idx + oldS.length);
  }
}

if (hadCRLF) content = content.split('\n').join('\r\n');
fs.writeFileSync(path, content, 'utf8');
console.log('Concluido. Confira com git diff --stat.');
console.log('  git add server/landing/index.html');
console.log('  git commit -m "fix: remover links do Google Play"');
console.log('  git push');