# syntax=docker/dockerfile:1

# Shared base: Node + pnpm via corepack.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Install full workspace dependencies (including devDependencies) using only
# manifest files, so this layer stays cached while application code changes.
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

# Build every workspace (contracts -> db -> api/web, ordered by Turborepo).
FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_URL=http://api:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

# Production-only dependencies for the slim runtime images below.
FROM base AS prod-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile --prod

# ---- API runtime ----
FROM base AS api
ENV NODE_ENV=production
RUN addgroup -S bridgeos && adduser -S bridgeos -G bridgeos
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=prod-deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
RUN mkdir -p /app/data/documents && chown -R bridgeos:bridgeos /app/data
USER bridgeos
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]

# ---- Web runtime (Next.js standalone output) ----
FROM base AS web
ENV NODE_ENV=production
RUN addgroup -S bridgeos && adduser -S bridgeos -G bridgeos
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
# Next's fetch Data Cache writes here at runtime; the standalone output only
# ships build-time files owned by root, so the non-root user needs it created
# and writable ahead of time or every cache write silently fails.
RUN mkdir -p /app/apps/web/.next/cache && chown -R bridgeos:bridgeos /app/apps/web/.next/cache
USER bridgeos
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
