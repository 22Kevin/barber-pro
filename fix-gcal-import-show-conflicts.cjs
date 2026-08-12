// fix-gcal-import-show-conflicts.cjs
// Mostra pro barbeiro, apos importar a Google Agenda, QUAIS horarios
// especificos nao foram importados por ja existir um agendamento real no
// mesmo horario (em vez de so um numero generico de "ignorados").
//
// Edita:
//   server/google-calendar.ts       — ImportResult ganha o campo "conflicts"
//                                      (lista de {date, startTime, endTime})
//   server/admin-routes.ts          — painel web mostra a lista no alerta
//   app/admin/(tabs)/integracoes.tsx — app mostra a lista no alerta
//
// PRE-REQUISITO: espera que fix-gcal-import-appointment-conflict.cjs (a
// checagem de conflito em si) ja tenha sido aplicado antes.
//
// Uso:
//   node fix-gcal-import-show-conflicts.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: cada trecho antigo
// precisa aparecer EXATAMENTE 1 vez por arquivo, e a substituicao usa
// content.replace(old, () => new).

const fs = require('fs');
const path = require('path');

const FILES = {
  'server/google-calendar.ts': [
    [
      "gcal:interface+early-return",
      Buffer.from("ZXhwb3J0IGludGVyZmFjZSBJbXBvcnRSZXN1bHQgewogIGltcG9ydGVkOiBudW1iZXI7CiAgc2tpcHBlZDogbnVtYmVyOwogIHRvdGFsRm91bmQ6IG51bWJlcjsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGltcG9ydEV4aXN0aW5nRXZlbnRzKGJhcmJlcklkOiBudW1iZXIsIGRheXNBaGVhZDogbnVtYmVyID0gNjApOiBQcm9taXNlPEltcG9ydFJlc3VsdD4gewogIGNvbnN0IGNvbm4gPSBhd2FpdCBnZXRWYWxpZEFjY2Vzc1Rva2VuKGJhcmJlcklkKTsKICBpZiAoIWNvbm4pIHJldHVybiB7IGltcG9ydGVkOiAwLCBza2lwcGVkOiAwLCB0b3RhbEZvdW5kOiAwIH07", 'base64').toString('utf8'),
      Buffer.from("ZXhwb3J0IGludGVyZmFjZSBJbXBvcnRSZXN1bHQgewogIGltcG9ydGVkOiBudW1iZXI7CiAgc2tpcHBlZDogbnVtYmVyOwogIHRvdGFsRm91bmQ6IG51bWJlcjsKICAvLyBIb3LDoXJpb3MgZXNwZWNpZmljYW1lbnRlIHB1bGFkb3MgcG9yIGrDoSBleGlzdGlyIHVtIGFnZW5kYW1lbnRvIHJlYWwgZG8KICAvLyBiYXJiZWlybyBuYXF1ZWxlIG1lc21vIGhvcsOhcmlvIOKAlCBzZXBhcmFkbyBkbyAic2tpcHBlZCIgZ2Vuw6lyaWNvIChxdWUKICAvLyB0YW1iw6ltIGluY2x1aSBldmVudG9zIGrDoSBpbXBvcnRhZG9zIGFudGVzLCBzZW0gaG9yw6FyaW8gZGVmaW5pZG8gZXRjLikKICAvLyBwcmEgcG9kZXJtb3MgYXZpc2FyIG8gYmFyYmVpcm8gZXhhdGFtZW50ZSBxdWFpcyBob3LDoXJpb3MgZmljYXJhbSBkZQogIC8vIGZvcmEgZSBwb3IgcXXDqi4KICBjb25mbGljdHM6IEFycmF5PHsgZGF0ZTogc3RyaW5nOyBzdGFydFRpbWU6IHN0cmluZzsgZW5kVGltZTogc3RyaW5nIH0+Owp9CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gaW1wb3J0RXhpc3RpbmdFdmVudHMoYmFyYmVySWQ6IG51bWJlciwgZGF5c0FoZWFkOiBudW1iZXIgPSA2MCk6IFByb21pc2U8SW1wb3J0UmVzdWx0PiB7CiAgY29uc3QgY29ubiA9IGF3YWl0IGdldFZhbGlkQWNjZXNzVG9rZW4oYmFyYmVySWQpOwogIGlmICghY29ubikgcmV0dXJuIHsgaW1wb3J0ZWQ6IDAsIHNraXBwZWQ6IDAsIHRvdGFsRm91bmQ6IDAsIGNvbmZsaWN0czogW10gfTs=", 'base64').toString('utf8'),
    ],
    [
      "gcal:counters-init",
      Buffer.from("ICBjb25zdCBldmVudHMgPSBBcnJheS5pc0FycmF5KGRhdGEuaXRlbXMpID8gZGF0YS5pdGVtcyA6IFtdOwogIGxldCBpbXBvcnRlZCA9IDA7CiAgbGV0IHNraXBwZWQgPSAwOwoKICBmb3IgKGNvbnN0IGV2ZW50IG9mIGV2ZW50cykgew==", 'base64').toString('utf8'),
      Buffer.from("ICBjb25zdCBldmVudHMgPSBBcnJheS5pc0FycmF5KGRhdGEuaXRlbXMpID8gZGF0YS5pdGVtcyA6IFtdOwogIGxldCBpbXBvcnRlZCA9IDA7CiAgbGV0IHNraXBwZWQgPSAwOwogIGNvbnN0IGNvbmZsaWN0czogSW1wb3J0UmVzdWx0WyJjb25mbGljdHMiXSA9IFtdOwoKICBmb3IgKGNvbnN0IGV2ZW50IG9mIGV2ZW50cykgew==", 'base64').toString('utf8'),
    ],
    [
      "gcal:conflict-push",
      Buffer.from("ICAgIGlmIChjb25mbGljdGluZy5sZW5ndGggPiAwKSB7IHNraXBwZWQrKzsgY29udGludWU7IH0=", 'base64').toString('utf8'),
      Buffer.from("ICAgIGlmIChjb25mbGljdGluZy5sZW5ndGggPiAwKSB7CiAgICAgIGNvbmZsaWN0cy5wdXNoKHsgZGF0ZTogZGF0ZVN0ciwgc3RhcnRUaW1lOiBzdGFydFRpbWVTdHIsIGVuZFRpbWU6IGVuZFRpbWVTdHIgfSk7CiAgICAgIHNraXBwZWQrKzsKICAgICAgY29udGludWU7CiAgICB9", 'base64').toString('utf8'),
    ],
    [
      "gcal:return",
      Buffer.from("ICByZXR1cm4geyBpbXBvcnRlZCwgc2tpcHBlZCwgdG90YWxGb3VuZDogZXZlbnRzLmxlbmd0aCB9Owp9", 'base64').toString('utf8'),
      Buffer.from("ICByZXR1cm4geyBpbXBvcnRlZCwgc2tpcHBlZCwgdG90YWxGb3VuZDogZXZlbnRzLmxlbmd0aCwgY29uZmxpY3RzIH07Cn0=", 'base64').toString('utf8'),
    ],
  ],
  'server/admin-routes.ts': [
    [
      "admin:import-handler",
      Buffer.from("ICAgIGNvbnN0IHNlc3Npb24gPSAocmVxIGFzIGFueSkuYWRtaW5TZXNzaW9uIGFzIHsgYmFyYmVySWQ6IG51bWJlciB9Ow0KICAgIHRyeSB7DQogICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnb29nbGVDYWxlbmRhci5pbXBvcnRFeGlzdGluZ0V2ZW50cyhzZXNzaW9uLmJhcmJlcklkLCA2MCk7DQogICAgICByZXMucmVkaXJlY3QoYC9hZG1pbi9pbnRlZ3JhY29lcz9nY2FsX2ltcG9ydGVkPSR7cmVzdWx0LmltcG9ydGVkfSZnY2FsX3NraXBwZWQ9JHtyZXN1bHQuc2tpcHBlZH1gKTsNCiAgICB9IGNhdGNoIChlOiBhbnkpIHsNCg==", 'base64').toString('utf8'),
      Buffer.from("ICAgIGNvbnN0IHNlc3Npb24gPSAocmVxIGFzIGFueSkuYWRtaW5TZXNzaW9uIGFzIHsgYmFyYmVySWQ6IG51bWJlciB9Ow0KICAgIHRyeSB7DQogICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnb29nbGVDYWxlbmRhci5pbXBvcnRFeGlzdGluZ0V2ZW50cyhzZXNzaW9uLmJhcmJlcklkLCA2MCk7DQogICAgICBjb25zdCBjb25mbGljdHNQYXJhbSA9IHJlc3VsdC5jb25mbGljdHMubGVuZ3RoID4gMA0KICAgICAgICA/ICImZ2NhbF9jb25mbGljdHM9IiArIGVuY29kZVVSSUNvbXBvbmVudChyZXN1bHQuY29uZmxpY3RzLm1hcChjID0+IGAke2MuZGF0ZS5zbGljZSg4LCAxMCl9LyR7Yy5kYXRlLnNsaWNlKDUsIDcpfSAke2Muc3RhcnRUaW1lLnNsaWNlKDAsIDUpfWApLmpvaW4oIiwgIikpDQogICAgICAgIDogIiI7DQogICAgICByZXMucmVkaXJlY3QoYC9hZG1pbi9pbnRlZ3JhY29lcz9nY2FsX2ltcG9ydGVkPSR7cmVzdWx0LmltcG9ydGVkfSZnY2FsX3NraXBwZWQ9JHtyZXN1bHQuc2tpcHBlZH0ke2NvbmZsaWN0c1BhcmFtfWApOw0KICAgIH0gY2F0Y2ggKGU6IGFueSkgew0K", 'base64').toString('utf8'),
    ],
    [
      "admin:query-params",
      Buffer.from("ICAgIGNvbnN0IGVycm9yTXNnID0gcmVxLnF1ZXJ5LmdjYWxfZXJyb3IgYXMgc3RyaW5nIHwgdW5kZWZpbmVkOw0KICAgIGNvbnN0IGltcG9ydGVkQ291bnQgPSByZXEucXVlcnkuZ2NhbF9pbXBvcnRlZCBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7DQogICAgY29uc3Qgc2tpcHBlZENvdW50ID0gcmVxLnF1ZXJ5LmdjYWxfc2tpcHBlZCBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7DQo=", 'base64').toString('utf8'),
      Buffer.from("ICAgIGNvbnN0IGVycm9yTXNnID0gcmVxLnF1ZXJ5LmdjYWxfZXJyb3IgYXMgc3RyaW5nIHwgdW5kZWZpbmVkOw0KICAgIGNvbnN0IGltcG9ydGVkQ291bnQgPSByZXEucXVlcnkuZ2NhbF9pbXBvcnRlZCBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7DQogICAgY29uc3Qgc2tpcHBlZENvdW50ID0gcmVxLnF1ZXJ5LmdjYWxfc2tpcHBlZCBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7DQogICAgY29uc3QgY29uZmxpY3RzTGlzdCA9IHJlcS5xdWVyeS5nY2FsX2NvbmZsaWN0cyBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7DQo=", 'base64').toString('utf8'),
    ],
    [
      "admin:alert-display",
      Buffer.from("ICAgICAgJHtpbXBvcnRlZENvdW50ICE9PSB1bmRlZmluZWQgPyBgPGRpdiBjbGFzcz0iYWxlcnQgYWxlcnQtc3VjY2VzcyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTZweCI+4pyFIEltcG9ydGHDp8OjbyBjb25jbHXDrWRhOiAke2VzYyhpbXBvcnRlZENvdW50KX0gY29tcHJvbWlzc28ocykgaW1wb3J0YWRvKHMpIGNvbW8gYmxvcXVlaW8gZGUgaG9yw6FyaW8ke3NraXBwZWRDb3VudCAmJiBza2lwcGVkQ291bnQgIT09ICIwIiA/IGAgKCR7ZXNjKHNraXBwZWRDb3VudCl9IGrDoSBleGlzdGlhbSBvdSBuw6NvIHB1ZGVyYW0gc2VyIGltcG9ydGFkb3MpYCA6ICIifS48L2Rpdj5gIDogIiJ9DQo=", 'base64').toString('utf8'),
      Buffer.from("ICAgICAgJHtpbXBvcnRlZENvdW50ICE9PSB1bmRlZmluZWQgPyBgPGRpdiBjbGFzcz0iYWxlcnQgYWxlcnQtc3VjY2VzcyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTZweCI+4pyFIEltcG9ydGHDp8OjbyBjb25jbHXDrWRhOiAke2VzYyhpbXBvcnRlZENvdW50KX0gY29tcHJvbWlzc28ocykgaW1wb3J0YWRvKHMpIGNvbW8gYmxvcXVlaW8gZGUgaG9yw6FyaW8ke3NraXBwZWRDb3VudCAmJiBza2lwcGVkQ291bnQgIT09ICIwIiA/IGAgKCR7ZXNjKHNraXBwZWRDb3VudCl9IGrDoSBleGlzdGlhbSBvdSBuw6NvIHB1ZGVyYW0gc2VyIGltcG9ydGFkb3MpYCA6ICIifS4ke2NvbmZsaWN0c0xpc3QgPyBgPGJyLz48YnIvPuKaoO+4jyBOw6NvIGltcG9ydGFkb3MgcG9yIGrDoSBoYXZlciBhZ2VuZGFtZW50byBubyBob3LDoXJpbzogPHN0cm9uZz4ke2VzYyhjb25mbGljdHNMaXN0KX08L3N0cm9uZz4uYCA6ICIifTwvZGl2PmAgOiAiIn0NCg==", 'base64').toString('utf8'),
    ],
  ],
  'app/admin/(tabs)/integracoes.tsx': [
    [
      "app:importMutation",
      Buffer.from("ICBjb25zdCBpbXBvcnRNdXRhdGlvbiA9IHRycGMuYmFyYmVycy5pbXBvcnRHb29nbGVDYWxlbmRhckV2ZW50cy51c2VNdXRhdGlvbih7CiAgICBvblN1Y2Nlc3M6IChyZXN1bHQpID0+IHsKICAgICAgc3RhdHVzUXVlcnkucmVmZXRjaCgpOwogICAgICBBcHBBbGVydC5hbGVydCgKICAgICAgICAiSW1wb3J0YcOnw6NvIGNvbmNsdcOtZGEiLAogICAgICAgIGAke3Jlc3VsdC5pbXBvcnRlZH0gY29tcHJvbWlzc28ocykgaW1wb3J0YWRvKHMpIGNvbW8gYmxvcXVlaW8gZGUgaG9yw6FyaW8ke3Jlc3VsdC5za2lwcGVkID4gMCA/IGAgKCR7cmVzdWx0LnNraXBwZWR9IGrDoSBleGlzdGlhbSBvdSBuw6NvIHB1ZGVyYW0gc2VyIGltcG9ydGFkb3MpYCA6ICIifS5gCiAgICAgICk7CiAgICB9LAogICAgb25FcnJvcjogKGUpID0+IEFwcEFsZXJ0LmFsZXJ0KCJFcnJvIGFvIGltcG9ydGFyIiwgZS5tZXNzYWdlID8/ICJUZW50ZSBub3ZhbWVudGUuIiksCiAgfSk7", 'base64').toString('utf8'),
      Buffer.from("ICBjb25zdCBpbXBvcnRNdXRhdGlvbiA9IHRycGMuYmFyYmVycy5pbXBvcnRHb29nbGVDYWxlbmRhckV2ZW50cy51c2VNdXRhdGlvbih7CiAgICBvblN1Y2Nlc3M6IChyZXN1bHQpID0+IHsKICAgICAgc3RhdHVzUXVlcnkucmVmZXRjaCgpOwogICAgICBjb25zdCBjb25mbGljdHNNc2cgPSByZXN1bHQuY29uZmxpY3RzICYmIHJlc3VsdC5jb25mbGljdHMubGVuZ3RoID4gMAogICAgICAgID8gYFxuXG7imqDvuI8gTsOjbyBpbXBvcnRhZG9zIHBvciBqw6EgaGF2ZXIgYWdlbmRhbWVudG8gbm8gaG9yw6FyaW86ICR7cmVzdWx0LmNvbmZsaWN0cy5tYXAoKGM6IGFueSkgPT4gYCR7Yy5kYXRlLnNsaWNlKDgsIDEwKX0vJHtjLmRhdGUuc2xpY2UoNSwgNyl9ICR7Yy5zdGFydFRpbWUuc2xpY2UoMCwgNSl9YCkuam9pbigiLCAiKX0uYAogICAgICAgIDogIiI7CiAgICAgIEFwcEFsZXJ0LmFsZXJ0KAogICAgICAgICJJbXBvcnRhw6fDo28gY29uY2x1w61kYSIsCiAgICAgICAgYCR7cmVzdWx0LmltcG9ydGVkfSBjb21wcm9taXNzbyhzKSBpbXBvcnRhZG8ocykgY29tbyBibG9xdWVpbyBkZSBob3LDoXJpbyR7cmVzdWx0LnNraXBwZWQgPiAwID8gYCAoJHtyZXN1bHQuc2tpcHBlZH0gasOhIGV4aXN0aWFtIG91IG7Do28gcHVkZXJhbSBzZXIgaW1wb3J0YWRvcylgIDogIiJ9LiR7Y29uZmxpY3RzTXNnfWAKICAgICAgKTsKICAgIH0sCiAgICBvbkVycm9yOiAoZSkgPT4gQXBwQWxlcnQuYWxlcnQoIkVycm8gYW8gaW1wb3J0YXIiLCBlLm1lc3NhZ2UgPz8gIlRlbnRlIG5vdmFtZW50ZS4iKSwKICB9KTs=", 'base64').toString('utf8'),
    ],
  ],
};

