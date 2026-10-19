// Limites de la mise en avant, partagées entre le serveur et le formulaire (voir lib/promotion.ts)
export const PROMO_MAX = 15; // commission maximale qu'un vendeur peut choisir (%)

// Niveau de mise en avant affiché au vendeur (0 = pas mise en avant)
export function promoLevel(baseFee: number, percent: number) {
  const extra = Math.max(0, percent - baseFee);
  if (extra === 0) return 0;
  return extra <= 2 ? 1 : extra <= 5 ? 2 : extra <= 8 ? 3 : 4;
}
