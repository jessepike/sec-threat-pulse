/** Weekly counts for the home page chart. Pure. Weeks start Monday, UTC (KEV dates are plain dates). */

export interface WeekCount {
  /** Monday, YYYY-MM-DD. */
  week: string;
  count: number;
  /** True for the week still under way. */
  partial: boolean;
}

export const CHART_WEEKS = 12;

function mondayOf(day: string): string {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** The first day counted for `weeks` weeks ending with the current one. */
export function chartStart(now: Date, weeks: number = CHART_WEEKS): string {
  const d = new Date(`${mondayOf(now.toISOString())}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1));
  return d.toISOString().slice(0, 10);
}

/** Counts dates into the last `weeks` Monday weeks, oldest first, empty weeks kept as 0. */
export function bucketWeeks(dates: string[], now: Date, weeks: number = CHART_WEEKS): WeekCount[] {
  const start = chartStart(now, weeks);
  const current = mondayOf(now.toISOString());
  const out: WeekCount[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < weeks; i++) {
    const w = d.toISOString().slice(0, 10);
    out.push({ week: w, count: 0, partial: w === current });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  const idx = new Map(out.map((w, i) => [w.week, i]));
  for (const day of dates) {
    const i = idx.get(mondayOf(day));
    if (i !== undefined) out[i].count += 1;
  }
  return out;
}
