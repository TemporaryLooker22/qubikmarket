import Image from "next/image";
import { Star } from "lucide-react";
import { CATEGORIES } from "@/lib/catalog";
import { DEMO_ENABLED } from "@/lib/demo";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CategoryIcon } from "@/components/CategoryIcon";

// Panneau de droite des pages d'inscription et de connexion :
// colonnes de miniatures qui défilent verticalement, slogan, témoignage et chiffres clés
const COLUMNS = 3;
const TILES = 6; // par colonne, doublées pour boucler sans saut

export function AuthShowcase({ images, t }: { images: string[]; t: Dictionary }) {
  return (
    <div className="relative isolate h-full min-h-[560px] overflow-hidden rounded-3xl bg-text text-bg">
      {/* Miniatures */}
      <div className="absolute -inset-x-6 -inset-y-16 grid rotate-[-6deg] grid-cols-3 gap-3 opacity-60" aria-hidden="true">
        {Array.from({ length: COLUMNS }, (_, col) => {
          const tiles = Array.from({ length: TILES }, (_, i) => i + col * 2);
          return (
            <div
              key={col}
              className="marquee-y flex flex-col gap-3"
              style={{ animationDuration: `${45 + col * 10}s`, animationDirection: col === 1 ? "reverse" : "normal" }}
            >
              {[...tiles, ...tiles].map((n, i) => (
                <div key={i} className="relative flex aspect-video shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg/10">
                  {images.length ? (
                    <Image src={images[n % images.length]} alt="" fill sizes="240px" className="object-cover" />
                  ) : (
                    <CategoryIcon category={CATEGORIES[n % CATEGORIES.length].id} className="h-8 w-8 text-bg/40" />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {/* Voile sombre de plus en plus opaque vers le bas, pour lire le texte */}
      <div className="absolute inset-0 bg-gradient-to-b from-text/10 via-text/55 to-text/95" />

      <div className="absolute inset-x-8 bottom-8">
        <p className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">{t.auth.showcaseTitle}</p>

        {/* Témoignage : seulement en mode démo tant qu'il n'y a pas de vrais avis */}
        {DEMO_ENABLED && (
          <figure className="mt-5 rounded-2xl border border-bg/15 bg-bg/10 p-4 backdrop-blur">
            <div className="flex gap-0.5 text-accent" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              ))}
            </div>
            <blockquote className="mt-2 text-sm leading-relaxed">« {t.auth.testimonial} »</blockquote>
            <figcaption className="mt-2 text-xs text-bg/60">{t.auth.testimonialAuthor}</figcaption>
          </figure>
        )}

        <dl className="mt-6 grid grid-cols-3 gap-4">
          {[
            { value: "20", label: t.auth.stats.rules },
            { value: "10 s", label: t.auth.stats.publish },
            { value: "10 %", label: t.auth.stats.fee },
          ].map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-2xl font-bold">{s.value}</dd>
              <p className="text-xs text-bg/60" aria-hidden="true">
                {s.label}
              </p>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
