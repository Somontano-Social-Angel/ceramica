import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSONFilePreset } from "lowdb/node";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AVISOS_SEED = [
  {
    id: "seed-menu-ejecutivo",
    title: "Menú ejecutivo de lunes a viernes",
    body: "**13,50 €** · Primer plato, segundo, postre, pan y bebida (agua, vino de mesa o refresco).\nConsulta el plato del día en sala o por teléfono al 974 31 22 20.",
    tipo: "menu",
    publicado: "2026-05-01",
    destacado: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "seed-terraza",
    title: "Terraza abierta",
    body: "La terraza del polígono está operativa. Reserva terraza (mascotas) en el formulario de reservas si quieres mesa exterior.",
    tipo: "evento",
    publicado: "2026-04-15",
    hasta: "2026-10-31",
    destacado: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const defaultData = {
  reservations: [],
  avisos: [...AVISOS_SEED],
};

let dbPromise;

export function getDb() {
  if (!dbPromise) {
    const dir = join(__dirname, "data");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "db.json");
    dbPromise = JSONFilePreset(file, defaultData);
  }
  return dbPromise;
}

export async function addReservation(row) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const rec = {
    id,
    createdAt,
    status: row.status ?? "pending",
    source: row.source ?? "web",
    date: row.date,
    time: row.time,
    partySize: row.partySize,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone,
    notes: row.notes ?? "",
    services: row.services ?? [],
  };
  db.data.reservations.push(rec);
  await db.write();
  return rec;
}

export async function listReservations(fromDate, toDate) {
  const db = await getDb();
  let list = [...db.data.reservations];
  if (fromDate) list = list.filter((r) => r.date >= fromDate);
  if (toDate) list = list.filter((r) => r.date <= toDate);
  list.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.time !== b.time) return a.time < b.time ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
  return list;
}

export async function getReservation(id) {
  const db = await getDb();
  return db.data.reservations.find((r) => r.id === id) ?? null;
}

export async function updateReservationStatus(id, status) {
  const db = await getDb();
  const r = db.data.reservations.find((x) => x.id === id);
  if (!r) return null;
  r.status = status;
  await db.write();
  return r;
}

/** Suma comensales activos (no cancelados) en fecha+hora */
export async function sumCoversForSlot(date, time) {
  const db = await getDb();
  return db.data.reservations
    .filter((r) => r.date === date && r.time === time && r.status !== "cancelled")
    .reduce((s, r) => s + r.partySize, 0);
}

/** Reservas de un día, ordenadas por hora (asc). */
export async function listReservationsForDay(dateStr) {
  const list = await listReservations(dateStr, dateStr);
  return list.sort((a, b) => {
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

function sortAvisos(list) {
  return [...list].sort((a, b) => {
    if (a.publicado !== b.publicado) return a.publicado < b.publicado ? 1 : -1;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}

export async function listAvisos({ activeOnly = false } = {}) {
  const db = await getDb();
  if (!db.data.avisos) {
    db.data.avisos = [...AVISOS_SEED];
    await db.write();
  }
  let list = [...db.data.avisos];
  if (activeOnly) {
    const now = new Date();
    list = list.filter((a) => {
      if (a.hasta) {
        const end = new Date(`${a.hasta}T23:59:59`);
        if (end < now) return false;
      }
      return true;
    });
  }
  return sortAvisos(list);
}

export async function addAviso(row) {
  const db = await getDb();
  if (!db.data.avisos) db.data.avisos = [];
  const rec = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: row.title,
    body: row.body,
    tipo: row.tipo,
    publicado: row.publicado,
    hasta: row.hasta,
    destacado: Boolean(row.destacado),
  };
  db.data.avisos.push(rec);
  await db.write();
  return rec;
}

export async function deleteAviso(id) {
  const db = await getDb();
  if (!db.data.avisos) db.data.avisos = [];
  const idx = db.data.avisos.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  db.data.avisos.splice(idx, 1);
  await db.write();
  return true;
}
