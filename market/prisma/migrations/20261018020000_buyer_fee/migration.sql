-- Frais de service payés par les acheteurs (lib/buyer-fee.ts)
ALTER TABLE "Purchase" ADD COLUMN "buyerFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "buyerFeeTaxCents" INTEGER NOT NULL DEFAULT 0;
