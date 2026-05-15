import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

/** @param {Record<string, unknown> & { name: string; email: string; date: string; time: string; partySize: number; phone: string; notes?: string; services?: string[]; id: string; status: string }} r */
export async function sendReservationEmails(r) {
  const transport = getTransport();
  const from = process.env.MAIL_FROM ?? '"La Cerámica" <noreply@localhost>';
  const bcc = process.env.MAIL_BCC ?? "";

  const services = (r.services ?? []).length ? r.services.join(", ") : "Sin preferencia";
  const text = [
    `Hola ${r.name},`,
    ``,
    `Hemos registrado tu reserva en La Cerámica (Barbastro).`,
    ``,
    `Fecha: ${r.date}`,
    `Hora: ${r.time}`,
    `Personas: ${r.partySize}`,
    `Teléfono: ${r.phone}`,
    `Servicios / zona: ${services}`,
    r.notes ? `Notas: ${r.notes}` : null,
    ``,
    `Referencia: ${r.id}`,
    `Estado: ${r.status}`,
    ``,
    `Si necesitas cambiar o cancelar, responde a este correo o llama al 974 31 22 20.`,
    ``,
    `La Cerámica — Polígono industrial La Cerámica, C. Cerámica Industrial VI, 13, 22300 Barbastro`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
  <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1b1b1b">
    <h1 style="font-size:1.25rem">Reserva recibida</h1>
    <p>Hola <strong>${escapeHtml(r.name)}</strong>,</p>
    <p>Hemos registrado tu reserva en <strong>La Cerámica</strong> (Barbastro).</p>
    <table style="border-collapse:collapse;margin:1rem 0">
      <tr><td style="padding:4px 12px 4px 0;color:#555">Fecha</td><td><strong>${escapeHtml(r.date)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Hora</td><td><strong>${escapeHtml(r.time)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Personas</td><td><strong>${r.partySize}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Teléfono</td><td>${escapeHtml(r.phone)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Servicios</td><td>${escapeHtml(services)}</td></tr>
      ${r.notes ? `<tr><td style="padding:4px 12px 4px 0;color:#555">Notas</td><td>${escapeHtml(r.notes)}</td></tr>` : ""}
    </table>
    <p style="font-size:0.9rem;color:#555">Referencia: <code>${escapeHtml(r.id)}</code> · Estado: ${escapeHtml(r.status)}</p>
    <p>Si necesitas cambiar o cancelar, responde a este correo o llama al <a href="tel:+34974312220">974 31 22 20</a>.</p>
    <p style="font-size:0.85rem;color:#777">La Cerámica — Polígono industrial La Cerámica, C. Cerámica Industrial VI, 13, 22300 Barbastro</p>
  </div>`;

  if (!transport) {
    console.info("[mail] SMTP no configurado. Contenido del correo:\n", text);
    return { sent: false, logged: true };
  }

  await transport.sendMail({
    from,
    to: r.email,
    bcc: bcc || undefined,
    subject: `Reserva La Cerámica — ${r.date} ${r.time}`,
    text,
    html,
  });

  return { sent: true };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
