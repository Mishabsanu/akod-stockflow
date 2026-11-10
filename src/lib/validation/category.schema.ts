import * as Yup from "yup";
import { optionalText, requiredText, statusField } from "./common";

export const categorySchema = Yup.object({
  name: requiredText("Category name", 80),
  description: optionalText("Description", 500),
  status: statusField,
});

export type CategoryInput = Yup.InferType<typeof categorySchema>;

export const emptyCategory: CategoryInput = { name: "", description: "", status: "active" };
