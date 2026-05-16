import { initBookingCalendar } from "../lib/booking-calendar.js";

const calI18nJson = window.__ADM_CAL_I18N__;

const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const STATUS = {
    pending: { label: "Pendiente", cls: "st-pending" },
    confirmed: { label: "Confirmada", cls: "st-confirmed" },
    cancelled: { label: "Cancelada", cls: "st-cancelled" },
  };

  let meta = null;
  let overviewDate = "";
  /** @type {Map<string, Awaited<ReturnType<typeof initBookingCalendar>>>} */
  const calendars = new Map();

  function setAuthUi(ok) {
    document.documentElement.classList.toggle("adm-auth", ok);
    document.documentElement.classList.toggle("adm-guest", !ok);
    const login = $("#login-panel");
    const dash = $("#dash-panel");
    if (dash) {
      dash.toggleAttribute("inert", !ok);
      dash.setAttribute("aria-hidden", ok ? "false" : "true");
    }
    if (login) {
      login.toggleAttribute("inert", ok);
      login.setAttribute("aria-hidden", ok ? "true" : "false");
    }
  }

  async function setupCalendars() {
    if (calendars.size) return;
    const i18n = JSON.parse(calI18nJson);
    const bind = async (id, opts) => {
      const root = document.querySelector(`[data-calendar-id="${id}"]`);
      if (!root) return;
      calendars.set(
        id,
        await initBookingCalendar(/** @type {HTMLElement} */ (root), { i18n, ...opts }),
      );
    };
    await bind("ov", {
      allowPast: true,
      onChange: (d) => {
        overviewDate = d;
        loadOverview();
      },
    });
    await bind("list-from", { allowPast: true, onChange: () => loadList() });
    await bind("list-to", { allowPast: true, onChange: () => loadList() });
    await bind("new", {
      allowPast: false,
      onChange: () => loadNewSlots(),
    });
  }

  function madridToday() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function addDays(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  }

  function formatDay(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dt);
  }

  async function api(path, opts = {}) {
    let r;
    try {
      r = await fetch(path, { credentials: "include", ...opts });
    } catch {
      return { r: null, j: { error: "Sin conexión con la API" } };
    }
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return {
        r: null,
        j: {
          error:
            "La API devolvió HTML en lugar de JSON. Comprueba que el dominio apunta al contenedor Node (puerto 3000), no solo a archivos estáticos.",
        },
      };
    }
    const j = await r.json().catch(() => ({}));
    return { r, j };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sourceBadge(row) {
    const phone = row.source === "phone";
    return `<span class="adm-badge adm-badge--${phone ? "phone" : "web"}">${phone ? "Teléfono" : "Web"}</span>`;
  }

  function statusBadge(status) {
    const s = STATUS[status] ?? { label: status, cls: "" };
    return `<span class="adm-badge adm-badge--status ${s.cls}">${s.label}</span>`;
  }

  function statusSelect(row) {
    const opts = ["pending", "confirmed", "cancelled"]
      .map((v) => {
        const s = STATUS[v];
        return `<option value="${v}" ${row.status === v ? "selected" : ""}>${s.label}</option>`;
      })
      .join("");
    return `<select class="adm-sel" data-id="${row.id}" aria-label="Estado de reserva">${opts}</select>`;
  }

  function renderCard(row, opts = {}) {
    const { compact = false } = opts;
    const svc = (row.services ?? []).join(", ") || "Sin preferencia";
    const email = row.email
      ? `<a href="mailto:${encodeURIComponent(row.email)}">${escapeHtml(row.email)}</a>`
      : '<span class="adm-muted">—</span>';
    const notes = row.notes
      ? `<p class="adm-card__notes">${escapeHtml(row.notes)}</p>`
      : "";
    return `
      <article class="adm-card-item" data-id="${row.id}">
        <header class="adm-card-item__head">
          <time class="adm-card-item__time" datetime="${row.date}T${row.time}">${row.time}</time>
          <span class="adm-card-item__pax">${row.partySize} pax</span>
          ${sourceBadge(row)}
          ${statusBadge(row.status)}
        </header>
        <h3 class="adm-card-item__name">${escapeHtml(row.name)}</h3>
        <ul class="adm-card-item__meta">
          <li><span>Fecha</span> ${row.date}</li>
          ${compact ? "" : `<li><span>Tel</span> <a href="tel:${encodeURIComponent(row.phone)}">${escapeHtml(row.phone)}</a></li>`}
          ${compact ? "" : `<li><span>Email</span> ${email}</li>`}
          <li><span>Zona</span> ${escapeHtml(svc)}</li>
        </ul>
        ${notes}
        <footer class="adm-card-item__foot">
          <label class="adm-lbl adm-lbl--inline">Estado ${statusSelect(row)}</label>
          <span class="adm-ref">#${row.id.slice(0, 8)}</span>
        </footer>
      </article>`;
  }

  function bindStatusSelects(root) {
    root.querySelectorAll("select[data-id]").forEach((sel) => {
      sel.addEventListener("change", async () => {
        const id = /** @type {HTMLSelectElement} */ (sel).dataset.id;
        const status = /** @type {HTMLSelectElement} */ (sel).value;
        const { r } = await api(`/api/admin/reservations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!r?.ok) {
          alert("No se pudo actualizar");
          return;
        }
        await loadOverview();
        await loadList();
      });
    });
  }

  const TIPO_AVISO = { evento: "Evento", menu: "Menú del día", aviso: "Aviso" };

  function renderAvisoCard(a) {
    const hasta = a.hasta ? ` · hasta ${a.hasta}` : "";
    const preview =
      a.body.length > 220 ? `${a.body.slice(0, 220).trim()}…` : a.body;
    return `
      <article class="adm-card-item" data-aviso-id="${a.id}">
        <header class="adm-card-item__head">
          <span class="adm-badge">${TIPO_AVISO[a.tipo] ?? a.tipo}</span>
          <span class="adm-muted">${a.publicado}${hasta}</span>
          ${a.destacado ? '<span class="adm-badge adm-badge--phone">Destacado</span>' : ""}
        </header>
        <h3 class="adm-card-item__name">${escapeHtml(a.title)}</h3>
        <p class="adm-card-item__notes">${escapeHtml(preview)}</p>
        <footer class="adm-card-item__foot">
          <button type="button" class="adm-btn adm-btn--ghost adm-btn--compact" data-delete-aviso="${a.id}">Eliminar</button>
        </footer>
      </article>`;
  }

  async function loadAvisos() {
    const list = $("#avisos-list");
    const empty = /** @type {HTMLParagraphElement} */ ($("#avisos-empty"));
    if (!list || !empty) return;
    const { r, j } = await api("/api/admin/avisos");
    if (!r?.ok) {
      list.innerHTML = "";
      empty.textContent = j.error || "No se pudo cargar";
      empty.hidden = false;
      return;
    }
    const avisos = j.avisos ?? [];
    empty.hidden = avisos.length > 0;
    list.innerHTML = avisos.map(renderAvisoCard).join("");
    list.querySelectorAll("[data-delete-aviso]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = /** @type {HTMLButtonElement} */ (btn).dataset.deleteAviso;
        if (!id || !confirm("¿Eliminar esta novedad de la web?")) return;
        const { r: dr } = await api(`/api/admin/avisos/${id}`, { method: "DELETE" });
        if (!dr?.ok) {
          alert("No se pudo eliminar");
          return;
        }
        await loadAvisos();
      });
    });
  }

  function setNav(panel) {
    $$(".adm-nav__btn").forEach((b) => b.classList.toggle("is-active", b.dataset.nav === panel));
    $$(".adm-panel").forEach((p) => {
      const on = p.dataset.panel === panel;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });
    if (panel === "overview") loadOverview();
    if (panel === "list") loadList();
    if (panel === "new") loadNewSlots();
    if (panel === "novedades") {
      const pub = /** @type {HTMLInputElement | null} */ ($('#aviso-form [name="publicado"]'));
      if (pub && !pub.value) pub.value = madridToday();
      loadAvisos();
    }
  }

  async function checkApi() {
    const warn = /** @type {HTMLParagraphElement} */ ($("#api-warn"));
    const { r } = await api("/api/health");
    const ok = r?.ok;
    warn.hidden = Boolean(ok);
    return ok;
  }

  async function ensureMeta() {
    if (meta) return meta;
    const { r, j } = await api("/api/meta");
    if (r?.ok) meta = j;
    return meta;
  }

  function renderStats(stats, isToday) {
    const el = $("#stats-row");
    const items = [
      { k: "Activas", v: stats.active, hint: isToday ? "hoy" : "día seleccionado" },
      { k: "Comensales", v: stats.covers, hint: "no canceladas" },
      { k: "Pendientes", v: stats.pending, hint: "por confirmar" },
      { k: "Teléfono", v: stats.phone, hint: "entrada manual" },
    ];
    el.innerHTML = items
      .map(
        (i) => `
      <div class="adm-stat">
        <span class="adm-stat__val">${i.v}</span>
        <span class="adm-stat__lbl">${i.k}</span>
        <span class="adm-stat__hint">${i.hint}</span>
      </div>`,
      )
      .join("");
  }

  async function loadOverview() {
    const date = calendars.get("ov")?.getDate() || overviewDate || madridToday();
    overviewDate = date;

    const { r, j } = await api(`/api/admin/dashboard?date=${encodeURIComponent(date)}`);
    if (!r?.ok) return;

    $("#overview-now").textContent = `${formatDay(date)}${j.isToday ? " · hoy" : ""} — ${j.nowMadrid}`;
    renderStats(j.stats, j.isToday);

    const tl = $("#timeline");
    const active = (j.timeline ?? []).filter((t) => t.reservations?.length);
    if (!active.length) {
      tl.innerHTML = "";
      $("#timeline-empty").hidden = false;
    } else {
      $("#timeline-empty").hidden = true;
      tl.innerHTML = active
        .map(
          (slot) => `
        <section class="adm-slot">
          <header class="adm-slot__head">
            <span class="adm-slot__time">${slot.time}</span>
            <span class="adm-slot__covers">${slot.covers} comensales</span>
          </header>
          <div class="adm-cards adm-cards--dense">
            ${slot.reservations.map((row) => renderCard(row, { compact: true })).join("")}
          </div>
        </section>`,
        )
        .join("");
      bindStatusSelects(tl);
    }

    const week = $("#week-strip");
    const summary = j.weekSummary ?? [];
    if (!summary.length) {
      week.innerHTML = '<p class="adm-muted">Sin reservas en los próximos días.</p>';
    } else {
      week.innerHTML = summary
        .map(
          (d) => `
        <button type="button" class="adm-week__chip ${d.date === date ? "is-active" : ""}" data-date="${d.date}">
          <span class="adm-week__day">${d.date.slice(8, 10)}/${d.date.slice(5, 7)}</span>
          <span class="adm-week__n">${d.count}</span>
        </button>`,
        )
        .join("");
      week.querySelectorAll("[data-date]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const d = /** @type {HTMLButtonElement} */ (btn).dataset.date ?? "";
          overviewDate = d;
          calendars.get("ov")?.setDate(d);
        });
      });
    }
  }

  async function loadList() {
    const from = calendars.get("list-from")?.getDate() ?? "";
    const to = calendars.get("list-to")?.getDate() ?? "";
    const statusFilter = /** @type {HTMLSelectElement} */ ($("#f-status")).value;
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const { r, j } = await api(`/api/admin/reservations?${q}`);
    const wrap = $("#list-cards");
    wrap.innerHTML = "";
    if (!r?.ok) return;
    let rows = j.reservations ?? [];
    if (statusFilter) rows = rows.filter((row) => row.status === statusFilter);
    if (!rows.length) {
      $("#list-empty").hidden = false;
      return;
    }
    $("#list-empty").hidden = true;
    wrap.innerHTML = rows.map((row) => renderCard(row)).join("");
    bindStatusSelects(wrap);
  }

  async function loadNewSlots() {
    const cal = calendars.get("new");
    let date = cal?.getDate() ?? "";
    if (!date) {
      date = madridToday();
      await cal?.setDate(date);
    }
    const sel = /** @type {HTMLSelectElement} */ ($("#new-time"));
    sel.disabled = true;
    sel.innerHTML = '<option value="">Cargando…</option>';
    const { r, j } = await api(`/api/slots?date=${encodeURIComponent(date)}`);
    if (!r?.ok) {
      sel.innerHTML = `<option value="">${escapeHtml(j.error || "Error")}</option>`;
      return;
    }
    if (j.closed || !j.slots?.length) {
      sel.innerHTML = '<option value="">Sin franjas ese día</option>';
      return;
    }
    const max = j.maxCoversPerSlot ?? 40;
    sel.innerHTML = j.slots
      .map((t) => {
        const booked = j.bookedCovers?.[t] ?? 0;
        const left = max - booked;
        const full = left < 1 ? " (lleno)" : ` (${left} plazas)`;
        return `<option value="${t}">${t}${full}</option>`;
      })
      .join("");
    sel.disabled = false;
  }

  function setupNewForm() {
    const m = meta;
    const box = $("#new-services");
    const opts = m?.serviceOptions ?? ["Terraza", "Interior", "Zona barra"];
    box.innerHTML = opts
      .map(
        (s) => `
      <label class="adm-chip">
        <input type="checkbox" name="services" value="${escapeHtml(s)}" />
        ${escapeHtml(s)}
      </label>`,
      )
      .join("");

  }

  async function refreshSession() {
    await checkApi();
    const { r, j } = await api("/api/admin/session");
    if (!r) return;
    const ok = r.ok && j.admin;
    setAuthUi(ok);
    if (ok) {
      await ensureMeta();
      await setupCalendars();
      const today = madridToday();
      overviewDate = today;
      await calendars.get("ov")?.setDate(today);
      await calendars.get("list-from")?.setDate(today);
      await calendars.get("list-to")?.setDate(addDays(today, 30));
      await calendars.get("new")?.setDate(today);
      setupNewForm();
      setNav("overview");
    } else {
      calendars.clear();
    }
  }

  $$(".adm-nav__btn").forEach((btn) => {
    btn.addEventListener("click", () => setNav(/** @type {HTMLButtonElement} */ (btn).dataset.nav ?? "overview"));
  });

  $("#ov-today")?.addEventListener("click", () => {
    calendars.get("ov")?.setDate(madridToday());
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = /** @type {HTMLParagraphElement} */ ($("#login-err"));
    err.hidden = true;
    const password = /** @type {HTMLInputElement} */ ($("#pwd")).value;
    const { r, j } = await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!r?.ok) {
      err.textContent = j.error || "Sin conexión";
      err.hidden = false;
      return;
    }
    await refreshSession();
    const { r: sr, j: sj } = await api("/api/admin/session");
    if (!sr?.ok || !sj.admin) {
      err.textContent =
        "La contraseña fue aceptada pero la sesión no se guardó. Entra siempre por https (mismo dominio que la web), define SESSION_SECRET en Coolify y deja COOKIE_SECURE vacío o en true. Si sigue fallando, prueba COOKIE_SECURE=false solo para diagnosticar.";
      err.hidden = false;
      setAuthUi(false);
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" });
    await refreshSession();
  });

  $("#reload-btn").addEventListener("click", () => loadList());

  $("#avisos-reload")?.addEventListener("click", () => loadAvisos());

  $("#aviso-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = /** @type {HTMLParagraphElement} */ ($("#aviso-err"));
    const ok = /** @type {HTMLParagraphElement} */ ($("#aviso-ok"));
    err.hidden = true;
    ok.hidden = true;
    const fd = new FormData(/** @type {HTMLFormElement} */ (e.target));
    const body = {
      title: fd.get("title"),
      body: fd.get("body"),
      tipo: fd.get("tipo"),
      publicado: fd.get("publicado"),
      hasta: fd.get("hasta") || "",
      destacado: fd.get("destacado") === "on",
    };
    const { r, j } = await api("/api/admin/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r?.ok) {
      err.textContent = j.error || "No se pudo publicar";
      err.hidden = false;
      return;
    }
    ok.textContent = "Novedad publicada.";
    ok.hidden = false;
    /** @type {HTMLFormElement} */ (e.target).reset();
    const pub = /** @type {HTMLInputElement | null} */ ($('#aviso-form [name="publicado"]'));
    if (pub) pub.value = madridToday();
    await loadAvisos();
  });

  $("#new-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = /** @type {HTMLParagraphElement} */ ($("#new-err"));
    const ok = /** @type {HTMLParagraphElement} */ ($("#new-ok"));
    err.hidden = true;
    ok.hidden = true;
    const fd = new FormData(/** @type {HTMLFormElement} */ (e.target));
    const services = $$('input[name="services"]:checked', e.target).map((el) => el.value);
    const body = {
      date: calendars.get("new")?.getDate() ?? "",
      time: fd.get("time"),
      partySize: Number(fd.get("partySize")),
      name: fd.get("name"),
      phone: fd.get("phone"),
      email: fd.get("email") || "",
      notes: fd.get("notes") || "",
      status: fd.get("status"),
      services,
      source: "phone",
      sendEmail: fd.get("sendEmail") === "on",
    };
    const { r, j } = await api("/api/admin/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r?.ok) {
      err.textContent = j.error || "No se pudo guardar";
      err.hidden = false;
      return;
    }
    ok.textContent = `Reserva guardada (${j.id?.slice(0, 8) ?? "ok"}).`;
    ok.hidden = false;
    /** @type {HTMLFormElement} */ (e.target).reset();
    await calendars.get("new")?.setDate(madridToday());
    await loadNewSlots();
    await loadOverview();
  });

  refreshSession();