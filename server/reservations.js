import {
  isValidSlot,
  isPastSlot,
  isTooFarAhead,
} from "./schedule.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida cuerpo de reserva (web o admin).
 * @param {Record<string, unknown>} body
 * @param {{
 *   admin?: boolean;
 *   serviceOptions: string[];
 *   maxParty: number;
 *   maxAheadDays: number;
 *   minLeadMinutes: number;
 * }} ctx
 */
export function validateReservationBody(body, ctx) {
  const admin = Boolean(ctx.admin);
  const date = String(body.date ?? "").trim();
  const time = String(body.time ?? "").trim();
  const partySize = Number(body.partySize);
  const name = String(body.name ?? "").trim();
  const emailRaw = String(body.email ?? "").trim().toLowerCase();
  const email = emailRaw || "";
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim().slice(0, 500);
  const services = Array.isArray(body.services) ? body.services.map(String) : [];
  const minLead = admin ? 0 : ctx.minLeadMinutes;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, status: 400, error: "Fecha inválida" };
  }
  if (!isValidSlot(date, time)) {
    return { ok: false, status: 400, error: "Franja no disponible" };
  }
  if (isPastSlot(date, time, minLead)) {
    return {
      ok: false,
      status: 400,
      error: admin
        ? "Esa hora ya pasó. Elige otra franja."
        : "La fecha u hora ya no está disponible",
    };
  }
  if (isTooFarAhead(date, ctx.maxAheadDays)) {
    return {
      ok: false,
      status: 400,
      error: `No se pueden reservar más de ${ctx.maxAheadDays} días por adelantado`,
    };
  }
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > ctx.maxParty) {
    return {
      ok: false,
      status: 400,
      error: `Número de personas entre 1 y ${ctx.maxParty}`,
    };
  }
  if (name.length < 2 || name.length > 80) {
    return { ok: false, status: 400, error: "Nombre no válido" };
  }
  if (!admin) {
    if (!EMAIL_RE.test(email)) {
      return { ok: false, status: 400, error: "Email no válido" };
    }
  } else if (email && !EMAIL_RE.test(email)) {
    return { ok: false, status: 400, error: "Email no válido" };
  }
  if (phone.length < 6 || phone.length > 30) {
    return { ok: false, status: 400, error: "Teléfono no válido" };
  }
  for (const s of services) {
    if (!ctx.serviceOptions.includes(s)) {
      return { ok: false, status: 400, error: "Opción de servicio no válida" };
    }
  }

  let status = String(body.status ?? "").trim();
  if (admin) {
    if (!status) status = "confirmed";
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return { ok: false, status: 400, error: "Estado no válido" };
    }
  } else {
    status = "pending";
  }

  const source = admin ? String(body.source ?? "phone").trim() || "phone" : "web";
  if (!["web", "phone"].includes(source)) {
    return { ok: false, status: 400, error: "Origen no válido" };
  }

  return {
    ok: true,
    data: {
      date,
      time,
      partySize,
      name,
      email,
      phone,
      notes,
      services,
      status,
      source,
      sendEmail: admin ? Boolean(body.sendEmail) : true,
    },
  };
}
