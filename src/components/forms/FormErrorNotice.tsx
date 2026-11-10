"use client";

import { useFormikContext } from "formik";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Counts the leaf messages in Formik's (possibly nested) errors object. */
function countErrors(errors: unknown): number {
  if (!errors) return 0;
  if (typeof errors === "string") return 1;
  if (Array.isArray(errors)) return errors.reduce((n: number, e) => n + countErrors(e), 0);
  if (typeof errors === "object") return Object.values(errors).reduce((n: number, e) => n + countErrors(e), 0);
  return 0;
}

/**
 * When Save is blocked by validation, say so and scroll to the first highlighted field —
 * otherwise an error on a field further down the page looks like "nothing happened".
 */
export function FormErrorNotice() {
  const { submitCount, isValid, errors, isValidating } = useFormikContext();
  const shownFor = useRef(0);

  useEffect(() => {
    if (submitCount === 0 || isValid || isValidating || shownFor.current === submitCount) return;
    shownFor.current = submitCount;
    const n = countErrors(errors);
    toast.error(n > 1 ? `Please fix the ${n} highlighted fields` : "Please fix the highlighted field");
    // Wait for the error styles to render, then bring the first one into view
    requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.focus({ preventScroll: true });
    });
  }, [submitCount, isValid, isValidating, errors]);

  return null;
}
