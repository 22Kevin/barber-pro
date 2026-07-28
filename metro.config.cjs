const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

// Pre-create .css-interop-cache/ files so Metro hasteFS indexes them on startup.
// The outputDirectory redirect is applied via pnpm.patchedDependencies in package.json.
const PROJECT_CACHE = path.join(__dirname, ".css-interop-cache");
fs.mkdirSync(PROJECT_CACHE, { recursive: true });
for (const f of ["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"]) {
  const fp = path.join(PROJECT_CACHE, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, "");
}

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts || []), "css"],
};

// react-native-view-shot (usado so em appointment-share-card.tsx, um recurso
// nativo de captura de tela + compartilhamento) tem um arquivo .web.js
// proprio que da conflito de plugins do Babel especificamente no pipeline de
// transformacao web do react-native-css-interop ("More than one plugin
// attempted to override parsing"). Como o recurso nao roda de verdade na
// web mesmo, redireciona pra um stub vazio so nessa plataforma.
const VIEW_SHOT_WEB_STUB = path.join(__dirname, "lib", "view-shot-web-stub.js");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform, ...rest) => {
  if (platform === "web" && moduleName === "react-native-view-shot") {
    return { type: "sourceFile", filePath: VIEW_SHOT_WEB_STUB };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform, ...rest);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
