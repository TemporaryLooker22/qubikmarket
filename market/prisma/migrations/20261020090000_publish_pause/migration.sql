-- AlterTable
ALTER TABLE "User" ADD COLUMN     "publishPauseSeen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publishPausedUntil" TIMESTAMP(3);

