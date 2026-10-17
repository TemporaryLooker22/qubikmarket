import type { ScanReport } from "./scan";

// Scan anti-backdoor dans le navigateur, dès que le vendeur dépose son fichier (formulaire de vente).
// C'est seulement un aperçu : le serveur refait toujours son propre scan à la publication (lib/scan.ts).
// Le scanner n'est téléchargé qu'au premier dépôt, pour ne pas alourdir la page.
export async function scanInBrowser(file: File): Promise<ScanReport> {
  const [{ default: scanner }, buffer] = await Promise.all([
    import("./scanner/scanner.js") as Promise<{ default: { scanFile(bytes: Uint8Array, fileName: string): ScanReport } }>,
    file.arrayBuffer(),
  ]);
  return scanner.scanFile(new Uint8Array(buffer), file.name);
}
