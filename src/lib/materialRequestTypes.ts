/**
 * Material Request (MR): someone asks for products to be restocked.
 * Pending → Approved → (Partially) Received; receiving adds the quantity to central stock.
 */
export const MR_STATUSES = ["PENDING", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "REJECTED", "CANCELLED"] as const;
export type MrStatus = (typeof MR_STATUSES)[number];

export const MR_STATUS_LABELS: Record<MrStatus, string> = {
  PENDING: "Pending Approval",
  APPROVED: "Approved",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const MR_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type MrPriority = (typeof MR_PRIORITIES)[number];

export const MR_PRIORITY_LABELS: Record<MrPriority, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export interface MaterialRequestItem {
  product: string;
  sku: string;
  name: string;
  quantity: number;
  receivedQty: number;
  /** Current central stock (filled on the detail page) */
  stock?: number;
}

export interface MrEvent {
  status: MrStatus;
  at: string;
  by?: string;
  note?: string;
}

export interface MaterialRequest {
  _id: string;
  mrNo: string;
  requestDate: string;
  requiredBy?: string;
  priority: MrPriority;
  requestedBy: { _id: string; name: string } | null;
  requestedByName: string;
  items: MaterialRequestItem[];
  totalQty: number;
  receivedQty: number;
  notes?: string;
  status: MrStatus;
  rejectReason?: string;
  approvedByName?: string;
  approvedAt?: string;
  history: MrEvent[];
  createdAt?: string;
  updatedAt?: string;
}
