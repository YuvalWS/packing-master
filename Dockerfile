# syntax=docker/dockerfile:1.7

# ---- dev stage ----
# Used by docker compose for local development. Source is bind-mounted at runtime,
# so we only need the deps installed in the image to seed /app/node_modules.
FROM node:20-alpine AS dev
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

# ---- runtime stage ----
# Production image used by deploy/compose.yml. Migrations run on start (RUN_MIGRATIONS=1).
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 RUN_MIGRATIONS=1
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/migrations ./migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5   CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "build"]

# ---- e2e stage ----
# Playwright base image ships node 20 + browser binaries + system libraries
# that the alpine image cannot provide. The compose service mounts source
# over /app and the named node_modules volume preserves baked deps.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS e2e
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "test:e2e"]
