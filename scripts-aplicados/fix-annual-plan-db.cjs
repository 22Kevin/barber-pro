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

applyFixes('server/auto-migrate.ts', [ ['ICAgIHsgbmFtZTogJ2lkeF9zdXBlcmFkbWluX3Byb21vdGlvbnNfY29kZScsIHNxbDogYENSRUFURSBVTklRVUUgSU5ERVggSUYgTk9UIEVYSVNUUyBpZHhfc3VwZXJhZG1pbl9wcm9tb3Rpb25zX2NvZGUgT04gc3VwZXJhZG1pbl9wcm9tb3Rpb25zICgiY29kZSIpIFdIRVJFICJjb2RlIiBJUyBOT1QgTlVMTGAgfSwKICAgIHsgbmFtZTogJ3N1cGVyYWRtaW5fcHJvbW90aW9uX2FwcGxpY2F0aW9ucy4iZXhwaXJlZEF0IicsIHNxbDogYEFMVEVSIFRBQkxFIHN1cGVyYWRtaW5fcHJvbW90aW9uX2FwcGxpY2F0aW9ucyBBREQgQ09MVU1OIElGIE5PVCBFWElTVFMgImV4cGlyZWRBdCIgVElNRVNUQU1QYCB9LA==', 'ICAgIHsgbmFtZTogJ2lkeF9zdXBlcmFkbWluX3Byb21vdGlvbnNfY29kZScsIHNxbDogYENSRUFURSBVTklRVUUgSU5ERVggSUYgTk9UIEVYSVNUUyBpZHhfc3VwZXJhZG1pbl9wcm9tb3Rpb25zX2NvZGUgT04gc3VwZXJhZG1pbl9wcm9tb3Rpb25zICgiY29kZSIpIFdIRVJFICJjb2RlIiBJUyBOT1QgTlVMTGAgfSwKICAgIHsgbmFtZTogJ3N1cGVyYWRtaW5fcHJvbW90aW9uX2FwcGxpY2F0aW9ucy4iZXhwaXJlZEF0IicsIHNxbDogYEFMVEVSIFRBQkxFIHN1cGVyYWRtaW5fcHJvbW90aW9uX2FwcGxpY2F0aW9ucyBBREQgQ09MVU1OIElGIE5PVCBFWElTVFMgImV4cGlyZWRBdCIgVElNRVNUQU1QYCB9LAogICAgeyBuYW1lOiAndGVuYW50cy4iYmFyYmVycHJvQmlsbGluZ0N5Y2xlIicsIHNxbDogYEFMVEVSIFRBQkxFIHRlbmFudHMgQUREIENPTFVNTiBJRiBOT1QgRVhJU1RTICJiYXJiZXJwcm9CaWxsaW5nQ3ljbGUiIFZBUkNIQVIoMjApIERFRkFVTFQgJ21vbnRobHknYCB9LAogICAgeyBuYW1lOiAndGVuYW50cy4iYmFyYmVycHJvTGFzdFBheW1lbnRJZCInLCBzcWw6IGBBTFRFUiBUQUJMRSB0ZW5hbnRzIEFERCBDT0xVTU4gSUYgTk9UIEVYSVNUUyAiYmFyYmVycHJvTGFzdFBheW1lbnRJZCIgVkFSQ0hBUigxMDApYCB9LA=='] ]);
applyFixes('drizzle/schema.ts', [ ['ICBiYXJiZXJwcm9OZXh0RHVlRGF0ZTogdmFyY2hhcigiYmFyYmVycHJvTmV4dER1ZURhdGUiLCB7IGxlbmd0aDogMTAgfSks', 'ICBiYXJiZXJwcm9OZXh0RHVlRGF0ZTogdmFyY2hhcigiYmFyYmVycHJvTmV4dER1ZURhdGUiLCB7IGxlbmd0aDogMTAgfSksCiAgYmFyYmVycHJvQmlsbGluZ0N5Y2xlOiB2YXJjaGFyKCJiYXJiZXJwcm9CaWxsaW5nQ3ljbGUiLCB7IGxlbmd0aDogMjAgfSkuZGVmYXVsdCgibW9udGhseSIpLAogIGJhcmJlcnByb0xhc3RQYXltZW50SWQ6IHZhcmNoYXIoImJhcmJlcnByb0xhc3RQYXltZW50SWQiLCB7IGxlbmd0aDogMTAwIH0pLA=='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/auto-migrate.ts drizzle/schema.ts');
console.log('  git commit -m "feat(db): campos de plano anual"');
console.log('  git push');