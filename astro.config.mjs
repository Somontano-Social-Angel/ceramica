// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/** Dominio de producción: SITE_URL en .env o en Coolify (build + runtime). */
const siteUrl = (process.env.SITE_URL || "https://laceramica-barbastro.example").replace(/\/$/, "");

export default defineConfig({
  site: siteUrl,
  i18n: {
    defaultLocale: "es",
    locales: ["es", "en", "fr"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/admin"),
    }),
  ],
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3000",
          changeOrigin: true,
        },
      },
    },
  },
});
