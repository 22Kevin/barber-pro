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

# Metro config com watchFolders incluindo o cache do css-interop
RUN cat > metro.config.js << 'METROEOF'
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Incluir cache do react-native-css-interop no watchFolders
const cssInteropCache = path.join(__dirname, "node_modules/react-native-css-interop/.cache");
config.watchFolders = [...(config.watchFolders || []), __dirname];
config.resolver = {
  ...config.resolver,
  blockList: [],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
METROEOF

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve@14
COPY --from=builder /app/dist-web ./dist-web
EXPOSE 3000
CMD ["serve", "dist-web", "-p", "3000", "--single"]
