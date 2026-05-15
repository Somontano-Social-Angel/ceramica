/**
 * Horarios La Cerámica (Europe/Madrid).
 * Lun–jue: 7:30–16:00 | Vie–sáb: + 20:00–23:30 | Dom: cerrado
 */

const SLOT_MINUTES = 30;

/** @typedef {{ start: string, end: string }} Window */

/** @type {Record<number, Window[] | null>} getDay(): 0=dom … 6=sáb */
const WINDOWS_BY_WEEKDAY = {
  0: null,
  1: [{ start: "07:30", end: "16:00" }],
  2: [{ start: "07:30", end: "16:00" }],
  3: [{ start: "07:30", end: "16:00" }],
  4: [{ start: "07:30", end: "16:00" }],
  5: [
    { start: "07:30", end: "16:00" },
    { start: "20:00", end: "23:30" },
  ],
  6: [
    { start: "07:30", end: "16:00" },
    { start: "20:00", end: "23:30" },
  ],
};

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * @param {string} dateStr YYYY-MM-DD (día civil en España)
 * @returns {{ closed: boolean, windows: Window[], weekday: number }}
 */
export function getDaySchedule(dateStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const utcNoon = Date.UTC(y, mo - 1, d, 12, 0, 0);
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  }).format(new Date(utcNoon));
  /** @type {Record<string, 0|1|2|3|4|5|6>} */
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = map[short] ?? 0;
  const windows = WINDOWS_BY_WEEKDAY[/** @type {0|1|2|3|4|5|6} */ (weekday)];
  if (windows == null) return { closed: true, windows: [], weekday };
  return { closed: false, windows, weekday };
}

function slotsForWindow(startStr, endStr) {
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);
  const out = [];
  for (let t = start; t < end; t += SLOT_MINUTES) {
    out.push(minutesToTime(t));
  }
  return out;
}

/**
 * @param {string} dateStr
 * @returns {string[]}
 */
export function getSlotsForDate(dateStr) {
  const { closed, windows } = getDaySchedule(dateStr);
  if (closed) return [];
  /** @type {string[]} */
  const slots = [];
  for (const w of windows) {
    slots.push(...slotsForWindow(w.start, w.end));
  }
  return slots;
}

/**
 * @param {string} dateStr
 * @param {string} timeStr HH:mm
 */
export function isValidSlot(dateStr, timeStr) {
  const slots = getSlotsForDate(dateStr);
  return slots.includes(timeStr);
}

/** Fecha local Madrid YYYY-MM-DD */
export function madridDateString(d = new Date()) {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

function madridNowMinutesFromMidnight() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/**
 * Franjas reservables hoy (Madrid): a partir de ahora + margen mínimo.
 * Otros días abiertos: todas las del calendario.
 */
export function getBookableSlotsForDate(dateStr, minLeadMinutes = 30) {
  const all = getSlotsForDate(dateStr);
  const today = madridDateString();
  if (dateStr < today) return [];
  if (dateStr > today) return all;
  const threshold = madridNowMinutesFromMidnight() + minLeadMinutes;
  return all.filter((t) => timeToMinutes(t) >= threshold);
}

/**
 * Reserva en el pasado o demasiado pronto (Madrid).
 * Mismo día: la hora del slot debe ser >= ahora + minLeadMinutes.
 */
export function isPastSlot(dateStr, timeStr, minLeadMinutes = 30) {
  const today = madridDateString();
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  const slotMins = timeToMinutes(timeStr);
  const needFrom = madridNowMinutesFromMidnight() + minLeadMinutes;
  return slotMins < needFrom;
}

/** Texto legible de fecha y hora actual en España */
export function madridNowDisplay() {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(new Date());
}

/** Antelación máxima en días civiles (desde hoy Madrid) */
export function isTooFarAhead(dateStr, maxDays = 120) {
  const today = madridDateString();
  const [y0, m0, d0] = today.split("-").map(Number);
  const [y1, m1, d1] = dateStr.split("-").map(Number);
  const diffDays = Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y0, m0 - 1, d0)) / 86400000);
  return diffDays > maxDays;
}

/** Suma días civiles a YYYY-MM-DD (UTC; suficiente para reservas por fecha). */
export function addCalendarDays(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Columna del lunes = 0 … domingo = 6 (rejilla semanal) */
export function mondayFirstColumnIndex(dateStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const utcNoon = Date.UTC(y, mo - 1, d, 12, 0, 0);
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  }).format(new Date(utcNoon));
  /** @type {Record<string, number>} */
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = map[short] ?? 0;
  return (wd + 6) % 7;
}
