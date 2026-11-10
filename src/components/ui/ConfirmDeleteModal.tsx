"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDeleteModalProps {
  open: boolean;
  entityLabel: string;
  itemName?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Recycle Bin "Delete forever": cannot be undone */
  permanent?: boolean;
}

export function ConfirmDeleteModal({ open, entityLabel, itemName, loading, onCancel, onConfirm, permanent }: ConfirmDeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={permanent ? `Delete ${entityLabel} forever?` : `Delete ${entityLabel}?`}
      size="sm"
      icon={<Trash2 className="w-4 h-4" />}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {permanent ? "Yes, Delete Forever" : "Yes, Delete"}
          </Button>
        </>
      }
    >
      <div className="flex gap-3 text-xs text-slate-600">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="space-y-2">
          {permanent ? (
            <p>
              This permanently removes this {entityLabel.toLowerCase()} and anything deleted with it. <b>This cannot be undone.</b>
            </p>
          ) : (
            <p>
              Delete this {entityLabel.toLowerCase()}? It moves to the <b>Recycle Bin</b> (Settings → Recycle Bin), where it can be
              restored.
            </p>
          )}
          {itemName && (
            <p className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 rounded px-2 py-1 inline-block">
              {itemName}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
