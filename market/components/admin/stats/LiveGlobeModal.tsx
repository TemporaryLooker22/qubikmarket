"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import createGlobe from "cobe";
import { Eye, Loader2, Users, UserRound, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { COUNTRY_CENTROIDS } from "@/lib/country-centroids";
import type { LiveDetail } from "@/lib/stats";
import { UserAvatar } from "@/components/UserAvatar";

type Live = { visitors: number; members: { id: string; username: string; avatarUrl: string | null }[]; detail?: LiveDetail };

const flag = (code: string) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");

const THETA = 0.3;
const clampTheta = (v: number) => Math.max(-1.3, Math.min(1.3, v));

// Globe gris qui tourne, avec un point jaune par pays où il y a des visiteurs en ce moment (plus gros s'ils sont nombreux).
// On peut le faire pivoter dans tous les sens en le glissant à la souris ou au doigt.
function Globe({ countries }: { countries: { code: string; visitors: number }[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const markers = useRef<{ location: [number, number]; size: number }[]>([]);
  // Position actuelle du globe et glissement en cours (null quand on ne le tient pas)
  const view = useRef({ phi: 0, theta: THETA });
  const drag = useRef<{ x: number; y: number; phi: number; theta: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const max = Math.max(1, ...countries.map((c) => c.visitors));
  markers.current = countries.flatMap((c) => (COUNTRY_CENTROIDS[c.code] ? [{ location: COUNTRY_CENTROIDS[c.code], size: 0.04 + 0.08 * (c.visitors / max) }] : []));

  useEffect(() => {
    if (!canvas.current) return;
    // Rotation automatique selon le temps écoulé (même vitesse quel que soit le nombre d'images par seconde), en pause pendant qu'on le tient
    let last = performance.now();
    let width = canvas.current.offsetWidth;
    const onResize = () => canvas.current && (width = canvas.current.offsetWidth);
    window.addEventListener("resize", onResize);
    const globe = createGlobe(canvas.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: THETA,
      dark: 0,
      diffuse: 1.1,
      mapSamples: 16000,
      mapBrightness: 2.2,
      baseColor: [0.83, 0.83, 0.83],
      markerColor: [1, 0.78, 0],
      glowColor: [0.94, 0.94, 0.93],
      markers: markers.current,
      onRender: (state) => {
        const now = performance.now();
        if (!drag.current) view.current.phi += ((now - last) / 1000) * 0.2;
        last = now;
        state.phi = view.current.phi;
        state.theta = view.current.theta;
        state.width = width * 2;
        state.height = width * 2;
        state.markers = markers.current;
      },
    });
    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Glisser : horizontal = tourner autour de l'axe, vertical = incliner vers le haut ou le bas
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ...view.current };
    setGrabbing(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const size = e.currentTarget.offsetWidth || 1;
    view.current.phi = d.phi + ((e.clientX - d.x) / size) * Math.PI;
    view.current.theta = clampTheta(d.theta + ((e.clientY - d.y) / size) * Math.PI);
  };
  const onPointerUp = () => {
    drag.current = null;
    setGrabbing(false);
  };

  return (
    <canvas
      ref={canvas}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`aspect-square w-full max-w-[420px] touch-none select-none ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
      aria-hidden="true"
    />
  );
}

// Fenêtre « Voir plus » de la carte En ce moment : globe des pays, chiffres et détail des visiteurs actifs (anonymes)
export function LiveGlobeModal({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const s = t.stats;
  const [data, setData] = useState<Live | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/live?detail=1", { cache: "no-store" });
        if (res.ok && !stopped) setData(await res.json());
      } catch {
        // hors ligne : on réessaiera
      }
    };
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 15_000);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", escape);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  const d = data?.detail;
  const intl = locale === "fr" ? "fr-FR" : "en-GB";
  const countryName = (code: string) => {
    try {
      return code ? (new Intl.DisplayNames([intl], { type: "region" }).of(code) ?? code) : s.unknown;
    } catch {
      return code || s.unknown;
    }
  };
  const maxMinute = Math.max(1, ...(d?.perMinute.map((m) => m.visitors) ?? [1]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={s.liveTitle} onClick={onClose}>
      <div className="animate-pop max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 ${data?.visitors ? "animate-ping" : ""}`} />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-ok" />
            </span>
            <div>
              <p className="text-lg font-semibold">{s.liveTitle}</p>
              <p className="text-xs text-muted">{s.liveNote}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={s.liveClose} className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-bg">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {!data || !d ? (
          <p className="flex justify-center py-24 text-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Globe et pays */}
            <div className="flex flex-col items-center">
              <Globe countries={d.countries} />
              <ul className="mt-3 w-full space-y-1">
                {d.countries.length === 0 ? (
                  <li className="text-center text-sm text-muted">{s.liveEmpty}</li>
                ) : (
                  d.countries.slice(0, 8).map((c) => (
                    <li key={c.code || "?"} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-1.5 text-sm">
                      <span className="truncate">
                        {flag(c.code)} {countryName(c.code)}
                      </span>
                      <span className="font-bold">{c.visitors}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Chiffres et détail */}
            <div className="min-w-0 space-y-5">
              <div className="grid grid-cols-3 gap-2">
                <Big icon={Users} value={data.visitors} label={s.liveVisitors(data.visitors)} />
                <Big icon={UserRound} value={data.members.length} label={s.liveMembersShort} />
                <Big icon={Eye} value={d.views} label={s.liveViews} />
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{s.livePerMinute}</p>
                <div className="flex h-16 items-end gap-[2px]" role="img" aria-label={s.livePerMinute}>
                  {d.perMinute.map((m) => (
                    <span
                      key={m.minute}
                      title={`${new Date(`${m.minute}:00Z`).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })} : ${m.visitors}`}
                      className="flex-1 rounded-t-[3px] bg-accent"
                      style={{ height: `${Math.max(4, (m.visitors / maxMinute) * 100)}%`, opacity: m.visitors ? 1 : 0.25 }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted">
                  <span>−30 min</span>
                  <span>{s.liveNow}</span>
                </div>
              </div>

              {data.members.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{s.liveMembersTitle}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {data.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-2.5 text-xs font-semibold">
                        <UserAvatar name={m.username} src={m.avatarUrl} size={22} />
                        {m.username}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                <Mini title={s.devicesTitle} rows={d.devices.map((r) => ({ label: s.devices[r.value] ?? r.value, n: r.visitors }))} total={data.visitors} />
                <Mini title={s.sourcesTitle} rows={d.sources.map((r) => ({ label: r.value || s.direct, n: r.visitors }))} total={data.visitors} />
                <Mini title={s.localeTitle} rows={d.locales.map((r) => ({ label: s.locales[r.value] ?? (r.value || s.unknown), n: r.visitors }))} total={data.visitors} />
                <Mini title={s.liveBrowsers} rows={d.browsers.map((r) => ({ label: r.value === "Autre" || !r.value ? s.other : r.value, n: r.visitors }))} total={data.visitors} />
              </div>

              <Mini title={s.livePages} rows={d.pages.map((r) => ({ label: r.path === "/" ? s.home : r.path, n: r.visitors }))} total={data.visitors} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Big({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-2.5">
      <p className="flex items-center gap-1 text-[11px] font-semibold text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </p>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function Mini({ title, rows, total }: { title: string; rows: { label: string; n: number }[]; total: number }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{t.stats.empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 6).map((r) => (
            <li key={r.label} className="relative flex items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1 text-[13px]">
              <span className="absolute inset-y-0 left-0 rounded-md bg-accent-soft" style={{ width: `${total ? (r.n / total) * 100 : 0}%` }} aria-hidden="true" />
              <span className="relative truncate">{r.label}</span>
              <span className="relative font-bold">{r.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
