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

applyFixes('server/auto-migrate.ts', [ ['ICAgIHsgbmFtZTogJ2lkeF9nY2FsX2Nvbm5fYmFyYmVyJywgc3FsOiBgQ1JFQVRFIElOREVYIElGIE5PVCBFWElTVFMgaWR4X2djYWxfY29ubl9iYXJiZXIgT04gZ29vZ2xlX2NhbGVuZGFyX2Nvbm5lY3Rpb25zICgiYmFyYmVySWQiKWAgfSwKICAgIHsgbmFtZTogJ2Jsb2NrZWRfc2xvdHMuImdvb2dsZUV2ZW50SWQiJywgc3FsOiBgQUxURVIgVEFCTEUgYmxvY2tlZF9zbG90cyBBREQgQ09MVU1OIElGIE5PVCBFWElTVFMgImdvb2dsZUV2ZW50SWQiIFZBUkNIQVIoMjU1KWAgfSw=', 'ICAgIHsgbmFtZTogJ2lkeF9nY2FsX2Nvbm5fYmFyYmVyJywgc3FsOiBgQ1JFQVRFIElOREVYIElGIE5PVCBFWElTVFMgaWR4X2djYWxfY29ubl9iYXJiZXIgT04gZ29vZ2xlX2NhbGVuZGFyX2Nvbm5lY3Rpb25zICgiYmFyYmVySWQiKWAgfSwKICAgIHsgbmFtZTogJ2Jsb2NrZWRfc2xvdHMuImdvb2dsZUV2ZW50SWQiJywgc3FsOiBgQUxURVIgVEFCTEUgYmxvY2tlZF9zbG90cyBBREQgQ09MVU1OIElGIE5PVCBFWElTVFMgImdvb2dsZUV2ZW50SWQiIFZBUkNIQVIoMjU1KWAgfSwKICAgIHsgbmFtZTogJ3N1cGVyYWRtaW5fcHJvbW90aW9ucy4iY29kZSInLCBzcWw6IGBBTFRFUiBUQUJMRSBzdXBlcmFkbWluX3Byb21vdGlvbnMgQUREIENPTFVNTiBJRiBOT1QgRVhJU1RTICJjb2RlIiBWQVJDSEFSKDUwKWAgfSwKICAgIHsgbmFtZTogJ2lkeF9zdXBlcmFkbWluX3Byb21vdGlvbnNfY29kZScsIHNxbDogYENSRUFURSBVTklRVUUgSU5ERVggSUYgTk9UIEVYSVNUUyBpZHhfc3VwZXJhZG1pbl9wcm9tb3Rpb25zX2NvZGUgT04gc3VwZXJhZG1pbl9wcm9tb3Rpb25zICgiY29kZSIpIFdIRVJFICJjb2RlIiBJUyBOT1QgTlVMTGAgfSwKICAgIHsgbmFtZTogJ3N1cGVyYWRtaW5fcHJvbW90aW9uX2FwcGxpY2F0aW9ucy4iZXhwaXJlZEF0IicsIHNxbDogYEFMVEVSIFRBQkxFIHN1cGVyYWRtaW5fcHJvbW90aW9uX2FwcGxpY2F0aW9ucyBBREQgQ09MVU1OIElGIE5PVCBFWElTVFMgImV4cGlyZWRBdCIgVElNRVNUQU1QYCB9LA=='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/auto-migrate.ts');
console.log('  git commit -m "feat(db): coluna code + expiredAt para sistema de cupons"');
console.log('  git push');