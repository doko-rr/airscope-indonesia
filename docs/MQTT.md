# MQTT Telemetry

## Broker

```bash
docker compose up --detach mqtt
docker compose ps mqtt
```

## Topic

```text
airscope/v1/stations/{stationCode}/telemetry
```

## Contract

Telemetry Contract V1 includes a schema version, message ID, station code, UTC timestamp, measurements, and device metadata.

The API rejects malformed, duplicate, mismatched, and stale payloads.

## Simulator

```bash
pnpm --filter api telemetry:simulate
```
