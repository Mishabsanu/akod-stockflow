"use client";

import { Ban, CheckCircle2, Edit2, PackagePlus, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSession, usePermission } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { todayIST } from "@/lib/indiaDate";
import type { MaterialRequest } from "@/lib/materialRequestTypes";
import { apiRequest, ApiError } from "@/services/apiClient";
import { MR_UI } from "./mrUi";

type Confirm = { action: "approve" | "reject" | "cancel" | "delete"; title: string; needsReason: boolean } | null;

const CONFIRMS = {
  approve: { action: "approve", title: "Approve this request?", needsReason: false },
  reject: { action: "reject", title: "Reject this request?", needsReason: true },
  cancel: { action: "cancel", title: "Cancel this request?", needsReason: false },
  delete: { action: "delete", title: "Delete this request?", needsReason: false },
} as const;

function ReceiveModal({ mr, onClose }: { mr: MaterialRequest; onClose: () => void }) {
  const router = useRouter();
  const open = mr.items.filter((i) => i.receivedQty < i.quantity);
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((i) => [i.product, String(i.quantity - i.receivedQty)]))
  );
  const [receiptDate, setDate] = useState(todayIST());
  const [poNumber, setPo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const lines = open.map((i) => ({ product: i.product, quantity: Number(qty[i.product] || 0) }));
      await apiRequest(`${MR_UI.apiBase}/${mr._id}/receive`, "POST", { receiptDate, poNumber, lines });
      toast.success("Stock received and added to inventory");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not receive stock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Receive stock — ${mr.mrNo}`}
      subtitle="Quantities entered here are added to central stock"
      icon={<PackagePlus className="w-4 h-4" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} icon={<PackagePlus className="w-4 h-4" />}>
            Add to Stock
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="text-xs">
          <span className="block text-[11px] font-bold text-slate-600 mb-1">Received Date *</span>
          <input type="date" className={inputClass()} value={receiptDate} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="block text-[11px] font-bold text-slate-600 mb-1">PO Number (optional)</span>
          <input className={inputClass()} value={poNumber} maxLength={60} placeholder="e.g. PO-1042" onChange={(e) => setPo(e.target.value)} />
        </label>
      </div>
      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
        {open.map((i) => {
          const remaining = i.quantity - i.receivedQty;
          return (
            <div key={i.product} className="p-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_120px] gap-2 sm:items-center text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{i.name}</p>
                <p className="font-mono text-[11px] text-slate-500">{i.sku}</p>
              </div>
              <p className="text-slate-500">
                Requested {formatNumber(i.quantity)} · received {formatNumber(i.receivedQty)} · <b className="text-slate-800">{formatNumber(remaining)} left</b>
              </p>
              <input
                type="number"
                min={0}
                max={remaining}
                step={1}
                inputMode="numeric"
                aria-label={`Received quantity for ${i.sku}`}
                className={inputClass()}
                value={qty[i.product] ?? ""}
                onChange={(e) => setQty((q) => ({ ...q, [i.product]: e.target.value }))}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 mt-2">Leave 0 for anything not received yet — you can receive the rest later.</p>
    </Modal>
  );
}

/** Buttons for what this user may do with the request in its current status. */
export function MrActions({ mr }: { mr: MaterialRequest }) {
  const router = useRouter();
  const session = useSession();
  const canApprove = usePermission("material_request", "update");
  const canCreate = usePermission("material_request", "create");
  const own = mr.requestedBy?._id === session._id;
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState(false);

  const pending = mr.status === "PENDING";
  const canEdit = pending && canCreate && (own || canApprove);
  const canReceive = canApprove && (mr.status === "APPROVED" || mr.status === "PARTIALLY_RECEIVED");
  const canCancel = (mr.status === "PENDING" || (mr.status === "APPROVED" && mr.receivedQty === 0)) && (canApprove || own);

  const run = async () => {
    if (!confirm) return;
    if (confirm.needsReason && !reason.trim()) return toast.error("Give a reason");
    setBusy(true);
    try {
      if (confirm.action === "delete") {
        await apiRequest(`${MR_UI.apiBase}/${mr._id}`, "DELETE");
        toast.success("Request deleted");
        router.push(MR_UI.basePath);
      } else {
        await apiRequest(`${MR_UI.apiBase}/${mr._id}/status`, "POST", { action: confirm.action, reason });
        toast.success(confirm.action === "approve" ? "Request approved" : confirm.action === "reject" ? "Request rejected" : "Request cancelled");
      }
      setConfirm(null);
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {canApprove && pending && (
        <>
          <Button size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => setConfirm(CONFIRMS.approve)}>
            Approve
          </Button>
          <Button size="sm" variant="danger" icon={<XCircle className="w-3.5 h-3.5" />} onClick={() => setConfirm(CONFIRMS.reject)}>
            Reject
          </Button>
        </>
      )}
      {canReceive && (
        <Button size="sm" icon={<PackagePlus className="w-3.5 h-3.5" />} onClick={() => setReceiving(true)}>
          Receive Stock
        </Button>
      )}
      {canEdit && (
        <Link
          href={`${MR_UI.basePath}/${mr._id}/edit`}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Edit
        </Link>
      )}
      {canCancel && (
        <Button size="sm" variant="outline" icon={<Ban className="w-3.5 h-3.5" />} onClick={() => setConfirm(CONFIRMS.cancel)}>
          Cancel Request
        </Button>
      )}
      {canEdit && (
        <Button size="sm" variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setConfirm(CONFIRMS.delete)}>
          Delete
        </Button>
      )}

      {receiving && <ReceiveModal mr={mr} onClose={() => setReceiving(false)} />}

      <Modal
        open={Boolean(confirm)}
        onClose={() => !busy && setConfirm(null)}
        size="sm"
        title={confirm?.title ?? ""}
        subtitle={mr.mrNo}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
              Back
            </Button>
            <Button variant={confirm?.action === "approve" ? "primary" : "danger"} onClick={run} loading={busy}>
              Yes, {confirm?.action}
            </Button>
          </>
        }
      >
        {confirm?.needsReason ? (
          <label className="block text-xs">
            <span className="block text-[11px] font-bold text-slate-600 mb-1">Reason *</span>
            <textarea className={`${inputClass()} h-20 py-2`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </label>
        ) : (
          <p className="text-xs text-slate-600">
            {confirm?.action === "approve"
              ? "Once approved, the stock can be received against this request."
              : confirm?.action === "delete"
                ? "The request will be removed permanently."
                : "No stock will be received against it."}
          </p>
        )}
      </Modal>
    </div>
  );
}
