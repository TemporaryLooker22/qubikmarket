"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { youTubeEmbed, youTubeThumbnail } from "@/lib/youtube";
import { CategoryIcon } from "@/components/CategoryIcon";

type Slide = { kind: "video"; id: string } | { kind: "image"; src: string };

// Galerie de la page produit : grande image + miniatures cliquables (ou l'icône de la catégorie s'il n'y a rien).
// La vidéo de présentation YouTube (facultative) vient en premier : sa miniature, puis le lecteur au clic
// (le lecteur YouTube ne se charge qu'à ce moment-là, sans cookie avant).
export function ProductGallery({ images, category, title, videoId }: { images: string[]; category: string; title: string; videoId?: string | null }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const slides: Slide[] = [...(videoId ? [{ kind: "video" as const, id: videoId }] : []), ...images.map((src) => ({ kind: "image" as const, src }))];

  if (!slides.length) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-border bg-surface text-muted">
        <CategoryIcon category={category} className="h-16 w-16" />
      </div>
    );
  }

  // Passe à l'image précédente / suivante, en boucle (la vidéo s'arrête quand on la quitte)
  const show = (index: number) => {
    setPlaying(false);
    setCurrent(index);
  };
  const go = (step: number) => show((current + step + slides.length) % slides.length);
  const several = slides.length > 1;
  const key = (s: Slide) => (s.kind === "video" ? `video-${s.id}` : s.src);

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
        {slides.map((slide, i) =>
          slide.kind === "image" ? (
            <Image
              key={key(slide)}
              src={slide.src}
              alt={i === 0 ? title : ""}
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 760px, 100vw"
              className={`object-cover transition-opacity duration-300 ${i === current ? "opacity-100" : "opacity-0"}`}
            />
          ) : (
            <div key={key(slide)} className={`absolute inset-0 transition-opacity duration-300 ${i === current ? "z-[1] opacity-100" : "pointer-events-none opacity-0"}`}>
              {playing && i === current ? (
                <iframe
                  src={youTubeEmbed(slide.id)}
                  title={title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <button type="button" onClick={() => setPlaying(true)} aria-label={t.resource.playVideo} className="group/play absolute inset-0">
                  <Image src={youTubeThumbnail(slide.id)} alt={title} fill priority={i === 0} sizes="(min-width: 1024px) 760px, 100vw" className="object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-text/10 transition group-hover/play:bg-text/20">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-text shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition group-hover/play:scale-110">
                      <Play className="ml-1 h-7 w-7" fill="currentColor" aria-hidden="true" />
                    </span>
                  </span>
                </button>
              )}
            </div>
          ),
        )}
        {/* Flèches : toujours visibles sur mobile, au survol sur ordinateur (cachées pendant la lecture de la vidéo) */}
        {several && !playing && (
          <>
            <ArrowButton side="left" label={t.resource.prevImage} onClick={() => go(-1)} />
            <ArrowButton side="right" label={t.resource.nextImage} onClick={() => go(1)} />
            <span className="absolute bottom-3 left-1/2 z-[2] -translate-x-1/2 rounded-full bg-text/60 px-2.5 py-0.5 text-xs font-semibold text-bg backdrop-blur">
              {current + 1} / {slides.length}
            </span>
          </>
        )}
      </div>
      {several && (
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {slides.map((slide, i) => (
            <button
              key={key(slide)}
              type="button"
              onClick={() => show(i)}
              aria-label={slide.kind === "video" ? t.resource.video : t.resource.showImage(i + 1)}
              aria-current={i === current}
              className={`relative aspect-video overflow-hidden rounded-lg border-2 transition ${
                i === current ? "border-text" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={slide.kind === "video" ? youTubeThumbnail(slide.id) : slide.src} alt="" fill sizes="140px" className="object-cover" />
              {slide.kind === "video" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-text/70 text-bg">
                    <Play className="ml-px h-3 w-3" fill="currentColor" aria-hidden="true" />
                  </span>
                </span>
              )}
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
      className={`absolute top-1/2 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-text shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur transition duration-200 hover:scale-105 hover:bg-accent md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
