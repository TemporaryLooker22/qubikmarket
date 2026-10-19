import "server-only";

// Images de référence pour le générateur de thumbnails (Modération → Thumbnails) : miniatures et icônes des jeux
// Roblox populaires du moment, lues en direct sur les listes publiques de Roblox (gardées 6 h en cache, jamais copiées).

export type RobloxRef = { id: number; name: string; thumb: string | null; icon: string | null };

const CACHE = { next: { revalidate: 6 * 3600 } };
const json = async (url: string) => {
  const res = await fetch(url, { ...CACHE, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Roblox ${res.status}`);
  return res.json();
};

export async function popularRobloxRefs(limit = 48): Promise<RobloxRef[]> {
  const sorts = await json("https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=qubik-thumbnails&device=computer&country=all");
  // Un peu de chaque liste (tendances, les plus joués, en progression…) pour varier les styles
  const lists: number[][] = (sorts.sorts ?? []).filter((s: { games?: unknown[] }) => s.games?.length).map((s: { games: { universeId: number }[] }) => s.games.map((g) => g.universeId));
  const ids: number[] = [];
  for (let i = 0; ids.length < limit && lists.some((l) => l[i] !== undefined); i++) {
    for (const l of lists) if (l[i] !== undefined && !ids.includes(l[i]) && ids.length < limit) ids.push(l[i]);
  }
  if (!ids.length) return [];
  const list = ids.join(",");
  const [games, thumbs, icons] = await Promise.all([
    json(`https://games.roblox.com/v1/games?universeIds=${list}`),
    json(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${list}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`),
    json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${list}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`),
  ]);
  const name = new Map<number, string>((games.data ?? []).map((g: { id: number; name: string }) => [g.id, g.name]));
  const thumb = new Map<number, string>((thumbs.data ?? []).map((t: { universeId: number; thumbnails?: { imageUrl?: string }[] }) => [t.universeId, t.thumbnails?.[0]?.imageUrl ?? ""]));
  const icon = new Map<number, string>((icons.data ?? []).map((t: { targetId: number; imageUrl?: string }) => [t.targetId, t.imageUrl ?? ""]));
  return ids.map((id) => ({ id, name: name.get(id) ?? String(id), thumb: thumb.get(id) || null, icon: icon.get(id) || null }));
}

// Seules les images du CDN de Roblox sont acceptées comme références (pas d'adresse arbitraire côté serveur)
export function isRobloxImage(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)rbxcdn\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}
