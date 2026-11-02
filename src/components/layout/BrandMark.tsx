import { clsx } from "clsx";

/** Text logo used until a brand image is supplied (drop it in /public and swap this out). */
export function BrandMark({ inverted = false, size = "md" }: { inverted?: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-lg font-black tracking-tight select-none",
        inverted ? "bg-white/10 text-white border border-white/15" : "bg-brand text-white border border-brand-dark",
        size === "sm" && "h-8 px-2 text-[11px]",
        size === "md" && "h-9 px-2.5 text-xs",
        size === "lg" && "h-12 px-3.5 text-base"
      )}
    >
      AKOD
    </span>
  );
}
