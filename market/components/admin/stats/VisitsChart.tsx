import type { Bucket } from "@/lib/stats";

// Courbe des visites : une barre par heure, jour ou mois (pages vues en gris, visiteurs en jaune).
// Survol d'une barre : la date, les visiteurs, les pages vues et les inscriptions.
export function VisitsChart({
  buckets,
  label,
  tooltip,
}: {
  buckets: Bucket[];
  label: (b: Bucket) => string;
  tooltip: (b: Bucket) => string;
}) {
  const max = Math.max(...buckets.map((b) => b.views), 1);
  // Repères sous la courbe : début, quarts et fin
  const ticks = buckets.length <= 1 ? [0] : [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (buckets.length - 1))))];
  return (
    <div>
      <div className="flex h-48 items-end gap-[3px] border-b border-border pt-2" role="img" aria-label={buckets.map(tooltip).join(" · ")}>
        {buckets.map((b) => (
          <div key={b.key} className="group relative flex h-full flex-1 items-end" title={tooltip(b)}>
            <span className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-surface transition group-hover:bg-border" style={{ height: `${(b.views / max) * 100}%` }} />
            <span className="absolute inset-x-[18%] bottom-0 rounded-t-[4px] bg-accent" style={{ height: `${(b.visitors / max) * 100}%` }} />
            {b.signups > 0 && <span className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-ok" style={{ bottom: `calc(${(b.views / max) * 100}% + 4px)` }} />}
          </div>
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-muted">
        {ticks.map((i) => (
          <span
            key={i}
            className="absolute whitespace-nowrap"
            style={{ left: `${((i + 0.5) / buckets.length) * 100}%`, transform: i === 0 ? "translateX(-10%)" : i === buckets.length - 1 ? "translateX(-90%)" : "translateX(-50%)" }}
          >
            {label(buckets[i])}
          </span>
        ))}
      </div>
    </div>
  );
}
