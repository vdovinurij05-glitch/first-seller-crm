-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_deal_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "eventType" TEXT,
    "metadata" TEXT,
    "sentToTelegram" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealId" TEXT NOT NULL,
    "userId" TEXT,
    CONSTRAINT "deal_comments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deal_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_deal_comments" ("content", "createdAt", "dealId", "id", "sentToTelegram", "type", "userId") SELECT "content", "createdAt", "dealId", "id", "sentToTelegram", "type", "userId" FROM "deal_comments";
DROP TABLE "deal_comments";
ALTER TABLE "new_deal_comments" RENAME TO "deal_comments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
