# AKOD Commerce (akod-eco) — code conventions

One Next.js 16 app (App Router) holds both the UI and the API. MongoDB via Mongoose 9.
Structure, theme and components follow Proserve ERP (`D:\AKOD ERP\proserve`): purple `#5439a3` header,
navy rail, compact grid tables — plus a responsive layer so every screen works on phone, tablet and laptop.

**Hard rule: no file over 500 lines.** Split into sections/hooks/components before that.

## Folder map

| Path | What goes there |
|---|---|
| `src/lib/` | Shared by client **and** server: `permissions.ts`, `types.ts`, `format.ts`, `validation/*.schema.ts` (Yup) |
| `src/server/` | Server only (`import "server-only"` at top) |
| `src/server/models/` | Mongoose models. Always `models.X \|\| model(...)`. No `pre` hooks with `next()` (Mongoose 9) |
| `src/server/services/` | All business logic + DB queries. Return plain JSON via `toPlain()`. Throw `AppError` / `notFound()` |
| `src/server/routes/` | Optional route-handler factories when two resources share logic (see `customer.routes.ts`) |
| `src/server/http/` | `apiHandler` (auth + permission + errors), `readBody` (Yup validation), `parseListQuery`, `searchFilter`, `statusFilter`, `paginate` |
| `src/app/api/<resource>/route.ts` | `GET` list (+ `?options=1` for dropdowns), `POST` create |
| `src/app/api/<resource>/[id]/route.ts` | `GET`, `PUT`, `DELETE` |
| `src/app/dashboard/...` | Thin server pages: check access, call a service, render a component |
| `src/components/ui/` | Button, Badge/StatusBadge, FormField, Modal, ConfirmDeleteModal, PageHeader, AddLink, DetailCard, AccessDenied, Spinner |
| `src/components/layout/` | `AppShell`: desktop rail + 3-tier header (lg+); `MobileDrawer` + `MobileBottomNav` below lg. Menus come from `navigation.ts` |
| `src/components/forms/` | `FormCard` + `FormSection` shell, Formik `TextField` / `SelectField` / `TextAreaField` |
| `src/components/table/` | `DataTable` (filter bar + grid + pagination, URL driven; cards below `md` via `DataCardList`), `RowActions`, `STATUS_FILTER` |
| `src/components/<module>/` | Module UI: `XListView.tsx` (client, columns), `XForm.tsx` (client, Formik), `XPages.tsx` (server pages) |
| `src/hooks/` | `useListParams` (URL state), `useApiSubmit` (Formik submit → API → toast → redirect/refresh), `useDebounce` |
| `src/services/apiClient.ts` | `apiRequest`, `resourceApi(base)` — the only way the browser calls the API |

## Recipe for a new module (reference: `D:\AKOD ERPkod-group` customers / products modules)

1. **Permission** — add the module key to `PERMISSION_GROUPS` in `src/lib/permissions.ts`.
2. **Types** — add the record type to `src/lib/types.ts`.
3. **Validation** — `src/lib/validation/<x>.schema.ts`. The same schema runs in Formik and in `readBody`.
4. **Model** — `src/server/models/<X>.ts`. Auto codes via `nextCode("key", "PREFIX")`.
5. **Service** — `list<X>(query)`, `get<X>(id)`, `create<X>(input, userId)`, `update<X>(id, input)`, `delete<X>(id)`, optional `list<X>Options()`.
   List: `Promise.all([find(filter).sort().skip().limit().lean(), countDocuments(filter)])` → `paginate()`.
   Search with `searchFilter(query.search, FIELDS)`, extra filters come from `parseListQuery(params, ["filterKey"])`.
   Block deletes that would orphan data (409 with a clear message).
6. **API** — wrap every handler: `apiHandler({ module: "x", action: "view" }, async ({ req, user, params }) => ...)`.
   Use plain `export const GET = ...` (not destructured exports).
7. **Pages** (server components, typed with the global `PageProps<"/route">`):
   - list: `getPageAccess(module,"view")` → `if (!allowed) return <AccessDenied />` → `list<X>(parseListQuery(await searchParams, [...]))` → `<PageHeader actions=... />` + `<XListView data={data} />`
   - new / edit: `getPageAccess(module,"create"|"update")`; edit loads with `orNotFound(get<X>(id))`
   - detail: `DetailCard` + `DetailSection` + `DetailItem`
