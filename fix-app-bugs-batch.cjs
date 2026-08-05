// fix-app-bugs-batch.cjs
// Corrige um lote de bugs reais no APP MOBILE (e 1 no backend de apoio),
// encontrados na varredura dos erros do "npx tsc --noEmit":
//
// 1. app/admin/login.tsx — "AppAlert" usado 7x mas nunca importado. Qualquer
//    erro de login (senha errada, falha de rede, falha no Google) travava
//    o app com ReferenceError em vez de mostrar mensagem de erro.
//
// 2. app/admin/(tabs)/agenda.tsx —
//    a) "Alert" (react-native) usado em 5 pontos mas nunca importado nesse
//       arquivo; o arquivo já usa "AppAlert" (importado) em outros 2 pontos,
//       entao os 5 foram trocados pra AppAlert por consistencia.
//    b) "c.phone.includes(...)" quebrava com TypeError assim que existisse
//       UM cliente sem telefone na lista (campo ficou nullable desde o fix
//       do cadastro via Google) — corrigido com fallback pra string vazia.
//
// 3. app/admin/(tabs)/clients.tsx — botao de WhatsApp no swipe do card de
//    cliente chamava "handleWhatsApp", funcao que nao existe. Corrigido pra
//    usar "sendWhatsAppMessage" (ja importado e usado em outros pontos do
//    mesmo arquivo).
//
// 4. app/admin/(tabs)/commissions.tsx — "refreshing"/"onRefresh" usados no
//    RefreshControl mas nunca declarados. Isso e um ReferenceError em tempo
//    de RENDER (nao so no pull-to-refresh) — a tela de Comissoes quebrava
//    100% das vezes que era aberta. Adicionado o state e o handler,
//    seguindo o mesmo padrao ja usado em clients.tsx.
//
// 5. app/admin/(tabs)/coupons.tsx —
//    a) "discountValue: Number(discount)" mandava numero, backend espera
//       string (zod: discountValue: z.string()).
//    b) "expiresAt" nao existe no schema do backend (campo certo e
//       "validUntil") — zod ignora chaves desconhecidas silenciosamente,
//       entao TODO cupom criado pelo app ficava sem data de validade,
//       mesmo quando o usuario preenchia o campo no formulario.
//    c) trpc.coupons.delete nao existia no backend (so create/update/
//       toggle) — botao de excluir cupom sempre quebrado. Implementado
//       server/db.ts (deleteCoupon) + server/routers.ts (mutation delete,
//       com checagem de tenant inline, autossuficiente).
//
// Uso:
//   node fix-app-bugs-batch.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: cada trecho antigo
// precisa aparecer EXATAMENTE 1 vez por arquivo, e a substituicao usa
// content.replace(old, () => new). Independente dos outros scripts ja
// aplicados (fix-idor-*, fix-google-oauth-*, fix-slot-interval-*,
// fix-ensureasaascustomer-*, fix-ctx-barberid-*) — pode ser aplicado em
// qualquer ordem.

const fs = require('fs');
const path = require('path');

