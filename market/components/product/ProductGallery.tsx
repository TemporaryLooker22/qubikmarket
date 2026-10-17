"use client";

import Image from "next/image";
import { useState } from "react";
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

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface">
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
      </div>
      {images.length > 1 && (
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
