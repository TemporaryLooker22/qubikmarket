// Graphique en barres simple (revenus Qubik par jour ou par mois), avec le montant au survol
export function RevenueBars({ bars }: { bars: { label: string; value: number; title: string }[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]">
        {bars.map((b, i) => (
          <div key={i} title={b.title} className="group flex h-full flex-1 items-end">
            <div
              className={`w-full rounded-t-[4px] transition group-hover:opacity-80 ${b.value > 0 ? "bg-accent" : "bg-surface"}`}
              style={{ height: `${Math.max(3, (b.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>{bars[0]?.label}</span>
        <span>{bars[bars.length - 1]?.label}</span>
      </div>
    </div>
  );
}
