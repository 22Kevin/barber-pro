FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc ./
RUN CI=true corepack pnpm install --prefer-offline --shamefully-hoist

COPY app/ ./app/
COPY components/ ./components/
COPY constants/ ./constants/
COPY assets/ ./assets/
COPY hooks/ ./hooks/
COPY lib/ ./lib/
COPY global.css ./
COPY babel.config.js ./
COPY app.config.ts ./
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY tailwind.config.js ./
COPY shared/ ./shared/

# Remover type:module e criar metro.config.cjs (CommonJS explícito)
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.type;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"

RUN printf 'const { getDefaultConfig } = require("expo/metro-config");\nconst { withNativeWind } = require("nativewind/metro");\nconst config = getDefaultConfig(__dirname);\nmodule.exports = withNativeWind(config, { input: "./global.css", forceWriteFileSystem: true });\n' > metro.config.cjs

# Remover o metro.config.js original para evitar conflito
RUN rm -f metro.config.js

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g serve@14
COPY --from=builder /app/dist-web ./dist-web
EXPOSE 3000
CMD ["serve", "dist-web", "-p", "3000", "--single"]
