// fix-disable-new-arch-and-bump-version.cjs
// Desativa a New Architecture (Bridgeless/Fabric) do React Native e sobe o
// versionCode pra 13.
//
// MOTIVO: o app publicado (versionCode 12) crasha imediatamente ao abrir,
// sempre, pra todo usuario — confirmado via 2 logs de crash identicos
// (mesma posicao exata no bundle JS nos dois): "TypeError: undefined is
// not a function" dentro de node_modules/react-native/Libraries/Utilities/
// Dimensions.js, chamando NativeDeviceInfo.getConstants(). NativeDeviceInfo
// e um modulo do NUCLEO do React Native (nao um dos pacotes que ja
// corrigimos) que nao esta sendo registrado corretamente sob o modo
// Bridgeless (a camada de comunicacao JS<->nativo da New Architecture).
//
// Ja tentamos limpar TODO o cache (node_modules, cache do Metro, cache do
// Gradle, cache global do Gradle) e o crash persistiu EXATAMENTE igual —
// confirma que nao e cache corrompido, e algo estrutural na configuracao
// nativa. Desativar a New Architecture remove esse subsistema inteiro,
// contornando o problema.
//
// IMPORTANTE — ISSO E UM CONTORNO EMERGENCIAL, NAO A CAUSA RAIZ REAL.
// Ver NOTAS-BUILD-ANDROID.md para os detalhes completos, evidencias
// coletadas e pontos de investigacao pra quando houver tempo de investigar
// com calma e, possivelmente, reativar a New Architecture depois.
//
// ATENCAO: assim como o versionCode, o "newArchEnabled" costuma ficar
// gravado separadamente no projeto Android nativo (android/gradle.properties,
// geralmente a chave "newArchEnabled=true") — nao so no app.config.js. So
// mudar o app.config.js pode nao ser suficiente se o projeto nativo
// (pasta android/) ja foi gerado antes com o valor antigo. Depois de rodar
// este script, confira o arquivo android/gradle.properties manualmente e,
// se necessario, ou edite a linha "newArchEnabled=true" pra "false" nele
// tambem, ou rode "npx expo prebuild --clean" pra regenerar a pasta
// android/ do zero a partir do app.config.js atualizado (cuidado: isso
// pode apagar customizacoes manuais feitas direto na pasta android/, como
// configuracao de assinatura/keystore — faca backup antes se for usar essa
// opcao).
//
// Uso:
//   node fix-disable-new-arch-and-bump-version.cjs

const fs = require('fs');
const path = require('path');

const APP_CONFIG_PATH = path.join(__dirname, 'app.config.js');

function applyOne(content, oldB64, newB64, label) {
  const oldStr = Buffer.from(oldB64, 'base64').toString('utf8');
  const newStr = Buffer.from(newB64, 'base64').toString('utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `"${label}": esperado 1 ocorrência do trecho original, encontrado ${occurrences}. Abortando sem gravar nada.`
    );
  }
  return content.replace(oldStr, () => newStr);
}

try {
  if (!fs.existsSync(APP_CONFIG_PATH)) {
    throw new Error('Arquivo não encontrado: ' + APP_CONFIG_PATH);
  }
  let content = fs.readFileSync(APP_CONFIG_PATH, 'utf8');
  content = applyOne(content, "ICBuZXdBcmNoRW5hYmxlZDogdHJ1ZSwNCg==", "ICBuZXdBcmNoRW5hYmxlZDogZmFsc2UsDQo=", 'newArchEnabled');
  content = applyOne(content, "ICAgIHZlcnNpb25Db2RlOiAxMiwNCg==", "ICAgIHZlcnNpb25Db2RlOiAxMywNCg==", 'versionCode');
  fs.writeFileSync(APP_CONFIG_PATH, content, 'utf8');
  console.log('✅ app.config.js: newArchEnabled -> false, versionCode -> 13.');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff app.config.js   (conferir visualmente)');
  console.log('  2. git add app.config.js');
  console.log('  3. git commit -m "fix: desativa New Architecture (crash NativeDeviceInfo) + versionCode 13"');
  console.log('  4. git push');
  console.log('  5. IMPORTANTE: confira android\\gradle.properties — procure por "newArchEnabled=true" e mude pra "false" manualmente se existir');
  console.log('  6. cd android && gradlew --stop && cd ..');
  console.log('  7. rmdir /s /q android\\app\\build');
  console.log('  8. rmdir /s /q android\\build');
  console.log('  9. cd android && gradlew assembleRelease   (gera APK de teste primeiro, antes do .aab final)');
  console.log('  10. Instalar no celular e testar se abre');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
