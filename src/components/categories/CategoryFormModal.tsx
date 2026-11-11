"use client";

import { Form, Formik, useField } from "formik";
import { FormErrorNotice } from "@/components/forms/FormErrorNotice";
import { Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { VariantImagePicker } from "@/components/products/ProductImages";
import { finishInBackground, runningUploads } from "@/components/products/uploadTracker";
import { apiRequest } from "@/services/apiClient";
import type { Category, ProductImage } from "@/lib/commerceTypes";
import { categorySchema, emptyCategory, type CategoryInput } from "@/lib/validation/category.schema";
import { ApiError, resourceApi } from "@/services/apiClient";

const api = resourceApi<Category>("/api/categories");

/** Optional category photo, uploaded to Cloudinary <CLOUDINARY_FOLDER>/categories. */
function CategoryImageField() {
  const [field, , helpers] = useField<ProductImage | null>("image");
  return (
    <div className="flex items-center gap-3">
      <VariantImagePicker image={field.value} onChange={(next) => void helpers.setValue(next)} folder="categories" />
      <div>
        <p className="text-[12px] font-semibold text-slate-700">Category Image</p>
        <p className="text-[11px] text-slate-500">Optional · PNG, JPG or WebP, max 10 MB · click the box to upload or replace</p>
      </div>
    </div>
  );
}

/** Create / edit a category. `category` = null → closed; "new" → create. */
export function CategoryFormModal({ category, onClose }: { category: Category | "new" | null; onClose: () => void }) {
  const router = useRouter();
  if (!category) return null;
  const editing = category !== "new" ? category : null;
  const initial: CategoryInput = editing
    ? { name: editing.name, description: editing.description ?? "", status: editing.status, image: editing.image ?? null }
    : emptyCategory;

  return (
    <Formik
      initialValues={initial}
      validationSchema={categorySchema}
      onSubmit={async (values, helpers) => {
        // An image still uploading is set on the category once it finishes (saving does not wait)
        const stillUploading = runningUploads<ProductImage>("category-image");
        try {
          const saved = editing ? await api.update(editing._id, values) : await api.create(values);
          toast.success(editing ? "Category updated" : `${saved.name} created`);
          void finishInBackground(
            stillUploading.slice(-1),
            ([image]) => apiRequest(`/api/categories/${saved._id}/image`, "PUT", { image }).then(() => undefined),
            { what: "image", record: saved.name, onDone: () => router.refresh() }
          );
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
            <FormErrorNotice />
            <CategoryImageField />
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
