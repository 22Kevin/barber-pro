// fix-gcal-import-appointment-conflict.cjs
// Corrige um problema relatado por um cliente: ao sincronizar a Google
// Agenda pessoal com o Barber Pro, a importacao de eventos existentes
// criava um "bloqueio" mesmo quando ja havia um agendamento real (nao
// cancelado) do barbeiro naquele mesmo horario — gerando um registro
// duplicado/redundante na agenda (o compromisso real ja bloqueava o
// horario pra novos clientes; o bloqueio importado por cima so causava
// confusao visual e um risco silencioso: se o agendamento fosse cancelado
// depois, o bloqueio importado continuaria escondendo esse horario como
// ocupado, mesmo estando livre de verdade).
//
// Fix: antes de criar o bloqueio importado, verifica se ja existe um
// agendamento nao-cancelado do barbeiro que conflita com aquele horario
// (mesma data, intervalo sobreposto) — se existir, pula a importacao
// desse evento especifico (nao cria bloqueio duplicado).
//
// Afeta: server/google-calendar.ts, funcao importExistingEvents — chamada
// tanto pelo painel web quanto pelo app mobile ao sincronizar a agenda.
//
// Uso:
//   node fix-gcal-import-appointment-conflict.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: o trecho antigo
// precisa aparecer EXATAMENTE 1 vez, e a substituicao usa
// content.replace(old, () => new).

const fs = require('fs');
const path = require('path');

const GCAL_PATH = path.join(__dirname, 'server', 'google-calendar.ts');

const oldStr = Buffer.from("ICAgIGNvbnN0IHsgZGF0ZVN0ciwgdGltZVN0cjogc3RhcnRUaW1lU3RyIH0gPSBmb3JtYXRJbkJyYXppbFRpbWV6b25lKHN0YXJ0RGF0ZSk7CiAgICBjb25zdCB7IHRpbWVTdHI6IGVuZFRpbWVTdHIgfSA9IGZvcm1hdEluQnJhemlsVGltZXpvbmUoZW5kRGF0ZSk7CgogICAgdHJ5IHs=", 'base64').toString('utf8');
const newStr = Buffer.from("ICAgIGNvbnN0IHsgZGF0ZVN0ciwgdGltZVN0cjogc3RhcnRUaW1lU3RyIH0gPSBmb3JtYXRJbkJyYXppbFRpbWV6b25lKHN0YXJ0RGF0ZSk7CiAgICBjb25zdCB7IHRpbWVTdHI6IGVuZFRpbWVTdHIgfSA9IGZvcm1hdEluQnJhemlsVGltZXpvbmUoZW5kRGF0ZSk7CgogICAgLy8gU2UgasOhIGV4aXN0ZSB1bSBhZ2VuZGFtZW50byByZWFsIChuw6NvIGNhbmNlbGFkbykgZG8gYmFyYmVpcm8gcXVlCiAgICAvLyBjb25mbGl0YSBjb20gZXNzZSBob3LDoXJpbywgbyBob3LDoXJpbyBqw6EgZXN0w6EgY29ycmV0YW1lbnRlIG9jdXBhZG8g4oCUCiAgICAvLyBuw6NvIGZheiBzZW50aWRvIChlIHBvZGUgY29uZnVuZGlyIGEgYWdlbmRhKSBkdXBsaWNhciBjb21vIHVtIGJsb3F1ZWlvCiAgICAvLyBpbXBvcnRhZG8gcG9yIGNpbWEuIElzc28gY29icmUgbyBjYXNvIGRlIHVtIGNvbXByb21pc3NvIHBlc3NvYWwgbmEKICAgIC8vIEdvb2dsZSBBZ2VuZGEgY29pbmNpZGlyIGNvbSB1bSBhZ2VuZGFtZW50byBqw6EgZmVpdG8gbm8gQmFyYmVyIFByby4KICAgIGNvbnN0IGNvbmZsaWN0aW5nID0gYXdhaXQgZGIucmF3UXVlcnkoCiAgICAgIGBTRUxFQ1QgaWQgRlJPTSBhcHBvaW50bWVudHMKICAgICAgIFdIRVJFICJiYXJiZXJJZCIgPSAkMSBBTkQgZGF0ZSA9ICQyCiAgICAgICAgIEFORCBzdGF0dXMgTk9UIElOICgnY2FuY2VsbGVkJywgJ25vX3Nob3cnKQogICAgICAgICBBTkQgInN0YXJ0VGltZSIgPCAkNCBBTkQgImVuZFRpbWUiID4gJDMKICAgICAgIExJTUlUIDFgLAogICAgICBbYmFyYmVySWQsIGRhdGVTdHIsIHN0YXJ0VGltZVN0ciwgZW5kVGltZVN0cl0KICAgICk7CiAgICBpZiAoY29uZmxpY3RpbmcubGVuZ3RoID4gMCkgeyBza2lwcGVkKys7IGNvbnRpbnVlOyB9CgogICAgdHJ5IHs=", 'base64').toString('utf8');

try {
  if (!fs.existsSync(GCAL_PATH)) {
    throw new Error('Arquivo não encontrado: ' + GCAL_PATH);
  }
  let content = fs.readFileSync(GCAL_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `esperado 1 ocorrência do trecho original, encontrado ${occurrences}. ` +
      `Abortando sem gravar nada.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(GCAL_PATH, content, 'utf8');
  console.log('✅ server/google-calendar.ts: checagem de conflito adicionada.');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff server/google-calendar.ts   (conferir visualmente)');
  console.log('  2. npx esbuild server/google-calendar.ts --outfile=nul --format=esm --platform=node');
  console.log('  3. git add server/google-calendar.ts');
  console.log('  4. git commit -m "fix: importacao da Google Agenda nao duplica bloqueio quando ja existe agendamento no horario"');
  console.log('  5. git push');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
