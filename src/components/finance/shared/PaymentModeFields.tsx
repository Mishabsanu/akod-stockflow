"use client";

import { useFormikContext } from "formik";
import { useEffect } from "react";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { METHOD_OPTIONS, type AccountOption } from "./financeUi";

interface Props {
  methodName?: string;
  accountName?: string;
  referenceName?: string;
  accounts: AccountOption[];
  required?: boolean;
  referenceLabel?: string;
  /** Hide the reference box when the form already has one */
  showReference?: boolean;
}

/**
 * Method + Cash/Bank account + transaction reference. Picking a method pre-selects the default
 * account of the matching type (cash → Cash in Hand, anything else → the default bank).
 */
export function PaymentModeFields({
  methodName = "method",
  accountName = "accountId",
  referenceName = "transactionRef",
  accounts,
  required = true,
  referenceLabel = "Transaction Reference",
  showReference = true,
}: Props) {
  const { values, setFieldValue } = useFormikContext<Record<string, string>>();
  const method = values[methodName];

  useEffect(() => {
    if (!method) return;
    const type = method === "CASH" ? "CASH" : "BANK";
    const current = accounts.find((a) => a.value === values[accountName]);
    if (current && current.type === type) return;
    const pick = accounts.find((a) => a.type === type && a.isDefault) ?? accounts.find((a) => a.type === type);
    if (pick) setFieldValue(accountName, pick.value, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  return (
    <>
      <SelectField name={methodName} label="Payment Method" required={required} placeholder="Select method" options={METHOD_OPTIONS} />
      <SelectField
        name={accountName}
        label="Cash / Bank Account"
        placeholder={accounts.length ? "Default account" : "No accounts yet"}
        options={accounts}
        hint="Where the money goes in or out"
      />
      {showReference && <TextField name={referenceName} label={referenceLabel} placeholder="UTR / UPI ref / cheque no." maxLength={80} />}
    </>
  );
}
