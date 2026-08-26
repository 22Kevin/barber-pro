// fix-bump-versioncode-12.cjs
// Sobe o versionCode de 11 para 12 no app.config.js. Necessario porque o
// Play Console rejeitou o upload informando que o codigo de versao 10 ja
// foi usado (versao em producao) — subindo pro 12 pra evitar colisao tanto
// com o 10 (producao atual) quanto com o 11 (que ja estava no arquivo,
// possivelmente ja tentado em algum momento anterior).
//
// Uso:
//   node fix-bump-versioncode-12.cjs

const fs = require('fs');
const path = require('path');

const APP_CONFIG_PATH = path.join(__dirname, 'app.config.js');

const oldStr = Buffer.from("ICAgIHZlcnNpb25Db2RlOiAxMSwNCg==", 'base64').toString('utf8');
const newStr = Buffer.from("ICAgIHZlcnNpb25Db2RlOiAxMiwNCg==", 'base64').toString('utf8');

try {
  if (!fs.existsSync(APP_CONFIG_PATH)) {
    throw new Error('Arquivo não encontrado: ' + APP_CONFIG_PATH);
  }
  let content = fs.readFileSync(APP_CONFIG_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `esperado 1 ocorrência do trecho original ("versionCode: 11"), encontrado ${occurrences}. ` +
      `Abortando sem gravar nada. Confira manualmente o valor atual de versionCode em app.config.js.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(APP_CONFIG_PATH, content, 'utf8');
  console.log('✅ app.config.js: versionCode atualizado de 11 para 12.');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff app.config.js   (conferir visualmente)');
  console.log('  2. git add app.config.js');
  console.log('  3. git commit -m "chore: sobe versionCode para 12"');
  console.log('  4. git push');
  console.log('  5. cd android && gradlew bundleRelease   (precisa gerar um .aab NOVO com o versionCode atualizado)');
  console.log('  6. Enviar o novo .aab (android/app/build/outputs/bundle/release/app-release.aab) para o Play Console');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
