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

applyFixes('server/public-routes.ts', [ ['ICBhcHAuZ2V0KCIvcHViLWFwaS9zaG9wLXN0YXR1cyIsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHsKICAgIHRyeSB7CiAgICAgIGNvbnN0IHNsdWcgPSByZXEucXVlcnkuc2x1ZyBhcyBzdHJpbmc7CiAgICAgIGlmICghc2x1ZykgeyByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAic2x1ZyBvYnJpZ2F0b3JpbyIgfSk7IHJldHVybjsgfQogICAgICBjb25zdCB0ZW5hbnQgPSBhd2FpdCBkYi5nZXRUZW5hbnRCeVNsdWcoc2x1Zyk7CiAgICAgIGlmICghdGVuYW50KSB7IHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICJuYW8gZW5jb250cmFkbyIgfSk7IHJldHVybjsgfQogICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBkYi5nZXRTaG9wT3BlblN0YXR1cyh0ZW5hbnQuaWQpOwogICAgICByZXMuanNvbihzdGF0dXMpOwogICAgfSBjYXRjaCAoZSkgewogICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAiZXJybyBpbnRlcm5vIiB9KTsKICAgIH0KICB9KTsKICAvLyBGdW7Dp8O1ZXMgYXV4aWxpYXJlcyBkbyBjYXJyaW5obw==', 'ICBhcHAuZ2V0KCIvcHViLWFwaS9zaG9wLXN0YXR1cyIsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHsKICAgIHRyeSB7CiAgICAgIGNvbnN0IHNsdWcgPSByZXEucXVlcnkuc2x1ZyBhcyBzdHJpbmc7CiAgICAgIGlmICghc2x1ZykgeyByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAic2x1ZyBvYnJpZ2F0b3JpbyIgfSk7IHJldHVybjsgfQogICAgICBjb25zdCB0ZW5hbnQgPSBhd2FpdCBkYi5nZXRUZW5hbnRCeVNsdWcoc2x1Zyk7CiAgICAgIGlmICghdGVuYW50KSB7IHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICJuYW8gZW5jb250cmFkbyIgfSk7IHJldHVybjsgfQogICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBkYi5nZXRTaG9wT3BlblN0YXR1cyh0ZW5hbnQuaWQpOwogICAgICByZXMuanNvbihzdGF0dXMpOwogICAgfSBjYXRjaCAoZSkgewogICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAiZXJybyBpbnRlcm5vIiB9KTsKICAgIH0KICB9KTsKICAvLyBHRVQgL3B1Yi1hcGkvZmVlLXplcm8tcHJvbW8g4oCUIGNvbnRhZG9yIHJlYWwgZGUgYXNzaW5hbnRlcyBwYWdhbnRlcyBwYXJhIGEKICAvLyBwcm9tb8Onw6NvICJUYXhhIDAgcGFyYSBvcyBwcmltZWlyb3MgMTAwIGFzc2luYW50ZXMiICh1c2FkbyBuYSBsYW5kaW5nIHBhZ2UpCiAgYXBwLmdldCgiL3B1Yi1hcGkvZmVlLXplcm8tcHJvbW8iLCBhc3luYyAoX3JlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4gewogICAgY29uc3QgVE9UQUxfVkFHQVMgPSAxMDA7CiAgICB0cnkgewogICAgICBjb25zdCBkYkNvbm4gPSBhd2FpdCBkYi5nZXREYigpOwogICAgICBpZiAoIWRiQ29ubikgeyByZXMuanNvbih7IGNvdW50OiAwLCB0b3RhbDogVE9UQUxfVkFHQVMsIHJlbWFpbmluZzogVE9UQUxfVkFHQVMgfSk7IHJldHVybjsgfQogICAgICBjb25zdCByb3dzID0gYXdhaXQgZGJDb25uLmV4ZWN1dGUoc3FsYAogICAgICAgIFNFTEVDVCBDT1VOVCgqKSBhcyBjbnQgRlJPTSB0ZW5hbnRzIFdIRVJFICJiYXJiZXJwcm9TdWJzY3JpcHRpb25TdGF0dXMiID0gJ2FjdGl2ZScKICAgICAgYCkgYXMgYW55OwogICAgICBjb25zdCBsaXN0ID0gQXJyYXkuaXNBcnJheShyb3dzKSA/IHJvd3NbMF0gOiAocm93cz8ucm93cyA/PyBbXSk7CiAgICAgIGNvbnN0IGNvdW50ID0gTWF0aC5taW4ocGFyc2VJbnQobGlzdD8uWzBdPy5jbnQgPz8gIjAiLCAxMCkgfHwgMCwgVE9UQUxfVkFHQVMpOwogICAgICByZXMuanNvbih7IGNvdW50LCB0b3RhbDogVE9UQUxfVkFHQVMsIHJlbWFpbmluZzogTWF0aC5tYXgoMCwgVE9UQUxfVkFHQVMgLSBjb3VudCkgfSk7CiAgICB9IGNhdGNoIChlOiBhbnkpIHsKICAgICAgY29uc29sZS5lcnJvcigiW2ZlZS16ZXJvLXByb21vXSBFcnJvOiIsIGUubWVzc2FnZSk7CiAgICAgIHJlcy5qc29uKHsgY291bnQ6IDAsIHRvdGFsOiBUT1RBTF9WQUdBUywgcmVtYWluaW5nOiBUT1RBTF9WQUdBUyB9KTsKICAgIH0KICB9KTsKICAvLyBGdW7Dp8O1ZXMgYXV4aWxpYXJlcyBkbyBjYXJyaW5obw=='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add server/public-routes.ts');
console.log('  git commit -m "feat: endpoint contador promo taxa 0"');
console.log('  git push');