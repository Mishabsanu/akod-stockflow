import { Schema } from "mongoose";

export interface DocumentDoc {
  url: string;
  publicId: string;
  resourceType: string;
  name: string;
  size: number;
  uploadedAt: Date;
  /** Optional YYYY-MM-DD expiry (worker "other documents") */
  expiryDate?: string | null;
}

/** Uploaded file (Cloudinary). Named `documents` because legacy AKOD notes use `attachments` differently. */
export const DocumentSchema = new Schema<DocumentDoc>(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    resourceType: { type: String, default: "image" },
    name: { type: String, trim: true, default: "Document" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    expiryDate: { type: String, default: null },
  },
  { _id: false }
);

export const documentsField = { type: [DocumentSchema], default: [] };

/** One file in its own slot (e.g. the customer-signed delivery note, AKOD `attachments.signedTicket`). */
export const singleDocumentField = { type: DocumentSchema, default: null };
