/**
 * Descarga imágenes de referencia (Unsplash) y genera WebP locales.
 * Ejecutar: npm run images:optimize
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(root, "src", "assets", "images");
const publicDir = join(root, "public", "images");

/** @type {{ name: string; url: string; width: number; height: number }[]} */
const SOURCES = [
  {
    name: "hero-pizza",
    url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1400&h=1750&q=85",
    width: 1280,
    height: 1600,
  },
  {
    name: "section-carta",
    url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&h=1400&q=85",
    width: 880,
    height: 1040,
  },
  {
    name: "section-experiencia",
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&h=900&q=85",
    width: 880,
    height: 660,
  },
  {
    name: "dining-room",
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&h=900&q=85",
    width: 960,
    height: 720,
  },
  {
    name: "reto-burger",
    url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&h=900&q=85",
    width: 960,
    height: 720,
  },
  {
    name: "reto-grill",
    url: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&h=900&q=85",
    width: 960,
    height: 720,
  },
];

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function toWebp(buffer, width, height) {
  return sharp(buffer)
    .rotate()
    .resize(width, height, { fit: "cover", position: "centre" })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

await mkdir(assetsDir, { recursive: true });
await mkdir(publicDir, { recursive: true });

let heroBuffer = null;

for (const { name, url, width, height } of SOURCES) {
  const outPath = join(assetsDir, `${name}.webp`);
  try {
    const { access } = await import("node:fs/promises");
    await access(outPath);
    console.log(`↷ ${name}.webp (ya existe, omitido)`);
    if (name === "hero-pizza") heroBuffer = await fetchBuffer(url).catch(() => null);
    continue;
  } catch {
    /* generar */
  }
  console.log(`→ ${name}.webp (${width}×${height})`);
  const raw = await fetchBuffer(url);
  const webp = await toWebp(raw, width, height);
  await writeFile(join(assetsDir, `${name}.webp`), webp);
  if (name === "hero-pizza") heroBuffer = raw;
  console.log(`  ${(webp.length / 1024).toFixed(1)} KB`);
}

if (heroBuffer) {
  console.log("→ og.webp (1200×630) en public/images/");
  const og = await sharp(heroBuffer)
    .rotate()
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();
  await writeFile(join(publicDir, "og.webp"), og);
  console.log(`  ${(og.length / 1024).toFixed(1)} KB`);
}

console.log("\nListo. Imágenes en src/assets/images/ y public/images/og.webp");
