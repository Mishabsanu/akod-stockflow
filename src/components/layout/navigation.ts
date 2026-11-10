import { BarChart3, Boxes, ClipboardList, Factory, LayoutDashboard, Package, Settings, Store, Wallet, type LucideIcon } from "lucide-react";
import { can, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  permission?: PermissionModule;
}

export interface NavModule {
  id: string;
  label: string;
  icon: LucideIcon;
  /** URL prefix that marks this module active */
  basePath: string;
  items: NavItem[];
}

/** Single source of truth for the rail, module tabs, sub-tabs, mobile drawer and bottom bar. */
export const NAV_MODULES: NavModule[] = [
  {
    id: "home",
    label: "Dashboard",
    icon: LayoutDashboard,
    basePath: "/dashboard/overview",
    items: [{ label: "Overview", href: "/dashboard/overview" }],
  },
  {
    id: "products",
    label: "Products",
    icon: Package,
    basePath: "/dashboard/products",
    items: [
      { label: "Products", href: "/dashboard/products", permission: "product" },
      { label: "Categories", href: "/dashboard/products/categories", permission: "category" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    basePath: "/dashboard/inventory",
    items: [
      { label: "Stock Overview", href: "/dashboard/inventory", permission: "stock" },
      { label: "Stock Update", href: "/dashboard/inventory/update", permission: "stock" },
      { label: "Low Stock", href: "/dashboard/inventory/low-stock", permission: "stock" },
      { label: "Material Requests", href: "/dashboard/inventory/requests", permission: "material_request" },
      { label: "Transactions", href: "/dashboard/inventory/transactions", permission: "stock" },
    ],
  },
  {
    id: "production",
    label: "Batch Numbers",
    icon: Factory,
    basePath: "/dashboard/production",
    items: [
      { label: "Batch Numbers", href: "/dashboard/production", permission: "production" },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    icon: Store,
    basePath: "/dashboard/channels",
    items: [{ label: "Marketplaces", href: "/dashboard/channels", permission: "channel" }],
  },
  {
    id: "orders",
    label: "Orders",
    icon: ClipboardList,
    basePath: "/dashboard/orders",
    items: [
      { label: "All Orders", href: "/dashboard/orders", permission: "order" },
      { label: "Marketplace", href: "/dashboard/orders/marketplace", permission: "order" },
      { label: "Local", href: "/dashboard/orders/local", permission: "order" },
      { label: "Distributor", href: "/dashboard/orders/distributor", permission: "order" },
      { label: "Customers & Distributors", href: "/dashboard/orders/customers", permission: "customer" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    basePath: "/dashboard/finance",
    items: [
      { label: "Dashboard", href: "/dashboard/finance/overview", permission: "finance_dashboard" },
      { label: "Income", href: "/dashboard/finance/income", permission: "income" },
      { label: "Expenses", href: "/dashboard/finance/expenses", permission: "expense" },
      { label: "Payments", href: "/dashboard/finance/payments", permission: "payment" },
      { label: "Receivables", href: "/dashboard/finance/receivables", permission: "payment" },
      { label: "Payables", href: "/dashboard/finance/payables", permission: "payment" },
      { label: "Accounts & Ledger", href: "/dashboard/finance/accounts", permission: "account" },
      { label: "Financial Reports", href: "/dashboard/finance/reports", permission: "report" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    basePath: "/dashboard/reports",
    items: [{ label: "All Reports", href: "/dashboard/reports", permission: "report" }],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    basePath: "/dashboard/settings",
    items: [
      { label: "Users", href: "/dashboard/settings/users", permission: "user" },
      { label: "Roles & Permissions", href: "/dashboard/settings/roles", permission: "role" },
      { label: "Company", href: "/dashboard/settings/company", permission: "setting" },
      { label: "Recycle Bin", href: "/dashboard/settings/recycle-bin" },
    ],
  },
];

/** Modules and items the user may see; modules with no visible items are dropped. */
export function visibleModules(user: SessionUser): NavModule[] {
  return NAV_MODULES.map((m) => ({
    ...m,
    items: m.items.filter((i) => !i.permission || can(user, i.permission, "view")),
  })).filter((m) => m.items.length > 0);
}

/**
 * The module owning this path: the module whose page link matches most specifically; otherwise the longest matching basePath.
 */
export function findActiveModule(modules: NavModule[], pathname: string): NavModule | undefined {
  let best: { module: NavModule; length: number } | undefined;
  for (const m of modules) {
    for (const i of m.items) {
      if (isActivePath(pathname, i.href) && (!best || i.href.length > best.length)) best = { module: m, length: i.href.length };
    }
  }
  if (best) return best.module;
  return modules
    .filter((m) => pathname === m.basePath || pathname.startsWith(`${m.basePath}/`))
    .sort((a, b) => b.basePath.length - a.basePath.length)[0];
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Most specific item for the path, so "/x" is not active on "/x/new" when "/x/new" is its own item. */
export function findActiveItem(module: NavModule | undefined, pathname: string): NavItem | undefined {
  return module?.items
    .filter((i) => isActivePath(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
