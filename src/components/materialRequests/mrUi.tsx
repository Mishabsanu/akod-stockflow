import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { MR_PRIORITY_LABELS, MR_STATUS_LABELS, type MrPriority, type MrStatus } from "@/lib/materialRequestTypes";

export const MR_UI = {
  label: "Material Request",
  basePath: "/dashboard/inventory/requests",
  apiBase: "/api/material-requests",
} as const;

const VARIANTS: Record<MrStatus, BadgeVariant> = {
  PENDING: "warning",
  APPROVED: "info",
  PARTIALLY_RECEIVED: "brand",
  RECEIVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

const PRIORITY_VARIANTS: Record<MrPriority, BadgeVariant> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };

export function MrPriorityBadge({ priority }: { priority: MrPriority }) {
  return <Badge variant={PRIORITY_VARIANTS[priority] ?? "neutral"}>{MR_PRIORITY_LABELS[priority] ?? priority}</Badge>;
}

export function MrStatusBadge({ status }: { status: MrStatus }) {
  return (
    <Badge variant={VARIANTS[status]} dot>
      {MR_STATUS_LABELS[status]}
    </Badge>
  );
}
