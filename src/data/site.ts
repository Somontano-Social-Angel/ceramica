import { SITE_FALLBACK } from "./site-url";

const buildSite =
  typeof import.meta.env.SITE === "string" && import.meta.env.SITE ? import.meta.env.SITE : SITE_FALLBACK;
const publicHost = new URL(buildSite).hostname.replace(/^www\./, "");
const contactEmail =
  (typeof import.meta.env.PUBLIC_CONTACT_EMAIL === "string" && import.meta.env.PUBLIC_CONTACT_EMAIL) ||
  `info@${publicHost}`;

/** Datos del local para SEO, JSON-LD y metadatos. */
export const RESTAURANT = {
  name: "La Cerámica",
  legalName: "Restaurante La Cerámica",
  description:
    "Bar-restaurante en el polígono La Cerámica, Barbastro: pizzas y hamburguesas al horno de leña, terraza amplia y el reto La Reto.",
  telephone: "+34974312220",
  telephoneDisplay: "974 31 22 20",
  email: contactEmail,
  streetAddress: "C. Cerámica Industrial VI, 13",
  addressLocality: "Barbastro",
  addressRegion: "Huesca",
  postalCode: "22300",
  addressCountry: "ES",
  latitude: 42.04223,
  longitude: 0.13848,
  priceRange: "€€",
  servesCuisine: ["Pizza", "Hamburguesas", "Brasa", "Cocina española"],
  openingHours: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "07:30", closes: "16:00" },
    { days: ["Friday", "Saturday"], opens: "20:00", closes: "23:30" },
  ],
  sameAs: [] as string[],
} as const;

import { OG_IMAGE_PATH } from "./images";

/** Imagen OG por defecto (WebP local 1200×630). Sustituye public/images/og.webp con foto propia. */
export const DEFAULT_OG_IMAGE = OG_IMAGE_PATH;

export function absoluteUrl(path: string, site: URL | string): string {
  const base = typeof site === "string" ? site : site.origin;
  return new URL(path.startsWith("/") ? path : `/${path}`, base).href;
}

export function restaurantJsonLd(site: URL | string) {
  const url = typeof site === "string" ? site : site.origin;
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${url}/#restaurant`,
    name: RESTAURANT.name,
    description: RESTAURANT.description,
    url,
    telephone: RESTAURANT.telephone,
    email: RESTAURANT.email,
    priceRange: RESTAURANT.priceRange,
    servesCuisine: [...RESTAURANT.servesCuisine],
    image: absoluteUrl(OG_IMAGE_PATH, url),
    address: {
      "@type": "PostalAddress",
      streetAddress: RESTAURANT.streetAddress,
      addressLocality: RESTAURANT.addressLocality,
      addressRegion: RESTAURANT.addressRegion,
      postalCode: RESTAURANT.postalCode,
      addressCountry: RESTAURANT.addressCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: RESTAURANT.latitude,
      longitude: RESTAURANT.longitude,
    },
    openingHoursSpecification: RESTAURANT.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    hasMenu: `${url}/carta`,
    acceptsReservations: true,
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/reservar`,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      result: {
        "@type": "FoodEstablishmentReservation",
        name: "Reserva en La Cerámica",
      },
    },
  };
}
