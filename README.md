# AirScope Indonesia

AirScope Indonesia adalah platform pemantauan kualitas udara yang menggabungkan data stasiun sensor, pengukuran lingkungan, dan alur operasional alert dalam satu workspace.

Repository ini berisi aplikasi web berbasis Next.js, API berbasis NestJS, persistensi event menggunakan Prisma dan SQLite, serta sistem Event Episodes untuk menyimpan riwayat kemunculan ulang kondisi secara terpisah.

## Status Proyek

Status pengembangan saat ini:

```text
Branch aktif              feature/event-episodes
Milestone terbaru         Event Episodes Stage 3A
API unit tests            12 lulus
API typecheck             lulus
API build                 lulus
Web typecheck             lulus
Web production build      lulus
Fresh database migration  lulus
Working tree              bersih
```

Checkpoint terbaru:

```text
checkpoint/event-episodes-stage3a-20261014-141338
```

Tahap berikutnya:

```text
Event Episodes Stage 3B
```

Stage 3B akan memfinalkan constraint schema dan menambahkan integration test menggunakan SQLite sungguhan.

## Fitur Utama

### Monitoring sensor

- Direktori stasiun sensor
- Halaman detail sensor
- Pengukuran lingkungan terbaru
- Status operasional stasiun
- Kondisi kualitas udara dan telemetry

### Event operations

- Event tersimpan di database
- Severity dan status tracking
- Acknowledge event dengan audit operator
- Resolve event dengan catatan operator
- Auto-resolution ketika kondisi pulih
- Riwayat episode ketika kondisi yang sama muncul kembali

### Event Episodes

Setiap kondisi memiliki `conditionKey` yang stabil.

```text
BDG-AQ-003:AIR_QUALITY_ADVISORY
```

Pembacaan berulang tetap menggunakan episode yang sama. Episode baru hanya dibuat setelah kondisi sebelumnya benar-benar pulih dan kemudian muncul kembali.

```text
Episode 1 ACTIVE
→ ACKNOWLEDGED
→ RESOLVED
→ kondisi pulih
→ kondisi muncul kembali
→ Episode 2 ACTIVE dengan ID baru
```

Makna timestamp event:

```text
occurredAt
Waktu episode pertama kali muncul

lastObservedAt
Waktu terakhir kondisi masih terdeteksi

resolvedAt
Waktu event ditutup oleh operator atau sistem

clearedAt
Waktu kondisi sensor benar-benar hilang
```

## Technology Stack

### Web

- Next.js
- React
- TypeScript
- Turbopack

### API

- NestJS
- TypeScript
- Prisma
- SQLite
- Prisma Better SQLite adapter
- Vitest

### Workspace

- pnpm workspace
- Turborepo
- Prettier
- oxlint

## Struktur Repository

```text
airscope-indonesia/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── database/
│   │   │   ├── generated/prisma/
│   │   │   └── modules/
│   │   │       ├── events/
│   │   │       └── sensors/
│   │   └── test/
│   └── web/
│       └── src/
├── packages/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Menjalankan Proyek

Clone repository:

```bash
git clone https://github.com/doko-rr/airscope-indonesia.git
cd airscope-indonesia
```

Install dependencies:

```bash
pnpm install
```

Siapkan environment API:

```bash
cp apps/api/.env.example apps/api/.env
```

Siapkan database dan Prisma Client:

```bash
pnpm --filter api db:setup
```

Jalankan development workspace:

```bash
pnpm dev
```

Alamat lokal default:

```text
Web  http://localhost:3000
API  http://localhost:4000/api/v1
```

## Environment

Contoh konfigurasi API:

```env
PORT=4000
DATABASE_URL=file:./prisma/dev.db
```

Contoh konfigurasi root:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=file:./prisma/dev.db
```

File environment lokal dan database development tidak boleh masuk Git.

## Perintah Development

Jalankan workspace:

```bash
pnpm dev
```

Typecheck seluruh workspace:

```bash
pnpm typecheck
```

Jalankan seluruh test:

```bash
pnpm test
```

Build seluruh workspace:

```bash
pnpm build
```

Format file proyek:

```bash
pnpm format
```

## Perintah API

```bash
pnpm --filter api dev
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter api start:prod
```

## Perintah Database

Generate Prisma Client:

```bash
pnpm --filter api prisma:generate
```

Format Prisma schema:

```bash
pnpm --filter api prisma:format
```

Buat development migration:

```bash
pnpm --filter api db:migrate:dev
```

Deploy migration yang tersedia:

```bash
pnpm --filter api db:migrate:deploy
```

Periksa status migration:

```bash
pnpm --filter api db:status
```

Setup database:

