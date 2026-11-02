/** Temporary: shown on the Overview page while the app is being built. */
export const BUILD_STEPS: { title: string; detail: string; done: boolean }[] = [
  { title: "Foundation", detail: "Login, proserve layout (responsive), sidebar, users, roles & permissions", done: true },
  { title: "Products", detail: "Create / edit / view, search by SKU or name, category filter, CSV import & export", done: false },
  { title: "Inventory", detail: "Stock overview, stock update + CSV (SKU, qty, PO no., date), adjustments, history, low stock", done: false },
  { title: "Channels", detail: "Create marketplaces, assign / remove products with a checkbox table", done: false },
  { title: "Orders", detail: "Marketplace / local / distributor orders, confirm → stock deducted, cancel / return → restocked, tracking no.", done: false },
  { title: "Finance", detail: "Income, expenses, payments (partial), receivables, payables, cash & bank ledger", done: false },
  { title: "Reports & Dashboards", detail: "All reports with search, date filters, sorting, pagination, CSV export", done: false },
];
