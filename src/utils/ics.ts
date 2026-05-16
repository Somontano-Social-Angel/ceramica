export interface ReservationIcsInput {
  id: string;
  date: string;
  time: string;
  partySize: number;
  name: string;
  notes?: string;
  services?: string[];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** DTSTART/DTEND en hora local Europe/Madrid (sin sufijo Z). */
function localStamp(date: string, time: string, addMinutes = 0) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm + addMinutes, 0);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

function escapeIcs(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildReservationIcs(input: ReservationIcsInput, siteName = "La Cerámica") {
  const uid = `reserva-${input.id}@laceramica`;
  const dtStart = localStamp(input.date, input.time);
  const dtEnd = localStamp(input.date, input.time, 120);
  const summary = `Reserva · ${siteName}`;
  const descParts = [
    `Ref. ${input.id}`,
    `${input.partySize} persona${input.partySize === 1 ? "" : "s"}`,
    input.services?.length ? `Zona: ${input.services.join(", ")}` : "",
    input.notes ? `Notas: ${input.notes}` : "",
  ].filter(Boolean);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Cerámica//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Madrid",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${localStamp(input.date, input.time)}`,
    `DTSTART;TZID=Europe/Madrid:${dtStart}`,
    `DTEND;TZID=Europe/Madrid:${dtEnd}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(descParts.join("\\n"))}`,
    "LOCATION:C. Cerámica Industrial VI\\, 13\\, 22300 Barbastro",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

export function downloadIcs(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
