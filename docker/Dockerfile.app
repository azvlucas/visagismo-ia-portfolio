# syntax=docker/dockerfile:1.7
# API + Worker (+ migrate/seed). BuildKit cache = deploys bem mais rápidos.
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ─── 1) Só manifests → layer de install quase nunca muda ───
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json packages/db/
COPY packages/generation/package.json packages/generation/
COPY packages/queue/package.json packages/queue/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
# Placeholder mínimo para o workspace resolver (fonte entra no stage build)
RUN mkdir -p packages/shared/src packages/domain/src packages/db/src \
      packages/generation/src packages/queue/src apps/api/src apps/worker/src \
 && printf 'export {};\n' > packages/shared/src/index.ts \
 && printf 'export {};\n' > packages/domain/src/index.ts \
 && printf 'export {};\n' > packages/db/src/index.ts \
 && printf 'export {};\n' > packages/generation/src/index.ts \
 && printf 'export {};\n' > packages/queue/src/index.ts \
 && printf 'export {};\n' > apps/api/src/main.ts \
 && printf 'export {};\n' > apps/worker/src/main.ts

# Cache do store pnpm no host (Coolify/BuildKit)
RUN --mount=type=cache,id=visagismo-pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile \
      --filter @visagismo/api... \
      --filter @visagismo/worker... \
      --filter @visagismo/db... \
    || pnpm install \
      --filter @visagismo/api... \
      --filter @visagismo/worker... \
      --filter @visagismo/db...

# ─── 2) Código-fonte + build (só esta layer invalida com git push) ───
FROM deps AS build
COPY packages/shared packages/shared
COPY packages/domain packages/domain
COPY packages/db packages/db
COPY packages/generation packages/generation
COPY packages/queue packages/queue
COPY packages/tsconfig packages/tsconfig
COPY apps/api apps/api
COPY apps/worker apps/worker
# Reinstala leve se package.json mudou no COPY (raro); reusa store em cache
RUN --mount=type=cache,id=visagismo-pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile \
      --filter @visagismo/api... \
      --filter @visagismo/worker... \
      --filter @visagismo/db... \
    || true
RUN pnpm --filter @visagismo/shared build \
 && pnpm --filter @visagismo/domain build \
 && pnpm --filter @visagismo/db build \
 && pnpm --filter @visagismo/generation build \
 && pnpm --filter @visagismo/queue build \
 && pnpm --filter @visagismo/api build \
 && pnpm --filter @visagismo/worker build

# ─── 3) Runtime (mesmo comportamento: monorepo com dist) ───
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
