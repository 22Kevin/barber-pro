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

applyFixes('server/landing/index.html', [ ['aHR0cHM6Ly93YS5tZS81NTE2OTk5OTk5OTk5IiB0YXJnZXQ9Il9ibGFuayIgY2xhc3M9ImZvb3Rlci1zb2NpYWwtbGluayI=', 'aHR0cHM6Ly93YS5tZS81NTE2OTkyODgzNjQyIiB0YXJnZXQ9Il9ibGFuayIgY2xhc3M9ImZvb3Rlci1zb2NpYWwtbGluayI='], ['aHR0cHM6Ly93YS5tZS81NTExOTk5OTk5OTk5P3RleHQ9T2wlQzMlQTElMkMrcXVlcm8rc2FiZXIrbWFpcytzb2JyZStvK0JhcmJlcitQcm8iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0id2EtZmxvYXQi', 'aHR0cHM6Ly93YS5tZS81NTE2OTkyODgzNjQyP3RleHQ9T2wlQzMlQTElMkMrcXVlcm8rc2FiZXIrbWFpcytzb2JyZStvK0JhcmJlcitQcm8iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0id2EtZmxvYXQi'] ]);
applyFixes('server/landing/sistema.html', [ ['aHR0cHM6Ly93YS5tZS81NTE2OTk5OTk5OTk5IiB0YXJnZXQ9Il9ibGFuayIgY2xhc3M9ImZvb3Rlci1zb2NpYWwtbGluayI=', 'aHR0cHM6Ly93YS5tZS81NTE2OTkyODgzNjQyIiB0YXJnZXQ9Il9ibGFuayIgY2xhc3M9ImZvb3Rlci1zb2NpYWwtbGluayI='], ['aHR0cHM6Ly93YS5tZS81NTExOTk5OTk5OTk5P3RleHQ9T2wlQzMlQTElMkMrcXVlcm8rc2FiZXIrbWFpcytzb2JyZStvK0JhcmJlcitQcm8iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0id2EtZmxvYXQi', 'aHR0cHM6Ly93YS5tZS81NTE2OTkyODgzNjQyP3RleHQ9T2wlQzMlQTElMkMrcXVlcm8rc2FiZXIrbWFpcytzb2JyZStvK0JhcmJlcitQcm8iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0id2EtZmxvYXQi'] ]);
applyFixes('server/landing/pagamentos.html', [ ['aHR0cHM6Ly93YS5tZS81NTE2OTk5OTk5OTk5IiB0YXJnZXQ9Il9ibGFuayIgY2xhc3M9ImZvb3Rlci1zb2NpYWwtbGluayI=', 'aHR0cHM6Ly93YS5tZS81NTE2OTkyODgzNjQyIiB0YXJnZXQ9Il9ibGFuayIgY2xhc3M9ImZvb3Rlci1zb2NpYWwtbGluayI='], ['aHR0cHM6Ly93YS5tZS81NTExOTk5OTk5OTk5P3RleHQ9T2wlQzMlQTElMkMrcXVlcm8rc2FiZXIrbWFpcytzb2JyZStvK0JhcmJlcitQcm8iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0id2EtZmxvYXQi', 'aHR0cHM6Ly93YS5tZS81NTE2OTkyODgzNjQyP3RleHQ9T2wlQzMlQTElMkMrcXVlcm8rc2FiZXIrbWFpcytzb2JyZStvK0JhcmJlcitQcm8iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0id2EtZmxvYXQi'] ]);
applyFixes('server/landing/assinaturas.html', [ ['aHR0cHM6Ly93YS5tZS81NTE2OTk5OTk5OTk5IiB0YXJnZXQ9Il9ibGFuayIgY2xhc3M9ImZvb3Rlci1zb2NpYWwtbGluayI=', 'aHR0cHM6Ly93YS5tZS81NTE2OTkyODgzNjQyIiB0YXJnZXQ9Il9ibGFuayIgY2xhc3M9ImZvb3Rlci1zb2NpYWwtbGluayI='], ['aHR0cHM6Ly93YS5tZS81NTExOTk5OTk5OTk5P3RleHQ9T2wlQzMlQTElMkMrcXVlcm8rc2FiZXIrbWFpcytzb2JyZStvK0JhcmJlcitQcm8iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0id2EtZmxvYXQi', 'aHR0cHM6Ly93YS5tZS81NTE2OTkyODgzNjQyP3RleHQ9T2wlQzMlQTElMkMrcXVlcm8rc2FiZXIrbWFpcytzb2JyZStvK0JhcmJlcitQcm8iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0id2EtZmxvYXQi'] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/landing/index.html server/landing/sistema.html server/landing/pagamentos.html server/landing/assinaturas.html');
console.log('  git commit -m "fix: numero do WhatsApp atualizado"');
console.log('  git push');