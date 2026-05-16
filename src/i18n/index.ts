import { getRelativeLocaleUrl } from "astro:i18n";
import { dict as es } from "./es";
import { dict as en } from "./en";
import { dict as fr } from "./fr";
import { defaultLocale, locales, type Locale } from "./types";

export { defaultLocale, locales, localeLabels } from "./types";
export type { Locale };

const dictionaries = { es, en, fr } as const;

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function useTranslations(locale: string | undefined) {
  const lang = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const dict = dictionaries[lang];
  const fallback = dictionaries[defaultLocale];

  return function t(key: string, params?: Record<string, string>): string {
    let text = getNested(dict as unknown as Record<string, unknown>, key);
    if (text === undefined) text = getNested(fallback as unknown as Record<string, unknown>, key);
    if (text === undefined) return key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  };
}

export function getLocaleFromPath(pathname: string): Locale {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (seg === "en" || seg === "fr") return seg;
  return defaultLocale;
}

export function stripLocaleFromPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "en" || parts[0] === "fr") {
    const rest = parts.slice(1).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname || "/";
}

/** Ruta localizada (path sin prefijo de idioma, ej. `/carta`). */
export function lpath(locale: Locale, path: string = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return getRelativeLocaleUrl(locale, clean);
}

export function sectionHref(locale: Locale, sectionId: string): string {
  const base = lpath(locale, "/").replace(/\/$/, "") || "";
  return `${base}#${sectionId}`;
}

export function isHomePath(pathname: string, locale: Locale): boolean {
  const stripped = stripLocaleFromPath(pathname);
  return stripped === "/" || stripped === "";
}

export function getAlergenoLabels(locale: string | undefined): Record<string, string> {
  const t = useTranslations(locale);
  const ids = Object.keys(dictionaries.es.allergens);
  return Object.fromEntries(ids.map((id) => [id, t(`allergens.${id}`)]));
}

export function getDietaLabels(locale: string | undefined): Record<string, string> {
  const t = useTranslations(locale);
  const ids = Object.keys(dictionaries.es.diets);
  return Object.fromEntries(ids.map((id) => [id, t(`diets.${id}`)]));
}

export function getCartaUiStrings(locale: string | undefined): Record<string, string> {
  const t = useTranslations(locale);
  const keys = Object.keys(dictionaries.es.cartaUi) as (keyof (typeof dictionaries.es)["cartaUi"])[];
  return Object.fromEntries(keys.map((k) => [k, t(`cartaUi.${k}`)]));
}

export function getReservarClientI18n(locale: string | undefined) {
  const lang = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const r = dictionaries[lang].reservar;
  return {
    dow: [...r.dow],
    months: [...r.months],
    pickDay: r.pickDay,
    pickTime: r.pickTime,
    morning: r.morning,
    evening: r.evening,
    ok: r.ok,
    ...r.client,
  };
}
