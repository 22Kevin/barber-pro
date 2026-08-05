// fix-ctx-barberid-and-email-bugs.cjs
// Corrige um lote de bugs reais encontrados na varredura, todos em
// server/routers.ts, revelados originalmente pelo "npx tsc --noEmit":
//
// 1. "ctx.barberId" nao existe no contexto do tRPC (o campo certo e
//    "ctx.barber.barberId"). Afeta 4 pontos:
//    - branches.create e branches.delete: QUEBRA TOTAL da criacao/exclusao
//      de filiais (feature paga, exclusiva do plano Estudio) — sempre
//      retornava FORBIDDEN porque a busca do barbeiro falhava.
//    - transferencia de estoque entre filiais: gravava barberId
//      undefined no historico de movimentacao (perde o rastro de quem
//      fez a transferencia).
//    - criacao de produto com estoque inicial: gravava barberId null na
//      despesa automatica de "Estoque inicial".
//
// 2. "db.getTenantById(ctx.barber.tenantId)" sem tratar tenantId null —
//    baixa severidade (so afeta o caso raro de barbeiro sem tenantId, e
//    falha "seguro", bloqueando a feature em vez de vazar), mas corrigido
//    por completude em 2 pontos (products.create e commissions.saveConfig).
//
// 3. E-mail de confirmacao de pagamento Pix (o e-mail que manda o codigo
//    Pix pro cliente pagar a assinatura) usava alertBox() com só 2 dos 4
//    argumentos esperados — o resultado visual: a palavra literal
//    "warning" no lugar do icone, e a palavra literal "undefined" embaixo
//    do codigo Pix. Corrigido pra usar os 4 argumentos certos. Também
//    corrigido emailLayout({ title: ... }) pra headerSubtitle (nome
//    certo da opcao — "title" era silenciosamente ignorado).
//
// Uso:
//   node fix-ctx-barberid-and-email-bugs.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: cada trecho antigo
// precisa aparecer EXATAMENTE 1 vez, e a substituicao usa
// content.replace(old, () => new). Este fix e independente dos outros
// scripts ja aplicados (fix-idor-*, fix-google-oauth-*, fix-slot-interval-*,
// fix-ensureasaascustomer-*) — mexe em regioes totalmente separadas do
// arquivo, entao pode ser aplicado em qualquer ordem.

const fs = require('fs');
const path = require('path');

const ROUTERS_PATH = path.join(__dirname, 'server', 'routers.ts');

