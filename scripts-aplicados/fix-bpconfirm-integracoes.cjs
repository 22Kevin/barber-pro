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

applyFixes('server/admin-routes.ts', [ ['ICAgICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtnYXA6MTBweDtmbGV4LXdyYXA6d3JhcCI+CiAgICAgICAgICAgIDxmb3JtIG1ldGhvZD0iUE9TVCIgYWN0aW9uPSIvYWRtaW4vZ29vZ2xlLWNhbGVuZGFyL2Rpc2Nvbm5lY3QiIG9uc3VibWl0PSJyZXR1cm4gY29uZmlybSgnRGVzY29uZWN0YXIgYSBHb29nbGUgQWdlbmRhPyBPcyBhZ2VuZGFtZW50b3MgZnV0dXJvcyBkZWl4YW0gZGUgc2VyIHNpbmNyb25pemFkb3MuJyk7Ij4KICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9InN1Ym1pdCIgY2xhc3M9ImJ0biBidG4tZ2hvc3QiIHN0eWxlPSJjb2xvcjojRjg3MTcxO2JvcmRlci1jb2xvcjojRjg3MTcxNDQiPkRlc2NvbmVjdGFyPC9idXR0b24+CiAgICAgICAgICAgIDwvZm9ybT4KICAgICAgICAgICAgPGZvcm0gbWV0aG9kPSJQT1NUIiBhY3Rpb249Ii9hZG1pbi9nb29nbGUtY2FsZW5kYXIvaW1wb3J0IiBvbnN1Ym1pdD0icmV0dXJuIGNvbmZpcm0oJ0ltcG9ydGFyIGNvbXByb21pc3NvcyBxdWUgdm9jw6ogasOhIHRpbmhhIG5hIHN1YSBhZ2VuZGEgcGVzc29hbCBkbyBHb29nbGU/IENhZGEgdW0gdmlyYSB1bSBibG9xdWVpbyBkZSBob3LDoXJpbyBubyBCYXJiZXIgUHJvIChwcsOzeGltb3MgNjAgZGlhcyksIHBhcmEgZXZpdGFyIHF1ZSBhbGd1w6ltIGFnZW5kZSBlbSBjaW1hLiBJc3NvIG7Do28gYWZldGEgYWdlbmRhbWVudG9zIGRlIGNsaWVudGVzIGrDoSBleGlzdGVudGVzLicpOyI+CiAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPSJzdWJtaXQiIGNsYXNzPSJidG4gYnRuLWdob3N0IiBzdHlsZT0iY29sb3I6dmFyKC0tZ29sZCwgI0M5QTg0Qyk7Ym9yZGVyLWNvbG9yOnJnYmEoMjAxLDE2OCw3NiwwLjM1KSI+8J+TpSBJbXBvcnRhciBhZ2VuZGFtZW50b3MgZXhpc3RlbnRlczwvYnV0dG9uPgogICAgICAgICAgICA8L2Zvcm0+CiAgICAgICAgICA8L2Rpdj4KICAgICAgICBgIDogYA==', 'ICAgICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtnYXA6MTBweDtmbGV4LXdyYXA6d3JhcCI+CiAgICAgICAgICAgIDxmb3JtIG1ldGhvZD0iUE9TVCIgYWN0aW9uPSIvYWRtaW4vZ29vZ2xlLWNhbGVuZGFyL2Rpc2Nvbm5lY3QiIGlkPSJnY2FsRGlzY29ubmVjdEZvcm0iPgogICAgICAgICAgICAgIDxidXR0b24gdHlwZT0iYnV0dG9uIiBjbGFzcz0iYnRuIGJ0bi1naG9zdCIgc3R5bGU9ImNvbG9yOiNGODcxNzE7Ym9yZGVyLWNvbG9yOiNGODcxNzE0NCIgb25jbGljaz0iYnBDb25maXJtKHtpY29uOifwn5SMJyx0aXRsZTonRGVzY29uZWN0YXIgR29vZ2xlIEFnZW5kYScsbXNnOidPcyBhZ2VuZGFtZW50b3MgZnV0dXJvcyBkZWl4YW0gZGUgc2VyIHNpbmNyb25pemFkb3MuJyxva0xhYmVsOidEZXNjb25lY3RhcicsZGFuZ2VyOnRydWUsb25Db25maXJtOmZ1bmN0aW9uKCl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2djYWxEaXNjb25uZWN0Rm9ybScpLnN1Ym1pdCgpO319KSI+RGVzY29uZWN0YXI8L2J1dHRvbj4KICAgICAgICAgICAgPC9mb3JtPgogICAgICAgICAgICA8Zm9ybSBtZXRob2Q9IlBPU1QiIGFjdGlvbj0iL2FkbWluL2dvb2dsZS1jYWxlbmRhci9pbXBvcnQiIGlkPSJnY2FsSW1wb3J0Rm9ybSI+CiAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPSJidXR0b24iIGNsYXNzPSJidG4gYnRuLWdob3N0IiBzdHlsZT0iY29sb3I6dmFyKC0tZ29sZCwgI0M5QTg0Qyk7Ym9yZGVyLWNvbG9yOnJnYmEoMjAxLDE2OCw3NiwwLjM1KSIgb25jbGljaz0iYnBDb25maXJtKHtpY29uOifwn5OlJyx0aXRsZTonSW1wb3J0YXIgYWdlbmRhbWVudG9zIGV4aXN0ZW50ZXMnLG1zZzonSW1wb3J0YXIgY29tcHJvbWlzc29zIHF1ZSB2b2PDqiBqw6EgdGluaGEgbmEgc3VhIGFnZW5kYSBwZXNzb2FsIGRvIEdvb2dsZT8gQ2FkYSB1bSB2aXJhIHVtIGJsb3F1ZWlvIGRlIGhvcsOhcmlvIG5vIEJhcmJlciBQcm8gKHByw7N4aW1vcyA2MCBkaWFzKSwgcGFyYSBldml0YXIgcXVlIGFsZ3XDqW0gYWdlbmRlIGVtIGNpbWEuIElzc28gbsOjbyBhZmV0YSBhZ2VuZGFtZW50b3MgZGUgY2xpZW50ZXMgasOhIGV4aXN0ZW50ZXMuJyxva0xhYmVsOidJbXBvcnRhcicsb25Db25maXJtOmZ1bmN0aW9uKCl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2djYWxJbXBvcnRGb3JtJykuc3VibWl0KCk7fX0pIj7wn5OlIEltcG9ydGFyIGFnZW5kYW1lbnRvcyBleGlzdGVudGVzPC9idXR0b24+CiAgICAgICAgICAgIDwvZm9ybT4KICAgICAgICAgIDwvZGl2PgogICAgICAgIGAgOiBg'] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/admin-routes.ts');
console.log('  git commit -m "fix: usar bpConfirm padrao do sistema"');
console.log('  git push');