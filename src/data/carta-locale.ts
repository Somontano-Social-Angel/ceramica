import type { CartaCategoria, CartaData, PlatoItem } from "./carta";
import type { Locale } from "../i18n/types";
import enPack from "../i18n/carta/en.json";
import frPack from "../i18n/carta/fr.json";

export type CartaItemTranslation = {
  nombre: string;
  descripcion?: string;
};

export type CartaCategoryTranslation = {
  categoria?: string;
  subcategoria?: string;
  nota?: string;
};

type CartaLocalePack = {
  categories: Record<string, CartaCategoryTranslation>;
  items: Record<string, CartaItemTranslation>;
};

const packs: Record<Exclude<Locale, "es">, CartaLocalePack> = {
  en: enPack as CartaLocalePack,
  fr: frPack as CartaLocalePack,
};

function localizeItem(item: PlatoItem, pack: CartaLocalePack): PlatoItem {
  const tr = pack.items[item.id];
  if (!tr) {
    return { ...item, nombreEs: item.nombre };
  }
  const nombreEs = item.nombre;
  const descripcionEs = item.descripcion;
  const nombre = tr.nombre || nombreEs;
  const descripcion = tr.descripcion ?? descripcionEs;
  const buscar = [item.buscar_por, nombreEs, nombre, descripcionEs, descripcion]
    .filter(Boolean)
    .join(" ");

  return {
    ...item,
    nombre,
    descripcion,
    nombreEs,
    descripcionEs,
    buscar_por: buscar,
  };
}

function localizeCategory(cat: CartaCategoria, pack: CartaLocalePack): CartaCategoria {
  const tr = pack.categories[cat.id];
  if (!tr) return cat;
  return {
    ...cat,
    categoria: tr.categoria ?? cat.categoria,
    subcategoria: tr.subcategoria ?? cat.subcategoria,
    nota: tr.nota ?? cat.nota,
    items: cat.items,
  };
}

/** Aplica traducciones de carta; en español devuelve la carta sin cambios. */
export function applyCartaLocale(carta: CartaData, locale: Locale): CartaData {
  if (locale === "es") return carta;

  const pack = packs[locale];
  if (!pack) return carta;

  return {
    ...carta,
    categorias: carta.categorias.map((cat) => {
      const localizedCat = localizeCategory(cat, pack);
      return {
        ...localizedCat,
        items: localizedCat.items.map((item) => localizeItem(item, pack)),
      };
    }),
  };
}
