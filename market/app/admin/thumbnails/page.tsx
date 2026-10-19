import { getDictionary } from "@/lib/i18n/server";
import { hasThumbKeys, THUMB_MODELS, THUMB_STYLES } from "@/lib/thumbnails";
import { PageTitle } from "@/components/admin/AdminUi";
import { ThumbnailStudio } from "@/components/admin/ThumbnailStudio";

// Modération → Thumbnails : outil de test du générateur de thumbnails Roblox (admins seulement, voir le layout)
export default async function ThumbnailsPage() {
  const { t } = await getDictionary();
  const models = Object.entries(THUMB_MODELS).map(([id, m]) => ({ id, name: m.name, perDay: m.perDay }));
  return (
    <>
      <PageTitle title={t.thumbs.title} intro={t.thumbs.intro} />
      {!hasThumbKeys() && <p className="mb-4 rounded-xl bg-warn-bg px-4 py-3 text-sm font-semibold text-warn">{t.thumbs.noKeys}</p>}
      <ThumbnailStudio models={models} styles={Object.keys(THUMB_STYLES)} />
    </>
  );
}
