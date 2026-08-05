// fix-rbac-team-management.cjs
// Implementa a regra que você definiu: "O Administrador possui todas as
// permissões. Ele designa aquilo que ele deseja que os outros usuários
// tenham." Escopo deste fix: gestão de OUTROS barbeiros (criar, editar,
// remover, reativar) — hoje qualquer barbeiro autenticado (mesmo um
// recepcionista) podia:
//   - Criar uma conta nova já com role "super_admin" (escalada de privilégio)
//   - Editar cargo/permissões de QUALQUER barbeiro, incluindo promover a si
//     mesmo a super_admin
//   - Remover ou reativar qualquer barbeiro da equipe
//
// Regras aplicadas agora:
//   - barbers.create, barbers.delete, barbers.reactivate: exclusivos de
//     super_admin (mesmo padrão já usado em branches.create/delete)
//   - barbers.update: super_admin edita qualquer barbeiro (inclusive cargo/
//     permissões). Qualquer outro barbeiro só pode editar o PRÓPRIO perfil
//     (nome, foto, telefone, senha) — nunca o próprio cargo ou permissões.
//     Confirmado que app/admin/(tabs)/my-profile.tsx (auto-edição) nunca
//     envia "role" nem "permissions", então continua funcionando normal.
//
// NÃO incluído neste fix (fora de escopo, requer decisão de produto + UI):
// as permissões granulares por módulo (agenda, financeiro, produtos,
// marketing etc.) hoje só existem como decoração visual no painel web
// (cadeados no menu) e nem aparecem no app mobile — não têm nenhuma
// aplicação real no backend. Formalizar isso exigiria desenhar como o app
// mostraria/gerenciaria essas permissões antes de bloquear de verdade no
// backend, senão vira botão que aparece mas dá erro sem explicação.
//
// PRÉ-REQUISITO: este script espera que fix-idor-tenant-ownership.cjs já
// tenha sido aplicado antes (usa assertTenantOwnership). Diferente dos
// scripts anteriores, este NÃO é independente de ordem.
//
// Uso:
//   node fix-rbac-team-management.cjs
//
// Mesmo padrão de segurança dos scripts anteriores: cada trecho antigo
// precisa aparecer EXATAMENTE 1 vez, e a substituição usa
// content.replace(old, () => new).

const fs = require('fs');
const path = require('path');

const ROUTERS_PATH = path.join(__dirname, 'server', 'routers.ts');

