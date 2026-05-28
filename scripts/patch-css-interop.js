#!/usr/bin/env node
/**
 * Patches react-native-css-interop dist/metro/index.js to redirect
 * outputDirectory from node_modules/.cache to .css-interop-cache inside
 * projectRoot, where Metro's hasteFS watches files from startup.
 */
const fs = require('fs');
const path = require('path');

// With pnpm shamefully-hoist there should be exactly one location
const SEARCH_PATHS = [
  path.resolve(__dirname, '../node_modules/react-native-css-interop/dist/metro/index.js'),
];

const NEW_CACHE_DIR = path.resolve(__dirname, '../.css-interop-cache');
const MARKER = '/* outputDirectory-projectRoot-patch */';

// Pre-create the cache dir and files
fs.mkdirSync(NEW_CACHE_DIR, { recursive: true });
for (const f of ['web.css', 'ios.js', 'android.js', 'native.js', 'macos.js', 'windows.js']) {
  const fp = path.join(NEW_CACHE_DIR, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, '');
}

let patched = 0;
for (const TARGET of SEARCH_PATHS) {
  if (!fs.existsSync(TARGET)) {
    console.log('Not found:', TARGET);
    continue;
  }

  let src = fs.readFileSync(TARGET, 'utf8');
  if (src.includes(MARKER)) {
    console.log('Already patched:', TARGET);
    patched++;
    continue;
  }

  // Try exact match first
  const OLD = 'const outputDirectory = path_1.default.resolve(__dirname, "../../.cache");';
  const NEW = MARKER + '\nconst outputDirectory = ' + JSON.stringify(NEW_CACHE_DIR) + ';';

  if (src.includes(OLD)) {
    src = src.replace(OLD, NEW);
    fs.writeFileSync(TARGET, src);
    console.log('Patched:', TARGET);
    console.log('  outputDirectory ->', NEW_CACHE_DIR);
    patched++;
    continue;
  }

  // Fallback: regex match for the outputDirectory line
  const regex = /const outputDirectory\s*=\s*[^\n]+\.cache[^\n]*;/;
  if (regex.test(src)) {
    src = src.replace(regex, MARKER + '\nconst outputDirectory = ' + JSON.stringify(NEW_CACHE_DIR) + ';');
    fs.writeFileSync(TARGET, src);
    console.log('Patched (regex):', TARGET);
    patched++;
    continue;
  }

  console.error('ERROR: Could not find outputDirectory line in', TARGET);
  console.error('File lines 14-22:');
  src.split('\n').slice(13, 22).forEach((l, i) => console.error(' ', i + 14 + ':', JSON.stringify(l)));
  process.exit(1);
}

if (patched === 0) {
  console.error('ERROR: No css-interop metro index files found or patched.');
  console.error('Searched:', SEARCH_PATHS);
  process.exit(1);
}

console.log('Done. Patched', patched, 'file(s).');
