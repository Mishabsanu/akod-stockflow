"use client";

import { CheckSquare, ChevronLeft, ChevronRight, ListPlus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import type { AssignableProduct } from "@/server/services/channel.service";
import { apiRequest, ApiError } from "@/services/apiClient";

interface AssignProductsModalProps {
  channelId: string;
  channelName: string;
  open: boolean;
  onClose: () => void;
}

const LIMIT = 20;

/** Searchable, paginated product table with checkboxes; already-assigned products are shown but locked. */
export function AssignProductsModal({ channelId, channelName, open, onClose }: AssignProductsModalProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hideAssigned, setHideAssigned] = useState(true);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<{ key: string; data: Paginated<AssignableProduct> } | null>(null);
  const [selected, setSelected] = useState<Map<string, AssignableProduct>>(new Map());
  /** Assigned qty typed per selected product ('' = no limit) */
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const q = useDebounce(search, 300);
  const key = `${channelId}|${page}|${q}|${hideAssigned}`;
  const data = loaded?.data ?? null;
  const loading = open && loaded?.key !== key;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), search: q, hideAssigned: hideAssigned ? "1" : "" });
    apiRequest<Paginated<AssignableProduct>>(`/api/channels/${channelId}/assignable?${params}`)
      .then((d) => alive && setLoaded({ key, data: d }))
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof ApiError ? e.message : "Could not load products");
        setLoaded((prev) => ({ key, data: prev?.data ?? { items: [], page: 1, limit: LIMIT, total: 0, totalPages: 1 } }));
      });
    return () => {
      alive = false;
    };
  }, [open, channelId, page, q, hideAssigned, key]);

  const pageRows = useMemo(() => data?.items.filter((p) => !p.assigned) ?? [], [data]);
  const allOnPage = pageRows.length > 0 && pageRows.every((p) => selected.has(p._id));

  const toggle = (p: AssignableProduct) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p._id)) next.delete(p._id);
      else next.set(p._id, p);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const p of pageRows) {
        if (allOnPage) next.delete(p._id);
        else next.set(p._id, p);
      }
      return next;
    });

  const close = () => {
    setSelected(new Map());
    setQty({});
    setSearch("");
    setPage(1);
    onClose();
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest<{ added: number; skipped: number }>(`/api/channels/${channelId}/products`, "POST", {
        productIds: [...selected.keys()],
        allocations: [...selected.keys()].map((id) => ({ product: id, allocatedQty: qty[id] === undefined || qty[id] === "" ? null : Number(qty[id]) })),
      });
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
    <Modal
      open={open}
      onClose={close}
      title={`Assign Products — ${channelName}`}
      subtitle="Tick the products you sell here and, if you want a limit, how many units this marketplace may sell (blank = no limit)."
      icon={<ListPlus className="w-4 h-4" />}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-xs font-semibold text-slate-600">{selected.size} selected</span>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={selected.size === 0} icon={<CheckSquare className="w-4 h-4" />}>
            Assign {selected.size || ""} Product{selected.size === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search SKU, name, barcode, category..."
              className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-brand"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 select-none">
            <input type="checkbox" checked={hideAssigned} onChange={(e) => {
                setHideAssigned(e.target.checked);
                setPage(1);
              }} className="accent-brand w-4 h-4" />
            Hide already assigned
          </label>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden relative min-h-[160px]">
          {loading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
              <Spinner />
            </div>
          )}
          <table className="w-full text-xs">
            <thead className="bg-head text-[10px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={togglePage} disabled={!pageRows.length} className="accent-brand w-4 h-4" />
                </th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left hidden sm:table-cell">Category</th>
                <th className="px-3 py-2 text-right hidden sm:table-cell">Price</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right w-32">Assign Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data && data.items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    {hideAssigned && !q ? "Every active product is already on this marketplace." : "No matching products"}
                  </td>
                </tr>
              )}
              {data?.items.map((p) => (
                <tr
                  key={p._id}
                  onClick={() => !p.assigned && toggle(p)}
                  className={p.assigned ? "bg-slate-50 text-slate-400" : `cursor-pointer hover:bg-head ${selected.has(p._id) ? "bg-brand-light/60" : ""}`}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.sku}`}
                      checked={p.assigned || selected.has(p._id)}
                      disabled={p.assigned}
                      onChange={() => toggle(p)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-brand w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-slate-900 block">{p.name}</span>
                    <span className="font-mono text-[11px] text-slate-500">{p.sku}</span>
                    {p.assigned && (
                      <Badge variant="neutral" className="ml-2">
                        Assigned
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">{p.category || "—"}</td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell">{formatCurrency(p.sellingPrice)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${p.stock > 0 ? "text-slate-800" : "text-rose-600"}`}>{formatNumber(p.stock)}</td>
                  <td className="px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {!p.assigned && (
                      <input
                        type="number"
                        min={0}
                        max={p.stock}
                        step={1}
                        inputMode="numeric"
                        placeholder="No limit"
                        aria-label={`Assign qty for ${p.sku}`}
                        value={qty[p._id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setQty((q) => ({ ...q, [p._id]: v }));
                          // Typing a quantity selects the product
                          if (v !== "" && !selected.has(p._id)) toggle(p);
                        }}
                        className={`w-24 h-8 px-2 text-xs text-right rounded-md border focus:outline-none focus:border-brand ${
                          qty[p._id] && Number(qty[p._id]) > p.stock ? "border-rose-400 text-rose-700" : "border-slate-300"
                        }`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {data.page} of {data.totalPages} · {formatNumber(data.total)} products
            </span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="w-3.5 h-3.5" />}>
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
