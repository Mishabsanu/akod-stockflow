"use client";

import { Form, Formik } from "formik";
import { Package } from "lucide-react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";
import { emptyProduct, productSchema, type ProductInput } from "@/lib/validation/product.schema";
import { resourceApi } from "@/services/apiClient";
import { PRODUCT_UI } from "./productConfig";

const CATEGORY_LIST_ID = "product-category-suggestions";

interface ProductFormProps {
  initial?: Product;
  /** Existing categories, offered as suggestions so spelling stays consistent. */
  categories: string[];
  /** Company setting: reorder level for new products */
  defaultReorderLevel?: number;
}

export function ProductForm({ initial, categories, defaultReorderLevel }: ProductFormProps) {
  const api = resourceApi<Product>(PRODUCT_UI.apiBase);
  const isEdit = Boolean(initial);

  const initialValues: ProductInput = initial
    ? {
        sku: initial.sku,
        name: initial.name,
        barcode: initial.barcode || "",
        category: initial.category || "",
        description: initial.description || "",
        sellingPrice: initial.sellingPrice,
        costPrice: initial.costPrice,
        reorderLevel: initial.reorderLevel,
        status: initial.status,
      }
    : { ...emptyProduct, reorderLevel: defaultReorderLevel ?? emptyProduct.reorderLevel };

  const onSubmit = useApiSubmit<ProductInput, Product>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: isEdit ? "Product updated" : "Product created",
    redirectTo: (p) => `${PRODUCT_UI.basePath}/${p._id}`,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={productSchema} onSubmit={onSubmit}>
      {({ isSubmitting, values }) => {
        const margin = Number(values.sellingPrice) - Number(values.costPrice);
        const marginPct = Number(values.sellingPrice) > 0 ? (margin / Number(values.sellingPrice)) * 100 : 0;
        return (
          <Form noValidate>
            <FormCard
              title={isEdit ? "Edit Product" : "Create New Product"}
              description={PRODUCT_UI.description}
              badge={initial ? initial.sku : "New Record"}
              icon={<Package className="w-4.5 h-4.5" />}
              backHref={initial ? `${PRODUCT_UI.basePath}/${initial._id}` : PRODUCT_UI.basePath}
              submitLabel="Save Product"
              submitting={isSubmitting}
            >
              <FormSection title="Product Details">
                <TextField
                  name="sku"
                  label="SKU Code"
                  required
                  placeholder="e.g. AKD-CHIPS-100G"
                  hint="Unique, saved in capitals"
                  className="[&_input]:font-mono [&_input]:uppercase"
                />
                <TextField name="name" label="Product Name" required placeholder="e.g. Classic Salted Chips 100 g" maxLength={150} />
                <TextField name="barcode" label="Barcode" placeholder="Optional (EAN / UPC)" inputMode="numeric" />
                <TextField name="category" label="Category" placeholder="e.g. Chips" list={CATEGORY_LIST_ID} autoComplete="off" />
                <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
                <datalist id={CATEGORY_LIST_ID}>
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <TextAreaField
                  name="description"
                  label="Description"
                  placeholder="Short description (optional)"
                  className="md:col-span-2 lg:col-span-3"
                  maxLength={1000}
                />
              </FormSection>

              <FormSection
                title="Pricing (₹)"
                description="Selling price is the default on orders; marketplaces can have their own price under Channels."
              >
                <TextField name="sellingPrice" label="Selling Price (₹)" type="number" min={0} step="0.01" inputMode="decimal" />
                <TextField
                  name="costPrice"
                  label="Cost Price (₹)"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  hint={Number(values.sellingPrice) > 0 ? `Margin ${formatCurrency(margin)} (${marginPct.toFixed(1)}%)` : undefined}
                />
              </FormSection>

              <FormSection title="Stock Alert" description="Low-stock alert appears when available stock is at or below this level.">
                <TextField name="reorderLevel" label="Reorder Level" type="number" min={0} step={1} inputMode="numeric" />
              </FormSection>
            </FormCard>
          </Form>
        );
      }}
    </Formik>
  );
}
