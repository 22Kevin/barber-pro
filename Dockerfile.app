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
COPY patches/ ./patches/
COPY tailwind.config.js ./
COPY theme.config.js ./
COPY theme.config.d.ts* ./
COPY shared/ ./shared/

RUN mkdir -p node_modules/react-native-css-interop/.cache .css-interop-cache && \
    for f in web.css ios.js android.js native.js macos.js windows.js; do \
      touch node_modules/react-native-css-interop/.cache/$f .css-interop-cache/$f; \
    done

# Find and overwrite ALL copies of css-interop dist/metro/index.js
# (pnpm may install the real module under .pnpm/ virtual store, not top-level)
RUN echo "=== All css-interop metro index.js locations ===" && \
    find node_modules -path "*/react-native-css-interop/dist/metro/index.js" 2>/dev/null && \
    find node_modules -path "*/react-native-css-interop/dist/metro/index.js" -exec sh -c \
      'echo "Overwriting: $1" && chmod 644 "$1" && cp patches/css-interop-metro-index.js "$1" && echo "OK: $1"' _ {} \; && \
    echo "=== Verifying line 17 of each ===" && \
    find node_modules -path "*/react-native-css-interop/dist/metro/index.js" \
      -exec sh -c 'echo "FILE: $1"; sed -n "17p" "$1"' _ {} \;

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web 2>&1; \
    EXIT=$?; \
    if [ $EXIT -ne 0 ]; then \
      echo "=== EXPO EXPORT FAILED — searching for error details ==="; \
      find /tmp -name "*.log" 2>/dev/null | xargs cat 2>/dev/null || true; \
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
