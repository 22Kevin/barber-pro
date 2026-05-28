FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc ./
COPY patches/ ./patches/
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.type;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"

# pnpm.patchedDependencies in package.json applies patches/react-native-css-interop@0.2.1.patch
# automatically, redirecting outputDirectory from node_modules/.cache to .css-interop-cache/
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

# Pre-create .css-interop-cache/ so Metro hasteFS knows about it from startup
RUN mkdir -p .css-interop-cache && \
    for f in web.css ios.js android.js native.js macos.js windows.js; do \
      touch .css-interop-cache/$f; \
    done

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist-web ./dist-web
COPY app-server.cjs ./

RUN ls -la /app/ && ls -la /app/dist-web/ | head -5 && echo "Files OK"

EXPOSE 3000
CMD ["sh", "-c", "echo 'Starting on PORT='$PORT && node /app/app-server.cjs"]
