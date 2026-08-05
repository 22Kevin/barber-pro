// fix-ensureasaascustomer-undefined.cjs
// Corrige um ReferenceError real em producao: duas rotas de upgrade de plano
// (a mutation tRPC "upgradeBarberproSubscription", usada pelo app/telas
// client-side, e a rota web POST /admin/configuracoes/asaas/upgrade-plan)
// chamavam uma funcao chamada "ensureAsaasCustomer", que nao existe em
// server/asaas.ts — o nome certo e "ensureAsaasRootCustomer". Isso quebra
// 100% das tentativas de troca de plano (Solo/Equipe/Estudio) com um erro
// no servidor.
//
// Aproveitando a correcao, tambem passou a reaproveitar o
// "barberproAsaasCustomerId" ja salvo no tenant (da assinatura original) em
// vez de tentar criar um customer novo no Asaas toda vez — evita duplicar
// clientes no Asaas e resolve tambem a falta do campo "email" (obrigatorio
// em ensureAsaasRootCustomer, que a chamada quebrada nunca passava).
//
// Afeta: server/routers.ts (LF) e server/admin-routes.ts (CRLF — preservado
// neste script).
//
// Uso:
//   node fix-ensureasaascustomer-undefined.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: cada trecho antigo
// precisa aparecer EXATAMENTE 1 vez por arquivo, e a substituicao usa
// content.replace(old, () => new) — nunca a forma com string direta —
// porque os trechos contem "$" (template SQL) em varios pontos.
//
// Este fix e independente dos outros scripts ja aplicados (fix-idor-*,
// fix-google-oauth-*, fix-slot-interval-*) — mexe numa parte totalmente
// separada dos arquivos, entao pode ser aplicado em qualquer ordem, com ou
// sem os outros ja aplicados.

const fs = require('fs');
const path = require('path');

const ROUTERS_PATH = path.join(__dirname, 'server', 'routers.ts');
const ADMIN_ROUTES_PATH = path.join(__dirname, 'server', 'admin-routes.ts');

