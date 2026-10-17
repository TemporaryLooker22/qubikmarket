"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

// Galerie horizontale de cartes : défilement au doigt (mobile) ou avec les flèches (ordinateur)
export function Gallery({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // Active ou grise les flèches selon la position du défilement
  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={track}
        onScroll={update}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child, i) => (
          <div className="animate-fade-up w-[220px] shrink-0 snap-start sm:w-[250px]" style={{ animationDelay: `${i * 60}ms` }}>
            {child}
          </div>
        ))}
      </div>

      {/* Flèches (ordinateur) */}
      <div className="pointer-events-none absolute inset-x-1 top-0 hidden h-[calc(100%-1rem)] items-center justify-between md:flex">
        <ArrowButton label={t.home.prev} disabled={!canPrev} onClick={() => scroll(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </ArrowButton>
        <ArrowButton label={t.home.next} disabled={!canNext} onClick={() => scroll(1)}>
          <ChevronRight className="h-5 w-5" />
        </ArrowButton>
      </div>
    </div>
  );
}

function ArrowButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      tabIndex={disabled ? -1 : 0}
      className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-[0_6px_20px_rgba(0,0,0,0.10)] transition duration-200 hover:scale-105 hover:bg-accent ${
        disabled ? "invisible opacity-0" : "opacity-100"
      }`}
    >
      {children}
    </button>
  );
}
