# ─── Build Stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copiar apenas o necessário para o app
COPY package.json pnpm-lock.yaml* .npmrc ./
RUN CI=true corepack pnpm install --prefer-offline --shamefully-hoist

# Copiar código fonte do app
COPY app/ ./app/
COPY components/ ./components/
COPY constants/ ./constants/
COPY assets/ ./assets/
COPY hooks/ ./hooks/
COPY lib/ ./lib/
COPY global.css ./
COPY babel.config.js ./
COPY metro.config.js ./
COPY app.config.ts ./
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY tailwind.config.js* ./

# Remover type:module temporariamente para o build do Expo
RUN node -e "const p=require('./package.json'); delete p.type; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2))"

# Build web
RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

# ─── Serve Stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Instalar servidor estático
RUN npm install -g serve@14

# Copiar build
COPY --from=builder /app/dist-web ./dist-web

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["serve", "dist-web", "-p", "3000", "--single"]
