FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace


FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install \
  --frozen-lockfile \
  --filter web...


FROM dependencies AS builder

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY apps/web apps/web

RUN pnpm --filter web build


FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder \
  --chown=nextjs:nodejs \
  /workspace/apps/web/.next/standalone/ \
  ./

COPY --from=builder \
  --chown=nextjs:nodejs \
  /workspace/apps/web/.next/static \
  /app/apps/web/.next/static

COPY --from=builder \
  --chown=nextjs:nodejs \
  /workspace/apps/web/public \
  /app/apps/web/public

USER nextjs

EXPOSE 3000

WORKDIR /app/apps/web

CMD ["node", "server.js"]
