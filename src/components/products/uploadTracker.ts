"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

/**
 * Photo uploads running in the background.
 * - Every upload is counted (for the "uploading…" hints) and, when it belongs to a form field,
 *   registered under a scope ("product-images", "category-image").
 * - Forms save straight away; `finishInBackground` then waits for that scope's uploads still
 *   running and attaches the results to the saved record, even after the user has left the page.
 */
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export type UploadScope = "product-images" | "category-image";
const scoped = new Map<UploadScope, Set<Promise<unknown>>>();

export function trackUpload<T>(promise: Promise<T>, scope?: UploadScope): Promise<T> {
  pending += 1;
  if (scope) {
    if (!scoped.has(scope)) scoped.set(scope, new Set());
    scoped.get(scope)!.add(promise);
  }
  emit();
  return promise.finally(() => {
    pending -= 1;
    if (scope) scoped.get(scope)?.delete(promise);
    emit();
  });
}

/** Uploads of a scope that are still running right now. */
export function runningUploads<T>(scope: UploadScope): Promise<T>[] {
  return [...(scoped.get(scope) ?? [])] as Promise<T>[];
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Uploads in progress right now (for submit handlers). */
export const pendingUploads = () => pending;

/** Number of uploads in progress (0 on the server). */
export function usePendingUploads(): number {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => 0
  );
}

// ---- Background attach jobs ----
let jobs = 0;
const warnOnLeave = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = "";
};

/**
 * Waits for `uploads` (started before the save), then hands the finished files to `attach`.
 * Shows one progress toast; failures are reported, successes are saved to the record.
 * Closing the tab while it runs asks for confirmation (navigating inside the app is fine).
 */
export async function finishInBackground<T>(
  uploads: Promise<T>[],
  attach: (done: T[]) => Promise<void>,
  label: { what: string; record: string; onDone?: () => void }
) {
  if (uploads.length === 0) return;
  if (++jobs === 1) window.addEventListener("beforeunload", warnOnLeave);
  const id = toast.loading(`Uploading ${uploads.length} ${label.what} for ${label.record} in the background…`);
  try {
    const results = await Promise.allSettled(uploads);
    const done = results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
    const failed = results.length - done.length;
    if (done.length) await attach(done);
    if (failed) {
      toast.error(`${done.length} ${label.what} added to ${label.record}; ${failed} failed — open the record to upload them again`, { id });
    } else {
      toast.success(`${done.length} ${label.what} added to ${label.record}`, { id });
    }
    label.onDone?.();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : `Could not add ${label.what} to ${label.record}`, { id });
  } finally {
    if (--jobs === 0) window.removeEventListener("beforeunload", warnOnLeave);
  }
}