const FILES = {
  "app/admin/login.tsx": [
    [
      "import AppAlert",
      Buffer.from("aW1wb3J0IHsgSWNvblN5bWJvbCB9IGZyb20gIkAvY29tcG9uZW50cy91aS9pY29uLXN5bWJvbCI7CmltcG9ydCBBc3luY1N0b3JhZ2UgZnJvbSAiQHJlYWN0LW5hdGl2ZS1hc3luYy1zdG9yYWdlL2FzeW5jLXN0b3JhZ2UiOw==", 'base64').toString('utf8'),
      Buffer.from("aW1wb3J0IHsgSWNvblN5bWJvbCB9IGZyb20gIkAvY29tcG9uZW50cy91aS9pY29uLXN5bWJvbCI7CmltcG9ydCBBc3luY1N0b3JhZ2UgZnJvbSAiQHJlYWN0LW5hdGl2ZS1hc3luYy1zdG9yYWdlL2FzeW5jLXN0b3JhZ2UiOwppbXBvcnQgeyBBcHBBbGVydCB9IGZyb20gIkAvY29tcG9uZW50cy9hcHAtYWxlcnQiOw==", 'base64').toString('utf8'),
    ],
  ],
  "app/admin/(tabs)/agenda.tsx": [
    [
      "Alert->AppAlert onError",
      Buffer.from("ICAgIG9uRXJyb3I6IChlKSA9PiBBbGVydC5hbGVydCgiRXJybyIsIGUubWVzc2FnZSks", 'base64').toString('utf8'),
      Buffer.from("ICAgIG9uRXJyb3I6IChlKSA9PiBBcHBBbGVydC5hbGVydCgiRXJybyIsIGUubWVzc2FnZSks", 'base64').toString('utf8'),
    ],
    [
      "Alert->AppAlert cliente obrigatorio",
      Buffer.from("ICAgICAgQWxlcnQuYWxlcnQoIkF0ZW7Dp8OjbyIsICJOb21lIGUgdGVsZWZvbmUgc8OjbyBvYnJpZ2F0w7NyaW9zIHBhcmEgY2FkYXN0cmFyIG5vdm8gY2xpZW50ZS4iKTs=", 'base64').toString('utf8'),
      Buffer.from("ICAgICAgQXBwQWxlcnQuYWxlcnQoIkF0ZW7Dp8OjbyIsICJOb21lIGUgdGVsZWZvbmUgc8OjbyBvYnJpZ2F0w7NyaW9zIHBhcmEgY2FkYXN0cmFyIG5vdm8gY2xpZW50ZS4iKTs=", 'base64').toString('utf8'),
    ],
    [
      "Alert->AppAlert selecione cliente",
      Buffer.from("ICAgICAgQWxlcnQuYWxlcnQoIkF0ZW7Dp8OjbyIsICJTZWxlY2lvbmUgdW0gY2xpZW50ZS4iKTs=", 'base64').toString('utf8'),
      Buffer.from("ICAgICAgQXBwQWxlcnQuYWxlcnQoIkF0ZW7Dp8OjbyIsICJTZWxlY2lvbmUgdW0gY2xpZW50ZS4iKTs=", 'base64').toString('utf8'),
    ],
    [
      "Alert->AppAlert servico obrigatorio",
      Buffer.from("ICAgICAgQWxlcnQuYWxlcnQoIkF0ZW7Dp8OjbyIsICJOb21lIGUgcHJlw6dvIHPDo28gb2JyaWdhdMOzcmlvcyBwYXJhIGNhZGFzdHJhciBub3ZvIHNlcnZpw6dvLiIpOw==", 'base64').toString('utf8'),
      Buffer.from("ICAgICAgQXBwQWxlcnQuYWxlcnQoIkF0ZW7Dp8OjbyIsICJOb21lIGUgcHJlw6dvIHPDo28gb2JyaWdhdMOzcmlvcyBwYXJhIGNhZGFzdHJhciBub3ZvIHNlcnZpw6dvLiIpOw==", 'base64').toString('utf8'),
    ],
    [
      "Alert->AppAlert selecione servico",
      Buffer.from("ICAgICAgQWxlcnQuYWxlcnQoIkF0ZW7Dp8OjbyIsICJTZWxlY2lvbmUgdW0gc2VydmnDp28uIik7", 'base64').toString('utf8'),
      Buffer.from("ICAgICAgQXBwQWxlcnQuYWxlcnQoIkF0ZW7Dp8OjbyIsICJTZWxlY2lvbmUgdW0gc2VydmnDp28uIik7", 'base64').toString('utf8'),
    ],
    [
      "c.phone null-safe",
      Buffer.from("ICBjb25zdCBmaWx0ZXJlZENsaWVudHMgPSAoY2xpZW50c1F1ZXJ5LmRhdGEgPz8gW10pLmZpbHRlcihjID0+CiAgICBjLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhjbGllbnRTZWFyY2gudG9Mb3dlckNhc2UoKSkgfHwKICAgIGMucGhvbmUuaW5jbHVkZXMoY2xpZW50U2VhcmNoKQogICk7", 'base64').toString('utf8'),
      Buffer.from("ICBjb25zdCBmaWx0ZXJlZENsaWVudHMgPSAoY2xpZW50c1F1ZXJ5LmRhdGEgPz8gW10pLmZpbHRlcihjID0+CiAgICBjLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhjbGllbnRTZWFyY2gudG9Mb3dlckNhc2UoKSkgfHwKICAgIChjLnBob25lID8/ICIiKS5pbmNsdWRlcyhjbGllbnRTZWFyY2gpCiAgKTs=", 'base64').toString('utf8'),
    ],
  ],
  "app/admin/(tabs)/clients.tsx": [
    [
      "handleWhatsApp -> sendWhatsAppMessage",
      Buffer.from("ICAgICAgICAgICAgICAgICAgICBvblByZXNzPXsoKSA9PiBoYW5kbGVXaGF0c0FwcChpdGVtLnBob25lLCBpdGVtLm5hbWUpfQ==", 'base64').toString('utf8'),
      Buffer.from("ICAgICAgICAgICAgICAgICAgICBvblByZXNzPXsoKSA9PiBzZW5kV2hhdHNBcHBNZXNzYWdlKGl0ZW0ucGhvbmUsIGBPbMOhLCAke2l0ZW0ubmFtZX0hYCl9", 'base64').toString('utf8'),
    ],
  ],
  "app/admin/(tabs)/commissions.tsx": [
    [
      "refreshing/onRefresh state",
      Buffer.from("ICAgIG9uRXJyb3I6IChlcnIpID0+IEFsZXJ0LmFsZXJ0KCJFcnJvIiwgZXJyLm1lc3NhZ2UpLAogIH0pOwoKICBjb25zdCBhbGxTdW1tYXJ5ID0gc3VtbWFyeVF1ZXJ5LmRhdGEgPz8gW107", 'base64').toString('utf8'),
      Buffer.from("ICAgIG9uRXJyb3I6IChlcnIpID0+IEFsZXJ0LmFsZXJ0KCJFcnJvIiwgZXJyLm1lc3NhZ2UpLAogIH0pOwoKICBjb25zdCBbcmVmcmVzaGluZywgc2V0UmVmcmVzaGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7CiAgY29uc3Qgb25SZWZyZXNoID0gYXN5bmMgKCkgPT4gewogICAgc2V0UmVmcmVzaGluZyh0cnVlKTsKICAgIGF3YWl0IFByb21pc2UuYWxsKFtzdW1tYXJ5UXVlcnkucmVmZXRjaCgpLCBjb25maWdzUXVlcnkucmVmZXRjaCgpXSk7CiAgICBzZXRSZWZyZXNoaW5nKGZhbHNlKTsKICB9OwoKICBjb25zdCBhbGxTdW1tYXJ5ID0gc3VtbWFyeVF1ZXJ5LmRhdGEgPz8gW107", 'base64').toString('utf8'),
    ],
  ],
  "app/admin/(tabs)/coupons.tsx": [
    [
      "discountValue/validUntil fix",
      Buffer.from("ICAgICAgZGlzY291bnRWYWx1ZTogTnVtYmVyKGRpc2NvdW50KSwKICAgICAgbWF4VXNlczogbWF4VXNlcyA/IE51bWJlcihtYXhVc2VzKSA6IHVuZGVmaW5lZCwKICAgICAgZXhwaXJlc0F0OiBleHBpcmVzQXQgfHwgdW5kZWZpbmVkLAogICAgfSk7", 'base64').toString('utf8'),
      Buffer.from("ICAgICAgZGlzY291bnRWYWx1ZTogZGlzY291bnQudHJpbSgpLAogICAgICBtYXhVc2VzOiBtYXhVc2VzID8gTnVtYmVyKG1heFVzZXMpIDogdW5kZWZpbmVkLAogICAgICB2YWxpZFVudGlsOiBleHBpcmVzQXQgfHwgdW5kZWZpbmVkLAogICAgfSk7", 'base64').toString('utf8'),
    ],
  ],
  "server/db.ts": [
    [
      "deleteCoupon function",
      Buffer.from("ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUNvdXBvbihpZDogbnVtYmVyLCBkYXRhOiBQYXJ0aWFsPHR5cGVvZiBjb3Vwb25zLiRpbmZlckluc2VydD4pIHsKICBjb25zdCBkYiA9IGF3YWl0IGdldERiKCk7CiAgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCJEYXRhYmFzZSBub3QgYXZhaWxhYmxlIik7CiAgYXdhaXQgZGIudXBkYXRlKGNvdXBvbnMpLnNldChkYXRhKS53aGVyZShlcShjb3Vwb25zLmlkLCBpZCkpOwp9", 'base64').toString('utf8'),
      Buffer.from("ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUNvdXBvbihpZDogbnVtYmVyLCBkYXRhOiBQYXJ0aWFsPHR5cGVvZiBjb3Vwb25zLiRpbmZlckluc2VydD4pIHsKICBjb25zdCBkYiA9IGF3YWl0IGdldERiKCk7CiAgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCJEYXRhYmFzZSBub3QgYXZhaWxhYmxlIik7CiAgYXdhaXQgZGIudXBkYXRlKGNvdXBvbnMpLnNldChkYXRhKS53aGVyZShlcShjb3Vwb25zLmlkLCBpZCkpOwp9CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlQ291cG9uKGlkOiBudW1iZXIpIHsKICBjb25zdCBkYiA9IGF3YWl0IGdldERiKCk7CiAgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCJEYXRhYmFzZSBub3QgYXZhaWxhYmxlIik7CiAgLy8gInNhbGVzLmNvdXBvbklkIiBuw6NvIMOpIHVtYSBGSyBmb3JtYWwgbm8gc2NoZW1hICjDqSB1bSBpbnRlZ2VyIHNvbHRvLAogIC8vIGlndWFsIGJvYSBwYXJ0ZSBkYXMgY29sdW5hcyBkZSByZWZlcsOqbmNpYSBkZXN0ZSBwcm9qZXRvKSwgZW50w6NvIGV4Y2x1aXIKICAvLyBvIGN1cG9tIG7Do28gcXVlYnJhIHZlbmRhcyBhbnRpZ2FzIHF1ZSBqw6EgdXNhcmFtIGVsZSDigJQgbyAiY291cG9uQ29kZSIKICAvLyAodGV4dG8pIGrDoSBmaWNhIHNhbHZvIHNlcGFyYWRvIGVtIGNhZGEgdmVuZGEgcHJhIG1hbnRlciBvIGhpc3TDs3JpY28uCiAgYXdhaXQgZGIuZGVsZXRlKGNvdXBvbnMpLndoZXJlKGVxKGNvdXBvbnMuaWQsIGlkKSk7Cn0=", 'base64').toString('utf8'),
    ],
  ],
  "server/routers.ts": [
    [
      "coupons.delete mutation",
      Buffer.from("ICAgIGluYWN0aXZlOiBwdWJsaWNQcm9jZWR1cmU=", 'base64').toString('utf8'),
      Buffer.from("ICAgIC8vIE8gYXBwIG1vYmlsZSBqw6EgY2hhbWF2YSB0cnBjLmNvdXBvbnMuZGVsZXRlLCBtYXMgZXNzZSBlbmRwb2ludCBudW5jYQogICAgLy8gdGluaGEgc2lkbyBpbXBsZW1lbnRhZG8gbm8gYmFja2VuZCAoc8OzIGV4aXN0aWEgdG9nZ2xlLCBxdWUKICAgIC8vIGF0aXZhL2Rlc2F0aXZhKS4gQm90w6NvIGRlIGV4Y2x1aXIgY3Vwb20gZmljYXZhIHNlbXByZSBxdWVicmFkby4KICAgIC8vIENoZWNhZ2VtIGRlIHRlbmFudCBmZWl0YSBpbmxpbmUgKGVtIHZleiBkZSB1c2FyIGFzc2VydFRlbmFudE93bmVyc2hpcCkKICAgIC8vIHByYSBlc3RlIGZpeCBuw6NvIGRlcGVuZGVyIGRlIG5lbmh1bSBvdXRybyBzY3JpcHQgasOhIHRlciBzaWRvIGFwbGljYWRvLgogICAgZGVsZXRlOiBhY3RpdmVCYXJiZXJQcm9jZWR1cmUuaW5wdXQoei5vYmplY3QoeyBpZDogei5udW1iZXIoKSB9KSkubXV0YXRpb24oYXN5bmMgKHsgaW5wdXQsIGN0eCB9KSA9PiB7CiAgICAgIGNvbnN0IGFsbENvdXBvbnMgPSBhd2FpdCBkYi5nZXRBbGxDb3Vwb25zKCk7CiAgICAgIGNvbnN0IGNvdXBvbiA9IChhbGxDb3Vwb25zIGFzIGFueVtdKS5maW5kKChjOiBhbnkpID0+IGMuaWQgPT09IGlucHV0LmlkKTsKICAgICAgaWYgKCFjb3Vwb24pIHRocm93IG5ldyBUUlBDRXJyb3IoeyBjb2RlOiAiTk9UX0ZPVU5EIiwgbWVzc2FnZTogIkN1cG9tIG7Do28gZW5jb250cmFkby4iIH0pOwogICAgICBpZiAoY291cG9uLnRlbmFudElkICE9PSBjdHguYmFyYmVyPy50ZW5hbnRJZCkgdGhyb3cgbmV3IFRSUENFcnJvcih7IGNvZGU6ICJGT1JCSURERU4iLCBtZXNzYWdlOiAiVm9jw6ogbsOjbyB0ZW0gcGVybWlzc8OjbyBwYXJhIGFjZXNzYXIgZXN0ZSByZWN1cnNvLiIgfSk7CiAgICAgIGF3YWl0IGRiLmRlbGV0ZUNvdXBvbihpbnB1dC5pZCk7CiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsKICAgIH0pLAogICAgaW5hY3RpdmU6IHB1YmxpY1Byb2NlZHVyZQ==", 'base64').toString('utf8'),
    ],
  ],
};

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
  for (const [relFilePath, replacements] of Object.entries(FILES)) {
    const fullPath = path.join(__dirname, relFilePath);
    applyReplacements(fullPath, replacements);
  }
  console.log('');
  console.log('Tudo aplicado com sucesso. Próximos passos:');
  console.log('  1. git diff --stat   (deve mostrar os 7 arquivos listados no topo deste script)');
  console.log('  2. git diff   (conferir visualmente, especialmente commissions.tsx e coupons.tsx)');
  console.log('  3. Rodar o app localmente (expo start) e testar:');
  console.log('     - Login com senha errada (deve mostrar alerta, não travar)');
  console.log('     - Buscar um cliente sem telefone na Agenda');
  console.log('     - Botão WhatsApp no swipe de um cliente');
  console.log('     - Abrir a tela de Comissões (não pode mais travar)');
  console.log('     - Criar um cupom com data de validade + excluir um cupom');
  console.log('  4. git add . && git commit && git push');
  console.log('  5. Só depois de tudo testado: gerar o novo build (versionCode++) pra subir no Play Console');
} catch (err) {
  console.error('❌ Falha ao aplicar as alterações:');
  console.error(err.message);
  process.exit(1);
}
