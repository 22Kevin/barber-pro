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

applyFixes('app/admin/(tabs)/integracoes.tsx', [ ['CmNvbnN0IFdFQl9DTElFTlRfSUQgPSBwcm9jZXNzLmVudi5FWFBPX1BVQkxJQ19HT09HTEVfV0VCX0NMSUVOVF9JRCA/PyAiIjsKY29uc3QgSU9TX0NMSUVOVF9JRCA9IHByb2Nlc3MuZW52LkVYUE9fUFVCTElDX0dPT0dMRV9JT1NfQ0xJRU5UX0lEID8/ICIiOwpjb25zdCBDQUxFTkRBUl9TQ09QRSA9ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2NhbGVuZGFyLmV2ZW50cyI7Cgpjb25zdCBHT0xEID0gIiNDOUE4NEMiOwpjb25zdCBCRyA9ICIjMEEwQTBBIjs=', 'CmNvbnN0IFdFQl9DTElFTlRfSUQgPSBwcm9jZXNzLmVudi5FWFBPX1BVQkxJQ19HT09HTEVfV0VCX0NMSUVOVF9JRCA/PyAiIjsKY29uc3QgSU9TX0NMSUVOVF9JRCA9IHByb2Nlc3MuZW52LkVYUE9fUFVCTElDX0dPT0dMRV9JT1NfQ0xJRU5UX0lEID8/ICIiOwovLyBQcmVjaXNhIGRvcyBET0lTIGVzY29wb3M6IGNhbGVuZGFyLmV2ZW50cyAoZ2VyZW5jaWFyIGV2ZW50b3MpIGUKLy8gY2FsZW5kYXIuYXBwLmNyZWF0ZWQgKGNyaWFyIG8gY2FsZW5kw6FyaW8gZGVkaWNhZG8gIkJhcmJlciBQcm8iIGVtIHNpKS4KLy8gTyBmbHV4byB3ZWIgasOhIHBlZGlhIG9zIGRvaXMgKHNlcnZlci9nb29nbGUtY2FsZW5kYXIudHMpIC0gZXNzZSBhcXVpCi8vIChmbHV4byBuYXRpdm8gZG8gYXBwKSBzw7MgcGVkaWEgY2FsZW5kYXIuZXZlbnRzLCBjYXVzYW5kbyAiaW5zdWZmaWNpZW50Ci8vIGF1dGhlbnRpY2F0aW9uIHNjb3BlcyIgYW8gdGVudGFyIGNyaWFyIG8gY2FsZW5kw6FyaW8uCmNvbnN0IENBTEVOREFSX1NDT1BFUyA9IFsKICAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC9jYWxlbmRhci5ldmVudHMiLAogICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2NhbGVuZGFyLmFwcC5jcmVhdGVkIiwKXTsKCmNvbnN0IEdPTEQgPSAiI0M5QTg0QyI7CmNvbnN0IEJHID0gIiMwQTBBMEEiOw=='], ['ICAgICAgICBpb3NDbGllbnRJZDogSU9TX0NMSUVOVF9JRCB8fCB1bmRlZmluZWQsCiAgICAgICAgb2ZmbGluZUFjY2VzczogdHJ1ZSwKICAgICAgICBmb3JjZUNvZGVGb3JSZWZyZXNoVG9rZW46IHRydWUsCiAgICAgICAgc2NvcGVzOiBbQ0FMRU5EQVJfU0NPUEVdLAogICAgICB9KTsKICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR29vZ2xlU2lnbmluLnNpZ25JbigpOwogICAgICBjb25zdCBzZXJ2ZXJBdXRoQ29kZSA9IHJlc3VsdD8uZGF0YT8uc2VydmVyQXV0aENvZGUgPz8gcmVzdWx0Py5zZXJ2ZXJBdXRoQ29kZTs=', 'ICAgICAgICBpb3NDbGllbnRJZDogSU9TX0NMSUVOVF9JRCB8fCB1bmRlZmluZWQsCiAgICAgICAgb2ZmbGluZUFjY2VzczogdHJ1ZSwKICAgICAgICBmb3JjZUNvZGVGb3JSZWZyZXNoVG9rZW46IHRydWUsCiAgICAgICAgc2NvcGVzOiBDQUxFTkRBUl9TQ09QRVMsCiAgICAgIH0pOwogICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBHb29nbGVTaWduaW4uc2lnbkluKCk7CiAgICAgIGNvbnN0IHNlcnZlckF1dGhDb2RlID0gcmVzdWx0Py5kYXRhPy5zZXJ2ZXJBdXRoQ29kZSA/PyByZXN1bHQ/LnNlcnZlckF1dGhDb2RlOw=='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add \"app/admin/(tabs)/integracoes.tsx\"');
console.log('  git commit -m "fix: escopo calendar.app.created no fluxo nativo"');
console.log('  git push');