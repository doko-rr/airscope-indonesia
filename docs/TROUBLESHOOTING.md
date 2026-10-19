# Troubleshooting

## Docker Disk Usage

```bash
docker system df
docker builder prune --force
```

## Mosquitto

```bash
docker compose ps mqtt
docker compose logs --tail 100 mqtt
```

## API MQTT Connection

```text
MQTT_ENABLED=true
MQTT_URL=mqtt://mqtt:1883
```

```bash
docker compose logs --tail 150 api
```

## Reset Containers

```bash
docker compose down --remove-orphans
```

Use `docker compose down --volumes` only for an intentional data reset.
