import { NextResponse, type NextRequest } from "next/server";

// Transmet le chemin de la page demandée à app/layout.tsx (x-pathname), qui en a besoin pour le mode maintenance
// (la page de connexion reste ouverte pendant une maintenance). Ne lit pas la base : très léger.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages seulement : ni les routes /api, ni les fichiers de Next.js, ni les images et fichiers publics
  matcher: ["/((?!api/|_next/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
