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

applyFixes('server/db.ts', [ ['ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUFwcG9pbnRtZW50U3RhdHVzKGlkOiBudW1iZXIsIHN0YXR1czogc3RyaW5nKSB7CiAgY29uc3QgZGIgPSBhd2FpdCBnZXREYigpOwogIGlmICghZGIpIHRocm93IG5ldyBFcnJvcigiRGF0YWJhc2Ugbm90IGF2YWlsYWJsZSIpOwogIGF3YWl0IGRiLnVwZGF0ZShhcHBvaW50bWVudHMpLnNldCh7IHN0YXR1cyB9IGFzIGFueSkud2hlcmUoZXEoYXBwb2ludG1lbnRzLmlkLCBpZCkpOwp9', 'ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUFwcG9pbnRtZW50U3RhdHVzKGlkOiBudW1iZXIsIHN0YXR1czogc3RyaW5nKSB7CiAgY29uc3QgZGIgPSBhd2FpdCBnZXREYigpOwogIGlmICghZGIpIHRocm93IG5ldyBFcnJvcigiRGF0YWJhc2Ugbm90IGF2YWlsYWJsZSIpOwogIGF3YWl0IGRiLnVwZGF0ZShhcHBvaW50bWVudHMpLnNldCh7IHN0YXR1cyB9IGFzIGFueSkud2hlcmUoZXEoYXBwb2ludG1lbnRzLmlkLCBpZCkpOwogIGNvbnN0IGFjdGlvbiA9IHN0YXR1cyA9PT0gImNhbmNlbGxlZCIgfHwgc3RhdHVzID09PSAibm9fc2hvdyIgPyAiY2FuY2VsbGVkIiA6ICJ1cGRhdGVkIjsKICB0cmlnZ2VyR29vZ2xlQ2FsZW5kYXJTeW5jKGlkLCBhY3Rpb24pLmNhdGNoKCgpID0+IHt9KTsKfQ=='], ['ICAgIGNvbnN0IGFwcHRSZXN1bHQgPSBhd2FpdCBkYi5pbnNlcnQoYXBwb2ludG1lbnRzKS52YWx1ZXMoewogICAgICBjbGllbnRJZDogZGF0YS5jbGllbnRJZCwKICAgICAgYmFyYmVySWQ6IGRhdGEuYmFyYmVySWQsCiAgICAgIHNlcnZpY2VJZDogZGF0YS5zZXJ2aWNlSWQsCiAgICAgIGRhdGU6IGRhdGVTdHIsCiAgICAgIHN0YXJ0VGltZTogZGF0YS5zdGFydFRpbWUsCiAgICAgIGVuZFRpbWU6IGRhdGEuZW5kVGltZSwKICAgICAgc3RhdHVzOiAic2NoZWR1bGVkIiwKICAgICAgbm90ZXM6IGRhdGEubm90ZXMgPyBgW1JlY29ycmVudGVdICR7ZGF0YS5ub3Rlc31gIDogIltSZWNvcnJlbnRlXSIsCiAgICB9KS5yZXR1cm5pbmcoKTsKICAgIGNyZWF0ZWRJZHMucHVzaChhcHB0UmVzdWx0WzBdLmlkKTs=', 'ICAgIGNvbnN0IGFwcHRSZXN1bHQgPSBhd2FpdCBkYi5pbnNlcnQoYXBwb2ludG1lbnRzKS52YWx1ZXMoewogICAgICBjbGllbnRJZDogZGF0YS5jbGllbnRJZCwKICAgICAgYmFyYmVySWQ6IGRhdGEuYmFyYmVySWQsCiAgICAgIHNlcnZpY2VJZDogZGF0YS5zZXJ2aWNlSWQsCiAgICAgIGRhdGU6IGRhdGVTdHIsCiAgICAgIHN0YXJ0VGltZTogZGF0YS5zdGFydFRpbWUsCiAgICAgIGVuZFRpbWU6IGRhdGEuZW5kVGltZSwKICAgICAgc3RhdHVzOiAic2NoZWR1bGVkIiwKICAgICAgbm90ZXM6IGRhdGEubm90ZXMgPyBgW1JlY29ycmVudGVdICR7ZGF0YS5ub3Rlc31gIDogIltSZWNvcnJlbnRlXSIsCiAgICB9KS5yZXR1cm5pbmcoKTsKICAgIGNvbnN0IG5ld0FwcHRJZCA9IGFwcHRSZXN1bHRbMF0uaWQ7CiAgICB0cmlnZ2VyR29vZ2xlQ2FsZW5kYXJTeW5jKG5ld0FwcHRJZCwgImNyZWF0ZWQiKS5jYXRjaCgoKSA9PiB7fSk7CiAgICBjcmVhdGVkSWRzLnB1c2gobmV3QXBwdElkKTs='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/db.ts');
console.log('  git commit -m "fix: cobrir updateAppointmentStatus e createRecurringAppointments"');
console.log('  git push');