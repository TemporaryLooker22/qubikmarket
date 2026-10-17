import { Star } from "lucide-react";

// Note sur 5 étoiles, avec remplissage partiel (ex. 4,6 → la 5e étoile remplie à 60 %)
export function Stars({ rating, label, className = "h-4 w-4" }: { rating: number; label: string; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i)) * 100;
        return (
          <span key={i} className="relative inline-flex">
            <Star className={`${className} text-border-strong`} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
              <Star className={`${className} text-accent`} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
