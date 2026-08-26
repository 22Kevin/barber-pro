// fix-root-cause-specs-deprecated-overblock.cjs
// A CAUSA RAIZ REAL do crash "TypeError: undefined is not a function" que
// derrubava o app inteiro ao abrir (versionCode 12/13). Nao era bug do
// React Native, nem da New Architecture — era um erro NOSSO, de uma
// correcao anterior nesta mesma sessao.
//
// O QUE ACONTECEU: pra resolver um crash de BUILD ("Cannot read properties
// of null (reading 'loc')") em 2 arquivos especificos dentro da pasta
// "react-native/src/private/specs_DEPRECATED/" (AndroidDrawerLayoutNativeComponent
// e RCTInputAccessoryViewNativeComponent — confirmados como genuinamente
// nao usados pelo app), uma correcao anterior generalizou demais e passou
// a bloquear a pasta "specs_DEPRECATED" INTEIRA, redirecionando qualquer
// arquivo dela pra um stub vazio.
//
// O problema: essa pasta tem 62 arquivos, e a MAIORIA sao modulos centrais
// do proprio React Native, ATIVAMENTE usados o tempo todo — NativeAppState,
// NativeClipboard, NativeLinkingManager, NativePlatformConstantsAndroid,
// NativeTiming, NativeUIManager, NativeVibration, NativeDeviceInfo, e
// varios outros. "specs_DEPRECATED" no nome se refere ao ESTILO antigo da
// API (Meta pretende migrar isso no futuro), NAO significa "sem uso".
//
// Confirmado, passo a passo: Dimensions.js importa de
// "./NativeDeviceInfo" (arquivo real, sem problema) — que por dentro
// reexporta de ".../specs_DEPRECATED/modules/NativeDeviceInfo" — import
// que a REGRA ANTERIOR interceptava e redirecionava pro stub vazio ({}) —
// fazendo com que NativeDeviceInfo virasse um objeto vazio, e
// "{}.getConstants()" (dentro do Dimensions.js) desse exatamente
// "TypeError: undefined is not a function", travando o app IMEDIATAMENTE
// ao abrir, sempre, pra todo usuario.
//
// A CORRECAO: volta a bloquear so os 2 arquivos ESPECIFICOS que realmente
// causavam o crash de build (nao a pasta inteira). Os outros 60 arquivos
// (incluindo NativeDeviceInfo) voltam a resolver normalmente pro conteudo
// real deles.
//
// Uso:
//   node fix-root-cause-specs-deprecated-overblock.cjs
//
// Mesmo padrao de seguranca: o trecho antigo precisa aparecer EXATAMENTE
// 1 vez.

const fs = require('fs');
const path = require('path');

const METRO_CONFIG_PATH = path.join(__dirname, 'metro.config.js');

