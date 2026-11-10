"use client";

import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

interface FormSurfaceProps {
  /** Render as a full page (create / edit screens); omit for a modal */
  page?: { backHref: string };
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** Cancel + submit buttons (submit uses `form={FORM_ID}` so it works in both layouts) */
  footer: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

/** One form, two layouts: a modal, or a full page with back link and sticky footer (same look as FormCard). */
export function FormSurface({ page, onClose, title, subtitle, icon, footer, size = "md", children }: FormSurfaceProps) {
  if (!page) {
    return (
      <Modal open onClose={onClose} title={title} subtitle={subtitle} icon={icon} size={size} footer={footer}>
        {children}
      </Modal>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-3">
        <Link
          href={page.backHref}
          title="Back"
          className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-9 h-9 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
      <div className="px-4 sm:px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          <Info className="w-4 h-4 text-brand" />
          <span>
            Fields marked with (<span className="text-rose-500 font-bold">*</span>) are required.
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">{footer}</div>
      </div>
    </div>
  );
}
