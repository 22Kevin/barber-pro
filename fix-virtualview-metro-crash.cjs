// fix-virtualview-metro-crash.cjs
// Corrige o crash de bundling "Cannot read properties of null (reading
// 'loc')" em node_modules/react-native/src/private/components/virtualview/
// VirtualViewNativeComponent.js.
//
// Causa raiz CONFIRMADA (bug documentado do proprio React Native, nao do
// projeto): VirtualView.js usa sintaxe experimental de "pattern matching" do
// JavaScript que o parser do @react-native/babel-plugin-codegen ainda nao
// suporta no RN 0.81.x. Outros desenvolvedores na mesma versao relataram
// exatamente esse crash:
//   github.com/facebook/metro/issues/1651
//   github.com/facebook/metro/issues/1602
//
// VirtualView e um componente oficialmente experimental (reactnative.dev/
// docs/virtualview) que o Barber Pro nao usa em nenhum lugar do codigo — so
// entra no bundle porque o proprio pacote "react-native" reexporta ele no
// indice geral. Fix: redireciona esses arquivos pra um stub vazio no
// metro.config.js, seguindo o MESMO padrao ja usado no projeto pro stub do
// react-native-view-shot.
//
// Cria: lib/virtualview-stub.js
// Edita: metro.config.js
//
// Uso:
//   node fix-virtualview-metro-crash.cjs
//
// Depois de aplicar, e necessario reiniciar o Metro/limpar o cache do
// bundler antes de tentar o build de novo:
//   cd android && gradlew bundleRelease
// (o proprio createBundleReleaseJsAndAssets ja invalida o cache quando o
// metro.config.js muda, mas se persistir cache antigo, apague a pasta
// android/app/build/generated/assets e tente de novo)
//
// Mesmo padrao de seguranca dos scripts anteriores: o trecho antigo precisa
// aparecer EXATAMENTE 1 vez, e a substituicao usa content.replace(old, () =>
// new).

const fs = require('fs');
const path = require('path');

const METRO_CONFIG_PATH = path.join(__dirname, 'metro.config.js');
const STUB_PATH = path.join(__dirname, 'lib', 'virtualview-stub.js');

