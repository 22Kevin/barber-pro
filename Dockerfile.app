# ─── Build Stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Instalar dependências
COPY package.json pnpm-lock.yaml* .npmrc ./
RUN CI=true corepack pnpm install --prefer-offline --shamefully-hoist

# Copiar todo o código fonte
COPY . .

# Remover type:module para o Expo funcionar
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.type;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"

# Build web
RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

# ─── Serve Stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN npm install -g serve@14

COPY --from=builder /app/dist-web ./dist-web

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["serve", "dist-web", "-p", "3000", "--single"]
