import { isValidObjectId } from "mongoose";
import * as Yup from "yup";
import { documentItem } from "@/lib/documents";
import { MAX_PRODUCT_IMAGES } from "@/lib/validation/product.schema";
import { AppError, notFound } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { Product } from "@/server/models/Product";

const schema = Yup.object({ images: Yup.array(documentItem).min(1).max(MAX_PRODUCT_IMAGES).required() });

/**
 * POST { images }: appends photos that finished uploading after the product was saved
 * (background uploads). Skips photos already on the product; keeps at most MAX_PRODUCT_IMAGES.
 */
export const POST = apiHandler<{ id: string }>({ module: "product", action: "update" }, async ({ req, params }) => {
  const { images } = await readBody(req, schema);
  if (!isValidObjectId(params.id)) throw notFound("Product");
  const product = await Product.findById(params.id).select("images").lean();
  if (!product) throw notFound("Product");

  const have = new Set((product.images ?? []).map((i) => i.publicId));
  const add = images
    .filter((i) => !have.has(i.publicId))
    .map((i) => ({ url: i.url, publicId: i.publicId, resourceType: i.resourceType || "image", name: i.name || "", size: i.size || 0 }));
  const room = MAX_PRODUCT_IMAGES - have.size;
  if (add.length && room <= 0) throw new AppError(`This product already has ${MAX_PRODUCT_IMAGES} photos`, 422);

  const toAdd = add.slice(0, Math.max(0, room));
  if (toAdd.length) await Product.updateOne({ _id: params.id }, { $push: { images: { $each: toAdd } } });
  return { added: toAdd.length };
});
