// fix-restore-pnpm-overrides.cjs
// Restaura o pnpm.overrides no package.json — ele existia (commit dbe7b3e,
// 18/06/2026, "fix(crash): pnpm.overrides para fixar @react-native/babel-
// preset@0.81.5") mas foi removido no commit seguinte (daae060) por engano:
// a intenção era "migrar" pra um arquivo separado, mas o arquivo criado se
// chama "pnpm.yaml" — nome que o pnpm NÃO reconhece (o nome certo seria
// "pnpm-workspace.yaml"). Resultado: esse override ficou sem efeito nenhum,
// silenciosamente, desde 18/06 — o pnpm nunca mais aplicou ele.
//
// Isso é uma causa provável (não 100% confirmada) do crash de bundling
// visto no build de 06/08/2026 ("Cannot read properties of null (reading
// 'loc')" dentro do @react-native/babel-plugin-codegen) — o projeto tem
// hoje 3 versões diferentes de "metro" coexistindo no node_modules
// (0.83.3, 0.83.7, 0.87.0), e restaurar esse override é o passo seguro e
// já comprovado (funcionou antes) antes de considerar algo mais invasivo
// como forçar uma única versão de "metro" via override (não incluído
// neste fix — mais arriscado, precisa de sessão dedicada com testes).
//
// Apaga também o arquivo "pnpm.yaml" (nome errado, nunca foi lido pelo
// pnpm, só ficava lá como confusão pra quem olhasse o projeto achando que
// estava em uso).
//
// Uso:
//   node fix-restore-pnpm-overrides.cjs
//
// Depois de rodar, é ESSENCIAL fazer uma reinstalação limpa pra esse
// override realmente pegar:
//   rmdir /s /q node_modules
//   npx pnpm install
//
// Mesmo padrão de segurança dos scripts anteriores: o trecho antigo
// precisa aparecer EXATAMENTE 1 vez, e a substituição usa
// content.replace(old, () => new).

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON_PATH = path.join(__dirname, 'package.json');
const WRONG_FILE_PATH = path.join(__dirname, 'pnpm.yaml');

const oldStr = Buffer.from("ICAidHlwZSI6ICJtb2R1bGUiLAogICJleHBvIjogewogICAgImluc3RhbGwiOiB7CiAgICAgICJleGNsdWRlIjogWwogICAgICAgICJleHBvLWFzc2V0IiwKICAgICAgICAiQHNob3BpZnkvcmVhY3QtbmF0aXZlLXNraWEiLAogICAgICAgICJAcmVhY3QtbmF2aWdhdGlvbi9ib3R0b20tdGFicyIKICAgICAgXQogICAgfQogIH0KfQ==", 'base64').toString('utf8');
const newStr = Buffer.from("ICAidHlwZSI6ICJtb2R1bGUiLAogICJleHBvIjogewogICAgImluc3RhbGwiOiB7CiAgICAgICJleGNsdWRlIjogWwogICAgICAgICJleHBvLWFzc2V0IiwKICAgICAgICAiQHNob3BpZnkvcmVhY3QtbmF0aXZlLXNraWEiLAogICAgICAgICJAcmVhY3QtbmF2aWdhdGlvbi9ib3R0b20tdGFicyIKICAgICAgXQogICAgfQogIH0sCiAgInBucG0iOiB7CiAgICAib3ZlcnJpZGVzIjogewogICAgICAiQHJlYWN0LW5hdGl2ZS9iYWJlbC1wcmVzZXQiOiAiMC44MS41IiwKICAgICAgIkByZWFjdC1uYXRpdmUvbWV0cm8tY29uZmlnIjogIjAuODEuNSIsCiAgICAgICJAZXhwby9tZXRyby1ydW50aW1lIjogIjYuMS4yIgogICAgfQogIH0KfQ==", 'base64').toString('utf8');

try {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    throw new Error('Arquivo não encontrado: ' + PACKAGE_JSON_PATH);
  }
  let content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `"package.json": esperado 1 ocorrência do final do arquivo esperado, encontrado ${occurrences}. ` +
      `Abortando sem gravar nada. O package.json pode já ter sido modificado — confira manualmente se o "pnpm.overrides" já existe.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(PACKAGE_JSON_PATH, content, 'utf8');
  console.log('✅ package.json: pnpm.overrides restaurado.');

  if (fs.existsSync(WRONG_FILE_PATH)) {
    fs.unlinkSync(WRONG_FILE_PATH);
    console.log('✅ pnpm.yaml (arquivo com nome errado, nunca lido pelo pnpm) removido.');
  } else {
    console.log('ℹ️  pnpm.yaml já não existia — nada a remover.');
  }

  console.log('');
  console.log('Próximos passos (a reinstalação limpa é OBRIGATÓRIA, não pule):');
  console.log('  1. git diff --stat   (deve mostrar package.json modificado e pnpm.yaml removido)');
  console.log('  2. git add package.json && git rm pnpm.yaml 2>nul');
  console.log('     (se o "git rm" der erro dizendo que já não está rastreado, ignore)');
  console.log('  3. git commit -m "fix: restaura pnpm.overrides (arquivo pnpm.yaml tinha nome errado)" && git push');
  console.log('  4. rmdir /s /q node_modules');
  console.log('  5. npx pnpm install');
  console.log('  6. cd android && gradlew bundleRelease');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
