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

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/dist-web /usr/share/nginx/html

# Config nginx SPA com porta fixa 8080 (padrão Railway para nginx)
RUN printf 'server {\n\
    listen 8080;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri.html $uri/ /index.html;\n\
    }\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript;\n\
}\n' > /etc/nginx/conf.d/default.conf

# Remover config padrão que ocupa porta 80
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