const replacements = [
  [
    "branches.create ctx.barberId",
    Buffer.from("ICAgICAgY29uc3QgYmFyYmVyID0gYXdhaXQgZGIuZ2V0QmFyYmVyQnlJZChjdHguYmFyYmVySWQpOwogICAgICBpZiAoIWJhcmJlciB8fCBiYXJiZXIucm9sZSAhPT0gJ3N1cGVyX2FkbWluJykgdGhyb3cgbmV3IFRSUENFcnJvcih7IGNvZGU6ICdGT1JCSURERU4nLCBtZXNzYWdlOiAnQXBlbmFzIHN1cGVyX2FkbWluIHBvZGUgY3JpYXIgZmlsaWFpcycgfSk7", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgY29uc3QgYmFyYmVyID0gYXdhaXQgZGIuZ2V0QmFyYmVyQnlJZChjdHguYmFyYmVyLmJhcmJlcklkKTsKICAgICAgaWYgKCFiYXJiZXIgfHwgYmFyYmVyLnJvbGUgIT09ICdzdXBlcl9hZG1pbicpIHRocm93IG5ldyBUUlBDRXJyb3IoeyBjb2RlOiAnRk9SQklEREVOJywgbWVzc2FnZTogJ0FwZW5hcyBzdXBlcl9hZG1pbiBwb2RlIGNyaWFyIGZpbGlhaXMnIH0pOw==", 'base64').toString('utf8'),
  ],
  [
    "branches.delete ctx.barberId",
    Buffer.from("ICAgICAgY29uc3QgYmFyYmVyID0gYXdhaXQgZGIuZ2V0QmFyYmVyQnlJZChjdHguYmFyYmVySWQpOwogICAgICBpZiAoIWJhcmJlciB8fCBiYXJiZXIucm9sZSAhPT0gJ3N1cGVyX2FkbWluJykgdGhyb3cgbmV3IFRSUENFcnJvcih7IGNvZGU6ICdGT1JCSURERU4nIH0pOw==", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgY29uc3QgYmFyYmVyID0gYXdhaXQgZGIuZ2V0QmFyYmVyQnlJZChjdHguYmFyYmVyLmJhcmJlcklkKTsKICAgICAgaWYgKCFiYXJiZXIgfHwgYmFyYmVyLnJvbGUgIT09ICdzdXBlcl9hZG1pbicpIHRocm93IG5ldyBUUlBDRXJyb3IoeyBjb2RlOiAnRk9SQklEREVOJyB9KTs=", 'base64').toString('utf8'),
  ],
  [
    "transferStock barberId",
    Buffer.from("ICAgICAgY29uc3QgYmFyYmVySWQgPSBjdHguYmFyYmVySWQ7", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgY29uc3QgYmFyYmVySWQgPSBjdHguYmFyYmVyLmJhcmJlcklkOw==", 'base64').toString('utf8'),
  ],
  [
    "products.create expense barberId",
    Buffer.from("ICAgICAgICAgICAgYmFyYmVySWQ6IGN0eD8uYmFyYmVySWQgPz8gbnVsbCw=", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgICAgICAgYmFyYmVySWQ6IGN0eC5iYXJiZXI/LmJhcmJlcklkID8/IG51bGws", 'base64').toString('utf8'),
  ],
  [
    "products.create tenantForGuard",
    Buffer.from("ICAgICAgLm11dGF0aW9uKGFzeW5jICh7IGlucHV0LCBjdHggfSkgPT4gewogICAgICAgIGNvbnN0IHRlbmFudEZvckd1YXJkID0gYXdhaXQgZGIuZ2V0VGVuYW50QnlJZChjdHguYmFyYmVyLnRlbmFudElkKTsKICAgICAgICBhc3NlcnRGZWF0dXJlKHRlbmFudEZvckd1YXJkPy5wbGFuLCAicHJvZHVjdHMiKTsKICAgICAgICBjb25zdCBwcm9kdWN0SWQgPSBhd2FpdCBkYi5jcmVhdGVQcm9kdWN0KGlucHV0IGFzIGFueSk7", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgLm11dGF0aW9uKGFzeW5jICh7IGlucHV0LCBjdHggfSkgPT4gewogICAgICAgIGNvbnN0IHRlbmFudEZvckd1YXJkID0gY3R4LmJhcmJlci50ZW5hbnRJZCAhPSBudWxsID8gYXdhaXQgZGIuZ2V0VGVuYW50QnlJZChjdHguYmFyYmVyLnRlbmFudElkKSA6IHVuZGVmaW5lZDsKICAgICAgICBhc3NlcnRGZWF0dXJlKHRlbmFudEZvckd1YXJkPy5wbGFuLCAicHJvZHVjdHMiKTsKICAgICAgICBjb25zdCBwcm9kdWN0SWQgPSBhd2FpdCBkYi5jcmVhdGVQcm9kdWN0KGlucHV0IGFzIGFueSk7", 'base64').toString('utf8'),
  ],
  [
    "commissions.saveConfig tenantForGuard",
    Buffer.from("ICAgICAgLm11dGF0aW9uKGFzeW5jICh7IGlucHV0LCBjdHggfSkgPT4gewogICAgICAgIGNvbnN0IHRlbmFudEZvckd1YXJkID0gYXdhaXQgZGIuZ2V0VGVuYW50QnlJZChjdHguYmFyYmVyLnRlbmFudElkKTsKICAgICAgICBhc3NlcnRGZWF0dXJlKHRlbmFudEZvckd1YXJkPy5wbGFuLCAiY29tbWlzc2lvbnMiKTsKICAgICAgICByZXR1cm4gZGIudXBzZXJ0Q29tbWlzc2lvbkNvbmZpZyhpbnB1dCk7CiAgICAgIH0pLA==", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgLm11dGF0aW9uKGFzeW5jICh7IGlucHV0LCBjdHggfSkgPT4gewogICAgICAgIGNvbnN0IHRlbmFudEZvckd1YXJkID0gY3R4LmJhcmJlci50ZW5hbnRJZCAhPSBudWxsID8gYXdhaXQgZGIuZ2V0VGVuYW50QnlJZChjdHguYmFyYmVyLnRlbmFudElkKSA6IHVuZGVmaW5lZDsKICAgICAgICBhc3NlcnRGZWF0dXJlKHRlbmFudEZvckd1YXJkPy5wbGFuLCAiY29tbWlzc2lvbnMiKTsKICAgICAgICByZXR1cm4gZGIudXBzZXJ0Q29tbWlzc2lvbkNvbmZpZyhpbnB1dCk7CiAgICAgIH0pLA==", 'base64').toString('utf8'),
  ],
  [
    "alertBox + emailLayout pix email",
    Buffer.from("ICAgICAgICAgICAgICAke2FsZXJ0Qm94KCJ3YXJuaW5nIiwgYAogICAgICAgICAgICAgICAgPHN0cm9uZz5QaXggQ29waWEgZSBDb2xhPC9zdHJvbmc+PGJyLz4KICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPSJmb250LWZhbWlseTptb25vc3BhY2U7Zm9udC1zaXplOjEycHg7d29yZC1icmVhazpicmVhay1hbGw7Y29sb3I6I0VDRURFRSI+JHtwaXhDb2RlfTwvc3Bhbj4KICAgICAgICAgICAgICBgKX0KICAgICAgICAgICAgICA8cCBzdHlsZT0ibWFyZ2luOjE2cHggMCA4cHg7Y29sb3I6IzlCQTFBNjtmb250LXNpemU6MTNweCI+CiAgICAgICAgICAgICAgICBDb3BpZSBvIGPDs2RpZ28gYWNpbWEgZSBjb2xlIG5vIGFwcCBkbyBzZXUgYmFuY28gcGFyYSBwYWdhci4gTyBhY2Vzc28gc2Vyw6EgbGliZXJhZG8gYXV0b21hdGljYW1lbnRlIGFww7NzIGEgY29uZmlybWHDp8Ojby4KICAgICAgICAgICAgICA8L3A+CiAgICAgICAgICAgICAgPHAgc3R5bGU9Im1hcmdpbjowO2NvbG9yOiM2ODcwNzY7Zm9udC1zaXplOjEycHgiPgogICAgICAgICAgICAgICAg4pqg77iPIE8gY8OzZGlnbyBQaXggZXhwaXJhIGVtIDMwIG1pbnV0b3MuIFNlIGV4cGlyYXIsIGFjZXNzZSBvIHNpc3RlbWEgZSBnZXJlIHVtIG5vdm8gY8OzZGlnby4KICAgICAgICAgICAgICA8L3A+CiAgICAgICAgICAgIGA7CiAgICAgICAgICAgIHNlbmRFbWFpbCh7CiAgICAgICAgICAgICAgdG86IGlucHV0Lm93bmVyRW1haWwsCiAgICAgICAgICAgICAgc3ViamVjdDogYPCfkrMgQmFyYmVyIFBybyDigJQgUGFndWUgdmlhIFBpeCBwYXJhIGF0aXZhciBvIFBsYW5vICR7cGxhbkxhYmVsfWAsCiAgICAgICAgICAgICAgaHRtbDogZW1haWxMYXlvdXQoYm9keSwgewogICAgICAgICAgICAgICAgdGl0bGU6ICJQYWdhbWVudG8gUGl4IOKAlCBCYXJiZXIgUHJvIiwKICAgICAgICAgICAgICAgIHByZXZpZXdUZXh0OiBgU2V1IGPDs2RpZ28gUGl4IHBhcmEgYXRpdmFyIG8gUGxhbm8gJHtwbGFuTGFiZWx9IGRvIEJhcmJlciBQcm9gLAogICAgICAgICAgICAgIH0pLA==", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgICAgICAgICAke2FsZXJ0Qm94KCLwn5KzIiwgIlBpeCBDb3BpYSBlIENvbGEiLCBgPHNwYW4gc3R5bGU9ImZvbnQtZmFtaWx5Om1vbm9zcGFjZTtmb250LXNpemU6MTJweDt3b3JkLWJyZWFrOmJyZWFrLWFsbDtjb2xvcjojRUNFREVFIj4ke3BpeENvZGV9PC9zcGFuPmAsICIjRkJCRjI0Iil9CiAgICAgICAgICAgICAgPHAgc3R5bGU9Im1hcmdpbjoxNnB4IDAgOHB4O2NvbG9yOiM5QkExQTY7Zm9udC1zaXplOjEzcHgiPgogICAgICAgICAgICAgICAgQ29waWUgbyBjw7NkaWdvIGFjaW1hIGUgY29sZSBubyBhcHAgZG8gc2V1IGJhbmNvIHBhcmEgcGFnYXIuIE8gYWNlc3NvIHNlcsOhIGxpYmVyYWRvIGF1dG9tYXRpY2FtZW50ZSBhcMOzcyBhIGNvbmZpcm1hw6fDo28uCiAgICAgICAgICAgICAgPC9wPgogICAgICAgICAgICAgIDxwIHN0eWxlPSJtYXJnaW46MDtjb2xvcjojNjg3MDc2O2ZvbnQtc2l6ZToxMnB4Ij4KICAgICAgICAgICAgICAgIOKaoO+4jyBPIGPDs2RpZ28gUGl4IGV4cGlyYSBlbSAzMCBtaW51dG9zLiBTZSBleHBpcmFyLCBhY2Vzc2UgbyBzaXN0ZW1hIGUgZ2VyZSB1bSBub3ZvIGPDs2RpZ28uCiAgICAgICAgICAgICAgPC9wPgogICAgICAgICAgICBgOwogICAgICAgICAgICBzZW5kRW1haWwoewogICAgICAgICAgICAgIHRvOiBpbnB1dC5vd25lckVtYWlsLAogICAgICAgICAgICAgIHN1YmplY3Q6IGDwn5KzIEJhcmJlciBQcm8g4oCUIFBhZ3VlIHZpYSBQaXggcGFyYSBhdGl2YXIgbyBQbGFubyAke3BsYW5MYWJlbH1gLAogICAgICAgICAgICAgIGh0bWw6IGVtYWlsTGF5b3V0KGJvZHksIHsKICAgICAgICAgICAgICAgIGhlYWRlclN1YnRpdGxlOiAiUGFnYW1lbnRvIFBpeCDigJQgQmFyYmVyIFBybyIsCiAgICAgICAgICAgICAgICBwcmV2aWV3VGV4dDogYFNldSBjw7NkaWdvIFBpeCBwYXJhIGF0aXZhciBvIFBsYW5vICR7cGxhbkxhYmVsfSBkbyBCYXJiZXIgUHJvYCwKICAgICAgICAgICAgICB9KSw=", 'base64').toString('utf8'),
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
  applyReplacements(ROUTERS_PATH, replacements);
  console.log('');
  console.log('Tudo aplicado com sucesso. Próximos passos:');
  console.log('  1. git diff --stat   (deve mostrar só server/routers.ts)');
  console.log('  2. git diff server/routers.ts   (conferir visualmente)');
  console.log('  3. npx esbuild server/routers.ts --outfile=nul --format=esm --platform=node');
  console.log('  4. Testar manualmente: criar/excluir uma filial (plano Estúdio), transferir estoque entre filiais, e gerar uma assinatura via Pix pra ver o e-mail');
  console.log('  5. git add server/routers.ts && git commit && git push');
} catch (err) {
  console.error('❌ Falha ao aplicar as alterações:');
  console.error(err.message);
  process.exit(1);
}
