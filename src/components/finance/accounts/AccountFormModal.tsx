"use client";

import { Form, Formik, useFormikContext } from "formik";
import { Landmark, Plus } from "lucide-react";
import { useState } from "react";
import { SelectField, STATUS_OPTIONS, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { FinanceAccount } from "@/lib/financeTypes";
import { accountSchema, type AccountInput } from "@/lib/validation/finance.schema";
import { apiRequest } from "@/services/apiClient";

const FORM_ID = "account-form";

function DefaultCheckbox() {
  const { values, setFieldValue } = useFormikContext<AccountInput>();
  return (
    <label className="sm:col-span-2 flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
      <input type="checkbox" checked={values.isDefault} onChange={(e) => setFieldValue("isDefault", e.target.checked)} className="mt-0.5 accent-brand" />
      <span>
        <span className="font-semibold">Default account for its type</span>
        <span className="block text-slate-500">Cash payments go to the default Cash account; UPI, bank transfer and card go to the default Bank account.</span>
      </span>
    </label>
  );
}

export function AccountFormModal({ account, open, onClose }: { account?: FinanceAccount; open: boolean; onClose: () => void }) {
  const isEdit = Boolean(account);
  const onSubmit = useApiSubmit<AccountInput>({
    request: (values) => (isEdit ? apiRequest(`/api/finance/accounts/${account!._id}`, "PUT", values) : apiRequest("/api/finance/accounts", "POST", values)),
    successMessage: isEdit ? "Account updated" : "Account created",
    onSuccess: onClose,
  });
  if (!open) return null;

  const initialValues: AccountInput = {
    code: account?.code ?? "",
    name: account?.name ?? "",
    type: (account?.type ?? "BANK") as AccountInput["type"],
    openingBalance: account?.openingBalance ?? 0,
    isDefault: account?.isDefault ?? false,
    description: account?.description ?? "",
    status: account?.status ?? "active",
  };

  return (
    <Formik initialValues={initialValues} validationSchema={accountSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Modal
          open
          onClose={onClose}
          title={isEdit ? `Edit ${account!.name}` : "New Account"}
          subtitle="Cash in hand, bank account, UPI wallet …"
          icon={<Landmark className="w-4 h-4" />}
          footer={
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} loading={isSubmitting}>
                Save Account
              </Button>
            </>
          }
        >
          <Form id={FORM_ID} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField name="name" label="Account Name" required placeholder="e.g. HDFC Current A/c" maxLength={80} />
            <TextField name="code" label="Code" required placeholder="e.g. HDFC" maxLength={20} />
            <SelectField
              name="type"
              label="Type"
              required
              options={[
                { value: "CASH", label: "Cash" },
                { value: "BANK", label: "Bank / UPI" },
              ]}
            />
            <TextField name="openingBalance" label="Opening Balance (₹)" type="number" min={0} step="0.01" />
            <SelectField name="status" label="Status" options={STATUS_OPTIONS} />
            <TextField name="description" label="Description" maxLength={200} />
            <DefaultCheckbox />
          </Form>
        </Modal>
      )}
    </Formik>
  );
}

export function NewAccountButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>
        New Account
      </Button>
      <AccountFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
