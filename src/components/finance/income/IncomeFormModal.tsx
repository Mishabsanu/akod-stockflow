"use client";

import { Form, Formik } from "formik";
import { HandCoins, Plus } from "lucide-react";
import { useState } from "react";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { todayIST } from "@/lib/indiaDate";
import { incomeSchema, type IncomeInput } from "@/lib/validation/finance.schema";
import { apiRequest } from "@/services/apiClient";
import { INCOME_CATEGORY_OPTIONS, type AccountOption } from "../shared/financeUi";
import { PaymentModeFields } from "../shared/PaymentModeFields";

const FORM_ID = "income-form";

/** "Add Other Income": interest, scrap sale, incentives … received now (posts a payment received). */
export function IncomeFormModal({ accounts }: { accounts: AccountOption[] }) {
  const [open, setOpen] = useState(false);
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
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <Button icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>
        Add Other Income
      </Button>
      <Formik initialValues={initialValues} validationSchema={incomeSchema} onSubmit={onSubmit}>
        {({ isSubmitting, resetForm }) => (
          <Modal
            open={open}
            onClose={() => {
              setOpen(false);
              resetForm();
            }}
            title="Add Other Income"
            subtitle="Money received now — it is added to the selected cash / bank account"
            icon={<HandCoins className="w-4 h-4" />}
            footer={
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" form={FORM_ID} loading={isSubmitting}>
                  Save Income
                </Button>
              </>
            }
          >
            <Form id={FORM_ID} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField name="txnDate" label="Date" type="date" required />
              <SelectField name="category" label="Category" required options={INCOME_CATEGORY_OPTIONS} />
              <TextField name="description" label="Description" required placeholder="e.g. Bank interest, scrap sale" className="sm:col-span-2" maxLength={300} />
              <TextField name="amount" label="Amount (₹)" type="number" min={0} step="0.01" required />
              <PaymentModeFields methodName="paymentMethod" referenceName="referenceNo" referenceLabel="Reference Number" accounts={accounts} />
            </Form>
          </Modal>
        )}
      </Formik>
    </>
  );
}
