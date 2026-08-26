# Investigação — Crash "NativeDeviceInfo" sob New Architecture

Este documento existe porque desativamos a New Architecture como **contorno emergencial** pro app parar de crashar em produção — não porque a causa raiz foi resolvida. Se algum dia quiserem reativar a New Architecture (`newArchEnabled: true` em `app.config.js`), leiam isto primeiro pra não repetir a investigação do zero.

## O sintoma

A partir do `versionCode` 12 (a primeira versão gerada depois de resolvermos toda a série de crashes de build do Metro/codegen — ver `NOTAS-BUILD-ANDROID.md`), o app passou a **crashar imediatamente ao abrir, sempre, para todo usuário**. Mensagem do Android: "O app parou" / "o desenvolvedor precisa reparar".

## A causa técnica exata (confirmada, não é suposição)

Capturamos o log de crash real via `adb logcat` **duas vezes** — uma vez logo após o build inicial, e outra vez após uma limpeza **completa** de todos os caches (node_modules, cache do Metro, `android/app/build`, `android/build`, `android/.gradle`, e o cache **global** do Gradle em `%USERPROFILE%\.gradle\caches`). Os dois logs mostraram **exatamente a mesma posição** no bundle JS (`anonymous@1:202213`), byte por byte idêntica.

Isso descarta cache corrompido como causa — é algo estrutural e determinístico.

Usando o sourcemap gerado pelo próprio build (`android/app/build/generated/sourcemaps/react/release/index.android.bundle.map`), decodificamos a pilha de chamadas real:

```
setUpDefaultReactNativeEnvironment.js
  → AppRegistry.js → AppRegistryImpl.js → renderApplication.js
  → AppContainer.js → AppContainer-prod.js → View.js → ViewNativeComponent.js
  → NativeComponentRegistry.js
  → getNativeComponentAttributes.js
  → resolveAssetSource.js → AssetSourceResolver.js
  → PixelRatio.js
  → Dimensions.js:126   ← CRASH AQUI
```

A linha exata (`react-native@0.81.5`, `Libraries/Utilities/Dimensions.js:126`):
```js
Dimensions.set(NativeDeviceInfo.getConstants().Dimensions);
```

`NativeDeviceInfo` é um módulo do **núcleo do React Native** (não um pacote de terceiros, não um dos ~80 arquivos que já corrigimos com stubs) — um TurboModule que existe em `react-native/src/private/specs/modules/NativeDeviceInfo.js`. O erro (`TypeError: undefined is not a function`) acontece porque, quando `.getConstants()` é chamado nesse módulo, ele não está corretamente registrado do lado nativo.

**Confirmação externa**: encontramos um caso praticamente idêntico relatado publicamente (issue do `react-native-paper`, RN 0.76.2), com a mesma cadeia exata de chamadas (`NativeDeviceInfo.js` → `Dimensions.js` → `PixelRatio.js` → `StyleSheet.js`), reforçando que esse é um padrão de falha conhecido no ecossistema, ligado ao **modo Bridgeless** (a camada de comunicação JS↔nativo introduzida pela New Architecture).

## O que já foi descartado como causa

- ❌ **Cache corrompido** — limpeza total (incluindo cache global do Gradle) não mudou nada; crash idêntico nos dois logs.
- ❌ **Os stubs que criamos** (`requireNativeComponent`/`NativeModules` em vez de `codegenNativeComponent`/`TurboModuleRegistry`, documentados em `NOTAS-BUILD-ANDROID.md`) — `NativeDeviceInfo` não é um dos arquivos que tocamos; é puramente interno ao `react-native` core.
- ❌ **Falta de alguma biblioteca nativa de terceiros** — o problema é especificamente em código do núcleo do RN, não em `react-native-svg`, `react-native-screens`, etc.

## Hipótese mais provável (não confirmada)

Uma biblioteca nativa `.so` que o próprio `react-native` core gera automaticamente durante o build do Gradle (algo como `libreact_codegen_rncore.so`, responsável por registrar módulos centrais como `NativeDeviceInfo` sob a New Architecture) não está sendo gerada ou linkada corretamente nesse ambiente de build específico. **Confirmamos, olhando o log de carregamento de bibliotecas nativas do crash, que essa biblioteca não aparece sendo carregada** — só aparecem as bibliotecas de codegen de pacotes de terceiros (`libreact_codegen_rnscreens.so`, `libreact_codegen_rnsvg.so`, etc.).

**Por que isso não aconteceu antes** (no `versionCode` 10, que funcionava): `newArchEnabled: true` já estava configurado desde antes (não foi ligado recentemente, conferimos o histórico do git) — então a causa provável não é "a New Architecture está genericamente quebrada", e sim que **algo no ambiente/configuração nativa de build mudou** entre então e agora (versão do NDK, do Android SDK, de algum plugin do Gradle, ou possivelmente a mesma classe de problema do bug do `pnpm.yaml` documentado em `NOTAS-BUILD-ANDROID.md`, que deixou dependências relacionadas ao React Native derivando por quase 2 meses sem controle de versão).

## Pistas pra investigar quando houver tempo

1. **Comparar as versões exatas do Android NDK, SDK e plugins do Gradle** entre o ambiente que gerou o `versionCode` 10 (se ainda houver algum registro/backup) e o ambiente atual.
2. **Procurar no log completo do `gradlew bundleRelease`** (não o resumido) por tarefas com "codegen" ou "rncore" no nome (ex: `generateCodegenArtifactsFromSchema`, `:react-native-gradle-plugin:...`) e conferir se alguma delas falha silenciosamente ou é pulada (`SKIPPED`/`UP-TO-DATE` suspeito).
3. **Rodar `npx expo prebuild --clean`** (com backup da pasta `android/` antes, por causa de customizações manuais como assinatura/keystore) pra gerar o projeto nativo do zero, e conferir se o problema persiste — isso elimina qualquer resíduo de configuração nativa acumulada ao longo de várias sessões de build.
4. **Verificar o arquivo `android/gradle.properties`** por uma linha `newArchEnabled=true` — esse valor pode estar dessincronizado do `app.config.js` (mesma classe de bug que já vimos com `versionCode`), e pode ser necessário regenerar o projeto nativo pra qualquer mudança de New Architecture ter efeito de verdade.
5. Pesquisar por issues abertas no repositório `facebook/react-native` mencionando `NativeDeviceInfo` + `getConstants` + `bridgeless` pra RN 0.81.x especificamente (a busca que fizemos encontrou casos parecidos em versões próximas, mas não uma correspondência exata pra 0.81.5).

## Estado atual (contorno aplicado)

`newArchEnabled: false` em `app.config.js`, a partir do `versionCode` 13. Isso remove o Bridgeless/Fabric inteiramente, contornando o crash. Os stubs de `requireNativeComponent`/`NativeModules` continuam funcionando normalmente (na verdade são o mecanismo *nativo* de registro na arquitetura antiga, não um contorno nessa arquitetura).

**Antes de reativar `newArchEnabled: true` no futuro**: repetir o teste completo (build → instalar num celular real → abrir o app) antes de publicar qualquer coisa no Play Console — não confiar só no build passar com sucesso, já que foi exatamente isso que nos enganou dessa vez (o build sempre passou, o problema só aparecia em tempo de execução).
