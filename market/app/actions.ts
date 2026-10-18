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
import { detectImage, saveImage, saveUpload } from "@/lib/storage";
import { ALLOWED_EXTENSIONS, CATEGORIES, MAX_FILE_SIZE, MAX_IMAGE_SIZE, MAX_IMAGES, slugify } from "@/lib/catalog";
import { createCheckoutSession, isDemoMode } from "@/lib/payments";
import { buyerFeeCents } from "@/lib/buyer-fee";
import { grantFounderIfEligible } from "@/lib/sellers";
import { enqueueAnalysis, kickAiQueue } from "@/lib/ai/run";
import { createOnboardingLink, createSellerAccount, PAYOUT_COUNTRIES } from "@/lib/connect";
import { cookies } from "next/headers";
import { isLocale, type Dictionary } from "@/lib/i18n/dictionaries";
import { getDictionary, LOCALE_COOKIE } from "@/lib/i18n/server";

export type FormState = { error?: string } | undefined;

// ---------- Langue ----------

// Sélecteur EN / FR : on retient le choix dans un cookie pendant un an
export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

// ---------- Comptes ----------

// Page où revenir après l'inscription ou la connexion : seulement une adresse du site (jamais un autre site)
function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "");
  const ok = next.startsWith("/") && !next.startsWith("//") && !/^\/(login|register)\b/.test(next);
  return ok ? next : "/";
}

// Les messages d'erreur sont dans la langue du visiteur
const registerSchema = (e: Dictionary["errors"]) =>
  z
    .object({
      username: z
        .string()
        .trim()
        .min(3, e.usernameMin)
        .max(20, e.usernameMax)
        .regex(/^[a-zA-Z0-9_]+$/, e.usernameChars),
      email: z.string().trim().toLowerCase().email(e.email),
      password: z.string().min(8, e.passwordMin),
      confirm: z.string(),
      age: z.literal("on", { errorMap: () => ({ message: e.ageRequired }) }),
      terms: z.literal("on", { errorMap: () => ({ message: e.termsRequired }) }),
    })
    .refine((d) => d.password === d.confirm, { message: e.passwordMismatch, path: ["confirm"] });

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDictionary();
  const parsed = registerSchema(t.errors).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, email, password } = parsed.data;

  const existing = await db.user.findFirst({ where: { OR: [{ email }, { username: { equals: username, mode: "insensitive" } }] } });
  if (existing) return { error: t.errors.taken };

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
  // Retour à la page d'origine (ex. la ressource qu'on voulait acheter), sinon l'accueil
  redirect(safeNext(formData.get("next")));
}

// Vérification du pseudo pendant la frappe (inscription) : true = libre
export async function checkUsername(username: string): Promise<boolean> {
  const name = username.trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) return false;
  const existing = await db.user.findFirst({ where: { username: { equals: name, mode: "insensitive" } }, select: { id: true } });
  return !existing;
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const { t } = await getDictionary();
    return { error: t.errors.badLogin };
  }

  await createSession(user.id);
  // Retour à la page d'origine (ex. la ressource qu'on voulait acheter), sinon l'accueil
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------- Publication d'une ressource ----------

const resourceSchema = (e: Dictionary["errors"]) =>
  z.object({
    title: z.string().trim().min(4, e.titleMin).max(80, e.titleMax),
    summary: z.string().trim().min(10, e.summaryMin).max(160, e.summaryMax),
    description: z.string().trim().min(30, e.descriptionMin).max(10000),
    category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]], { message: e.category }),
    price: z.coerce.number().min(0, e.price).max(500, e.priceMax),
  });

