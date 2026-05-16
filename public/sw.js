/**
 * Service Worker — La Cerámica
 * Tras una visita con internet, landing + carta (+ assets) siguen disponibles sin red.
 * Reservas y admin requieren API (no se cachean).
 */
const CACHE = "laceramica-v1";

/** Rutas que conviene tener ya en caché tras la primera instalación (producción). */
const PRECACHE = ["/", "/carta/", "/logo.svg", "/favicon.svg", "/images/og.webp"];

/** Prefijos que no deben servirse solo desde caché antigua sin red. */
function isApiRequest(url) {
  return url.pathname.startsWith("/api");
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAssetRequest(request, url) {
  if (request.destination === "document") return false;
  const p = url.pathname;
  return (
    p.startsWith("/_astro/") ||
    p.startsWith("/images/") ||
    p.endsWith(".webp") ||
    p.endsWith(".svg") ||
    p.endsWith(".css") ||
    p.endsWith(".js") ||
    p.endsWith(".woff2")
  );
}

function isNavigation(request) {
  return request.mode === "navigate" || request.destination === "document";
}

async function cachePut(cache, request, response) {
  if (response && response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch {
      /* respuesta opaca o demasiado grande */
    }
  }
}

/** Red primero; si falla, caché. Si hay red, actualiza caché en segundo plano. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    await cachePut(cache, request, response);
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

/** Caché primero; en paralelo intenta actualizar. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      await cachePut(cache, request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }

  const fresh = await networkPromise;
  if (fresh) return fresh;

  const fallback = await caches.match("/");
  if (fallback) return fallback;

  throw new Error("offline");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(PRECACHE.map((path) => cache.add(path)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (isApiRequest(url)) {
    return;
  }

  if (!isSameOrigin(url)) {
    if (url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  if (url.pathname.startsWith("/admin")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isNavigation(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isAssetRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
