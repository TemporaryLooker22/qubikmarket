// Données partagées par les pages : catégories, formats acceptés

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

// Formats acceptés et taille maximale du fichier vendu : voir lib/formats.ts
export { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from "./formats";

// Captures d'écran : compressées dans le navigateur avant l'envoi (voir SellForm)
export const MAX_IMAGES = 6;
export const MAX_IMAGE_SIZE = 1024 * 1024; // 1 Mo par image après compression
// Limite de Vercel (4,5 Mo par requête) pour tout le formulaire (images + textes, et le fichier en local sans Vercel Blob), avec une marge
export const MAX_FORM_SIZE = 4.3 * 1024 * 1024;

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

// Prix, tailles et dates : voir lib/i18n/format.ts (ils dépendent de la langue)
