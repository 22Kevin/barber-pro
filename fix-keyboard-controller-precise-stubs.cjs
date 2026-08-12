// fix-keyboard-controller-precise-stubs.cjs
// Setimo arquivo com o mesmo bug de parsing do codegen ("Cannot read
// properties of null (reading 'loc')"), dessa vez em
// react-native-keyboard-controller/src/specs/KeyboardControllerViewNativeComponent.ts.
//
// Esse pacote tem 7 arquivos de especificação de codegen ao todo — em vez
// de descobrir um por um (cada rodada de build levando 15-30 minutos),
// este fix adianta os 7 de uma vez, usando o mesmo metodo precisado ja
// comprovado (requireNativeComponent/NativeModules em vez de
// codegenNativeComponent/TurboModuleRegistry — nao aciona o plugin de
// codegen, preserva o comportamento real).
//
// Classificacao dos 7 arquivos (conferido diretamente no pacote 1.18.5
// baixado do npm):
//   5 componentes visuais (requireNativeComponent):
//     KeyboardBackgroundViewNativeComponent, KeyboardControllerViewNativeComponent,
//     KeyboardExtenderNativeComponent (so existe no iOS, excluido no
//     Android no original), KeyboardGestureAreaNativeComponent,
//     OverKeyboardViewNativeComponent
//   2 TurboModules (NativeModules):
//     NativeKeyboardController, NativeStatusBarManagerCompat
//
// Cria os 7 stubs em lib/codegen-stubs/ e adiciona as 7 entradas no mapa
// do metro.config.js.
//
// Uso:
//   node fix-keyboard-controller-precise-stubs.cjs
//
// Mesmo padrao de seguranca: o trecho antigo do metro.config.js precisa
// aparecer EXATAMENTE 1 vez.

const fs = require('fs');
const path = require('path');

const METRO_CONFIG_PATH = path.join(__dirname, 'metro.config.js');

