"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { inputClass } from "@/components/ui/FormField";
import { formatNumber } from "@/lib/format";

export interface PickerProduct {
  productId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

interface ProductPickerProps {
  products: PickerProduct[];
  value: string;
  onChange: (productId: string) => void;
  invalid?: boolean;
  placeholder?: string;
  id?: string;
}

/** Searchable product dropdown (by SKU or name) showing current stock. Works with the keyboard. */
export function ProductPicker({ products, value, onChange, invalid, placeholder = "Search SKU or product name…", id }: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const selected = products.find((p) => p.productId === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? products.filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : products;
    return list.slice(0, 50);
  }, [products, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (p: PickerProduct) => {
    onChange(p.productId);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={boxRef}>
      {!open ? (
        <button
          type="button"
          id={id}
          onClick={() => {
            setOpen(true);
            setActive(0);
          }}
          className={`${inputClass(invalid)} flex items-center justify-between text-left`}
        >
          {selected ? (
            <span className="truncate">
              <span className="font-mono font-bold">{selected.sku}</span> — {selected.name}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <span className="flex items-center gap-1 shrink-0">
            {selected && (
              <X
                className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
              />
            )}
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, matches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (matches[active]) pick(matches[active]);
              } else if (e.key === "Escape") setOpen(false);
            }}
            placeholder={placeholder}
            className={`${inputClass(invalid)} pl-8`}
          />
        </div>
      )}
      {open && (
        <ul className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg text-xs">
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-slate-500">No matching products</li>
          ) : (
            matches.map((p, i) => (
              <li key={p.productId}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(p)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${i === active ? "bg-brand-light" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="font-mono font-bold text-slate-800">{p.sku}</span>
                    <span className="block text-slate-600 truncate">{p.name}</span>
                  </span>
                  <span className={`shrink-0 font-bold ${p.stock > 0 ? "text-slate-700" : "text-rose-600"}`}>{formatNumber(p.stock)} in stock</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
