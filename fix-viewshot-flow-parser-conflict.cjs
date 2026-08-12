// fix-viewshot-flow-parser-conflict.cjs
// Erro NOVO e diferente dos anteriores (nao e mais o crash "loc" do
// codegen): "More than one plugin attempted to override parsing" em
// node_modules/react-native-view-shot/src/RNViewShot.js.
//
// Causa raiz: esse arquivo tem o pragma "//@flow" no topo (o pacote inteiro
// e tipado com Flow, nao TypeScript) e importa de um arquivo de
// especificacao de codegen (./specs/NativeRNViewShot). A combinacao do
// parser de Flow com o wrapper de transformacao do react-native-css-interop
// causa esse conflito — e EXATAMENTE o mesmo problema que ja tinha sido
// visto e corrigido antes, mas so na versao .web.js desse mesmo pacote
// (ver o comentario existente sobre VIEW_SHOT_WEB_STUB no metro.config.js).
// Agora apareceu tambem no build nativo (Android), no arquivo RNViewShot.js
// (sem sufixo .web).
//
// Fix: mesmo metodo ja usado nos outros stubs — substitui o arquivo por
// uma versao sem o pragma do Flow e sem precisar importar o arquivo de
// especificacao (usa NativeModules diretamente, que o React Native ja
// resolve automaticamente pro TurboModule real "RNViewShot").
//
// Cria: lib/codegen-stubs/RNViewShot.js
// Edita: metro.config.js (adiciona 1 entrada no mapa)
//
// Uso:
//   node fix-viewshot-flow-parser-conflict.cjs
//
// Mesmo padrao de seguranca: o trecho antigo do metro.config.js precisa
// aparecer EXATAMENTE 1 vez.

const fs = require('fs');
const path = require('path');

const METRO_CONFIG_PATH = path.join(__dirname, 'metro.config.js');
const STUB_CONTENT = Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS12aWV3LXNob3Qvc3JjL1JOVmlld1Nob3QuanMgKHZlcnPDo28gNC4wLjMsCi8vIGNvbmZlcmlkbyBkaXJldGFtZW50ZSBubyBwYWNvdGUgYmFpeGFkbyBkbyBucG0pLgovLwovLyBPIGFycXVpdm8gb3JpZ2luYWwgdGVtIHVtIGNvbWVudMOhcmlvICIvL0BmbG93IiBubyB0b3BvIChvIHBhY290ZSBpbnRlaXJvCi8vIMOpIHRpcGFkbyBjb20gRmxvdywgbsOjbyBUeXBlU2NyaXB0KSBlIGltcG9ydGEgZGUgLi9zcGVjcy9OYXRpdmVSTlZpZXdTaG90Ci8vICh1bSBhcnF1aXZvIGRlIGVzcGVjaWZpY2HDp8OjbyBkZSBjb2RlZ2VuIOKAlCBtZXNtbyBwYWRyw6NvIGRvcyBvdXRyb3MgasOhCi8vIGNvcnJpZ2lkb3MpLiBBIGNvbWJpbmHDp8OjbyBkbyBwYXJzZXIgZGUgRmxvdyBjb20gbyB3cmFwcGVyIGRlIHRyYW5zZm9ybWHDp8OjbwovLyBkbyByZWFjdC1uYXRpdmUtY3NzLWludGVyb3AgY2F1c2EgIk1vcmUgdGhhbiBvbmUgcGx1Z2luIGF0dGVtcHRlZCB0bwovLyBvdmVycmlkZSBwYXJzaW5nIiDigJQgbWVzbW8gcHJvYmxlbWEgasOhIHZpc3RvIGFudGVzIChlIGrDoSBjb3JyaWdpZG8pIG5hCi8vIHZlcnPDo28gLndlYi5qcyBkZXNzZSBtZXNtbyBwYWNvdGUgKHZlciBWSUVXX1NIT1RfV0VCX1NUVUIgYWNpbWEpLgovLwovLyBFc3RhIHZlcnPDo28gZXZpdGEgb3MgZG9pcyBwcm9ibGVtYXMgZGUgdW1hIHZlejogc2VtIG8gcHJhZ21hIGRvIEZsb3csIGUKLy8gc2VtIHByZWNpc2FyIGltcG9ydGFyIG8gYXJxdWl2byBkZSBlc3BlY2lmaWNhw6fDo28gKHVzYSBOYXRpdmVNb2R1bGVzCi8vIGRpcmV0YW1lbnRlLCBxdWUgbyBSZWFjdCBOYXRpdmUgasOhIHJlc29sdmUgYXV0b21hdGljYW1lbnRlIHBybwovLyBUdXJib01vZHVsZSByZWFsICJSTlZpZXdTaG90IiwgcmVnaXN0cmFkbyBkZSB2ZXJkYWRlIGR1cmFudGUgbyBidWlsZAovLyBuYXRpdm8g4oCUIG1lc21vIHBhZHLDo28gdXNhZG8gbm9zIG91dHJvcyBUdXJib01vZHVsZXMgasOhIGNvcnJpZ2lkb3MpLgppbXBvcnQgeyBOYXRpdmVNb2R1bGVzIH0gZnJvbSAicmVhY3QtbmF0aXZlIjsKCmV4cG9ydCBkZWZhdWx0IE5hdGl2ZU1vZHVsZXMuUk5WaWV3U2hvdDsK", 'base64').toString('utf8');

