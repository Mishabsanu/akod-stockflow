"use client";

import { Form, Formik } from "formik";
import { FormErrorNotice } from "@/components/forms/FormErrorNotice";
import { Package } from "lucide-react";
import Link from "next/link";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";
import { emptyProduct, productFormSchema, type ProductInput } from "@/lib/validation/product.schema";
import { resourceApi } from "@/services/apiClient";
import { FLAVOR_SUGGESTIONS, ImagesField, InstagramReelsField, toInitialValues, ToggleField } from "./ProductFormParts";
import { PRODUCT_UI } from "./productConfig";
import { pendingUploads, usePendingUploads } from "./uploadTracker";
import { VariantsEditor } from "./VariantsEditor";
import { toast } from "sonner";

interface ProductFormProps {
  initial?: Product;
  /** Active categories (Products → Categories) */
  categories: string[];
  /** Company setting: reorder level for new products */
  defaultReorderLevel?: number;
  /** Flavor profiles already used, offered as suggestions */
  flavors?: string[];
}

const FLAVOR_LIST_ID = "flavor-profile-suggestions";

export function ProductForm({ initial, categories, defaultReorderLevel, flavors = [] }: ProductFormProps) {
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

  const uploads = usePendingUploads();
  const save = useApiSubmit<ProductInput, Product>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: isEdit ? "Product updated" : "Product created",
    redirectTo: (p) => `${PRODUCT_UI.basePath}/${p._id}`,
  });
  // Photos upload in the background: save only once they are all in
  const onSubmit: typeof save = async (values, helpers) => {
    if (pendingUploads() > 0) {
      toast.info("Photos are still uploading — save again in a moment");
      helpers.setSubmitting(false);
      return;
    }
    return save(values, helpers);
  };

  return (
    <Formik initialValues={initialValues} validationSchema={productFormSchema} onSubmit={onSubmit}>
      {({ isSubmitting, values }) => {
        const hasVariants = (values.variants?.length ?? 0) > 0;
        const margin = Number(values.sellingPrice) - Number(values.costPrice);
        const marginPct = Number(values.sellingPrice) > 0 ? (margin / Number(values.sellingPrice)) * 100 : 0;
        return (
          <Form noValidate>
            <FormErrorNotice />
            <FormCard
              title={isEdit ? "Edit Product" : "Create New Product"}
              description={PRODUCT_UI.description}
              badge={initial ? initial.sku : "New Record"}
              icon={<Package className="w-4.5 h-4.5" />}
              backHref={initial ? `${PRODUCT_UI.basePath}/${initial._id}` : PRODUCT_UI.basePath}
              submitLabel="Save Product"
              submitting={isSubmitting || uploads > 0}
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
                <TextField
                  name="flavorProfile"
                  label="Flavor Profile"
                  placeholder="e.g. Traditional"
                  hint="Used for storefront chips filter"
                  list={FLAVOR_LIST_ID}
                  autoComplete="off"
                  maxLength={60}
                />
                <datalist id={FLAVOR_LIST_ID}>
                  {[...new Set([...flavors, ...FLAVOR_SUGGESTIONS])].map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
                <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
                <ToggleField name="storefrontVisible" label="Visible on Storefront" hint="Untick to hide it from the online store" />
                <ToggleField name="freeDelivery" label="Free Delivery" hint="Shown on the product list; applies to all its variants" />
                <TextAreaField
                  name="summary"
                  label="Short Summary"
                  required
                  rows={2}
                  placeholder="One or two lines shown on product cards"
                  className="md:col-span-2 lg:col-span-3"
                  maxLength={300}
                />
                <TextAreaField
                  name="story"
                  label="Detailed Product Story"
                  rows={4}
                  placeholder="Origin, how it is made, what makes it special"
                  className="md:col-span-2 lg:col-span-3"
                  maxLength={5000}
                />
                <TextAreaField
                  name="ingredients"
                  label="Ingredients"
                  rows={2}
                  placeholder="e.g. Raw banana, coconut oil, salt"
                  className="md:col-span-2 lg:col-span-3"
                  maxLength={2000}
                />
                <p className="md:col-span-2 lg:col-span-3 -mt-2 text-[11px] text-slate-500">
                  Manage the category list under{" "}
                  <Link href="/dashboard/products/categories" className="font-semibold text-brand hover:underline">
                    Products → Categories
                  </Link>
                  .
                </p>
              </FormSection>

              <FormSection title="Shelf Life & Dates">
                <TextField name="shelfLife" label="Shelf Life" placeholder="e.g. 6 months" maxLength={60} />
                <TextField name="mfgDate" label="Mfg Date" type="date" />
                <TextField name="expiryDate" label="Expiry Date" type="date" />
              </FormSection>

              <FormSection title="Photos">
                <ImagesField />
              </FormSection>

              <FormSection title="Instagram Reel Showcase" description="Links to reels that show this product.">
                <InstagramReelsField />
              </FormSection>

              <FormSection
                title={`Variants${hasVariants ? ` (${values.variants?.length})` : ""}`}
                description="One row per packet weight / size. Stock, prices and orders are kept per variant."
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