```bash
pnpm --filter api db:setup
```

Buka Prisma Studio:

```bash
pnpm --filter api db:studio
```

Hindari database reset pada database yang memiliki data yang perlu dipertahankan.

## API Endpoints

Base URL:

```text
http://localhost:4000/api/v1
```

Endpoint yang tersedia:

```text
GET    /health
GET    /sensors
GET    /sensors/:code
GET    /sensors/:code/latest
GET    /sensors/:code/measurements
GET    /events
GET    /sensors/:code/events
PATCH  /events/:id/acknowledge
PATCH  /events/:id/resolve
```

Health check:

```bash
curl -fS http://localhost:4000/api/v1/health | python3 -m json.tool
```

Event history:

```bash
curl -fS http://localhost:4000/api/v1/events | python3 -m json.tool
```

## Event Lifecycle

```text
ACTIVE
Kondisi sedang berlangsung dan belum diakui operator

ACKNOWLEDGED
Operator telah meninjau event, tetapi kondisi dapat tetap berlangsung

RESOLVED
Event telah ditutup oleh operator atau sistem
```

Resolution dan recovery dipisahkan. Resolve manual tidak langsung membuat episode baru selama kondisi sensor masih aktif. Episode berikutnya hanya dapat dibuat setelah `clearedAt` terisi.

## Testing

Cakupan test saat ini meliputi:

- Informasi API dan health behavior
- Konstruksi Prisma service
- Sensor service behavior
- Pembacaan event berulang tanpa duplikasi
- Manual resolve tanpa premature reopening
- Automatic clearing event episode
- Recurrence yang membuat episode baru
- Stabilitas waktu awal episode
- Pembaruan waktu observasi terakhir

Hasil unit test terbaru:

```text
Test files  4 passed
Tests       12 passed
```

## Data Safety

Proyek menggunakan workflow checkpoint sebelum perubahan kritikal.

```bash
git status --short
git tag "checkpoint/deskripsi-$(date +%Y%m%d-%H%M%S)"
git push origin --tags
```

Checkpoint dibuat sebelum migration, perubahan persistence, merge, dan pekerjaan berisiko tinggi lainnya.

## Roadmap

### Selesai

- Workspace dan application shell
- Sensor listing dan sensor detail
- Persisted alert events
- Event acknowledgment workflow
- Event resolution workflow
- Database deployment hardening
- Fresh-clone database setup
- Recurring event episode algorithm
- Episode timestamps dengan `lastObservedAt`

### Sedang dikerjakan

- Final event episode schema constraints
- SQLite integration test dengan Prisma adapter nyata

### Direncanakan

- Tampilan episode di antarmuka web
- Visualisasi durasi episode dan recovery
- Concurrent episode creation hardening
- End-to-end coverage yang lebih luas
- Strategi production database
- Deployment dan observability documentation

## Titik Lanjut Pengembangan

Tahap berikutnya adalah Event Episodes Stage 3B:

```text
Membuat conditionKey wajib
Membuat lastObservedAt wajib
Menambahkan SQLite integration tests
Menguji unique constraint episode
Menguji audit operator tetap terjaga
Menguji dua episode historis secara end to end
```

Checkpoint awal:

```text
checkpoint/event-episodes-stage3a-20261014-141338
```

## Kontribusi

Gunakan feature branch dan checkpoint sebelum perubahan kritikal.

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/nama-fitur
```

Validasi sebelum commit:

```bash
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter api build
pnpm --filter web typecheck
pnpm --filter web build
git diff --check
```

Contoh pesan commit:

```text
feat(api): create recurring event episodes
fix(api): normalize generated Prisma whitespace
chore(api): harden Prisma database setup
```

## License

Lisensi repository belum ditentukan. Tambahkan lisensi eksplisit sebelum distribusi publik atau kontribusi eksternal.

## Catatan

AirScope Indonesia masih aktif dikembangkan. Interface, migration, dan kebutuhan environment dapat berubah hingga workflow Event Episodes dan integration test selesai difinalkan.

## Docker Deployment

AirScope Indonesia includes production-oriented Docker images for the API and
Web application, together with a Docker Compose stack and a persistent SQLite
volume.

```bash
docker compose config --quiet
docker compose build
docker compose up --detach
```

Open:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- API readiness: `http://localhost:4000/api/v1/ready`

Inspect the running stack:

```bash
docker compose ps
docker compose logs --follow
```

Stop the stack while preserving SQLite data:

```bash
docker compose down
```

Delete containers and the persistent database volume:

```bash
docker compose down --volumes
```

See docs/DEPLOYMENT.md for environment variables,
container networking, health checks, persistence, migrations, logs, operating
procedures, and troubleshooting.
