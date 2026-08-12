// fix-android-versioncode.cjs
// Atualiza o versionCode do Android de 2 pra 11 no app.config.js.
//
// Motivo: o Play Console ja tem a versao 10 (1.0.0) publicada em Producao —
// confirmado direto no painel do Play Console em 06/08/2026. O arquivo local
// estava desatualizado (versionCode: 2), o que faria o upload do proximo
// .aab ser REJEITADO pelo Play Console (versionCode tem que ser sempre maior
// que qualquer versao ja enviada, inclusive em faixas de Teste).
//
// Se no momento de aplicar este script já existir uma versao MAIOR que 10 em
// qualquer faixa (Producao, Teste interno/fechado) no Play Console, NAO
// aplique este script sem ajustar o numero primeiro — fale com o Claude
// pra gerar a versao corrigida.
//
// Uso:
//   node fix-android-versioncode.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: o trecho antigo precisa
// aparecer EXATAMENTE 1 vez, e a substituicao usa content.replace(old, () =>
// new) — preserva CRLF (este arquivo usa CRLF, diferente da maioria dos
// arquivos do projeto).

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'app.config.js');

const oldStr = Buffer.from("ICAgIHZlcnNpb25Db2RlOiAyLA0K", 'base64').toString('utf8');
const newStr = Buffer.from("ICAgIHZlcnNpb25Db2RlOiAxMSwNCg==", 'base64').toString('utf8');

try {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('Arquivo não encontrado: ' + CONFIG_PATH);
  }
  let content = fs.readFileSync(CONFIG_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `"app.config.js:versionCode": esperado 1 ocorrência de "versionCode: 2,", encontrado ${occurrences}. ` +
      `Abortando sem gravar nada. Talvez o versionCode já tenha sido alterado — confira manualmente.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(CONFIG_PATH, content, 'utf8');
  console.log('✅ app.config.js: versionCode atualizado de 2 para 11.');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff app.config.js   (deve mostrar só essa linha mudando)');
  console.log('  2. git add app.config.js && git commit -m "chore: versionCode 11" && git push');
  console.log('  3. cd android && ./gradlew clean && ./gradlew bundleRelease');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
