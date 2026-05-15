import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __root = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__root, "..", ".env") });
import crypto from "node:crypto";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import {
  getSlotsForDate,
  getBookableSlotsForDate,
  isValidSlot,
  isPastSlot,
  isTooFarAhead,
  madridDateString,
  madridNowDisplay,
  addCalendarDays,
  mondayFirstColumnIndex,
} from "./schedule.js";
import {
  addReservation,
  listReservations,
  sumCoversForSlot,
  updateReservationStatus,
} from "./db.js";
import { sendReservationEmails } from "./mail.js";

const PORT = Number(process.env.PORT ?? 3000);
const SERVICE_OPTIONS = ["Terraza", "Interior", "Zona barra"];
const MAX_PARTY = 20;
const MAX_COVERS = Number(process.env.RESTAURANT_MAX_COVERS_PER_TIMESLOT ?? 40);
const MAX_AHEAD_DAYS = Number(process.env.MAX_BOOKING_DAYS_AHEAD ?? 120);
const MIN_LEAD_MINUTES = Number(process.env.BOOKING_MIN_LEAD_MINUTES ?? 30);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

app.use(
  session({
    name: "laceramica.sid",
    secret: process.env.SESSION_SECRET || "cambia-session-secret-en-produccion",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

/** @type {Map<string, number[]>} */
const rateBucket = new Map();
function rateLimit(ip, max = 12, windowMs = 60_000) {
  const now = Date.now();
  const arr = (rateBucket.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  rateBucket.set(ip, arr);
  return arr.length <= max;
}

function adminAuth(req, res, next) {
  if (req.session?.admin) return next();
  return res.status(401).json({ ok: false, error: "No autorizado" });
}

async function verifyAdminPassword(plain) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return bcrypt.compare(plain, hash);
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return false;
  const a = Buffer.from(plain, "utf8");
  const b = Buffer.from(pwd, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/meta", (_req, res) => {
  const today = madridDateString();
  res.json({
    ok: true,
    serviceOptions: SERVICE_OPTIONS,
    maxParty: MAX_PARTY,
    maxCoversPerSlot: MAX_COVERS,
    today,
    maxBookableDate: addCalendarDays(today, MAX_AHEAD_DAYS),
    maxBookingDaysAhead: MAX_AHEAD_DAYS,
    timezone: "Europe/Madrid",
    nowMadrid: madridNowDisplay(),
    minLeadMinutes: MIN_LEAD_MINUTES,
  });
});

app.get("/api/calendar-month", (req, res) => {
  const y = parseInt(String(req.query.year ?? ""), 10);
  const m = parseInt(String(req.query.month ?? ""), 10);
  if (!Number.isFinite(y) || m < 1 || m > 12) {
    return res.status(400).json({ ok: false, error: "Mes inválido" });
  }
  const dim = new Date(y, m, 0).getDate();
  const today = madridDateString();
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const leadingEmpty = mondayFirstColumnIndex(first);
  const days = [];
  for (let d = 1; d <= dim; d++) {
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const closed = getSlotsForDate(dateStr).length === 0;
    const past = dateStr < today;
    const tooFar = isTooFarAhead(dateStr, MAX_AHEAD_DAYS);
    days.push({ date: dateStr, closed, past, tooFar, disabled: past || closed || tooFar });
  }
  res.json({
    ok: true,
    year: y,
    month: m,
    daysInMonth: dim,
    leadingEmpty,
    days,
  });
});

app.get("/api/slots", async (req, res) => {
  const date = String(req.query.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Fecha inválida" });
  }
  const today = madridDateString();
  const calendarSlots = getSlotsForDate(date);
  const closed = calendarSlots.length === 0 || date < today;
  const bookable = closed ? [] : getBookableSlotsForDate(date, MIN_LEAD_MINUTES);
  const booked = {};
  for (const t of bookable) {
    booked[t] = await sumCoversForSlot(date, t);
  }
  res.json({
    ok: true,
    date,
    closed,
    noSlotsLeft: !closed && bookable.length === 0,
    timezone: "Europe/Madrid",
    nowMadrid: madridNowDisplay(),
    minLeadMinutes: MIN_LEAD_MINUTES,
    slots: bookable,
    bookedCovers: booked,
    maxCoversPerSlot: MAX_COVERS,
  });
});

app.post("/api/reservations", async (req, res) => {
  const ip = req.ip || "local";
  if (!rateLimit(ip)) {
    return res.status(429).json({ ok: false, error: "Demasiadas solicitudes. Prueba en un minuto." });
  }

  const body = req.body ?? {};
  const date = String(body.date ?? "");
  const time = String(body.time ?? "");
  const partySize = Number(body.partySize);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim().slice(0, 500);
  const services = Array.isArray(body.services) ? body.services.map(String) : [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Fecha inválida" });
  }
  if (!isValidSlot(date, time)) {
    return res.status(400).json({ ok: false, error: "Franja no disponible" });
  }
  if (isPastSlot(date, time, MIN_LEAD_MINUTES)) {
    return res.status(400).json({ ok: false, error: "La fecha u hora ya no está disponible" });
  }
  if (isTooFarAhead(date, MAX_AHEAD_DAYS)) {
    return res.status(400).json({ ok: false, error: `No se pueden reservar más de ${MAX_AHEAD_DAYS} días por adelantado` });
  }
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > MAX_PARTY) {
    return res.status(400).json({ ok: false, error: `Número de personas entre 1 y ${MAX_PARTY}` });
  }
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ ok: false, error: "Nombre no válido" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Email no válido" });
  }
  if (phone.length < 6 || phone.length > 30) {
    return res.status(400).json({ ok: false, error: "Teléfono no válido" });
  }
  for (const s of services) {
    if (!SERVICE_OPTIONS.includes(s)) {
      return res.status(400).json({ ok: false, error: "Opción de servicio no válida" });
    }
  }

  const current = await sumCoversForSlot(date, time);
  if (current + partySize > MAX_COVERS) {
    return res.status(409).json({
      ok: false,
      error: "Aforo completo en esa franja. Elige otra hora o llámanos.",
    });
  }

  try {
    const rec = await addReservation({
      date,
      time,
      partySize,
      name,
      email,
      phone,
      notes,
      services,
      status: "pending",
    });

    try {
      await sendReservationEmails(rec);
    } catch (e) {
      console.error("[mail]", e);
    }

    return res.status(201).json({ ok: true, id: rec.id, status: rec.status });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo guardar la reserva" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  const pwd = String(req.body?.password ?? "");
  if (!(await verifyAdminPassword(pwd))) {
    return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });
  }
  req.session.admin = true;
  return res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("laceramica.sid");
    res.json({ ok: true });
  });
});

app.get("/api/admin/session", (req, res) => {
  res.json({ ok: true, admin: Boolean(req.session?.admin) });
});

app.get("/api/admin/reservations", adminAuth, async (req, res) => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const list = await listReservations(from || undefined, to || undefined);
  res.json({ ok: true, reservations: list });
});

app.patch("/api/admin/reservations/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["pending", "confirmed", "cancelled"].includes(status)) {
    return res.status(400).json({ ok: false, error: "Estado no válido" });
  }
  const updated = await updateReservationStatus(id, status);
  if (!updated) return res.status(404).json({ ok: false, error: "No encontrada" });
  res.json({ ok: true, reservation: updated });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Error interno" });
});

app.listen(PORT, () => {
  console.log(`[api] http://127.0.0.1:${PORT}`);
  if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
    console.warn("[api] Define ADMIN_PASSWORD o ADMIN_PASSWORD_HASH en .env");
  }
});
