export type Locale = "es" | "en" | "fr";

export const locales: Locale[] = ["es", "en", "fr"];
export const defaultLocale: Locale = "es";

export const localeLabels: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
};

export type Dictionary = typeof import("./es").dict;
