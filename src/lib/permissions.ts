/**
 * Permission catalogue shared by the UI (menus, buttons) and the API (route guards).
 * Adding a module here makes it appear in the role permission matrix automatically.
 */

export const PERMISSION_ACTIONS = ["view", "create", "update", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_GROUPS = [
  {
    title: "Catalog & Inventory",
    modules: [
      { key: "product", label: "Products — create, edit, variants, images, CSV import / export" },
      { key: "category", label: "Categories — product categories" },
      { key: "offer", label: "Offers — discounts shown on the online store" },
      { key: "stock", label: "Inventory — stock update, CSV upload, adjustments, history" },
      { key: "material_request", label: "Material Requests — raise (create), approve / reject / receive into stock (update)" },
      { key: "channel", label: "Channels — marketplaces and their assigned products" },
    ],
  },
  {
    title: "Production",
    modules: [{ key: "production", label: "Batch Codes — manufacturing units, their batch codes and FSSAI licence, batch lookup" }],
  },
  {
    title: "Orders",
    modules: [
      { key: "order", label: "Orders — create, confirm (deducts stock), ship, complete, cancel, return" },
      { key: "customer", label: "Customers & Distributors (lightweight contacts)" },
    ],
  },
  {
    title: "Finance",
    modules: [
      { key: "finance_dashboard", label: "Finance Dashboard" },
      { key: "income", label: "Income — order income and other income" },
      { key: "expense", label: "Expenses — create, edit, approve (update)" },
      { key: "payment", label: "Payments — received and made, partial payments" },
      { key: "account", label: "Cash & Bank Accounts, Ledger" },
    ],
  },
  {
    title: "Reports",
    modules: [{ key: "report", label: "Reports — products, inventory, orders, sales, finance (CSV export)" }],
  },
  {
    title: "Settings",
    modules: [
      { key: "user", label: "Users" },
      { key: "role", label: "Roles & Permissions" },
      { key: "setting", label: "Company Settings & Categories" },
    ],
  },
] as const;

export type PermissionModule = (typeof PERMISSION_GROUPS)[number]["modules"][number]["key"];

export const PERMISSION_MODULES: PermissionModule[] = PERMISSION_GROUPS.flatMap((g) =>
  g.modules.map((m) => m.key)
);

export type ModulePermission = Record<PermissionAction, boolean>;
export type PermissionMap = Partial<Record<PermissionModule, ModulePermission>>;

export interface AccessProfile {
  isSuperAdmin: boolean;
  permissions: PermissionMap;
}

export function can(
  access: AccessProfile | null | undefined,
  module: PermissionModule,
  action: PermissionAction = "view"
): boolean {
  if (!access) return false;
  if (access.isSuperAdmin) return true;
  return Boolean(access.permissions?.[module]?.[action]);
}

export function emptyPermissions(): Record<PermissionModule, ModulePermission> {
  return Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, { view: false, create: false, update: false, delete: false }])
  ) as Record<PermissionModule, ModulePermission>;
}

/** Keeps only known modules/actions; any create/update/delete implies view. */
export function normalizePermissions(input: unknown): Record<PermissionModule, ModulePermission> {
  const result = emptyPermissions();
  if (!input || typeof input !== "object") return result;
  const source = input as Record<string, Partial<ModulePermission> | undefined>;
  for (const mod of PERMISSION_MODULES) {
    const row = source[mod];
    if (!row) continue;
    for (const action of PERMISSION_ACTIONS) result[mod][action] = Boolean(row[action]);
    if (result[mod].create || result[mod].update || result[mod].delete) result[mod].view = true;
  }
  return result;
}

/** Where a user lands after sign-in. */
export function homePath(): string {
  return "/dashboard/overview";
}
