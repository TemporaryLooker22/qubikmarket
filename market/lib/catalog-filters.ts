// Filtres du catalogue : lecture depuis l'adresse (?category=…&sort=…) et fabrication des liens.
// Toute l'info est dans l'adresse, donc une recherche filtrée peut être partagée ou mise en favori.
import { CATEGORIES } from "./catalog";

export const SORTS = ["recent", "popular", "top-rated", "price-asc", "price-desc"] as const;
export type Sort = (typeof SORTS)[number];
export type PriceType = "" | "free" | "paid";

export const PAGE_SIZE = 24;
const MAX_LIMIT = 240;

export type CatalogFilters = {
  q: string;
  category: string; // "" = toutes
  price: PriceType;
  min: string; // en euros, tel que tapé ("" = pas de limite)
  max: string;
  sort: Sort;
  limit: number; // nombre de ressources affichées (« Voir plus » ajoute PAGE_SIZE)
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Garde un montant valide (ex. "12", "4.99", "4,99"), sinon ""
function cleanAmount(v: string) {
  const n = Number(v.replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? String(n) : "";
}

export function parseFilters(raw: RawParams): CatalogFilters {
  const category = first(raw.category);
  const price = first(raw.price);
  const sort = first(raw.sort);
  const limit = Number.parseInt(first(raw.limit), 10);
  return {
    q: first(raw.q).trim().slice(0, 100),
    category: CATEGORIES.some((c) => c.id === category) ? category : "",
    price: price === "free" || price === "paid" ? price : "",
    min: cleanAmount(first(raw.min)),
    max: cleanAmount(first(raw.max)),
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : "recent",
    limit: Number.isFinite(limit) && limit > PAGE_SIZE ? Math.min(limit, MAX_LIMIT) : PAGE_SIZE,
  };
}

// Lien vers le catalogue avec certains filtres changés. Changer un filtre revient au début de la liste.
export function catalogHref(current: CatalogFilters, changes: Partial<CatalogFilters> = {}) {
  const next = { ...current, ...changes };
  if (!("limit" in changes)) next.limit = PAGE_SIZE;
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.price) params.set("price", next.price);
  if (next.price !== "free" && next.min) params.set("min", next.min);
  if (next.price !== "free" && next.max) params.set("max", next.max);
  if (next.sort !== "recent") params.set("sort", next.sort);
  if (next.limit > PAGE_SIZE) params.set("limit", String(next.limit));
  const query = params.toString();
  return query ? `/resources?${query}` : "/resources";
}

// Nombre de filtres actifs (pour le bouton « Filtres » sur mobile)
export function activeFilterCount(f: CatalogFilters) {
  return [f.q, f.category, f.price, f.price !== "free" && f.min, f.price !== "free" && f.max].filter(Boolean).length;
}
