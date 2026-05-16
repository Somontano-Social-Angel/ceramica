const TIPOS = ["aviso", "menu", "evento"];

/**
 * @param {unknown} body
 * @returns {{ ok: true, data: object } | { ok: false, status: number, error: string }}
 */
export function validateAvisoBody(body) {
  const b = body && typeof body === "object" ? body : {};
  const title = String(b.title ?? "").trim();
  if (title.length < 2 || title.length > 160) {
    return { ok: false, status: 400, error: "Título obligatorio (2–160 caracteres)" };
  }

  const text = String(b.body ?? "").trim();
  if (text.length < 4 || text.length > 4000) {
    return { ok: false, status: 400, error: "Texto obligatorio (4–4000 caracteres)" };
  }

  const tipo = String(b.tipo ?? "aviso");
  if (!TIPOS.includes(tipo)) {
    return { ok: false, status: 400, error: "Tipo no válido" };
  }

  const publicado = String(b.publicado ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publicado)) {
    return { ok: false, status: 400, error: "Fecha de publicación no válida (AAAA-MM-DD)" };
  }

  let hasta;
  const hastaRaw = String(b.hasta ?? "").trim();
  if (hastaRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hastaRaw)) {
      return { ok: false, status: 400, error: "Fecha «hasta» no válida" };
    }
    if (hastaRaw < publicado) {
      return { ok: false, status: 400, error: "«Hasta» no puede ser anterior a la publicación" };
    }
    hasta = hastaRaw;
  }

  const destacado = Boolean(b.destacado);

  return {
    ok: true,
    data: { title, body: text, tipo, publicado, hasta, destacado },
  };
}

export function isAvisoActive(aviso, now = new Date()) {
  if (aviso.hasta) {
    const end = new Date(`${aviso.hasta}T23:59:59`);
    if (end < now) return false;
  }
  return true;
}
