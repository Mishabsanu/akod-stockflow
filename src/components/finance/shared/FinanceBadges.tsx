import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/commerceTypes";
import { EXPENSE_STATUS_LABELS, PAYMENT_METHOD_LABELS, type ExpenseStatus, type PaymentDirection, type PaymentMethod } from "@/lib/financeTypes";

const EXPENSE_VARIANT: Record<ExpenseStatus, BadgeVariant> = {
  PENDING: "warning",
  PARTIAL: "info",
  PAID: "success",
  CANCELLED: "neutral",
};

const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  UNPAID: "warning",
  PARTIAL: "info",
  PAID: "success",
  REFUND_DUE: "danger",
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <Badge variant={EXPENSE_VARIANT[status]} dot>
      {EXPENSE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant={PAYMENT_STATUS_VARIANT[status]} dot>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function DirectionBadge({ direction }: { direction: PaymentDirection }) {
  return direction === "RECEIVED" ? (
    <Badge variant="success">Received</Badge>
  ) : (
    <Badge variant="danger">Made</Badge>
  );
}

export function IncomeStatusBadge({ status }: { status: "ACTIVE" | "REVERSED" }) {
  return status === "ACTIVE" ? (
    <Badge variant="success" dot>
      Active
    </Badge>
  ) : (
    <Badge variant="neutral" dot>
      Reversed
    </Badge>
  );
}

export const methodLabel = (m?: PaymentMethod | "") => (m ? PAYMENT_METHOD_LABELS[m] : "—");
