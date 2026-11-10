import * as Yup from "yup";
import { documentItem } from "../documents";
import { optionalText, requiredText, statusField } from "./common";

export const categorySchema = Yup.object({
  name: requiredText("Category name", 80),
  description: optionalText("Description", 500),
  status: statusField,
  /** Optional photo (Cloudinary <CLOUDINARY_FOLDER>/categories) */
  image: documentItem.nullable().optional().default(null),
});

export type CategoryInput = Yup.InferType<typeof categorySchema>;

export const emptyCategory: CategoryInput = { name: "", description: "", status: "active", image: null };
