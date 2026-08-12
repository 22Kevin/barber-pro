// fix-babel-family-version-pin.cjs
// TENTATIVA MAIS ESTRUTURAL (e mais arriscada que os fixes anteriores) pro
// crash recorrente "Cannot read properties of null (reading 'loc')" no
// @react-native/babel-plugin-codegen, que ja apareceu em 3 arquivos
// DIFERENTES e sem relacao entre si (VirtualView, NativeSafeAreaView,
// AndroidDrawerLayoutNativeComponent) — padrao forte demais pra ser "arquivo
// individual com bug de sintaxe" e comeca a parecer incompatibilidade real
// de ferramentas.
//
// Evidencia: o template oficial do proprio React Native 0.81.4 fixa
// "@babel/core": "^7.25.2" no devDependencies — bem mais antigo que o
// 7.29.7 que estava resolvido neste projeto. Este fix pina TODA a familia
// do babel (core, traverse, types, parser, generator, template) pra
// versoes consistentes entre si da mesma epoca (7.25.x), via pnpm.overrides,
// na esperanca de alinhar com o que o codegen do RN 0.81.x realmente foi
// testado contra.
//
// RISCO: isto e uma mudanca ampla (baixa a versao de uma dependencia usada
// em praticamente todo o toolchain de build). Se causar um erro DIFERENTE
// do anterior, pode ser necessario reverter este fix especifico (os outros
// overrides — babel-preset, metro-config, metro-runtime — continuam
// validos e nao precisam ser revertidos).
//
// Uso:
//   node fix-babel-family-version-pin.cjs
//
// APOS aplicar, e obrigatorio reinstalar do zero (o pnpm nao troca versoes
// ja resolvidas de pacotes profundamente aninhados so com --force):
//   rmdir /s /q node_modules
//   npx pnpm install
//
// Mesmo padrao de seguranca dos scripts anteriores: o trecho antigo precisa
// aparecer EXATAMENTE 1 vez, e a substituicao usa content.replace(old, () =>
// new).

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON_PATH = path.join(__dirname, 'package.json');

const oldStr = Buffer.from("ICAicG5wbSI6IHsKICAgICJvdmVycmlkZXMiOiB7CiAgICAgICJAcmVhY3QtbmF0aXZlL2JhYmVsLXByZXNldCI6ICIwLjgxLjUiLAogICAgICAiQHJlYWN0LW5hdGl2ZS9tZXRyby1jb25maWciOiAiMC44MS41IiwKICAgICAgIkBleHBvL21ldHJvLXJ1bnRpbWUiOiAiNi4xLjIiCiAgICB9CiAgfQp9", 'base64').toString('utf8');
const newStr = Buffer.from("ICAicG5wbSI6IHsKICAgICJvdmVycmlkZXMiOiB7CiAgICAgICJAcmVhY3QtbmF0aXZlL2JhYmVsLXByZXNldCI6ICIwLjgxLjUiLAogICAgICAiQHJlYWN0LW5hdGl2ZS9tZXRyby1jb25maWciOiAiMC44MS41IiwKICAgICAgIkBleHBvL21ldHJvLXJ1bnRpbWUiOiAiNi4xLjIiLAogICAgICAiQGJhYmVsL2NvcmUiOiAiNy4yNS4yIiwKICAgICAgIkBiYWJlbC90cmF2ZXJzZSI6ICI3LjI1LjMiLAogICAgICAiQGJhYmVsL3R5cGVzIjogIjcuMjUuMiIsCiAgICAgICJAYmFiZWwvcGFyc2VyIjogIjcuMjUuMyIsCiAgICAgICJAYmFiZWwvZ2VuZXJhdG9yIjogIjcuMjUuMCIsCiAgICAgICJAYmFiZWwvdGVtcGxhdGUiOiAiNy4yNS4wIgogICAgfQogIH0KfQ==", 'base64').toString('utf8');

try {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    throw new Error('Arquivo não encontrado: ' + PACKAGE_JSON_PATH);
  }
  let content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `"package.json": esperado 1 ocorrência do bloco pnpm.overrides atual, encontrado ${occurrences}. ` +
      `Abortando sem gravar nada. Confira manualmente o estado atual do pnpm.overrides.`
    );
  }
  content = content.replace(oldStr, () => newStr);

  // Valida que o resultado ainda é JSON válido antes de gravar
  JSON.parse(content);

  fs.writeFileSync(PACKAGE_JSON_PATH, content, 'utf8');
  console.log('✅ package.json: família do babel pinada em pnpm.overrides.');
  console.log('');
  console.log('Próximos passos (a reinstalação limpa completa é OBRIGATÓRIA):');
  console.log('  1. git diff package.json   (conferir visualmente)');
  console.log('  2. git add package.json');
  console.log('  3. git commit -m "fix: pina familia do babel em 7.25.x (tentativa pro crash recorrente de codegen)"');
  console.log('  4. git push');
  console.log('  5. rmdir /s /q node_modules');
  console.log('  6. npx pnpm install   (isso regenera o pnpm-lock.yaml — precisa commitar ele tambem depois)');
  console.log('  7. git add pnpm-lock.yaml && git commit -m "chore: atualiza lockfile" && git push');
  console.log('  8. cd android && gradlew bundleRelease');
  console.log('');
  console.log('Se der um erro DIFERENTE do anterior, este fix pode ter causado um novo problema — avise antes de continuar tentando resolver às cegas.');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
