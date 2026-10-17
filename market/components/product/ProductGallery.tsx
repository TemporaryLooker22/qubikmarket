"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { CategoryIcon } from "@/components/CategoryIcon";

// Galerie de la page produit : grande image + miniatures cliquables (ou l'icône de la catégorie s'il n'y a pas d'image)
export function ProductGallery({ images, category, title }: { images: string[]; category: string; title: string }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(0);

  if (!images.length) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-border bg-surface text-muted">
        <CategoryIcon category={category} className="h-16 w-16" />
      </div>
    );
  }

  // Passe à l'image précédente / suivante, en boucle
  const go = (step: number) => setCurrent((c) => (c + step + images.length) % images.length);
  const several = images.length > 1;

  return (
    <div>
      <div
        className="group relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-accent"
        tabIndex={several ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={i === 0 ? title : ""}
            fill
            priority={i === 0}
            sizes="(min-width: 1024px) 760px, 100vw"
            className={`object-cover transition-opacity duration-300 ${i === current ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        {/* Flèches : toujours visibles sur mobile, au survol sur ordinateur */}
        {several && (
          <>
            <ArrowButton side="left" label={t.resource.prevImage} onClick={() => go(-1)} />
            <ArrowButton side="right" label={t.resource.nextImage} onClick={() => go(1)} />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-text/60 px-2.5 py-0.5 text-xs font-semibold text-bg backdrop-blur">
              {current + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {several && (
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={t.resource.showImage(i + 1)}
              aria-current={i === current}
              className={`relative aspect-video overflow-hidden rounded-lg border-2 transition ${
                i === current ? "border-text" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={src} alt="" fill sizes="140px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrowButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-text shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur transition duration-200 hover:scale-105 hover:bg-accent md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
