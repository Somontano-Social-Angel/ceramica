import { defineCollection, z } from "astro:content";

const avisos = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    /** Muestra banner destacado en la home. */
    destacado: z.boolean().default(false),
    /** Fecha de publicación (para ordenar). */
    publicado: z.coerce.date(),
    /** Si se define, deja de mostrarse tras esta fecha. */
    hasta: z.coerce.date().optional(),
    tipo: z.enum(["aviso", "menu", "evento"]).default("aviso"),
  }),
});

export const collections = { avisos };
