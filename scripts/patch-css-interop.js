#!/usr/bin/env node
/**
 * Patches react-native-css-interop/dist/metro/index.js to redirect
 * outputDirectory from node_modules/.cache to the projectRoot/.css-interop-cache.
 *
 * Metro's hasteFS watches projectRoot but excludes node_modules by default.
 * Files created inside node_modules at transform time are never in hasteFS,
 * causing "Failed to get the SHA-1" during expo export.
 *
 * This patch changes the single `outputDirectory` assignment so all cache files
 * land inside projectRoot where Metro watches them from startup.
 */
const fs = require('fs');
const path = require('path');

const TARGET = path.resolve(__dirname, '../node_modules/react-native-css-interop/dist/metro/index.js');
const NEW_CACHE_DIR = path.resolve(__dirname, '../.css-interop-cache');

if (!fs.existsSync(TARGET)) {
  console.error('ERROR: css-interop metro index not found at', TARGET);
  process.exit(1);
}

let src = fs.readFileSync(TARGET, 'utf8');
const MARKER = '/* outputDirectory-projectRoot-patch */';

if (src.includes(MARKER)) {
  console.log('css-interop already patched, skipping.');
  process.exit(0);
}

const OLD = 'const outputDirectory = path_1.default.resolve(__dirname, "../../.cache");';
const NEW = MARKER + '\nconst outputDirectory = ' + JSON.stringify(NEW_CACHE_DIR) + ';';

if (!src.includes(OLD)) {
  console.error('ERROR: expected outputDirectory line not found in', TARGET);
  console.error('css-interop version may have changed.');
  // Print the relevant lines for diagnosis
  src.split('\n').slice(14, 20).forEach((l, i) => console.error(i + 15 + ':', l));
  process.exit(1);
}

// Pre-create the new cache directory and all expected files
fs.mkdirSync(NEW_CACHE_DIR, { recursive: true });
for (const f of ['web.css', 'ios.js', 'android.js', 'native.js', 'macos.js', 'windows.js']) {
  const fp = path.join(NEW_CACHE_DIR, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, '');
}

src = src.replace(OLD, NEW);
fs.writeFileSync(TARGET, src);
console.log('css-interop outputDirectory redirected to', NEW_CACHE_DIR);
