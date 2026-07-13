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

applyFixes('server/_core/index.ts', [ ['ICBhcHAuZ2V0KCIvbGFuZGluZyIsIChfcmVxLCByZXMpID0+IHsKICAgIHJlcy5zZXRIZWFkZXIoIkNhY2hlLUNvbnRyb2wiLCAibm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUiKTsKICAgIHJlcy5zZXRIZWFkZXIoIlByYWdtYSIsICJuby1jYWNoZSIpOwogICAgcmVzLnNldEhlYWRlcigiRXhwaXJlcyIsICIwIik7CiAgICByZXMuc2VuZEZpbGUobGFuZGluZ1BhdGgpOwogIH0pOwoK', 'ICBhcHAuZ2V0KCIvbGFuZGluZyIsIChfcmVxLCByZXMpID0+IHsKICAgIHJlcy5zZXRIZWFkZXIoIkNhY2hlLUNvbnRyb2wiLCAibm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUiKTsKICAgIHJlcy5zZXRIZWFkZXIoIlByYWdtYSIsICJuby1jYWNoZSIpOwogICAgcmVzLnNldEhlYWRlcigiRXhwaXJlcyIsICIwIik7CiAgICByZXMuc2VuZEZpbGUobGFuZGluZ1BhdGgpOwogIH0pOwoKICAvLyDilIDilIAgU3VicGFnaW5hcyBkYSBsYW5kaW5nIChyZWVzdHJ1dHVyYcOnw6NvOiBjYWRhIGFiYSBkbyBtZW51IGNvbSBjb250ZcO6ZG8gcHLDs3ByaW8pIOKUgOKUgAogIGNvbnN0IGxhbmRpbmdTdWJwYWdlcyA9IFsic2lzdGVtYSIsICJwYWdhbWVudG9zIiwgImFzc2luYXR1cmFzIiwgImNvbW8tZnVuY2lvbmEiXTsKICBmb3IgKGNvbnN0IHNsdWcgb2YgbGFuZGluZ1N1YnBhZ2VzKSB7CiAgICBjb25zdCBkZXZQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgIi4uIiwgImxhbmRpbmciLCBgJHtzbHVnfS5odG1sYCk7CiAgICBjb25zdCBwcm9kUGF0aCA9IHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCAic2VydmVyIiwgImxhbmRpbmciLCBgJHtzbHVnfS5odG1sYCk7CiAgICBjb25zdCBzdWJwYWdlUGF0aCA9IGV4aXN0c1N5bmMoZGV2UGF0aCkgPyBkZXZQYXRoIDogcHJvZFBhdGg7CiAgICBhcHAuZ2V0KGAvJHtzbHVnfWAsIChfcmVxLCByZXMpID0+IHsKICAgICAgcmVzLnNldEhlYWRlcigiQ2FjaGUtQ29udHJvbCIsICJuby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZSIpOwogICAgICByZXMuc2V0SGVhZGVyKCJQcmFnbWEiLCAibm8tY2FjaGUiKTsKICAgICAgcmVzLnNldEhlYWRlcigiRXhwaXJlcyIsICIwIik7CiAgICAgIHJlcy5zZW5kRmlsZShzdWJwYWdlUGF0aCk7CiAgICB9KTsKICB9Cgo='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/_core/index.ts');
console.log('  git commit -m "feat: rotas para subpaginas da landing"');
console.log('  git push');