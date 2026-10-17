-- Analyse IA du contenu des ressources (correspondance avec la description, qualité)
ALTER TABLE "Resource" ADD COLUMN "aiVerified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ResourceVersion" ADD COLUMN "aiStatus" TEXT;
ALTER TABLE "ResourceVersion" ADD COLUMN "aiMatch" INTEGER;
ALTER TABLE "ResourceVersion" ADD COLUMN "aiQuality" INTEGER;
ALTER TABLE "ResourceVersion" ADD COLUMN "aiFlagged" BOOLEAN;
ALTER TABLE "ResourceVersion" ADD COLUMN "aiReport" TEXT;
ALTER TABLE "ResourceVersion" ADD COLUMN "aiAt" TIMESTAMP(3);
ALTER TABLE "ResourceVersion" ADD COLUMN "aiAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ResourceVersion" ADD COLUMN "aiReviewed" BOOLEAN NOT NULL DEFAULT false;
