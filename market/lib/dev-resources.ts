// Ressources gratuites pour les développeurs Roblox (page /dev-resources, réservée aux membres connectés).
// Pour en ajouter une : une ligne de plus dans cette liste (textes en anglais et en français).
export type DevResource = {
  title: string;
  url: string;
  kind: "github" | "link";
  license?: string;
  tags: string[];
  description: { en: string; fr: string };
  // Catégorie du catalogue (lib/catalog.ts) : les ressources de cette catégorie en vente sur Qubik sont proposées en dessous
  category?: string;
};

export const DEV_RESOURCES: DevResource[] = [
  {
    title: "Stud UI Clean Roblox",
    url: "https://github.com/TemporaryLooker22/Stud-UI-Clean-Roblox",
    kind: "github",
    license: "MIT",
    tags: ["UI", "Luau", "Agent Skill", "1022 icons"],
    category: "ui",
    description: {
      en: "An AI agent skill and a tested Luau kit to build Roblox UI in the chunky 3D “stud” simulator style: buttons, windows, shops, HUD, item slots, bouncy animations and 1022 ready-to-use icons.",
      fr: "Un skill pour agent IA et un kit Luau testé pour créer des interfaces Roblox dans le style simulateur « stud » en 3D : boutons, fenêtres, boutiques, HUD, emplacements d'objets, animations rebondissantes et 1022 icônes prêtes à l'emploi.",
    },
  },
];
