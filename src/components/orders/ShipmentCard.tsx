"use client";

import { Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/FormField";
import type { Order } from "@/lib/commerceTypes";
import { formatDateTime } from "@/lib/format";
import { ApiError, apiRequest } from "@/services/apiClient";
import { ORDER_UI } from "./orderConfig";

const EDITABLE = ["CONFIRMED", "PROCESSING", "COMPLETED"];

/** Courier + tracking number. Saving a tracking number on a confirmed order marks it Processing. */
export function ShipmentCard({ order, canEdit }: { order: Order; canEdit: boolean }) {
  const router = useRouter();
  const [courier, setCourier] = useState(order.courier ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [busy, setBusy] = useState(false);
  const editable = canEdit && EDITABLE.includes(order.status);
  const dirty = courier.trim() !== (order.courier ?? "") || tracking.trim() !== (order.trackingNumber ?? "");

  const save = async () => {
    setBusy(true);
    try {
      const updated = await apiRequest<Order>(`${ORDER_UI.apiBase}/${order._id}/shipment`, "PUT", {
        courier: courier.trim(),
        trackingNumber: tracking.trim(),
      });
      toast.success(
        updated.status !== order.status ? "Tracking saved — order moved to Processing" : "Shipment details saved"
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save tracking");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Truck className="w-4 h-4 text-brand" />
        <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Shipment &amp; Tracking</h2>
      </div>
      <div className="p-4 space-y-3 text-xs">
        {editable ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-[12px] font-semibold text-slate-700">Courier</span>
                <input value={courier} onChange={(e) => setCourier(e.target.value)} maxLength={100} className={inputClass()} placeholder="Delhivery, BlueDart…" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[12px] font-semibold text-slate-700">Tracking Number</span>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={100} className={`${inputClass()} font-mono`} />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-slate-500">
                {order.status === "CONFIRMED" ? "Adding a tracking number moves the order to Processing." : order.shippedAt ? `Shipped ${formatDateTime(order.shippedAt)}` : ""}
              </p>
              <Button size="sm" onClick={save} loading={busy} disabled={!dirty}>
                Save Tracking
              </Button>
            </div>
          </>
        ) : order.trackingNumber || order.courier ? (
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[10px] font-bold text-slate-500 uppercase">Courier</dt>
              <dd className="font-semibold text-slate-800">{order.courier || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold text-slate-500 uppercase">Tracking</dt>
              <dd className="font-mono font-semibold text-slate-800 break-all">{order.trackingNumber || "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-slate-500">{order.status === "DRAFT" ? "Tracking can be added once the order is confirmed." : "No tracking recorded."}</p>
        )}
      </div>
    </section>
  );
}
