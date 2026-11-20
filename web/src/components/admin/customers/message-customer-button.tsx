"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";
import { MessageCustomersDialog } from "./message-customers-dialog";

/** Opens the message dialog for one customer, from their profile page. */
export function MessageCustomerButton({ customer }: { customer: User }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="navy" size="sm" onClick={() => setOpen(true)}>
        <Mail className="size-4" /> Message
      </Button>
      {open && <MessageCustomersDialog customers={[customer]} onClose={() => setOpen(false)} />}
    </>
  );
}
