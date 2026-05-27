# ─── Detecta qual serviço buildar via variável SERVICE_TYPE ───────────────────
ARG SERVICE_TYPE=server

# ════════════════════════════════════════════════════════════════════════════════
# BUILD STAGE — SERVER
# ════════════════════════════════════════════════════════════════════════════════
FROM node:22-alpine AS server-builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc ./
RUN CI=true corepack pnpm install --prefer-offline --prod=false --shamefully-hoist

COPY server/ ./server/
COPY shared/ ./shared/
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY scripts/ ./scripts/

RUN pnpm build

# ════════════════════════════════════════════════════════════════════════════════
# BUILD STAGE — APP WEB
# ════════════════════════════════════════════════════════════════════════════════
FROM node:22-alpine AS app-builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc ./
RUN CI=true corepack pnpm install --prefer-offline --shamefully-hoist

COPY . .

RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.type;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

# ════════════════════════════════════════════════════════════════════════════════
# PRODUCTION STAGE — SERVER
# ════════════════════════════════════════════════════════════════════════════════
FROM node:22-alpine AS server-runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc ./
RUN CI=true corepack pnpm install --prefer-offline --prod --shamefully-hoist

COPY --from=server-builder /app/dist ./dist
COPY server/landing ./server/landing
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]

# ════════════════════════════════════════════════════════════════════════════════
# PRODUCTION STAGE — APP WEB
# ════════════════════════════════════════════════════════════════════════════════
FROM node:22-alpine AS app-runner

WORKDIR /app

RUN npm install -g serve@14

COPY --from=app-builder /app/dist-web ./dist-web

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["serve", "dist-web", "-p", "3000", "--single"]
