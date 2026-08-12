// fix-safeareacontext-block-whole-specs-folder.cjs
// QUINTO arquivo com o mesmo erro "Cannot read properties of null (reading
// 'loc')": NativeSafeAreaProvider.ts — irmao do NativeSafeAreaView.ts que
// ja tinha sido bloqueado (mesma pasta "specs/" do pacote
// react-native-safe-area-context).
//
// Com 2 arquivos confirmados quebrando na mesma pasta, este fix bloqueia
// a pasta "specs/" desse pacote INTEIRA de uma vez, em vez de continuar
// descobrindo arquivo por arquivo.
//
// ATENCAO — diferente das pastas "specs_DEPRECATED" (bloqueadas antes),
// que sao codigo legado nao usado pelo app, o react-native-safe-area-
// context E USADO DE VERDADE (SafeAreaView / SafeAreaProvider, evita
// conteudo atras do notch / barra de status). Depois que o build passar,
// e ESSENCIAL testar visualmente no app que as telas continuam
// respeitando as areas seguras do aparelho normalmente (nada cortado
// atras do notch, da barra de status ou da barra de gestos).
//
// Uso:
//   node fix-safeareacontext-block-whole-specs-folder.cjs
//
// Mesmo padrao de seguranca dos scripts anteriores: o trecho antigo
// precisa aparecer EXATAMENTE 1 vez, e a substituicao usa
// content.replace(old, () => new).

const fs = require('fs');
const path = require('path');

const METRO_CONFIG_PATH = path.join(__dirname, 'metro.config.js');

const oldStr = Buffer.from("Y29uc3QgQlJPS0VOX0NPREVHRU5fUEFUSF9GUkFHTUVOVFMgPSBbCiAgIi9yZWFjdC1uYXRpdmUvc3JjL3ByaXZhdGUvY29tcG9uZW50cy92aXJ0dWFsdmlldy8iLAogICIvcmVhY3QtbmF0aXZlLXNhZmUtYXJlYS1jb250ZXh0L3NyYy9zcGVjcy9OYXRpdmVTYWZlQXJlYVZpZXciLA==", 'base64').toString('utf8');
const newStr = Buffer.from("Y29uc3QgQlJPS0VOX0NPREVHRU5fUEFUSF9GUkFHTUVOVFMgPSBbCiAgIi9yZWFjdC1uYXRpdmUvc3JjL3ByaXZhdGUvY29tcG9uZW50cy92aXJ0dWFsdmlldy8iLAogIC8vIErDoSBlcmFtIDIgYXJxdWl2b3MgY29uZmlybWFkb3MgcXVlYnJhbmRvIGRlbnRybyBkYSBtZXNtYSBwYXN0YQogIC8vICJzcGVjcy8iIGRvIHJlYWN0LW5hdGl2ZS1zYWZlLWFyZWEtY29udGV4dCAoTmF0aXZlU2FmZUFyZWFWaWV3LnRzIGUKICAvLyBOYXRpdmVTYWZlQXJlYVByb3ZpZGVyLnRzKSDigJQgbWVzbW8gYnVnIGRlIHBhcnNpbmcgZG8gY29kZWdlbi4gRW0gdmV6CiAgLy8gZGUgY29udGludWFyIGRlc2NvYnJpbmRvIHVtIGFycXVpdm8gcG9yIHZleiwgYmxvcXVlaWEgYSBwYXN0YQogIC8vICJzcGVjcy8iIGludGVpcmEgZGVzc2UgcGFjb3RlIGRlIHVtYSBzw7MgdmV6LiBJTVBPUlRBTlRFOiBkaWZlcmVudGUKICAvLyBkYXMgcGFzdGFzICJzcGVjc19ERVBSRUNBVEVEIiBhYmFpeG8gKHF1ZSBzw6NvIGPDs2RpZ28gbGVnYWRvIG7Do28KICAvLyB1c2FkbyksIGVzdGUgcGFjb3RlIMOpIHVzYWRvIGRlIHZlcmRhZGUgcGVsbyBhcHAgKFNhZmVBcmVhVmlldy8KICAvLyBTYWZlQXJlYVByb3ZpZGVyLCBldml0YSBjb250ZcO6ZG8gYXRyw6FzIGRvIG5vdGNoL2JhcnJhIGRlIHN0YXR1cykg4oCUCiAgLy8gZGVwb2lzIHF1ZSBvIGJ1aWxkIHBhc3Nhciwgw6kgZXNzZW5jaWFsIHRlc3RhciB2aXN1YWxtZW50ZSBxdWUgYSB0ZWxhCiAgLy8gY29udGludWEgcmVzcGVpdGFuZG8gYXMgw6FyZWFzIHNlZ3VyYXMgZG8gYXBhcmVsaG8gbm9ybWFsbWVudGUuCiAgIi9yZWFjdC1uYXRpdmUtc2FmZS1hcmVhLWNvbnRleHQvc3JjL3NwZWNzLyIs", 'base64').toString('utf8');

try {
  if (!fs.existsSync(METRO_CONFIG_PATH)) {
    throw new Error('Arquivo não encontrado: ' + METRO_CONFIG_PATH);
  }
  let content = fs.readFileSync(METRO_CONFIG_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `esperado 1 ocorrência do trecho original, encontrado ${occurrences}. ` +
      `Abortando sem gravar nada.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(METRO_CONFIG_PATH, content, 'utf8');
  console.log('✅ metro.config.js: pasta specs/ do react-native-safe-area-context bloqueada inteira.');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff metro.config.js   (conferir visualmente)');
  console.log('  2. npx esbuild metro.config.js --outfile=nul --format=esm --platform=node');
  console.log('  3. git add metro.config.js');
  console.log('  4. git commit -m "fix: bloqueia pasta specs inteira do react-native-safe-area-context (2o arquivo com mesmo bug de codegen)"');
  console.log('  5. git push');
  console.log('  6. rmdir /s /q node_modules');
  console.log('  7. npx pnpm install');
  console.log('  8. git add pnpm-lock.yaml (se mudar) && git commit -m "chore: lockfile" && git push');
  console.log('  9. cd android && gradlew bundleRelease');
  console.log('  10. IMPORTANTE: depois do build passar, testar no app que as areas seguras (notch, status bar) continuam funcionando normalmente');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
