#!/usr/bin/env node
// Patches Metro's DependencyGraph.js to fall back to on-disk SHA-1 computation
// for files outside its hasteFS watch set (e.g. react-native-css-interop/.cache/web.css).
// This is a workaround for a bug in react-native-css-interop@0.2.x where the plugin
// registers .cache/web.css as a module dependency but its SHA-1 patch only runs
// inside enhanceMiddleware (dev server), never during `expo export` (static build).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const file = path.resolve(__dirname, '../node_modules/metro/src/node-haste/DependencyGraph.js');
let src = fs.readFileSync(file, 'utf8');

const MARKER = '/* css-interop-sha1-patch */';
if (src.includes(MARKER)) {
  console.log('Metro DependencyGraph.js already patched, skipping.');
  process.exit(0);
}

// Patch getSha1: fall back to on-disk read if hasteFS has no entry
const oldGetSha1 = [
  '  getSha1(filename) {',
  '    const sha1 = this._fileSystem.getSha1(filename);',
  '    if (!sha1) {',
  '      throw missingSha1Error(filename);',
  '    }',
  '    return sha1;',
  '  }',
].join('\n');

const newGetSha1 = [
  '  getSha1(filename) {',
  '    ' + MARKER,
  '    const sha1 = this._fileSystem.getSha1(filename);',
  '    if (!sha1) {',
  '      try {',
  '        const data = require("fs").readFileSync(filename);',
  '        return require("crypto").createHash("sha1").update(data).digest("hex");',
  '      } catch (_) {}',
  '      throw missingSha1Error(filename);',
  '    }',
  '    return sha1;',
  '  }',
].join('\n');

// Patch unstable_getOrComputeSha1: fall back to on-disk read
const oldGetOrCompute = [
  '  async unstable_getOrComputeSha1(mixedPath) {',
  '    const result = await this._fileSystem.getOrComputeSha1(mixedPath);',
  '    if (!result || !result.sha1) {',
  '      throw missingSha1Error(mixedPath);',
  '    }',
  '    return result;',
  '  }',
].join('\n');

const newGetOrCompute = [
  '  async unstable_getOrComputeSha1(mixedPath) {',
  '    const result = await this._fileSystem.getOrComputeSha1(mixedPath);',
  '    if (!result || !result.sha1) {',
  '      try {',
  '        const data = require("fs").readFileSync(mixedPath);',
  '        const sha1 = require("crypto").createHash("sha1").update(data).digest("hex");',
  '        return { sha1, content: data };',
  '      } catch (_) {}',
  '      throw missingSha1Error(mixedPath);',
  '    }',
  '    return result;',
  '  }',
].join('\n');

if (!src.includes(oldGetSha1)) {
  console.error('ERROR: getSha1 pattern not found in DependencyGraph.js');
  console.error('Metro version may have changed. Inspect the file manually.');
  process.exit(1);
}
if (!src.includes(oldGetOrCompute)) {
  console.error('ERROR: unstable_getOrComputeSha1 pattern not found in DependencyGraph.js');
  console.error('Metro version may have changed. Inspect the file manually.');
  process.exit(1);
}

src = src.replace(oldGetSha1, newGetSha1).replace(oldGetOrCompute, newGetOrCompute);
fs.writeFileSync(file, src);
console.log('Metro DependencyGraph.js patched successfully.');
