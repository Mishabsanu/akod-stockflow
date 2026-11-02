"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { ORDER_TRANSITIONS, type Order, type OrderStatus } from "@/lib/commerceTypes";
import { ApiError, apiRequest } from "@/services/apiClient";
import { ORDER_STATUS_LABELS, ORDER_UI, STATUS_ACTIONS } from "./orderConfig";

const NEEDS_REASON: OrderStatus[] = ["CANCELLED", "RETURNED"];

/** One button per allowed next status; each opens a confirm dialog (cancel / return ask for a reason). */
export function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState(order.courier ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [busy, setBusy] = useState(false);

  const next = ORDER_TRANSITIONS[order.status];
  if (!next.length) return null;

  const open = (s: OrderStatus) => {
    setTarget(s);
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
        ...(target === "PROCESSING" ? { courier: courier.trim(), trackingNumber: tracking.trim() } : {}),
      });
      toast.success(`Order ${order.orderNo} is now ${ORDER_STATUS_LABELS[target].toLowerCase()}`);
      setTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update the order");
    } finally {
      setBusy(false);
    }
  };

  const action = target ? STATUS_ACTIONS[target] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <Button key={s} variant={STATUS_ACTIONS[s].variant} size="sm" onClick={() => open(s)}>
            {STATUS_ACTIONS[s].label}
          </Button>
        ))}
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => !busy && setTarget(null)}
        title={action ? `${action.label} — ${order.orderNo}` : ""}
        subtitle={target ? `${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[target]}` : ""}
        icon={<AlertTriangle className="w-4 h-4" />}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Back
            </Button>
            <Button variant={action?.variant === "danger" ? "danger" : "primary"} onClick={run} loading={busy}>
              {action?.label}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs text-slate-600">
          <p>{action?.confirm}</p>
          {target === "PROCESSING" && (
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
