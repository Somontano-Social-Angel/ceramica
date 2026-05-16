/**
 * Imágenes locales WebP (generadas con npm run images:optimize).
 * Sustituye los ficheros en src/assets/images/ cuando tengáis fotos propias.
 */
import type { ImageMetadata } from "astro";
import heroPizza from "../assets/images/hero-pizza.webp";
import sectionCarta from "../assets/images/section-carta.webp";
import sectionExperiencia from "../assets/images/section-experiencia.webp";
import diningRoom from "../assets/images/dining-room.webp";
import retoBurger from "../assets/images/reto-burger.webp";
import retoGrill from "../assets/images/reto-grill.webp";

export type SiteImage = {
  src: ImageMetadata;
  width: number;
  height: number;
};

export const siteImages = {
  heroPizza: { src: heroPizza, width: 960, height: 1200 },
  sectionCarta: { src: sectionCarta, width: 880, height: 1040 },
  sectionExperiencia: { src: sectionExperiencia, width: 880, height: 660 },
  diningRoom: { src: diningRoom, width: 800, height: 600 },
  retoBurger: { src: retoBurger, width: 800, height: 600 },
  retoGrill: { src: retoGrill, width: 800, height: 600 },
} as const satisfies Record<string, SiteImage>;

/** OG / redes (1200×630) — servida estática desde public/ */
export const OG_IMAGE_PATH = "/images/og.webp";
