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

export function ResourceCard({ resource }: Props) {
  return (
    <li>
      <Link href={`/resources/${resource.slug}`}>{resource.title}</Link> — {resource.summary} ·{" "}
      {categoryLabel(resource.category)} · {formatPrice(resource.priceCents)} · par {resource.seller.username}{" "}
      <ScanBadge verdict={resource.scanVerdict} />
    </li>
  );
}
