// fix-block-entire-specs-deprecated-folder.cjs
// Quarto arquivo diferente com o MESMO erro de parsing do codegen
// ("Cannot read properties of null (reading 'loc')"), de novo dentro de
// node_modules/react-native/src/private/specs_DEPRECATED/ — desta vez
// RCTInputAccessoryViewNativeComponent.js (o terceiro tinha sido
// AndroidDrawerLayoutNativeComponent.js).
//
// Como o Metro processa arquivos em paralelo, qual arquivo quebrado aparece
// primeiro no log varia entre execucoes — e ha fortes indicios de que VARIOS
// arquivos dentro dessa pasta estao com o mesmo problema ao mesmo tempo, nao
// so um. Em vez de continuar corrigindo um de cada vez, este fix bloqueia a
// pasta "specs_DEPRECATED" INTEIRA de uma so vez. E seguro porque o proprio
// React Native ja marca essa pasta como obsoleta/legada — nada em um app
// moderno (como o Barber Pro) deveria depender de componentes daqui.
//
// Este script tambem reverte definitivamente o pin da familia do babel
// (que nao ajudou e foi testado como nao-solucao) — caso o script anterior
// (fix-revert-babel-pin-and-drawerlayout-stub.cjs) ainda nao tenha sido
// aplicado. Se ja tiver sido aplicado, este script simplesmente nao vai
// encontrar o trecho antigo do package.json e vai avisar — nesse caso, so
// ignore o erro da parte do package.json e aplique manualmente a mudanca
// do metro.config.js.
//
// Uso:
//   node fix-block-entire-specs-deprecated-folder.cjs
//
// APOS aplicar, reinstalacao limpa e obrigatoria:
//   rmdir /s /q node_modules
//   npx pnpm install
//
// Mesmo padrao de seguranca: cada trecho antigo precisa aparecer
// EXATAMENTE 1 vez por arquivo, e a substituicao usa content.replace(old,
// () => new).

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON_PATH = path.join(__dirname, 'package.json');
const METRO_CONFIG_PATH = path.join(__dirname, 'metro.config.js');