const replacements = [
  [
    "barbers.create - role check",
    Buffer.from("ICAgIGNyZWF0ZTogYWN0aXZlQmFyYmVyUHJvY2VkdXJlCiAgICAgIC5pbnB1dCh6Lm9iamVjdCh7IG5hbWU6IHouc3RyaW5nKCkubWluKDIpLCBlbWFpbDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksIHBob25lOiB6LnN0cmluZygpLm9wdGlvbmFsKCksIHBhc3N3b3JkOiB6LnN0cmluZygpLm1pbig2KSwgcm9sZTogei5lbnVtKFsic3VwZXJfYWRtaW4iLCAiYmFyYmVyIiwgInJlY2VwdGlvbmlzdCJdKS5kZWZhdWx0KCJiYXJiZXIiKSwgc3BlY2lhbHRpZXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSwgdGVuYW50SWQ6IHoubnVtYmVyKCkub3B0aW9uYWwoKS5udWxsYWJsZSgpLCBwZXJtaXNzaW9uczogei5hcnJheSh6LnN0cmluZygpKS5vcHRpb25hbCgpLm51bGxhYmxlKCkgfSkpCiAgICAgIC5tdXRhdGlvbihhc3luYyAoeyBpbnB1dCB9KSA9PiB7CiAgICAgICAgLy8gVmFsaWRhw6fDo28gZGUgbGltaXRlIGRlIGJhcmJlaXJvcyBwb3IgcGxhbm8=", 'base64').toString('utf8'),
    Buffer.from("ICAgIGNyZWF0ZTogYWN0aXZlQmFyYmVyUHJvY2VkdXJlCiAgICAgIC5pbnB1dCh6Lm9iamVjdCh7IG5hbWU6IHouc3RyaW5nKCkubWluKDIpLCBlbWFpbDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksIHBob25lOiB6LnN0cmluZygpLm9wdGlvbmFsKCksIHBhc3N3b3JkOiB6LnN0cmluZygpLm1pbig2KSwgcm9sZTogei5lbnVtKFsic3VwZXJfYWRtaW4iLCAiYmFyYmVyIiwgInJlY2VwdGlvbmlzdCJdKS5kZWZhdWx0KCJiYXJiZXIiKSwgc3BlY2lhbHRpZXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSwgdGVuYW50SWQ6IHoubnVtYmVyKCkub3B0aW9uYWwoKS5udWxsYWJsZSgpLCBwZXJtaXNzaW9uczogei5hcnJheSh6LnN0cmluZygpKS5vcHRpb25hbCgpLm51bGxhYmxlKCkgfSkpCiAgICAgIC5tdXRhdGlvbihhc3luYyAoeyBpbnB1dCwgY3R4IH0pID0+IHsKICAgICAgICAvLyBTw7MgbyBkb25vIChzdXBlcl9hZG1pbikgcG9kZSBjcmlhciBub3ZvcyBiYXJiZWlyb3MvY29udGFzIOKAlCBzZW0gZXNzYQogICAgICAgIC8vIGNoZWNhZ2VtLCBxdWFscXVlciB1c3XDoXJpbyBhdXRlbnRpY2FkbyAoYXTDqSB1bSByZWNlcGNpb25pc3RhKSBwb2RpYQogICAgICAgIC8vIGNyaWFyIHVtYSBjb250YSBub3ZhIGrDoSBjb20gcm9sZSAic3VwZXJfYWRtaW4iIHByYSBzaSBtZXNtby4KICAgICAgICBpZiAoY3R4LmJhcmJlci5yb2xlICE9PSAic3VwZXJfYWRtaW4iKSB7CiAgICAgICAgICB0aHJvdyBuZXcgVFJQQ0Vycm9yKHsgY29kZTogIkZPUkJJRERFTiIsIG1lc3NhZ2U6ICJBcGVuYXMgbyBhZG1pbmlzdHJhZG9yIHBvZGUgYWRpY2lvbmFyIG5vdm9zIG1lbWJyb3Mgw6AgZXF1aXBlLiIgfSk7CiAgICAgICAgfQogICAgICAgIC8vIFZhbGlkYcOnw6NvIGRlIGxpbWl0ZSBkZSBiYXJiZWlyb3MgcG9yIHBsYW5v", 'base64').toString('utf8'),
  ],
  [
    "barbers.update + delete - role/self checks",
    Buffer.from("ICAgICAgLm11dGF0aW9uKGFzeW5jICh7IGlucHV0LCBjdHggfSkgPT4gewogICAgICAgIGNvbnN0IHsgaWQsIHBhc3N3b3JkLCBwZXJtaXNzaW9ucywgLi4uZGF0YSB9ID0gaW5wdXQ7CiAgICAgICAgYXdhaXQgYXNzZXJ0VGVuYW50T3duZXJzaGlwKGN0eCwgeyBraW5kOiAiZGlyZWN0IiwgdGFibGU6ICJiYXJiZXJzIiB9LCBpZCk7CiAgICAgICAgY29uc3QgdXBkYXRlRGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7IC4uLmRhdGEgfTsKICAgICAgICBpZiAocGFzc3dvcmQpIHVwZGF0ZURhdGEucGFzc3dvcmRIYXNoID0gYXdhaXQgaGFzaFBhc3N3b3JkKHBhc3N3b3JkKTsKICAgICAgICBpZiAocGVybWlzc2lvbnMgIT09IHVuZGVmaW5lZCkgdXBkYXRlRGF0YS5wZXJtaXNzaW9ucyA9IHBlcm1pc3Npb25zID8gSlNPTi5zdHJpbmdpZnkocGVybWlzc2lvbnMpIDogbnVsbDsKICAgICAgICBhd2FpdCBkYi51cGRhdGVCYXJiZXIoaWQsIHVwZGF0ZURhdGEgYXMgYW55KTsKICAgICAgICAvLyBTZSBwZXJtaXNzaW9ucyBmb2kgcGFzc2FkbywgdXNhciByYXdRdWVyeSBwYXJhIGdhcmFudGlyCiAgICAgICAgaWYgKHBlcm1pc3Npb25zICE9PSB1bmRlZmluZWQpIHsKICAgICAgICAgIGF3YWl0IGRiLnJhd1F1ZXJ5KCdVUERBVEUgYmFyYmVycyBTRVQgcGVybWlzc2lvbnMgPSAkMSBXSEVSRSBpZCA9ICQyJywgW3Blcm1pc3Npb25zID8gSlNPTi5zdHJpbmdpZnkocGVybWlzc2lvbnMpIDogbnVsbCwgaWRdKTsKICAgICAgICB9CiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9OwogICAgICB9KSwKICAgIGRlbGV0ZTogYWN0aXZlQmFyYmVyUHJvY2VkdXJlLmlucHV0KHoub2JqZWN0KHsgaWQ6IHoubnVtYmVyKCkgfSkpLm11dGF0aW9uKGFzeW5jICh7IGlucHV0LCBjdHggfSkgPT4gewogICAgICBhd2FpdCBhc3NlcnRUZW5hbnRPd25lcnNoaXAoY3R4LCB7IGtpbmQ6ICJkaXJlY3QiLCB0YWJsZTogImJhcmJlcnMiIH0sIGlucHV0LmlkKTsKICAgICAgcmV0dXJuIGRiLmRlbGV0ZUJhcmJlcihpbnB1dC5pZCk7CiAgICB9KSw=", 'base64').toString('utf8'),
    Buffer.from("ICAgICAgLm11dGF0aW9uKGFzeW5jICh7IGlucHV0LCBjdHggfSkgPT4gewogICAgICAgIGNvbnN0IHsgaWQsIHBhc3N3b3JkLCBwZXJtaXNzaW9ucywgcm9sZSwgLi4uZGF0YSB9ID0gaW5wdXQ7CiAgICAgICAgYXdhaXQgYXNzZXJ0VGVuYW50T3duZXJzaGlwKGN0eCwgeyBraW5kOiAiZGlyZWN0IiwgdGFibGU6ICJiYXJiZXJzIiB9LCBpZCk7CiAgICAgICAgLy8gUmVncmE6IGRvbm8gKHN1cGVyX2FkbWluKSBwb2RlIGVkaXRhciBxdWFscXVlciBiYXJiZWlybyBkYSBwcsOzcHJpYQogICAgICAgIC8vIGJhcmJlYXJpYSwgaW5jbHVpbmRvIGNhcmdvIGUgcGVybWlzc8O1ZXMuIFF1YWxxdWVyIG91dHJvIGJhcmJlaXJvCiAgICAgICAgLy8gc8OzIHBvZGUgZWRpdGFyIG8gUFLDk1BSSU8gcGVyZmlsIChub21lLCBmb3RvLCB0ZWxlZm9uZSwgc2VuaGEpIOKAlCBlCiAgICAgICAgLy8gbnVuY2EgbyBwcsOzcHJpbyBjYXJnby9wZXJtaXNzw7Vlcywgc2Vuw6NvIHNlcmlhIGF1dG8tcHJvbW/Dp8Ojby4KICAgICAgICBjb25zdCBpc093bmVyID0gY3R4LmJhcmJlci5yb2xlID09PSAic3VwZXJfYWRtaW4iOwogICAgICAgIGNvbnN0IGlzU2VsZiA9IGN0eC5iYXJiZXIuYmFyYmVySWQgPT09IGlkOwogICAgICAgIGlmICghaXNPd25lcikgewogICAgICAgICAgaWYgKCFpc1NlbGYpIHsKICAgICAgICAgICAgdGhyb3cgbmV3IFRSUENFcnJvcih7IGNvZGU6ICJGT1JCSURERU4iLCBtZXNzYWdlOiAiVm9jw6ogc8OzIHBvZGUgZWRpdGFyIHNldSBwcsOzcHJpbyBwZXJmaWwuIiB9KTsKICAgICAgICAgIH0KICAgICAgICAgIGlmIChyb2xlICE9PSB1bmRlZmluZWQgfHwgcGVybWlzc2lvbnMgIT09IHVuZGVmaW5lZCkgewogICAgICAgICAgICB0aHJvdyBuZXcgVFJQQ0Vycm9yKHsgY29kZTogIkZPUkJJRERFTiIsIG1lc3NhZ2U6ICJWb2PDqiBuw6NvIHRlbSBwZXJtaXNzw6NvIHBhcmEgYWx0ZXJhciBjYXJnbyBvdSBwZXJtaXNzw7Vlcy4iIH0pOwogICAgICAgICAgfQogICAgICAgIH0KICAgICAgICBjb25zdCB1cGRhdGVEYXRhOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHsgLi4uZGF0YSB9OwogICAgICAgIGlmIChyb2xlICE9PSB1bmRlZmluZWQpIHVwZGF0ZURhdGEucm9sZSA9IHJvbGU7CiAgICAgICAgaWYgKHBhc3N3b3JkKSB1cGRhdGVEYXRhLnBhc3N3b3JkSGFzaCA9IGF3YWl0IGhhc2hQYXNzd29yZChwYXNzd29yZCk7CiAgICAgICAgaWYgKHBlcm1pc3Npb25zICE9PSB1bmRlZmluZWQpIHVwZGF0ZURhdGEucGVybWlzc2lvbnMgPSBwZXJtaXNzaW9ucyA/IEpTT04uc3RyaW5naWZ5KHBlcm1pc3Npb25zKSA6IG51bGw7CiAgICAgICAgYXdhaXQgZGIudXBkYXRlQmFyYmVyKGlkLCB1cGRhdGVEYXRhIGFzIGFueSk7CiAgICAgICAgLy8gU2UgcGVybWlzc2lvbnMgZm9pIHBhc3NhZG8sIHVzYXIgcmF3UXVlcnkgcGFyYSBnYXJhbnRpcgogICAgICAgIGlmIChwZXJtaXNzaW9ucyAhPT0gdW5kZWZpbmVkKSB7CiAgICAgICAgICBhd2FpdCBkYi5yYXdRdWVyeSgnVVBEQVRFIGJhcmJlcnMgU0VUIHBlcm1pc3Npb25zID0gJDEgV0hFUkUgaWQgPSAkMicsIFtwZXJtaXNzaW9ucyA/IEpTT04uc3RyaW5naWZ5KHBlcm1pc3Npb25zKSA6IG51bGwsIGlkXSk7CiAgICAgICAgfQogICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsKICAgICAgfSksCiAgICBkZWxldGU6IGFjdGl2ZUJhcmJlclByb2NlZHVyZS5pbnB1dCh6Lm9iamVjdCh7IGlkOiB6Lm51bWJlcigpIH0pKS5tdXRhdGlvbihhc3luYyAoeyBpbnB1dCwgY3R4IH0pID0+IHsKICAgICAgaWYgKGN0eC5iYXJiZXIucm9sZSAhPT0gInN1cGVyX2FkbWluIikgewogICAgICAgIHRocm93IG5ldyBUUlBDRXJyb3IoeyBjb2RlOiAiRk9SQklEREVOIiwgbWVzc2FnZTogIkFwZW5hcyBvIGFkbWluaXN0cmFkb3IgcG9kZSByZW1vdmVyIG1lbWJyb3MgZGEgZXF1aXBlLiIgfSk7CiAgICAgIH0KICAgICAgYXdhaXQgYXNzZXJ0VGVuYW50T3duZXJzaGlwKGN0eCwgeyBraW5kOiAiZGlyZWN0IiwgdGFibGU6ICJiYXJiZXJzIiB9LCBpbnB1dC5pZCk7CiAgICAgIHJldHVybiBkYi5kZWxldGVCYXJiZXIoaW5wdXQuaWQpOwogICAgfSks", 'base64').toString('utf8'),
  ],
  [
    "barbers.reactivate - role check",
    Buffer.from("ICAgIHJlYWN0aXZhdGU6IGFjdGl2ZUJhcmJlclByb2NlZHVyZS5pbnB1dCh6Lm9iamVjdCh7IGlkOiB6Lm51bWJlcigpIH0pKS5tdXRhdGlvbihhc3luYyAoeyBpbnB1dCwgY3R4IH0pID0+IHsKICAgICAgYXdhaXQgYXNzZXJ0VGVuYW50T3duZXJzaGlwKGN0eCwgeyBraW5kOiAiZGlyZWN0IiwgdGFibGU6ICJiYXJiZXJzIiB9LCBpbnB1dC5pZCk7CiAgICAgIHJldHVybiBkYi5yZWFjdGl2YXRlQmFyYmVyKGlucHV0LmlkKTsKICAgIH0pLA==", 'base64').toString('utf8'),
    Buffer.from("ICAgIHJlYWN0aXZhdGU6IGFjdGl2ZUJhcmJlclByb2NlZHVyZS5pbnB1dCh6Lm9iamVjdCh7IGlkOiB6Lm51bWJlcigpIH0pKS5tdXRhdGlvbihhc3luYyAoeyBpbnB1dCwgY3R4IH0pID0+IHsKICAgICAgaWYgKGN0eC5iYXJiZXIucm9sZSAhPT0gInN1cGVyX2FkbWluIikgewogICAgICAgIHRocm93IG5ldyBUUlBDRXJyb3IoeyBjb2RlOiAiRk9SQklEREVOIiwgbWVzc2FnZTogIkFwZW5hcyBvIGFkbWluaXN0cmFkb3IgcG9kZSByZWF0aXZhciBtZW1icm9zIGRhIGVxdWlwZS4iIH0pOwogICAgICB9CiAgICAgIGF3YWl0IGFzc2VydFRlbmFudE93bmVyc2hpcChjdHgsIHsga2luZDogImRpcmVjdCIsIHRhYmxlOiAiYmFyYmVycyIgfSwgaW5wdXQuaWQpOwogICAgICByZXR1cm4gZGIucmVhY3RpdmF0ZUJhcmJlcihpbnB1dC5pZCk7CiAgICB9KSw=", 'base64').toString('utf8'),
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
        `Abortando sem gravar nada. Verifique se fix-idor-tenant-ownership.cjs já foi aplicado antes deste script.`
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
  console.log('  4. Testar manualmente: editar o próprio perfil (barbeiro comum), tentar criar/editar/remover outro barbeiro sem ser admin (deve bloquear), e como admin (deve funcionar)');
  console.log('  5. git add server/routers.ts && git commit && git push');
} catch (err) {
  console.error('❌ Falha ao aplicar as alterações:');
  console.error(err.message);
  process.exit(1);
}
