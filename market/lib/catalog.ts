// Données partagées par les pages : catégories, formats acceptés, mise en forme

// Catégories de vente. L'id est enregistré en base : ne pas le changer une fois des ressources publiées.
export const CATEGORIES = [
  { id: "game-setups", label: "Game Setups" }, // jeux complets prêts à publier
  { id: "systems", label: "Systems" }, // systèmes complets à brancher dans un jeu
  { id: "ui", label: "UI & Graphics" },
  { id: "models", label: "Models" },
  { id: "maps", label: "Maps" },
  { id: "vfx", label: "VFX" }, // effets visuels
  { id: "sfx", label: "SFX" }, // effets sonores
  { id: "animations", label: "Animations" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const ALLOWED_EXTENSIONS = [".rbxm", ".rbxmx", ".rbxl", ".rbxlx", ".lua", ".luau"];
// Vercel limite la taille d'une requête à 4,5 Mo
export const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 Mo

export function formatPrice(cents: number) {
  if (cents === 0) return "Gratuit";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

// "Système de porte automatique !" -> "systeme-de-porte-automatique"
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const VERDICT_LABELS = {
  clean: "Scan propre",
  suspicious: "Scan : à vérifier",
  dangerous: "Scan : dangereux",
} as const;

export const STATUS_LABELS = {
  APPROVED: "En ligne",
  PENDING: "En vérification",
  REJECTED: "Refusée",
} as const;
