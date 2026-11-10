"use client";

import { Form, Formik } from "formik";
import { Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Category } from "@/lib/commerceTypes";
import { categorySchema, emptyCategory, type CategoryInput } from "@/lib/validation/category.schema";
import { ApiError, resourceApi } from "@/services/apiClient";

const api = resourceApi<Category>("/api/categories");

/** Create / edit a category. `category` = null → closed; "new" → create. */
export function CategoryFormModal({ category, onClose }: { category: Category | "new" | null; onClose: () => void }) {
  const router = useRouter();
  if (!category) return null;
  const editing = category !== "new" ? category : null;
  const initial: CategoryInput = editing
    ? { name: editing.name, description: editing.description ?? "", status: editing.status }
    : emptyCategory;

  return (
    <Formik
      initialValues={initial}
      validationSchema={categorySchema}
      onSubmit={async (values, helpers) => {
        try {
          const saved = editing ? await api.update(editing._id, values) : await api.create(values);
          toast.success(editing ? "Category updated" : `${saved.name} created`);
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
          title={editing ? "Edit Category" : "New Category"}
          subtitle={
            editing && (editing.productCount ?? 0) > 0
              ? `Renaming also renames it on its ${editing.productCount} product(s)`
              : "Group products, e.g. Chips, Snacks, Sweets"
          }
          icon={<Tags className="w-4 h-4" />}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submitForm} loading={isSubmitting}>
                {editing ? "Save Changes" : "Create Category"}
              </Button>
            </>
          }
        >
          <Form noValidate className="grid grid-cols-1 gap-3">
            <TextField name="name" label="Category Name" required placeholder="e.g. Chips" autoFocus maxLength={80} />
            <TextAreaField name="description" label="Description" placeholder="Optional" maxLength={500} />
            <SelectField
              name="status"
              label="Status"
              required
              options={STATUS_OPTIONS}
              hint="Inactive categories are hidden on new products"
            />
          </Form>
        </Modal>
      )}
    </Formik>
  );
}
