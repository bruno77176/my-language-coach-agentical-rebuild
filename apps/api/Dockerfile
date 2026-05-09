# Single-stage Node + pnpm Dockerfile.
#
# Build context is the monorepo root (see fly.toml: dockerfile = "apps/api/Dockerfile").
# We deviated from the plan's multi-stage Bun image because Bun ignores pnpm-lock.yaml
# and would force a different lockfile in CI vs prod. Node + pnpm matches local dev.
# Image size ~600MB; multi-stage prod-only optimization can come in Plan 7 (polish).

FROM node:22-alpine

RUN corepack enable
WORKDIR /app

# Copy lockfile + every workspace package.json first so layer caching kicks in
# when only source changes (re-runs `pnpm install` only when deps change).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/

RUN pnpm install --frozen-lockfile

# Copy source and build the api.
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY packages/config packages/config

RUN pnpm -F @language-coach/api build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
