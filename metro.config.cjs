const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

// Pré-criar os arquivos de cache do react-native-css-interop antes do Metro iniciar.
// O plugin os cria em runtime mas o Metro precisa que existam no filesystem watch.
// O patch real está no Dockerfile.app (Metro DependencyGraph.js).
const cssInteropCacheDir = path.join(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);
fs.mkdirSync(cssInteropCacheDir, { recursive: true });
["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"].forEach((f) => {
  const fp = path.join(cssInteropCacheDir, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, "");
});

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts || []), "css"],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
