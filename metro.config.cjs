const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Bloquear o cache interno do react-native-css-interop para o Metro não tentar
// calcular SHA-1 de arquivos gerados em runtime (causa build failure no Docker)
const cssInteropCacheDir = path.join(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);

config.resolver = {
  ...config.resolver,
  sourceExts: [
    ...(config.resolver?.sourceExts || []),
    "css",
  ],
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
        ? [config.resolver.blockList]
        : []),
    new RegExp(
      cssInteropCacheDir.replace(/[/\\]/g, "[/\\\\]") + ".*"
    ),
  ],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