const routersReplacements = [
  [
    "routers:upgradeBarberproSubscription-ensureAsaasCustomer",
    Buffer.from("ICAgICAgICAvLyBCdXNjYXIgZGFkb3MgZG8gdGVuYW50CiAgICAgICAgY29uc3QgdGVuYW50Um93cyA9IGF3YWl0IGRiQ29ubi5leGVjdXRlKHNxbGAKICAgICAgICAgIFNFTEVDVCAiYmFyYmVycHJvU3Vic2NyaXB0aW9uSWQiLCAiYmFyYmVycHJvQXNhYXNDdXN0b21lcklkIiwKICAgICAgICAgICAgICAgICAiYXNhYXNNb2JpbGVQaG9uZSIsIHBob25lLCBuYW1lLCBjbnBqCiAgICAgICAgICBGUk9NIHRlbmFudHMgV0hFUkUgaWQgPSAke2lucHV0LnRlbmFudElkfSBMSU1JVCAxCiAgICAgICAgYCk7CiAgICAgICAgY29uc3QgdGVuYW50RGF0YSA9ICgodGVuYW50Um93cyBhcyBhbnkpLnJvd3MgYXMgYW55W10pWzBdOwogICAgICAgIGlmICghdGVuYW50RGF0YSkgdGhyb3cgbmV3IEVycm9yKCdUZW5hbnQgbsOjbyBlbmNvbnRyYWRvLicpOwoKICAgICAgICAvLyAxLiBDYW5jZWxhciBhc3NpbmF0dXJhIGF0dWFsCiAgICAgICAgaWYgKHRlbmFudERhdGEuYmFyYmVycHJvU3Vic2NyaXB0aW9uSWQpIHsKICAgICAgICAgIHRyeSB7IGF3YWl0IGNhbmNlbEFzYWFzU3Vic2NyaXB0aW9uKHRlbmFudERhdGEuYmFyYmVycHJvU3Vic2NyaXB0aW9uSWQpOyB9IGNhdGNoIHt9CiAgICAgICAgfQoKICAgICAgICAvLyAyLiBHYXJhbnRpciBjdXN0b21lciBBc2FhcwogICAgICAgIGNvbnN0IGFzYWFzQ3VzdG9tZXJJZCA9IGF3YWl0IGVuc3VyZUFzYWFzQ3VzdG9tZXIoewogICAgICAgICAgbmFtZTogdGVuYW50RGF0YS5uYW1lID8/ICdDbGllbnRlJywKICAgICAgICAgIGNwZkNucGo6IHRlbmFudERhdGEuY25waiA/PyAnJywKICAgICAgICAgIG1vYmlsZVBob25lOiAodGVuYW50RGF0YS5hc2Fhc01vYmlsZVBob25lID8/IHRlbmFudERhdGEucGhvbmUgPz8gJycpLnJlcGxhY2UoL1xEL2csICcnKSwKICAgICAgICAgIHRlbmFudElkOiBpbnB1dC50ZW5hbnRJZCwKICAgICAgICB9KTs=", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgICAvLyBCdXNjYXIgZGFkb3MgZG8gdGVuYW50ICgrIGUtbWFpbCBkbyBkb25vLCB1c2FkbyBzw7Mgc2UgcHJlY2lzYXJtb3MKICAgICAgICAvLyBjcmlhciB1bSBjdXN0b21lciBub3ZvIG5vIEFzYWFzIOKAlCB2ZXIgY29tZW50w6FyaW8gYWJhaXhvKQogICAgICAgIGNvbnN0IHRlbmFudFJvd3MgPSBhd2FpdCBkYkNvbm4uZXhlY3V0ZShzcWxgCiAgICAgICAgICBTRUxFQ1QgdC4iYmFyYmVycHJvU3Vic2NyaXB0aW9uSWQiLCB0LiJiYXJiZXJwcm9Bc2Fhc0N1c3RvbWVySWQiLAogICAgICAgICAgICAgICAgIHQuImFzYWFzTW9iaWxlUGhvbmUiLCB0LnBob25lLCB0Lm5hbWUsIHQuY25waiwKICAgICAgICAgICAgICAgICAoU0VMRUNUIGVtYWlsIEZST00gYmFyYmVycyBXSEVSRSAidGVuYW50SWQiID0gdC5pZCBBTkQgcm9sZSA9ICdzdXBlcl9hZG1pbicgQU5EICJpc0FjdGl2ZSIgPSB0cnVlIExJTUlUIDEpIEFTICJvd25lckVtYWlsIgogICAgICAgICAgRlJPTSB0ZW5hbnRzIHQgV0hFUkUgdC5pZCA9ICR7aW5wdXQudGVuYW50SWR9IExJTUlUIDEKICAgICAgICBgKTsKICAgICAgICBjb25zdCB0ZW5hbnREYXRhID0gKCh0ZW5hbnRSb3dzIGFzIGFueSkucm93cyBhcyBhbnlbXSlbMF07CiAgICAgICAgaWYgKCF0ZW5hbnREYXRhKSB0aHJvdyBuZXcgRXJyb3IoJ1RlbmFudCBuw6NvIGVuY29udHJhZG8uJyk7CgogICAgICAgIC8vIDEuIENhbmNlbGFyIGFzc2luYXR1cmEgYXR1YWwKICAgICAgICBpZiAodGVuYW50RGF0YS5iYXJiZXJwcm9TdWJzY3JpcHRpb25JZCkgewogICAgICAgICAgdHJ5IHsgYXdhaXQgY2FuY2VsQXNhYXNTdWJzY3JpcHRpb24odGVuYW50RGF0YS5iYXJiZXJwcm9TdWJzY3JpcHRpb25JZCk7IH0gY2F0Y2gge30KICAgICAgICB9CgogICAgICAgIC8vIDIuIEdhcmFudGlyIGN1c3RvbWVyIEFzYWFzIOKAlCByZWFwcm92ZWl0YSBvIGN1c3RvbWVyIGrDoSBleGlzdGVudGUKICAgICAgICAvLyAoc2Fsdm8gZGVzZGUgYSBhc3NpbmF0dXJhIG9yaWdpbmFsKSBzZW1wcmUgcXVlIHBvc3PDrXZlbC4gU8OzIGNyaWEgdW0KICAgICAgICAvLyBub3ZvIHZpYSBlbnN1cmVBc2Fhc1Jvb3RDdXN0b21lciBzZSBwb3IgYWxndW0gbW90aXZvIG8gdGVuYW50IGFpbmRhCiAgICAgICAgLy8gbsOjbyB0aXZlciB1bSAoZXg6IG51bmNhIGNoZWdvdSBhIHRlciBhc3NpbmF0dXJhIHBhZ2EgYW50ZXMpLgogICAgICAgIC8vIEJ1ZyBhbnRlcmlvcjogY2hhbWF2YSAiZW5zdXJlQXNhYXNDdXN0b21lciIsIGZ1bsOnw6NvIHF1ZSBuw6NvIGV4aXN0ZQogICAgICAgIC8vIChvIG5vbWUgY2VydG8gw6kgImVuc3VyZUFzYWFzUm9vdEN1c3RvbWVyIikg4oCUIHF1ZWJyYXZhIDEwMCUgZG9zCiAgICAgICAgLy8gdXBncmFkZXMgZGUgcGxhbm8gY29tIFJlZmVyZW5jZUVycm9yLgogICAgICAgIGNvbnN0IGFzYWFzQ3VzdG9tZXJJZCA9IHRlbmFudERhdGEuYmFyYmVycHJvQXNhYXNDdXN0b21lcklkCiAgICAgICAgICA/PyBhd2FpdCBlbnN1cmVBc2Fhc1Jvb3RDdXN0b21lcih7CiAgICAgICAgICAgIG5hbWU6IHRlbmFudERhdGEubmFtZSA/PyAnQ2xpZW50ZScsCiAgICAgICAgICAgIGVtYWlsOiB0ZW5hbnREYXRhLm93bmVyRW1haWwgPz8gJycsCiAgICAgICAgICAgIGNwZkNucGo6IHRlbmFudERhdGEuY25waiA/PyAnJywKICAgICAgICAgICAgbW9iaWxlUGhvbmU6ICh0ZW5hbnREYXRhLmFzYWFzTW9iaWxlUGhvbmUgPz8gdGVuYW50RGF0YS5waG9uZSA/PyAnJykucmVwbGFjZSgvXEQvZywgJycpLAogICAgICAgICAgICB0ZW5hbnRJZDogaW5wdXQudGVuYW50SWQsCiAgICAgICAgICB9KTs=", 'base64').toString('utf8'),
  ],
];

const adminReplacements = [
  [
    "admin-routes:upgrade-plan-ensureAsaasCustomer",
    Buffer.from("ICAgICAgLy8gQnVzY2FyIGRhZG9zIGRvIHRlbmFudA0KICAgICAgY29uc3QgdGVuYW50Um93cyA9IGF3YWl0IGRiQ29ubi5leGVjdXRlKHNxbGANCiAgICAgICAgU0VMRUNUICJiYXJiZXJwcm9TdWJzY3JpcHRpb25JZCIsICJiYXJiZXJwcm9Bc2Fhc0N1c3RvbWVySWQiLCAiYXNhYXNBY2NvdW50SWQiLA0KICAgICAgICAgICAgICAgImFzYWFzTW9iaWxlUGhvbmUiLCBwaG9uZSwgbmFtZSwgY25wag0KICAgICAgICBGUk9NIHRlbmFudHMgV0hFUkUgaWQgPSAke2JhcmJlci50ZW5hbnRJZH0gTElNSVQgMQ0KICAgICAgYCk7DQogICAgICBjb25zdCB0ZW5hbnREYXRhID0gKCh0ZW5hbnRSb3dzIGFzIGFueSkucm93cyBhcyBhbnlbXSlbMF07DQogICAgICBpZiAoIXRlbmFudERhdGEpIHsgcmVzLnJlZGlyZWN0KCIvYWRtaW4vY29uZmlndXJhY29lcz90YWI9cGFnYW1lbnRvcyIpOyByZXR1cm47IH0NCg0KICAgICAgLy8gMS4gQ2FuY2VsYXIgYXNzaW5hdHVyYSBhdHVhbCBubyBBc2FhcyAoc2UgZXhpc3RpcikNCiAgICAgIGlmICh0ZW5hbnREYXRhLmJhcmJlcnByb1N1YnNjcmlwdGlvbklkKSB7DQogICAgICAgIHRyeSB7DQogICAgICAgICAgYXdhaXQgY2FuY2VsQXNhYXNTdWJzY3JpcHRpb24odGVuYW50RGF0YS5iYXJiZXJwcm9TdWJzY3JpcHRpb25JZCk7DQogICAgICAgIH0gY2F0Y2ggKGNhbmNlbEVycjogYW55KSB7DQogICAgICAgICAgY29uc29sZS53YXJuKCdbYXNhYXMvdXBncmFkZS1wbGFuXSBFcnJvIGFvIGNhbmNlbGFyIGFzc2luYXR1cmEgYW50aWdhOicsIGNhbmNlbEVyci5tZXNzYWdlKTsNCiAgICAgICAgfQ0KICAgICAgfQ0KDQogICAgICAvLyAyLiBHYXJhbnRpciBxdWUgbyBjdXN0b21lciBBc2FhcyBleGlzdGUNCiAgICAgIGNvbnN0IGFzYWFzQ3VzdG9tZXJJZCA9IGF3YWl0IGVuc3VyZUFzYWFzQ3VzdG9tZXIoew0KICAgICAgICBuYW1lOiAoYXdhaXQgZGIuZ2V0QmFyYmVyQnlJZChzZXNzaW9uLmJhcmJlcklkKSBhcyBhbnkpPy5uYW1lID8/IHRlbmFudERhdGEubmFtZSwNCiAgICAgICAgY3BmQ25wajogdGVuYW50RGF0YS5jbnBqID8/ICcnLA0KICAgICAgICBtb2JpbGVQaG9uZTogKHRlbmFudERhdGEuYXNhYXNNb2JpbGVQaG9uZSA/PyB0ZW5hbnREYXRhLnBob25lID8/ICcnKS5yZXBsYWNlKC9cRC9nLCAnJyksDQogICAgICAgIHRlbmFudElkOiBiYXJiZXIudGVuYW50SWQsDQogICAgICB9KTsNCg==", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgLy8gQnVzY2FyIGRhZG9zIGRvIHRlbmFudA0KICAgICAgY29uc3QgdGVuYW50Um93cyA9IGF3YWl0IGRiQ29ubi5leGVjdXRlKHNxbGANCiAgICAgICAgU0VMRUNUICJiYXJiZXJwcm9TdWJzY3JpcHRpb25JZCIsICJiYXJiZXJwcm9Bc2Fhc0N1c3RvbWVySWQiLCAiYXNhYXNBY2NvdW50SWQiLA0KICAgICAgICAgICAgICAgImFzYWFzTW9iaWxlUGhvbmUiLCBwaG9uZSwgbmFtZSwgY25wag0KICAgICAgICBGUk9NIHRlbmFudHMgV0hFUkUgaWQgPSAke2JhcmJlci50ZW5hbnRJZH0gTElNSVQgMQ0KICAgICAgYCk7DQogICAgICBjb25zdCB0ZW5hbnREYXRhID0gKCh0ZW5hbnRSb3dzIGFzIGFueSkucm93cyBhcyBhbnlbXSlbMF07DQogICAgICBpZiAoIXRlbmFudERhdGEpIHsgcmVzLnJlZGlyZWN0KCIvYWRtaW4vY29uZmlndXJhY29lcz90YWI9cGFnYW1lbnRvcyIpOyByZXR1cm47IH0NCg0KICAgICAgLy8gMS4gQ2FuY2VsYXIgYXNzaW5hdHVyYSBhdHVhbCBubyBBc2FhcyAoc2UgZXhpc3RpcikNCiAgICAgIGlmICh0ZW5hbnREYXRhLmJhcmJlcnByb1N1YnNjcmlwdGlvbklkKSB7DQogICAgICAgIHRyeSB7DQogICAgICAgICAgYXdhaXQgY2FuY2VsQXNhYXNTdWJzY3JpcHRpb24odGVuYW50RGF0YS5iYXJiZXJwcm9TdWJzY3JpcHRpb25JZCk7DQogICAgICAgIH0gY2F0Y2ggKGNhbmNlbEVycjogYW55KSB7DQogICAgICAgICAgY29uc29sZS53YXJuKCdbYXNhYXMvdXBncmFkZS1wbGFuXSBFcnJvIGFvIGNhbmNlbGFyIGFzc2luYXR1cmEgYW50aWdhOicsIGNhbmNlbEVyci5tZXNzYWdlKTsNCiAgICAgICAgfQ0KICAgICAgfQ0KDQogICAgICAvLyAyLiBHYXJhbnRpciBxdWUgbyBjdXN0b21lciBBc2FhcyBleGlzdGUg4oCUIHJlYXByb3ZlaXRhIG8gY3VzdG9tZXIgamENCiAgICAgIC8vIGV4aXN0ZW50ZSBzZW1wcmUgcXVlIHBvc3NpdmVsLiBTbyBjcmlhIHVtIG5vdm8gdmlhDQogICAgICAvLyBlbnN1cmVBc2Fhc1Jvb3RDdXN0b21lciBzZSBvIHRlbmFudCBhaW5kYSBuYW8gdGl2ZXIgdW0uIEJ1ZyBhbnRlcmlvcjoNCiAgICAgIC8vIGNoYW1hdmEgImVuc3VyZUFzYWFzQ3VzdG9tZXIiLCBmdW5jYW8gcXVlIG5hbyBleGlzdGUgKG8gbm9tZSBjZXJ0byBlDQogICAgICAvLyAiZW5zdXJlQXNhYXNSb290Q3VzdG9tZXIiKSDigJQgcXVlYnJhdmEgMTAwJSBkb3MgdXBncmFkZXMgZGUgcGxhbm8gcGVsbw0KICAgICAgLy8gcGFpbmVsIHdlYiBjb20gUmVmZXJlbmNlRXJyb3IuDQogICAgICBjb25zdCBsb2dnZWRCYXJiZXIgPSBhd2FpdCBkYi5nZXRCYXJiZXJCeUlkKHNlc3Npb24uYmFyYmVySWQpIGFzIGFueTsNCiAgICAgIGNvbnN0IGFzYWFzQ3VzdG9tZXJJZCA9IHRlbmFudERhdGEuYmFyYmVycHJvQXNhYXNDdXN0b21lcklkDQogICAgICAgID8/IGF3YWl0IGVuc3VyZUFzYWFzUm9vdEN1c3RvbWVyKHsNCiAgICAgICAgICBuYW1lOiBsb2dnZWRCYXJiZXI/Lm5hbWUgPz8gdGVuYW50RGF0YS5uYW1lLA0KICAgICAgICAgIGVtYWlsOiBsb2dnZWRCYXJiZXI/LmVtYWlsID8/ICcnLA0KICAgICAgICAgIGNwZkNucGo6IHRlbmFudERhdGEuY25waiA/PyAnJywNCiAgICAgICAgICBtb2JpbGVQaG9uZTogKHRlbmFudERhdGEuYXNhYXNNb2JpbGVQaG9uZSA/PyB0ZW5hbnREYXRhLnBob25lID8/ICcnKS5yZXBsYWNlKC9cRC9nLCAnJyksDQogICAgICAgICAgdGVuYW50SWQ6IGJhcmJlci50ZW5hbnRJZCwNCiAgICAgICAgfSk7DQo=", 'base64').toString('utf8'),
  ],
];

function applyReplacements(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  // 'utf8' preserva os bytes de quebra de linha como estao no arquivo
  // (nao normaliza \r\n).
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
  applyReplacements(ROUTERS_PATH, routersReplacements);
  applyReplacements(ADMIN_ROUTES_PATH, adminReplacements);
  console.log('');
  console.log('Tudo aplicado com sucesso. Próximos passos:');
  console.log('  1. git diff --stat   (deve mostrar server/routers.ts e server/admin-routes.ts)');
  console.log('  2. git diff server/routers.ts server/admin-routes.ts   (conferir visualmente)');
  console.log('  3. npx esbuild server/routers.ts --outfile=nul --format=esm --platform=node');
  console.log('     npx esbuild server/admin-routes.ts --outfile=nul --format=esm --platform=node');
  console.log('  4. Testar manualmente: tentar trocar de plano (Solo/Equipe/Estudio) pelo painel web e pelo app');
  console.log('  5. git add server/routers.ts server/admin-routes.ts && git commit && git push');
} catch (err) {
  console.error('❌ Falha ao aplicar as alterações:');
  console.error(err.message);
  process.exit(1);
}
