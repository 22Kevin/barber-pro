#!/usr/bin/env node
// Patches Metro's DependencyGraph.js to fall back to on-disk SHA-1 computation
// for files outside its hasteFS watch set (e.g. react-native-css-interop/.cache/web.css).
//
// Bug: react-native-css-interop registers .cache/web.css as a module dependency
// but its SHA-1 patch only runs inside enhanceMiddleware (dev server), never
// during `expo export` (static build). Metro throws "Failed to get the SHA-1".
//
// Supports metro@0.83.x (used by this project via pnpm shamefully-hoist).

const fs = require('fs');
const path = require('path');

// Find the metro DependencyGraph.js — with shamefully-hoist it lands at top-level node_modules
const candidates = [
  path.resolve(__dirname, '../node_modules/metro/src/node-haste/DependencyGraph.js'),
];
const file = candidates.find(fs.existsSync);
if (!file) {
  console.error('ERROR: Could not find Metro DependencyGraph.js at:', candidates);
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
const MARKER = '/* css-interop-sha1-patch */';

if (src.includes(MARKER)) {
  console.log('Metro DependencyGraph.js already patched, skipping.');
  process.exit(0);
}

// metro@0.83.x: single async getOrComputeSha1 method, error thrown inline
const oldMethod = [
  '  async getOrComputeSha1(mixedPath) {',
  '    const result = await this._fileSystem.getOrComputeSha1(mixedPath);',
  '    if (!result || !result.sha1) {',
].join('\n');

if (!src.includes(oldMethod)) {
  // Fallback: try to find and patch any throw after getOrComputeSha1 result check
  console.error('ERROR: expected pattern not found in', file);
  console.error('Metro version may differ. Printing lines 185-205 for diagnosis:');
  const lines = src.split('\n');
  lines.slice(184, 205).forEach((l, i) => console.error(i + 185 + ':', JSON.stringify(l)));
  process.exit(1);
}

const newMethod = [
  '  async getOrComputeSha1(mixedPath) {',
  '    ' + MARKER,
  '    const result = await this._fileSystem.getOrComputeSha1(mixedPath);',
  '    if (!result || !result.sha1) {',
  '      // css-interop-patch: fall back to on-disk SHA-1 for files outside hasteFS',
  '      try {',
  '        const data = require("fs").readFileSync(mixedPath);',
  '        const sha1 = require("crypto").createHash("sha1").update(data).digest("hex");',
  '        return { sha1, content: data };',
  '      } catch (_) {}',
  '      // original error below',
].join('\n');

src = src.replace(oldMethod, newMethod);

if (!src.includes(MARKER)) {
  console.error('ERROR: replace failed — marker not found after replace.');
  process.exit(1);
}

fs.writeFileSync(file, src);
console.log('Metro DependencyGraph.js patched successfully at:', file);
