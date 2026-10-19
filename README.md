# AirScope Indonesia

Real-time air-quality monitoring with **Next.js**, **NestJS**, **MQTT**, and **Docker**.

[![CI](https://github.com/doko-rr/airscope-indonesia/actions/workflows/ci.yml/badge.svg)](https://github.com/doko-rr/airscope-indonesia/actions/workflows/ci.yml)
![Release](https://img.shields.io/badge/release-v0.6.0--mqtt--foundation-2563eb)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-12-f69220?logo=pnpm&logoColor=white)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)

## Overview

AirScope Indonesia is a local-first IoT platform for monitoring station telemetry, air-quality conditions, and operational alerts. Live MQTT measurements are used when available, with deterministic simulation as a reliable fallback.

```text
Device Simulator / STM32
          |
          v
    Mosquitto MQTT
          |
          v
      NestJS API ---- SQLite
          |
          v
      Next.js Web
```

## Highlights

- MQTT Telemetry Contract V1 with payload validation
- Broker-to-API ingestion with deduplication and stale protection
- Live telemetry with deterministic simulation fallback
- Persistent alert episodes with acknowledge and resolve workflows
- Request IDs, structured logs, health checks, and graceful shutdown
- Docker Compose with persistent SQLite and Mosquitto volumes
- Automated API, Web, migration, format, and Docker validation

## Tech Stack

- **Web:** Next.js, React, TypeScript
- **API:** NestJS, Prisma, SQLite
- **IoT:** MQTT.js, Eclipse Mosquitto
- **Tooling:** pnpm, Turborepo, Vitest
- **Operations:** Docker Compose, GitHub Actions

## Quick Start

### Requirements

- Node.js 24
- pnpm 12
- Docker Engine with Docker Compose

```bash
git clone https://github.com/doko-rr/airscope-indonesia.git
cd airscope-indonesia
corepack enable
pnpm install --frozen-lockfile
docker compose up --build --detach
```

Open:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Readiness: `http://localhost:4000/api/v1/ready`
- MQTT: `localhost:1883`

```bash
docker compose ps
docker compose down
```

## MQTT Telemetry

```text
airscope/v1/stations/{stationCode}/telemetry
```

Run the device simulator:

```bash
pnpm --filter api telemetry:simulate
```

The API validates every payload, rejects duplicate or stale messages, and exposes the latest accepted measurement through the sensor API.

## Repository Layout

```text
apps/api/          NestJS API, Prisma, MQTT ingestion, simulator
apps/web/          Next.js monitoring dashboard
docs/              Architecture and operating documentation
infrastructure/    Mosquitto configuration
compose.yaml       Local application stack
```

## Quality

Every push validates formatting, TypeScript, API unit and E2E tests, Prisma migrations, Web tests and builds, Compose configuration, and Docker images.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Development](docs/DEVELOPMENT.md)
- [Deployment](docs/DEPLOYMENT.md)
- [MQTT Telemetry](docs/MQTT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Roadmap

- Persisted telemetry history
- Real-time dashboard updates
- STM32 and Wokwi integration
- Device authentication
- Notification and escalation rules

## License

Licensed under the [MIT License](LICENSE).
