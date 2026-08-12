// fix-codegen-stubs-v2-avoid-plugin-detection.cjs
// A v1 dos stubs precisos (NativeSafeAreaView.js, NativeSafeAreaProvider.js,
// NativeSafeAreaContext.js, RNGestureHandlerRootViewNativeComponent.js)
// usava codegenNativeComponent(...)/TurboModuleRegistry.get(...) sem os
// tipos do TypeScript — mas isso AINDA disparava o
// @react-native/babel-plugin-codegen (ele detecta essas CHAMADAS em
// qualquer arquivo, não só dentro de node_modules), e sem os tipos ele
// falhava com um erro diferente: "Could not find component config for
// native component".
//
// Confirmado direto no codigo-fonte do plugin (@react-native/babel-plugin-
// codegen, funcao isCodegenDeclaration): ele so verifica se a chamada se
// chama literalmente "codegenNativeComponent" ou "codegenNativeCommands" —
// nao ha nenhuma mencao a TurboModuleRegistry, requireNativeComponent ou
// NativeModules em lugar nenhum do arquivo.
//
// v2: troca para requireNativeComponent (componentes nativos) e
// NativeModules (modulo nativo) — o mecanismo "classico" do React Native,
// que nao aciona esse plugin de jeito nenhum, e continua funcionando
// normalmente (busca o componente/modulo nativo JA REGISTRADO durante o
// build nativo, pelo nome, em qualquer arquitetura).
//
// Uso:
//   node fix-codegen-stubs-v2-avoid-plugin-detection.cjs
//
// PRE-REQUISITO: espera que fix-precise-codegen-stubs.cjs (a v1) ja tenha
// sido aplicado antes (os 4 arquivos precisam existir com o conteudo v1).
// Se um arquivo nao tiver o marcador esperado, o script aborta sem
// sobrescrever nada.

const fs = require('fs');
const path = require('path');

