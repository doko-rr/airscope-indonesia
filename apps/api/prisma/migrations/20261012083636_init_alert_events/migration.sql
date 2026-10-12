-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "sensorCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "acknowledgedAt" DATETIME,
    "acknowledgedBy" TEXT,
    "acknowledgmentNote" TEXT,
    "resolvedAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'DERIVED_SIMULATION',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_fingerprint_key" ON "AlertEvent"("fingerprint");

-- CreateIndex
CREATE INDEX "AlertEvent_sensorCode_occurredAt_idx" ON "AlertEvent"("sensorCode", "occurredAt");

-- CreateIndex
CREATE INDEX "AlertEvent_status_severity_idx" ON "AlertEvent"("status", "severity");

-- CreateIndex
CREATE INDEX "AlertEvent_type_status_idx" ON "AlertEvent"("type", "status");
