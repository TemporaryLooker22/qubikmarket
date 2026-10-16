import Link from "next/link";
import { categoryLabel, formatPrice } from "@/lib/catalog";
import { ScanBadge } from "./ScanBadge";

type Props = {
  resource: {
    slug: string;
    title: string;
    summary: string;
    category: string;
    priceCents: number;
    scanVerdict: string;
    seller: { username: string };
  };
};

// Couleur de la vignette selon la catégorie (en attendant les images)
const TINTS: Record<string, string> = {
  scripts: "from-violet-600/40 to-indigo-900/40",
  models: "from-sky-600/40 to-cyan-900/40",
  ui: "from-pink-600/40 to-fuchsia-900/40",
  maps: "from-emerald-600/40 to-teal-900/40",
  plugins: "from-amber-600/40 to-orange-900/40",
  animations: "from-rose-600/40 to-red-900/40",
  other: "from-slate-600/40 to-slate-900/40",
};

export function ResourceCard({ resource }: Props) {
  return (
    <Link href={`/resources/${resource.slug}`} className="card group flex flex-col overflow-hidden transition hover:border-accent">
      <div className={`flex h-28 items-end bg-gradient-to-br p-3 ${TINTS[resource.category] ?? TINTS.other}`}>
        <span className="rounded-md bg-black/40 px-2 py-0.5 text-xs font-medium">{categoryLabel(resource.category)}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold group-hover:text-accent">{resource.title}</h3>
        <p className="line-clamp-2 text-sm text-muted">{resource.summary}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-bold">{formatPrice(resource.priceCents)}</span>
          <ScanBadge verdict={resource.scanVerdict} />
        </div>
        <span className="text-xs text-muted">par {resource.seller.username}</span>
      </div>
    </Link>
  );
}
