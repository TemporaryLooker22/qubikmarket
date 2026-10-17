// Exemples de ressources pour la maquette des galeries de l'accueil.
// Activés seulement avec QUBIK_DEMO=1 (en local et sur l'aperçu Vercel), et seulement tant qu'il n'y a
// pas de vraies ressources. Ne JAMAIS activer en production : les images sont des miniatures de jeux
// Roblox existants, utilisées uniquement pour la maquette.
export const DEMO_ENABLED = process.env.QUBIK_DEMO === "1";

export type DemoResource = {
  id: string;
  slug: string;
  title: string;
  category: string;
  priceCents: number;
  image: string;
  seller: { username: string };
};

const demo = (id: string, title: string, category: string, priceCents: number, image: string, seller: string): DemoResource => ({
  id: `demo-${id}`,
  slug: `demo-${id}`,
  title,
  category,
  priceCents,
  image: `/demo/${image}.webp`,
  seller: { username: seller },
});

const CHICKEN = demo("chicken", "Chicken Tycoon Kit", "game-setups", 2499, "chicken", "BlockForge");
const PETS = demo("pets", "Pet Collection System", "systems", 1299, "pets", "PixelPaws");
const TREX = demo("trex", "Egg Hatching & Rarity System", "systems", 899, "trex", "DinoDev");
const CHAINSAW = demo("chainsaw", "Tree Chopping Simulator", "game-setups", 1999, "chainsaw", "TimberStudio");

export const DEMO_BEST_SELLERS = [
  { resource: CHICKEN, sales: 248 },
  { resource: PETS, sales: 191 },
  { resource: TREX, sales: 156 },
  { resource: CHAINSAW, sales: 97 },
];

export const DEMO_LATEST = [CHAINSAW, TREX, PETS, CHICKEN];

// Miniatures du fond animé de l'accueil
export const DEMO_IMAGES = [CHICKEN, PETS, TREX, CHAINSAW].map((r) => r.image);
