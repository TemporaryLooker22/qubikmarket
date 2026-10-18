// Vidéo de présentation d'une ressource : un lien YouTube, dont on garde seulement l'identifiant de la vidéo
// (11 caractères). Liens acceptés : youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…, /embed/…, /live/…

const ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const [kind, value] = url.pathname.slice(1).split("/");
      if (["shorts", "embed", "live", "v"].includes(kind)) id = value;
    }
  }
  return id && ID.test(id) ? id : null;
}

// Miniature de la vidéo (servie par YouTube) et lecteur intégré (sans cookie tant qu'on ne lance pas la vidéo)
export const youTubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youTubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
export const youTubeWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
