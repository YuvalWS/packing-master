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

# ---- build stage (stub for phase 4) ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime stage (stub for phase 4) ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
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
