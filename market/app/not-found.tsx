import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-4xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-muted">Cette ressource n&apos;existe pas ou n&apos;est plus disponible.</p>
      <Link href="/resources" className="btn mt-6">Retour au catalogue</Link>
    </div>
  );
}
