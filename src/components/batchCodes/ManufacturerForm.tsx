"use client";

import { Form, Formik } from "formik";
import { Factory } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormSurface } from "@/components/forms/FormSurface";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import type { Manufacturer } from "@/lib/batchCodeTypes";
import { emptyManufacturer, manufacturerSchema, type ManufacturerInput } from "@/lib/validation/manufacturer.schema";
import { ApiError, resourceApi } from "@/services/apiClient";
import { BatchCodesField } from "./BatchCodesField";

const api = resourceApi<Manufacturer>("/api/manufacturers");
export const BATCH_BASE = "/dashboard/production";
const FORM_ID = "batch-number-form";

/** New / Edit Batch Number — full page: batch number(s), FSSAI licence, company name, address. */
export function ManufacturerForm({ initial }: { initial?: Manufacturer }) {
  const router = useRouter();
  const backHref = initial ? `${BATCH_BASE}/${initial._id}` : BATCH_BASE;
  const values: ManufacturerInput = initial
    ? {
        name: initial.name,
        address: initial.address,
        fssaiLicNo: initial.fssaiLicNo,
        batchCodes: initial.batchCodes,
        phone: initial.phone ?? "",
        notes: initial.notes ?? "",
        status: initial.status,
      }
    : emptyManufacturer;

  return (
    <Formik
      initialValues={values}
      validationSchema={manufacturerSchema}
      onSubmit={async (input, helpers) => {
        try {
          const saved = initial ? await api.update(initial._id, input) : await api.create(input);
          toast.success(initial ? "Batch number updated" : `Saved for ${saved.name}`);
          router.push(`${BATCH_BASE}/${saved._id}`);
          router.refresh();
        } catch (e) {
          if (e instanceof ApiError && e.fieldErrors) helpers.setErrors(e.fieldErrors as never);
          toast.error(e instanceof ApiError ? e.message : "Could not save");
        } finally {
          helpers.setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <FormSurface
          page={{ backHref }}
          onClose={() => router.push(backHref)}
          title={initial ? "Edit Batch Number" : "New Batch Number"}
          subtitle="Batch number on the pack, with the FSSAI licence, company and address that made it"
          icon={<Factory className="w-4 h-4" />}
          footer={
            <>
              <Button variant="outline" onClick={() => router.push(backHref)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} loading={isSubmitting}>
                {initial ? "Save Changes" : "Save"}
              </Button>
            </>
          }
        >
          <Form id={FORM_ID} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 max-w-3xl">
            <BatchCodesField />
            <TextField
              name="fssaiLicNo"
              label="FSSAI Lic. No."
              required
              placeholder="14 digits"
              inputMode="numeric"
              maxLength={14}
              className="[&_input]:font-mono"
            />
            <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
            <TextField
              name="name"
              label="Company Name"
              required
              placeholder="e.g. AKOD Foods Private Limited"
              maxLength={150}
              className="sm:col-span-2"
            />
            <TextAreaField
              name="address"
              label="Address"
              required
              placeholder="Building, street, village / city, state - PIN"
              maxLength={500}
              className="sm:col-span-2"
            />
          </Form>
        </FormSurface>
      )}
    </Formik>
  );
}
