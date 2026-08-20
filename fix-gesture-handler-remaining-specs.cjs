// fix-gesture-handler-remaining-specs.cjs
// Nono/decimo arquivo com o mesmo bug de parsing do codegen (bug conhecido
// e documentado em NOTAS-BUILD-ANDROID.md — ver esse arquivo pro contexto
// completo). Dessa vez: os 2 arquivos de especificacao RESTANTES do
// react-native-gesture-handler (irmaos do RNGestureHandlerRootViewNativeComponent
// ja corrigido antes):
//   - RNGestureHandlerButtonNativeComponent.ts (componente visual)
//   - NativeRNGestureHandlerModule.ts (TurboModule)
//
// Mesmo metodo documentado: requireNativeComponent/NativeModules em vez de
// codegenNativeComponent/TurboModuleRegistry.
//
// Uso:
//   node fix-gesture-handler-remaining-specs.cjs
//
// Mesmo padrao de seguranca: o trecho antigo do metro.config.js precisa
// aparecer EXATAMENTE 1 vez.

const fs = require('fs');
const path = require('path');

const METRO_CONFIG_PATH = path.join(__dirname, 'metro.config.js');

const STUB_FILES = {
  'lib/codegen-stubs/RNGestureHandlerButtonNativeComponent.js': Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1nZXN0dXJlLWhhbmRsZXIvc3JjL3NwZWNzL1JOR2VzdHVyZUhhbmRsZXJCdXR0b25OYXRpdmVDb21wb25lbnQudHMKLy8gKHZlcnPDo28gMi4yOC4wLCBjb25mZXJpZG8gZGlyZXRhbWVudGUgbm8gcGFjb3RlIGJhaXhhZG8gZG8gbnBtKS4KLy8gVmVyIGxpYi9jb2RlZ2VuLXN0dWJzL05hdGl2ZVNhZmVBcmVhVmlldy5qcyBwYXJhIG8gbW90aXZvIGNvbXBsZXRvIGRvCi8vIHVzbyBkZSByZXF1aXJlTmF0aXZlQ29tcG9uZW50IGVtIHZleiBkZSBjb2RlZ2VuTmF0aXZlQ29tcG9uZW50LgppbXBvcnQgeyByZXF1aXJlTmF0aXZlQ29tcG9uZW50IH0gZnJvbSAicmVhY3QtbmF0aXZlIjsKCmV4cG9ydCBkZWZhdWx0IHJlcXVpcmVOYXRpdmVDb21wb25lbnQoIlJOR2VzdHVyZUhhbmRsZXJCdXR0b24iKTsK", 'base64').toString('utf8'),
  'lib/codegen-stubs/NativeRNGestureHandlerModule.js': Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1nZXN0dXJlLWhhbmRsZXIvc3JjL3NwZWNzL05hdGl2ZVJOR2VzdHVyZUhhbmRsZXJNb2R1bGUudHMKLy8gKHZlcnPDo28gMi4yOC4wLCBjb25mZXJpZG8gZGlyZXRhbWVudGUgbm8gcGFjb3RlIGJhaXhhZG8gZG8gbnBtKS4gw4kgdW0KLy8gVHVyYm9Nb2R1bGUgKG7Do28gdW0gY29tcG9uZW50ZSB2aXN1YWwpLiBWZXIKLy8gbGliL2NvZGVnZW4tc3R1YnMvTmF0aXZlU2FmZUFyZWFDb250ZXh0LmpzIChtZXNtbyBwYWRyw6NvKSBwYXJhIG8gbW90aXZvCi8vIGNvbXBsZXRvIGRvIHVzbyBkZSBOYXRpdmVNb2R1bGVzIGVtIHZleiBkZSBUdXJib01vZHVsZVJlZ2lzdHJ5LgppbXBvcnQgeyBOYXRpdmVNb2R1bGVzIH0gZnJvbSAicmVhY3QtbmF0aXZlIjsKCmV4cG9ydCBkZWZhdWx0IE5hdGl2ZU1vZHVsZXMuUk5HZXN0dXJlSGFuZGxlck1vZHVsZTsK", 'base64').toString('utf8'),
};

try {
  const stubsDir = path.join(__dirname, 'lib', 'codegen-stubs');
  fs.mkdirSync(stubsDir, { recursive: true });
  for (const [relPath, content] of Object.entries(STUB_FILES)) {
    fs.writeFileSync(path.join(__dirname, relPath), content, 'utf8');
    console.log(`✅ ${relPath} criado.`);
  }

  const oldStr = Buffer.from("ICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlLXZpZXctc2hvdC9zcmMvUk5WaWV3U2hvdC5qcyIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIlJOVmlld1Nob3QuanMiKSB9LApdOw==", 'base64').toString('utf8');
  const newStr = Buffer.from("ICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlLXZpZXctc2hvdC9zcmMvUk5WaWV3U2hvdC5qcyIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIlJOVmlld1Nob3QuanMiKSB9LAogIC8vIHJlYWN0LW5hdGl2ZS1nZXN0dXJlLWhhbmRsZXIg4oCUIDIgYXJxdWl2b3MgZGUgc3BlYyByZXN0YW50ZXMgKGlybcOjb3MgZG8KICAvLyBSTkdlc3R1cmVIYW5kbGVyUm9vdFZpZXdOYXRpdmVDb21wb25lbnQgasOhIGNvcnJpZ2lkbyBhY2ltYSkuCiAgeyBmcmFnOiAiL3JlYWN0LW5hdGl2ZS1nZXN0dXJlLWhhbmRsZXIvc3JjL3NwZWNzL1JOR2VzdHVyZUhhbmRsZXJCdXR0b25OYXRpdmVDb21wb25lbnQiLCBzdHViOiBwYXRoLmpvaW4oQ09ERUdFTl9TVFVCU19ESVIsICJSTkdlc3R1cmVIYW5kbGVyQnV0dG9uTmF0aXZlQ29tcG9uZW50LmpzIikgfSwKICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlLWdlc3R1cmUtaGFuZGxlci9zcmMvc3BlY3MvTmF0aXZlUk5HZXN0dXJlSGFuZGxlck1vZHVsZSIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIk5hdGl2ZVJOR2VzdHVyZUhhbmRsZXJNb2R1bGUuanMiKSB9LApdOw==", 'base64').toString('utf8');
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
  console.log('  1. git status');
  console.log('  2. git diff metro.config.js   (conferir visualmente)');
  console.log('  3. git add metro.config.js lib/codegen-stubs/');
  console.log('  4. git commit -m "fix: stubs precisos pros 2 arquivos de specs restantes do gesture-handler"');
  console.log('  5. git push');
  console.log('  6. cd android && gradlew --stop && cd ..');
  console.log('  7. rmdir /s /q node_modules');
  console.log('  8. npx pnpm install');
  console.log('  9. git add pnpm-lock.yaml (se mudar) && git commit -m "chore: lockfile" && git push');
  console.log('  10. cd android && gradlew bundleRelease');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
