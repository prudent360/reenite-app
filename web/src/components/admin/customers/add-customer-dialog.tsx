"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton, TextField } from "@/components/ui/form";
import { addCustomer } from "@/lib/actions/admin";
import type { FormState } from "@/lib/types";

/** The button on the Customers page, which opens the add-customer dialog. */
export function AddCustomerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Add customer
      </Button>
      {open && <AddCustomerDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** One customer at a time, e.g. a walk-in. They get an email with a link to set their own password. */
function AddCustomerDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(addCustomer, {});

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      dialog.current?.close();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && !pending && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground shadow-pop backdrop:bg-navy-950/50"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-bold">Add a customer</h2>
          <p className="mt-0.5 text-sm text-muted">We&apos;ll email them a link to set their own password.</p>
        </div>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-muted hover:bg-surface-muted" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <form action={action} className="space-y-4 px-5 py-5" noValidate>
        <TextField label="Full name" name="name" required autoFocus defaultValue={state.values?.name} error={state.errors?.name} />
        <TextField label="Email" name="email" type="email" required defaultValue={state.values?.email} error={state.errors?.email} />
        <TextField label="Phone (optional)" name="phone" type="tel" defaultValue={state.values?.phone} error={state.errors?.phone} />
        <p className="text-[13px] text-muted">
          If they booked before without an account, their bookings move into the new account.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <SubmitButton>Add customer</SubmitButton>
        </div>
      </form>
    </dialog>
  );
}
