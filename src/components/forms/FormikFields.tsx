"use client";

import { useField } from "formik";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { Option } from "@/lib/types";
import { FormField, inputClass } from "@/components/ui/FormField";

interface BaseProps {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
}

/** Text / number / email / password input bound to Formik by name. */
export function TextField({
  name,
  label,
  required,
  hint,
  className,
  ...props
}: BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "name">) {
  const [field, meta] = useField(name);
  const error = meta.touched ? meta.error : undefined;
  return (
    <FormField label={label} htmlFor={name} required={required} error={error} hint={hint} className={className}>
      <input
        id={name}
        {...field}
        value={field.value ?? ""}
        aria-invalid={Boolean(error)}
        className={inputClass(Boolean(error))}
        {...props}
      />
    </FormField>
  );
}

export function SelectField({
  name,
  label,
  required,
  hint,
  className,
  options,
  placeholder,
  ...props
}: BaseProps & { options: Option[]; placeholder?: string } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "name">) {
  const [field, meta] = useField(name);
  const error = meta.touched ? meta.error : undefined;
  return (
    <FormField label={label} htmlFor={name} required={required} error={error} hint={hint} className={className}>
      <select
        id={name}
        {...field}
        value={field.value ?? ""}
        aria-invalid={Boolean(error)}
        className={`${inputClass(Boolean(error))} cursor-pointer`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export function TextAreaField({
  name,
  label,
  required,
  hint,
  className,
  rows = 3,
  ...props
}: BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const [field, meta] = useField(name);
  const error = meta.touched ? meta.error : undefined;
  return (
    <FormField label={label} htmlFor={name} required={required} error={error} hint={hint} className={className}>
      <textarea
        id={name}
        {...field}
        value={field.value ?? ""}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={`${inputClass(Boolean(error))} h-auto py-2 resize-none`}
        {...props}
      />
    </FormField>
  );
}

export const STATUS_OPTIONS: Option[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];
