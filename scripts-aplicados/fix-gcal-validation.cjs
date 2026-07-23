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

applyFixes('server/db.ts', [ ['ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVHb29nbGVDYWxlbmRhckNvbm5lY3Rpb24oZGF0YTogewogIGJhcmJlcklkOiBudW1iZXI7CiAgdGVuYW50SWQ6IG51bWJlcjsKICByZWZyZXNoVG9rZW5FbmNyeXB0ZWQ6IHN0cmluZzsKICBnb29nbGVDYWxlbmRhcklkPzogc3RyaW5nIHwgbnVsbDsKICBhY2Nlc3NUb2tlbkNhY2hlPzogc3RyaW5nIHwgbnVsbDsKICBhY2Nlc3NUb2tlbkV4cGlyZXNBdD86IERhdGUgfCBudWxsOwp9KSB7CiAgcmV0dXJuIHdpdGhSZXRyeShhc3luYyAoKSA9PiB7', 'ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVHb29nbGVDYWxlbmRhckNvbm5lY3Rpb24oZGF0YTogewogIGJhcmJlcklkOiBudW1iZXI7CiAgdGVuYW50SWQ6IG51bWJlcjsKICByZWZyZXNoVG9rZW5FbmNyeXB0ZWQ6IHN0cmluZzsKICBnb29nbGVDYWxlbmRhcklkPzogc3RyaW5nIHwgbnVsbDsKICBhY2Nlc3NUb2tlbkNhY2hlPzogc3RyaW5nIHwgbnVsbDsKICBhY2Nlc3NUb2tlbkV4cGlyZXNBdD86IERhdGUgfCBudWxsOwp9KSB7CiAgLy8gVmFsaWRhY2FvIGRlZmVuc2l2YTogc2UgYmFyYmVySWQvdGVuYW50SWQgY2hlZ2FyZW0gdmF6aW9zIGFxdWksIG8KICAvLyBEcml6emxlIHNpbXBsZXNtZW50ZSBvbWl0ZSBhIGNvbHVuYSBkYSBxdWVyeSAodmlyYSAiZGVmYXVsdCIgbm8gU1FMCiAgLy8gZ2VyYWRvKSwgY2F1c2FuZG8gdW1hIGZhbGhhIGRlIE5PVCBOVUxMIGNvbnN0cmFpbnQgZGlmaWNpbCBkZQogIC8vIGRpYWdub3N0aWNhciBwZWxvIGxvZy4gRmFsaGEgcmFwaWRvIGNvbSBtZW5zYWdlbSBjbGFyYSBlbSB2ZXogZGlzc28uCiAgaWYgKCFkYXRhLmJhcmJlcklkKSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoYHNhdmVHb29nbGVDYWxlbmRhckNvbm5lY3Rpb246IGJhcmJlcklkIGF1c2VudGUvaW52YWxpZG8gKHJlY2ViaWRvOiAke0pTT04uc3RyaW5naWZ5KGRhdGEuYmFyYmVySWQpfSlgKTsKICB9CiAgaWYgKCFkYXRhLnRlbmFudElkKSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoYHNhdmVHb29nbGVDYWxlbmRhckNvbm5lY3Rpb246IHRlbmFudElkIGF1c2VudGUvaW52YWxpZG8gKHJlY2ViaWRvOiAke0pTT04uc3RyaW5naWZ5KGRhdGEudGVuYW50SWQpfSlgKTsKICB9CiAgcmV0dXJuIHdpdGhSZXRyeShhc3luYyAoKSA9PiB7'] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/db.ts');
console.log('  git commit -m "fix: validacao defensiva no saveGoogleCalendarConnection"');
console.log('  git push');