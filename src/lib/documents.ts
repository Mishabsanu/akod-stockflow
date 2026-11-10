import * as Yup from "yup";

/** A file stored on Cloudinary and attached to a record (running orders, delivery / return notes). */
export interface AttachedDocument {
  url: string;
  publicId: string;
  /** Cloudinary resource type, needed to delete the file again */
  resourceType: string;
  name: string;
  size: number;
  uploadedAt?: string;
  /** Optional expiry (YYYY-MM-DD), e.g. a worker's visa or contract; drives an expiry reminder */
  expiryDate?: string | null;
}

export const MAX_DOCUMENTS = 20;
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";
export const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** Cloudinary folders the upload API accepts. */
export const DOCUMENT_FOLDERS = [
  "running_orders",
  "delivery_notes",
  "return_notes",
  "workers",
  "cheques",
  "leads",
  "quotes",
  "expenses",
  "payments",
  "leaves",
  "productions",
  "stock",
  "products",
  "product_variants",
  "checkups",
  "audits",
] as const;
export type DocumentFolder = (typeof DOCUMENT_FOLDERS)[number];

const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\//;

/** One uploaded file (also used on its own for single-file slots, e.g. a worker's photo). */
export const documentItem = Yup.object({
  url: Yup.string().required().matches(CLOUDINARY_URL, "Document URL is invalid"),
  publicId: Yup.string().trim().required().max(300),
  resourceType: Yup.string()
    .default("image")
    .test("resource-type", "Document type is invalid", (v) => !v || ["image", "raw", "video"].includes(v)),
  name: Yup.string().trim().max(200).default("Document"),
  size: Yup.number().min(0).default(0),
  uploadedAt: Yup.string().optional(),
  expiryDate: Yup.string()
    .nullable()
    .optional()
    .transform((v) => (v ? String(v).slice(0, 10) : null))
    .test("day", "Expiry must be a valid date", (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)))),
});

export const documentsField = Yup.array()
  .of(documentItem)
  .max(MAX_DOCUMENTS, `At most ${MAX_DOCUMENTS} documents`)
  .default([]);

export const documentsSchema = Yup.object({ documents: documentsField });

export function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|heic)$/i;

/** True for photos (shown as thumbnails); PDFs and Office files are also stored as Cloudinary "image"/"raw", so the URL decides. */
export function isImageDocument(doc: Pick<AttachedDocument, "url" | "resourceType">): boolean {
  if (doc.resourceType && doc.resourceType !== "image") return false;
  const path = doc.url.split(/[?#]/)[0];
  return IMAGE_EXTENSION.test(path);
}
