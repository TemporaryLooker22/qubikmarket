import { Box, Cog, Gamepad2, LayoutTemplate, Map, Package, PersonStanding, Sparkles, Volume2, type LucideProps } from "lucide-react";

// Une icône par catégorie (voir CATEGORIES dans lib/catalog.ts)
const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  "game-setups": Gamepad2,
  systems: Cog,
  ui: LayoutTemplate,
  models: Box,
  maps: Map,
  vfx: Sparkles,
  sfx: Volume2,
  animations: PersonStanding,
};

export function CategoryIcon({ category, ...props }: { category: string } & LucideProps) {
  const Icon = ICONS[category] ?? Package;
  return <Icon aria-hidden="true" strokeWidth={1.5} {...props} />;
}
