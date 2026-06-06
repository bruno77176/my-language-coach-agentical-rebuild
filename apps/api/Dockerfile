# Single-stage Node + pnpm Dockerfile.
#
# Build context is the monorepo root (passed via --dockerfile + working-dir
# on the flyctl deploy command). We use tsx in production (not a separate
# tsc build step) because TypeScript ESM output doesn't add .js extensions
# to relative imports and Node ESM rejects extensionless module specifiers.
# tsx handles both TS and extensionless imports transparently. Tradeoff:
# ~100ms cold-start overhead. Optimization to esbuild bundling deferred to
# Plan 7 (polish) if it becomes a bottleneck.

FROM node:22-alpine

RUN corepack enable
WORKDIR /app

# Copy lockfile + every workspace package.json first so layer caching kicks in
# when only source changes (re-runs `pnpm install` only when deps change).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
# pnpm.patchedDependencies (root package.json) makes the lockfile reference
# patches/*.patch, so the patch files must be present before install or
# `pnpm install --frozen-lockfile` fails with ENOENT. (Patched dep is mobile-
# only, but the patch lives in the shared root lockfile this build installs.)
COPY patches patches

RUN pnpm install --frozen-lockfile

# Copy source. No tsc build step — tsx loads TS at runtime.
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY packages/config packages/config

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/apps/api
CMD ["node", "--import", "tsx", "src/index.ts"]
