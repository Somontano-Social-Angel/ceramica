import type { Locale } from "../i18n/types";
import { useTranslations, lpath, sectionHref, isHomePath, stripLocaleFromPath } from "../i18n";

export interface NavLink {
  href: string;
  label: string;
}

export function getLandingSections(locale: Locale): NavLink[] {
  const t = useTranslations(locale);
  const s = (id: string, key: string) => ({ href: sectionHref(locale, id), label: t(key) });
  return [
    s("inicio", "nav.sections.home"),
    s("nosotros", "nav.sections.nosotros"),
    s("firma", "nav.sections.firma"),
    s("carta", "nav.sections.carta"),
    s("novedades", "nav.sections.novedades"),
    s("experiencia", "nav.sections.experiencia"),
    s("horario", "nav.sections.horario"),
    s("contacto", "nav.sections.contacto"),
    s("faq", "nav.sections.faq"),
    s("reserva", "nav.sections.reserva"),
  ];
}

export function getPageLinks(locale: Locale): NavLink[] {
  const t = useTranslations(locale);
  return [
    { href: lpath(locale, "/carta"), label: t("nav.cartaFull") },
    { href: lpath(locale, "/la-reto"), label: t("nav.reto") },
    { href: lpath(locale, "/reservar"), label: t("nav.bookTable") },
  ];
}

export function getReservarCta(locale: Locale) {
  const t = useTranslations(locale);
  return { href: lpath(locale, "/reservar"), label: t("nav.book") };
}

export function isNavActive(href: string, pathname: string, locale: Locale): boolean {
  const stripped = stripLocaleFromPath(pathname);
  if (href === lpath(locale, "/") || href.endsWith("#inicio")) {
    return isHomePath(pathname, locale);
  }
  if (href.includes("#")) return false;
  const target = stripLocaleFromPath(href);
  return stripped === target || stripped.startsWith(`${target}/`);
}
