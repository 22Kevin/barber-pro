const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

// ─── css-interop SHA-1 fix ────────────────────────────────────────────────────
// css-interop resolves global.css -> node_modules/react-native-css-interop/.cache/web.css
// That file is outside Metro hasteFS watch scope (node_modules excluded by default),
// so Metro cannot compute its SHA-1 and throws during expo export.
//
// Fix: pre-create mirror files in .css-interop-cache/ (inside projectRoot, watched
// by Metro), then wrap the resolver to redirect any resolution pointing to the
// .cache/ directory -> .css-interop-cache/ instead.
// ─────────────────────────────────────────────────────────────────────────────

const CSS_INTEROP_CACHE = path.join(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);
const PROJECT_CACHE = path.join(__dirname, ".css-interop-cache");

// Pre-create files in both locations
for (const dir of [CSS_INTEROP_CACHE, PROJECT_CACHE]) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"]) {
    const fp = path.join(dir, f);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, "");
  }
}

const config = getDefaultConfig(__dirname);

// Wrap resolver: redirect .cache/ -> .css-interop-cache/
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts || []), "css"],
  resolveRequest: (context, moduleName, platform) => {
    // Call the original resolver chain (including css-interop's)
    const resolver = originalResolveRequest ?? context.resolveRequest;
    const resolved = resolver(context, moduleName, platform);

    // If css-interop resolved to its .cache/ dir, redirect to our watched dir
    if (
      resolved &&
      "filePath" in resolved &&
      typeof resolved.filePath === "string" &&
      resolved.filePath.includes("react-native-css-interop/.cache/")
    ) {
      const filename = path.basename(resolved.filePath);
      const newPath = path.join(PROJECT_CACHE, filename);
      // Ensure the target file exists
      if (!fs.existsSync(newPath)) fs.writeFileSync(newPath, "");
      return { ...resolved, filePath: newPath };
    }

    return resolved;
  },
};

const nativeWindConfig = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});

// Re-wrap after withNativeWind in case it replaces the resolver
// (withNativeWind calls withCssInterop which sets its own resolveRequest)
const cssInteropResolver = nativeWindConfig.resolver?.resolveRequest;
nativeWindConfig.resolver = {
  ...nativeWindConfig.resolver,
  resolveRequest: (context, moduleName, platform) => {
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

    return resolved;
  },
};

module.exports = nativeWindConfig;
