// Exemples de ressources pour la maquette (accueil, catalogue et pages produit de démo).
// Activés seulement avec QUBIK_DEMO=1 (en local et sur l'aperçu Vercel), et seulement tant qu'il n'y a
// pas de vraies ressources. Ne JAMAIS activer en production : les images sont des miniatures de jeux
// Roblox existants, utilisées uniquement pour la maquette.
export const DEMO_ENABLED = process.env.QUBIK_DEMO === "1";

export type DemoResource = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  priceCents: number;
  image: string; // miniature (cartes)
  images: string[]; // galerie de la page produit
  fileName: string;
  fileSize: number;
  scriptCount: number;
  createdAt: Date;
  sales: number;
  seller: { username: string; resources: number; sales: number; rating: number; reviews: number };
};

const IMAGES = ["chicken", "pets", "trex", "chainsaw"].map((n) => `/demo/${n}.webp`);
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

const demo = (r: Omit<DemoResource, "id" | "slug" | "image" | "images"> & { key: string; imageIndex: number }): DemoResource => {
  const { key, imageIndex, ...rest } = r;
  // La miniature de la ressource d'abord, puis les autres images pour remplir la galerie
  const images = [IMAGES[imageIndex], ...IMAGES.filter((_, i) => i !== imageIndex)];
  return { ...rest, id: `demo-${key}`, slug: `demo-${key}`, image: images[0], images };
};

const CHICKEN = demo({
  key: "chicken",
  imageIndex: 0,
  title: "Chicken Tycoon Kit",
  summary: "A complete tycoon game: buy chickens, upgrade your farm and earn billions per second.",
  description: `## A full tycoon, ready to publish

Everything you need to launch a **chicken tycoon** in an afternoon: the map, the scripts, the UI and the monetization.

### Features
- 30 chicken tiers with their own models and effects
- Rebirth system with permanent multipliers
- Offline earnings and DataStore saving
- Shop UI with gamepasses and developer products

### Installation
1. Open the place file in Roblox Studio
2. Publish it to your game
3. Replace the gamepass IDs in \`Config\`

Questions? Join the support server linked on my profile.`,
  category: "game-setups",
  priceCents: 2499,
  fileName: "ChickenTycoon.rbxl",
  fileSize: 3_400_000,
  scriptCount: 42,
  createdAt: daysAgo(3),
  sales: 248,
  seller: { username: "BlockForge", resources: 12, sales: 1830, rating: 4.8, reviews: 312 },
});

const PETS = demo({
  key: "pets",
  imageIndex: 1,
  title: "Pet Collection System",
  summary: "Collect, equip and level up pets that follow your players, with rarities and saving.",
  description: `## Pets that follow your players

A modular **pet system** you can drop into any game.

### Features
- Pets follow the player with smooth movement
- 5 rarities: Common, Rare, Epic, Legendary, Mythic
- Equip up to 3 pets, each with its own boost
- Inventory UI included, saved with DataStore

Works with R6 and R15. Fully commented code.`,
  category: "systems",
  priceCents: 1299,
  fileName: "PetSystem.rbxm",
  fileSize: 1_200_000,
  scriptCount: 12,
  createdAt: daysAgo(6),
  sales: 191,
  seller: { username: "PixelPaws", resources: 8, sales: 1240, rating: 4.6, reviews: 187 },
});

const TREX = demo({
  key: "trex",
  imageIndex: 2,
  title: "Egg Hatching & Rarity System",
  summary: "Hatch eggs with animated openings, weighted rarities and a mythic pity system.",
  description: `## Hatch eggs like the top simulators

### Features
- Animated egg opening with camera effects
- Weighted chances per egg, easy to edit
- Pity system: a guaranteed Mythic after N hatches
- Auto-hatch and triple-hatch gamepass support

Plug it into your existing pet system or use it on its own.`,
  category: "systems",
  priceCents: 899,
  fileName: "EggHatching.rbxm",
  fileSize: 860_000,
  scriptCount: 9,
  createdAt: daysAgo(9),
  sales: 156,
  seller: { username: "DinoDev", resources: 5, sales: 610, rating: 4.3, reviews: 64 },
});

const CHAINSAW = demo({
  key: "chainsaw",
  imageIndex: 3,
  title: "Tree Chopping Simulator",
  summary: "A ready-to-publish simulator: chop trees, sell wood and unlock better tools.",
  description: `## Chop, sell, upgrade

A complete **simulator** loop with satisfying wood-chopping effects.

### Features
- Trees break apart with particle and sound effects
- 15 tools from the axe to the golden chainsaw
- Sell zones, leaderboards and daily rewards
- Mobile and console controls

Includes the full map and all the UI.`,
  category: "game-setups",
  priceCents: 1999,
  fileName: "TreeChopping.rbxl",
  fileSize: 2_900_000,
  scriptCount: 31,
  createdAt: daysAgo(1),
  sales: 97,
  seller: { username: "TimberStudio", resources: 3, sales: 240, rating: 4.9, reviews: 41 },
});

export const DEMO_RESOURCES = [CHICKEN, PETS, TREX, CHAINSAW];

export const DEMO_BEST_SELLERS = [...DEMO_RESOURCES].sort((a, b) => b.sales - a.sales).map((resource) => ({ resource, sales: resource.sales }));

export const DEMO_LATEST = [...DEMO_RESOURCES].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

// Miniatures du fond animé de l'accueil
export const DEMO_IMAGES = IMAGES;

export function findDemo(slug: string) {
  return DEMO_ENABLED ? DEMO_RESOURCES.find((r) => r.slug === slug) ?? null : null;
}
