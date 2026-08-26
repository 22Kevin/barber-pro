// fix-revert-disable-new-arch.cjs
// REVERTE a desativacao da New Architecture (mantem versionCode 13).
//
// MOTIVO: confirmado que "react-native-reanimated" (ja instalado no
// projeto) EXIGE a New Architecture ligada — o build falha direto com
// "[Reanimated] Reanimated requires new architecture to be enabled" quando
// "newArchEnabled: false". Ou seja, desativar a New Architecture nao e uma
// opcao viavel neste projeto — precisamos voltar a investigar a causa raiz
// real do crash do NativeDeviceInfo com a New Architecture LIGADA.
//
// Ver INVESTIGACAO-NEW-ARCHITECTURE.md para o contexto completo do crash
// original — esse documento continua valendo, só que agora sabemos que o
// "contorno emergencial" sugerido lá (desativar a New Architecture) nao
// funciona nesse projeto especifico.
//
// Uso:
//   node fix-revert-disable-new-arch.cjs

const fs = require('fs');
const path = require('path');

const APP_CONFIG_PATH = path.join(__dirname, 'app.config.js');

const oldStr = Buffer.from("ICBuZXdBcmNoRW5hYmxlZDogZmFsc2UsDQo=", 'base64').toString('utf8');
const newStr = Buffer.from("ICBuZXdBcmNoRW5hYmxlZDogdHJ1ZSwNCg==", 'base64').toString('utf8');

try {
  if (!fs.existsSync(APP_CONFIG_PATH)) {
    throw new Error('Arquivo não encontrado: ' + APP_CONFIG_PATH);
  }
  let content = fs.readFileSync(APP_CONFIG_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `esperado 1 ocorrência do trecho original, encontrado ${occurrences}. Abortando sem gravar nada.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(APP_CONFIG_PATH, content, 'utf8');
  console.log('✅ app.config.js: newArchEnabled revertido para true.');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff app.config.js   (conferir visualmente)');
  console.log('  2. git add app.config.js');
  console.log('  3. git commit -m "revert: reativa New Architecture (reanimated exige) - versionCode continua 13"');
  console.log('  4. git push');
  console.log('  5. Confira android\\gradle.properties — se você mudou "newArchEnabled" pra false lá também, reverta pra "true"');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
