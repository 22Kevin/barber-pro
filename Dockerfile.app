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
COPY metro.config.js ./
COPY metro.config.cjs ./
COPY babel.config.cjs ./
COPY app.config.js ./
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY tailwind.config.cjs ./
COPY theme.config.cjs ./
COPY theme.config.d.ts* ./
COPY shared/ ./shared/

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_BASE_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist-web ./dist-web
COPY app-server.cjs ./

RUN ls -la /app/ && ls -la /app/dist-web/ | head -5 && echo "Files OK"

EXPOSE 3000
CMD ["sh", "-c", "echo 'Starting on PORT='$PORT && node /app/app-server.cjs"]
