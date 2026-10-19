# API Reference

Base URL: `http://localhost:4000/api/v1`

## Platform

- `GET /`
- `GET /health`
- `GET /ready`

## Sensors

- `GET /sensors`
- `GET /sensors/:code`
- `GET /sensors/:code/latest`
- `GET /sensors/:code/measurements`

## Events

- `GET /events`
- `GET /events/sensor/:code`
- `PATCH /events/:id/acknowledge`
- `PATCH /events/:id/resolve`

Telemetry is ingested through MQTT. Every HTTP response includes `x-request-id`.
