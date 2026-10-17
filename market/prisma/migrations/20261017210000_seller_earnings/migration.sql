-- Registre des gains des vendeurs, TVA des achats et programme « vendeurs fondateurs »
ALTER TABLE "User" ADD COLUMN "founderUntil" TIMESTAMP(3);
ALTER TABLE "Purchase" ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SellerEarning" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "reversesId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "feePercent" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL,
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerEarning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerEarning_purchaseId_key" ON "SellerEarning"("purchaseId");
CREATE UNIQUE INDEX "SellerEarning_reversesId_key" ON "SellerEarning"("reversesId");
CREATE INDEX "SellerEarning_sellerId_status_idx" ON "SellerEarning"("sellerId", "status");

ALTER TABLE "SellerEarning" ADD CONSTRAINT "SellerEarning_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerEarning" ADD CONSTRAINT "SellerEarning_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerEarning" ADD CONSTRAINT "SellerEarning_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "SellerEarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
