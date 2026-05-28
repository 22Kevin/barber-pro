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

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
