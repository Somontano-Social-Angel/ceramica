import dotenv from "dotenv";
import { existsSync } from "node:fs";
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
  findFirstBookableDate,
  madridDateString,
  madridNowDisplay,
  addCalendarDays,
  mondayFirstColumnIndex,
  isTooFarAhead,
} from "./schedule.js";
import {
  addReservation,
  addAviso,
  deleteAviso,
  listAvisos,
  listReservations,
  listReservationsForDay,
  sumCoversForSlot,
  updateReservationStatus,
} from "./db.js";
import { validateAvisoBody } from "./avisos.js";
import { logSmtpStatus, sendReservationEmails } from "./mail.js";
import { validateReservationBody } from "./reservations.js";

const PORT = Number(process.env.PORT ?? 3000);
const SERVICE_OPTIONS = ["Terraza", "Interior", "Zona barra"];
const MAX_PARTY = 20;
const MAX_COVERS = Number(process.env.RESTAURANT_MAX_COVERS_PER_TIMESLOT ?? 40);
const MAX_AHEAD_DAYS = Number(process.env.MAX_BOOKING_DAYS_AHEAD ?? 120);
const MIN_LEAD_MINUTES = Number(process.env.BOOKING_MIN_LEAD_MINUTES ?? 30);

const reservationCtx = () => ({
  serviceOptions: SERVICE_OPTIONS,
  maxParty: MAX_PARTY,
  maxAheadDays: MAX_AHEAD_DAYS,
  minLeadMinutes: MIN_LEAD_MINUTES,
});

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

/** HTTPS detrás de Coolify/Traefik: "auto" usa X-Forwarded-Proto. Forzar con COOKIE_SECURE=true|false */
function sessionCookieSecure() {
  const mode = String(process.env.COOKIE_SECURE ?? "").trim().toLowerCase();
  if (mode === "true") return true;
  if (mode === "false") return false;
  return "auto";
}

