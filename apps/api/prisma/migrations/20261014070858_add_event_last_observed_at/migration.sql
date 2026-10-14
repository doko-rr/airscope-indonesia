-- AlterTable
ALTER TABLE "AlertEvent" ADD COLUMN "lastObservedAt" DATETIME;

UPDATE "AlertEvent"
SET "lastObservedAt" = "occurredAt"
WHERE "lastObservedAt" IS NULL;
