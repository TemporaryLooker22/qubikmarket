import Link from "next/link";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { directUploads } from "@/lib/storage";
import { links } from "@/lib/notifications";
import { AvatarEditor } from "@/components/profile/AvatarEditor";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.profile.settings.title };
}

// Mon espace → Paramètres : photo de profil (recadrée dans un cercle). Le pseudo et l'e-mail ne se modifient pas.
export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const { t } = await getDictionary();
  const s = t.profile.settings;
  return (
    <>
      <DashboardHeader title={s.title} intro={s.intro} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">{s.photo}</h2>
          <p className="mb-5 mt-1 text-sm text-muted">{s.photoHint}</p>
          <AvatarEditor username={user.username} current={user.avatarUrl} canUpload={directUploads} />
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">{s.account}</h2>
          <dl className="mt-2 divide-y divide-border">
            {[
              [s.username, user.username],
              [s.email, user.email],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="truncate font-semibold">{value}</dd>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" /> {s.locked}
                </span>
              </div>
            ))}
          </dl>
          <Link href={links.profile(user.username)} className="btn-ghost mt-3 w-full justify-center px-4 py-2.5 text-sm">
            {s.viewProfile} →
          </Link>
        </section>
      </div>
    </>
  );
}
