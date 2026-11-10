import "server-only";
import { createHash } from "node:crypto";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, type AttachedDocument, type DocumentFolder } from "@/lib/documents";
import { AppError } from "../http/errors";

function config() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) throw new AppError("File storage is not configured", 500);
  return { cloud, key, secret };
}

/** Cloudinary signature: sorted `k=v` pairs joined by `&`, followed by the API secret, SHA-1. */
function sign(params: Record<string, string>, secret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(payload + secret).digest("hex");
}

/** Uploads one file to Cloudinary (signed REST upload, no SDK). */
export async function uploadDocument(file: File, folder: DocumentFolder): Promise<AttachedDocument> {
  if (!DOCUMENT_TYPES.includes(file.type)) throw new AppError(`${file.name}: only PDF, image, Word or Excel files are allowed`, 422);
  if (file.size > MAX_DOCUMENT_BYTES) throw new AppError(`${file.name} is larger than 10 MB`, 422);

  const { cloud, key, secret } = config();
  // Root folder for this app on Cloudinary (CLOUDINARY_FOLDER, default "akod-eco"), e.g. akod-eco/products
  const root = (process.env.CLOUDINARY_FOLDER || "akod-eco").replace(/^\/+|\/+$/g, "");
  const params = { folder: `${root}/${folder}`, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", key);
  Object.entries(params).forEach(([k, v]) => form.append(k, v));
  form.append("signature", sign(params, secret));

  // A network failure (DNS, reset, timeout) is reported like a rejected upload, not as a generic 500
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, { method: "POST", body: form }).catch(
    (error: unknown) => {
      console.error("[upload] Cloudinary request failed:", error);
      throw new AppError(`Upload failed for ${file.name}: file storage could not be reached. Please try again.`, 502);
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    secure_url?: string;
    public_id?: string;
    resource_type?: string;
    bytes?: number;
    error?: { message?: string };
  };
  if (!res.ok || !data.secure_url || !data.public_id) {
    throw new AppError(`Upload failed for ${file.name}${data.error?.message ? `: ${data.error.message}` : ""}`, 502);
  }
  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type || "image",
    name: file.name.slice(0, 200),
    size: data.bytes ?? file.size,
    uploadedAt: new Date().toISOString(),
  };
}

/** Best-effort delete; a failure only leaves an orphan file on Cloudinary. */
export async function destroyDocuments(docs: Pick<AttachedDocument, "publicId" | "resourceType">[]) {
  if (docs.length === 0) return;
  const { cloud, key, secret } = config();
  await Promise.allSettled(
    docs.map((d) => {
      const params = { public_id: d.publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
      const form = new FormData();
      form.append("api_key", key);
      Object.entries(params).forEach(([k, v]) => form.append(k, v));
      form.append("signature", sign(params, secret));
      return fetch(`https://api.cloudinary.com/v1_1/${cloud}/${d.resourceType || "image"}/destroy`, { method: "POST", body: form });
    })
  );
}

/** Deletes the files that were on the record before but are not in the new list. */
export async function destroyRemoved(before: { publicId: string; resourceType: string }[] = [], after: { publicId: string }[] = []) {
  const keep = new Set(after.map((d) => d.publicId));
  await destroyDocuments(before.filter((d) => !keep.has(d.publicId)));
}
