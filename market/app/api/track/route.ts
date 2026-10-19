import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { botName, recordPageView } from "@/lib/analytics";

// Une page vue, envoyée par le navigateur (components/SourceTracker.tsx). Sans cookie de suivi :
// voir lib/analytics.ts. Les robots sont comptés côté serveur (app/layout.tsx), les admins pas du tout.
export async function POST(req: Request) {
  const done = new NextResponse(null, { status: 204 });
  // Seulement depuis nos propres pages
  const origin = req.headers.get("origin");
  try {
    if (origin && new URL(origin).host !== new URL(req.url).host) return done;
  } catch {
    return done;
  }
  if (botName(req.headers.get("user-agent") ?? "")) return done;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return done;
  }
  const user = await getCurrentUser().catch(() => null);
  if (user?.role === "ADMIN") return done;

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  await recordPageView(req.headers, {
    path: str(body.path) ?? "",
    prev: str(body.prev),
    source: str(body.source),
    referrer: str(body.referrer),
    campaign: str(body.campaign),
    locale: str(body.locale),
  }).catch((err) => console.error("Statistiques :", err));
  return done;
}
