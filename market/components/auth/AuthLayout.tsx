import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getShowcaseImages } from "@/lib/showcase";
import { AuthShowcase } from "./AuthShowcase";

// Écran partagé des pages d'inscription et de connexion : formulaire à gauche, panneau visuel à droite (ordinateur)
export async function AuthLayout({ title, subtitle, t, children }: { title: string; subtitle: React.ReactNode; t: Dictionary; children: React.ReactNode }) {
  const images = await getShowcaseImages();
  return (
    <div className="full-bleed container-q py-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex items-center justify-center py-6 lg:py-10">
          <div className="animate-fade-up w-full max-w-md">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mb-7 mt-2 text-[15px] text-muted">{subtitle}</p>
            {children}
          </div>
        </div>
        <div className="hidden lg:block">
          <AuthShowcase images={images} t={t} />
        </div>
      </div>
    </div>
  );
}
