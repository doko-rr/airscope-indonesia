-- CreateTable
CREATE TABLE "TelemetryMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "stationCode" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MQTT',
    "pm25UgM3" REAL NOT NULL,
    "pm10UgM3" REAL NOT NULL,
    "coPpm" REAL NOT NULL,
    "co2Ppm" REAL NOT NULL,
    "no2Ppb" REAL NOT NULL,
    "so2Ppb" REAL NOT NULL,
    "o3Ppb" REAL NOT NULL,
    "temperatureC" REAL NOT NULL,
    "humidityPct" REAL NOT NULL,
    "pressureHpa" REAL NOT NULL,
    "deviceStatus" TEXT NOT NULL,
    "batteryVoltage" REAL NOT NULL,
    "rssiDbm" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "firmware" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TelemetryMeasurement_messageId_key" ON "TelemetryMeasurement"("messageId");

-- CreateIndex
CREATE INDEX "TelemetryMeasurement_stationCode_observedAt_idx" ON "TelemetryMeasurement"("stationCode", "observedAt");

-- CreateIndex
CREATE INDEX "TelemetryMeasurement_observedAt_idx" ON "TelemetryMeasurement"("observedAt");