function applyOne(filePath, oldB64, newB64, label, required) {
  const oldStr = Buffer.from(oldB64, 'base64').toString('utf8');
  const newStr = Buffer.from(newB64, 'base64').toString('utf8');
  if (!fs.existsSync(filePath)) {
    throw new Error('Arquivo não encontrado: ' + filePath);
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    const msg = `"${label}": esperado 1 ocorrência do trecho original, encontrado ${occurrences}.`;
    if (required) {
      throw new Error(msg + ' Abortando sem gravar nada.');
    } else {
      console.log(`⚠️  ${msg} Pulando esta parte (provavelmente já foi aplicada antes).`);
      return false;
    }
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${label} atualizado.`);
  return true;
}

try {
  // package.json: não é obrigatório (pode já ter sido revertido antes)
  const pkgChanged = applyOne(PACKAGE_JSON_PATH, "ICAicG5wbSI6IHsKICAgICJvdmVycmlkZXMiOiB7CiAgICAgICJAcmVhY3QtbmF0aXZlL2JhYmVsLXByZXNldCI6ICIwLjgxLjUiLAogICAgICAiQHJlYWN0LW5hdGl2ZS9tZXRyby1jb25maWciOiAiMC44MS41IiwKICAgICAgIkBleHBvL21ldHJvLXJ1bnRpbWUiOiAiNi4xLjIiLAogICAgICAiQGJhYmVsL2NvcmUiOiAiNy4yNS4yIiwKICAgICAgIkBiYWJlbC90cmF2ZXJzZSI6ICI3LjI1LjMiLAogICAgICAiQGJhYmVsL3R5cGVzIjogIjcuMjUuMiIsCiAgICAgICJAYmFiZWwvcGFyc2VyIjogIjcuMjUuMyIsCiAgICAgICJAYmFiZWwvZ2VuZXJhdG9yIjogIjcuMjUuMCIsCiAgICAgICJAYmFiZWwvdGVtcGxhdGUiOiAiNy4yNS4wIgogICAgfQogIH0KfQ==", "ICAicG5wbSI6IHsKICAgICJvdmVycmlkZXMiOiB7CiAgICAgICJAcmVhY3QtbmF0aXZlL2JhYmVsLXByZXNldCI6ICIwLjgxLjUiLAogICAgICAiQHJlYWN0LW5hdGl2ZS9tZXRyby1jb25maWciOiAiMC44MS41IiwKICAgICAgIkBleHBvL21ldHJvLXJ1bnRpbWUiOiAiNi4xLjIiCiAgICB9CiAgfQp9", 'package.json (revert do pin do babel)', false);
  if (pkgChanged) {
    JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  }

  // metro.config.js: este é o fix principal, precisa aplicar com sucesso
  applyOne(METRO_CONFIG_PATH, "Y29uc3QgQlJPS0VOX0NPREVHRU5fUEFUSF9GUkFHTUVOVFMgPSBbCiAgIi9yZWFjdC1uYXRpdmUvc3JjL3ByaXZhdGUvY29tcG9uZW50cy92aXJ0dWFsdmlldy8iLAogICIvcmVhY3QtbmF0aXZlLXNhZmUtYXJlYS1jb250ZXh0L3NyYy9zcGVjcy9OYXRpdmVTYWZlQXJlYVZpZXciLApdOw==", "Y29uc3QgQlJPS0VOX0NPREVHRU5fUEFUSF9GUkFHTUVOVFMgPSBbCiAgIi9yZWFjdC1uYXRpdmUvc3JjL3ByaXZhdGUvY29tcG9uZW50cy92aXJ0dWFsdmlldy8iLAogICIvcmVhY3QtbmF0aXZlLXNhZmUtYXJlYS1jb250ZXh0L3NyYy9zcGVjcy9OYXRpdmVTYWZlQXJlYVZpZXciLAogIC8vICJzcGVjc19ERVBSRUNBVEVEIiDDqSB1bWEgcGFzdGEgcXVlIG8gcHLDs3ByaW8gUmVhY3QgTmF0aXZlIGrDoSBtYXJjYSBjb21vCiAgLy8gb2Jzb2xldGEgKGNvbXBvbmVudGVzIGxlZ2Fkb3M6IEFuZHJvaWREcmF3ZXJMYXlvdXQsIFJDVElucHV0QWNjZXNzb3J5VmlldwogIC8vIGUgb3V0cm9zKS4gTyBtZXNtbyBidWcgZGUgcGFyc2luZyBkbyBjb2RlZ2VuIGrDoSBhcGFyZWNldSBlbSBtw7psdGlwbG9zCiAgLy8gYXJxdWl2b3MgZGlmZXJlbnRlcyBkZW50cm8gZGVsYSwgdW0gZGUgY2FkYSB2ZXogKG8gTWV0cm8gcHJvY2Vzc2EgZW0KICAvLyBwYXJhbGVsbywgZW50w6NvIHF1YWwgYXJxdWl2byBhcGFyZWNlIHByaW1laXJvIHZhcmlhIGVudHJlIGV4ZWN1w6fDtWVzKSDigJQKICAvLyBibG9xdWVhbmRvIGEgcGFzdGEgaW50ZWlyYSBkZSB1bWEgdmV6IGVtIHZleiBkZSBjb250aW51YXIgY2F0YW5kbwogIC8vIGFycXVpdm8gcG9yIGFycXVpdm8uIE5hZGEgbm8gYXBwIHVzYSBjb21wb25lbnRlcyBsZWdhZG9zL2RlcHJlY2lhZG9zCiAgLy8gZGlyZXRhbWVudGUuCiAgIi9yZWFjdC1uYXRpdmUvc3JjL3ByaXZhdGUvc3BlY3NfREVQUkVDQVRFRC8iLApdOw==", 'metro.config.js (bloqueia pasta specs_DEPRECATED inteira)', true);

  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff --stat   (deve mostrar metro.config.js, e talvez package.json)');
  console.log('  2. git diff   (conferir visualmente)');
  console.log('  3. git add metro.config.js package.json');
  console.log('  4. git commit -m "fix: bloqueia pasta specs_DEPRECATED inteira (varios arquivos com mesmo bug de codegen)"');
  console.log('  5. git push');
  console.log('  6. rmdir /s /q node_modules');
  console.log('  7. npx pnpm install');
  console.log('  8. git add pnpm-lock.yaml && git commit -m "chore: atualiza lockfile" && git push');
  console.log('  9. cd android && gradlew bundleRelease');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
