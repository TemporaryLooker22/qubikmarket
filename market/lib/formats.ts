// Formats de fichiers acceptés à la vente, regroupés par type (toutes catégories confondues) :
// fichiers Roblox et scripts, modèles 3D, animations, images et textures, sons, vidéos, polices, et archives .zip
// (packs de plusieurs fichiers, dont le contenu est scanné). Pas de programmes ni de formats sans rapport avec Roblox.

export const FORMAT_GROUPS = [
  { id: "roblox", exts: [".rbxm", ".rbxmx", ".rbxl", ".rbxlx"] },
  { id: "script", exts: [".lua", ".luau"] },
  { id: "model", exts: [".fbx", ".obj", ".mtl", ".gltf", ".glb", ".blend", ".dae", ".stl"] },
  { id: "animation", exts: [".bvh"] },
  { id: "image", exts: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".tga", ".bmp", ".psd", ".dds"] },
  { id: "audio", exts: [".mp3", ".ogg", ".wav", ".flac", ".m4a", ".aif", ".aiff"] },
  { id: "video", exts: [".mp4", ".webm", ".mov"] },
  { id: "font", exts: [".ttf", ".otf"] },
  { id: "archive", exts: [".zip"] },
] as const;

export type FormatKind = (typeof FORMAT_GROUPS)[number]["id"];

export const ALLOWED_EXTENSIONS: string[] = FORMAT_GROUPS.flatMap((g) => [...g.exts]);

// Dans une archive .zip, on accepte aussi la documentation et les données qui accompagnent un pack
export const ZIP_EXTRA_EXTENSIONS = [".json", ".txt", ".md", ".pdf", ".csv", ".bin"];

// Programmes qui n'ont rien à faire dans une ressource Roblox : une archive qui en contient est refusée
export const DANGEROUS_EXTENSIONS = [
  ".exe", ".dll", ".bat", ".cmd", ".com", ".scr", ".msi", ".ps1", ".vbs", ".vbe", ".jar", ".apk", ".lnk", ".reg", ".hta", ".dmg", ".pif", ".cpl", ".wsf",
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 Mo (envoyé directement du navigateur vers le stockage)
export const MAX_FILE_SIZE_INLINE = 4 * 1024 * 1024; // sans Vercel Blob (en local) : envoyé avec le formulaire, 4 Mo

export function extOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

// Type d'un fichier d'après son extension ; dans une archive : aussi « doc » (documentation, données) et « dangerous »
export function kindOf(name: string, inArchive = false): FormatKind | "doc" | "dangerous" | null {
  const ext = extOf(name);
  const group = FORMAT_GROUPS.find((g) => (g.exts as readonly string[]).includes(ext));
  if (group) return group.id;
  if (inArchive && ZIP_EXTRA_EXTENSIONS.includes(ext)) return "doc";
  if (DANGEROUS_EXTENSIONS.includes(ext)) return "dangerous";
  return null;
}
