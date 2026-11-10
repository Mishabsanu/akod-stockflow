import { customerSchema } from "@/lib/validation/customer.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteCustomer, getCustomer, updateCustomer } from "@/server/services/customer.service";

export const GET = apiHandler<{ id: string }>({ module: "customer", action: "view" }, async ({ params }) => getCustomer(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "customer", action: "update" }, async ({ req, params }) =>
  updateCustomer(params.id, await readBody(req, customerSchema))
);

export const DELETE = apiHandler<{ id: string }>({ module: "customer", action: "delete" }, async ({ params, user }) => {
  await deleteCustomer(params.id, user._id);
  return { success: true };
});
