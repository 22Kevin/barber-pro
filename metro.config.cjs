const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Garantir que o cache do react-native-css-interop seja observado pelo Metro
const cssInteropCache = path.join(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);

config.watchFolders = [
  ...(config.watchFolders || []),
  cssInteropCache,
];

// Garantir que arquivos .css sejam resolvidos
config.resolver = {
  ...config.resolver,
  sourceExts: [
    ...(config.resolver?.sourceExts || []),
    "css",
  ],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
