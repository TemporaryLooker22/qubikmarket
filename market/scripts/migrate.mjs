// Applique les migrations de la base de données pendant le build.
// Sur Vercel, seulement pour la production : les aperçus (branche design/page-blanche…) utilisent
// la même base que le site en ligne et ne doivent jamais la modifier avant la mise en production.
import { execSync } from "node:child_process";

if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.log(`Déploiement Vercel « ${process.env.VERCEL_ENV} » : migrations ignorées (production seulement).`);
} else {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
