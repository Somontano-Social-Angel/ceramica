/**
 * Calendario mensual (misma UX que /reservar).
 * @param {HTMLElement} root [data-booking-calendar]
 * @param {{
 *   i18n: { months: string[]; calendarPast?: string; calendarClosed?: string; calendarTooFar?: string; calendarPick?: string };
 *   allowPast?: boolean;
 *   initialDate?: string;
 *   onChange?: (date: string) => void;
 * }} options
 */
export async function initBookingCalendar(root, options) {
  const i18n = options.i18n;
  const allowPast = Boolean(options.allowPast);
  const onChange = options.onChange ?? (() => {});

  const dateInput = /** @type {HTMLInputElement | null} */ (root.querySelector("[data-date-input]"));
  const calGrid = /** @type {HTMLElement | null} */ (root.querySelector("[data-cal-grid]"));
  const calMonthLabel = /** @type {HTMLElement | null} */ (root.querySelector("[data-cal-month]"));
  const calPrev = /** @type {HTMLButtonElement | null} */ (root.querySelector("[data-cal-prev]"));
  const calNext = /** @type {HTMLButtonElement | null} */ (root.querySelector("[data-cal-next]"));

  if (!dateInput || !calGrid || !calMonthLabel || !calPrev || !calNext) {
    throw new Error("Calendario incompleto");
  }

  let metaToday = "";
  let metaMaxBookable = "";
  let metaMaxAhead = 120;
  let viewYear = 0;
  let viewMonth = 0;

  const MESES = i18n.months;

  function madridDateStringClient() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  }

  function addDaysISO(dateStr, delta) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }

  function madridWeekday(dateStr) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const utcNoon = Date.UTC(y, mo - 1, d, 12, 0, 0);
    const short = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid",
      weekday: "short",
    }).format(new Date(utcNoon));
    /** @type {Record<string, number>} */
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[short] ?? 0;
  }

  function mondayFirstColumnClient(firstDateStr) {
    return (madridWeekday(firstDateStr) + 6) % 7;
  }

  function diffCalendarDays(a, b) {
    const [y1, m1, d1] = a.split("-").map(Number);
    const [y2, m2, d2] = b.split("-").map(Number);
    return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
  }

  function daysInMonthHuman(y, m) {
    return new Date(y, m, 0).getDate();
  }

  function normalizeDay(day) {
    if (!allowPast) return day;
    const closed = Boolean(day.closed);
    const tooFar = Boolean(day.tooFar);
    const disabled = closed || tooFar;
    return { ...day, past: Boolean(day.past), disabled };
  }

  function buildLocalMonthPack(y, m) {
    const today = metaToday || madridDateStringClient();
    const dim = daysInMonthHuman(y, m);
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const leadingEmpty = mondayFirstColumnClient(first);
    const days = [];
    for (let d = 1; d <= dim; d++) {
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const closed = madridWeekday(dateStr) === 0;
      const past = dateStr < today;
      const tooFar = diffCalendarDays(dateStr, today) > metaMaxAhead;
      days.push(
        normalizeDay({
          date: dateStr,
          closed,
          past,
          tooFar,
          disabled: allowPast ? closed || tooFar : past || closed || tooFar,
        }),
      );
    }
    return { leadingEmpty, days };
  }

  function monthKey(y, m) {
    return y * 12 + (m - 1);
  }

  function syncViewFromInput() {
    const v = dateInput.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    viewYear = parseInt(v.slice(0, 4), 10);
    viewMonth = parseInt(v.slice(5, 7), 10);
  }

  function updateNavDisabled() {
    if (!metaToday || !metaMaxBookable) return;
    const viewK = monthKey(viewYear, viewMonth);
    const minK = monthKey(parseInt(metaToday.slice(0, 4), 10), parseInt(metaToday.slice(5, 7), 10));
    const maxK = monthKey(
      parseInt(metaMaxBookable.slice(0, 4), 10),
      parseInt(metaMaxBookable.slice(5, 7), 10),
    );
    calPrev.disabled = !allowPast && viewK <= minK;
    calNext.disabled = viewK >= maxK;
  }

  async function loadMeta() {
    try {
      const r = await fetch("/api/meta");
      const j = r.ok ? await r.json() : null;
      if (!r.ok || !j?.ok || !j.today) throw new Error("meta");
      metaToday = j.today;
      metaMaxBookable = j.maxBookableDate || addDaysISO(j.today, Number(j.maxBookingDaysAhead ?? 120));
      metaMaxAhead = Number(j.maxBookingDaysAhead ?? 120);
      if (!dateInput.value) dateInput.value = j.suggestedDate || j.today;
    } catch {
      metaToday = madridDateStringClient();
      metaMaxAhead = 120;
      metaMaxBookable = addDaysISO(metaToday, metaMaxAhead);
      if (!dateInput.value) dateInput.value = metaToday;
    }
    syncViewFromInput();
  }

  async function renderCalendar() {
    if (!viewYear || !viewMonth) {
      const t = metaToday || madridDateStringClient();
      viewYear = parseInt(t.slice(0, 4), 10);
      viewMonth = parseInt(t.slice(5, 7), 10);
    }
    updateNavDisabled();
    calMonthLabel.textContent = `${MESES[viewMonth - 1]} ${viewYear}`;

    let pack = null;
    try {
      const r = await fetch(`/api/calendar-month?year=${viewYear}&month=${viewMonth}`);
      const j = r.ok ? await r.json() : null;
      if (r.ok && j?.ok && Array.isArray(j.days) && j.days.length > 0) {
        pack = {
          leadingEmpty: Number(j.leadingEmpty ?? 0),
          days: j.days.map(normalizeDay),
        };
      }
    } catch {
      pack = null;
    }
    if (!pack) pack = buildLocalMonthPack(viewYear, viewMonth);

    calGrid.innerHTML = "";
    for (let i = 0; i < pack.leadingEmpty; i++) {
      const pad = document.createElement("div");
      pad.className = "res-cal__pad";
      pad.setAttribute("aria-hidden", "true");
      calGrid.appendChild(pad);
    }
    for (const day of pack.days) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "res-cal__day";
      b.dataset.date = day.date;
      b.textContent = String(parseInt(day.date.slice(8, 10), 10));
      if (day.disabled) {
        b.disabled = true;
        b.classList.add("res-cal__day--off");
        if (day.closed) b.classList.add("res-cal__day--closed");
        b.title = day.past
          ? i18n.calendarPast || ""
          : day.tooFar
            ? i18n.calendarTooFar || ""
            : i18n.calendarClosed || "";
      } else {
        b.title = i18n.calendarPick || "";
      }
      if (day.date === metaToday) b.classList.add("res-cal__day--today");
      if (day.date === dateInput.value && !day.disabled) b.classList.add("res-cal__day--picked");
      b.addEventListener("click", () => {
        if (day.disabled) return;
        dateInput.value = day.date;
        syncViewFromInput();
        renderCalendar().then(() => onChange(day.date));
      });
      calGrid.appendChild(b);
    }
  }

  root.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-cal-prev]")) {
      if (calPrev.disabled) return;
      if (viewMonth <= 1) {
        viewYear -= 1;
        viewMonth = 12;
      } else {
        viewMonth -= 1;
      }
      await renderCalendar();
      return;
    }
    if (t.closest("[data-cal-next]")) {
      if (calNext.disabled) return;
      if (viewMonth >= 12) {
        viewYear += 1;
        viewMonth = 1;
      } else {
        viewMonth += 1;
      }
      await renderCalendar();
    }
  });

  await loadMeta();
  if (options.initialDate) dateInput.value = options.initialDate;
  syncViewFromInput();
  await renderCalendar();
  if (dateInput.value) onChange(dateInput.value);

  return {
    getDate: () => dateInput.value,
    async setDate(iso) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
      dateInput.value = iso;
      syncViewFromInput();
      await renderCalendar();
      onChange(iso);
    },
    refresh: renderCalendar,
  };
}
