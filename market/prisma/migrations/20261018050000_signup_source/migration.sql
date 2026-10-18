-- Provenance des inscriptions (site d'origine, lien, page d'arrivée, pays)
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupCountry" TEXT,
ADD COLUMN     "signupLanding" TEXT,
ADD COLUMN     "signupReferrer" TEXT,
ADD COLUMN     "signupSource" TEXT;

