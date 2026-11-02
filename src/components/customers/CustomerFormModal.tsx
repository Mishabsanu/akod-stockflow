"use client";

import { Form, Formik, type FormikHelpers } from "formik";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Customer, CustomerKind } from "@/lib/commerceTypes";
import { customerSchema, emptyCustomer, type CustomerInput } from "@/lib/validation/customer.schema";
import { ApiError, resourceApi } from "@/services/apiClient";
import { CUSTOMER_KIND_OPTIONS, CUSTOMER_UI } from "./customerConfig";

const api = resourceApi<Customer>(CUSTOMER_UI.apiBase);

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: Customer;
  defaultKind?: CustomerKind;
  /** Quick-add from the order form: the type is fixed */
  lockKind?: boolean;
  onSaved?: (customer: Customer) => void;
}

/** Create / edit a local customer or distributor in a modal. */
export function CustomerFormModal({ open, onClose, initial, defaultKind = "distributor", lockKind, onSaved }: CustomerFormModalProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const initialValues: CustomerInput = initial
    ? {
        kind: initial.kind,
        name: initial.name,
        contactPerson: initial.contactPerson ?? "",
        phone: initial.phone ?? "",
        email: initial.email ?? "",
        address: initial.address ?? "",
        gstin: initial.gstin ?? "",
        creditDays: initial.creditDays,
        status: initial.status,
      }
    : emptyCustomer(defaultKind);

  const submit = async (values: CustomerInput, helpers: FormikHelpers<CustomerInput>) => {
    try {
      const saved = initial ? await api.update(initial._id, values) : await api.create(values);
      toast.success(isEdit ? "Contact updated" : `${saved.kind === "distributor" ? "Distributor" : "Customer"} ${saved.name} added`);
      onSaved?.(saved);
      onClose();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors) helpers.setErrors(error.fieldErrors as never);
        toast.error(error.message);
      } else toast.error("Something went wrong. Please try again.");
    } finally {
      helpers.setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${initial!.name}` : lockKind && defaultKind === "distributor" ? "New Distributor" : "New Customer / Distributor"}
      subtitle={isEdit ? initial!.code : "Lightweight contact used on orders"}
      icon={<UserRound className="w-4 h-4" />}
      size="lg"
    >
      <Formik initialValues={initialValues} validationSchema={customerSchema} onSubmit={submit} enableReinitialize>
        {({ isSubmitting, values }) => (
          <Form noValidate className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField name="kind" label="Type" required options={CUSTOMER_KIND_OPTIONS} disabled={lockKind} />
              <TextField name="name" label={values.kind === "distributor" ? "Distributor / Firm Name" : "Customer Name"} required maxLength={150} />
              <TextField name="contactPerson" label="Contact Person" maxLength={100} />
              <TextField name="phone" label="Phone" placeholder="+91 98765 43210" />
              <TextField name="email" label="Email" type="email" />
              <TextField name="gstin" label="GSTIN" placeholder="29ABCDE1234F1Z5" />
              <TextField
                name="creditDays"
                label="Credit Days"
                type="number"
                min={0}
                max={365}
                hint={values.kind === "distributor" ? "Due date = order date + this" : "Usually 0"}
              />
              <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
              <TextAreaField name="address" label="Address" className="md:col-span-2" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="mt-3">
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting} className="mt-3">
                {isEdit ? "Save Changes" : "Save Contact"}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