const STUB_FILES = {
  "lib/codegen-stubs/KeyboardBackgroundViewNativeComponent.js": Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1rZXlib2FyZC1jb250cm9sbGVyL3NyYy9zcGVjcy9LZXlib2FyZEJhY2tncm91bmRWaWV3TmF0aXZlQ29tcG9uZW50LnRzCi8vICh2ZXJzw6NvIDEuMTguNSwgY29uZmVyaWRvIGRpcmV0YW1lbnRlIG5vIHBhY290ZSBiYWl4YWRvIGRvIG5wbSkuCi8vIFZlciBsaWIvY29kZWdlbi1zdHVicy9OYXRpdmVTYWZlQXJlYVZpZXcuanMgcGFyYSBvIG1vdGl2byBjb21wbGV0byBkbwovLyB1c28gZGUgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCBlbSB2ZXogZGUgY29kZWdlbk5hdGl2ZUNvbXBvbmVudC4KaW1wb3J0IHsgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCB9IGZyb20gInJlYWN0LW5hdGl2ZSI7CgpleHBvcnQgZGVmYXVsdCByZXF1aXJlTmF0aXZlQ29tcG9uZW50KCJLZXlib2FyZEJhY2tncm91bmRWaWV3Iik7Cg==", 'base64').toString('utf8'),
  "lib/codegen-stubs/KeyboardControllerViewNativeComponent.js": Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1rZXlib2FyZC1jb250cm9sbGVyL3NyYy9zcGVjcy9LZXlib2FyZENvbnRyb2xsZXJWaWV3TmF0aXZlQ29tcG9uZW50LnRzCi8vICh2ZXJzw6NvIDEuMTguNSwgY29uZmVyaWRvIGRpcmV0YW1lbnRlIG5vIHBhY290ZSBiYWl4YWRvIGRvIG5wbSkuCi8vIFZlciBsaWIvY29kZWdlbi1zdHVicy9OYXRpdmVTYWZlQXJlYVZpZXcuanMgcGFyYSBvIG1vdGl2byBjb21wbGV0byBkbwovLyB1c28gZGUgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCBlbSB2ZXogZGUgY29kZWdlbk5hdGl2ZUNvbXBvbmVudC4KaW1wb3J0IHsgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCB9IGZyb20gInJlYWN0LW5hdGl2ZSI7CgpleHBvcnQgZGVmYXVsdCByZXF1aXJlTmF0aXZlQ29tcG9uZW50KCJLZXlib2FyZENvbnRyb2xsZXJWaWV3Iik7Cg==", 'base64').toString('utf8'),
  "lib/codegen-stubs/KeyboardExtenderNativeComponent.js": Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1rZXlib2FyZC1jb250cm9sbGVyL3NyYy9zcGVjcy9LZXlib2FyZEV4dGVuZGVyTmF0aXZlQ29tcG9uZW50LnRzCi8vICh2ZXJzw6NvIDEuMTguNSwgY29uZmVyaWRvIGRpcmV0YW1lbnRlIG5vIHBhY290ZSBiYWl4YWRvIGRvIG5wbSkuIE5vCi8vIG9yaWdpbmFsIGVzc2UgY29tcG9uZW50ZSDDqSBleGNsdcOtZG8gbm8gQW5kcm9pZCAoZXhjbHVkZWRQbGF0Zm9ybXM6Ci8vIFsiYW5kcm9pZCJdKSDigJQgc8OzIGV4aXN0ZSBubyBpT1MuIFZlciBsaWIvY29kZWdlbi1zdHVicy9OYXRpdmVTYWZlQXJlYVZpZXcuanMKLy8gcGFyYSBvIG1vdGl2byBjb21wbGV0byBkbyB1c28gZGUgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudC4KaW1wb3J0IHsgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCB9IGZyb20gInJlYWN0LW5hdGl2ZSI7CgpleHBvcnQgZGVmYXVsdCByZXF1aXJlTmF0aXZlQ29tcG9uZW50KCJLZXlib2FyZEV4dGVuZGVyIik7Cg==", 'base64').toString('utf8'),
  "lib/codegen-stubs/KeyboardGestureAreaNativeComponent.js": Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1rZXlib2FyZC1jb250cm9sbGVyL3NyYy9zcGVjcy9LZXlib2FyZEdlc3R1cmVBcmVhTmF0aXZlQ29tcG9uZW50LnRzCi8vICh2ZXJzw6NvIDEuMTguNSwgY29uZmVyaWRvIGRpcmV0YW1lbnRlIG5vIHBhY290ZSBiYWl4YWRvIGRvIG5wbSkuCi8vIFZlciBsaWIvY29kZWdlbi1zdHVicy9OYXRpdmVTYWZlQXJlYVZpZXcuanMgcGFyYSBvIG1vdGl2byBjb21wbGV0byBkbwovLyB1c28gZGUgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCBlbSB2ZXogZGUgY29kZWdlbk5hdGl2ZUNvbXBvbmVudC4KaW1wb3J0IHsgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCB9IGZyb20gInJlYWN0LW5hdGl2ZSI7CgpleHBvcnQgZGVmYXVsdCByZXF1aXJlTmF0aXZlQ29tcG9uZW50KCJLZXlib2FyZEdlc3R1cmVBcmVhIik7Cg==", 'base64').toString('utf8'),
  "lib/codegen-stubs/OverKeyboardViewNativeComponent.js": Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1rZXlib2FyZC1jb250cm9sbGVyL3NyYy9zcGVjcy9PdmVyS2V5Ym9hcmRWaWV3TmF0aXZlQ29tcG9uZW50LnRzCi8vICh2ZXJzw6NvIDEuMTguNSwgY29uZmVyaWRvIGRpcmV0YW1lbnRlIG5vIHBhY290ZSBiYWl4YWRvIGRvIG5wbSkuCi8vIFZlciBsaWIvY29kZWdlbi1zdHVicy9OYXRpdmVTYWZlQXJlYVZpZXcuanMgcGFyYSBvIG1vdGl2byBjb21wbGV0byBkbwovLyB1c28gZGUgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCBlbSB2ZXogZGUgY29kZWdlbk5hdGl2ZUNvbXBvbmVudC4KaW1wb3J0IHsgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCB9IGZyb20gInJlYWN0LW5hdGl2ZSI7CgpleHBvcnQgZGVmYXVsdCByZXF1aXJlTmF0aXZlQ29tcG9uZW50KCJPdmVyS2V5Ym9hcmRWaWV3Iik7Cg==", 'base64').toString('utf8'),
  "lib/codegen-stubs/NativeKeyboardController.js": Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1rZXlib2FyZC1jb250cm9sbGVyL3NyYy9zcGVjcy9OYXRpdmVLZXlib2FyZENvbnRyb2xsZXIudHMKLy8gKHZlcnPDo28gMS4xOC41LCBjb25mZXJpZG8gZGlyZXRhbWVudGUgbm8gcGFjb3RlIGJhaXhhZG8gZG8gbnBtKS4gw4kgdW0KLy8gVHVyYm9Nb2R1bGUgKG7Do28gdW0gY29tcG9uZW50ZSB2aXN1YWwpLiBWZXIKLy8gbGliL2NvZGVnZW4tc3R1YnMvTmF0aXZlU2FmZUFyZWFDb250ZXh0LmpzIChtZXNtbyBwYWRyw6NvKSBwYXJhIG8gbW90aXZvCi8vIGNvbXBsZXRvIGRvIHVzbyBkZSBOYXRpdmVNb2R1bGVzIGVtIHZleiBkZSBUdXJib01vZHVsZVJlZ2lzdHJ5LgppbXBvcnQgeyBOYXRpdmVNb2R1bGVzIH0gZnJvbSAicmVhY3QtbmF0aXZlIjsKCmV4cG9ydCBkZWZhdWx0IE5hdGl2ZU1vZHVsZXMuS2V5Ym9hcmRDb250cm9sbGVyOwo=", 'base64').toString('utf8'),
  "lib/codegen-stubs/NativeStatusBarManagerCompat.js": Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1rZXlib2FyZC1jb250cm9sbGVyL3NyYy9zcGVjcy9OYXRpdmVTdGF0dXNCYXJNYW5hZ2VyQ29tcGF0LnRzCi8vICh2ZXJzw6NvIDEuMTguNSwgY29uZmVyaWRvIGRpcmV0YW1lbnRlIG5vIHBhY290ZSBiYWl4YWRvIGRvIG5wbSkuIMOJIHVtCi8vIFR1cmJvTW9kdWxlIChuw6NvIHVtIGNvbXBvbmVudGUgdmlzdWFsKS4gVmVyCi8vIGxpYi9jb2RlZ2VuLXN0dWJzL05hdGl2ZVNhZmVBcmVhQ29udGV4dC5qcyAobWVzbW8gcGFkcsOjbykgcGFyYSBvIG1vdGl2bwovLyBjb21wbGV0byBkbyB1c28gZGUgTmF0aXZlTW9kdWxlcyBlbSB2ZXogZGUgVHVyYm9Nb2R1bGVSZWdpc3RyeS4KaW1wb3J0IHsgTmF0aXZlTW9kdWxlcyB9IGZyb20gInJlYWN0LW5hdGl2ZSI7CgpleHBvcnQgZGVmYXVsdCBOYXRpdmVNb2R1bGVzLlN0YXR1c0Jhck1hbmFnZXJDb21wYXQ7Cg==", 'base64').toString('utf8'),
};

