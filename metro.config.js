import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// ─── css-interop SHA-1 fix ────────────────────────────────────────────────────
// withNativeWind uses react-native-css-interop which resolves global.css to
// node_modules/react-native-css-interop/.cache/web.css — a file Metro cannot
// find in its hasteFS (created after Metro starts, inside node_modules).
//
// Fix: pre-create .css-interop-cache/ files in projectRoot (Metro watches this),
// then intercept the resolver to redirect .cache/web.css -> .css-interop-cache/web.css
// ─────────────────────────────────────────────────────────────────────────────
const PROJECT_CACHE = path.join(__dirname, ".css-interop-cache");
fs.mkdirSync(PROJECT_CACHE, { recursive: true });
for (const f of ["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"]) {
  const fp = path.join(PROJECT_CACHE, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, "");
}

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts || []), "css"],
};

const nativeWindConfig = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
  configPath: "./tailwind.config.cjs",
});

// Wrap the resolver AFTER withNativeWind to intercept css-interop's resolution
// of global.css -> .cache/web.css and redirect to .css-interop-cache/web.css
const cssInteropResolver = nativeWindConfig.resolver?.resolveRequest;

// react-native-view-shot (usado so em components/appointment-share-card.tsx,
// um recurso nativo de captura de tela + compartilhamento) tem um arquivo
// .web.js proprio que da erro "More than one plugin attempted to override
// parsing" especificamente no pipeline de transformacao web do
// react-native-css-interop. Como o recurso nao roda de verdade na web mesmo,
// redireciona pra um stub vazio so nessa plataforma, em vez de tentar
// resolver esse conflito de plugins do Babel.
const VIEW_SHOT_WEB_STUB = path.join(__dirname, "lib", "view-shot-web-stub.js");

// VirtualView.js / VirtualViewNativeComponent.js (dentro de
// react-native/src/private/components/virtualview/) usam sintaxe
// experimental do JS que quebra o parser do codegen no RN 0.81.x — bug
// conhecido (github.com/facebook/metro/issues/1651). Componente experimental
// não usado em nenhum lugar do app — redirecionado pra stub vazio (esse
// aqui pode ser vazio de verdade, já que nada no app usa).
const VIRTUALVIEW_STUB = path.join(__dirname, "lib", "virtualview-stub.js");

