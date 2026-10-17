import Image from "next/image";
import { CategoryIcon } from "@/components/CategoryIcon";

// Petite miniature 16:9 d'une ressource (sa première image, sinon l'icône de sa catégorie)
export function Thumb({ image, category, className = "w-14" }: { image?: string; category: string; className?: string }) {
  return (
    <span className={`relative flex aspect-video shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-muted ${className}`}>
      {image ? <Image src={image} alt="" fill sizes="112px" className="object-cover" /> : <CategoryIcon category={category} className="h-5 w-5" />}
    </span>
  );
}
