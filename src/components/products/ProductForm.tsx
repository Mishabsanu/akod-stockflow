"use client";

import { Form, Formik } from "formik";
import { FormErrorNotice } from "@/components/forms/FormErrorNotice";
import { Package } from "lucide-react";
import Link from "next/link";
import { FormCard } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { Product } from "@/lib/types";
import { emptyProduct, emptyVariant, productFormSchema, type ProductInput } from "@/lib/validation/product.schema";
import { resourceApi } from "@/services/apiClient";
import { FLAVOR_SUGGESTIONS, ImagesField, InstagramReelsField, Panel, toInitialValues, ToggleField } from "./ProductFormParts";
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
    : {
        ...emptyProduct,
        reorderLevel: defaultReorderLevel ?? emptyProduct.reorderLevel,
        // Prices and stock live on variants: start with one row to fill in
        variants: [{ ...emptyVariant, reorderLevel: defaultReorderLevel ?? emptyVariant.reorderLevel }],
      };

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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                {/* Main column: the product itself */}
                <div className="lg:col-span-2 space-y-4 min-w-0">
                  <Panel title="Basic Information">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                      <TextField
                        name="sku"
                        label="SKU Code"
                        required
                        placeholder="e.g. AKD-CHIPS"
                        hint="Unique"
                        className="[&_input]:font-mono [&_input]:uppercase"
                      />
                      <TextField name="name" label="Product Name" required placeholder="e.g. Sweet Banana Chips" maxLength={150} />
                      <TextAreaField
                        name="summary"
                        label="Short Summary"
                        required
                        rows={2}
                        placeholder="One or two lines shown on product cards"
                        className="sm:col-span-2"
                        maxLength={300}
                      />
                      <TextAreaField
                        name="story"
                        label="Detailed Product Story"
                        rows={4}
                        placeholder="Origin, how it is made, what makes it special"
                        className="sm:col-span-2"
                        maxLength={5000}
                      />
                      <TextAreaField
                        name="ingredients"
                        label="Ingredients"
                        rows={2}
                        placeholder="e.g. Raw banana, coconut oil, salt"
                        className="sm:col-span-2"
                        maxLength={2000}
                      />
                    </div>
                  </Panel>

                  <Panel
                    title={`Variants (${values.variants?.length ?? 0})`}
                    description="Prices and stock are set per variant — one row per packet weight / size."
                  >
                    <VariantsEditor stockById={stockById} />
                  </Panel>

                  <section className="rounded-xl border border-line bg-white p-4">
                    <ImagesField />
                  </section>
                </div>

                {/* Side column: settings */}
                <div className="space-y-4 min-w-0">
                  <Panel title="Organize">
                    <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
                    <SelectField
                      name="category"
                      label="Category"
                      options={categoryOptions}
                      placeholder="No category"
                      hint={categoryOptions.length === 0 ? "Add under Categories" : undefined}
                    />
                    <TextField
                      name="flavorProfile"
                      label="Flavor Profile"
                      placeholder="e.g. Traditional"
                      hint="Storefront chips filter"
                      list={FLAVOR_LIST_ID}
                      autoComplete="off"
                      maxLength={60}
                    />
                    <datalist id={FLAVOR_LIST_ID}>
                      {[...new Set([...flavors, ...FLAVOR_SUGGESTIONS])].map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                    <p className="text-[11px] text-slate-500">
                      Manage categories under{" "}
                      <Link href="/dashboard/products/categories" className="font-semibold text-brand hover:underline">
                        Products → Categories
                      </Link>
                    </p>
                  </Panel>

                  <Panel title="Storefront">
                    <ToggleField name="storefrontVisible" label="Visible on Storefront" hint="Untick to hide it from the online store" />
                    <ToggleField name="freeDelivery" label="Free Delivery" hint="Applies to all its variants" />
                  </Panel>

                  <Panel title="Shelf Life & Dates">
                    <TextField name="shelfLife" label="Shelf Life" placeholder="e.g. 6 months" maxLength={60} />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField name="mfgDate" label="Mfg Date" type="date" />
                      <TextField name="expiryDate" label="Expiry Date" type="date" />
                    </div>
                  </Panel>

                  <Panel title="Instagram Reel Showcase" description="Links to reels that show this product.">
                    <InstagramReelsField />
                  </Panel>
                </div>
              </div>
            </FormCard>
          </Form>
        );
      }}
    </Formik>
  );
}
