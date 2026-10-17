import Image from "next/image";

// Logo de Qubik (noir et jaune), fichier public/logo.png
// Les icônes d'onglet sont dans app/icon.png et app/apple-icon.png
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return <Image src="/logo.png" alt="" width={64} height={64} className={className} priority />;
}
