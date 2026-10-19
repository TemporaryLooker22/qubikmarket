// Liste avec une barre proportionnelle derrière chaque ligne (pages, sources, pays…)
export type BarRow = { key: string; label: React.ReactNode; value: number; extra?: string; href?: string };

export function BarList({ rows, head, empty, limit = 8, format }: { rows: BarRow[]; head?: [string, string, string?]; empty: string; limit?: number; format: (n: number) => string }) {
  if (rows.length === 0) return <p className="py-2 text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const shown = rows.slice(0, limit);
  const cols = head?.[2] !== undefined || rows.some((r) => r.extra !== undefined) ? "grid-cols-[minmax(0,1fr)_64px_64px]" : "grid-cols-[minmax(0,1fr)_64px]";
  return (
    <div>
      {head && (
        <div className={`grid ${cols} gap-2 px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted`}>
          <span>{head[0]}</span>
          <span className="text-right">{head[1]}</span>
          {head[2] !== undefined && <span className="text-right">{head[2]}</span>}
        </div>
      )}
      <ul className="space-y-1">
        {shown.map((r) => (
          <li key={r.key} className={`relative grid ${cols} items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-[13px]`}>
            <span className="absolute inset-y-0 left-0 rounded-lg bg-accent-soft" style={{ width: `${(r.value / max) * 100}%` }} aria-hidden="true" />
            <span className="relative flex min-w-0 items-center gap-2">
              {r.href ? (
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                  {r.label}
                </a>
              ) : (
                <span className="truncate">{r.label}</span>
              )}
            </span>
            <span className="relative text-right font-bold">{format(r.value)}</span>
            {r.extra !== undefined && <span className="relative text-right text-xs text-muted">{r.extra}</span>}
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <details className="mt-2">
          <summary className="cursor-pointer px-2 text-xs font-semibold text-muted hover:text-text">+ {rows.length - limit}</summary>
          <ul className="mt-1 space-y-1">
            {rows.slice(limit).map((r) => (
              <li key={r.key} className={`grid ${cols} items-center gap-2 px-2 py-1 text-[13px]`}>
                <span className="truncate">{r.label}</span>
                <span className="text-right font-bold">{format(r.value)}</span>
                {r.extra !== undefined && <span className="text-right text-xs text-muted">{r.extra}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
