// fix-google-oauth-malformed-code.cjs
// Corrige o erro "invalid_grant: Malformed auth code" no login/cadastro via
// Google e na conexao do Google Agenda. Causa raiz: req.query.code passa pelo
// parser padrao do Express (lib "qs"), que decodifica "+" como espaco (convencao
// de formulario). Codigos de autorizacao do Google as vezes contem um "+"
// literal e o Google nao faz o percent-encode desse caractere no redirect —
// o "+" vira espaco e a troca de token falha. Corrigido extraindo o "code"
// direto da query string crua (req.originalUrl) via regex + decodeURIComponent,
// que nunca trata "+" como espaco.
//
// Afeta: server/admin-routes.ts (CRLF — preservado neste script).
//
// Uso:
//   node fix-google-oauth-malformed-code.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: cada trecho antigo precisa
// aparecer EXATAMENTE 1 vez, e a substituicao usa content.replace(old, () => new)
// (nunca a forma com string direta), porque os trechos contem "$" em alguns
// pontos (redirects com querystring) — mesma armadilha do bug do PIX_DIRETO.

const fs = require('fs');
const path = require('path');

const ADMIN_ROUTES_PATH = path.join(__dirname, 'server', 'admin-routes.ts');

const replacements = [
  [
    "admin-routes:helper",
    Buffer.from("YXN5bmMgZnVuY3Rpb24gZXhjaGFuZ2VHb29nbGVDb2RlKGNvZGU6IHN0cmluZywgcmVkaXJlY3RVcmk6IHN0cmluZyk6IFByb21pc2U8eyBlbWFpbDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IHN1Yjogc3RyaW5nOyBwaWN0dXJlPzogc3RyaW5nIH0+IHsNCg==", 'base64').toString('utf8'),
    Buffer.from("Ly8gZXh0cmFjdFJhd0F1dGhDb2RlIOKAlCBleHRyYWkgbyBwYXJhbWV0cm8gImNvZGUiIGRhIHF1ZXJ5IHN0cmluZyBTRU0gcGFzc2FyDQogIC8vIHBlbG8gcGFyc2VyIHBhZHJhbyBkbyBFeHByZXNzIChyZXEucXVlcnkpLCBxdWUgdXNhIGEgbGliICJxcyIuIE8gInFzIiAoZQ0KICAvLyBvIFVSTFNlYXJjaFBhcmFtcyBuYXRpdm8sIHF1ZSB0ZW0gbyBtZXNtbyBjb21wb3J0YW1lbnRvKSBkZWNvZGlmaWNhICIrIg0KICAvLyBjb21vIGVzcGFjbywgc2VndWluZG8gYSBjb252ZW5jYW8gZGUgZm9ybXVsYXJpb3MgKGFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tDQogIC8vIHVybGVuY29kZWQpLiBPIHByb2JsZW1hOiBjb2RpZ29zIGRlIGF1dG9yaXphY2FvIGRvIEdvb2dsZSBhcyB2ZXplcyBjb250ZW0NCiAgLy8gdW0gIisiIGxpdGVyYWwsIGUgbyByZWRpcmVjdCBkbyBHb29nbGUgbmFvIGZheiBvIHBlcmNlbnQtZW5jb2RlIGRlc3NlDQogIC8vIGNhcmFjdGVyZSBuYSBVUkwuIFJlc3VsdGFkbzogbyAiKyIgdmlyYSBlc3BhY28sIG8gY29kZSBmaWNhIGNvcnJvbXBpZG8sIGUNCiAgLy8gYSB0cm9jYSBkZSB0b2tlbiBmYWxoYSBjb20gImludmFsaWRfZ3JhbnQ6IE1hbGZvcm1lZCBhdXRoIGNvZGUiIChidWcgcmVhbA0KICAvLyB2aXN0byBlbSBwcm9kdWNhbyBlbSAwNC8wOC8yMDI2KS4gZGVjb2RlVVJJQ29tcG9uZW50IE5VTkNBIHRyYXRhICIrIiBjb21vDQogIC8vIGVzcGFjbywgZW50YW8gZXh0cmFpciBuYSBtYW8gY29tIHJlZ2V4ICsgZGVjb2RlVVJJQ29tcG9uZW50IGV2aXRhIG8gcHJvYmxlbWENCiAgLy8gdGFudG8gcGFyYSBvICIrIiBjcnUgcXVhbnRvIHBhcmEgbyBjYXNvIChjb3JyZXRvKSBkZSB2aXIgY29tbyAlMkIuDQogIGZ1bmN0aW9uIGV4dHJhY3RSYXdBdXRoQ29kZShyZXE6IFJlcXVlc3QpOiBzdHJpbmcgfCBudWxsIHsNCiAgICBjb25zdCBxdWVyeVN0cmluZyA9IHJlcS5vcmlnaW5hbFVybC5zcGxpdCgiPyIpWzFdID8/ICIiOw0KICAgIGNvbnN0IG1hdGNoID0gcXVlcnlTdHJpbmcubWF0Y2goLyg/Ol58Jiljb2RlPShbXiZdKikvKTsNCiAgICBpZiAoIW1hdGNoKSByZXR1cm4gbnVsbDsNCiAgICB0cnkgew0KICAgICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChtYXRjaFsxXSk7DQogICAgfSBjYXRjaCB7DQogICAgICByZXR1cm4gbnVsbDsNCiAgICB9DQogIH0NCg0KICBhc3luYyBmdW5jdGlvbiBleGNoYW5nZUdvb2dsZUNvZGUoY29kZTogc3RyaW5nLCByZWRpcmVjdFVyaTogc3RyaW5nKTogUHJvbWlzZTx7IGVtYWlsOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgc3ViOiBzdHJpbmc7IHBpY3R1cmU/OiBzdHJpbmcgfT4gew0K", 'base64').toString('utf8'),
  ],
  [
    "admin-routes:google-signup-callback",
    Buffer.from("ICAgICAgY29uc3QgY29kZSA9IHJlcS5xdWVyeS5jb2RlIGFzIHN0cmluZzsNCiAgICAgIGNvbnN0IHN0YXRlID0gcmVxLnF1ZXJ5LnN0YXRlIGFzIHN0cmluZzsNCiAgICAgIGlmICghY29kZSkgcmV0dXJuIHJlcy5yZWRpcmVjdCgiLz9zaWdudXBfZXJyb3I9MSIpOw0K", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgY29uc3QgY29kZSA9IGV4dHJhY3RSYXdBdXRoQ29kZShyZXEpOw0KICAgICAgY29uc3Qgc3RhdGUgPSByZXEucXVlcnkuc3RhdGUgYXMgc3RyaW5nOw0KICAgICAgaWYgKCFjb2RlKSByZXR1cm4gcmVzLnJlZGlyZWN0KCIvP3NpZ251cF9lcnJvcj0xIik7DQo=", 'base64').toString('utf8'),
  ],
  [
    "admin-routes:google-callback",
    Buffer.from("ICAgICAgY29uc3QgY29kZSA9IHJlcS5xdWVyeS5jb2RlIGFzIHN0cmluZzsNCiAgICAgIGlmICghY29kZSkgcmV0dXJuIHJlcy5yZWRpcmVjdCgiL2FkbWluL2xvZ2luP2Vycm9yPTEiKTsNCg==", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgY29uc3QgY29kZSA9IGV4dHJhY3RSYXdBdXRoQ29kZShyZXEpOw0KICAgICAgaWYgKCFjb2RlKSByZXR1cm4gcmVzLnJlZGlyZWN0KCIvYWRtaW4vbG9naW4/ZXJyb3I9MSIpOw0K", 'base64').toString('utf8'),
  ],
  [
    "admin-routes:google-calendar-callback",
    Buffer.from("ICAgICAgY29uc3Qgc2Vzc2lvbiA9IChyZXEgYXMgYW55KS5hZG1pblNlc3Npb24gYXMgeyBiYXJiZXJJZDogbnVtYmVyIH07DQogICAgICBjb25zdCBjb2RlID0gcmVxLnF1ZXJ5LmNvZGUgYXMgc3RyaW5nOw0KICAgICAgY29uc3QgZXJyb3JQYXJhbSA9IHJlcS5xdWVyeS5lcnJvciBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7DQo=", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgY29uc3Qgc2Vzc2lvbiA9IChyZXEgYXMgYW55KS5hZG1pblNlc3Npb24gYXMgeyBiYXJiZXJJZDogbnVtYmVyIH07DQogICAgICBjb25zdCBjb2RlID0gZXh0cmFjdFJhd0F1dGhDb2RlKHJlcSk7DQogICAgICBjb25zdCBlcnJvclBhcmFtID0gcmVxLnF1ZXJ5LmVycm9yIGFzIHN0cmluZyB8IHVuZGVmaW5lZDsNCg==", 'base64').toString('utf8'),
  ],
];

function applyReplacements(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  // 'utf8' preserva os bytes de quebra de linha como estao no arquivo (CRLF
  // neste caso) — não faz nenhuma normalização de \r\n.
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
  applyReplacements(ADMIN_ROUTES_PATH, replacements);
  console.log('');
  console.log('Tudo aplicado com sucesso. Próximos passos:');
  console.log('  1. git diff --stat   (deve mostrar só server/admin-routes.ts)');
  console.log('  2. git diff server/admin-routes.ts | head -80   (conferir visualmente)');
  console.log('  3. Rodar o build normal do projeto pra checar erros de tipo');
  console.log('  4. Testar manualmente: login com Google no /admin e conectar Google Agenda em /admin/integracoes');
  console.log('  5. git add server/admin-routes.ts && git commit && git push');
} catch (err) {
  console.error('❌ Falha ao aplicar as alterações:');
  console.error(err.message);
  process.exit(1);
}
