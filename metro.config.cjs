const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

// Pré-criar os arquivos de cache do react-native-css-interop.
// O patch real do outputDirectory é feito pelo scripts/patch-css-interop.js
// no Dockerfile, antes do expo export.
const CSS_INTEROP_CACHE_DIR = path.join(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);
const PROJECT_CACHE_DIR = path.join(__dirname, ".css-interop-cache");

for (const dir of [CSS_INTEROP_CACHE_DIR, PROJECT_CACHE_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"]) {
    const fp = path.join(dir, f);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, "");
  }
}

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts || []), "css"],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
