"use client";

import { Form, Formik, useField } from "formik";
import { Package } from "lucide-react";
import Link from "next/link";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { ProductImage } from "@/lib/commerceTypes";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";
import { emptyProduct, MAX_PRODUCT_IMAGES, productSchema, type ProductInput } from "@/lib/validation/product.schema";
import { resourceApi } from "@/services/apiClient";
import { ProductImageGallery } from "./ProductImages";
import { PRODUCT_UI } from "./productConfig";
import { VariantsEditor } from "./VariantsEditor";

interface ProductFormProps {
  initial?: Product;
  /** Active categories (Products → Categories) */
  categories: string[];
  /** Company setting: reorder level for new products */
  defaultReorderLevel?: number;
}

/** Free delivery toggle (variants follow the product). */
function FreeDeliveryField() {
  const [field, , helpers] = useField<boolean>("freeDelivery");
  return (
    <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-line bg-slate-50/60 cursor-pointer self-end">
      <input
        type="checkbox"
        checked={Boolean(field.value)}
        onChange={(e) => void helpers.setValue(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-brand"
      />
      <span>
        <span className="block text-[12px] font-semibold text-slate-700">Free Delivery</span>
        <span className="block text-[11px] text-slate-500">Shown on the product list; applies to all its variants</span>
      </span>
    </label>
  );
}

function ImagesField() {
  const [field, , helpers] = useField<ProductImage[]>("images");
  return <ProductImageGallery images={field.value ?? []} onChange={(next) => void helpers.setValue(next)} max={MAX_PRODUCT_IMAGES} />;
}

function toInitialValues(initial: Product): ProductInput {
  return {
    sku: initial.sku,
    name: initial.name,
    barcode: initial.barcode || "",
    category: initial.category || "",
    description: initial.description || "",
    mrp: initial.mrp ?? 0,
    sellingPrice: initial.sellingPrice,
    costPrice: initial.costPrice,
    reorderLevel: initial.reorderLevel,
    status: initial.status,
    freeDelivery: Boolean(initial.freeDelivery),
    images: initial.images ?? [],
    variants: (initial.variants ?? []).map((v) => ({
      _id: v._id,
      variantName: v.variantName || "",
      sku: v.sku,
      barcode: v.barcode || "",
      mrp: v.mrp ?? 0,
      sellingPrice: v.sellingPrice,
      costPrice: v.costPrice,
      reorderLevel: v.reorderLevel,
      status: v.status,
      image: v.images?.[0] ?? null,
    })),
  };
}

export function ProductForm({ initial, categories, defaultReorderLevel }: ProductFormProps) {
  const api = resourceApi<Product>(PRODUCT_UI.apiBase);
  const isEdit = Boolean(initial);

  const initialValues: ProductInput = initial
    ? toInitialValues(initial)
    : { ...emptyProduct, reorderLevel: defaultReorderLevel ?? emptyProduct.reorderLevel };

  // An inactive or renamed category stays selectable on the product that already has it
  const categoryOptions = [...new Set([...categories, ...(initial?.category ? [initial.category] : [])])]
    .sort((a, b) => a.localeCompare(b))
    .map((c) => ({ label: c, value: c }));
  const stockById = Object.fromEntries((initial?.variants ?? []).map((v) => [v._id, v.stock ?? 0]));

  const onSubmit = useApiSubmit<ProductInput, Product>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: isEdit ? "Product updated" : "Product created",
    redirectTo: (p) => `${PRODUCT_UI.basePath}/${p._id}`,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={productSchema} onSubmit={onSubmit}>
      {({ isSubmitting, values }) => {
        const hasVariants = (values.variants?.length ?? 0) > 0;
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
                  placeholder="e.g. AKD-CHIPS"
                  hint="Unique, saved in capitals"
                  className="[&_input]:font-mono [&_input]:uppercase"
                />
                <TextField name="name" label="Product Name" required placeholder="e.g. Classic Salted Chips" maxLength={150} />
                <SelectField
                  name="category"
                  label="Category"
                  options={categoryOptions}
                  placeholder="No category"
                  hint={categoryOptions.length === 0 ? "No categories yet — add them under Products → Categories" : undefined}
                />
                {!hasVariants && <TextField name="barcode" label="Barcode" placeholder="Optional (EAN / UPC)" inputMode="numeric" />}
                <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
                <FreeDeliveryField />
                <TextAreaField
                  name="description"
                  label="Description"
                  placeholder="Short description (optional)"
                  className="md:col-span-2 lg:col-span-3"
                  maxLength={1000}
                />
                <p className="md:col-span-2 lg:col-span-3 -mt-2 text-[11px] text-slate-500">
                  Manage the category list under{" "}
                  <Link href="/dashboard/products/categories" className="font-semibold text-brand hover:underline">
                    Products → Categories
                  </Link>
                  .
                </p>
              </FormSection>

              <FormSection title="Photos">
                <ImagesField />
              </FormSection>

              <FormSection
                title={`Variants${hasVariants ? ` (${values.variants?.length})` : ""}`}
                description="Sizes, packs or flavours. With variants, stock, prices and orders are kept per variant."
              >
                <VariantsEditor stockById={stockById} />
              </FormSection>

              {!hasVariants && (
                <>
                  <FormSection
                    title="Pricing (₹)"
                    description="Selling price is the default on orders; marketplaces can have their own price under Channels."
                  >
                    <TextField name="mrp" label="MRP (₹)" type="number" min={0} step="0.01" inputMode="decimal" hint="Printed on the pack" />
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
                </>
              )}
            </FormCard>
          </Form>
        );
      }}
    </Formik>
  );
}
