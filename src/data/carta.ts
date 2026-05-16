import brasaSandwich from "../../JSON/Brasa_sandwich.json";
import combinados from "../../JSON/Combinados.json";
import ensalada from "../../JSON/Ensalada.json";
import hamburguesa from "../../JSON/Hamburguesa.json";
import pizzas1 from "../../JSON/Pizzas_1.json";
import pizzas2 from "../../JSON/Pizzas_2.json";
import raciones from "../../JSON/Raciones.json";
import type { Locale } from "../i18n/types";
import { applyCartaLocale } from "./carta-locale";

export type AlergenoId =
  | "gluten"
  | "crustaceos"
  | "huevo"
  | "pescado"
  | "cacahuetes"
  | "soja"
  | "leche"
  | "frutos_de_cascara"
  | "apio"
  | "mostaza"
  | "sesamo"
  | "sulfitos"
  | "altramuces"
  | "moluscos";

export interface PlatoItem {
  id: string;
  nombre: string;
  /** Nombre en español (carta del local) cuando la UI está en otro idioma. */
  nombreEs?: string;
  descripcion?: string;
  /** Descripción en español si se muestra traducción arriba. */
  descripcionEs?: string;
  precio: string;
  ingredientes: string[];
  alergenos_contiene: AlergenoId[];
  alergenos_posibles: AlergenoId[];
  dietas_no_apto: string[];
  dietas_apto_si_modifica: string[];
  buscar_por: string;
  tags: string[];
  orden: number;
  numero?: string;
  observaciones?: string[];
}

export interface CartaCategoria {
  id: string;
  categoria: string;
  subcategoria?: string;
  nota?: string;
  items: PlatoItem[];
}

export interface CartaData {
  categorias: CartaCategoria[];
  alergenos_referencia: AlergenoId[];
}

export const ALERGENO_LABELS: Record<AlergenoId, string> = {
  gluten: "Gluten",
  crustaceos: "Crustáceos",
  huevo: "Huevo",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  leche: "Leche",
  frutos_de_cascara: "Frutos de cáscara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sésamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

export const ALERGENO_ORDEN: AlergenoId[] = [
  "gluten",
  "crustaceos",
  "huevo",
  "pescado",
  "cacahuetes",
  "soja",
  "leche",
  "frutos_de_cascara",
  "apio",
  "mostaza",
  "sesamo",
  "sulfitos",
  "altramuces",
  "moluscos",
];

export const DIETA_LABELS: Record<string, string> = {
  sin_gluten: "Sin gluten",
  sin_lactosa: "Sin lactosa",
  sin_huevo: "Sin huevo",
  sin_pescado: "Sin pescado",
  sin_marisco: "Sin marisco",
  sin_frutos_secos: "Sin frutos secos",
  vegetariano_estricto: "Vegetariano estricto",
  vegetariano: "Vegetariano",
};

type RawItem = {
  nombre: string;
  descripcion?: string;
  precio: string;
  ingredientes?: string[];
  alergenos_contiene?: string[];
  alergenos_posibles?: string[];
  dietas_no_apto?: string[];
  dietas_apto_si_modifica?: string[];
  buscar_por?: string;
  tags?: string[];
  orden?: number;
  numero?: string;
  observaciones?: string[];
};

type RawCategoria = {
  categoria: string;
  slug: string;
  items?: RawItem[];
  subcategorias?: { nombre: string; items: RawItem[] }[];
  nota?: string;
};

type RawFile = {
  categorias: RawCategoria[];
  alergenos_referencia?: string[];
};

const MENU_FILES: RawFile[] = [
  raciones as RawFile,
  ensalada as RawFile,
  brasaSandwich as RawFile,
  hamburguesa as RawFile,
  pizzas1 as RawFile,
  pizzas2 as RawFile,
  combinados as RawFile,
];

const TAB_ORDER = [
  "raciones",
  "ensaladas",
  "brasa",
  "sandwiches",
  "hamburguesas",
  "pizzas",
  "platos-combinados-platos-combinados-de-carne",
  "platos-combinados-platos-combinados-de-pescado",
];

function isPizzaCategoryId(id: string): boolean {
  return id === "pizzas" || id.startsWith("pizzas-");
}

function mergePizzaCategories(categorias: CartaCategoria[]): CartaCategoria[] {
  const pizzaCats = categorias.filter((c) => isPizzaCategoryId(c.id));
  if (pizzaCats.length === 0) return categorias;

  const items = pizzaCats
    .flatMap((c) => c.items)
    .sort((a, b) => a.orden - b.orden);
  const nota = pizzaCats.map((c) => c.nota).find(Boolean);

  const merged: CartaCategoria = {
    id: "pizzas",
    categoria: "Pizzas",
    nota,
    items,
  };

  const rest = categorias.filter((c) => !isPizzaCategoryId(c.id));
  rest.push(merged);
  return rest;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeItem(raw: RawItem, categoriaId: string): PlatoItem {
  const key = raw.buscar_por || slugify(raw.nombre);
  return {
    id: `${categoriaId}--${key}`,
    nombre: raw.nombre,
    descripcion: raw.descripcion,
    precio: raw.precio,
    ingredientes: raw.ingredientes ?? [],
    alergenos_contiene: (raw.alergenos_contiene ?? []) as AlergenoId[],
    alergenos_posibles: (raw.alergenos_posibles ?? []) as AlergenoId[],
    dietas_no_apto: raw.dietas_no_apto ?? [],
    dietas_apto_si_modifica: raw.dietas_apto_si_modifica ?? [],
    buscar_por: raw.buscar_por ?? slugify(raw.nombre),
    tags: raw.tags ?? [],
    orden: raw.orden ?? 0,
    numero: raw.numero,
    observaciones: raw.observaciones,
  };
}

function flattenCategoria(cat: RawCategoria): CartaCategoria[] {
  if (cat.subcategorias?.length) {
    return cat.subcategorias.map((sub) => {
      const id = `${cat.slug}-${slugify(sub.nombre)}`;
      return {
        id,
        categoria: cat.categoria,
        subcategoria: sub.nombre,
        nota: cat.nota,
        items: sub.items.map((item) => normalizeItem(item, id)),
      };
    });
  }

  const id = cat.slug;
  return [
    {
      id,
      categoria: cat.categoria,
      nota: cat.nota,
      items: (cat.items ?? []).map((item) => normalizeItem(item, id)),
    },
  ];
}

export function loadCartaRaw(): CartaData {
  const byId = new Map<string, CartaCategoria>();

  for (const file of MENU_FILES) {
    for (const cat of file.categorias) {
      for (const flat of flattenCategoria(cat)) {
        const existing = byId.get(flat.id);
        if (existing) {
          existing.items.push(...flat.items);
          if (flat.nota && !existing.nota) existing.nota = flat.nota;
        } else {
          byId.set(flat.id, { ...flat, items: [...flat.items] });
        }
      }
    }
  }

  const categorias = mergePizzaCategories(
    [...byId.values()].map((cat) => ({
      ...cat,
      items: cat.items.sort((a, b) => a.orden - b.orden),
    })),
  ).sort((a, b) => {
      const ia = TAB_ORDER.indexOf(a.id);
      const ib = TAB_ORDER.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.categoria.localeCompare(b.categoria);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

  return {
    categorias,
    alergenos_referencia: ALERGENO_ORDEN,
  };
}

export function loadCarta(locale: Locale = "es"): CartaData {
  return applyCartaLocale(loadCartaRaw(), locale);
}
