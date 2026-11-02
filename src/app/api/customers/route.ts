import { customerSchema } from "@/lib/validation/customer.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createCustomer, CUSTOMER_FILTERS, listCustomerOptions, listCustomers } from "@/server/services/customer.service";

/** List (filters: kind, status, search) or ?options=1&kind=distributor for the order form. */
export const GET = apiHandler({ module: "customer", action: "view" }, async ({ req }) => {
  const params = req.nextUrl.searchParams;
  if (params.get("options") === "1") {
    return { items: await listCustomerOptions(params.get("kind") === "local" ? "local" : "distributor") };
  }
  return listCustomers(parseListQuery(params, CUSTOMER_FILTERS));
});

export const POST = apiHandler({ module: "customer", action: "create" }, async ({ req, user }) =>
  createCustomer(await readBody(req, customerSchema), user._id)
);