8. **Client list** — `DataTable` with `Column<T>[]` (memoised), `filters`, and `RowActions` showing only permitted actions (`usePermission`).
9. **Client form** — `<Formik validationSchema={schema} onSubmit={useApiSubmit({...})}>` inside `<Form noValidate>` + `FormCard` + `FormSection` + field components.
10. **Navigation** — add the module/items to `src/components/layout/navigation.ts` (rail, tabs and sub-tabs update automatically).

## Rules

- **Responsive:** no fixed widths that exceed 390px on phones; grids use `grid-cols-1 md:… lg:…`. Lists go through
  `DataTable` (cards on phones). Line-item editors stack per row below `md` (see `PriceItemsEditor`). Pages must not
  scroll sideways at 390px.
- **Money** is stored as integer paise (`*Paise` fields). Forms and API bodies use rupees; convert with
  `toPaise` / `fromPaise` from `src/lib/money.ts` in the service only.


- **Raw materials** are counted in thousandths of the item's unit (`*Milli` fields); convert with `toMilli` / `fromMilli`
  from `src/lib/qty.ts`. Move material stock only through `itemStock.service` (logged, never negative).
- **Finance:** vouchers are never deleted, only cancelled with a reason. Customer balance = delivered orders −
  collected at delivery − receipt vouchers.
- **Customers** (distributors, bulk stock holders, retailers) live in one `customers` collection with a `kind`;
  each kind has its own permission key and its own price-list channel (enforced in `customer.service`).
- Every list is server-paginated, searchable and filterable through URL params (`page`, `limit`, `search`, `status`, extra filters). Never fetch lists client-side.
- After a mutation call `router.refresh()` (done by `useApiSubmit` / `RowActions`).
- Server errors: Yup → 422 with `fieldErrors`; duplicate key → 409; mapped in `server/http/errors.ts`. Add new unique-field labels to `DUPLICATE_LABELS`.
- Never return passwords (`select: false`) or `__v`.
- Use theme tokens: `bg-brand`, `hover:bg-brand-dark`, `bg-brand-light`, `border-brand-border`, `border-line`, `bg-head`, `bg-canvas`, `bg-rail*`.
- Next 16: `params` / `searchParams` are Promises; `proxy.ts` replaces middleware; error boundaries receive `retry`.
- Read `node_modules/next/dist/docs/` before using an unfamiliar Next API.

## App-specific rules

- **Stock** changes only through `server/services/stock.service.ts → moveStock()` (atomic, never negative, writes the
  StockTransaction with before / after). One central `Inventory` row per product, shared by all order types.
- **Orders**: Draft → Confirmed → Processing → Completed, plus Cancelled / Returned (`ORDER_TRANSITIONS`). Status moves go
  through `orderFlow.service.ts` only: confirm deducts stock + books income (FinanceTransaction) + posts any upfront payment;
  cancel / return restock and reverse the income. Only DRAFT orders can be edited.
- **Finance** (Proserve flow): every rupee in / out is a `Payment` (RECEIVED / MADE) linked by `referenceType` + `referenceId`
  to an ORDER, EXPENSE, INCOME (other income) or GENERAL. Post payments only via `finance/paymentCore.ts → postPayment()`;
  order / expense paid & balance are recomputed by `finance/settlement.ts`. Each payment lands in a Cash / Bank `Account`;
  the ledger is that account's payments in date order with a running balance.
- **No PO module and no vendor master.** PO number is only an optional reference on stock-in; expense payee is free text.
- **Dates** are India-time calendar days `"YYYY-MM-DD"` (`lib/indiaDate.ts`, `lib/dateRange.ts`).
- Small create / edit forms (channel, customer, expense, payment, stock adjustment) open in a `Modal`; large ones
  (product, order) are pages with `FormCard`.

## Commands

```
npm run dev        # http://localhost:3000
npm run typecheck
npm run seed       # roles, admin + test user, default Cash / Bank accounts
```
