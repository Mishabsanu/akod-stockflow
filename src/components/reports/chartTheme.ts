/**
 * Chart colours: categorical slots of the validated reference palette, assigned in fixed order
 * (never cycled). Order types always keep the same hue on every chart.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export const ORDER_TYPE_COLOR = { MARKETPLACE: SERIES[0], LOCAL: SERIES[1], DISTRIBUTOR: SERIES[2] } as const;

export const INK = { primary: "#0f172a", secondary: "#475569", muted: "#94a3b8", grid: "#e2e8f0", surface: "#ffffff" };

/** "₹1.2L" style ticks so the axis stays narrow on phones. */
export function compactRupees(v: number): string {
  const n = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  // One decimal (dropped when ".0") so nearby ticks never print the same label
  const short = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (n >= 1e7) return `${sign}₹${short(n / 1e7)}Cr`;
  if (n >= 1e5) return `${sign}₹${short(n / 1e5)}L`;
  if (n >= 1e3) return `${sign}₹${short(n / 1e3)}k`;
  return `${sign}₹${Math.round(n)}`;
}
