"use server";

// Toutes les actions déclenchées par les formulaires du site.
// Elles s'exécutent sur le serveur : l'utilisateur ne peut pas les modifier.

import path from "node:path";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, requireAdmin, requireUser } from "@/lib/auth";
import { scanFile } from "@/lib/scan";
import { saveUpload } from "@/lib/storage";
import { ALLOWED_EXTENSIONS, CATEGORIES, MAX_FILE_SIZE, slugify } from "@/lib/catalog";
import { createCheckoutSession, isDemoMode } from "@/lib/payments";

export type FormState = { error?: string } | undefined;

// ---------- Comptes ----------

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Le pseudo doit faire au moins 3 caractères")
    .max(20, "Le pseudo doit faire au plus 20 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Le pseudo ne peut contenir que des lettres, chiffres et _"),
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, email, password } = parsed.data;

  const existing = await db.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) return { error: "Ce pseudo ou cet email est déjà utilisé" };

  // Le tout premier compte créé devient administrateur (pratique pour démarrer)
  const isFirstUser = (await db.user.count()) === 0;

  const user = await db.user.create({
    data: {
      username,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: isFirstUser ? "ADMIN" : "USER",
    },
  });

  await createSession(user.id);
  redirect("/dashboard");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Email ou mot de passe incorrect" };
  }

  await createSession(user.id);
  // Retour à la page d'origine (ex. la ressource qu'on voulait acheter)
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------- Publication d'une ressource ----------

const resourceSchema = z.object({
  title: z.string().trim().min(4, "Le titre doit faire au moins 4 caractères").max(80, "Titre trop long (80 max)"),
  summary: z.string().trim().min(10, "Le résumé doit faire au moins 10 caractères").max(160, "Résumé trop long (160 max)"),
  description: z.string().trim().min(30, "La description doit faire au moins 30 caractères").max(10000),
  category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]], { message: "Choisis une catégorie" }),
  price: z.coerce.number().min(0, "Prix invalide").max(500, "Prix maximum : 500 €"),
});

export async function publishResource(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const priceCents = Math.round(data.price * 100);
  if (priceCents > 0 && priceCents < 100) return { error: "Le prix minimum est de 1 € (ou 0 pour gratuit)" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Ajoute le fichier de ta ressource" };
  if (file.size > MAX_FILE_SIZE) return { error: "Fichier trop lourd (4 Mo maximum)" };
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: `Format non accepté. Formats autorisés : ${ALLOWED_EXTENSIONS.join(", ")}` };
  }

  // 1) Scan anti-backdoor automatique
  const bytes = new Uint8Array(await file.arrayBuffer());
  let report;
  try {
    report = scanFile(bytes, file.name);
  } catch (err) {
    return { error: `Impossible de lire ce fichier Roblox : ${(err as Error).message}` };
  }

  // 2) Décision selon le verdict :
  //    propre -> en ligne tout de suite (pas de file d'attente !)
  //    suspect -> vérification par un modérateur
  //    dangereux -> refus automatique
  const status = report.verdict === "clean" ? "APPROVED" : report.verdict === "suspicious" ? "PENDING" : "REJECTED";
  const reviewNote =
    report.verdict === "dangerous"
      ? "Refus automatique : le scanner a détecté du code dangereux. Consulte le rapport, corrige ton fichier et republie."
      : null;

  // 3) Enregistrement
  const storedName = await saveUpload(bytes, file.name);
  const baseSlug = slugify(data.title) || "ressource";
  const slug = (await db.resource.findUnique({ where: { slug: baseSlug } }))
    ? `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
    : baseSlug;

  await db.resource.create({
    data: {
      slug,
      title: data.title,
      summary: data.summary,
      description: data.description,
      category: data.category,
      priceCents,
      status,
      reviewNote,
      scanVerdict: report.verdict,
      scanScore: report.score,
      scanReport: JSON.stringify(report),
      fileName: file.name,
      filePath: storedName,
      fileSize: file.size,
      sellerId: user.id,
    },
  });

  revalidatePath("/");
  redirect(`/dashboard?published=${status.toLowerCase()}`);
}

// ---------- Achat ----------

export async function buyResource(formData: FormData) {
  const user = await getCurrentUser();
  const resourceId = String(formData.get("resourceId"));
  const resource = await db.resource.findUnique({ where: { id: resourceId } });
  if (!resource || resource.status !== "APPROVED") redirect("/resources");
  if (!user) redirect(`/login?next=/resources/${resource.slug}`);
  if (resource.sellerId === user.id) redirect(`/resources/${resource.slug}`);

  const existing = await db.purchase.findUnique({
    where: { userId_resourceId: { userId: user.id, resourceId } },
  });
  if (existing?.status === "PAID") redirect(`/resources/${resource.slug}`);

  // Ressource gratuite, ou mode démo : l'achat est validé immédiatement
  if (resource.priceCents === 0 || isDemoMode) {
    await db.purchase.upsert({
      where: { userId_resourceId: { userId: user.id, resourceId } },
      create: { userId: user.id, resourceId, amountCents: resource.priceCents, status: "PAID" },
      update: { status: "PAID" },
    });
    revalidatePath(`/resources/${resource.slug}`);
    redirect(`/resources/${resource.slug}?bought=1`);
  }

  // Ressource payante : paiement via Stripe
  const purchase = await db.purchase.upsert({
    where: { userId_resourceId: { userId: user.id, resourceId } },
    create: { userId: user.id, resourceId, amountCents: resource.priceCents },
    update: { amountCents: resource.priceCents },
  });
  const session = await createCheckoutSession({
    purchaseId: purchase.id,
    title: resource.title,
    priceCents: resource.priceCents,
    slug: resource.slug,
  });
  await db.purchase.update({ where: { id: purchase.id }, data: { stripeSessionId: session.id } });
  redirect(session.url!);
}

// ---------- Modération ----------

export async function moderateResource(formData: FormData) {
  await requireAdmin();
  const resourceId = String(formData.get("resourceId"));
  const decision = formData.get("decision") === "approve" ? "APPROVED" : "REJECTED";
  const note = String(formData.get("note") ?? "").trim() || null;

  await db.resource.update({
    where: { id: resourceId },
    data: { status: decision, reviewNote: note },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}
