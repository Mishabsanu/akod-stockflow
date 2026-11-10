"use client";

import { ChevronLeft, ChevronRight, ImageIcon, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFiles } from "@/components/documents/DocumentList";
import { Button } from "@/components/ui/Button";
import type { ProductImage } from "@/lib/commerceTypes";
import { IMAGE_ACCEPT, MAX_DOCUMENT_BYTES } from "@/lib/documents";
import { trackUpload } from "./uploadTracker";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ImageFolder = "products" | "product_variants" | "categories";

/** Square photo; falls back to an icon when there is none. */
export function ProductThumb({ image, size = 32, className = "" }: { image?: ProductImage | null; size?: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center shrink-0 rounded-md border border-line bg-slate-50 overflow-hidden ${className}`}
    >
      {image ? (
        // Cloudinary already serves sized, compressed images
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={image.name || ""} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <ImageIcon className="w-1/2 h-1/2 text-slate-300" />
      )}
    </span>
  );
}

/** Checks type / size in the browser so the user gets the message before uploading. */
function pickable(list: FileList | null, room: number): File[] {
  const files = Array.from(list ?? []);
  const bad = files.find((f) => !IMAGE_TYPES.includes(f.type));
  if (bad) {
    toast.error(`${bad.name}: only PNG, JPG or WebP images`);
    return [];
  }
  const big = files.find((f) => f.size > MAX_DOCUMENT_BYTES);
  if (big) {
    toast.error(`${big.name} is larger than 10 MB`);
    return [];
  }
  if (files.length > room) toast.error(`Only ${room} more photo(s) can be added`);
  return files.slice(0, Math.max(0, room));
}

/** Uploads one file to Cloudinary <CLOUDINARY_FOLDER>/<folder>; counted so forms wait for it before saving. */
function uploadOne(file: File, folder: ImageFolder): Promise<ProductImage | null> {
  return trackUpload(
    uploadFiles([file], folder)
      .then(([d]) => (d ? { url: d.url, publicId: d.publicId, resourceType: d.resourceType, name: d.name, size: d.size } : null))
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : `Upload failed for ${file.name}`);
        return null;
      })
  );
}

interface Pending {
  id: string;
  preview: string;
}

/** Local previews of files still uploading (revoked when done). */
function usePending() {
  const [pending, setPending] = useState<Pending[]>([]);
  const add = (file: File): Pending => {
    const p = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, preview: URL.createObjectURL(file) };
    setPending((list) => [...list, p]);
    return p;
  };
  const done = (p: Pending) => {
    URL.revokeObjectURL(p.preview);
    setPending((list) => list.filter((x) => x.id !== p.id));
  };
  return { pending, add, done };
}

const tileBtn = "w-7 h-7 rounded-md bg-white/95 text-slate-700 hover:bg-white flex items-center justify-center shadow disabled:opacity-40";

/**
 * Product photography: several photos, the first is the cover; hover a photo to move or remove it.
 * Photos upload in the background (in parallel) with an instant preview, so the form stays usable.
 */
export function ProductImageGallery({
  images,
  onChange,
  max,
}: {
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
  max: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { pending, add, done } = usePending();
  // Uploads finish one by one: always append to the newest list, not the one from when the file was picked
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);
  const room = max - images.length - pending.length;

  const pick = (list: FileList | null) => {
    const files = pickable(list, room);
    if (input.current) input.current.value = "";
    for (const file of files) {
      const p = add(file);
      void uploadOne(file, "products").then((img) => {
        if (img) {
          latest.current = [...latest.current, img];
          onChange(latest.current);
        }
        done(p);
      });
    }
  };

  const move = (from: number, to: number) => {
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Product Photography</p>
            <p className="text-[11px] text-slate-500">
              Optional · pack shots, close-ups, ingredient highlights · first photo is the cover · up to {max}
              {pending.length > 0 && <span className="text-brand font-semibold"> · uploading {pending.length}…</span>}
            </p>
          </div>
        </div>
        <Button variant="outline" icon={<Upload className="w-4 h-4" />} disabled={room <= 0} onClick={() => input.current?.click()}>
          <span className="hidden sm:inline">Upload Images</span>
        </Button>
      </div>

      <input ref={input} type="file" multiple accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {images.map((img, i) => (
          <li
            key={img.publicId}
            className={`group relative aspect-square rounded-lg overflow-hidden bg-slate-50 border ${
              i === 0 ? "border-2 border-brand" : "border-line"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name || `Photo ${i + 1}`} className="w-full h-full object-contain" />
            {i === 0 && (
              <span className="absolute top-1.5 left-1.5 text-[10px] font-bold uppercase tracking-wider bg-brand text-white px-1.5 py-0.5 rounded">
                Cover
              </span>
            )}
            {/* Always visible on touch screens, on hover elsewhere */}
            <div className="absolute inset-0 bg-slate-900/45 flex flex-col items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition">
              <div className="flex gap-2">
                <button type="button" className={tileBtn} disabled={i === 0} onClick={() => move(i, i - 1)} title="Move left" aria-label="Move left">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className={tileBtn}
                  disabled={i === images.length - 1}
                  onClick={() => move(i, i + 1)}
                  title="Move right"
                  aria-label="Move right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChange(images.filter((_, n) => n !== i))}
                className="w-7 h-7 rounded-md bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center shadow"
                title="Remove photo"
                aria-label="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-50 border border-dashed border-brand-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="Uploading" className="w-full h-full object-contain opacity-60" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/40">
              <Loader2 className="w-5 h-5 text-brand animate-spin" />
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider">Uploading</span>
            </div>
          </li>
        ))}
        {room > 0 && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="w-full aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-brand hover:bg-brand-light/40 text-slate-500 hover:text-brand flex flex-col items-center justify-center gap-1 transition"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs font-semibold text-slate-700">Add Image</span>
              <span className="text-[10px] text-slate-400">PNG, JPG, WebP</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

/** One photo (variant row, category): click to add / replace, bin to remove. Uploads in the background with a preview. */
export function VariantImagePicker({
  image,
  onChange,
  folder = "product_variants",
}: {
  image?: ProductImage | null;
  onChange: (next: ProductImage | null) => void;
  folder?: "product_variants" | "categories";
}) {
  const input = useRef<HTMLInputElement>(null);
  const { pending, add, done } = usePending();
  const current = pending[pending.length - 1];

  const pick = (list: FileList | null) => {
    const [file] = pickable(list, 1);
    if (input.current) input.current.value = "";
    if (!file) return;
    const p = add(file);
    void uploadOne(file, folder).then((img) => {
      if (img) onChange(img);
      done(p);
    });
  };

  return (
    <div className="relative w-14 h-14 shrink-0">
      <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        title={image ? "Replace photo" : "Add photo (optional)"}
        className={`relative w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center transition ${
          image || current ? "border border-line" : "border-2 border-dashed border-slate-300 hover:border-brand text-slate-400 hover:text-brand"
        }`}
      >
        {current ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.preview} alt="Uploading" className="w-full h-full object-cover opacity-60" />
            <Loader2 className="absolute w-4 h-4 text-brand animate-spin" />
          </>
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.name || "Photo"} className="w-full h-full object-cover" />
        ) : (
          <ImagePlus className="w-4 h-4" />
        )}
      </button>
      {image && !current && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Remove photo"
          aria-label="Remove photo"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
