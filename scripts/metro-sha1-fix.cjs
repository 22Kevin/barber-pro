/**
 * Runtime monkey-patch: intercepts DependencyGraph when it's first require()'d
 * and wraps getOrComputeSha1 with an on-disk SHA-1 fallback.
 * 
 * Loaded via NODE_OPTIONS="--require /app/scripts/metro-sha1-fix.cjs"
 * Works because this._getSha1 in Transformer.js runs in the main thread.
 */
'use strict';
const Module = require('module');
const fs = require('fs');
const crypto = require('crypto');

const orig_load = Module._load;

Module._load = function(request, parent, isMain) {
  const exports = orig_load.apply(this, arguments);

  // Only check modules whose filename contains 'DependencyGraph'
  if (typeof request === 'string' && request.includes('DependencyGraph')) {
    patchIfDepGraph(exports, request);
  }

  return exports;
};

function patchIfDepGraph(exports, hint) {
  const Cls = (exports && exports.default) ? exports.default : exports;
  if (!Cls || typeof Cls !== 'function') return;
  if (!Cls.prototype || typeof Cls.prototype.getOrComputeSha1 !== 'function') return;
  if (Cls.prototype.__sha1_patched) return;

  Cls.prototype.__sha1_patched = true;
  const orig = Cls.prototype.getOrComputeSha1;

  Cls.prototype.getOrComputeSha1 = async function(mixedPath) {
    try {
      return await orig.call(this, mixedPath);
    } catch (err) {
      if (err && err.message && err.message.includes('Failed to get the SHA-1')) {
        try {
          const data = fs.readFileSync(mixedPath);
          const sha1 = crypto.createHash('sha1').update(data).digest('hex');
          process.stderr.write('[sha1-fix] fallback SHA-1 for: ' + mixedPath + '\n');
          return { sha1, content: data };
        } catch (readErr) {
          // file unreadable - rethrow original
        }
      }
      throw err;
    }
  };

  process.stderr.write('[sha1-fix] patched DependencyGraph from: ' + hint + '\n');
}
