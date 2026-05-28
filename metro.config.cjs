const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

// O react-native-css-interop gera arquivos em runtime neste diretório
// mas não os adiciona ao watchFolders — o Metro não consegue calcular SHA-1
// de arquivos fora do watchFolders. Precisamos:
// 1) Garantir que os arquivos existam antes do Metro iniciar
// 2) Adicionar o diretório ao watchFolders DEPOIS do withNativeWind

const cssInteropCacheDir = path.join(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);

// Pré-criar os arquivos que o css-interop vai precisar
fs.mkdirSync(cssInteropCacheDir, { recursive: true });
["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"].forEach((f) => {
  const fp = path.join(cssInteropCacheDir, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, "");
});

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  sourceExts: [
    ...(config.resolver?.sourceExts || []),
    "css",
  ],
};

// withNativeWind pode sobrescrever watchFolders — aplicamos antes e re-adicionamos depois
const nativeWindConfig = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});

// Adicionar DEPOIS do withNativeWind para não ser sobrescrito
nativeWindConfig.watchFolders = [
  ...(nativeWindConfig.watchFolders || []),
  cssInteropCacheDir,
];

module.exports = nativeWindConfig;
