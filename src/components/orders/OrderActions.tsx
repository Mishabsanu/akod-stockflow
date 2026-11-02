"use client";

import { ArrowRightLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { ORDER_TRANSITIONS, type Order, type OrderStatus } from "@/lib/commerceTypes";
import { ApiError, apiRequest } from "@/services/apiClient";
import { ORDER_STATUS_LABELS, ORDER_UI, statusChangeEffect } from "./orderConfig";
import { OrderStatusBadge } from "./OrderBadges";

const NEEDS_REASON: OrderStatus[] = ["CANCELLED", "RETURNED"];

/** Text / border colour of the inline dropdown, matching the status badges. */
const INLINE_TONE: Record<OrderStatus, string> = {
  PENDING: "border-slate-300 text-slate-700",
  CONFIRMED: "border-sky-300 text-sky-700",
  SHIPPED: "border-amber-300 text-amber-700",
  DELIVERED: "border-violet-300 text-violet-700",
  COMPLETED: "border-emerald-300 text-emerald-700",
  CANCELLED: "border-rose-300 text-rose-700",
  RETURNED: "border-rose-300 text-rose-700",
};

/**
 * "Change status" dropdown: pick any allowed status (Pending, Confirmed, Shipped, Delivered, Completed,
 * Cancelled …). A confirm dialog says what happens to stock / income; cancel and return ask for a reason.
 */
export function OrderActions({ order, inline = false }: { order: Order; /** Compact dropdown for list rows: shows the current status, choosing one opens the confirm dialog */ inline?: boolean }) {
  const router = useRouter();
  const next = ORDER_TRANSITIONS[order.status];
  const [choice, setChoice] = useState<OrderStatus | "">("");
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState(order.courier ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [busy, setBusy] = useState(false);

  if (!next.length) return null;

  const open = () => {
    if (!choice) return toast.error("Choose the new status");
    setTarget(choice);
    setNote("");
  };

  const run = async () => {
    if (!target) return;
    if (NEEDS_REASON.includes(target) && !note.trim()) {
      toast.error("Please give a reason");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`${ORDER_UI.apiBase}/${order._id}/status`, "POST", {
        status: target,
        note: note.trim(),
        ...(target === "SHIPPED" ? { courier: courier.trim(), trackingNumber: tracking.trim() } : {}),
      });
      toast.success(`Order ${order.orderNo} is now ${ORDER_STATUS_LABELS[target]}`);
      setTarget(null);
      setChoice("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update the order");
    } finally {
      setBusy(false);
    }
  };

  const effect = target ? statusChangeEffect(order.status, target) : null;

  const picker = inline ? (
    <select
      aria-label={`Change status of ${order.orderNo}`}
      value={target ?? order.status}
      onChange={(e) => {
        const next = e.target.value as OrderStatus;
        if (next === order.status) return;
        setTarget(next);
        setNote("");
      }}
      onClick={(e) => e.stopPropagation()}
      className={`h-7 pl-2 pr-6 text-[11px] font-bold rounded-md border cursor-pointer bg-white focus:outline-none focus:border-brand ${INLINE_TONE[order.status]}`}
    >
      <option value={order.status}>{ORDER_STATUS_LABELS[order.status]}</option>
      {next.map((s) => (
        <option key={s} value={s}>
          → {ORDER_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  ) : null;

  return (
    <>
      {picker}
      <div className={inline ? "hidden" : "flex items-center gap-2 w-full sm:w-auto"}>
        <label htmlFor={`status-${order._id}`} className="sr-only">
          Change order status
        </label>
        <select
          id={`status-${order._id}`}
          value={choice}
          onChange={(e) => setChoice(e.target.value as OrderStatus | "")}
          className={`${inputClass()} h-8 sm:w-44 bg-white`}
        >
          <option value="">Change status…</option>
          {next.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button size="sm" icon={<ArrowRightLeft className="w-3.5 h-3.5" />} onClick={open} disabled={!choice}>
          Update
        </Button>
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => !busy && setTarget(null)}
        title={target ? `Change status — ${order.orderNo}` : ""}
        icon={<ArrowRightLeft className="w-4 h-4" />}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Back
            </Button>
            <Button variant={effect?.tone === "danger" ? "danger" : "primary"} onClick={run} loading={busy}>
              Set {target ? ORDER_STATUS_LABELS[target] : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs text-slate-600">
          {target && (
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <span className="text-slate-400">→</span>
              <OrderStatusBadge status={target} />
            </div>
          )}
          <p>{effect?.text}</p>
          {target === "SHIPPED" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-[12px] font-semibold text-slate-700">Courier</span>
                <input value={courier} onChange={(e) => setCourier(e.target.value)} className={inputClass()} placeholder="Delhivery, BlueDart…" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[12px] font-semibold text-slate-700">Tracking Number</span>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputClass()} placeholder="Optional" />
              </label>
            </div>
          )}
          <label className="block space-y-1.5">
            <span className="block text-[12px] font-semibold text-slate-700">
              {target && NEEDS_REASON.includes(target) ? (
                <>
                  Reason<span className="text-rose-500 ml-0.5">*</span>
                </>
              ) : (
                "Note (optional)"
              )}
            </span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={`${inputClass()} h-auto py-2 resize-none`} />
          </label>
        </div>
      </Modal>
    </>
  );
}