const oldStr = Buffer.from("Y29uc3QgVklFV19TSE9UX1dFQl9TVFVCID0gcGF0aC5qb2luKF9fZGlybmFtZSwgImxpYiIsICJ2aWV3LXNob3Qtd2ViLXN0dWIuanMiKTsKCm5hdGl2ZVdpbmRDb25maWcucmVzb2x2ZXIgPSB7CiAgLi4ubmF0aXZlV2luZENvbmZpZy5yZXNvbHZlciwKICByZXNvbHZlUmVxdWVzdDogKGNvbnRleHQsIG1vZHVsZU5hbWUsIHBsYXRmb3JtKSA9PiB7CiAgICBpZiAocGxhdGZvcm0gPT09ICJ3ZWIiICYmIG1vZHVsZU5hbWUgPT09ICJyZWFjdC1uYXRpdmUtdmlldy1zaG90IikgewogICAgICByZXR1cm4geyB0eXBlOiAic291cmNlRmlsZSIsIGZpbGVQYXRoOiBWSUVXX1NIT1RfV0VCX1NUVUIgfTsKICAgIH0KICAgIGNvbnN0IHJlc29sdmVyID0gY3NzSW50ZXJvcFJlc29sdmVyID8/IGNvbnRleHQucmVzb2x2ZVJlcXVlc3Q7CiAgICBjb25zdCByZXNvbHZlZCA9IHJlc29sdmVyKGNvbnRleHQsIG1vZHVsZU5hbWUsIHBsYXRmb3JtKTsKICAgIGlmICgKICAgICAgcmVzb2x2ZWQgJiYKICAgICAgImZpbGVQYXRoIiBpbiByZXNvbHZlZCAmJgogICAgICB0eXBlb2YgcmVzb2x2ZWQuZmlsZVBhdGggPT09ICJzdHJpbmciICYmCiAgICAgIHJlc29sdmVkLmZpbGVQYXRoLmluY2x1ZGVzKCJyZWFjdC1uYXRpdmUtY3NzLWludGVyb3AvLmNhY2hlLyIpCiAgICApIHsKICAgICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKHJlc29sdmVkLmZpbGVQYXRoKTsKICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbihQUk9KRUNUX0NBQ0hFLCBmaWxlbmFtZSk7CiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhuZXdQYXRoKSkgZnMud3JpdGVGaWxlU3luYyhuZXdQYXRoLCAiIik7CiAgICAgIHJldHVybiB7IC4uLnJlc29sdmVkLCBmaWxlUGF0aDogbmV3UGF0aCB9OwogICAgfQogICAgcmV0dXJuIHJlc29sdmVkOwogIH0sCn07", 'base64').toString('utf8');
const newStr = Buffer.from("Y29uc3QgVklFV19TSE9UX1dFQl9TVFVCID0gcGF0aC5qb2luKF9fZGlybmFtZSwgImxpYiIsICJ2aWV3LXNob3Qtd2ViLXN0dWIuanMiKTsKCi8vIFZpcnR1YWxWaWV3LmpzIC8gVmlydHVhbFZpZXdOYXRpdmVDb21wb25lbnQuanMgKGRlbnRybyBkZQovLyByZWFjdC1uYXRpdmUvc3JjL3ByaXZhdGUvY29tcG9uZW50cy92aXJ0dWFsdmlldy8pIHVzYW0gc2ludGF4ZQovLyBleHBlcmltZW50YWwgZG8gSlMgcXVlIHF1ZWJyYSBvIHBhcnNlciBkbyBjb2RlZ2VuIG5vIFJOIDAuODEueCDigJQgYnVnCi8vIGNvbmhlY2lkbyAoZ2l0aHViLmNvbS9mYWNlYm9vay9tZXRyby9pc3N1ZXMvMTY1MSkuIENvbXBvbmVudGUgZXhwZXJpbWVudGFsCi8vIG7Do28gdXNhZG8gZW0gbmVuaHVtIGx1Z2FyIGRvIGFwcCDigJQgcmVkaXJlY2lvbmFkbyBwcmEgc3R1YiB2YXppby4KY29uc3QgVklSVFVBTFZJRVdfU1RVQiA9IHBhdGguam9pbihfX2Rpcm5hbWUsICJsaWIiLCAidmlydHVhbHZpZXctc3R1Yi5qcyIpOwoKbmF0aXZlV2luZENvbmZpZy5yZXNvbHZlciA9IHsKICAuLi5uYXRpdmVXaW5kQ29uZmlnLnJlc29sdmVyLAogIHJlc29sdmVSZXF1ZXN0OiAoY29udGV4dCwgbW9kdWxlTmFtZSwgcGxhdGZvcm0pID0+IHsKICAgIGlmIChwbGF0Zm9ybSA9PT0gIndlYiIgJiYgbW9kdWxlTmFtZSA9PT0gInJlYWN0LW5hdGl2ZS12aWV3LXNob3QiKSB7CiAgICAgIHJldHVybiB7IHR5cGU6ICJzb3VyY2VGaWxlIiwgZmlsZVBhdGg6IFZJRVdfU0hPVF9XRUJfU1RVQiB9OwogICAgfQogICAgY29uc3QgcmVzb2x2ZXIgPSBjc3NJbnRlcm9wUmVzb2x2ZXIgPz8gY29udGV4dC5yZXNvbHZlUmVxdWVzdDsKICAgIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZXIoY29udGV4dCwgbW9kdWxlTmFtZSwgcGxhdGZvcm0pOwogICAgaWYgKAogICAgICByZXNvbHZlZCAmJgogICAgICAiZmlsZVBhdGgiIGluIHJlc29sdmVkICYmCiAgICAgIHR5cGVvZiByZXNvbHZlZC5maWxlUGF0aCA9PT0gInN0cmluZyIgJiYKICAgICAgcmVzb2x2ZWQuZmlsZVBhdGguaW5jbHVkZXMoInJlYWN0LW5hdGl2ZS1jc3MtaW50ZXJvcC8uY2FjaGUvIikKICAgICkgewogICAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUocmVzb2x2ZWQuZmlsZVBhdGgpOwogICAgICBjb25zdCBuZXdQYXRoID0gcGF0aC5qb2luKFBST0pFQ1RfQ0FDSEUsIGZpbGVuYW1lKTsKICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKG5ld1BhdGgpKSBmcy53cml0ZUZpbGVTeW5jKG5ld1BhdGgsICIiKTsKICAgICAgcmV0dXJuIHsgLi4ucmVzb2x2ZWQsIGZpbGVQYXRoOiBuZXdQYXRoIH07CiAgICB9CiAgICBpZiAoCiAgICAgIHJlc29sdmVkICYmCiAgICAgICJmaWxlUGF0aCIgaW4gcmVzb2x2ZWQgJiYKICAgICAgdHlwZW9mIHJlc29sdmVkLmZpbGVQYXRoID09PSAic3RyaW5nIiAmJgogICAgICByZXNvbHZlZC5maWxlUGF0aC5yZXBsYWNlKC9cXC9nLCAiLyIpLmluY2x1ZGVzKCIvcmVhY3QtbmF0aXZlL3NyYy9wcml2YXRlL2NvbXBvbmVudHMvdmlydHVhbHZpZXcvIikKICAgICkgewogICAgICByZXR1cm4geyAuLi5yZXNvbHZlZCwgZmlsZVBhdGg6IFZJUlRVQUxWSUVXX1NUVUIgfTsKICAgIH0KICAgIHJldHVybiByZXNvbHZlZDsKICB9LAp9Ow==", 'base64').toString('utf8');
const stubContent = Buffer.from("Ly8gU3R1YiBwYXJhIG5vZGVfbW9kdWxlcy9yZWFjdC1uYXRpdmUvc3JjL3ByaXZhdGUvY29tcG9uZW50cy92aXJ0dWFsdmlldy8qLgovLwovLyBFc3NlcyBhcnF1aXZvcyBpbnRlcm5vcyBkbyBSZWFjdCBOYXRpdmUgKFZpcnR1YWxWaWV3LmpzIGUKLy8gVmlydHVhbFZpZXdOYXRpdmVDb21wb25lbnQuanMpIHVzYW0gc2ludGF4ZSBleHBlcmltZW50YWwgZG8gSmF2YVNjcmlwdAovLyAocHJvcG9zdGEgZGUgcGF0dGVybiBtYXRjaGluZyAibWF0Y2ggKG1vZGUpIHsgLi4uIH0iKSBxdWUgbyBwYXJzZXIgZG8KLy8gTWV0cm8vYmFiZWwtcGx1Z2luLWNvZGVnZW4gYWluZGEgbsOjbyBlbnRlbmRlIG5vIFJlYWN0IE5hdGl2ZSAwLjgxLngg4oCUCi8vIGJ1ZyBjb25maXJtYWRvIGUgcmVwcm9kdXppZG8gcG9yIG91dHJvcyBkZXNlbnZvbHZlZG9yZXMgbmEgbWVzbWEgdmVyc8OjbzoKLy8gZ2l0aHViLmNvbS9mYWNlYm9vay9tZXRyby9pc3N1ZXMvMTY1MSBlIC9pc3N1ZXMvMTYwMi4KLy8KLy8gVmlydHVhbFZpZXcgw6kgdW0gY29tcG9uZW50ZSBvZmljaWFsbWVudGUgbWFyY2FkbyBjb21vIGV4cGVyaW1lbnRhbCDwn6eqCi8vIChyZWFjdG5hdGl2ZS5kZXYvZG9jcy92aXJ0dWFsdmlldykg4oCUIG8gQmFyYmVyIFBybyBuw6NvIHVzYSBlbGUgZW0gbmVuaHVtCi8vIGx1Z2FyIGRvIGPDs2RpZ28uIFPDsyDDqSBwdXhhZG8gcHJvIGJ1bmRsZSBwb3JxdWUgbyBwcsOzcHJpbyBwYWNvdGUKLy8gInJlYWN0LW5hdGl2ZSIgcmVleHBvcnRhIGVzc2UgY29tcG9uZW50ZSBubyBzZXUgw61uZGljZSBnZXJhbCwgbWVzbW8gc2VtCi8vIG5pbmd1w6ltIHVzYXIuIFJlZGlyZWNpb25hciBwcmEgZXN0ZSBzdHViIHZhemlvIGV2aXRhIG8gY3Jhc2ggZGUgYnVpbGQKLy8gc2VtIHJlbW92ZXIgbmVuaHVtYSBmdW5jaW9uYWxpZGFkZSByZWFsIGRvIGFwcC4KbW9kdWxlLmV4cG9ydHMgPSB7fTsK", 'base64').toString('utf8');

