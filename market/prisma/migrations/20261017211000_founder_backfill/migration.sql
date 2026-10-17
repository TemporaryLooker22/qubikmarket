-- Vendeurs déjà en ligne avant le programme « fondateurs » : ils reçoivent le statut (50 premiers, dans l'ordre
-- de leur première ressource en ligne), avec 6 mois de commission réduite à partir de cette date
UPDATE "User" AS u
SET "founderUntil" = s.first_live + INTERVAL '6 months'
FROM (
  SELECT "sellerId", MIN("createdAt") AS first_live
  FROM "Resource"
  WHERE "status" = 'APPROVED'
  GROUP BY "sellerId"
  ORDER BY MIN("createdAt")
  LIMIT 50
) AS s
WHERE u."id" = s."sellerId" AND u."founderUntil" IS NULL;
