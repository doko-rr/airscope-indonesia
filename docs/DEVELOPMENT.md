# Development Guide

## Install and Run

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

## Validate

```bash
pnpm run format:check
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
docker compose config --quiet
```

## Prisma

```bash
pnpm --filter api prisma:generate
pnpm --filter api db:migrate:deploy
pnpm --filter api db:status
```
