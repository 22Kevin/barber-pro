const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ─── Workaround for react-native-css-interop SHA-1 bug ──────────────────────
// css-interop creates .cache/web.css at transform time but Metro's hasteFS
// is already initialized by then and has no entry for that file.
// Solution: create a proxy file inside the projectRoot that Metro watches,
// and patch the css-interop outputDirectory to point there instead.

const CSS_INTEROP_CACHE_DIR = path.join(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);
const CSS_INTEROP_MODULE = path.join(
  __dirname,
  "node_modules/react-native-css-interop/dist/metro/index.js"
);

// Pre-create all cache files so they exist before Metro starts
fs.mkdirSync(CSS_INTEROP_CACHE_DIR, { recursive: true });
["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"].forEach((f) => {
  const fp = path.join(CSS_INTEROP_CACHE_DIR, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, "");
});

// Patch the css-interop index.js to use a cache dir inside projectRoot
// where Metro's hasteFS will watch it automatically.
const PATCHED_CACHE_DIR = path.join(__dirname, ".css-interop-cache");
fs.mkdirSync(PATCHED_CACHE_DIR, { recursive: true });
["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"].forEach((f) => {
  const fp = path.join(PATCHED_CACHE_DIR, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, "");
});

if (fs.existsSync(CSS_INTEROP_MODULE)) {
  let src = fs.readFileSync(CSS_INTEROP_MODULE, "utf8");
  const MARKER = "/* projectRoot-cache-patch */";
  if (!src.includes(MARKER)) {
    // Replace the hardcoded outputDirectory with our projectRoot-based one
    const oldLine = 'const outputDirectory = path_1.default.resolve(__dirname, "../../.cache");';
    const newLine =
      MARKER +
      '\nconst outputDirectory = ' +
      JSON.stringify(PATCHED_CACHE_DIR) +
      ';';
    if (src.includes(oldLine)) {
      src = src.replace(oldLine, newLine);
      fs.writeFileSync(CSS_INTEROP_MODULE, src);
      console.log("[metro.config] css-interop outputDirectory redirected to projectRoot cache");
    } else {
      console.warn("[metro.config] WARNING: css-interop patch line not found, SHA-1 issue may persist");
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts || []), "css"],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
