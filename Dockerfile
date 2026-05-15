# ─── Build Stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* .npmrc ./

# Install ALL dependencies (including devDependencies for build)
RUN CI=true corepack pnpm install --prefer-offline --prod=false --shamefully-hoist

# Copy source files needed for build
COPY server/ ./server/
COPY shared/ ./shared/
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY scripts/ ./scripts/

# Build the server
RUN pnpm build

# ─── Production Stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* .npmrc ./

# Install only production dependencies
RUN CI=true corepack pnpm install --prefer-offline --prod --shamefully-hoist

# Copy built server
COPY --from=builder /app/dist ./dist

# Copy server assets (landing page, static files)
COPY server/landing ./server/landing

# Copy drizzle migrations
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
