"use client";

import type { AttachedDocument, DocumentFolder } from "@/lib/documents";

/**
 * Browser → Cloudinary uploads.
 * - The server only signs (/api/uploads/sign); files never pass through it, so there is no
 *   request-size limit from the host (Vercel caps bodies at ~4.5 MB).
 * - Photos are shrunk in the browser first (long side ≤ 2400 px), so uploads are fast.
 * - At most 3 uploads run at once; the rest wait in a queue. A failed upload is retried once.
 */

const MAX_SIDE = 2400;
const SHRINK_ABOVE_BYTES = 1.2 * 1024 * 1024;
const CONCURRENCY = 3;
const SIGNATURE_TTL_MS = 30 * 60 * 1000; // Cloudinary accepts a signature for 1 hour

type Signed = { cloudName: string; apiKey: string; params: Record<string, string>; signature: string; at: number };
const signatures = new Map<DocumentFolder, Promise<Signed>>();

async function signature(folder: DocumentFolder, fresh = false): Promise<Signed> {
  const cached = signatures.get(folder);
  if (cached && !fresh) {
    const s = await cached.catch(() => null);
    if (s && Date.now() - s.at < SIGNATURE_TTL_MS) return s;
  }
  const p = (async () => {
    let res: Response;
    try {
      res = await fetch(`/api/uploads/sign?folder=${folder}`, { method: "POST", credentials: "same-origin" });
    } catch {
      throw new Error("Network error. Check your connection and try again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not start the upload");
    return { ...(data as Omit<Signed, "at">), at: Date.now() };
  })();
  signatures.set(folder, p);
  p.catch(() => signatures.delete(folder));
  return p;
}

/** Shrinks big photos (keeps transparency for PNG/WebP). Returns the original when that is already smaller. */
export async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // unreadable here; let Cloudinary decide
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SHRINK_ABOVE_BYTES) {
    bitmap.close();
    return file;
  }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const jpeg = file.type === "image/jpeg";
  const type = jpeg ? "image/jpeg" : "image/webp";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, jpeg ? 0.86 : 0.9));
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + (jpeg ? ".jpg" : ".webp");
  return new File([blob], name, { type, lastModified: file.lastModified });
}

function send(file: File, s: Signed, onProgress?: (fraction: number) => void): Promise<AttachedDocument> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", s.apiKey);
    Object.entries(s.params).forEach(([k, v]) => form.append(k, v));
    form.append("signature", s.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${s.cloudName}/auto/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new Error(`Network error while uploading ${file.name}`));
    xhr.ontimeout = () => reject(new Error(`Upload timed out for ${file.name}`));
    xhr.timeout = 5 * 60 * 1000;
    xhr.onload = () => {
      let data: { secure_url?: string; public_id?: string; resource_type?: string; bytes?: number; error?: { message?: string } } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url && data.public_id) {
        onProgress?.(1);
        resolve({
          url: data.secure_url,
          publicId: data.public_id,
          resourceType: data.resource_type || "image",
          name: file.name.slice(0, 200),
          size: data.bytes ?? file.size,
          uploadedAt: new Date().toISOString(),
        });
      } else {
        const err = new Error(`Upload failed for ${file.name}${data.error?.message ? `: ${data.error.message}` : ""}`);
        (err as Error & { status?: number }).status = xhr.status;
        reject(err);
      }
    };
    xhr.send(form);
  });
}

// ---- Queue: at most CONCURRENCY uploads at once ----
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= CONCURRENCY) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/**
 * Uploads one file straight to Cloudinary (shrinking photos first), retrying once.
 * `onProgress` gets 0…1 once the upload starts (it may first wait in the queue).
 */
export function uploadDirect(
  file: File,
  folder: DocumentFolder,
  opts: { onProgress?: (fraction: number) => void } = {}
): Promise<AttachedDocument> {
  return slot(async () => {
    const small = await shrinkImage(file);
    try {
      return await send(small, await signature(folder), opts.onProgress);
    } catch (first) {
      // A stale / rejected signature gets a fresh one; any other failure is retried once as well
      const status = (first as { status?: number }).status;
      opts.onProgress?.(0);
      return await send(small, await signature(folder, status === 401 || status === 400), opts.onProgress);
    }
  });
}
