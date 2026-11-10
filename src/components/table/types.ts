import type { ReactNode } from "react";
import type { Option } from "@/lib/types";

export interface RenderCtx {
  sub: boolean;
  /** Row has child rows and they are showing */
  open?: boolean;
  /** Show / hide this row's child rows (e.g. a "4 SKU Sizes" button) */
  toggle?: () => void;
}

export interface Column<T> {
  key: string;
  label: string;
  /** `ctx.sub` is true on an expanded child row (e.g. a product's variant) */
  render?: (row: T, ctx: RenderCtx) => ReactNode;
  align?: "left" | "center" | "right";
  /** Monospace styling for codes/IDs */
  mono?: boolean;
  /** Hidden until the user enables it in the column picker */
  hiddenByDefault?: boolean;
  width?: string;
}

export interface FilterConfig {
  /** URL search param name */
  key: string;
  /** Label of the "all" option, e.g. "All Status" */
  allLabel: string;
  options: Option[];
  minWidth?: string;
}

export const STATUS_FILTER: FilterConfig = {
  key: "status",
  allLabel: "All Status",
  options: [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
};
