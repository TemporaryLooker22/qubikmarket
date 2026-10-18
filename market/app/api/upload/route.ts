import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_EXTENSIONS, extOf, IMAGE_CONTENT_TYPES, IMAGE_EXTENSIONS, MAX_FILE_SIZE, MAX_IMAGE_SIZE_DIRECT } from "@/lib/formats";

// Envoi direct du fichier vendu (uploads/, jusqu'à 50 Mo) et des captures d'écran (images/, jusqu'à 20 Mo),
// du navigateur vers Vercel Blob : Vercel limite les requêtes vers
// notre serveur à 4,5 Mo. Ici, on donne seulement l'autorisation d'envoyer (membre connecté, format accepté,
// taille maximale) ; le fichier est scanné ensuite, quand le formulaire est publié (lib/uploads.ts).
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user) throw new Error("Connexion requise");
        // Capture d'écran : seulement une vraie image (le type est imposé à l'envoi par Vercel Blob)
        if (pathname.startsWith("images/") && IMAGE_EXTENSIONS.includes(extOf(pathname))) {
          return { maximumSizeInBytes: MAX_IMAGE_SIZE_DIRECT, allowedContentTypes: IMAGE_CONTENT_TYPES, addRandomSuffix: true, tokenPayload: user.id };
        }
        if (!pathname.startsWith("uploads/") || !ALLOWED_EXTENSIONS.includes(extOf(pathname))) throw new Error("Format non accepté");
        return { maximumSizeInBytes: MAX_FILE_SIZE, addRandomSuffix: true, tokenPayload: user.id };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
