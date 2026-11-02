import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { StockLevel } from "@/lib/commerceTypes";

const LEVELS: Record<StockLevel, { label: string; variant: BadgeVariant }> = {
  IN_STOCK: { label: "In stock", variant: "success" },
  LOW_STOCK: { label: "Low stock", variant: "warning" },
  OUT_OF_STOCK: { label: "Out of stock", variant: "danger" },
};

export const STOCK_LEVEL_OPTIONS = (Object.keys(LEVELS) as StockLevel[]).map((k) => ({ value: k, label: LEVELS[k].label }));

export function stockLevel(quantity: number, reorderLevel: number): StockLevel {
  if (quantity <= 0) return "OUT_OF_STOCK";
  return quantity <= reorderLevel ? "LOW_STOCK" : "IN_STOCK";
}

export function StockLevelBadge({ level }: { level: StockLevel }) {
  const l = LEVELS[level];
  return (
    <Badge variant={l.variant} dot>
      {l.label}
    </Badge>
  );
}
