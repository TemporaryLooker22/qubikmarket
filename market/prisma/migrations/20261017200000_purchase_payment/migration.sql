-- Paiements Stripe : moment du paiement et identifiant du paiement (remboursements, contestations)
ALTER TABLE "Purchase" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Purchase" ADD COLUMN "stripePaymentIntentId" TEXT;
CREATE UNIQUE INDEX "Purchase_stripePaymentIntentId_key" ON "Purchase"("stripePaymentIntentId");

-- Achats déjà payés : on reprend la date de création
UPDATE "Purchase" SET "paidAt" = "createdAt" WHERE "status" = 'PAID';
