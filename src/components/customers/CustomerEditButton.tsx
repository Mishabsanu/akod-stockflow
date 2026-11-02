"use client";

import { Edit2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/lib/commerceTypes";
import { CustomerFormModal } from "./CustomerFormModal";

export function CustomerEditButton({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && <CustomerFormModal open onClose={() => setOpen(false)} initial={customer} />}
    </>
  );
}
