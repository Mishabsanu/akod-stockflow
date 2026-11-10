"use client";

import { useSyncExternalStore } from "react";

/**
 * Counts photo uploads still running in the background, so a form can wait for them
 * before saving (otherwise a photo that is still uploading would be left off the record).
 */
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function trackUpload<T>(promise: Promise<T>): Promise<T> {
  pending += 1;
  emit();
  return promise.finally(() => {
    pending -= 1;
    emit();
  });
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
