-- Versements aux vendeurs : compte Stripe Connect du vendeur et versements hebdomadaires
ALTER TABLE "User" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeTransfersActive" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");

ALTER TABLE "SellerEarning" ADD COLUMN "payoutId" TEXT;

CREATE TABLE "SellerPayout" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "transferId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerPayout_transferId_key" ON "SellerPayout"("transferId");
CREATE INDEX "SellerPayout_sellerId_createdAt_idx" ON "SellerPayout"("sellerId", "createdAt");

ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerEarning" ADD CONSTRAINT "SellerEarning_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "SellerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
