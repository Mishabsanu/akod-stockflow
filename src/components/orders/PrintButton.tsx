"use client";

import { Printer } from "lucide-react";

/** Prints the order (shipment, payments and history panels are hidden in print). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
    >
      <Printer className="w-3.5 h-3.5" />
      Print
    </button>
  );
}
