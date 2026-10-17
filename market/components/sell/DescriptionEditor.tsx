"use client";

import { useRef, useState } from "react";
import { Bold, Code, Heading, Italic, Link as LinkIcon, List } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Markdown } from "@/components/Markdown";

export const DESCRIPTION_MIN = 30; // même minimum que le serveur (app/actions.ts)

// Éditeur de description en Markdown : onglets Écrire / Aperçu et quelques boutons de mise en forme
export function DescriptionEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"write" | "preview">("write");
  const area = useRef<HTMLTextAreaElement>(null);

  // Remplace la sélection par un nouveau texte, puis resélectionne la partie utile
  const edit = (build: (selected: string) => { text: string; select: [number, number] }) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const { text, select } = build(value.slice(start, end));
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + select[0], start + select[1]);
    });
  };

  // **gras**, _italique_, `code`… autour de la sélection (ou d'un mot d'exemple)
  const wrap = (before: string, after: string, placeholder: string) =>
    edit((sel) => {
      const inner = sel || placeholder;
      return { text: before + inner + after, select: [before.length, before.length + inner.length] };
    });

  // "### " ou "- " au début de chaque ligne sélectionnée (sur une nouvelle ligne si besoin)
  const prefixLines = (prefix: string, placeholder: string) =>
    edit((sel) => {
      const el = area.current!;
      const atLineStart = el.selectionStart === 0 || value[el.selectionStart - 1] === "\n";
      const lead = atLineStart ? "" : "\n";
      const body = (sel || placeholder).split("\n").map((line) => prefix + line).join("\n");
      return { text: lead + body, select: [lead.length + prefix.length, lead.length + body.length] };
    });

  const tools = [
    { label: t.sell.tools.heading, Icon: Heading, run: () => prefixLines("### ", t.sell.tools.heading) },
    { label: t.sell.tools.bold, Icon: Bold, run: () => wrap("**", "**", t.sell.tools.bold) },
    { label: t.sell.tools.italic, Icon: Italic, run: () => wrap("_", "_", t.sell.tools.italic) },
    { label: t.sell.tools.list, Icon: List, run: () => prefixLines("- ", t.sell.tools.list) },
    {
      label: t.sell.tools.link,
      Icon: LinkIcon,
      run: () => edit((sel) => ({ text: `[${sel || t.sell.tools.link}](https://)`, select: [(sel || t.sell.tools.link).length + 3, (sel || t.sell.tools.link).length + 11] })),
    },
    { label: t.sell.tools.code, Icon: Code, run: () => wrap("`", "`", "code") },
  ];

  const length = value.trim().length;

  return (
    <div className="overflow-hidden rounded-xl border border-border transition focus-within:border-text focus-within:ring-4 focus-within:ring-accent/30">
      <div className="flex items-center gap-0.5 border-b border-border bg-bg p-1.5">
        <div role="tablist" className="flex gap-0.5">
          {(["write", "preview"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${tab === id ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"}`}
            >
              {id === "write" ? t.sell.write : t.sell.preview}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {/* Les boutons de mise en forme n'ont de sens qu'en mode écriture */}
        {tab === "write" &&
          tools.map(({ label, Icon, run }) => (
            <button
              key={label}
              type="button"
              onClick={run}
              aria-label={label}
              title={label}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-text"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
      </div>

      {tab === "write" ? (
        <textarea
          ref={area}
          id="description"
          name="description"
          required
          minLength={DESCRIPTION_MIN}
          maxLength={10000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.sell.descPh}
          className="block min-h-56 w-full resize-y bg-card px-4 py-3.5 font-mono text-[13px] leading-relaxed outline-none placeholder:text-muted"
        />
      ) : (
        <div className="min-h-56 bg-card px-5 py-4">
          {length > 0 ? <Markdown>{value}</Markdown> : <p className="text-sm text-muted">{t.sell.previewEmpty}</p>}
          {/* Le champ reste dans le formulaire pendant l'aperçu */}
          <input type="hidden" name="description" value={value} />
        </div>
      )}

      <div className="flex justify-between border-t border-border bg-card px-3.5 py-2 text-xs text-muted">
        <span className={length > 0 && length < DESCRIPTION_MIN ? "font-medium text-warn" : ""}>{t.sell.descMin(DESCRIPTION_MIN)}</span>
        <span>{t.sell.chars(length)}</span>
      </div>
    </div>
  );
}
