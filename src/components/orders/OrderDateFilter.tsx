"use client";

import { CalendarRange } from "lucide-react";
import { useListParams } from "@/hooks/useListParams";
import { addDays, todayIST } from "@/lib/indiaDate";

const PRESETS = [
  { label: "Today", range: () => ({ from: todayIST(), to: todayIST() }) },
  { label: "7 days", range: () => ({ from: addDays(todayIST(), -6), to: todayIST() }) },
  { label: "This month", range: () => ({ from: `${todayIST().slice(0, 8)}01`, to: todayIST() }) },
];

const box =
  "h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-brand text-slate-800 min-w-0 w-full sm:w-[140px]";

/** Order date range (?from=&to=); blank means all dates. */
export function OrderDateFilter() {
  const { get, update, isPending } = useListParams();
  const from = get("from");
  const to = get("to");

  return (
    <div className={`flex flex-wrap items-end gap-2 ${isPending ? "opacity-60" : ""}`}>
      <CalendarRange className="w-4 h-4 text-brand mb-2.5 hidden sm:block" />
      <label className="space-y-1 flex-1 sm:flex-none min-w-[130px]">
        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">From</span>
        <input type="date" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value })} className={box} />
      </label>
      <label className="space-y-1 flex-1 sm:flex-none min-w-[130px]">
        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">To</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} className={box} />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => update(p.range())}
            className="h-9 px-2.5 text-[11px] font-semibold rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-brand hover:text-brand"
          >
            {p.label}
          </button>
        ))}
        {(from || to) && (
          <button
            type="button"
            onClick={() => update({ from: undefined, to: undefined })}
            className="h-9 px-2.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
          >
            All dates
          </button>
        )}
      </div>
    </div>
  );
}