try {
  const stubsDir = path.join(__dirname, 'lib', 'codegen-stubs');
  fs.mkdirSync(stubsDir, { recursive: true });
  const stubPath = path.join(stubsDir, 'RNViewShot.js');
  fs.writeFileSync(stubPath, STUB_CONTENT, 'utf8');
  console.log('✅ lib/codegen-stubs/RNViewShot.js criado.');

  const oldStr = Buffer.from("ICB7IGZyYWc6ICIvQHJlYWN0LW5hdGl2ZS1nb29nbGUtc2lnbmluL2dvb2dsZS1zaWduaW4vbGliL21vZHVsZS9zcGVjL1NpZ25JbkJ1dHRvbk5hdGl2ZUNvbXBvbmVudCIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIlNpZ25JbkJ1dHRvbk5hdGl2ZUNvbXBvbmVudC5qcyIpIH0sCl07", 'base64').toString('utf8');
  const newStr = Buffer.from("ICB7IGZyYWc6ICIvQHJlYWN0LW5hdGl2ZS1nb29nbGUtc2lnbmluL2dvb2dsZS1zaWduaW4vbGliL21vZHVsZS9zcGVjL1NpZ25JbkJ1dHRvbk5hdGl2ZUNvbXBvbmVudCIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIlNpZ25JbkJ1dHRvbk5hdGl2ZUNvbXBvbmVudC5qcyIpIH0sCiAgLy8gcmVhY3QtbmF0aXZlLXZpZXctc2hvdCDigJQgUk5WaWV3U2hvdC5qcyAobyBhcnF1aXZvIG5hdGl2bywgbsOjbyBvCiAgLy8gLndlYi5qcyBqw6EgdHJhdGFkbyBhY2ltYSkgdGVtIG8gcHJhZ21hICIvL0BmbG93IiBlIGltcG9ydGEgZGUgdW0KICAvLyBhcnF1aXZvIGRlIGVzcGVjaWZpY2HDp8OjbyBkZSBjb2RlZ2VuIOKAlCBjYXVzYSAiTW9yZSB0aGFuIG9uZSBwbHVnaW4KICAvLyBhdHRlbXB0ZWQgdG8gb3ZlcnJpZGUgcGFyc2luZyIgKG1lc21vIHByb2JsZW1hIGRhIHZlcnPDo28gd2ViLCB2ZXIKICAvLyBWSUVXX1NIT1RfV0VCX1NUVUIgbm8gdG9wbyBkbyBhcnF1aXZvKSwgYWdvcmEgdGFtYsOpbSBubyBidWlsZCBuYXRpdm8uCiAgeyBmcmFnOiAiL3JlYWN0LW5hdGl2ZS12aWV3LXNob3Qvc3JjL1JOVmlld1Nob3QuanMiLCBzdHViOiBwYXRoLmpvaW4oQ09ERUdFTl9TVFVCU19ESVIsICJSTlZpZXdTaG90LmpzIikgfSwKXTs=", 'base64').toString('utf8');
  let content = fs.readFileSync(METRO_CONFIG_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `metro.config.js: esperado 1 ocorrência do trecho original, encontrado ${occurrences}. Abortando sem gravar nada.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(METRO_CONFIG_PATH, content, 'utf8');
  console.log('✅ metro.config.js atualizado.');

  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git status   (deve mostrar metro.config.js + 1 arquivo novo)');
  console.log('  2. git diff metro.config.js   (conferir visualmente)');
  console.log('  3. git add metro.config.js lib/codegen-stubs/RNViewShot.js');
  console.log('  4. git commit -m "fix: resolve conflito de parser Flow/css-interop no RNViewShot.js"');
  console.log('  5. git push');
  console.log('  6. rmdir /s /q node_modules');
  console.log('  7. npx pnpm install');
  console.log('  8. git add pnpm-lock.yaml (se mudar) && git commit -m "chore: lockfile" && git push');
  console.log('  9. cd android && gradlew bundleRelease');
  console.log('  10. IMPORTANTE: essa e uma funcionalidade real usada no app (captura/compartilhamento de tela em appointment-share-card.tsx) — testar esse recurso especificamente depois que o build passar');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
