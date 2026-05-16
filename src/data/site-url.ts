/** URL pública por defecto hasta definir SITE_URL (build) o Astro.site. */
export const SITE_FALLBACK = "https://laceramica-barbastro.example";

export function resolveSiteUrl(astroSite?: URL | string | null): URL {
  if (astroSite) {
    return typeof astroSite === "string" ? new URL(astroSite) : astroSite;
  }
  return new URL(SITE_FALLBACK);
}

/** Hostname sin www (p. ej. para UIDs de calendario). */
export function siteHostname(site: URL): string {
  return site.hostname.replace(/^www\./, "");
}
