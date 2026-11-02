import { CheckCircle2, CircleDashed } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { BUILD_STEPS } from "@/lib/buildProgress";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Overview" };

export default async function Page() {
  const user = await requireUser();
  const done = BUILD_STEPS.filter((s) => s.done).length;
  return (
    <div className="space-y-4">
      <PageHeader title={`Welcome, ${user.name}`} description="AKOD Commerce — the dashboard appears here once the modules are built" />
      <div className="bg-white border border-line rounded-xl">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-800">Build progress</h2>
          <span className="text-xs font-bold text-brand">
            {done} / {BUILD_STEPS.length} done
          </span>
        </div>
        <div className="h-1.5 bg-slate-100">
          <div className="h-full bg-brand" style={{ width: `${(done / BUILD_STEPS.length) * 100}%` }} />
        </div>
        <ul className="divide-y divide-line">
          {BUILD_STEPS.map((s) => (
            <li key={s.title} className="px-4 py-3 flex items-start gap-3">
              {s.done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <CircleDashed className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${s.done ? "text-slate-900" : "text-slate-600"}`}>{s.title}</p>
                <p className="text-xs text-slate-500">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
