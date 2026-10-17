-- File d'attente des analyses IA : langue de l'analyse et verrou de traitement
ALTER TABLE "ResourceVersion" ADD COLUMN "aiLanguage" TEXT;

CREATE TABLE "Lease" (
    "name" TEXT NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("name")
);

-- Analyses échouées ou en attente : elles repartent dans la file
UPDATE "ResourceVersion" SET "aiStatus" = 'QUEUED' WHERE "aiStatus" IN ('PENDING', 'FAILED');
