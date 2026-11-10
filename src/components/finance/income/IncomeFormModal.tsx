"use client";

import { Form, Formik } from "formik";
import { HandCoins, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormSurface } from "@/components/forms/FormSurface";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { todayIST } from "@/lib/indiaDate";
import { incomeSchema, type IncomeInput } from "@/lib/validation/finance.schema";
import { apiRequest } from "@/services/apiClient";
import { FINANCE_PATHS, INCOME_CATEGORY_OPTIONS, type AccountOption } from "../shared/financeUi";
import { PaymentModeFields } from "../shared/PaymentModeFields";

const FORM_ID = "income-form";

/** Header button: opens the Add Other Income page. */
export function IncomeFormModal() {
  return (
    <Link
      href={`${FINANCE_PATHS.income}/new`}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-bold transition"
    >
      <Plus className="w-4 h-4" />
      Add Other Income
    </Link>
  );
}

/** "Add Other Income" page: interest, scrap sale, incentives … received now (posts a payment received). */
export function IncomeForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const back = () => router.push(FINANCE_PATHS.income);
  const initialValues: IncomeInput = {
    txnDate: todayIST(),
    category: "OTHER_INCOME",
    description: "",
    amount: 0,
    paymentMethod: "" as IncomeInput["paymentMethod"],
    accountId: "",
    referenceNo: "",
  };
  const onSubmit = useApiSubmit<IncomeInput>({
    request: (values) => apiRequest("/api/finance/income", "POST", values),
    successMessage: "Income recorded",
    redirectTo: FINANCE_PATHS.income,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={incomeSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <FormSurface
          page={{ backHref: FINANCE_PATHS.income }}
          onClose={back}
          title="Add Other Income"
          subtitle="Money received now — it is added to the selected cash / bank account"
          icon={<HandCoins className="w-4 h-4" />}
          footer={
            <>
              <Button variant="outline" onClick={back} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} loading={isSubmitting}>
                Save Income
              </Button>
            </>
          }
        >
          <Form id={FORM_ID} noValidate className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            <TextField name="txnDate" label="Date" type="date" required />
            <SelectField name="category" label="Category" required options={INCOME_CATEGORY_OPTIONS} />
            <TextField name="amount" label="Amount (₹)" type="number" min={0} step="0.01" required />
            <TextField
              name="description"
              label="Description"
              required
              placeholder="e.g. Bank interest, scrap sale"
              className="sm:col-span-2 lg:col-span-3"
              maxLength={300}
            />
            <PaymentModeFields methodName="paymentMethod" referenceName="referenceNo" referenceLabel="Reference Number" accounts={accounts} />
          </Form>
        </FormSurface>
      )}
    </Formik>
  );
}
