FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc ./
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.type;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN CI=true corepack pnpm install --prefer-offline --shamefully-hoist

COPY app/ ./app/
COPY components/ ./components/
COPY constants/ ./constants/
COPY assets/ ./assets/
COPY hooks/ ./hooks/
COPY lib/ ./lib/
COPY global.css ./
COPY metro.config.cjs ./
COPY babel.config.js ./
COPY app.config.ts ./
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY tailwind.config.js ./
COPY theme.config.js ./
COPY theme.config.d.ts* ./
COPY shared/ ./shared/

RUN mkdir -p node_modules/react-native-css-interop/.cache && \
    for f in web.css ios.js android.js native.js macos.js windows.js; do \
      touch node_modules/react-native-css-interop/.cache/$f; \
    done

# Patch Metro DependencyGraph.js so it falls back to on-disk SHA-1 for files
# outside its watch set (e.g. react-native-css-interop/.cache/web.css).
# The css-interop plugin creates these files but never adds them to watchFolders,
# so Metro's hasteFS has no entry for them and throws "Failed to get the SHA-1".
# This patch: if getSha1/getOrComputeSha1 can't find the file in hasteFS and
# the file exists on disk, compute the SHA-1 directly from disk instead of throwing.
RUN node -e "
const fs = require('fs');
const path = require('path');
const file = path.resolve('node_modules/metro/src/node-haste/DependencyGraph.js');
let src = fs.readFileSync(file, 'utf8');
const patchMarker = '/* css-interop-patch */';
if (!src.includes(patchMarker)) {
  src = src
    .replace(
      'getSha1(filename) {\n    const sha1 = this._fileSystem.getSha1(filename);\n    if (!sha1) {\n      throw missingSha1Error(filename);\n    }\n    return sha1;\n  }',
      'getSha1(filename) {\n    ' + patchMarker + '\n    const sha1 = this._fileSystem.getSha1(filename);\n    if (!sha1) {\n      try {\n        const data = require(\"fs\").readFileSync(filename);\n        return require(\"crypto\").createHash(\"sha1\").update(data).digest(\"hex\");\n      } catch (_) { throw missingSha1Error(filename); }\n    }\n    return sha1;\n  }'
    )
    .replace(
      'async unstable_getOrComputeSha1(mixedPath) {\n    const result = await this._fileSystem.getOrComputeSha1(mixedPath);\n    if (!result || !result.sha1) {\n      throw missingSha1Error(mixedPath);\n    }\n    return result;\n  }',
      'async unstable_getOrComputeSha1(mixedPath) {\n    const result = await this._fileSystem.getOrComputeSha1(mixedPath);\n    if (!result || !result.sha1) {\n      try {\n        const data = require(\"fs\").readFileSync(mixedPath);\n        const sha1 = require(\"crypto\").createHash(\"sha1\").update(data).digest(\"hex\");\n        return { sha1, content: data };\n      } catch (_) { throw missingSha1Error(mixedPath); }\n    }\n    return result;\n  }'
    );
  fs.writeFileSync(file, src);
  console.log('Metro DependencyGraph.js patched OK');
} else {
  console.log('Metro DependencyGraph.js already patched');
}
"

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist-web ./dist-web
COPY app-server.cjs ./

# Verificar que os arquivos existem antes de iniciar
RUN ls -la /app/ && ls -la /app/dist-web/ | head -5 && echo "Files OK"

EXPOSE 3000

# Usar sh -c para garantir que $PORT seja lido em runtime
CMD ["sh", "-c", "echo 'Starting on PORT='$PORT && node /app/app-server.cjs"]
