import type { Option } from "@/lib/types";

export const CUSTOMER_UI = {
  label: "Contact",
  plural: "Customers & Distributors",
  basePath: "/dashboard/orders/customers",
  apiBase: "/api/customers",
  description: "Local customers and distributors used on orders, with what each still owes",
} as const;

export const CUSTOMER_KIND_OPTIONS: Option[] = [
  { value: "distributor", label: "Distributor" },
  { value: "local", label: "Local Customer" },
];
