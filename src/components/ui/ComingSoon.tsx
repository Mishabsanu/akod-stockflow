import { Hammer } from "lucide-react";
import { PageHeader } from "./PageHeader";

/** Placeholder for a screen that is still being built. */
export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />
      <div className="bg-white border border-line rounded-xl p-10 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-brand-light border border-brand-border text-brand flex items-center justify-center mb-3">
          <Hammer className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">This screen is being built</h2>
        <p className="text-xs text-slate-500 mt-1">It will appear here as soon as it is ready.</p>
      </div>
    </div>
  );
}
