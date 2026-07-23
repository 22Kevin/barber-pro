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

applyFixes('server/google-calendar.ts', [ ['Ly8g4pSA4pSA4pSAIEltcG9ydGFyIGV2ZW50b3MgZXhpc3RlbnRlcyAoY2FsZW5kw6FyaW8gcGVzc29hbCDihpIgYmxvcXVlaW9zIGRlIGhvcsOhcmlvKSDilIDilIA=', 'Ly8gRXh0cmFpIGRhdGEgKFlZWVktTU0tREQpIGUgaG9yYSAoSEg6TU06U1MpIGRlIHVtIERhdGUsIHNlbXByZSBubyBmdXNvIGRlCi8vIEJyYXPDrWxpYSAoQW1lcmljYS9TYW9fUGF1bG8pIOKAlCBpbmRlcGVuZGVudGUgZG8gZnVzbyBlbSBxdWUgbyBzZXJ2aWRvcgovLyAoUmFpbHdheSwgbm9ybWFsbWVudGUgVVRDKSBlc3TDoSByb2RhbmRvLiBVc2EgSW50bC5EYXRlVGltZUZvcm1hdCBlbSB2ZXogZGUKLy8gdG9JU09TdHJpbmcoKS90b1RpbWVTdHJpbmcoKSwgcXVlIHJlZmxldGVtIFVUQy9mdXNvIGRvIHNlcnZpZG9yLCBuw6NvIG8KLy8gaG9yw6FyaW8gcmVhbCBkbyBCcmFzaWwuCmZ1bmN0aW9uIGZvcm1hdEluQnJhemlsVGltZXpvbmUoZGF0ZTogRGF0ZSk6IHsgZGF0ZVN0cjogc3RyaW5nOyB0aW1lU3RyOiBzdHJpbmcgfSB7CiAgY29uc3QgZm9ybWF0dGVyID0gbmV3IEludGwuRGF0ZVRpbWVGb3JtYXQoImVuLUNBIiwgewogICAgdGltZVpvbmU6IFRJTUVaT05FLAogICAgeWVhcjogIm51bWVyaWMiLCBtb250aDogIjItZGlnaXQiLCBkYXk6ICIyLWRpZ2l0IiwKICAgIGhvdXI6ICIyLWRpZ2l0IiwgbWludXRlOiAiMi1kaWdpdCIsIHNlY29uZDogIjItZGlnaXQiLAogICAgaG91cjEyOiBmYWxzZSwKICB9KTsKICBjb25zdCBwYXJ0cyA9IGZvcm1hdHRlci5mb3JtYXRUb1BhcnRzKGRhdGUpOwogIGNvbnN0IGdldCA9ICh0eXBlOiBzdHJpbmcpID0+IHBhcnRzLmZpbmQocCA9PiBwLnR5cGUgPT09IHR5cGUpPy52YWx1ZSA/PyAiMDAiOwogIGNvbnN0IGRhdGVTdHIgPSBgJHtnZXQoInllYXIiKX0tJHtnZXQoIm1vbnRoIil9LSR7Z2V0KCJkYXkiKX1gOwogIGNvbnN0IHRpbWVTdHIgPSBgJHtnZXQoImhvdXIiKX06JHtnZXQoIm1pbnV0ZSIpfToke2dldCgic2Vjb25kIil9YDsKICByZXR1cm4geyBkYXRlU3RyLCB0aW1lU3RyIH07Cn0KCi8vIOKUgOKUgOKUgCBJbXBvcnRhciBldmVudG9zIGV4aXN0ZW50ZXMgKGNhbGVuZMOhcmlvIHBlc3NvYWwg4oaSIGJsb3F1ZWlvcyBkZSBob3LDoXJpbykg4pSA4pSA'], ['ICAgIGNvbnN0IHN0YXJ0RGF0ZSA9IG5ldyBEYXRlKGV2ZW50LnN0YXJ0LmRhdGVUaW1lKTsKICAgIGNvbnN0IGVuZERhdGUgPSBuZXcgRGF0ZShldmVudC5lbmQuZGF0ZVRpbWUpOwogICAgY29uc3QgZGF0ZVN0ciA9IHN0YXJ0RGF0ZS50b0lTT1N0cmluZygpLnNwbGl0KCJUIilbMF07CiAgICBjb25zdCBzdGFydFRpbWVTdHIgPSBzdGFydERhdGUudG9UaW1lU3RyaW5nKCkuc2xpY2UoMCwgOCk7CiAgICBjb25zdCBlbmRUaW1lU3RyID0gZW5kRGF0ZS50b1RpbWVTdHJpbmcoKS5zbGljZSgwLCA4KTs=', 'ICAgIGNvbnN0IHN0YXJ0RGF0ZSA9IG5ldyBEYXRlKGV2ZW50LnN0YXJ0LmRhdGVUaW1lKTsKICAgIGNvbnN0IGVuZERhdGUgPSBuZXcgRGF0ZShldmVudC5lbmQuZGF0ZVRpbWUpOwogICAgLy8gSU1QT1JUQU5URTogdXNhIG8gZnVzbyBkZSBCcmFzw61saWEgZXhwbGljaXRhbWVudGUgKEFtZXJpY2EvU2FvX1BhdWxvKSwKICAgIC8vIG51bmNhIG8gZnVzbyBkbyBzZXJ2aWRvciAoUmFpbHdheSByb2RhIGVtIFVUQykgbmVtIHRvSVNPU3RyaW5nKCkvCiAgICAvLyB0b1RpbWVTdHJpbmcoKSBwdXJvcyAtIGFtYm9zIGTDo28gYSBkYXRhL2hvcmEgRVJSQURBIHF1YW5kbyBvIHNlcnZpZG9yCiAgICAvLyBuw6NvIGVzdMOhIG5vIG1lc21vIGZ1c28gZG8gQnJhc2lsIChleDogMTZoIGRlIEJyYXPDrWxpYSB2aXJhICIxOTowMCIKICAgIC8vIHNlIGNhbGN1bGFkbyBlbSBVVEMsIHVtIGJsb3F1ZWlvIDNoIGZvcmEgZG8gaG9yw6FyaW8gcmVhbCkuCiAgICBjb25zdCB7IGRhdGVTdHIsIHRpbWVTdHI6IHN0YXJ0VGltZVN0ciB9ID0gZm9ybWF0SW5CcmF6aWxUaW1lem9uZShzdGFydERhdGUpOwogICAgY29uc3QgeyB0aW1lU3RyOiBlbmRUaW1lU3RyIH0gPSBmb3JtYXRJbkJyYXppbFRpbWV6b25lKGVuZERhdGUpOw=='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/google-calendar.ts');
console.log('  git commit -m "fix: fuso horario na importacao"');
console.log('  git push');