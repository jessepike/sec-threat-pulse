const TZ = "America/Los_Angeles";

function parts(d: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).formatToParts(d);
}
function pick(p: Intl.DateTimeFormatPart[], t: string) {
  return p.find((x) => x.type === t)?.value ?? "";
}

/** "FRI OCT 23 10:40 PT" */
export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return "UNKNOWN";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "UNKNOWN";
  const p = parts(d, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${pick(p, "weekday")} ${pick(p, "month")} ${pick(p, "day")} ${pick(p, "hour")}:${pick(p, "minute")} PT`.toUpperCase();
}

/** "10:40" */
export function fmtClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = parts(d, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${pick(p, "hour")}:${pick(p, "minute")}`;
}

/** "OCT 23" */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "UNKNOWN";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "UNKNOWN";
  // Date-only values have no time zone. Format them as written.
  const tz = iso.length === 10 ? "UTC" : TZ;
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).formatToParts(d);
  return `${pick(p, "month")} ${pick(p, "day")}`.toUpperCase();
}

/** "Oct 19, 2026" */
export function fmtLong(d: Date): string {
  const p = parts(d, { month: "short", day: "numeric", year: "numeric" });
  return `${pick(p, "month")} ${pick(p, "day")}, ${pick(p, "year")}`;
}

/** Monday of the week containing `now`, in Pacific time. */
export function weekOfLabel(now: Date): string {
  const p = parts(now, { weekday: "short", year: "numeric", month: "numeric", day: "numeric" });
  const idx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(pick(p, "weekday"));
  const local = new Date(Date.UTC(Number(pick(p, "year")), Number(pick(p, "month")) - 1, Number(pick(p, "day"))));
  local.setUTCDate(local.getUTCDate() - Math.max(idx, 0));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(local);
}

/** "OCT 23, 2026". Date-only values are formatted as written. */
export function fmtDayYear(iso: string | null | undefined): string {
  if (!iso) return "UNKNOWN";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "UNKNOWN";
  const tz = iso.length === 10 ? "UTC" : TZ;
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" }).formatToParts(d);
  return `${pick(p, "month")} ${pick(p, "day")}, ${pick(p, "year")}`.toUpperCase();
}

/** YYYY-MM-DD in Pacific time, so timeline dates match the PT dates shown elsewhere on the page. */
export function isoDayPT(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Joins short evidence texts as sentences: each ends with a period, separated by a space. */
export function joinSentences(texts: string[]): string {
  return texts
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((t) => (/[.!?…]$/.test(t) ? t : `${t}.`))
    .join(" ");
}
