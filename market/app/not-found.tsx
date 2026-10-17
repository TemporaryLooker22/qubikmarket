import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Page introuvable</h1>
      <p>Cette ressource n&apos;existe pas ou n&apos;est plus disponible.</p>
      <Link href="/resources">Retour au catalogue</Link>
    </>
  );
}
