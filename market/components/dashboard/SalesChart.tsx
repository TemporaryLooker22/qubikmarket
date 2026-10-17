"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/i18n/format";

export type ChartDay = { date: string; sales: number; netCents: number }; // date au format AAAA-MM-JJ

const HEIGHT = 210;
const PAD = { left: 44, bottom: 24, top: 8 };

// Graphique en barres des 30 derniers jours : revenus nets ou nombre de ventes, avec le détail au survol
export function SalesChart({ days }: { days: ChartDay[] }) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<"revenue" | "sales">("revenue");
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // Le graphique prend toute la largeur disponible, et se redessine si elle change
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const value = (d: ChartDay) => (mode === "revenue" ? d.netCents / 100 : d.sales);
  const max = Math.max(...days.map(value), 0);
  // Graduations rondes : 5 lignes au plus
  const rawStep = Math.max(max, mode === "revenue" ? 10 : 4) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep)!;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const y = (v: number) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - v / top);
  const slot = width > PAD.left ? (width - PAD.left) / days.length : 0;
  const barWidth = Math.max(1, slot - 2); // 2 px d'écart entre les barres
  const dateLabel = (d: ChartDay, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d.date}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", opts);
  const format = (v: number) => (mode === "revenue" ? formatAmount(Math.round(v * 100), locale) : t.dashboard.salesCount(v));
  const tickLabel = (v: number) => (mode === "revenue" ? `${v} €` : String(v));

  const totalSales = days.reduce((n, d) => n + d.sales, 0);
  const totalNet = days.reduce((n, d) => n + d.netCents, 0);
  const hovered = hover !== null ? days[hover] : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{mode === "revenue" ? t.dashboard.chartRevenue : t.dashboard.chartSales}</h2>
        <div role="radiogroup" aria-label={t.dashboard.chartRevenue} className="inline-flex gap-1 rounded-lg bg-surface p-[3px]">
          {(["revenue", "sales"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${mode === m ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"}`}
            >
              {m === "revenue" ? t.dashboard.revenue : t.dashboard.sales}
            </button>
          ))}
        </div>
      </div>

      {/* Résumé pour les lecteurs d'écran (le graphique lui-même est décoratif pour eux) */}
      <p className="sr-only">{t.dashboard.chartSummary(totalSales, formatAmount(totalNet, locale))}</p>

      <div ref={box} className="relative" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)} aria-hidden="true">
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block overflow-visible">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={width} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-border-strong" : "stroke-surface"} />
                <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">
                  {tickLabel(v)}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              const x = PAD.left + i * slot + 1;
              const h = y(0) - y(value(d));
              const r = Math.min(4, barWidth / 2, h);
              return (
                <g key={d.date}>
                  {h > 0 && (
                    // Barre au bout arrondi (4 px), posée sur la ligne de base
                    <path
                      d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + barWidth - r} Q${x + barWidth},${y(0) - h} ${x + barWidth},${y(0) - h + r} V${y(0)} Z`}
                      className={`transition-colors ${hover === i ? "fill-accent" : "fill-text"}`}
                    />
                  )}
                  {/* Zone de survol plus large que la barre */}
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={HEIGHT - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHover(i)} />
                  {i % 5 === 0 && (
                    <text x={x + barWidth / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-muted text-[11px]">
                      {dateLabel(d, { day: "numeric", month: "short" })}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-text px-2.5 py-1.5 text-xs text-bg shadow-lg"
            style={{ left: PAD.left + hover * slot + slot / 2, top: y(value(hovered)) - 8 }}
          >
            <span className="block text-[13px] font-bold">{format(value(hovered))}</span>
            {dateLabel(hovered, { weekday: "short", day: "numeric", month: "short" })}
          </div>
        )}
      </div>
    </section>
  );
}
