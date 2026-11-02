import { Plus } from "lucide-react";
import Link from "next/link";

/** Primary "Add …" button shown in list page headers. */
export function AddLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
    >
      <Plus className="w-4 h-4" />
      {label}
    </Link>
  );
}
