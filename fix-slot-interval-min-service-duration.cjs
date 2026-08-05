// fix-slot-interval-min-service-duration.cjs
// Muda o intervalo entre horarios disponiveis no agendamento: em vez de um
// passo fixo de 15 minutos, usa a duracao do MENOR servico ativo cadastrado
// na barbearia (tenant). Ex: se o menor servico dura 30min, os horarios
// saem de 30 em 30 (09:00, 09:30, 10:00...) em vez de 15 em 15.
//
// Afeta: server/db.ts, funcao getAvailableSlots — usada tanto pelo app
// mobile (trpc slots.available) quanto pela pagina publica de agendamento
// (/pub-api/slots).
//
// Uso:
//   node fix-slot-interval-min-service-duration.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: cada trecho antigo
// precisa aparecer EXATAMENTE 1 vez, e a substituicao usa
// content.replace(old, () => new) — nunca a forma com string direta —
// porque um dos trechos novos contem MIN("durationMinutes") com aspas
// duplas que, embora nao tenha $, mantemos o padrao por consistencia e
// seguranca com os scripts anteriores.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'server', 'db.ts');

const replacements = [
  [
    "db:min-duration-step-setup",
    Buffer.from("ICBjb25zdCBibG9ja2VkID0gYXdhaXQgZGIuc2VsZWN0KCkuZnJvbShibG9ja2VkU2xvdHMpCiAgICAud2hlcmUoYW5kKGVxKGJsb2NrZWRTbG90cy5iYXJiZXJJZCwgYmFyYmVySWQpLCBlcShibG9ja2VkU2xvdHMuZGF0ZSwgZGF0ZSkpKTsKICBjb25zdCB0b01pbnV0ZXMgPSAodDogc3RyaW5nKSA9PiB7IGNvbnN0IFtoLCBtXSA9IHQuc3BsaXQoIjoiKS5tYXAoTnVtYmVyKTsgcmV0dXJuIGggKiA2MCArIG07IH07", 'base64').toString('utf8'),
    Buffer.from("ICBjb25zdCBibG9ja2VkID0gYXdhaXQgZGIuc2VsZWN0KCkuZnJvbShibG9ja2VkU2xvdHMpCiAgICAud2hlcmUoYW5kKGVxKGJsb2NrZWRTbG90cy5iYXJiZXJJZCwgYmFyYmVySWQpLCBlcShibG9ja2VkU2xvdHMuZGF0ZSwgZGF0ZSkpKTsKCiAgLy8gSW50ZXJ2YWxvIGVudHJlIGhvcsOhcmlvcyBkaXNwb27DrXZlaXM6IGVtIHZleiBkZSB1bSBwYXNzbyBmaXhvIGRlIDE1bWluLAogIC8vIHVzYSBhIGR1cmHDp8OjbyBkbyBNRU5PUiBzZXJ2acOnbyBhdGl2byBjYWRhc3RyYWRvIG5hIGJhcmJlYXJpYS4gRXg6IHNlIG8KICAvLyBtZW5vciBzZXJ2acOnbyBkdXJhIDMwbWluLCBvcyBob3LDoXJpb3Mgc2FlbSBkZSAzMCBlbSAzMCAoMDk6MDAsIDA5OjMwLi4uKQogIC8vIGVtIHZleiBkZSBvZmVyZWNlciBvcMOnw7VlcyBkZSAxNSBlbSAxNSBxdWUgbmEgcHLDoXRpY2EgbnVuY2EgY2FiZW0gdW0KICAvLyBhdGVuZGltZW50byBjb21wbGV0by4gQ2FpIHByYSAxNW1pbiBjb21vIGZhbGxiYWNrIHNlIG7Do28gYWNoYXIgdGVuYW50CiAgLy8gb3UgbmVuaHVtIHNlcnZpw6dvIGF0aXZvIChuw6NvIGRldmVyaWEgYWNvbnRlY2VyLCBtYXMgZXZpdGEgcXVlYnJhcikuCiAgbGV0IHN0ZXBNaW51dGVzID0gMTU7CiAgY29uc3QgYmFyYmVyUm93ID0gYXdhaXQgZGIuc2VsZWN0KHsgdGVuYW50SWQ6IGJhcmJlcnMudGVuYW50SWQgfSkuZnJvbShiYXJiZXJzKS53aGVyZShlcShiYXJiZXJzLmlkLCBiYXJiZXJJZCkpLmxpbWl0KDEpOwogIGNvbnN0IHRlbmFudElkID0gYmFyYmVyUm93WzBdPy50ZW5hbnRJZCA/PyBudWxsOwogIGlmICh0ZW5hbnRJZCAhPSBudWxsKSB7CiAgICBjb25zdCBtaW5EdXJhdGlvblJvdyA9IGF3YWl0IGRiLnNlbGVjdCh7IG1pbkR1cmF0aW9uOiBzcWw8bnVtYmVyPmBNSU4oImR1cmF0aW9uTWludXRlcyIpYCB9KQogICAgICAuZnJvbShzZXJ2aWNlcykKICAgICAgLndoZXJlKGFuZChlcShzZXJ2aWNlcy50ZW5hbnRJZCwgdGVuYW50SWQpLCBlcShzZXJ2aWNlcy5pc0FjdGl2ZSwgdHJ1ZSkpKTsKICAgIGNvbnN0IG1pbkR1cmF0aW9uID0gbWluRHVyYXRpb25Sb3dbMF0/Lm1pbkR1cmF0aW9uOwogICAgaWYgKG1pbkR1cmF0aW9uICYmIG1pbkR1cmF0aW9uID4gMCkgc3RlcE1pbnV0ZXMgPSBtaW5EdXJhdGlvbjsKICB9CgogIGNvbnN0IHRvTWludXRlcyA9ICh0OiBzdHJpbmcpID0+IHsgY29uc3QgW2gsIG1dID0gdC5zcGxpdCgiOiIpLm1hcChOdW1iZXIpOyByZXR1cm4gaCAqIDYwICsgbTsgfTs=", 'base64').toString('utf8'),
  ],
  [
    "db:cursor-step",
    Buffer.from("ICAgIGN1cnNvciArPSAxNTsKICB9CiAgcmV0dXJuIHNsb3RzOwp9", 'base64').toString('utf8'),
    Buffer.from("ICAgIGN1cnNvciArPSBzdGVwTWludXRlczsKICB9CiAgcmV0dXJuIHNsb3RzOwp9", 'base64').toString('utf8'),
  ],
];

