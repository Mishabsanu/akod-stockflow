"use client";

import { CalendarRange } from "lucide-react";
import { useListParams } from "@/hooks/useListParams";
import { PERIODS, type PeriodKey } from "@/lib/periods";

interface PeriodFilterProps {
  /** Period the server used (shown as active) */
  period: PeriodKey | "all";
  from: string;
  to: string;
  /** Lists where no dates means "all dates" (receivables, products) */
  allowAll?: boolean;
}

const box =
  "h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-brand text-slate-800 min-w-0 w-full sm:w-[140px]";

/** Today / This Week / This Month / This Year / Custom — kept in the URL (?period=&from=&to=). */
export function PeriodFilter({ period, from, to, allowAll = false }: PeriodFilterProps) {
  const { update, isPending } = useListParams();
  const custom = period === "custom";

  const pick = (key: PeriodKey | "all") => {
    if (key === "all") update({ period: undefined, from: undefined, to: undefined });
    else if (key === "custom") update({ period: "custom", from: from || undefined, to: to || undefined });
    else update({ period: key, from: undefined, to: undefined });
  };

  const options: { key: PeriodKey | "all"; label: string }[] = [
    ...(allowAll ? [{ key: "all" as const, label: "All Dates" }] : []),
    ...PERIODS.map((p) => ({ key: p.key, label: p.label })),
  ];

  return (
    <div className={`flex flex-wrap items-end gap-2 print:hidden ${isPending ? "opacity-60" : ""}`}>
      <CalendarRange className="w-4 h-4 text-brand mb-2.5 hidden sm:block" />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={period === o.key}
            onClick={() => pick(o.key)}
            className={`h-9 px-3 text-[11.5px] font-semibold rounded-lg border transition ${
              period === o.key
                ? "bg-brand border-brand text-white"
                : "bg-white border-slate-300 text-slate-600 hover:border-brand hover:text-brand"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {custom && (
        <>
          <label className="space-y-1 flex-1 sm:flex-none min-w-[130px]">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">From</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => update({ period: "custom", from: e.target.value || undefined })}
              className={box}
            />
          </label>
          <label className="space-y-1 flex-1 sm:flex-none min-w-[130px]">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">To</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => update({ period: "custom", to: e.target.value || undefined })}
              className={box}
            />
          </label>
        </>
      )}
    </div>
  );
}
