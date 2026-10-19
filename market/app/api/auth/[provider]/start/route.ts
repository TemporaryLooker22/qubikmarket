import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizeUrl, isConfigured, isProvider, newState, sign, STATE_COOKIE } from "@/lib/oauth";

// « Continuer avec Google / Discord » : on part vers la page de connexion du fournisseur.
// ?next= : la page où revenir ensuite ; ?src= : la provenance de la visite (voir components/SourceTracker.tsx)
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  if (!isProvider(provider) || !isConfigured(provider)) return NextResponse.redirect(new URL("/login?error=oauth_unavailable", req.url));

  const state = newState();
  const next = url.searchParams.get("next") ?? "";
  const src = (url.searchParams.get("src") ?? "").slice(0, 500);
  (await cookies()).set(STATE_COOKIE, await sign({ state, provider, next, src }, 10), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(provider, state));
}
