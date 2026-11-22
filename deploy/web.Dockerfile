# Website build: no container ever runs from it. BuildKit writes dist/ to a folder that Caddy
# serves, from the repository root:
#   docker build -f deploy/web.Dockerfile --output type=local,dest=/srv/brick-blaster/web .
# .dockerignore keeps assets/ out, so Vite finds no public dir and the pack stays out of dist/.

FROM node:24-trixie-slim AS build
WORKDIR /src
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
COPY packages/game/package.json packages/game/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci -w @brick-blaster/web --include-workspace-root --no-audit --no-fund
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN npm run build -w @brick-blaster/web

FROM scratch
COPY --from=build /src/apps/web/dist /