const oldStr = Buffer.from("ICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlL3NyYy9wcml2YXRlL2NvbXBvbmVudHMvdmlydHVhbHZpZXcvIiwgc3R1YjogVklSVFVBTFZJRVdfU1RVQiB9LAogIC8vICJzcGVjc19ERVBSRUNBVEVEIiDDqSB1bWEgcGFzdGEgcXVlIG8gcHLDs3ByaW8gUmVhY3QgTmF0aXZlIGrDoSBtYXJjYSBjb21vCiAgLy8gb2Jzb2xldGEgKGNvbXBvbmVudGVzIGxlZ2Fkb3M6IEFuZHJvaWREcmF3ZXJMYXlvdXQsIFJDVElucHV0QWNjZXNzb3J5VmlldwogIC8vIGUgb3V0cm9zKS4gTmFkYSBubyBhcHAgdXNhIGNvbXBvbmVudGVzIGxlZ2Fkb3MvZGVwcmVjaWFkb3MgZGlyZXRhbWVudGUKICAvLyDigJQgc3R1YiB2YXppbyDDqSBzZWd1cm8gYXF1aS4KICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlL3NyYy9wcml2YXRlL3NwZWNzX0RFUFJFQ0FURUQvIiwgc3R1YjogVklSVFVBTFZJRVdfU1RVQiB9LA==", 'base64').toString('utf8');
const newStr = Buffer.from("ICB7IGZyYWc6ICIvcmVhY3QtbmF0aXZlL3NyYy9wcml2YXRlL2NvbXBvbmVudHMvdmlydHVhbHZpZXcvIiwgc3R1YjogVklSVFVBTFZJRVdfU1RVQiB9LAogIC8vICJzcGVjc19ERVBSRUNBVEVEIiDDqSB1bWEgcGFzdGEgR1JBTkRFICg2MiBhcnF1aXZvcykgcXVlIG8gUmVhY3QgTmF0aXZlCiAgLy8gbWFyY2EgY29tbyAiZGVwcmVjYXRlZCIgbm8gbm9tZSwgbWFzIHF1ZSBuYSB2ZXJkYWRlIGNvbnTDqW0gbcOzZHVsb3MKICAvLyBjZW50cmFpcyBBVElWQU1FTlRFIHVzYWRvcyAoTmF0aXZlQXBwU3RhdGUsIE5hdGl2ZUNsaXBib2FyZCwKICAvLyBOYXRpdmVQbGF0Zm9ybUNvbnN0YW50c0FuZHJvaWQsIE5hdGl2ZVRpbWluZywgTmF0aXZlVUlNYW5hZ2VyLAogIC8vIE5hdGl2ZURldmljZUluZm8sIGV0Yy4pIOKAlCAiZGVwcmVjYXRlZCIgYXF1aSDDqSBzb2JyZSBvIEVTVElMTyBkYSBBUEkKICAvLyAoTWV0YSBwcmV0ZW5kZSBtaWdyYXIgaXNzbyBubyBmdXR1cm8pLCBuw6NvIHNvYnJlIGVzdGFyIHNlbSB1c28uCiAgLy8KICAvLyBFUlJPIENPUlJJR0lETzogdW1hIHZlcnPDo28gYW50ZXJpb3IgZGVzdGUgYXJxdWl2byBibG9xdWVhdmEgYSBwYXN0YQogIC8vICJzcGVjc19ERVBSRUNBVEVEIiBJTlRFSVJBIChiYXNlYWRvIGVtIHPDsyAyIGFycXVpdm9zIGNvbmZpcm1hZG9zIGNvbW8KICAvLyByZWFsbWVudGUgbsOjbyB1c2Fkb3MpLCBvIHF1ZSBxdWVicm91IHNpbGVuY2lvc2FtZW50ZSBkZXplbmFzIGRlCiAgLy8gZnVuY2lvbmFsaWRhZGVzIGNlbnRyYWlzIGRvIGFwcCBlbSB0ZW1wbyBkZSBleGVjdcOnw6NvIChvIGJ1aWxkIHBhc3NhdmEKICAvLyBub3JtYWxtZW50ZSwgbWFzIG8gYXBwIGNyYXNoYXZhIGFvIGFicmlyIOKAlCBleDogTmF0aXZlRGV2aWNlSW5mbyB2aXJhdmEKICAvLyB1bSBvYmpldG8gdmF6aW8sIGdlcmFuZG8gIlR5cGVFcnJvcjogdW5kZWZpbmVkIGlzIG5vdCBhIGZ1bmN0aW9uIiBubwogIC8vIERpbWVuc2lvbnMuanMpLiBWZXIgSU5WRVNUSUdBQ0FPLU5FVy1BUkNISVRFQ1RVUkUubWQgcGFyYSBvIHJlbGF0bwogIC8vIGNvbXBsZXRvIGRlc3NhIGludmVzdGlnYcOnw6NvLgogIC8vCiAgLy8gUG9yIGlzc28sIGFnb3JhIGJsb3F1ZWFtb3Mgc8OzIG9zIDIgYXJxdWl2b3MgRVNQRUPDjUZJQ09TIHF1ZSByZWFsbWVudGUKICAvLyB0cmF2YXZhbSBvIGJ1aWxkIChjb25maXJtYWRvcyBnZW51aW5hbWVudGUgbsOjbyB1c2Fkb3MgcGVsbyBhcHApIOKAlCBuw6NvCiAgLy8gYSBwYXN0YSBpbnRlaXJhLgogIHsgZnJhZzogIi9yZWFjdC1uYXRpdmUvc3JjL3ByaXZhdGUvc3BlY3NfREVQUkVDQVRFRC9jb21wb25lbnRzL0FuZHJvaWREcmF3ZXJMYXlvdXROYXRpdmVDb21wb25lbnQiLCBzdHViOiBWSVJUVUFMVklFV19TVFVCIH0sCiAgeyBmcmFnOiAiL3JlYWN0LW5hdGl2ZS9zcmMvcHJpdmF0ZS9zcGVjc19ERVBSRUNBVEVEL2NvbXBvbmVudHMvUkNUSW5wdXRBY2Nlc3NvcnlWaWV3TmF0aXZlQ29tcG9uZW50Iiwgc3R1YjogVklSVFVBTFZJRVdfU1RVQiB9LA==", 'base64').toString('utf8');

try {
  if (!fs.existsSync(METRO_CONFIG_PATH)) {
    throw new Error('Arquivo não encontrado: ' + METRO_CONFIG_PATH);
  }
  let content = fs.readFileSync(METRO_CONFIG_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `esperado 1 ocorrência do trecho original, encontrado ${occurrences}. Abortando sem gravar nada.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(METRO_CONFIG_PATH, content, 'utf8');
  console.log('✅ metro.config.js: bloqueio da pasta specs_DEPRECATED corrigido (só 2 arquivos específicos agora, não a pasta inteira).');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff metro.config.js   (conferir visualmente)');
  console.log('  2. git add metro.config.js');
  console.log('  3. git commit -m "fix: causa raiz do crash - nao bloquear specs_DEPRECATED inteira (NativeDeviceInfo e outros modulos centrais viravam objeto vazio)"');
  console.log('  4. git push');
  console.log('  5. cd android && gradlew --stop && cd ..');
  console.log('  6. rmdir /s /q android\\app\\build');
  console.log('  7. cd android && gradlew assembleRelease');
  console.log('  8. Instalar no celular e testar se abre (esta e a correção real, não um contorno)');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
