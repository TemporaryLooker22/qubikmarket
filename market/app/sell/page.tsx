import { requireUser } from "@/lib/auth";
import { SellForm } from "@/components/SellForm";

export const metadata = { title: "Vendre une ressource" };

export default async function SellPage() {
  await requireUser();
  return (
    <>
      <h1>Vendre une ressource</h1>
      <p>Ton fichier est scanné automatiquement contre les backdoors dès l&apos;envoi.</p>
      <SellForm />
    </>
  );
}
