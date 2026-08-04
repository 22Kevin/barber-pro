const fs = require('fs');
const path = require('path');
function b64(s){return Buffer.from(s,'base64').toString('utf8');}

function applyFixes(path_, pairs) {
  let content = fs.readFileSync(path_, 'utf8');
  const hadCRLF = content.includes('\r\n');
  if (hadCRLF) content = content.split('\r\n').join('\n');
  let applied = 0;
  for (const [oldB64, newB64] of pairs) {
    const oldS = b64(oldB64), newS = b64(newB64);
    if (!content.includes(oldS)) { console.log('[AVISO] ' + path_ + ': edicao ' + (applied+1) + ' nao encontrada - pulei.'); continue; }
    content = content.replace(oldS, () => newS);
    applied++;
  }
  if (hadCRLF) content = content.split('\n').join('\r\n');
  fs.writeFileSync(path_, content, 'utf8');
  console.log(path_ + ': ' + applied + '/' + pairs.length + ' edicoes aplicadas. (CRLF: ' + hadCRLF + ')');
}

applyFixes('reaplicar-patches-metro.cjs', [ ['ICB7CiAgICBmcm9tOiAncGF0Y2hlcy9tZXRyby1idW5kbGVyLmpzJywKICAgIHRvOiAnbm9kZV9tb2R1bGVzL21ldHJvL3NyYy9CdW5kbGVyLmpzJywKICB9LAogIHsKICAgIGZyb206ICdwYXRjaGVzL21ldHJvLWRlcGVuZGVuY3ktZ3JhcGguanMnLAogICAgdG86ICdub2RlX21vZHVsZXMvbWV0cm8vc3JjL25vZGUtaGFzdGUvRGVwZW5kZW5jeUdyYXBoLmpzJywKICB9LApdOw==', 'ICB7CiAgICBmcm9tOiAncGF0Y2hlcy9tZXRyby1idW5kbGVyLmpzJywKICAgIHRvOiAnbm9kZV9tb2R1bGVzL21ldHJvL3NyYy9CdW5kbGVyLmpzJywKICB9LAogIC8vIG1ldHJvLWRlcGVuZGVuY3ktZ3JhcGguanMgUkVNT1ZJRE86IG8gYXJxdWl2byBzYWx2byBlbSBwYXRjaGVzLyBlc3RhdmEKICAvLyB0cnVuY2Fkby9pbmNvbXBsZXRvICgyOTggbGluaGFzLCBjb3J0YWRvIG5vIG1laW8pLCBjYXVzYW5kbwogIC8vICJTeW50YXhFcnJvcjogVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQiIGFvIHNlciBjb3BpYWRvIHBvciBjaW1hIGRvCiAgLy8gTWV0cm8gZGUgdmVyZGFkZSAtIHF1ZWJyYXZhIFRPREFTIGFzIGJ1aWxkcyAoQW5kcm9pZCBlIHdlYiksIG5hbyBzbwogIC8vIGNvcnJpZ2lhIG8gcHJvYmxlbWEgcXVlIGJ1c2NhdmFtb3MuIFJlbW92aWRvIGF0ZSB0ZXJtb3MgdW1hIHZlcnNhbwogIC8vIGludGVncmEgZSB2ZXJpZmljYWRhIGRlc3NlIHBhdGNoLgpdOw=='] ]);

// Remove o arquivo de patch corrompido do repositorio
const brokenPatch = 'patches/metro-dependency-graph.js';
if (fs.existsSync(brokenPatch)) {
  fs.unlinkSync(brokenPatch);
  console.log('Removido: ' + brokenPatch);
} else {
  console.log('[AVISO] ' + brokenPatch + ' ja nao existia - pulei.');
}

console.log('');
console.log("Confira com 'git status' e depois:");
console.log('  git add reaplicar-patches-metro.cjs');
console.log('  git rm patches/metro-dependency-graph.js');
console.log('  git commit -m "fix: remover patch corrompido do metro-dependency-graph.js"');
console.log('  git push');