"use client";

import { Printer } from "lucide-react";

const BTN =
  "inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

/**
 * Print A4: the full order (shipment, payments and history are hidden in print).
 * Print A6: a compact packing / shipping slip on A6 paper (105 × 148 mm).
 */
export function PrintButton() {
  const printA6 = () => {
    const html = document.documentElement;
    const page = document.createElement("style");
    page.textContent = "@page { size: A6 portrait; margin: 5mm; }";
    document.head.appendChild(page);
    html.dataset.print = "a6";
    const done = () => {
      delete html.dataset.print;
      page.remove();
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  return (
    <>
      <button type="button" onClick={() => window.print()} className={BTN} title="Print the full order on A4">
        <Printer className="w-3.5 h-3.5" />
        Print A4
      </button>
      <button type="button" onClick={printA6} className={BTN} title="Print a packing / shipping slip on A6 paper">
        <Printer className="w-3.5 h-3.5" />
        Print A6
      </button>
    </>
  );
}
