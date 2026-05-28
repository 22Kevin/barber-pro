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
    touch node_modules/react-native-css-interop/.cache/web.css

RUN EXPO_NO_METRO_WORKSPACE_ROOT=1 \
    EXPO_PUBLIC_API_URL=https://usebarberpro.com \
    npx expo export --platform web --output-dir /app/dist-web

# ─── Runner — servidor Node.js puro, sem dependências externas ────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist-web ./dist-web

# Servidor HTTP estático em Node.js puro — zero dependências
RUN cat > server.js << 'JSEOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'dist-web');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url.split('?')[0]);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, 'index.html');
  }
  const ext = path.extname(filePath);
  const ct = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});
JSEOF

EXPOSE 3000
CMD ["node", "server.js"]
