"use client";

import { Loader2, Search, SearchX } from "lucide-react";
import { useState } from "react";
import type { BatchLookupResult } from "@/lib/batchCodeTypes";
import { ApiError, apiRequest } from "@/services/apiClient";
import { CodeChips } from "./ManufacturerListView";

/** Same lookup the customer page will do: batch code on the pack → manufacturer, address and FSSAI licence. */
export function BatchLookup() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ searched: string; result: BatchLookupResult | null } | null>(null);
  const [error, setError] = useState("");

  const search = async (value = code) => {
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    setError("");
    try {
      const { result } = await apiRequest<{ result: BatchLookupResult | null }>(`/api/manufacturers/lookup?code=${encodeURIComponent(v)}`);
      setState({ searched: v.toUpperCase(), result });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  const m = state?.result?.manufacturer;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-black text-brand uppercase tracking-wide">Batch Code Lookup</h2>
        <p className="text-xs text-slate-500">Enter the first characters of the batch code printed on the pack to find the manufacturing details.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="flex gap-2"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. 27"
          autoFocus
          aria-label="Batch code"
          className="flex-1 h-12 px-4 text-base font-bold font-mono uppercase border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="h-12 px-5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Find
        </button>
      </form>

      {error && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

      {state && !m && (
        <div className="bg-white border border-line rounded-2xl p-6 text-center">
          <SearchX className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm font-semibold text-slate-700 mt-2">No manufacturer found for “{state.searched}”</p>
          <p className="text-xs text-slate-500">Check the code on the pack, or add it to a manufacturer under Manufacturers.</p>
        </div>
      )}

      {m && state?.result && (
        <div className="bg-white border border-line rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Applicable Batch Codes</p>
            <CodeChips codes={m.batchCodes} highlight={state.result.matchedCode} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 uppercase leading-snug">{m.name}</h3>
            <p className="text-sm text-slate-500 whitespace-pre-line">{m.address}</p>
            {m.phone && <p className="text-sm text-slate-500">Phone: {m.phone}</p>}
          </div>
          <p className="inline-block text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            FSSAI LIC No. : <span className="font-mono">{m.fssaiLicNo}</span>
          </p>
        </div>
      )}
    </div>
  );
}
