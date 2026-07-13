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

applyFixes('app/admin/(tabs)/_layout.tsx', [ ['ICAgICAgPFRhYnMuU2NyZWVuCiAgICAgICAgbmFtZT0ic2V0dGluZ3MiCiAgICAgICAgb3B0aW9ucz17ewogICAgICAgICAgdGl0bGU6ICJDb25maWd1cmHDp8O1ZXMiLAogICAgICAgICAgdGFiQmFySXRlbVN0eWxlOiB7IGRpc3BsYXk6ICJub25lIiB9LAogICAgICAgIH19CiAgICAgIC8+CiAgICAgIDxUYWJzLlNjcmVlbgogICAgICAgIG5hbWU9InJldHVybi1tZXNzYWdlcyIKICAgICAgICBvcHRpb25zPXt7CiAgICAgICAgICB0aXRsZTogIlJldG9ybm8gQXV0b23DoXRpY28iLAogICAgICAgICAgdGFiQmFySXRlbVN0eWxlOiB7IGRpc3BsYXk6ICJub25lIiB9LAogICAgICAgIH19CiAgICAgIC8+', 'ICAgICAgPFRhYnMuU2NyZWVuCiAgICAgICAgbmFtZT0ic2V0dGluZ3MiCiAgICAgICAgb3B0aW9ucz17ewogICAgICAgICAgdGl0bGU6ICJNaW5oYSBBc3NpbmF0dXJhIiwKICAgICAgICAgIHRhYkJhckl0ZW1TdHlsZTogeyBkaXNwbGF5OiAibm9uZSIgfSwKICAgICAgICB9fQogICAgICAvPgogICAgICA8VGFicy5TY3JlZW4KICAgICAgICBuYW1lPSJyZXR1cm4tbWVzc2FnZXMiCiAgICAgICAgb3B0aW9ucz17ewogICAgICAgICAgdGl0bGU6ICJNZW5zYWdlbnMgQXV0b23DoXRpY2FzIiwKICAgICAgICAgIHRhYkJhckl0ZW1TdHlsZTogeyBkaXNwbGF5OiAibm9uZSIgfSwKICAgICAgICB9fQogICAgICAvPg=='] ]);
applyFixes('app/admin/(tabs)/menu.tsx', [ ['eyBsYWJlbDogIlJldG9ybm8gQXV0b23DoXRpY28iLCAgICAgIGljb246ICJiZWxsLmJhZGdlLmZpbGwiLCAgICAgICAgICAgICByb3V0ZTogIi9hZG1pbi8odGFicykvcmV0dXJuLW1lc3NhZ2VzIiwgICByb2xlczogWyJzdXBlcl9hZG1pbiJdIH0s', 'eyBsYWJlbDogIk1lbnNhZ2VucyBBdXRvbcOhdGljYXMiLCAgICAgIGljb246ICJiZWxsLmJhZGdlLmZpbGwiLCAgICAgICAgICAgICByb3V0ZTogIi9hZG1pbi8odGFicykvcmV0dXJuLW1lc3NhZ2VzIiwgICByb2xlczogWyJzdXBlcl9hZG1pbiJdIH0s'], ['eyBsYWJlbDogIkNvbmZpZ3VyYcOnw7VlcyIsICAgaWNvbjogImdlYXJzaGFwZS5maWxsIiwgICAgICAgICAgICAgIHJvdXRlOiAiL2FkbWluLyh0YWJzKS9zZXR0aW5ncyIsICAgICAgICAgIHJvbGVzOiBbInN1cGVyX2FkbWluIl0gfSw=', 'eyBsYWJlbDogIk1pbmhhIEFzc2luYXR1cmEiLCAgIGljb246ICJnZWFyc2hhcGUuZmlsbCIsICAgICAgICAgICAgICByb3V0ZTogIi9hZG1pbi8odGFicykvc2V0dGluZ3MiLCAgICAgICAgICByb2xlczogWyJzdXBlcl9hZG1pbiJdIH0s'] ]);
applyFixes('app/admin/(tabs)/settings.tsx', [ ['PEFkbWluSGVhZGVyIHRpdGxlPSJDb25maWd1cmHDp8O1ZXMiIC8+', 'PEFkbWluSGVhZGVyIHRpdGxlPSJNaW5oYSBBc3NpbmF0dXJhIiAvPg=='] ]);
applyFixes('app/admin/(tabs)/return-messages.tsx', [ ['PEFkbWluSGVhZGVyIHRpdGxlPSJNZW5zYWdlbnMgZGUgUmV0b3JubyIgLz4=', 'PEFkbWluSGVhZGVyIHRpdGxlPSJNZW5zYWdlbnMgQXV0b23DoXRpY2FzIiAvPg=='] ]);
applyFixes('app/admin/(tabs)/barbearia.tsx', [ ['Im1hcmtldGluZyI6ICJNYXJrZXRpbmciLCAiY29uZmlndXJhY29lcyI6ICJDb25maWd1cmHDp8O1ZXMiLA==', 'Im1hcmtldGluZyI6ICJNYXJrZXRpbmciLCAiY29uZmlndXJhY29lcyI6ICJNaW5oYSBBc3NpbmF0dXJhIiw='] ]);

console.log('');
console.log("Confira com 'git diff --stat' e depois:");
console.log('  git add app/admin/(tabs)/_layout.tsx app/admin/(tabs)/menu.tsx app/admin/(tabs)/settings.tsx app/admin/(tabs)/return-messages.tsx app/admin/(tabs)/barbearia.tsx');
console.log('  git commit -m "feat: renomear itens de menu"');
console.log('  git push');