function applyReplacements(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(__dirname, filePath);

  for (const [label, oldStr, newStr] of replacements) {
    const occurrences = content.split(oldStr).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `[${relPath}] "${label}": esperado 1 ocorrência do trecho original, encontrado ${occurrences}. ` +
        `Abortando sem gravar nada. O arquivo pode já ter sido modificado ou estar em uma versão diferente da esperada.`
      );
    }
    content = content.replace(oldStr, () => newStr);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${relPath}: ${replacements.length} alteração(ões) aplicada(s).`);
}

try {
  applyReplacements(DB_PATH, replacements);
  console.log('');
  console.log('Tudo aplicado com sucesso. Próximos passos:');
  console.log('  1. git diff --stat   (deve mostrar só server/db.ts)');
  console.log('  2. git diff server/db.ts   (conferir visualmente)');
  console.log('  3. npx esbuild server/db.ts --outfile=nul --format=esm --platform=node   (checar sintaxe)');
  console.log('  4. Testar manualmente: abrir a tela de agendamento (app ou /pub/sualoja/agendar) e conferir se os horários agora saem no intervalo do menor serviço cadastrado');
  console.log('  5. git add server/db.ts && git commit && git push');
} catch (err) {
  console.error('❌ Falha ao aplicar as alterações:');
  console.error(err.message);
  process.exit(1);
}
