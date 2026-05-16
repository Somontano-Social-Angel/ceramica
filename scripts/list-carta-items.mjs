import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const jsonDir = join(root, "JSON");

const MENU_FILES = [
  "Raciones.json",
  "Ensalada.json",
  "Brasa_sandwich.json",
  "Hamburguesa.json",
  "Pizzas_1.json",
  "Pizzas_2.json",
  "Combinados.json",
];

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeItem(raw, categoriaId) {
  const key = raw.buscar_por || slugify(raw.nombre);
  return {
    id: `${categoriaId}--${key}`,
    nombre: raw.nombre,
    descripcion: raw.descripcion,
    precio: raw.precio,
    ingredientes: raw.ingredientes ?? [],
    alergenos_contiene: raw.alergenos_contiene ?? [],
    alergenos_posibles: raw.alergenos_posibles ?? [],
    dietas_no_apto: raw.dietas_no_apto ?? [],
    dietas_apto_si_modifica: raw.dietas_apto_si_modifica ?? [],
    buscar_por: raw.buscar_por ?? slugify(raw.nombre),
    tags: raw.tags ?? [],
    orden: raw.orden ?? 0,
    numero: raw.numero,
    observaciones: raw.observaciones,
  };
}

function flattenCategoria(cat) {
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

function loadCarta() {
  const byId = new Map();

  for (const name of MENU_FILES) {
    const raw = JSON.parse(readFileSync(join(jsonDir, name), "utf8"));
    for (const cat of raw.categorias) {
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

  return [...byId.values()];
}

const items = [];
for (const cat of loadCarta()) {
  for (const item of cat.items) {
    items.push({
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion,
      categoria: cat.categoria,
      subcategoria: cat.subcategoria,
    });
  }
}

console.log(JSON.stringify(items));
