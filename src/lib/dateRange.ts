import { addDays, isDay, todayIST } from "./indiaDate";

/** A span of India-time calendar days, both ends included ("YYYY-MM-DD"). */
export interface DayRange {
  from: string;
  to: string;
}

/** 1st of this month → today, the default for finance reports. */
export function thisMonth(): DayRange {
  const today = todayIST();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/** The last `days` days up to today. */
export function lastDays(days: number): DayRange {
  const today = todayIST();
  return { from: addDays(today, -(days - 1)), to: today };
}

/** Range from URL params; anything missing or invalid falls back, and a reversed range is swapped. */
export function readRange(from: string | undefined, to: string | undefined, fallback: DayRange): DayRange {
  const f = from && isDay(from) ? from : fallback.from;
  const t = to && isDay(to) ? to : fallback.to;
  return f <= t ? { from: f, to: t } : { from: t, to: f };
}

/** Start of a day in India time, as an instant (for Date fields such as deliveredAt). */
export const istStart = (day: string) => new Date(`${day}T00:00:00+05:30`);

/** Start of the day after `day`: use as an exclusive upper bound. */
export const istEndExclusive = (day: string) => istStart(addDays(day, 1));