export async function publishResource(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { locale, t } = await getDictionary();

  const parsed = resourceSchema(t.errors).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const priceCents = Math.round(data.price * 100);
  if (priceCents > 0 && priceCents < 100) return { error: t.errors.priceMin };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t.errors.fileMissing };
  if (file.size > MAX_FILE_SIZE) return { error: t.errors.fileTooBig };
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: t.errors.fileFormat(ALLOWED_EXTENSIONS.join(", ")) };
  }

  // Captures d'écran (facultatives) : on vérifie que ce sont de vraies images avant de les garder
  const imageFiles = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (imageFiles.length > MAX_IMAGES) return { error: t.errors.tooManyImages(MAX_IMAGES) };
  const images: { bytes: Uint8Array; ext: NonNullable<ReturnType<typeof detectImage>> }[] = [];
  for (const img of imageFiles) {
    if (img.size > MAX_IMAGE_SIZE) return { error: t.errors.imageTooBig };
    const bytes = new Uint8Array(await img.arrayBuffer());
    const ext = detectImage(bytes);
    if (!ext) return { error: t.errors.imageFormat };
    images.push({ bytes, ext });
  }

  // 1) Scan anti-backdoor automatique
  const bytes = new Uint8Array(await file.arrayBuffer());
  let report;
  try {
    report = scanFile(bytes, file.name);
  } catch (err) {
    return { error: t.errors.fileUnreadable((err as Error).message) };
  }

  // 2) Décision selon le verdict :
  //    propre -> analyse IA du contenu (quelques secondes), puis en ligne (ou modération si l'IA signale un problème)
  //    suspect -> vérification par un modérateur
  //    dangereux -> refus automatique
  const status = report.verdict === "clean" ? "ANALYZING" : report.verdict === "suspicious" ? "PENDING" : "REJECTED";
  // Note enregistrée dans la langue du vendeur au moment de la publication
  const reviewNote = report.verdict === "dangerous" ? t.errors.autoReject : null;

  // 3) Enregistrement
  const storedName = await saveUpload(bytes, file.name);
  const imageUrls = await Promise.all(images.map((img) => saveImage(img.bytes, img.ext)));
  const baseSlug = slugify(data.title) || "ressource";
  const slug = (await db.resource.findUnique({ where: { slug: baseSlug } }))
    ? `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
    : baseSlug;

  const created = await db.resource.create({
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
      images: imageUrls,
      sellerId: user.id,
      // Première version de l'historique (les mises à jour s'ajoutent depuis « Modifier → Versions »)
      versions: {
        create: {
          version: "1.0",
          fileName: file.name,
          filePath: storedName,
          fileSize: file.size,
          scanVerdict: report.verdict,
          scanScore: report.score,
          scanReport: JSON.stringify(report),
          status,
          reviewNote,
        },
      },
    },
    include: { versions: { select: { id: true } } },
  });

  // Analyse IA dans la file d'attente (sauf fichier dangereux, déjà refusé) : le vendeur n'attend pas,
  // sa place dans la file s'affiche dans Mon espace
  if (status !== "REJECTED") {
    await enqueueAnalysis(created.versions[0].id, locale);
    kickAiQueue();
  }

  revalidatePath("/");
  redirect(`/dashboard?published=${status.toLowerCase()}`);
}

// Retirer une ressource de la vente (ou la remettre) : seulement son vendeur, et seulement si elle est en ligne ou retirée.
// Une ressource retirée disparaît du catalogue, mais ceux qui l'ont achetée gardent leur téléchargement.
export async function setListed(formData: FormData) {
  const user = await requireUser();
  const resourceId = String(formData.get("resourceId"));
  const listed = formData.get("listed") === "1";
  const resource = await db.resource.findUnique({ where: { id: resourceId }, select: { sellerId: true, status: true, slug: true } });
  if (!resource || resource.sellerId !== user.id) return;
  if (resource.status !== (listed ? "UNLISTED" : "APPROVED")) return;

  await db.resource.update({ where: { id: resourceId }, data: { status: listed ? "APPROVED" : "UNLISTED" } });
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/resources/${resource.slug}`);
  revalidatePath("/");
}

// ---------- Versements aux vendeurs ----------

// « Configurer mes versements » : crée le compte Stripe du vendeur puis l'envoie sur le formulaire d'inscription Stripe
export async function startPayoutSetup(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard/sales");
  const { t } = await getDictionary();
  const country = String(formData.get("country") ?? "").toUpperCase();
  if (!PAYOUT_COUNTRIES.includes(country)) return { error: t.dashboard.payouts.setupError };

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  let url: string;
  try {
    const seller = await db.user.findUnique({ where: { id: user.id }, select: { stripeAccountId: true } });
    const accountId = seller?.stripeAccountId ?? (await createSellerAccount(user, country));
    url = await createOnboardingLink(accountId, appUrl);
  } catch (err) {
    console.error("Configuration des versements :", err);
    return { error: t.dashboard.payouts.setupError };
  }
  redirect(url);
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
      create: { userId: user.id, resourceId, amountCents: resource.priceCents, status: "PAID", paidAt: new Date() },
      update: { status: "PAID", paidAt: new Date() },
    });
    revalidatePath(`/resources/${resource.slug}`);
    redirect(`/resources/${resource.slug}?bought=1`);
  }

  // Ressource payante : paiement via Stripe (prix + frais de service, voir lib/buyer-fee.ts)
  const feeCents = buyerFeeCents(resource.priceCents);
  const amounts = { amountCents: resource.priceCents + feeCents, buyerFeeCents: feeCents };
  const purchase = await db.purchase.upsert({
    where: { userId_resourceId: { userId: user.id, resourceId } },
    create: { userId: user.id, resourceId, ...amounts },
    // Nouvel essai (ou nouvel achat après un remboursement) : l'achat repart « en attente »
    update: { ...amounts, status: "PENDING" },
  });
  const { t } = await getDictionary();
  const session = await createCheckoutSession({
    purchaseId: purchase.id,
    title: resource.title,
    priceCents: resource.priceCents,
    feeCents,
    feeLabel: t.resource.serviceFeeLine,
    slug: resource.slug,
    email: user.email,
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

  const resource = await db.resource.update({
    where: { id: resourceId },
    data: { status: decision, reviewNote: note },
  });
  // La version en attente de la ressource suit la décision
  await db.resourceVersion.updateMany({
    where: { resourceId, version: resource.version, status: "PENDING" },
    data: { status: decision === "APPROVED" ? "LIVE" : "REJECTED", reviewNote: note, aiReviewed: true },
  });
  // Badge « Contenu vérifié » seulement si l'IA n'a rien signalé (un modérateur peut approuver malgré un signalement)
  if (decision === "APPROVED") {
    const live = await db.resourceVersion.findUnique({ where: { resourceId_version: { resourceId, version: resource.version } } });
    await db.resource.update({ where: { id: resourceId }, data: { aiVerified: live?.aiStatus === "DONE" && live.aiFlagged === false } });
  }
  if (decision === "APPROVED") await grantFounderIfEligible(resource.sellerId);
  revalidatePath("/admin");
  revalidatePath("/");
}
