import "server-only";
import { db } from "@/lib/db";
import { AVATAR_MAX_SIDE, deleteStored, detectImage, IMAGE_MAX_SIDE, readUpload, saveImage } from "@/lib/storage";
import { isCompressedImage } from "@/lib/uploads";

// Rattrapage des images envoyées avant la compression automatique (captures des ressources, images des messages,
// photos de profil) : elles pèsent ~2 Mo chacune et Vercel les relit pour chaque taille affichée.

const isStored = (url: string | null | undefined): url is string => Boolean(url && url.includes(".blob.vercel-storage.com/") && !isCompressedImage(url));

// Nombre d'images encore à compresser
export async function uncompressedImageCount() {
  const [resources, messages, avatars] = await Promise.all([
    db.resource.findMany({ select: { images: true } }),
    db.message.findMany({ where: { images: { isEmpty: false } }, select: { images: true } }),
    db.user.findMany({ where: { avatarUrl: { contains: ".blob.vercel-storage.com/" } }, select: { avatarUrl: true } }),
  ]);
  return [...resources, ...messages].reduce((n, r) => n + r.images.filter(isStored).length, 0) + avatars.filter((u) => isStored(u.avatarUrl)).length;
}

// Nouvelle version compressée d'une image (l'originale est effacée plus tard, une fois la base à jour)
async function compressOne(url: string, maxSide: number) {
  try {
    const bytes = new Uint8Array(await readUpload(url));
    const ext = detectImage(bytes);
    return ext ? await saveImage(bytes, ext, maxSide) : url;
  } catch (err) {
    console.error("Compression d'image :", url, err);
    return url;
  }
}

async function compressList(images: string[], maxSide: number) {
  const next: string[] = [];
  for (const url of images) next.push(isStored(url) ? await compressOne(url, maxSide) : url);
  return next;
}

// Compresse les images une par une jusqu'à la fin du temps donné ; renvoie le nombre traité.
// Chaque fiche est mise à jour avant d'effacer ses anciennes images (jamais d'image cassée sur le site).
export async function compressStoredImages(budgetMs: number) {
  const stop = Date.now() + budgetMs;
  let done = 0;
  const replace = async (before: string[], after: string[]) => {
    const gone = before.filter((url, i) => url !== after[i]);
    done += gone.length;
    if (gone.length) await deleteStored(gone).catch(() => {});
  };

  const resources = (await db.resource.findMany({ select: { id: true, images: true } })).filter((r) => r.images.some(isStored));
  for (const r of resources) {
    if (Date.now() > stop) return done;
    const images = await compressList(r.images, IMAGE_MAX_SIDE);
    await db.resource.update({ where: { id: r.id }, data: { images } });
    await replace(r.images, images);
  }

  const messages = (await db.message.findMany({ where: { images: { isEmpty: false } }, select: { id: true, images: true } })).filter((m) => m.images.some(isStored));
  for (const m of messages) {
    if (Date.now() > stop) return done;
    const images = await compressList(m.images, IMAGE_MAX_SIDE);
    await db.message.update({ where: { id: m.id }, data: { images } });
    await replace(m.images, images);
  }

  const users = await db.user.findMany({ where: { avatarUrl: { contains: ".blob.vercel-storage.com/" } }, select: { id: true, avatarUrl: true } });
  for (const u of users) {
    if (!isStored(u.avatarUrl)) continue;
    if (Date.now() > stop) return done;
    const avatarUrl = await compressOne(u.avatarUrl, AVATAR_MAX_SIDE);
    await db.user.update({ where: { id: u.id }, data: { avatarUrl } });
    await replace([u.avatarUrl], [avatarUrl]);
  }
  return done;
}