try {
  const stubsDir = path.join(__dirname, 'lib', 'codegen-stubs');
  fs.mkdirSync(stubsDir, { recursive: true });
  for (const [relPath, content] of Object.entries(STUB_FILES)) {
    fs.writeFileSync(path.join(__dirname, relPath), content, 'utf8');
    console.log(`✅ ${relPath} criado.`);
  }

  const oldStr = Buffer.from("ICAvLyByZWFjdC1uYXRpdmUtZ2VzdHVyZS1oYW5kbGVyIOKAlCBHZXN0dXJlSGFuZGxlclJvb3RWaWV3IGVudm9sdmUgbyBhcHAKICAvLyBpbnRlaXJvLCDDqSBlc3NlbmNpYWwgcHJvIFJlYWN0IE5hdmlnYXRpb24vRXhwbyBSb3V0ZXIgZnVuY2lvbmFyLgogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUtZ2VzdHVyZS1oYW5kbGVyL3NyYy9zcGVjcy9STkdlc3R1cmVIYW5kbGVyUm9vdFZpZXdOYXRpdmVDb21wb25lbnQiLCBzdHViOiBwYXRoLmpvaW4oQ09ERUdFTl9TVFVCU19ESVIsICJSTkdlc3R1cmVIYW5kbGVyUm9vdFZpZXdOYXRpdmVDb21wb25lbnQuanMiKSB9LApdOw==", 'base64').toString('utf8');
  const newStr = Buffer.from("ICAvLyByZWFjdC1uYXRpdmUtZ2VzdHVyZS1oYW5kbGVyIOKAlCBHZXN0dXJlSGFuZGxlclJvb3RWaWV3IGVudm9sdmUgbyBhcHAKICAvLyBpbnRlaXJvLCDDqSBlc3NlbmNpYWwgcHJvIFJlYWN0IE5hdmlnYXRpb24vRXhwbyBSb3V0ZXIgZnVuY2lvbmFyLgogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUtZ2VzdHVyZS1oYW5kbGVyL3NyYy9zcGVjcy9STkdlc3R1cmVIYW5kbGVyUm9vdFZpZXdOYXRpdmVDb21wb25lbnQiLCBzdHViOiBwYXRoLmpvaW4oQ09ERUdFTl9TVFVCU19ESVIsICJSTkdlc3R1cmVIYW5kbGVyUm9vdFZpZXdOYXRpdmVDb21wb25lbnQuanMiKSB9LAogIC8vIHJlYWN0LW5hdGl2ZS1rZXlib2FyZC1jb250cm9sbGVyIOKAlCB0ZW0gNyBhcnF1aXZvcyBkZSBlc3BlY2lmaWNhw6fDo28gZGUKICAvLyBjb2RlZ2VuIGFvIHRvZG87IGFkaWFudGFuZG8gb3MgNyBkZSB1bWEgdmV6IChlbSB2ZXogZGUgZGVzY29icmlyIHVtCiAgLy8gcG9yIHVtLCBjYWRhIHJvZGFkYSBkZSBidWlsZCBsZXZhbmRvIDE1LTMwbWluKSBqw6EgcXVlIG8gcGFkcsOjbyBkbyBidWcKICAvLyAoYWZldGEgcGFzdGFzICJzcGVjcy8iIGludGVpcmFzKSBqw6EgZXN0w6EgYmVtIGVzdGFiZWxlY2lkbyBhIGVzc2EgYWx0dXJhLgogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUta2V5Ym9hcmQtY29udHJvbGxlci9zcmMvc3BlY3MvS2V5Ym9hcmRCYWNrZ3JvdW5kVmlld05hdGl2ZUNvbXBvbmVudCIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIktleWJvYXJkQmFja2dyb3VuZFZpZXdOYXRpdmVDb21wb25lbnQuanMiKSB9LAogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUta2V5Ym9hcmQtY29udHJvbGxlci9zcmMvc3BlY3MvS2V5Ym9hcmRDb250cm9sbGVyVmlld05hdGl2ZUNvbXBvbmVudCIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIktleWJvYXJkQ29udHJvbGxlclZpZXdOYXRpdmVDb21wb25lbnQuanMiKSB9LAogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUta2V5Ym9hcmQtY29udHJvbGxlci9zcmMvc3BlY3MvS2V5Ym9hcmRFeHRlbmRlck5hdGl2ZUNvbXBvbmVudCIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIktleWJvYXJkRXh0ZW5kZXJOYXRpdmVDb21wb25lbnQuanMiKSB9LAogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUta2V5Ym9hcmQtY29udHJvbGxlci9zcmMvc3BlY3MvS2V5Ym9hcmRHZXN0dXJlQXJlYU5hdGl2ZUNvbXBvbmVudCIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIktleWJvYXJkR2VzdHVyZUFyZWFOYXRpdmVDb21wb25lbnQuanMiKSB9LAogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUta2V5Ym9hcmQtY29udHJvbGxlci9zcmMvc3BlY3MvT3ZlcktleWJvYXJkVmlld05hdGl2ZUNvbXBvbmVudCIsIHN0dWI6IHBhdGguam9pbihDT0RFR0VOX1NUVUJTX0RJUiwgIk92ZXJLZXlib2FyZFZpZXdOYXRpdmVDb21wb25lbnQuanMiKSB9LAogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUta2V5Ym9hcmQtY29udHJvbGxlci9zcmMvc3BlY3MvTmF0aXZlS2V5Ym9hcmRDb250cm9sbGVyIiwgc3R1YjogcGF0aC5qb2luKENPREVHRU5fU1RVQlNfRElSLCAiTmF0aXZlS2V5Ym9hcmRDb250cm9sbGVyLmpzIikgfSwKICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlLWtleWJvYXJkLWNvbnRyb2xsZXIvc3JjL3NwZWNzL05hdGl2ZVN0YXR1c0Jhck1hbmFnZXJDb21wYXQiLCBzdHViOiBwYXRoLmpvaW4oQ09ERUdFTl9TVFVCU19ESVIsICJOYXRpdmVTdGF0dXNCYXJNYW5hZ2VyQ29tcGF0LmpzIikgfSwKXTs=", 'base64').toString('utf8');
  let content = fs.readFileSync(METRO_CONFIG_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `metro.config.js: esperado 1 ocorrência do trecho original, encontrado ${occurrences}. Abortando sem gravar nada.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(METRO_CONFIG_PATH, content, 'utf8');
  console.log('✅ metro.config.js atualizado com as 7 novas entradas.');

  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git status   (deve mostrar metro.config.js + 7 arquivos novos em lib/codegen-stubs/)');
  console.log('  2. git diff metro.config.js   (conferir visualmente)');
  console.log('  3. git add metro.config.js lib/codegen-stubs/');
  console.log('  4. git commit -m "fix: stubs precisos pros 7 arquivos de specs do react-native-keyboard-controller"');
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
