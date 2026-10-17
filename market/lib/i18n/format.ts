import { dictionaries, type Locale } from "./dictionaries";

// Mise en forme des prix, tailles et dates selon la langue
const INTL_LOCALES: Record<Locale, string> = { en: "en-GB", fr: "fr-FR" };

export function formatPrice(cents: number, locale: Locale) {
  if (cents === 0) return dictionaries[locale].price.free;
  return new Intl.NumberFormat(INTL_LOCALES[locale], { style: "currency", currency: "EUR" }).format(cents / 100);
}

// Comme formatPrice, mais affiche 0 € au lieu de « Gratuit » (pour les revenus)
export function formatAmount(cents: number, locale: Locale) {
  return new Intl.NumberFormat(INTL_LOCALES[locale], { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatSize(bytes: number, locale: Locale) {
  const u = dictionaries[locale].size;
  if (bytes < 1024) return `${bytes} ${u.b}`;
  // 1,1 Mo en français, 1.1 MB en anglais
  const decimal = (n: number) => n.toLocaleString(INTL_LOCALES[locale], { maximumFractionDigits: 1 });
  if (bytes < 1024 * 1024) return `${decimal(bytes / 1024)} ${u.kb}`;
  return `${decimal(bytes / 1024 / 1024)} ${u.mb}`;
}

export function formatDate(date: Date, locale: Locale) {
  return date.toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "long", year: "numeric" });
}

export function formatNumber(n: number, locale: Locale) {
  return n.toLocaleString(INTL_LOCALES[locale]);
}
