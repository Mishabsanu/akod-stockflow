import { paymentSchema } from "@/lib/validation/finance.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createPayment, listPayments, PAYMENT_FILTERS } from "@/server/services/finance/payment.service";

export const GET = apiHandler({ module: "payment", action: "view" }, async ({ req }) =>
  listPayments(parseListQuery(req.nextUrl.searchParams, PAYMENT_FILTERS))
);

/**
 * Record a payment received / made. Body: { paymentDate, direction, referenceType (ORDER | EXPENSE | GENERAL),
 * referenceId, amount (rupees), method, accountId, transactionRef, notes, partyName }.
 */
export const POST = apiHandler({ module: "payment", action: "create" }, async ({ req, user }) =>
  createPayment(await readBody(req, paymentSchema), user._id)
);
