import { redirect } from "next/navigation";
import { Boxes, ShieldCheck, Truck } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandMark } from "@/components/layout/BrandMark";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Sign in" };

const APP_PREFIXES = ["/dashboard"];

/** Only this app's own pages are allowed as a post-login destination; "/" picks the user's home. */
function safeNext(next?: string | string[]): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && APP_PREFIXES.some((p) => value === p || value.startsWith(`${p}/`)) ? value : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  const features = [
    { icon: Boxes, text: "Batch-wise stock from production to every shelf" },
    { icon: Truck, text: "Distributors, bulk stock holders and van sales in one place" },
    { icon: ShieldCheck, text: "Role-based access for office, warehouse and field staff" },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      <div className="hidden lg:flex flex-col justify-between bg-rail text-white p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-brand/40 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <BrandMark inverted size="lg" />
          <span className="text-sm font-bold uppercase tracking-wider text-slate-300">Distribution</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-3xl font-black leading-tight">
            From production line
            <br />
            to every retailer.
          </h1>
          <ul className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="w-8 h-8 rounded-lg bg-rail-active border border-[#2b5175] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-sky-300" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-slate-500 relative">© {new Date().getFullYear()} AKOD Group. All rights reserved.</p>
      </div>

      <div className="flex items-center justify-center p-5 sm:p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <BrandMark size="lg" />
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Distribution</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Welcome back</h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">Sign in with your email or mobile number.</p>
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
