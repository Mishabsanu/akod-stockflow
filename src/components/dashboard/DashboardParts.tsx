import { ArrowRight, CheckCircle2, CircleDashed, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ORDER_TYPE_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from "@/lib/commerceTypes";
import { formatCurrency, formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import { BUILD_STEPS } from "@/lib/buildProgress";
import type { DashboardData } from "@/server/services/dashboard.service";

/** White card with a title row and an optional "View all" link. */
export function Panel({
  title,
  subtitle,
  href,
  linkLabel = "View all",
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`bg-white rounded-xl border border-line flex flex-col min-w-0 ${className}`}>
      <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline">
            {linkLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <div className="p-4 flex-1 min-w-0">{children}</div>
    </section>
  );
}

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "brand" | "in" | "out" | "warn";
}

const KPI_TONE = {
  brand: "text-brand bg-brand-light",
  in: "text-emerald-700 bg-emerald-50",
  out: "text-rose-700 bg-rose-50",
  warn: "text-amber-700 bg-amber-50",
};

/** Headline figures as stat tiles (no chart: a single number is the clearest form). */
export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
      {items.map(({ label, value, hint, icon: Icon, href, tone = "brand" }) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{label}</p>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${KPI_TONE[tone]}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 tabular-nums mt-1 truncate">{value}</p>
            {hint && <p className="text-[11px] text-slate-500 truncate">{hint}</p>}
          </>
        );
        const cls = "bg-white border border-line rounded-xl px-3.5 py-3 min-w-0 block";
        return href ? (
          <Link key={label} href={href} className={`${cls} hover:border-brand-border transition`}>
            {body}
          </Link>
        ) : (
          <div key={label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal bars: label, value and a bar showing the share of the largest row. */
export function BarList({
  rows,
  empty,
}: {
  rows: { key: string; label: string; value: number; detail?: string; color?: string; href?: string }[];
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || max === 0) return <p className="py-8 text-center text-xs text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline gap-2 text-[12px]">
            {r.color && <span className="w-2.5 h-2.5 rounded-sm shrink-0 self-center" style={{ background: r.color }} />}
            {r.href ? (
              <Link href={r.href} className="font-semibold text-slate-800 truncate flex-1 hover:text-brand">
                {r.label}
              </Link>
            ) : (
              <span className="font-semibold text-slate-800 truncate flex-1">{r.label}</span>
            )}
            <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(r.value)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, (r.value / max) * 100)}%`, background: r.color ?? "var(--color-brand)" }} />
            </div>
            {r.detail && <span className="text-[10.5px] text-slate-500 shrink-0">{r.detail}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeVariant> = {
  DRAFT: "neutral",
  CONFIRMED: "info",
  PROCESSING: "brand",
  COMPLETED: "success",
  CANCELLED: "danger",
  RETURNED: "warning",
};

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function RecentOrders({ orders }: { orders: DashboardData["recentOrders"] }) {
  if (!orders.length) return <p className="py-8 text-center text-xs text-slate-500">No orders yet</p>;
  return (
    <ul className="divide-y divide-line -my-2">
      {orders.map((o) => (
        <li key={o._id}>
          <Link href={`/dashboard/orders/${o._id}`} className="flex items-center gap-3 py-2.5 group">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[12px] font-semibold text-brand group-hover:underline">{o.orderNo}</span>
                <span className="text-[10.5px] text-slate-500">{ORDER_TYPE_LABELS[o.orderType]}</span>
              </span>
              <span className="block text-[11.5px] text-slate-600 truncate">
                {o.party} · {formatDay(o.orderDate)}
              </span>
            </span>
            <span className="text-right shrink-0">
              <span className="block text-[12.5px] font-bold text-slate-900 tabular-nums">{formatCurrency(o.total)}</span>
              <span className="flex gap-1 justify-end mt-0.5">
                <Badge variant={ORDER_STATUS_TONE[o.status]}>{titleCase(o.status)}</Badge>
                {o.status !== "DRAFT" && o.status !== "CANCELLED" && (
                  <span className="hidden sm:inline text-[10px] text-slate-500 self-center">{PAYMENT_STATUS_LABELS[o.paymentStatus]}</span>
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RecentStock({ rows }: { rows: DashboardData["recentStock"] }) {
  if (!rows.length) return <p className="py-8 text-center text-xs text-slate-500">No stock movements yet</p>;
  return (
    <ul className="divide-y divide-line -my-2">
      {rows.map((t) => (
        <li key={t._id} className="flex items-center gap-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-mono text-[12px] font-semibold text-slate-800">{t.sku}</span>
              <span className="text-[10.5px] text-slate-500 truncate">{t.typeLabel}</span>
            </span>
            <span className="block text-[11px] text-slate-500 truncate">
              {t.txnNo} · {formatDay(t.txnDate)}
              {t.reference ? ` · ${t.reference}` : ""}
            </span>
          </span>
          <span className="text-right shrink-0">
            <span className={`block text-[12.5px] font-bold tabular-nums ${t.change > 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {t.change > 0 ? "+" : "−"}
              {formatNumber(Math.abs(t.change))}
            </span>
            <span className="block text-[10.5px] text-slate-500">now {formatNumber(t.after)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Temporary while the app is being built: collapsed checklist of modules. */
export function BuildProgressCard() {
  const done = BUILD_STEPS.filter((s) => s.done).length;
  return (
    <details className="bg-white border border-line rounded-xl group">
      <summary className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer list-none">
        <span className="text-[13px] font-bold text-slate-800">Build progress</span>
        <span className="text-xs font-bold text-brand">
          {done} / {BUILD_STEPS.length} modules done
        </span>
      </summary>
      <ul className="divide-y divide-line border-t border-line">
        {BUILD_STEPS.map((s) => (
          <li key={s.title} className="px-4 py-2.5 flex items-start gap-3">
            {s.done ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" /> : <CircleDashed className="w-4.5 h-4.5 text-slate-400 shrink-0" />}
            <span className="min-w-0">
              <span className={`block text-[12.5px] font-semibold ${s.done ? "text-slate-900" : "text-slate-600"}`}>{s.title}</span>
              <span className="block text-[11px] text-slate-500">{s.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Ranked best sellers: units sold, orders and sales value in the period. */
export function TopProducts({ rows }: { rows: DashboardData["topProducts"] }) {
  if (!rows.length) return <p className="py-8 text-center text-xs text-slate-500">No products sold in this period yet</p>;
  const max = Math.max(...rows.map((r) => r.units), 1);
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10.5px] uppercase tracking-wider text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="text-left font-bold px-4 pb-2 w-8">#</th>
            <th className="text-left font-bold px-2 pb-2">Product</th>
            <th className="text-right font-bold px-2 pb-2">Units Sold</th>
            <th className="text-right font-bold px-2 pb-2 hidden sm:table-cell">Orders</th>
            <th className="text-right font-bold px-4 pb-2">Sales</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={r._id}>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-[11px] font-black ${
                    i === 0 ? "bg-amber-100 text-amber-700" : i < 3 ? "bg-brand-light text-brand" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
              </td>
              <td className="px-2 py-2.5 min-w-[160px]">
                <Link href={`/dashboard/products/${r._id}`} className="block font-semibold text-slate-900 hover:text-brand truncate">
                  {r.name}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10.5px] text-slate-500 shrink-0">{r.sku}</span>
                  <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden max-w-[140px]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (r.units / max) * 100)}%` }} />
                  </div>
                </div>
              </td>
              <td className="px-2 py-2.5 text-right font-bold text-slate-900 tabular-nums">{formatNumber(r.units)}</td>
              <td className="px-2 py-2.5 text-right text-slate-600 tabular-nums hidden sm:table-cell">{formatNumber(r.orders)}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-slate-800 tabular-nums">{formatCurrency(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
