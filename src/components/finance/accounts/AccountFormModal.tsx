"use client";

import { Form, Formik, useFormikContext } from "formik";
import { FormErrorNotice } from "@/components/forms/FormErrorNotice";
import { Landmark, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormSurface } from "@/components/forms/FormSurface";
import { SelectField, STATUS_OPTIONS, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { FinanceAccount } from "@/lib/financeTypes";
import { accountSchema, type AccountInput } from "@/lib/validation/finance.schema";
import { apiRequest } from "@/services/apiClient";
import { FINANCE_PATHS } from "../shared/financeUi";

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

/** Create / edit a cash or bank account — as a full page (`page`) or a modal. */
export function AccountFormModal({
  account,
  open,
  onClose,
  page,
}: {
  account?: FinanceAccount;
  open?: boolean;
  onClose?: () => void;
  page?: { backHref: string };
}) {
  const router = useRouter();
  const isEdit = Boolean(account);
  const close = page ? () => router.push(page.backHref) : () => onClose?.();
  const onSubmit = useApiSubmit<AccountInput>({
    request: (values) => (isEdit ? apiRequest(`/api/finance/accounts/${account!._id}`, "PUT", values) : apiRequest("/api/finance/accounts", "POST", values)),
    successMessage: isEdit ? "Account updated" : "Account created",
    onSuccess: page ? undefined : onClose,
    redirectTo: page?.backHref,
  });
  if (!open && !page) return null;

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
        <FormSurface
          page={page}
          onClose={close}
          title={isEdit ? `Edit ${account!.name}` : "New Account"}
          subtitle="Cash in hand, bank account, UPI wallet …"
          icon={<Landmark className="w-4 h-4" />}
          footer={
            <>
              <Button variant="outline" onClick={close} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} loading={isSubmitting}>
                Save Account
              </Button>
            </>
          }
        >
          <Form id={FORM_ID} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormErrorNotice />
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
        </FormSurface>
      )}
    </Formik>
  );
}

/** Header button: opens the New Account page. */
export function NewAccountButton() {
  return (
    <Link
      href={`${FINANCE_PATHS.accounts}/new`}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-bold transition"
    >
      <Plus className="w-4 h-4" />
      New Account
    </Link>
  );
}
