/**
 * Business dates are calendar days in India time ("YYYY-MM-DD"), so daily reports are the same wherever the server runs.
 */
const IST = "Asia/Kolkata";

export function todayIST(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return now.toLocaleDateString("en-CA", { timeZone: IST });
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** "Thu, 23 Oct 2026" */
export function formatDay(day: string): string {
  if (!isDay(day)) return "—";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
