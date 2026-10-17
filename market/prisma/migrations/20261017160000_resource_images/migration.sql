-- Captures d'écran des ressources (la première sert de miniature)
ALTER TABLE "Resource" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
