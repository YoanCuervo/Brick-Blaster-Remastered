# API image. Build from the repository root:
#   docker build -f deploy/api.Dockerfile -t brick-blaster-api .
# It holds no asset and no secret: the pack and the env file are mounted at run time.

FROM node:24-trixie-slim AS base
WORKDIR /src
# The lockfile names every workspace: npm ci needs all their manifests, not their sources.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
COPY packages/game/package.json packages/game/
COPY packages/contracts/package.json packages/contracts/

FROM base AS build
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci -w @brick-blaster/api --include-workspace-root --no-audit --no-fund
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN npm run build -w @brick-blaster/api

FROM base AS prod-deps
# Vite bundles the workspace packages into dist/: only the npm ones stay external.
RUN npm ci -w @brick-blaster/api --omit=dev --no-audit --no-fund \
  && rm -rf node_modules/@brick-blaster

FROM node:24-trixie-slim
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=prod-deps /src/node_modules /app/node_modules
COPY --from=build /src/apps/api/dist dist/
# dist/migrate.js reads the SQL files from ../migrations.
COPY apps/api/migrations migrations/
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
