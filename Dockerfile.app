FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc ./
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.type;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN CI=true corepack pnpm install --prefer-offline --shamefully-hoist \
    --store-dir /app/.pnpm-store --package-import-method copy

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
COPY patches/ ./patches/
COPY tailwind.config.js ./
COPY theme.config.js ./
COPY theme.config.d.ts* ./
COPY shared/ ./shared/

RUN mkdir -p node_modules/react-native-css-interop/.cache .css-interop-cache && \
    for f in web.css ios.js android.js native.js macos.js windows.js; do \
      touch node_modules/react-native-css-interop/.cache/$f .css-interop-cache/$f; \
    done

# Overwrite Metro Bundler.js with patched version that catches SHA-1 errors
# and falls back to on-disk computation (fixes css-interop/.cache/web.css error).
# Patching Bundler.js instead of DependencyGraph.js because this is where the
# getOrComputeSha1 function is wrapped before being passed to the Transformer.
RUN find node_modules -path "*/metro/src/Bundler.js" \
      -exec sh -c 'echo "Patching: $1" && cp patches/metro-bundler.js "$1"' _ {} \; && \
    echo "Metro Bundler.js patched."

# Also patch DependencyGraph.js as defense in depth
RUN find node_modules -path "*/metro/src/node-haste/DependencyGraph.js" \
      -exec sh -c 'echo "Patching: $1" && cp patches/metro-dependency-graph.js "$1"' _ {} \; && \
    echo "Metro DependencyGraph.js patched."

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    NODE_OPTIONS="--require /app/scripts/metro-sha1-fix.cjs" \
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
