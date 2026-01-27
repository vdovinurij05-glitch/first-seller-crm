-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_calls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "mangoCallId" TEXT,
    "direction" TEXT NOT NULL,
    "phone" TEXT,
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "duration" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "result" TEXT,
    "recordingUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" DATETIME,
    "connectedTime" DATETIME,
    "answeredAt" DATETIME,
    "endTime" DATETIME,
    "endedAt" DATETIME,
    "contactId" TEXT,
    "managerId" TEXT,
    CONSTRAINT "calls_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "calls_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_calls" ("answeredAt", "contactId", "createdAt", "direction", "duration", "endedAt", "id", "managerId", "mangoCallId", "phone", "recordingUrl", "status") SELECT "answeredAt", "contactId", "createdAt", "direction", "duration", "endedAt", "id", "managerId", "mangoCallId", "phone", "recordingUrl", "status" FROM "calls";
DROP TABLE "calls";
ALTER TABLE "new_calls" RENAME TO "calls";
CREATE UNIQUE INDEX "calls_externalId_key" ON "calls"("externalId");
CREATE UNIQUE INDEX "calls_mangoCallId_key" ON "calls"("mangoCallId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
