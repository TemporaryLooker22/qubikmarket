import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, dictionaries, isLocale, type Locale } from "./dictionaries";

// La langue choisie par le visiteur est gardée dans ce cookie (anglais par défaut)
export const LOCALE_COOKIE = "qubik-lang";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

// Les textes dans la langue du visiteur, pour les pages et actions côté serveur
export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
