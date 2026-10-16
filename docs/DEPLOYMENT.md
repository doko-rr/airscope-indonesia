# AirScope Indonesia Deployment

AirScope Indonesia provides production-oriented Docker images for the NestJS API and Next.js Web application.

## Architecture

The Docker Compose stack contains:

- `api`: NestJS API on port `4000`
- `web`: Next.js standalone server on port `3000`
- `airscope-data`: persistent SQLite volume

The Web application uses two API URLs:

- `NEXT_PUBLIC_API_URL`: used by the user's browser
- `API_INTERNAL_URL`: used by the Next.js server inside the Docker network

For local Docker Compose deployment:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
API_INTERNAL_URL=http://api:4000/api/v1

```
