import { ImportExport } from "@/components/io/ImportExport";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { AddLink } from "@/components/ui/AddLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { ORDER_TYPES, type OrderType } from "@/lib/commerceTypes";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listCustomerOptions } from "@/server/services/customer.service";
import {
  getOrder,
  listAccountOptions,
  listActiveChannelOptions,
  listChannelFilterOptions,
  listOrderPayments,
  listOrders,
  ORDER_FILTERS,
} from "@/server/services/order.service";
import { orNotFound } from "@/server/utils/pageData";
import { OrderDateFilter } from "./OrderDateFilter";
import { getCompanySettings } from "@/server/services/setting.service";
import { OrderDetail } from "./OrderDetail";
import { OrderForm } from "./OrderForm";
import { OrderListView } from "./OrderListView";
import { ORDER_LIST_PAGES, ORDER_UI } from "./orderConfig";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const NEW_PATH: Record<OrderType, string> = {
  MARKETPLACE: "marketplace",
  LOCAL: "local",
  DISTRIBUTOR: "distributor",
};

/** All orders, or one order type's list (that filter is then fixed). */
export async function OrderListPage({ searchParams, type }: { searchParams: SearchParams; type?: OrderType }) {
  const { user, allowed } = await getPageAccess("order", "view");
  if (!allowed) return <AccessDenied />;
  const query = parseListQuery(await searchParams, ORDER_FILTERS);
  if (type) query.filters.orderType = type;
  const [data, channels] = await Promise.all([listOrders(query), listChannelFilterOptions()]);
  const page = ORDER_LIST_PAGES[type ?? "all"];

  return (
    <div className="space-y-4">
      <PageHeader
        title={page.title}
        description={page.description}
        actions={
          <>
            <ImportExport entity="orders" title="Orders" />
            {can(user, "order", "create") && (
              <AddLink href={`${ORDER_UI.basePath}/new${type ? `?type=${NEW_PATH[type]}` : ""}`} label="New Order" />
            )}
          </>
        }
      />
      <OrderDateFilter />
      <OrderListView data={data} channels={channels} fixedType={type} />
    </div>
  );
}

async function formOptions() {
  const [channels, distributors] = await Promise.all([listActiveChannelOptions(), listCustomerOptions("distributor")]);
  return { channels, distributors };
}

export async function OrderCreatePage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("order", "create");
  if (!allowed) return <AccessDenied />;
  const raw = (await searchParams).type;
  const wanted = String(Array.isArray(raw) ? raw[0] : raw ?? "").toUpperCase();
  const defaultType = (ORDER_TYPES as readonly string[]).includes(wanted) ? (wanted as OrderType) : undefined;
  return (
    <OrderForm
      {...await formOptions()}
      defaultType={defaultType}
      canCreateCustomer={can(user, "customer", "create")}
      canConfirm={can(user, "order", "update")}
    />
  );
}

export async function OrderEditPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("order", "update");
  if (!allowed) return <AccessDenied />;
  const order = await orNotFound(getOrder((await params).id));
  if (order.status !== "DRAFT") {
    return <AccessDenied title="Order is not a draft" message={`${order.orderNo} is ${order.status.toLowerCase()} — only draft orders can be edited.`} />;
  }
  const options = await formOptions();
  // Keep the saved marketplace / distributor selectable even if since deactivated
  if (order.channel && !options.channels.some((c) => c.value === order.channel!._id)) {
    options.channels.push({ value: order.channel._id, label: `${order.channel.name} (inactive)` });
  }
  if (order.customer && !options.distributors.some((d) => d.value === order.customer!._id)) {
    options.distributors.push({ value: order.customer._id, label: `${order.customer.name} (inactive)`, phone: "", address: "", creditDays: 0 });
  }
  return <OrderForm initial={order} {...options} canCreateCustomer={can(user, "customer", "create")} canConfirm />;
}

export async function OrderDetailPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("order", "view");
  if (!allowed) return <AccessDenied />;
  const id = (await params).id;
  const [order, payments, accounts, company] = await Promise.all([
    orNotFound(getOrder(id)),
    listOrderPayments(id),
    listAccountOptions(),
    getCompanySettings(),
  ]);
  return (
    <OrderDetail
      order={order}
      payments={payments}
      accounts={accounts}
      canUpdate={can(user, "order", "update")}
      canPay={can(user, "payment", "create")}
      company={company}
    />
  );
}
