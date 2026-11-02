import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ORDER_TYPE_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type OrderType, type PaymentStatus } from "@/lib/commerceTypes";
import { ORDER_STATUS_LABELS } from "./orderConfig";

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  DRAFT: "neutral",
  CONFIRMED: "info",
  PROCESSING: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
  RETURNED: "danger",
};

const PAYMENT_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  UNPAID: "danger",
  PARTIAL: "warning",
  PAID: "success",
  REFUND_DUE: "brand",
};

const TYPE_VARIANT: Record<OrderType, BadgeVariant> = {
  MARKETPLACE: "brand",
  LOCAL: "success",
  DISTRIBUTOR: "info",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} dot>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Drafts and cancelled orders with nothing paid show no payment badge (nothing is owed). */
export function PaymentStatusBadge({ status, orderStatus }: { status: PaymentStatus; orderStatus?: OrderStatus }) {
  if (orderStatus === "DRAFT") return <span className="text-slate-400 text-[11px]">Not confirmed</span>;
  if ((orderStatus === "CANCELLED" || orderStatus === "RETURNED") && status === "UNPAID") {
    return <span className="text-slate-400 text-[11px]">—</span>;
  }
  return <Badge variant={PAYMENT_VARIANT[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function OrderTypeBadge({ type }: { type: OrderType }) {
  return <Badge variant={TYPE_VARIANT[type]}>{ORDER_TYPE_LABELS[type]}</Badge>;
}
