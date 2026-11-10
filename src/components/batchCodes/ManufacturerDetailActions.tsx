"use client";

import { Edit2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import type { Manufacturer } from "@/lib/batchCodeTypes";
import { ApiError, apiRequest } from "@/services/apiClient";
import { ManufacturerFormModal } from "./ManufacturerFormModal";
import { BASE } from "./ManufacturerListView";

/** Edit (modal) and delete on the batch-number detail page. */
export function ManufacturerDetailActions({ manufacturer }: { manufacturer: Manufacturer }) {
  const router = useRouter();
  const canEdit = usePermission("production", "update");
  const canDelete = usePermission("production", "delete");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await apiRequest(`/api/manufacturers/${manufacturer._id}`, "DELETE");
      toast.success("Batch number moved to the Recycle Bin");
      router.push(BASE);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete");
      setDeleting(false);
    }
  };

  if (!canEdit && !canDelete) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button variant="outline" icon={<Edit2 className="w-4 h-4" />} onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
      {canDelete && (
        <Button variant="outline" icon={<Trash2 className="w-4 h-4 text-rose-600" />} onClick={() => setConfirm(true)}>
          Delete
        </Button>
      )}
      <ManufacturerFormModal manufacturer={editing ? manufacturer : null} onClose={() => setEditing(false)} />
      <ConfirmDeleteModal
        open={confirm}
        entityLabel="Batch Number"
        itemName={`${manufacturer.batchCodes.join(", ")} — ${manufacturer.name}`}
        loading={deleting}
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
      />
    </div>
  );
}
