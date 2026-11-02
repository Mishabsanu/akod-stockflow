import { addDays, isDay, todayIST } from "./indiaDate";

/** Date presets used by the dashboards and reports (India-time calendar days). */
export const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

export interface Period {
  key: PeriodKey;
  from: string;
  to: string;
}

/** Monday of the week containing `day`. */
function weekStart(day: string): string {
  const sundayFirst = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((sundayFirst + 6) % 7));
}

export function presetRange(key: Exclude<PeriodKey, "custom">, today = todayIST()): { from: string; to: string } {
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: weekStart(today), to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default:
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

/** Reads ?period=&from=&to= ; custom dates win, an unknown period falls back to `fallback`. */
export function resolvePeriod(
  params: { period?: string; from?: string; to?: string },
  fallback: Exclude<PeriodKey, "custom"> = "month"
): Period {
  const { from, to } = params;
  if (params.period === "custom" || (!params.period && (isDay(from) || isDay(to)))) {
    const base = presetRange(fallback);
    const f = isDay(from) ? from : base.from;
    const t = isDay(to) ? to : base.to;
    return f <= t ? { key: "custom", from: f, to: t } : { key: "custom", from: t, to: f };
  }
  const key = (PERIODS.some((p) => p.key === params.period) ? params.period : fallback) as Exclude<PeriodKey, "custom">;
  return { key, ...presetRange(key) };
}

/** Number of calendar days in a range, both ends included. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

/** Charts group by day for short ranges and by month for long ones. */
export const bucketOf = (from: string, to: string): "day" | "month" => (daysBetween(from, to) <= 62 ? "day" : "month");

/** Every bucket label between from and to ("YYYY-MM-DD" or "YYYY-MM"). */
export function bucketKeys(from: string, to: string): string[] {
  const unit = bucketOf(from, to);
  const keys: string[] = [];
  if (unit === "day") {
    for (let d = from; d <= to; d = addDays(d, 1)) keys.push(d);
  } else {
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7));
    const end = to.slice(0, 7);
    for (;;) {
      const k = `${y}-${String(m).padStart(2, "0")}`;
      keys.push(k);
      if (k >= end) break;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return keys;
}

/** "02 Nov" for a day bucket, "Nov 2026" for a month bucket. */
export function bucketLabel(key: string): string {
  if (key.length === 7) {
    return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function periodLabel(p: { from: string; to: string }): string {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return p.from === p.to ? fmt(p.from) : `${fmt(p.from)} – ${fmt(p.to)}`;
}
