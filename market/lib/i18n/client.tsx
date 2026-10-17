"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, dictionaries, type Locale } from "./dictionaries";

// Donne la langue aux composants côté navigateur (formulaires, barre de navigation…)
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return { locale, t: dictionaries[locale] };
}
