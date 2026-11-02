import { UserRound } from "lucide-react";
import Link from "next/link";
import { ImportExport } from "@/components/io/ImportExport";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/OrderBadges";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { StatusBadge } from "@/components/ui/Badge";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { CUSTOMER_FILTERS, getCustomer, listCustomers } from "@/server/services/customer.service";
import { listOrders } from "@/server/services/order.service";
import { orNotFound } from "@/server/utils/pageData";
import { CustomerEditButton } from "./CustomerEditButton";
import { CustomerKindBadge, CustomerListView } from "./CustomerListView";
import { CUSTOMER_UI } from "./customerConfig";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

export async function CustomerListPage({ searchParams }: { searchParams: SearchParams }) {
  const { allowed } = await getPageAccess("customer", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listCustomers(parseListQuery(await searchParams, CUSTOMER_FILTERS));
  return (
    <div className="space-y-4">
      <PageHeader title={CUSTOMER_UI.plural} description={CUSTOMER_UI.description} actions={<ImportExport entity="customers" title={CUSTOMER_UI.plural} />} />
      <CustomerListView data={data} />
    </div>
  );
}

export async function CustomerDetailPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("customer", "view");
  if (!allowed) return <AccessDenied />;
  const id = (await params).id;
  const customer = await orNotFound(getCustomer(id));
  const orders = can(user, "order", "view")
    ? await listOrders({ page: 1, limit: 50, search: "", status: "", sort: "", filters: { customer: id } })
    : null;

  return (
    <div className="space-y-4">
      <DetailCard
        title={customer.name}
        subtitle={customer.code}
        badge={
          <>
            <CustomerKindBadge kind={customer.kind} />
            <StatusBadge status={customer.status} />
          </>
        }
        icon={<UserRound className="w-4.5 h-4.5" />}
        backHref={CUSTOMER_UI.basePath}
      >
        {can(user, "customer", "update") && (
          <div className="flex justify-end -mt-2">
            <CustomerEditButton customer={customer} />
          </div>
        )}
        <DetailSection title="Contact">
          <DetailItem label="Contact Person" value={customer.contactPerson} />
          <DetailItem label="Phone" value={customer.phone ? <a href={`tel:${customer.phone}`} className="text-brand hover:underline">{customer.phone}</a> : ""} />
          <DetailItem label="Email" value={customer.email} />
          <DetailItem label="GSTIN" value={customer.gstin} mono />
          <DetailItem label="Address" value={customer.address} />
        </DetailSection>
        <DetailSection title="Credit">
          <DetailItem label="Credit Days" value={customer.creditDays ? `${customer.creditDays} days` : "Cash / immediate"} />
          <DetailItem
            label="Outstanding"
            value={<span className={customer.outstanding ? "text-rose-700" : "text-emerald-700"}>{formatCurrency(customer.outstanding ?? 0)}</span>}
          />
        </DetailSection>
      </DetailCard>

      {orders && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Orders ({orders.total})</h2>
            {orders.total > orders.items.length && (
              <Link href={`/dashboard/orders?search=${encodeURIComponent(customer.name)}`} className="text-[11px] font-bold text-brand hover:underline">
                View all
              </Link>
            )}
          </div>
          {orders.items.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {orders.items.map((o) => (
                <li key={o._id}>
                  <Link href={`/dashboard/orders/${o._id}`} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-head">
                    <span className="min-w-0">
                      <span className="font-mono font-bold text-brand">{o.orderNo}</span>
                      <span className="text-slate-500"> · {formatDay(o.orderDate)}</span>
                      <span className="flex gap-1.5 mt-1 flex-wrap">
                        <OrderStatusBadge status={o.status} />
                        <PaymentStatusBadge status={o.paymentStatus} orderStatus={o.status} />
                      </span>
                    </span>
                    <span className="text-right whitespace-nowrap">
                      <span className="block font-bold text-slate-800">{formatCurrency(o.total)}</span>
                      {o.outstanding > 0 && o.status !== "PENDING" && <span className="block text-[11px] text-rose-700">Due {formatCurrency(o.outstanding)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
