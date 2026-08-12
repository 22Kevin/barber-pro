// fix-google-signin-precise-stub.cjs
// Oitavo arquivo com o mesmo bug de parsing do codegen ("Cannot read
// properties of null (reading 'loc')"), dessa vez em
// @react-native-google-signin/google-signin/lib/module/spec/SignInButtonNativeComponent.ts.
//
// Detalhe curioso: esse arquivo especificamente ficou sem compilar nessa
// versao (16.1.2) do pacote — a pasta "lib/module" deveria ter so
// JavaScript ja compilado (sem tipos), mas esse .ts "esquecido" ainda
// esta cru mesmo na pasta de saida (o arquivo irmao, NativeGoogleSignin.js,
// esta compilado normalmente). E esse arquivo que o Metro resolve e que
// quebra o parser do codegen.
//
// Mesmo metodo ja comprovado: requireNativeComponent em vez de
// codegenNativeComponent (nao aciona o plugin de codegen, preserva o
// comportamento real).
//
// Cria: lib/codegen-stubs/SignInButtonNativeComponent.js
// Edita: metro.config.js (adiciona 1 entrada no mapa)
//
// Uso:
//   node fix-google-signin-precise-stub.cjs
//
// Mesmo padrao de seguranca: o trecho antigo do metro.config.js precisa
// aparecer EXATAMENTE 1 vez.

const fs = require('fs');
const path = require('path');

const METRO_CONFIG_PATH = path.join(__dirname, 'metro.config.js');
const STUB_CONTENT = Buffer.from("Ly8gU3Vic3RpdHVpIEByZWFjdC1uYXRpdmUtZ29vZ2xlLXNpZ25pbi9nb29nbGUtc2lnbmluL2xpYi9tb2R1bGUvc3BlYy9TaWduSW5CdXR0b25OYXRpdmVDb21wb25lbnQudHMKLy8gKHZlcnPDo28gMTYuMS4yLCBjb25mZXJpZG8gZGlyZXRhbWVudGUgbm8gcGFjb3RlIGJhaXhhZG8gZG8gbnBtKS4KLy8KLy8gRGV0YWxoZSBjdXJpb3NvIGRlc3NlIHBhY290ZTogYSBwYXN0YSAibGliL21vZHVsZSIgZGV2ZXJpYSBjb250ZXIgc8OzCi8vIEphdmFTY3JpcHQgasOhIGNvbXBpbGFkbyAoc2VtIHRpcG9zKSwgbWFzIGVzc2UgYXJxdWl2byBlc3BlY2lmaWNhbWVudGUKLy8gZmljb3Ugc2VtIGNvbXBpbGFyIG5lc3NhIHZlcnPDo28gZG8gcGFjb3RlIOKAlCBhaW5kYSDDqSBUeXBlU2NyaXB0IGNydQovLyBtZXNtbyBkZW50cm8gZGEgcGFzdGEgZGUgc2HDrWRhIChvIGFycXVpdm8gaXJtw6NvLCBOYXRpdmVHb29nbGVTaWduaW4uanMsCi8vIGVzdMOhIGNvbXBpbGFkbyBub3JtYWxtZW50ZSkuIMOJIGVzc2UgLnRzICJlc3F1ZWNpZG8iIHF1ZSBvIE1ldHJvIHJlc29sdmUKLy8gZSBxdWUgcXVlYnJhIG8gcGFyc2VyIGRvIGNvZGVnZW4uCi8vCi8vIFZlciBsaWIvY29kZWdlbi1zdHVicy9OYXRpdmVTYWZlQXJlYVZpZXcuanMgcGFyYSBvIG1vdGl2byBjb21wbGV0byBkbwovLyB1c28gZGUgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCBlbSB2ZXogZGUgY29kZWdlbk5hdGl2ZUNvbXBvbmVudC4KaW1wb3J0IHsgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCB9IGZyb20gInJlYWN0LW5hdGl2ZSI7CgpleHBvcnQgZGVmYXVsdCByZXF1aXJlTmF0aXZlQ29tcG9uZW50KCJSTkdvb2dsZVNpZ25pbkJ1dHRvbiIpOwo=", 'base64').toString('utf8');

try {
  const stubsDir = path.join(__dirname, 'lib', 'codegen-stubs');
  fs.mkdirSync(stubsDir, { recursive: true });
  const stubPath = path.join(stubsDir, 'SignInButtonNativeComponent.js');
  fs.writeFileSync(stubPath, STUB_CONTENT, 'utf8');
  console.log('✅ lib/codegen-stubs/SignInButtonNativeComponent.js criado.');

  const oldStr = Buffer.from("ICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlLWtleWJvYXJkLWNvbnRyb2xsZXIvc3JjL3NwZWNzL05hdGl2ZVN0YXR1c0Jhck1hbmFnZXJDb21wYXQiLCBzdHViOiBwYXRoLmpvaW4oQ09ERUdFTl9TVFVCU19ESVIsICJOYXRpdmVTdGF0dXNCYXJNYW5hZ2VyQ29tcGF0LmpzIikgfSwKXTs=", 'base64').toString('utf8');
  const newStr = Buffer.from("ICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlLWtleWJvYXJkLWNvbnRyb2xsZXIvc3JjL3NwZWNzL05hdGl2ZVN0YXR1c0Jhck1hbmFnZXJDb21wYXQiLCBzdHViOiBwYXRoLmpvaW4oQ09ERUdFTl9TVFVCU19ESVIsICJOYXRpdmVTdGF0dXNCYXJNYW5hZ2VyQ29tcGF0LmpzIikgfSwKICAvLyBAcmVhY3QtbmF0aXZlLWdvb2dsZS1zaWduaW4vZ29vZ2xlLXNpZ25pbiDigJQgZXNzZSBhcnF1aXZvIGVzcGVjaWZpY2FtZW50ZQogIC8vIGZpY291IHNlbSBjb21waWxhciBuZXNzYSB2ZXJzw6NvIGRvIHBhY290ZSAobyByZXN0byBkbyAibGliL21vZHVsZSIgw6kKICAvLyBKUyBjb21waWxhZG8gbm9ybWFsOyBlc3NlIC50cyAiZXNxdWVjaWRvIiBxdWVicmEgbyBwYXJzZXIgZG8gY29kZWdlbikuCiAgeyBmcmFnOiAiL0ByZWFjdC1uYXRpdmUtZ29vZ2xlLXNpZ25pbi9nb29nbGUtc2lnbmluL2xpYi9tb2R1bGUvc3BlYy9TaWduSW5CdXR0b25OYXRpdmVDb21wb25lbnQiLCBzdHViOiBwYXRoLmpvaW4oQ09ERUdFTl9TVFVCU19ESVIsICJTaWduSW5CdXR0b25OYXRpdmVDb21wb25lbnQuanMiKSB9LApdOw==", 'base64').toString('utf8');
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
  console.log('  3. git add metro.config.js lib/codegen-stubs/SignInButtonNativeComponent.js');
  console.log('  4. git commit -m "fix: stub preciso pro SignInButtonNativeComponent (google-signin)"');
  console.log('  5. git push');
  console.log('  6. rmdir /s /q node_modules');
  console.log('  7. npx pnpm install');
  console.log('  8. git add pnpm-lock.yaml (se mudar) && git commit -m "chore: lockfile" && git push');
  console.log('  9. cd android && gradlew bundleRelease');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
