export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "0";
  return value.toLocaleString("en-US");
}

export function initials(name?: string): string {
  if (!name) return "AK";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "AK";
}

/** Indian rupees with two decimals, e.g. ₹1,25,000.00 */
export function formatCurrency(value?: number | null): string {
  const n = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
}

/** Packets shown as cartons + loose packets, e.g. 320 packets at 100/carton → "3 CTN + 20 PKT". */
export function formatPackets(packets: number, packetsPerCarton: number): string {
  if (!packetsPerCarton || packetsPerCarton <= 1) return `${formatNumber(packets)} PKT`;
  const cartons = Math.floor(packets / packetsPerCarton);
  const loose = packets % packetsPerCarton;
  if (!cartons) return `${formatNumber(loose)} PKT`;
  return loose ? `${formatNumber(cartons)} CTN + ${formatNumber(loose)} PKT` : `${formatNumber(cartons)} CTN`;
}
