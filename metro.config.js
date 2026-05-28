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

const projectRoot = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const config = getDefaultConfig(projectRoot);

config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts || []), "css"],
};

const nativeWindConfig = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});

// Wrap the resolver AFTER withNativeWind to intercept css-interop's resolution
// of global.css -> .cache/web.css and redirect to .css-interop-cache/web.css
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

export default nativeWindConfig;
