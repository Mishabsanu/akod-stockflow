"use client";

import { useFormikContext } from "formik";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { FormField, inputClass } from "@/components/ui/FormField";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency } from "@/lib/format";
import type { PaymentInput } from "@/lib/validation/finance.schema";
import { apiRequest } from "@/services/apiClient";

interface ReferenceOption {
  value: string;
  label: string;
  party: string;
  max: number;
}

/**
 * Searchable list of open orders (outstanding / refundable) or expenses (balance due).
 * Choosing one fills the amount with what is still due.
 */
export function ReferencePicker({ onPick }: { onPick: (o: ReferenceOption | null) => void }) {
  const { values, setFieldValue, errors, touched } = useFormikContext<PaymentInput>();
  const [search, setSearch] = useState("");
  const term = useDebounce(search, 300);
  const type = values.referenceType;
  const direction = values.direction;
  const key = `${type}|${direction}|${term}`;
  // Options of the last finished lookup; "loading" while the current key has not come back yet
  const [result, setResult] = useState<{ key: string; options: ReferenceOption[] }>({ key: "", options: [] });
  const loading = result.key !== key;
  const options = result.options;

  useEffect(() => {
    if (type === "GENERAL") return;
    let alive = true;
    const qs = new URLSearchParams({ type, direction, search: term });
    apiRequest<ReferenceOption[]>(`/api/payments/references?${qs}`)
      .then((rows) => alive && setResult({ key, options: rows }))
      .catch(() => alive && setResult({ key, options: [] }));
    return () => {
      alive = false;
    };
  }, [type, direction, term, key]);

  if (type === "GENERAL") return null;
  const error = touched.referenceId ? (errors.referenceId as string | undefined) : undefined;
  const what = type === "ORDER" ? (direction === "MADE" ? "cancelled / returned order to refund" : "order with an amount due") : "expense with a balance";

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={type === "ORDER" ? "Search order no, customer, marketplace ref…" : "Search expense no, payee…"}
          className={`${inputClass(false)} pl-8`}
        />
      </div>
      <FormField label={type === "ORDER" ? "Order" : "Expense"} htmlFor="referenceId" required error={error} hint={loading ? "Loading…" : `Pick the ${what}`}>
        <select
          id="referenceId"
          value={values.referenceId}
          onChange={(e) => {
            const picked = options.find((o) => o.value === e.target.value) ?? null;
            setFieldValue("referenceId", e.target.value);
            onPick(picked);
            if (picked) setFieldValue("amount", picked.max);
          }}
          className={`${inputClass(Boolean(error))} cursor-pointer`}
        >
          <option value="">{options.length ? "Select…" : loading ? "Loading…" : "Nothing open found"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}

export const maxHint = (max: number | null) => (max !== null ? `At most ${formatCurrency(max)}` : undefined);
