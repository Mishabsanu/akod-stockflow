"use client";

import { Form, Formik } from "formik";
import { Factory } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Manufacturer } from "@/lib/batchCodeTypes";
import { emptyManufacturer, manufacturerSchema, type ManufacturerInput } from "@/lib/validation/manufacturer.schema";
import { ApiError, resourceApi } from "@/services/apiClient";
import { BatchCodesField } from "./BatchCodesField";

const api = resourceApi<Manufacturer>("/api/manufacturers");

/** Create / edit a manufacturing unit. `manufacturer` = null → closed; "new" → create. */
export function ManufacturerFormModal({ manufacturer, onClose }: { manufacturer: Manufacturer | "new" | null; onClose: () => void }) {
  const router = useRouter();
  if (!manufacturer) return null;
  const editing = manufacturer !== "new" ? manufacturer : null;
  const initial: ManufacturerInput = editing
    ? {
        name: editing.name,
        address: editing.address,
        fssaiLicNo: editing.fssaiLicNo,
        batchCodes: editing.batchCodes,
        phone: editing.phone ?? "",
        notes: editing.notes ?? "",
        status: editing.status,
      }
    : emptyManufacturer;

  return (
    <Formik
      initialValues={initial}
      validationSchema={manufacturerSchema}
      onSubmit={async (values, helpers) => {
        try {
          const saved = editing ? await api.update(editing._id, values) : await api.create(values);
          toast.success(editing ? "Manufacturer updated" : `${saved.name} added`);
          onClose();
          router.refresh();
        } catch (e) {
          if (e instanceof ApiError && e.fieldErrors) helpers.setErrors(e.fieldErrors as never);
          toast.error(e instanceof ApiError ? e.message : "Could not save");
        } finally {
          helpers.setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting, submitForm }) => (
        <Modal
          open
          onClose={onClose}
          title={editing ? "Edit Manufacturer" : "New Manufacturer"}
          subtitle="The unit that made the pack, and the batch codes printed on its packs"
          icon={<Factory className="w-4 h-4" />}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submitForm} loading={isSubmitting}>
                {editing ? "Save Changes" : "Add Manufacturer"}
              </Button>
            </>
          }
        >
          <Form noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              name="name"
              label="Manufacturer Name"
              required
              placeholder="e.g. AKOD Foods Private Limited"
              autoFocus
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
            <TextField
              name="fssaiLicNo"
              label="FSSAI Lic. No."
              required
              placeholder="14 digits"
              inputMode="numeric"
              maxLength={14}
              className="[&_input]:font-mono"
            />
            <TextField name="phone" label="Phone" placeholder="Optional" inputMode="tel" />
            <BatchCodesField />
            <TextAreaField name="notes" label="Notes" placeholder="Optional, staff only" rows={2} className="sm:col-span-2" />
            <SelectField name="status" label="Status" required options={STATUS_OPTIONS} hint="Inactive = not found in lookup" />
          </Form>
        </Modal>
      )}
    </Formik>
  );
}
