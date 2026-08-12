# Notas — Build Android local (gradlew bundleRelease)

Este arquivo documenta um problema recorrente no build Android local, sua causa raiz confirmada, e o método usado para corrigir cada ocorrência. Leia isto **antes** de tentar debugar um novo crash de build do zero — é bem provável que seja o mesmo problema, com uma cara diferente.

## TL;DR

- **O bug é real, conhecido e ainda sem correção oficial**: [facebook/react-native#52883](https://github.com/facebook/react-native/issues/52883).
- **Causa**: `@react-native/codegen` usa `@babel/parser` e `@babel/core` internamente mas não declara essa dependência formalmente. Em setups com **pnpm** (que isola pacotes de um jeito mais rígido que o npm), o codegen às vezes não consegue "enxergar" o Babel corretamente, e quebra ao processar certos arquivos de especificação (`*.ts`/`*.js` dentro de pastas `specs/`) de módulos nativos.
- **Por que só aparece agora**: o dia a dia do projeto usa `npm install` (mais tolerante com esse bug, por hoisting mais "solto"). Builds anteriores bem-sucedidos (ex: versionCode 10 no Play Console) provavelmente rodaram em cima de um `node_modules` gerado/herdado pelo npm. Sempre que rodamos `rmdir node_modules` + `npx pnpm install` (pra espelhar o ambiente do Railway), o bug do pnpm passa a valer — e aparece em arquivos diferentes a cada build, porque o Metro processa os módulos em paralelo e a ordem varia.
- **Não é um bug no nosso código.** Não adianta procurar "o que quebramos" — nada foi quebrado. É um bug de tooling do próprio React Native que só se manifesta nesse ambiente específico (pnpm + RN 0.81.x + New Architecture).

## Como reconhecer esse erro

Duas variações do mesmo problema de fundo:

### Variação 1 — "Cannot read properties of null (reading 'loc')"

```
SyntaxError: node_modules\<algum-pacote>\...\specs\Native...NativeComponent.ts: Cannot read properties of null (reading 'loc')
    at ... @react-native\babel-plugin-codegen\index.js:190:52
```

Acontece ao processar um arquivo de especificação de codegen (view component ou TurboModule) de **qualquer** pacote nativo que declara componentes/módulos via `codegenNativeComponent(...)` ou `TurboModuleRegistry.get<Spec>(...)`.

### Variação 2 — "More than one plugin attempted to override parsing"

```
SyntaxError: node_modules\<algum-pacote>\...: More than one plugin attempted to override parsing.
    at parser (...@babel\core\lib\parser\index.js:49:11)
```

Mesma causa raiz, manifestação diferente — geralmente em arquivos que também usam sintaxe Flow (`//@flow`) combinada com o wrapper de transformação do `react-native-css-interop` (NativeWind).

## O método de correção (comprovado, aplicar sempre que aparecer um arquivo novo)

**Não tente resolver isso "de verdade"** (trocar versões, reinstalar, limpar cache) — já tentamos:
- ❌ `npx pnpm install --shamefully-hoist` — não resolveu
- ❌ Pinar toda a família do `@babel/*` em versões específicas — não resolveu, e foi revertido
- ❌ Limpar `.css-interop-cache`, `.expo`, cache do Metro — não resolveu
- ❌ Trocar de pnpm pra npm localmente — introduz outros bugs diferentes (ex: erro de ESM loader do Node no Windows)

**O que funciona**: interceptar o arquivo problemático no `metro.config.js` e redirecioná-lo para uma versão reescrita à mão, que preserva o comportamento real mas evita a sintaxe que aciona o bug do codegen.

### Passo a passo

1. **Identifique o pacote e a versão exata** usados no projeto:
   ```
   grep '"<nome-do-pacote>"' package.json
   grep "'<nome-do-pacote>@" pnpm-lock.yaml | head -3
   ```

2. **Baixe o pacote real do npm** (não confie em memória/treino — sempre confira o conteúdo exato da versão instalada):
   ```
   cd /tmp && npm pack <nome-do-pacote>@<versão-exata> --silent
   tar xzf <nome-do-pacote>-<versão>.tgz
   cat package/<caminho-do-arquivo-que-quebrou>
   ```

3. **Classifique o arquivo**:
   - Se for um **componente visual** (usa `codegenNativeComponent(...)`) → reescrever usando `requireNativeComponent` do `'react-native'`.
   - Se for um **módulo nativo/TurboModule** (usa `TurboModuleRegistry.get<Spec>(...)`) → reescrever usando `NativeModules` do `'react-native'`.

   Por quê isso funciona: conferido diretamente no código-fonte do `@react-native/babel-plugin-codegen` — ele só verifica se a chamada se chama literalmente `codegenNativeComponent` ou `codegenNativeCommands`. `requireNativeComponent` e `NativeModules` não aparecem em lugar nenhum do plugin, então nunca disparam o bug. E como o componente/módulo nativo real já foi registrado de verdade durante o build nativo (Gradle/CMake), essas funções continuam encontrando e retornando a coisa certa — só não passam pelo codegen do lado do Metro.

   Exemplo (componente visual), removendo só a sintaxe de tipos do TypeScript (que não existe em tempo de execução):
   ```js
   // Original (quebra o build):
   //   import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
   //   export default codegenNativeComponent<Props>('NomeDoComponente');
   //
   // Stub (funciona):
   import { requireNativeComponent } from "react-native";
   export default requireNativeComponent("NomeDoComponente");
   ```

   Exemplo (TurboModule):
   ```js
   // Original: TurboModuleRegistry.getEnforcing<Spec>('NomeDoModulo')
   import { NativeModules } from "react-native";
   export default NativeModules.NomeDoModulo;
   ```

   **Dica pra ter certeza que bateu certo**: rode `npx esbuild <arquivo-original.ts>` (sem flags de output) — o esbuild remove os tipos do TypeScript automaticamente e mostra exatamente o JS puro equivalente. Comparar isso com o stub escrito à mão dá confiança total de que o comportamento é idêntico.

4. **Crie o stub** em `lib/codegen-stubs/<NomeDoArquivo>.js` com o conteúdo reescrito.

5. **Adicione uma entrada no mapa `CODEGEN_STUB_MAP`** dentro de `metro.config.js`:
   ```js
   { frag: "/caminho/parcial/do/arquivo/original", stub: path.join(CODEGEN_STUBS_DIR, "NomeDoArquivo.js") },
   ```
   O `frag` é um trecho do caminho resolvido (normalizado com `/`, funciona em qualquer SO) — não precisa ser o caminho completo, só o suficiente pra ser único.

6. **Valide antes de aplicar**:
   ```
   npx esbuild metro.config.js --outfile=/tmp/check.js --format=esm --platform=node
   npx esbuild lib/codegen-stubs/<NomeDoArquivo>.js --outfile=/tmp/check2.js --format=esm --platform=node
   ```
   Sem erro = sintaxe ok.

7. **Reinstale e builde**:
   ```
   cd android && gradlew --stop && cd ..
   rmdir /s /q node_modules
   npx pnpm install
   git add pnpm-lock.yaml && git commit -m "chore: lockfile" && git push
   cd android && gradlew bundleRelease
   ```

## Arquivos já corrigidos com esse método (histórico)

| Pacote | Arquivo | Tipo |
|---|---|---|
| react-native (core) | `VirtualView.js`/`VirtualViewNativeComponent.js` | Componente não usado (stub vazio) |
| react-native (core) | Pasta `specs_DEPRECATED/` inteira | Legado não usado (stub vazio) |
| react-native-safe-area-context | `NativeSafeAreaView.ts` | Componente visual |
| react-native-safe-area-context | `NativeSafeAreaProvider.ts` | Componente visual |
| react-native-safe-area-context | `NativeSafeAreaContext.ts` | TurboModule |
| react-native-gesture-handler | `RNGestureHandlerRootViewNativeComponent.ts` | Componente visual (raiz do app!) |
| react-native-keyboard-controller | `KeyboardBackgroundViewNativeComponent.ts` | Componente visual |
| react-native-keyboard-controller | `KeyboardControllerViewNativeComponent.ts` | Componente visual |
| react-native-keyboard-controller | `KeyboardExtenderNativeComponent.ts` | Componente visual (só iOS) |
| react-native-keyboard-controller | `KeyboardGestureAreaNativeComponent.ts` | Componente visual |
| react-native-keyboard-controller | `OverKeyboardViewNativeComponent.ts` | Componente visual |
| react-native-keyboard-controller | `NativeKeyboardController.ts` | TurboModule |
| react-native-keyboard-controller | `NativeStatusBarManagerCompat.ts` | TurboModule |
| @react-native-google-signin/google-signin | `SignInButtonNativeComponent.ts` | Componente visual (arquivo ficou sem compilar nessa versão do pacote) |

## Caso especial — react-native-view-shot (⚠️ funcionalidade desativada)

O `RNViewShot.js` desse pacote deu a **Variação 2** do erro ("More than one plugin"), e mesmo depois de reescrever com o método acima (`NativeModules.RNViewShot`, sem Flow, sem importar o spec) o erro **persistiu no próprio stub** — indicando que, pra esse caso específico, o problema não está no conteúdo do arquivo, mas em como o `react-native-css-interop` (NativeWind) embrulha esse pacote especificamente. Não conseguimos isolar a causa exata dentro do tempo disponível.

**Solução temporária aplicada**: o uso de `react-native-view-shot` foi removido de `components/appointment-share-card.tsx` (única tela que usa — o botão "Compartilhar nos Stories" mostra um aviso "indisponível no momento" em vez de capturar/compartilhar a imagem). Tudo está marcado com comentários `TEMPORARIAMENTE` nesse arquivo, com instruções de como reverter.

**Para investigar isso com mais calma depois**: o comportamento sugere que o `react-native-css-interop`/NativeWind aplica algum tratamento especial a esse pacote — vale procurar por menções a `view-shot` ou `flow` na configuração do NativeWind, ou tentar uma versão mais nova do `nativewind`/`react-native-css-interop` (estava em `nativewind@4.2.5` / `react-native-css-interop@0.2.5` na época deste diagnóstico).

## Testes obrigatórios depois que o build passar

Como esses stubs afetam funcionalidades reais (não só código morto), depois que `gradlew bundleRelease` terminar com sucesso, testar manualmente no app antes de subir pro Play Console:

- [ ] **Áreas seguras** (safe-area-context): abrir várias telas, conferir que nada fica cortado atrás do notch ou da barra de status/gestos.
- [ ] **Gestos** (gesture-handler): scroll, swipe, deslizar pra fechar modais — em qualquer tela que use.
- [ ] **Teclado** (keyboard-controller): abrir formulários, conferir que o teclado não cobre campos de input, que o comportamento de "empurrar tela" funciona.
- [ ] **Login com Google** (google-signin): testar o botão de login com Google de ponta a ponta.
- [ ] **Barra de status** (keyboard-controller): conferir que cor/estilo da barra de status muda corretamente em telas diferentes (login, agenda, etc).
- [ ] ~~Compartilhar nos Stories~~ — desativado temporariamente, não precisa testar (deve mostrar o aviso).

## Sobre o bug do `pnpm.yaml` (separado, já corrigido, mas documentado por completude)

Em 18/06/2026, dois commits com 30 minutos de diferença se contradisseram: um fixou corretamente `@react-native/babel-preset@0.81.5` via `pnpm.overrides` no `package.json`; o segundo, tentando adicionar mais uma correção, **removeu esse bloco sem querer** e recriou os overrides num arquivo chamado `pnpm.yaml` (nome errado — o pnpm não lê esse arquivo; o correto seria `pnpm-workspace.yaml`, ou manter dentro do `package.json`). Isso ficou silenciosamente sem efeito por quase 2 meses, até ser descoberto e corrigido em 06/08/2026 (commit `7393fa6`).

**Confirmado que esse bug NÃO é a causa dos crashes de codegen documentados acima** — mesmo com o `pnpm.overrides` funcionando corretamente hoje, o `@react-native/babel-plugin-codegen` resolve pra `0.81.5` (versão correta, batendo com o RN do projeto) e o crash acontece do mesmo jeito. São dois problemas históricos diferentes que só coincidiram na mesma investigação.

**Lição pra não repetir**: `pnpm.overrides` só funciona dentro do campo `"pnpm"` do `package.json`, ou num arquivo separado chamado exatamente `pnpm-workspace.yaml`. Qualquer outro nome de arquivo é ignorado silenciosamente, sem aviso — vale conferir de vez em quando com `python3 -c "import json; print(json.load(open('package.json'))['pnpm'])"` que o bloco ainda está lá.
