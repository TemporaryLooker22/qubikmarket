import Image from "next/image";
import { CATEGORIES } from "@/lib/catalog";
import { CategoryIcon } from "./CategoryIcon";

// Fond de l'accueil : des rangées de miniatures qui défilent en continu derrière la recherche,
// voilées par la couleur du fond pour que le texte reste lisible.
// Sans images (site public sans démo) : des tuiles neutres avec les icônes des catégories.
const ROWS = 3;
const TILES_PER_ROW = 8; // assez pour couvrir un grand écran ; la rangée est doublée pour boucler sans saut

export function HeroBackdrop({ images }: { images: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col gap-4 opacity-60">
        {Array.from({ length: ROWS }, (_, row) => {
          // Chaque rangée commence à une image différente pour éviter l'effet « copie »
          const tiles = Array.from({ length: TILES_PER_ROW }, (_, i) => i + row * 3);
          return (
            <div
              key={row}
              className="marquee flex w-max gap-4"
              style={{ animationDuration: `${60 + row * 12}s`, animationDirection: row % 2 ? "reverse" : "normal" }}
            >
              {[...tiles, ...tiles].map((n, i) => (
                <Tile key={i} image={images.length ? images[n % images.length] : undefined} category={CATEGORIES[n % CATEGORIES.length].id} />
              ))}
            </div>
          );
        })}
      </div>
      {/* Voile : opaque au centre (derrière le texte), plus léger sur les bords, fondu en bas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_50%,var(--color-bg)_30%,color-mix(in_srgb,var(--color-bg)_70%,transparent)_75%,color-mix(in_srgb,var(--color-bg)_45%,transparent)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-t from-transparent to-bg" />
    </div>
  );
}

function Tile({ image, category }: { image?: string; category: string }) {
  return (
    <div className="relative flex aspect-video w-56 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface text-muted sm:w-64">
      {image ? (
        <Image src={image} alt="" fill sizes="256px" className="object-cover" />
      ) : (
        <CategoryIcon category={category} className="h-10 w-10 opacity-60" />
      )}
    </div>
  );
}
