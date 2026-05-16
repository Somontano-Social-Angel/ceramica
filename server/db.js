import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSONFilePreset } from "lowdb/node";

const __dirname = dirname(fileURLToPath(import.meta.url));

const defaultData = {
  reservations: [],
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
