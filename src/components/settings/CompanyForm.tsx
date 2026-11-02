"use client";

import { Form, Formik } from "formik";
import { Building2 } from "lucide-react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { TextAreaField, TextField } from "@/components/forms/FormikFields";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { companySettingSchema, type CompanySettingInput, type CompanySettings } from "@/lib/validation/setting.schema";
import { apiRequest } from "@/services/apiClient";

export function CompanyForm({ initial }: { initial: CompanySettings }) {
  const initialValues: CompanySettingInput = {
    companyName: initial.companyName,
    address: initial.address ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    gstin: initial.gstin ?? "",
    defaultReorderLevel: initial.defaultReorderLevel,
  };

  const onSubmit = useApiSubmit<CompanySettingInput, CompanySettings>({
    request: (values) => apiRequest<CompanySettings>("/api/settings/company", "PUT", values),
    successMessage: "Company settings saved",
  });

  return (
    <Formik initialValues={initialValues} validationSchema={companySettingSchema} onSubmit={onSubmit} enableReinitialize>
      {({ isSubmitting }) => (
        <Form noValidate>
          <FormCard
            title="Company Settings"
            description="Printed at the top of orders. Currency is Indian Rupees (₹)."
            icon={<Building2 className="w-4.5 h-4.5" />}
            submitLabel="Save Settings"
            submitting={isSubmitting}
            backHref="/dashboard/overview"
          >
            <FormSection title="Company">
              <TextField name="companyName" label="Company Name" required maxLength={120} />
              <TextField name="gstin" label="GSTIN" placeholder="29ABCDE1234F1Z5" />
              <TextField name="phone" label="Phone" placeholder="+91 98765 43210" />
              <TextField name="email" label="Email" type="email" />
              <TextAreaField name="address" label="Address" rows={3} />
            </FormSection>
            <FormSection title="Inventory defaults">
              <TextField
                name="defaultReorderLevel"
                label="Default low-stock level"
                type="number"
                min={0}
                hint="Given to new products; each product can override it"
              />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}