const FILES = {
  "lib/codegen-stubs/NativeSafeAreaView.js": { marker: "codegenNativeComponent", content: Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1zYWZlLWFyZWEtY29udGV4dC9zcmMvc3BlY3MvTmF0aXZlU2FmZUFyZWFWaWV3LnRzCi8vCi8vIHYyOiBhIHYxICh1c2FuZG8gY29kZWdlbk5hdGl2ZUNvbXBvbmVudCBzZW0gb3MgdGlwb3MgZG8gVFMpIGFpbmRhCi8vIGRpc3BhcmF2YSBvIEByZWFjdC1uYXRpdmUvYmFiZWwtcGx1Z2luLWNvZGVnZW4gKGVsZSBkZXRlY3RhIGEgQ0hBTUFEQQovLyBjb2RlZ2VuTmF0aXZlQ29tcG9uZW50IGVtIHF1YWxxdWVyIGFycXVpdm8sIG7Do28gc8OzIGRlbnRybyBkZSBwYXN0YXMKLy8gZXNwZWPDrWZpY2FzKSBlIGZhbGhhdmEgY29tICJDb3VsZCBub3QgZmluZCBjb21wb25lbnQgY29uZmlnIGZvciBuYXRpdmUKLy8gY29tcG9uZW50IiBwb3IgZmFsdGFyIGEgaW5mb3JtYcOnw6NvIGRlIHRpcG9zIHF1ZSBvIGNvZGVnZW4gcHJlY2lzYSBwcmEKLy8gbW9udGFyIG8gc2NoZW1hLgovLwovLyBFc3RhIHZlcnPDo28gdXNhIHJlcXVpcmVOYXRpdmVDb21wb25lbnQg4oCUIG8gbWVjYW5pc21vICJjbMOhc3NpY28iIGRvIFJlYWN0Ci8vIE5hdGl2ZSBwcmEgb2J0ZXIgdW0gY29tcG9uZW50ZSBuYXRpdm8gcGVsbyBub21lLiBOw6NvIGFjaW9uYSBvIHBsdWdpbiBkZQovLyBjb2RlZ2VuICjDqSB1bWEgZnVuw6fDo28gZGlmZXJlbnRlLCBzZW0gcmVsYcOnw6NvIGNvbSBnZXJhw6fDo28gZGUgc2NoZW1hKSBlCi8vIGNvbnRpbnVhIGZ1bmNpb25hbmRvIG5vcm1hbG1lbnRlOiBvIGNvbXBvbmVudGUgbmF0aXZvIHJlYWwgKCJSTkNTYWZlQXJlYVZpZXciKQovLyBqw6EgZm9pIHJlZ2lzdHJhZG8gZGUgdmVyZGFkZSBkdXJhbnRlIG8gYnVpbGQgbmF0aXZvIChHcmFkbGUvQ01ha2UpLAovLyBpbmRlcGVuZGVudGUgZG8gZW1wYWNvdGFtZW50byBkbyBNZXRybyDigJQgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCBzw7MKLy8gYnVzY2EgZXNzZSBjb21wb25lbnRlIGrDoSByZWdpc3RyYWRvIHBlbG8gbm9tZSwgZW0gcXVhbHF1ZXIgYXJxdWl0ZXR1cmEKLy8gKGFudGlnYSBvdSBub3ZhL0ZhYnJpYykuCmltcG9ydCB7IHJlcXVpcmVOYXRpdmVDb21wb25lbnQgfSBmcm9tICJyZWFjdC1uYXRpdmUiOwoKZXhwb3J0IGRlZmF1bHQgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCgiUk5DU2FmZUFyZWFWaWV3Iik7Cg==", 'base64').toString('utf8') },
  "lib/codegen-stubs/NativeSafeAreaProvider.js": { marker: "codegenNativeComponent", content: Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1zYWZlLWFyZWEtY29udGV4dC9zcmMvc3BlY3MvTmF0aXZlU2FmZUFyZWFQcm92aWRlci50cwovLyB2MiDigJQgdmVyIE5hdGl2ZVNhZmVBcmVhVmlldy5qcyAobWVzbWEgcGFzdGEpIHBhcmEgbyBtb3Rpdm8gY29tcGxldG8gZGEKLy8gdHJvY2EgZGUgY29kZWdlbk5hdGl2ZUNvbXBvbmVudCBwYXJhIHJlcXVpcmVOYXRpdmVDb21wb25lbnQuCmltcG9ydCB7IHJlcXVpcmVOYXRpdmVDb21wb25lbnQgfSBmcm9tICJyZWFjdC1uYXRpdmUiOwoKZXhwb3J0IGRlZmF1bHQgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCgiUk5DU2FmZUFyZWFQcm92aWRlciIpOwo=", 'base64').toString('utf8') },
  "lib/codegen-stubs/NativeSafeAreaContext.js": { marker: "TurboModuleRegistry", content: Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1zYWZlLWFyZWEtY29udGV4dC9zcmMvc3BlY3MvTmF0aXZlU2FmZUFyZWFDb250ZXh0LnRzCi8vCi8vIHYyOiBhIHYxIHVzYXZhIFR1cmJvTW9kdWxlUmVnaXN0cnkuZ2V0KC4uLiksIHF1ZSB0YW1iw6ltIMOpIGRldGVjdGFkbyBwZWxvCi8vIG1lc21vIHBsdWdpbiBkZSBjb2RlZ2VuIChtZXNtYSBmYW3DrWxpYSBkZSBwcm9ibGVtYSBkbyBOYXRpdmVTYWZlQXJlYVZpZXcpLgovLyBFc3RhIHZlcnPDo28gdXNhIE5hdGl2ZU1vZHVsZXMg4oCUIG8gbWVjYW5pc21vICJjbMOhc3NpY28iIGRvIFJlYWN0IE5hdGl2ZQovLyBwcmEgYWNlc3NhciB1bSBtw7NkdWxvIG5hdGl2byBwZWxvIG5vbWUuIE7Do28gYWNpb25hIG8gcGx1Z2luIGRlIGNvZGVnZW4uCi8vIE8gcHLDs3ByaW8gUmVhY3QgTmF0aXZlIGZheiBhIHBvbnRlIGF1dG9tYXRpY2FtZW50ZSBwYXJhIG8gVHVyYm9Nb2R1bGUKLy8gcmVhbCByZWdpc3RyYWRvICgiUk5DU2FmZUFyZWFDb250ZXh0IiksIGVtIHF1YWxxdWVyIGFycXVpdGV0dXJhLgppbXBvcnQgeyBOYXRpdmVNb2R1bGVzIH0gZnJvbSAicmVhY3QtbmF0aXZlIjsKCmV4cG9ydCBkZWZhdWx0IE5hdGl2ZU1vZHVsZXMuUk5DU2FmZUFyZWFDb250ZXh0Owo=", 'base64').toString('utf8') },
  "lib/codegen-stubs/RNGestureHandlerRootViewNativeComponent.js": { marker: "codegenNativeComponent", content: Buffer.from("Ly8gU3Vic3RpdHVpIHJlYWN0LW5hdGl2ZS1nZXN0dXJlLWhhbmRsZXIvc3JjL3NwZWNzLwovLyBSTkdlc3R1cmVIYW5kbGVyUm9vdFZpZXdOYXRpdmVDb21wb25lbnQudHMKLy8KLy8gdjIg4oCUIHZlciBOYXRpdmVTYWZlQXJlYVZpZXcuanMgKHJlYWN0LW5hdGl2ZS1zYWZlLWFyZWEtY29udGV4dCkgcGFyYSBvCi8vIG1vdGl2byBjb21wbGV0byBkYSB0cm9jYSBkZSBjb2RlZ2VuTmF0aXZlQ29tcG9uZW50IHBhcmEKLy8gcmVxdWlyZU5hdGl2ZUNvbXBvbmVudC4gRXN0ZSDDqSBvIGNvbXBvbmVudGUgcmFpeiBxdWUgZW52b2x2ZSBvIGFwcAovLyBpbnRlaXJvIChHZXN0dXJlSGFuZGxlclJvb3RWaWV3KSDigJQgcG9yIGlzc28gYSBhdGVuw6fDo28gZXh0cmEgZW0gbWFudGVyCi8vIG8gY29tcG9ydGFtZW50byBpZ3VhbCBhbyBvcmlnaW5hbC4KaW1wb3J0IHsgcmVxdWlyZU5hdGl2ZUNvbXBvbmVudCB9IGZyb20gInJlYWN0LW5hdGl2ZSI7CgpleHBvcnQgZGVmYXVsdCByZXF1aXJlTmF0aXZlQ29tcG9uZW50KCJSTkdlc3R1cmVIYW5kbGVyUm9vdFZpZXciKTsK", 'base64').toString('utf8') },
};

try {
  for (const [relPath, { marker, content }] of Object.entries(FILES)) {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo não encontrado: ${relPath} — aplique fix-precise-codegen-stubs.cjs primeiro.`);
    }
    const current = fs.readFileSync(fullPath, 'utf8');
    if (!current.includes(marker)) {
      throw new Error(`"${relPath}" não contém o marcador esperado ("${marker}") — pode já ter sido atualizado, ou o conteúdo é diferente do esperado. Abortando sem sobrescrever.`);
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ ${relPath} atualizado para v2 (requireNativeComponent/NativeModules).`);
  }
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff lib/codegen-stubs/   (conferir visualmente)');
  console.log('  2. git add lib/codegen-stubs/');
  console.log('  3. git commit -m "fix: stubs v2 usando requireNativeComponent/NativeModules (evita plugin de codegen de vez)"');
  console.log('  4. git push');
  console.log('  5. rmdir /s /q node_modules');
  console.log('  6. npx pnpm install');
  console.log('  7. git add pnpm-lock.yaml (se mudar) && git commit -m "chore: lockfile" && git push');
  console.log('  8. cd android && gradlew bundleRelease');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