app.use(
  session({
    name: "laceramica.sid",
    secret: process.env.SESSION_SECRET || "cambia-session-secret-en-produccion",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: sessionCookieSecure(),
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

function envSecret(key) {
  const raw = process.env[key];
  if (raw == null || raw === "") return "";
  let v = String(raw).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

function looksLikeBcrypt(hash) {
  return /^\$2[aby]?\$\d{2}\$/.test(hash);
}

async function verifyAdminPassword(plain) {
  const hash = envSecret("ADMIN_PASSWORD_HASH");
  if (hash && looksLikeBcrypt(hash)) {
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      console.error("[api] ADMIN_PASSWORD_HASH no es un hash bcrypt válido");
      return false;
    }
  }
  if (hash && !looksLikeBcrypt(hash)) {
    console.warn(
      "[api] ADMIN_PASSWORD_HASH ignorado (no parece bcrypt). Usa ADMIN_PASSWORD o genera hash con npm run admin:hash",
    );
  }
  const pwd = envSecret("ADMIN_PASSWORD");
  if (!pwd) return false;
  const a = Buffer.from(plain, "utf8");
  const b = Buffer.from(pwd, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/avisos", async (_req, res) => {
  const avisos = await listAvisos({ activeOnly: true });
  res.json({ ok: true, avisos });
});

app.get("/api/meta", (_req, res) => {
  const today = madridDateString();
  const suggestedDate = findFirstBookableDate(today, 21, MIN_LEAD_MINUTES);
  res.json({
    ok: true,
    serviceOptions: SERVICE_OPTIONS,
    maxParty: MAX_PARTY,
    maxCoversPerSlot: MAX_COVERS,
    today,
    suggestedDate,
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
  try {
    for (const t of bookable) {
      booked[t] = await sumCoversForSlot(date, t);
    }
  } catch (e) {
    console.error("[api/slots] db", e);
    return res.status(500).json({ ok: false, error: "No se pudieron cargar las franjas" });
  }
  const suggestedDate =
    !closed && bookable.length === 0 ? findFirstBookableDate(date, 21, MIN_LEAD_MINUTES) : null;
  res.json({
    ok: true,
    date,
    closed,
    noSlotsLeft: !closed && bookable.length === 0,
    suggestedDate,
    timezone: "Europe/Madrid",
    nowMadrid: madridNowDisplay(),
    minLeadMinutes: MIN_LEAD_MINUTES,
    slots: bookable,
    bookedCovers: booked,
    maxCoversPerSlot: MAX_COVERS,
  });
});

async function createReservation(data, res) {
  const current = await sumCoversForSlot(data.date, data.time);
  if (current + data.partySize > MAX_COVERS) {
    return res.status(409).json({
      ok: false,
      error: "Aforo completo en esa franja. Elige otra hora.",
    });
  }

  try {
    const rec = await addReservation(data);

    if (data.sendEmail && data.email) {
      try {
        await sendReservationEmails(rec);
      } catch (e) {
        console.error("[mail] No se pudo enviar el correo:", e instanceof Error ? e.message : e);
      }
    }

    return res.status(201).json({ ok: true, id: rec.id, status: rec.status, reservation: rec });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo guardar la reserva" });
  }
}

app.post("/api/reservations", async (req, res) => {
  const ip = req.ip || "local";
  if (!rateLimit(ip)) {
    return res.status(429).json({ ok: false, error: "Demasiadas solicitudes. Prueba en un minuto." });
  }

  const validated = validateReservationBody(req.body ?? {}, reservationCtx());
  if (!validated.ok) {
    return res.status(validated.status).json({ ok: false, error: validated.error });
  }

  return createReservation(validated.data, res);
});

app.post("/api/admin/login", async (req, res) => {
  if (!envSecret("ADMIN_PASSWORD") && !envSecret("ADMIN_PASSWORD_HASH")) {
    return res.status(503).json({
      ok: false,
      error: "Admin no configurado: define ADMIN_PASSWORD en .env y reinicia la API",
    });
  }
  const pwd = String(req.body?.password ?? "");
  if (!(await verifyAdminPassword(pwd))) {
    return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });
  }
  req.session.admin = true;
  req.session.save((err) => {
    if (err) {
      console.error("[api/admin/login] session save", err);
      return res.status(500).json({ ok: false, error: "No se pudo guardar la sesión" });
    }
    return res.json({ ok: true });
  });
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

app.get("/api/admin/dashboard", adminAuth, async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date ?? ""))
    ? String(req.query.date)
    : madridDateString();
  const today = madridDateString();
  const list = await listReservationsForDay(date);
  const active = list.filter((r) => r.status !== "cancelled");
  const covers = active.reduce((s, r) => s + r.partySize, 0);
  const byTime = {};
  for (const r of active) {
    if (!byTime[r.time]) byTime[r.time] = [];
    byTime[r.time].push(r);
  }
  const timeline = Object.keys(byTime)
    .sort()
    .map((time) => ({
      time,
      covers: byTime[time].reduce((s, r) => s + r.partySize, 0),
      reservations: byTime[time],
    }));

  const weekEnd = addCalendarDays(date, 6);
  const weekList = (await listReservations(date, weekEnd)).filter((r) => r.status !== "cancelled");
  const weekByDate = {};
  for (const r of weekList) {
    weekByDate[r.date] = (weekByDate[r.date] ?? 0) + 1;
  }

  res.json({
    ok: true,
    date,
    today,
    isToday: date === today,
    nowMadrid: madridNowDisplay(),
    stats: {
      total: list.length,
      active: active.length,
      covers,
      pending: list.filter((r) => r.status === "pending").length,
      confirmed: list.filter((r) => r.status === "confirmed").length,
      cancelled: list.filter((r) => r.status === "cancelled").length,
      phone: list.filter((r) => r.source === "phone").length,
      web: list.filter((r) => r.source !== "phone").length,
    },
    timeline,
    reservations: list,
    weekSummary: Object.entries(weekByDate)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([d, count]) => ({ date: d, count })),
  });
});

app.post("/api/admin/reservations", adminAuth, async (req, res) => {
  const validated = validateReservationBody(req.body ?? {}, {
    ...reservationCtx(),
    admin: true,
  });
  if (!validated.ok) {
    return res.status(validated.status).json({ ok: false, error: validated.error });
  }
  return createReservation(validated.data, res);
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

app.get("/api/admin/avisos", adminAuth, async (_req, res) => {
  const avisos = await listAvisos();
  res.json({ ok: true, avisos });
});

app.post("/api/admin/avisos", adminAuth, async (req, res) => {
  const validated = validateAvisoBody(req.body ?? {});
  if (!validated.ok) {
    return res.status(validated.status).json({ ok: false, error: validated.error });
  }
  const aviso = await addAviso(validated.data);
  res.status(201).json({ ok: true, aviso });
});

app.delete("/api/admin/avisos/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ ok: false, error: "ID no válido" });
  const removed = await deleteAviso(id);
  if (!removed) return res.status(404).json({ ok: false, error: "No encontrado" });
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Error interno" });
});

const distPath = join(__root, "..", "dist");
const hasDist = existsSync(distPath);
if (hasDist) {
  app.use(
    express.static(distPath, {
      index: "index.html",
      extensions: ["html"],
      redirect: true,
      maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    }),
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const base = req.path.replace(/\/$/, "") || "/";
    const file = join(distPath, base === "/" ? "index.html" : `${base}/index.html`);
    if (existsSync(file)) return res.sendFile(file);
    res.status(404).type("text/plain").send("Not found");
  });
}

app.listen(PORT, () => {
  const mode = hasDist ? "web+api" : "api";
  console.log(`[server] http://0.0.0.0:${PORT} (${mode})`);
  if (process.env.SITE_URL) console.log(`[server] SITE_URL=${process.env.SITE_URL}`);
  if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
    console.warn("[api] Define ADMIN_PASSWORD o ADMIN_PASSWORD_HASH en .env");
  }
  logSmtpStatus();
});
