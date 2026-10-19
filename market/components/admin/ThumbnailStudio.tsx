"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lilita_One } from "next/font/google";
import { Download, ImageIcon, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { inputClass } from "@/components/edit/EditForms";

// Police épaisse façon jeu Roblox pour le titre posé sur l'image
const gameFont = Lilita_One({ weight: "400", subsets: ["latin"] });

type Model = { id: string; name: string; perDay: number };
type Result = { dataUrl: string; seed: number; model: string; prompt: string; ms: number };
type Position = "top" | "center" | "bottom";

const COLORS = ["#FFD400", "#FFFFFF", "#4FE34F", "#3FB8FF", "#FF4D6D", "#C77DFF"];
const MAX_PICK = 4; // FLUX.2 klein : 4 images de référence au plus

// Recadre l'image pour remplir tout le format (comme « object-fit: cover »)
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// Coupe le titre en 2 lignes au plus et trouve la plus grande taille qui tient dans la largeur
function fitTitle(ctx: CanvasRenderingContext2D, text: string, family: string, maxWidth: number, maxSize: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const candidates = [[text]];
  for (let i = 1; i < words.length; i++) candidates.push([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
  let best = { lines: [text], size: 10 };
  for (const lines of candidates) {
    let size = maxSize;
    ctx.font = `${size}px ${family}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest > maxWidth) size = Math.floor((size * maxWidth) / widest);
    // Une seule ligne est préférée si elle reste grande
    const score = lines.length === 1 ? size * 1.15 : size;
    if (score > (best.lines.length === 1 ? best.size * 1.15 : best.size)) best = { lines, size };
  }
  return best;
}

// Texte épais avec gros contour sombre et ombre, comme sur les thumbnails de jeux
function drawGameText(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size: number, color: string, family: string) {
  ctx.font = `${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText(line, x + size * 0.04, y + size * 0.09);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(4, size * 0.2);
  ctx.strokeText(line, x, y);
  ctx.fillStyle = color;
  ctx.fillText(line, x, y);
}

// Pastille penchée dans le coin (« UPDATE 3 », « HALLOWEEN UPDATE »), très courante sur les thumbnails populaires
function drawBadge(ctx: CanvasRenderingContext2D, text: string, size: number, margin: number, family: string) {
  ctx.save();
  ctx.font = `${size}px ${family}`;
  const padX = size * 0.45;
  const w = ctx.measureText(text).width + padX * 2;
  const h = size * 1.35;
  ctx.translate(margin + w / 2, margin + h / 2);
  ctx.rotate(-0.07);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "#FF9F1C");
  g.addColorStop(1, "#FF3D6E");
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.28);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(3, size * 0.12);
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  drawGameText(ctx, text, 0, size * 0.04, size, "#FFFFFF", family);
  ctx.restore();
}

export function ThumbnailStudio({ models, styles }: { models: Model[]; styles: string[] }) {
  const { t } = useI18n();
  const s = t.thumbs;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState("");
  const [style, setStyle] = useState(styles[0]);
  const [model, setModel] = useState(models[0].id);
  const [wide, setWide] = useState(true);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [badge, setBadge] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [position, setPosition] = useState<Position>("bottom");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Images de référence : miniatures des jeux Roblox populaires, chargées depuis le serveur
  const [refs, setRefs] = useState<{ id: number; name: string; thumb: string | null; icon: string | null }[] | null>(null);
  const [refsError, setRefsError] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/admin/thumbnail/refs")
      .then((r) => r.json())
      .then((d) => setRefs(d.refs ?? []))
      .catch(() => setRefsError(true));
  }, []);
  // Changer de format change les images proposées (miniatures 16:9 ou icônes) : on repart de zéro
  useEffect(() => setPicked([]), [wide]);
  const togglePick = (url: string) => setPicked((p) => (p.includes(url) ? p.filter((u) => u !== url) : p.length >= MAX_PICK ? p : [...p, url]));
  const effectiveModel = picked.length ? "flux-2-klein-4b" : model;

  const [W, H] = wide ? [1920, 1080] : [512, 512];

  // Redessine l'image et le texte à chaque changement
  const render = useCallback(async () => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !image) return;
    const family = gameFont.style.fontFamily;
    await document.fonts.load(`80px ${family}`).catch(() => null);
    ctx.clearRect(0, 0, W, H);
    drawCover(ctx, image, W, H);
    const titleText = title.trim().toUpperCase();
    const sub = subtitle.trim().toUpperCase();
    const badgeText = badge.trim().toUpperCase();
    if (badgeText) drawBadge(ctx, badgeText, wide ? 64 : 30, H * 0.05, family);
    if (!titleText && !sub) return;

    // Léger dégradé sombre derrière le texte pour qu'il reste lisible
    const zone = position === "top" ? [0, H * 0.45] : position === "bottom" ? [H, H * 0.55] : null;
    if (zone) {
      const g = ctx.createLinearGradient(0, zone[0], 0, zone[1]);
      g.addColorStop(0, "rgba(0,0,0,0.45)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.min(zone[0], zone[1]), W, Math.abs(zone[1] - zone[0]));
    }

    const fit = fitTitle(ctx, titleText || " ", family, W * 0.9, wide ? 230 : 96);
    const lineH = fit.size * 0.98;
    const subSize = Math.round(fit.size * 0.42);
    const blockH = (titleText ? fit.lines.length * lineH : 0) + (sub ? subSize * 1.3 : 0);
    const margin = H * 0.07;
    let y = position === "top" ? margin : position === "bottom" ? H - margin - blockH : (H - blockH) / 2;
    if (titleText) {
      for (const line of fit.lines) {
        drawGameText(ctx, line, W / 2, y + lineH / 2, fit.size, color, family);
        y += lineH;
      }
    }
    if (sub) drawGameText(ctx, sub, W / 2, y + subSize * 0.65, subSize, "#FFFFFF", family);
  }, [image, title, subtitle, badge, color, position, W, H, wide]);

  useEffect(() => {
    render();
  }, [render]);

  async function generate(sameSeed = false) {
    if (busy || scene.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/thumbnail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scene, style, model: effectiveModel, wide, references: picked, ...(sameSeed && result && { seed: result.seed }) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 429 ? s.quota : `${s.error} : ${data.error ?? res.status}`);
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = data.dataUrl;
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qubik-${wide ? "thumbnail" : "icon"}-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  const label = "mb-1.5 block text-sm font-semibold";
  const chip = (on: boolean) => `rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${on ? "border-text bg-text text-bg" : "border-border bg-card hover:border-border-strong"}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* Réglages */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
        className="space-y-4 rounded-2xl border border-border bg-card p-5"
      >
        <div>
          <label htmlFor="scene" className={label}>{s.scene}</label>
          <textarea id="scene" rows={3} maxLength={600} value={scene} onChange={(e) => setScene(e.target.value)} placeholder={s.scenePlaceholder} className={`${inputClass} h-auto py-2.5`} />
        </div>
        <div>
          <p className={label}>{s.style}</p>
          <div className="flex flex-wrap gap-1.5">
            {styles.map((id) => (
              <button key={id} type="button" onClick={() => setStyle(id)} className={chip(style === id)}>
                {s.styles[id] ?? id}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={label}>{s.format}</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setWide(true)} className={chip(wide)}>{s.wide}</button>
            <button type="button" onClick={() => setWide(false)} className={chip(!wide)}>{s.square}</button>
          </div>
        </div>
        <div>
          <p className={label}>{s.model}</p>
          {picked.length > 0 && <p className="mb-1.5 text-xs font-semibold text-muted">{s.refsForced}</p>}
          <div className={`space-y-1.5 ${picked.length ? "opacity-60" : ""}`}>
            {models.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${effectiveModel === m.id ? "border-text" : "border-border hover:border-border-strong"}`}>
                <span className="flex items-center gap-2 font-semibold">
                  <input type="radio" name="model" disabled={picked.length > 0} checked={effectiveModel === m.id} onChange={() => setModel(m.id)} className="accent-[var(--color-text)]" />
                  {m.name}
                </span>
                <span className="text-xs text-muted">{s.perDay(m.perDay)}</span>
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={busy || scene.trim().length < 3} className="btn-accent h-11 w-full justify-center rounded-xl text-sm disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {busy ? s.generating : s.generate}
        </button>
        {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">{error}</p>}

        <div className="border-t border-border pt-4">
          <p className="mb-3 font-semibold">{s.text}</p>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)]">
            <div>
              <label htmlFor="thumb-title" className={label}>{s.titleText}</label>
              <input id="thumb-title" maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={s.titlePlaceholder} className={inputClass} />
            </div>
            <div>
              <label htmlFor="thumb-sub" className={label}>{s.subtitle}</label>
              <input id="thumb-sub" maxLength={40} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={s.subtitlePlaceholder} className={inputClass} />
            </div>
            <div>
              <label htmlFor="thumb-badge" className={label}>{s.badge}</label>
              <input id="thumb-badge" maxLength={24} value={badge} onChange={(e) => setBadge(e.target.value)} placeholder={s.badgePlaceholder} className={inputClass} />
            </div>
          </div>
          <p className={`${label} mt-3`}>{s.color}</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} className={`h-8 w-8 rounded-full border-2 transition ${color === c ? "border-text ring-2 ring-accent" : "border-border"}`} style={{ background: c }} />
            ))}
          </div>
          <p className={`${label} mt-3`}>{s.position}</p>
          <div className="flex flex-wrap gap-1.5">
            {(["top", "center", "bottom"] as Position[]).map((p) => (
              <button key={p} type="button" onClick={() => setPosition(p)} className={chip(position === p)}>
                {s.positions[p]}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Aperçu */}
      <div className="min-w-0 space-y-3">
        <div className={`relative overflow-hidden rounded-2xl border border-border bg-surface ${wide ? "aspect-video" : "mx-auto aspect-square max-w-[512px]"}`}>
          <canvas ref={canvas} width={W} height={H} className={`h-full w-full ${image ? "" : "hidden"}`} />
          {!image && (
            <p className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted">
              <ImageIcon className="h-8 w-8" aria-hidden="true" />
              {s.empty}
            </p>
          )}
          {busy && image && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden="true" />
            </span>
          )}
        </div>
        {result && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{s.took((result.ms / 1000).toFixed(1), models.find((m) => m.id === result.model)?.name ?? result.model)}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => generate()} disabled={busy} className="btn-ghost px-4 py-2 text-sm">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> {s.again}
              </button>
              <button type="button" onClick={download} className="btn-accent rounded-xl px-4 py-2 text-sm">
                <Download className="h-4 w-4" aria-hidden="true" /> {s.download}
              </button>
            </div>
          </div>
        )}
        {/* Galerie des références : l'IA regarde les images choisies (FLUX.2 klein) */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-semibold">{s.refsTitle}</p>
              <p className="text-xs text-muted">{s.refsIntro}</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="text-muted">{s.refsCount(picked.length, MAX_PICK)}</span>
              {picked.length > 0 && (
                <button type="button" onClick={() => setPicked([])} className="hover:underline">
                  {s.refsClear}
                </button>
              )}
            </div>
          </div>
          {refsError || (refs && refs.length === 0) ? (
            <p className="text-sm text-muted">{s.refsError}</p>
          ) : !refs ? (
            <p className="flex justify-center py-6 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </p>
          ) : (
            <ul className={`grid max-h-[420px] gap-2 overflow-y-auto pr-1 ${wide ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"}`}>
              {refs.map((r) => {
                const url = wide ? r.thumb : r.icon;
                if (!url) return null;
                const on = picked.includes(url);
                const index = picked.indexOf(url);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => togglePick(url)}
                      aria-pressed={on}
                      title={r.name}
                      className={`relative block w-full overflow-hidden rounded-lg border-2 transition ${on ? "border-accent ring-2 ring-accent" : "border-transparent hover:border-border-strong"} ${!on && picked.length >= MAX_PICK ? "opacity-40" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={r.name} loading="lazy" className={`w-full object-cover ${wide ? "aspect-video" : "aspect-square"}`} />
                      {on && <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-text">{index + 1}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {result && (
          <details className="rounded-xl bg-surface px-4 py-3 text-xs text-muted">
            <summary className="cursor-pointer font-semibold">{s.prompt}</summary>
            <p className="mt-2 leading-relaxed">{result.prompt}</p>
          </details>
        )}
      </div>
    </div>
  );
}
