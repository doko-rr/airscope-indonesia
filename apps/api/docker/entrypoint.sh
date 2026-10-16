#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is required." >&2
  exit 1
fi

case "$DATABASE_URL" in
  file:*)
    DATABASE_PATH="${DATABASE_URL#file:}"
    DATABASE_DIRECTORY="$(dirname "$DATABASE_PATH")"

    mkdir -p "$DATABASE_DIRECTORY"
    ;;
  *)
    echo "[ERROR] DATABASE_URL must use a file: URL." >&2
    exit 1
    ;;
esac

echo "[INFO] Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "[INFO] Starting AirScope API..."
exec node dist/src/main.js
