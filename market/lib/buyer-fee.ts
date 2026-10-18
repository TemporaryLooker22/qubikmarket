// Frais de service payés par l'acheteur, en plus du prix d'une ressource payante (TVA comprise).
// Ils couvrent les frais de paiement (Stripe) pour que la commission des vendeurs reste basse.
// Ils reviennent à Qubik : le vendeur touche le prix de sa ressource, moins la commission.

export const BUYER_FEE_FIXED_CENTS = 35;
export const BUYER_FEE_PERCENT = 2;

export function buyerFeeCents(priceCents: number) {
  if (priceCents <= 0) return 0;
  return BUYER_FEE_FIXED_CENTS + Math.round((priceCents * BUYER_FEE_PERCENT) / 100);
}
