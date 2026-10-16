import { requireUser } from "@/lib/auth";
import { SellForm } from "@/components/SellForm";

export const metadata = { title: "Vendre une ressource" };

export default async function SellPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Vendre une ressource</h1>
      <p className="mb-6 mt-2 text-muted">Ton fichier est scanné automatiquement contre les backdoors dès l&apos;envoi.</p>
      <div className="card p-6">
        <SellForm />
      </div>
    </div>
  );
}