try {
  if (!fs.existsSync(METRO_CONFIG_PATH)) {
    throw new Error('Arquivo não encontrado: ' + METRO_CONFIG_PATH);
  }
  let content = fs.readFileSync(METRO_CONFIG_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `"metro.config.js": esperado 1 ocorrência do trecho original, encontrado ${occurrences}. ` +
      `Abortando sem gravar nada. O arquivo pode já ter sido modificado — confira manualmente se o stub do virtualview já existe.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(METRO_CONFIG_PATH, content, 'utf8');
  console.log('✅ metro.config.js: interceptação do virtualview adicionada.');

  const libDir = path.join(__dirname, 'lib');
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
  fs.writeFileSync(STUB_PATH, stubContent, 'utf8');
  console.log('✅ lib/virtualview-stub.js criado.');

  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff --stat   (deve mostrar metro.config.js modificado e lib/virtualview-stub.js novo)');
  console.log('  2. git diff metro.config.js   (conferir visualmente)');
  console.log('  3. git add metro.config.js lib/virtualview-stub.js');
  console.log('  4. git commit -m "fix: stub para VirtualView (bug de parsing do RN 0.81.x, github.com/facebook/metro/issues/1651)"');
  console.log('  5. git push');
  console.log('  6. cd android && gradlew bundleRelease');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
