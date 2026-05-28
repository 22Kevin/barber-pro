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
RUN node scripts/patch-metro.js

# Diagnóstico: verificar se o patch foi aplicado e qual arquivo está sendo usado
RUN echo "=== Metro location ===" && \
    find node_modules -name "DependencyGraph.js" -path "*/node-haste/*" 2>/dev/null && \
    echo "=== Patch marker check ===" && \
    find node_modules -name "DependencyGraph.js" -path "*/node-haste/*" -exec grep -l "css-interop-sha1-patch" {} \; && \
    echo "=== Line 188-195 of each DependencyGraph.js ===" && \
    find node_modules -name "DependencyGraph.js" -path "*/node-haste/*" -exec sh -c 'echo "FILE: $1"; sed -n "188,195p" "$1"' _ {} \;

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    EXPO_DEBUG=1 \
    npx expo export --platform web --output-dir /app/dist-web 2>&1 | tee /tmp/expo-export.log; \
    EXIT=$?; \
    if [ $EXIT -ne 0 ]; then \
      echo "=== FULL ERROR LOG ==="; \
      cat /tmp/expo-export.log; \
      echo "=== LAST 100 LINES ==="; \
      tail -100 /tmp/expo-export.log; \
      exit $EXIT; \
    fi

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
