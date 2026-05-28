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
COPY shared/ ./shared/
COPY scripts/ ./scripts/
COPY global.css ./
COPY babel.config.js ./
COPY app.config.ts ./
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY theme.config.js ./

RUN mkdir -p node_modules/react-native-css-interop/.cache && \
    touch node_modules/react-native-css-interop/.cache/web.css

RUN cat > metro.config.js << 'METROEOF'
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
config.projectRoot = projectRoot;
config.watchFolders = [projectRoot];
module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
METROEOF

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

# ─── Runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Usar npx serve em vez de instalar globalmente
RUN npm install -g serve@14.2.4

COPY --from=builder /app/dist-web ./dist-web

# Verificar que os arquivos existem
RUN ls dist-web/ && echo "dist-web OK"

EXPOSE 3000

# PORT é injetado pelo Railway — usar variável de ambiente
CMD ["sh", "-c", "serve dist-web -p ${PORT:-3000} --single --no-clipboard"]
