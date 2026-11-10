/** One delete action in the Recycle Bin (the record the user deleted, plus anything removed with it). */
export interface RecycleBinItem {
  /** Delete batch id — restore / delete forever act on the whole batch */
  _id: string;
  type: string;
  typeLabel: string;
  title: string;
  detail: string;
  deletedAt: string;
  deletedBy: string;
  /** User has delete permission for this module (needed to restore or delete forever) */
  canRestore: boolean;
}

export const RECYCLE_BIN_TYPES = [
  { value: "product", label: "Products" },
  { value: "category", label: "Categories" },
  { value: "manufacturer", label: "Batch Numbers" },
  { value: "channel", label: "Marketplaces" },
  { value: "customer", label: "Customers" },
  { value: "order", label: "Orders" },
  { value: "material_request", label: "Material Requests" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
  { value: "payment", label: "Payments" },
  { value: "account", label: "Cash / Bank Accounts" },
  { value: "user", label: "Users" },
  { value: "role", label: "Roles" },
];