// A mesma classe de problema ("Cannot read properties of null (reading
// 'loc')" no @react-native/babel-plugin-codegen) afeta arquivos de
// especificação de codegen (*.ts em pastas "specs/") de VÁRIOS módulos
// nativos diferentes — já confirmado em react-native core,
// react-native-safe-area-context e react-native-gesture-handler. Para os
// pacotes que são usados de verdade pelo app (diferente do código legado
// abaixo), em vez de um stub vazio (que apagaria a funcionalidade real),
// cada entrada aponta pro stub PRECISO daquele arquivo específico — o
// mesmo código do arquivo original, conferido diretamente no pacote
// baixado do npm, só sem a sintaxe de tipos do TypeScript (que não existe
// em tempo de execução mesmo no original). Ver lib/codegen-stubs/ para o
// conteúdo de cada um.
const CODEGEN_STUBS_DIR = path.join(__dirname, "lib", "codegen-stubs");
const CODEGEN_STUB_MAP = [
  { frag: "/react-native/src/private/components/virtualview/", stub: VIRTUALVIEW_STUB },
  // "specs_DEPRECATED" é uma pasta GRANDE (62 arquivos) que o React Native
  // marca como "deprecated" no nome, mas que na verdade contém módulos
  // centrais ATIVAMENTE usados (NativeAppState, NativeClipboard,
  // NativePlatformConstantsAndroid, NativeTiming, NativeUIManager,
  // NativeDeviceInfo, etc.) — "deprecated" aqui é sobre o ESTILO da API
  // (Meta pretende migrar isso no futuro), não sobre estar sem uso.
  //
  // ERRO CORRIGIDO: uma versão anterior deste arquivo bloqueava a pasta
  // "specs_DEPRECATED" INTEIRA (baseado em só 2 arquivos confirmados como
  // realmente não usados), o que quebrou silenciosamente dezenas de
  // funcionalidades centrais do app em tempo de execução (o build passava
  // normalmente, mas o app crashava ao abrir — ex: NativeDeviceInfo virava
  // um objeto vazio, gerando "TypeError: undefined is not a function" no
  // Dimensions.js). Ver INVESTIGACAO-NEW-ARCHITECTURE.md para o relato
  // completo dessa investigação.
  //
  // Por isso, agora bloqueamos só os 2 arquivos ESPECÍFICOS que realmente
  // travavam o build (confirmados genuinamente não usados pelo app) — não
  // a pasta inteira.
  { frag: "/react-native/src/private/specs_DEPRECATED/components/AndroidDrawerLayoutNativeComponent", stub: VIRTUALVIEW_STUB },
  { frag: "/react-native/src/private/specs_DEPRECATED/components/RCTInputAccessoryViewNativeComponent", stub: VIRTUALVIEW_STUB },
  // react-native-safe-area-context — usado de verdade (SafeAreaView/
  // SafeAreaProvider, evita conteúdo atrás do notch/barra de status).
  { frag: "/react-native-safe-area-context/src/specs/NativeSafeAreaView", stub: path.join(CODEGEN_STUBS_DIR, "NativeSafeAreaView.js") },
  { frag: "/react-native-safe-area-context/src/specs/NativeSafeAreaProvider", stub: path.join(CODEGEN_STUBS_DIR, "NativeSafeAreaProvider.js") },
  { frag: "/react-native-safe-area-context/src/specs/NativeSafeAreaContext", stub: path.join(CODEGEN_STUBS_DIR, "NativeSafeAreaContext.js") },
  // react-native-gesture-handler — GestureHandlerRootView envolve o app
  // inteiro, é essencial pro React Navigation/Expo Router funcionar.
  { frag: "/react-native-gesture-handler/src/specs/RNGestureHandlerRootViewNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "RNGestureHandlerRootViewNativeComponent.js") },
  // react-native-keyboard-controller — tem 7 arquivos de especificação de
  // codegen ao todo; adiantando os 7 de uma vez (em vez de descobrir um
  // por um, cada rodada de build levando 15-30min) já que o padrão do bug
  // (afeta pastas "specs/" inteiras) já está bem estabelecido a essa altura.
  { frag: "/react-native-keyboard-controller/src/specs/KeyboardBackgroundViewNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "KeyboardBackgroundViewNativeComponent.js") },
  { frag: "/react-native-keyboard-controller/src/specs/KeyboardControllerViewNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "KeyboardControllerViewNativeComponent.js") },
  { frag: "/react-native-keyboard-controller/src/specs/KeyboardExtenderNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "KeyboardExtenderNativeComponent.js") },
  { frag: "/react-native-keyboard-controller/src/specs/KeyboardGestureAreaNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "KeyboardGestureAreaNativeComponent.js") },
  { frag: "/react-native-keyboard-controller/src/specs/OverKeyboardViewNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "OverKeyboardViewNativeComponent.js") },
  { frag: "/react-native-keyboard-controller/src/specs/NativeKeyboardController", stub: path.join(CODEGEN_STUBS_DIR, "NativeKeyboardController.js") },
  { frag: "/react-native-keyboard-controller/src/specs/NativeStatusBarManagerCompat", stub: path.join(CODEGEN_STUBS_DIR, "NativeStatusBarManagerCompat.js") },
  // @react-native-google-signin/google-signin — esse arquivo especificamente
  // ficou sem compilar nessa versão do pacote (o resto do "lib/module" é
  // JS compilado normal; esse .ts "esquecido" quebra o parser do codegen).
  { frag: "/@react-native-google-signin/google-signin/lib/module/spec/SignInButtonNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "SignInButtonNativeComponent.js") },
  // react-native-view-shot — RNViewShot.js (o arquivo nativo, não o
  // .web.js já tratado acima) tem o pragma "//@flow" e importa de um
  // arquivo de especificação de codegen — causa "More than one plugin
  // attempted to override parsing" (mesmo problema da versão web, ver
  // VIEW_SHOT_WEB_STUB no topo do arquivo), agora também no build nativo.
  { frag: "/react-native-view-shot/src/RNViewShot.js", stub: path.join(CODEGEN_STUBS_DIR, "RNViewShot.js") },
  // react-native-gesture-handler — 2 arquivos de spec restantes (irmãos do
  // RNGestureHandlerRootViewNativeComponent já corrigido acima).
  { frag: "/react-native-gesture-handler/src/specs/RNGestureHandlerButtonNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "RNGestureHandlerButtonNativeComponent.js") },
  { frag: "/react-native-gesture-handler/src/specs/NativeRNGestureHandlerModule", stub: path.join(CODEGEN_STUBS_DIR, "NativeRNGestureHandlerModule.js") },
  // react-native-svg — 32 arquivos de especificação de codegen ao todo na
  // pasta fabric/ (30 componentes visuais + 2 TurboModules). Adiantando
  // todos de uma vez (em vez de descobrir um por um, cada rodada de build
  // levando 20-30min) — mesmo padrão ja bem estabelecido a essa altura.
  { frag: "/react-native-svg/src/fabric/AndroidSvgViewNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "AndroidSvgViewNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/CircleNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "CircleNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/ClipPathNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ClipPathNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/DefsNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "DefsNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/EllipseNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "EllipseNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/FeBlendNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FeBlendNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/FeColorMatrixNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FeColorMatrixNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/FeCompositeNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FeCompositeNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/FeFloodNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FeFloodNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/FeGaussianBlurNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FeGaussianBlurNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/FeMergeNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FeMergeNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/FeOffsetNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FeOffsetNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/FilterNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FilterNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/ForeignObjectNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ForeignObjectNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/GroupNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "GroupNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/IOSSvgViewNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "IOSSvgViewNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/ImageNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ImageNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/LineNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "LineNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/LinearGradientNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "LinearGradientNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/MarkerNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "MarkerNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/MaskNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "MaskNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/NativeSvgRenderableModule", stub: path.join(CODEGEN_STUBS_DIR, "NativeSvgRenderableModule.js") },
  { frag: "/react-native-svg/src/fabric/NativeSvgViewModule", stub: path.join(CODEGEN_STUBS_DIR, "NativeSvgViewModule.js") },
  { frag: "/react-native-svg/src/fabric/PathNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "PathNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/PatternNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "PatternNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/RadialGradientNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "RadialGradientNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/RectNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "RectNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/SymbolNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "SymbolNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/TSpanNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "TSpanNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/TextNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "TextNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/TextPathNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "TextPathNativeComponent.js") },
  { frag: "/react-native-svg/src/fabric/UseNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "UseNativeComponent.js") },
  // react-native-screens — 18 arquivos de especificação de codegen ao todo
  // (17 componentes visuais + 1 TurboModule). Adiantando todos de uma vez,
  // mesmo padrão documentado em NOTAS-BUILD-ANDROID.md.
  { frag: "/react-native-screens/src/fabric/ModalScreenNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ModalScreenNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/ScreenStackHeaderConfigNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenStackHeaderConfigNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/bottom-tabs/BottomTabsScreenNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "BottomTabsScreenNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/bottom-tabs/BottomTabsNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "BottomTabsNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/ScreenFooterNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenFooterNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/ScreenStackNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenStackNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/FullWindowOverlayNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "FullWindowOverlayNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/ScreenContentWrapperNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenContentWrapperNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/ScreenStackHeaderSubviewNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenStackHeaderSubviewNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/ScreenContainerNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenContainerNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/SearchBarNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "SearchBarNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/ScreenNavigationContainerNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenNavigationContainerNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/ScreenNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/gamma/SplitViewScreenNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "SplitViewScreenNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/gamma/ScreenStackHostNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "ScreenStackHostNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/gamma/SplitViewHostNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "SplitViewHostNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/gamma/StackScreenNativeComponent", stub: path.join(CODEGEN_STUBS_DIR, "StackScreenNativeComponent.js") },
  { frag: "/react-native-screens/src/fabric/NativeScreensModule", stub: path.join(CODEGEN_STUBS_DIR, "NativeScreensModule.js") },
];

nativeWindConfig.resolver = {
  ...nativeWindConfig.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (platform === "web" && moduleName === "react-native-view-shot") {
      return { type: "sourceFile", filePath: VIEW_SHOT_WEB_STUB };
    }
    const resolver = cssInteropResolver ?? context.resolveRequest;
    const resolved = resolver(context, moduleName, platform);
    if (
      resolved &&
      "filePath" in resolved &&
      typeof resolved.filePath === "string" &&
      resolved.filePath.includes("react-native-css-interop/.cache/")
    ) {
      const filename = path.basename(resolved.filePath);
      const newPath = path.join(PROJECT_CACHE, filename);
      if (!fs.existsSync(newPath)) fs.writeFileSync(newPath, "");
      return { ...resolved, filePath: newPath };
    }
    if (
      resolved &&
      "filePath" in resolved &&
      typeof resolved.filePath === "string"
    ) {
      const normalizedPath = resolved.filePath.replace(/\\/g, "/");
      const match = CODEGEN_STUB_MAP.find((m) => normalizedPath.includes(m.frag));
      if (match) {
        return { ...resolved, filePath: match.stub };
      }
    }
    return resolved;
  },
};

export default nativeWindConfig;
