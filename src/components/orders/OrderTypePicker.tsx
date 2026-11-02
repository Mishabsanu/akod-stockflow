"use client";

import { Store, Truck, UserRound, type LucideIcon } from "lucide-react";
import type { OrderType } from "@/lib/commerceTypes";

const TYPES: { type: OrderType; label: string; hint: string; icon: LucideIcon }[] = [
  { type: "MARKETPLACE", label: "Marketplace Order", hint: "Amazon, Flipkart, Blinkit … — only that marketplace's products", icon: Store },
  { type: "LOCAL", label: "Local Order", hint: "Walk-in / local customer, all in-stock products", icon: UserRound },
  { type: "DISTRIBUTOR", label: "Distributor Order", hint: "Credit sales with outstanding balance tracking", icon: Truck },
];

/** Big segmented cards: the first choice on the order form. */
export function OrderTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (type: OrderType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup" aria-label="Order type">
      {TYPES.map(({ type, label, hint, icon: Icon }) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(type)}
            className={`text-left p-3.5 rounded-xl border-2 transition flex items-start gap-3 disabled:opacity-60 disabled:cursor-not-allowed ${
              active ? "border-brand bg-brand-light/60 shadow-xs" : "border-slate-200 bg-white hover:border-brand-border"
            }`}
          >
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${active ? "text-brand" : "text-slate-800"}`}>{label}</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
