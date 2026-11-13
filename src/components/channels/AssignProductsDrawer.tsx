"use client";

import { CheckSquare, ImageIcon, ListPlus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { AssignableProduct } from "@/server/services/channel.service";
import { apiRequest, ApiError } from "@/services/apiClient";

/**
 * Assign Products: a panel that slides in from the right with every product (photo, name, SKU, price,
 * stock) on one list — no pages, no quantity. Tick and Assign.
 */
export function AssignProductsDrawer({
  channelId,
  channelName,
  open,
  onClose,
}: {
  channelId: string;
  channelName: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<AssignableProduct[] | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [hideAssigned, setHideAssigned] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Load the full list each time the panel opens
  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiRequest<{ items: AssignableProduct[] }>(`/api/channels/${channelId}/assignable?all=1`)
      .then((d) => alive && setProducts(d.items))
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof ApiError ? e.message : "Could not load products");
        setProducts([]);
      });
    return () => {
      alive = false;
    };
  }, [open, channelId]);

  // Esc closes; page behind does not scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saving]);

  const list = useMemo(() => products ?? [], [products]);
  const categories = useMemo(() => [...new Set(list.map((p) => p.category).filter(Boolean) as string[])].sort(), [list]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(
      (p) =>
        (!hideAssigned || !p.assigned) &&
        (!category || p.category === category) &&
        (!q || `${p.sku} ${p.name} ${p.category ?? ""}`.toLowerCase().includes(q))
    );
  }, [list, search, category, hideAssigned]);
  const pickable = shown.filter((p) => !p.assigned);
  const allShown = pickable.length > 0 && pickable.every((p) => selected.has(p._id));
  const assignedCount = list.filter((p) => p.assigned).length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of pickable) {
        if (allShown) next.delete(p._id);
        else next.add(p._id);
      }
      return next;
    });

  function close() {
    setSelected(new Set());
    setSearch("");
    setCategory("");
    setProducts(null); // fresh list next time it opens
    onClose();
  }

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest<{ added: number; skipped: number }>(`/api/channels/${channelId}/products`, "POST", { productIds: [...selected] });
      toast.success(`${res.added} product(s) assigned to ${channelName}${res.skipped ? ` · ${res.skipped} skipped` : ""}`);
      close();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not assign products");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[80] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={() => !saving && close()}
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Assign products to ${channelName}`}
        className={`absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-white transition-transform duration-300 ease-out ${
          open ? "translate-x-0 shadow-2xl" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-light text-brand">
            <ListPlus className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Assign Products — {channelName}</h2>
            <p className="text-[11px] text-slate-500">
              Tick the products you sell here.{products && ` ${formatNumber(assignedCount)} of ${formatNumber(list.length)} already assigned.`}
            </p>
          </div>
          <button onClick={() => !saving && close()} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-2 border-b border-line px-5 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, name, category..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 pl-8 pr-3 text-xs focus:border-brand focus:bg-white focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs focus:border-brand focus:outline-none"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <label className="inline-flex select-none items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={hideAssigned} onChange={(e) => setHideAssigned(e.target.checked)} className="h-4 w-4 accent-brand" />
              Hide already assigned
            </label>
            <label className="ml-auto inline-flex select-none items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={allShown} onChange={toggleAll} disabled={!pickable.length} className="h-4 w-4 accent-brand" />
              Select all shown
            </label>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {products === null ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : shown.length === 0 ? (
            <p className="px-5 py-12 text-center text-xs text-slate-500">
              {hideAssigned && !search && !category ? "Every active product is already on this marketplace." : "No matching products"}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((p) => {
                const on = selected.has(p._id);
                return (
                  <li key={p._id}>
                    <label
                      className={`flex items-center gap-3 px-5 py-2.5 ${
                        p.assigned ? "cursor-default bg-slate-50 text-slate-400" : `cursor-pointer hover:bg-head ${on ? "bg-brand-light/60" : ""}`
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={p.assigned || on}
                        disabled={p.assigned}
                        onChange={() => toggle(p._id)}
                        className="h-4 w-4 shrink-0 accent-brand"
                      />
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-slate-50">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-slate-300" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] font-semibold ${p.assigned ? "text-slate-500" : "text-slate-900"}`}>{p.name}</span>
                        <span className="block truncate font-mono text-[11px] text-slate-500">
                          {p.sku}
                          {p.category && <span className="font-sans"> · {p.category}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-semibold text-slate-800">{formatCurrency(p.sellingPrice)}</span>
                        {p.assigned ? (
                          <span className="block text-[10px] font-bold uppercase text-slate-400">Assigned</span>
                        ) : (
                          <span className={`block text-[11px] font-semibold ${p.stock > 0 ? "text-slate-500" : "text-rose-600"}`}>
                            {formatNumber(p.stock)} in stock
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          <span className="mr-auto text-xs font-semibold text-slate-600">
            {selected.size} selected · {formatNumber(shown.length)} shown
          </span>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={selected.size === 0} icon={<CheckSquare className="w-4 h-4" />}>
            Assign {selected.size || ""} Product{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
