# Architecture

## System Context

AirScope Indonesia accepts simulated measurements and MQTT telemetry, exposes sensor and event APIs, and serves a Next.js dashboard.

## Components

- Device simulator and future STM32 firmware
- Mosquitto MQTT broker
- NestJS API with telemetry validation and event derivation
- SQLite alert persistence
- Next.js dashboard

## Data Flow

```text
Device -> Mosquitto -> MQTT client -> TelemetryService
       -> SensorsService -> REST API -> Next.js Web
```

When live telemetry is unavailable, SensorsService returns deterministic simulated telemetry.
