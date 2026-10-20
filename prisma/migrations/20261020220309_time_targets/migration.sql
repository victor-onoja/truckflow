-- CreateTable
CREATE TABLE "TimeTarget" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "targetMin" INTEGER NOT NULL,
    "limitMin" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
);
