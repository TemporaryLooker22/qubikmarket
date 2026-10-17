-- Historique des versions des ressources (modification et nouvelles versions)
ALTER TABLE "Resource" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "Resource" ADD COLUMN "versionUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Purchase" ADD COLUMN "lastDownloadedAt" TIMESTAMP(3);

CREATE TABLE "ResourceVersion" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "notes" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "scanVerdict" TEXT NOT NULL,
    "scanScore" INTEGER NOT NULL,
    "scanReport" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResourceVersion_resourceId_version_key" ON "ResourceVersion"("resourceId", "version");
CREATE INDEX "ResourceVersion_resourceId_createdAt_idx" ON "ResourceVersion"("resourceId", "createdAt");
ALTER TABLE "ResourceVersion" ADD CONSTRAINT "ResourceVersion_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chaque ressource existante reçoit sa version 1.0 (son fichier actuel)
INSERT INTO "ResourceVersion" ("id", "resourceId", "version", "fileName", "filePath", "fileSize", "scanVerdict", "scanScore", "scanReport", "status", "reviewNote", "createdAt")
SELECT 'v1_' || "id", "id", '1.0', "fileName", "filePath", "fileSize", "scanVerdict", "scanScore", "scanReport",
  CASE "status" WHEN 'PENDING' THEN 'PENDING' WHEN 'REJECTED' THEN 'REJECTED' ELSE 'LIVE' END,
  "reviewNote", "createdAt"
FROM "Resource";
