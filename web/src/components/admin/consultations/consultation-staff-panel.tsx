"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordConsultationOutcome, staffCancelConsultation, updateConsultation } from "@/lib/actions/consultations";
import type { Consultation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField, TextField, TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { formatNaira } from "@/lib/utils";

/** Assign an officer, add the joining details and notes, record how it went, or cancel. */
export function ConsultationStaffPanel({ consultation, officers, canManage }: { consultation: Consultation; officers: { id: number; name: string }[]; canManage: boolean }) {
  const [form, setForm] = useState({
    assigned_to: consultation.officer ? String(consultation.officer.id) : "",
    meeting_details: consultation.raw_meeting_details ?? "",
    staff_notes: consultation.staff_notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const [acting, startActing] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [cancel, setCancel] = useState({ reason: "", refund_percent: "100" });
  const started = consultation.has_started;
  const paid = (consultation.invoice?.amount_paid ?? 0) - (consultation.invoice?.amount_refunded ?? 0);

  function save() {
    startSaving(async () => {
      const result = await updateConsultation(consultation.reference, {
        ...(canManage ? { assigned_to: form.assigned_to ? Number(form.assigned_to) : null } : {}),
        meeting_details: form.meeting_details.trim() || null,
        staff_notes: form.staff_notes.trim() || null,
      });
      setErrors(result.errors ?? {});
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Please check the form.");
    });
  }

  function act(call: () => Promise<{ ok?: boolean; message?: string }>) {
    startActing(async () => {
      const result = await call();
      if (result.ok) {
        toast.success(result.message);
        setCancelling(false);
      } else {
        toast.error(result.message ?? "That didn't work.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Session" description={consultation.mode === "video" ? "Add the video link so the customer can join." : undefined} />
        <div className="space-y-4 p-5 sm:p-6">
          {canManage && (
            <SelectField label="Officer" name="assigned_to" value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })} error={errors.assigned_to}>
              <option value="">Not assigned</option>
              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.name}
                </option>
              ))}
            </SelectField>
          )}
          <TextareaField
            label="How to join"
            name="meeting_details"
            value={form.meeting_details}
            onChange={(event) => setForm({ ...form, meeting_details: event.target.value })}
            error={errors.meeting_details}
            placeholder={consultation.mode === "video" ? "Google Meet: https://meet.google.com/..." : consultation.mode === "phone" ? "We'll call you on 0803..." : "Room 2, first floor"}
            hint="The customer sees this on their consultation page and in their reminder."
          />
          <TextareaField
            label="Staff notes"
            name="staff_notes"
            value={form.staff_notes}
            onChange={(event) => setForm({ ...form, staff_notes: event.target.value })}
            error={errors.staff_notes}
            hint="Only staff see these."
          />
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <DotLoader className="text-current" label="Saving" /> : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      {consultation.status === "confirmed" && (
        <Card>
          <CardHeader title="After the session" description={started ? undefined : "Available once it has started."} />
          <div className="flex flex-wrap gap-2 p-5 sm:p-6">
            <Button variant="outline" disabled={!started || acting} onClick={() => act(() => recordConsultationOutcome(consultation.reference, "completed"))}>
              It happened
            </Button>
            <Button variant="ghost" disabled={!started || acting} onClick={() => act(() => recordConsultationOutcome(consultation.reference, "no_show"))}>
              Customer didn&apos;t turn up
            </Button>
          </div>
        </Card>
      )}

      {canManage && (consultation.status === "confirmed" || consultation.status === "pending_payment") && (
        <Card>
          <CardHeader title="Cancel" description="The customer is emailed with the reason and any refund." />
          <div className="space-y-4 p-5 sm:p-6">
            {!cancelling ? (
              <Button variant="outline" onClick={() => setCancelling(true)}>
                Cancel consultation
              </Button>
            ) : (
              <>
                <TextField label="Reason" name="reason" value={cancel.reason} onChange={(event) => setCancel({ ...cancel, reason: event.target.value })} placeholder="e.g. The officer is unwell. Please book another time." />
                {paid > 0 && (
                  <SelectField label="Refund" name="refund_percent" value={cancel.refund_percent} onChange={(event) => setCancel({ ...cancel, refund_percent: event.target.value })} hint={`Paid: ${formatNaira(paid)}. Card payments are refunded automatically; bank transfers by Finance.`}>
                    <option value="100">Full refund</option>
                    <option value="50">Half</option>
                    <option value="0">No refund</option>
                  </SelectField>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={acting || !cancel.reason.trim()}
                    onClick={() => act(() => staffCancelConsultation(consultation.reference, cancel.reason.trim(), Number(cancel.refund_percent)))}
                  >
                    {acting ? <DotLoader className="text-current" label="Cancelling" /> : "Cancel and email the customer"}
                  </Button>
                  <Button variant="ghost" onClick={() => setCancelling(false)}>
                    Keep it
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
