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
  // "specs_DEPRECATED" é uma pasta que o próprio React Native já marca como
  // obsoleta (componentes legados: AndroidDrawerLayout, RCTInputAccessoryView
  // e outros). Nada no app usa componentes legados/depreciados diretamente
  // — stub vazio é seguro aqui.
  { frag: "/react-native/src/private/specs_DEPRECATED/", stub: VIRTUALVIEW_STUB },
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