function applyReplacements(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Arquivo não encontrado: ' + filePath);
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(__dirname, filePath);

  for (const [label, oldStr, newStr] of replacements) {
    const occurrences = content.split(oldStr).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `[${relPath}] "${label}": esperado 1 ocorrência do trecho original, encontrado ${occurrences}. ` +
        `Abortando sem gravar nada. Verifique se fix-gcal-import-appointment-conflict.cjs já foi aplicado antes deste script.`
      );
    }
    content = content.replace(oldStr, () => newStr);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${relPath}: ${replacements.length} alteração(ões) aplicada(s).`);
}

try {
  for (const [relFilePath, replacements] of Object.entries(FILES)) {
    const fullPath = path.join(__dirname, relFilePath);
    applyReplacements(fullPath, replacements);
  }
  console.log('');
  console.log('Tudo aplicado com sucesso. Próximos passos:');
  console.log('  1. git diff --stat   (deve mostrar os 3 arquivos)');
  console.log('  2. git diff   (conferir visualmente)');
  console.log('  3. git add server/google-calendar.ts server/admin-routes.ts "app/admin/(tabs)/integracoes.tsx"');
  console.log('  4. git commit -m "feat: mostra horarios especificos nao importados por conflito com agendamento"');
  console.log('  5. git push');
  console.log('  6. Testar: importar a Google Agenda com um evento que colida com um agendamento existente e ver se o horário aparece na mensagem');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
