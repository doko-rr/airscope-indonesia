FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace


FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install \
  --frozen-lockfile \
  --filter api...


FROM dependencies AS builder

ENV DATABASE_URL=file:./prisma/build.db

COPY apps/api apps/api

RUN pnpm --filter api prisma:generate
RUN pnpm --filter api build

RUN pnpm --filter api deploy \
  --prod \
  /runtime


FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL=file:/data/airscope.db
ENV FRONTEND_URL=http://localhost:3000

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd \
    --system \
    --uid 1001 \
    --gid nodejs \
    --home-dir /app \
    airscope \
  && mkdir -p /data \
  && chown -R airscope:nodejs /app /data

COPY --from=builder \
  --chown=airscope:nodejs \
  /runtime/ \
  /app/

COPY --from=builder \
  --chown=airscope:nodejs \
  /workspace/apps/api/docker/entrypoint.sh \
  /usr/local/bin/airscope-api-entrypoint

RUN chmod +x \
  /usr/local/bin/airscope-api-entrypoint

USER airscope

EXPOSE 4000

VOLUME ["/data"]

HEALTHCHECK \
  --interval=10s \
  --timeout=3s \
  --start-period=20s \
  --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["airscope-api-entrypoint"]
