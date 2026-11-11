import { isValidObjectId } from "mongoose";
import * as Yup from "yup";
import { documentItem } from "@/lib/documents";
import { notFound } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { Category } from "@/server/models/Category";
import { destroyRemoved } from "@/server/services/upload.service";

const schema = Yup.object({ image: documentItem.required() });

/** PUT { image }: sets the category photo once a background upload finishes (replaces the old one). */
export const PUT = apiHandler<{ id: string }>({ module: "category", action: "update" }, async ({ req, params }) => {
  const { image } = await readBody(req, schema);
  if (!isValidObjectId(params.id)) throw notFound("Category");
  const current = await Category.findById(params.id).select("image").lean();
  if (!current) throw notFound("Category");
  const next = { url: image.url, publicId: image.publicId, resourceType: image.resourceType || "image", name: image.name || "", size: image.size || 0 };
  await Category.updateOne({ _id: params.id }, { $set: { image: next } });
  if (current.image) await destroyRemoved([current.image], [next]);
  return { image: next };
});
