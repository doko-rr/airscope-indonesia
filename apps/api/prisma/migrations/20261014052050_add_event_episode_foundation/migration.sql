-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "conditionKey" TEXT,
    "episodeNumber" INTEGER NOT NULL DEFAULT 1,
    "sensorCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "clearedAt" DATETIME,
    "acknowledgedAt" DATETIME,
    "acknowledgedBy" TEXT,
    "acknowledgmentNote" TEXT,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "source" TEXT NOT NULL DEFAULT 'DERIVED_SIMULATION',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AlertEvent" ("acknowledgedAt", "acknowledgedBy", "acknowledgmentNote", "createdAt", "detail", "fingerprint", "id", "occurredAt", "resolutionNote", "resolvedAt", "resolvedBy", "sensorCode", "severity", "source", "status", "title", "type", "updatedAt") SELECT "acknowledgedAt", "acknowledgedBy", "acknowledgmentNote", "createdAt", "detail", "fingerprint", "id", "occurredAt", "resolutionNote", "resolvedAt", "resolvedBy", "sensorCode", "severity", "source", "status", "title", "type", "updatedAt" FROM "AlertEvent";
DROP TABLE "AlertEvent";
ALTER TABLE "new_AlertEvent" RENAME TO "AlertEvent";

UPDATE "AlertEvent"
SET
  "conditionKey" = "fingerprint",
  "episodeNumber" = 1
WHERE "conditionKey" IS NULL;

CREATE UNIQUE INDEX "AlertEvent_fingerprint_key" ON "AlertEvent"("fingerprint");
CREATE INDEX "AlertEvent_conditionKey_status_idx" ON "AlertEvent"("conditionKey", "status");
CREATE INDEX "AlertEvent_sensorCode_occurredAt_idx" ON "AlertEvent"("sensorCode", "occurredAt");
CREATE INDEX "AlertEvent_status_severity_idx" ON "AlertEvent"("status", "severity");
CREATE INDEX "AlertEvent_type_status_idx" ON "AlertEvent"("type", "status");
CREATE UNIQUE INDEX "AlertEvent_conditionKey_episodeNumber_key" ON "AlertEvent"("conditionKey", "episodeNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
