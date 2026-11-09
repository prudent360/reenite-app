"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBankAccount, saveBankAccount, saveBankTransfer } from "@/lib/actions/settings";
import type { BankAccount, BankTransferSettings } from "@/lib/types";
import { Alert, Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SwitchField, TextField, TextareaField } from "@/components/ui/form";

const NIGERIAN_BANKS = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank", "First Bank of Nigeria", "First City Monument Bank (FCMB)",
  "Globus Bank", "Guaranty Trust Bank (GTBank)", "Keystone Bank", "Kuda Microfinance Bank", "Moniepoint Microfinance Bank",
  "Opay", "Palmpay", "Polaris Bank", "Providus Bank", "Stanbic IBTC Bank", "Standard Chartered Bank", "Sterling Bank",
  "Titan Trust Bank", "Union Bank of Nigeria", "United Bank for Africa (UBA)", "Unity Bank", "Wema Bank", "Zenith Bank",
];

export function BankTransferManager({ settings }: { settings: BankTransferSettings }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [instructions, setInstructions] = useState(settings.instructions ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [editingId, setEditingId] = useState<number | "new" | null>(settings.accounts.length === 0 ? "new" : null);
  const dirty = enabled !== settings.enabled || instructions !== (settings.instructions ?? "");

  function save() {
    startSaving(async () => {
      const result = await saveBankTransfer({ enabled, instructions });
      setError(result.errors?.enabled?.[0] ?? null);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.errors?.enabled?.[0] ?? result.message ?? "Couldn't save.");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
      <Card>
        <CardHeader title="Bank transfer" description="Let customers pay into your account and upload proof. Finance staff confirm each transfer." />
        <div className="space-y-5 p-5 sm:p-6">
          <SwitchField
            name="bank_transfer_enabled"
            label="Accept bank transfers"
            description={enabled ? "Customers will see your active accounts at checkout." : "Bank transfer is hidden at checkout."}
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          {error && (
            <Alert tone="danger" icon={AlertTriangle}>
              {error}
            </Alert>
          )}
          <TextareaField
            label="Instructions for customers"
            name="instructions"
            rows={4}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="e.g. Use your order number as the transfer reference, then upload your receipt. We confirm transfers within 1 working day."
          />
          <div className="flex justify-end">
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? <DotLoader className="text-current" /> : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Bank accounts"
          description="Shown to customers who choose bank transfer."
          action={
            <Button size="sm" variant="outline" onClick={() => setEditingId("new")}>
              <Plus className="size-4" /> Add account
            </Button>
          }
        />
        {settings.accounts.length === 0 && editingId !== "new" && (
          <EmptyState icon={Landmark} title="No accounts yet" description="Add the account customers should pay into." />
        )}
        <ul className="divide-y divide-border">
          {settings.accounts.map((account) =>
            editingId === account.id ? (
              <li key={account.id} className="p-5">
                <AccountForm account={account} onDone={() => setEditingId(null)} />
              </li>
            ) : (
              <AccountRow key={account.id} account={account} onEdit={() => setEditingId(account.id)} />
            ),
          )}
          {editingId === "new" && (
            <li className="p-5">
              <AccountForm onDone={() => setEditingId(null)} />
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function AccountRow({ account, onEdit }: { account: BankAccount; onEdit: () => void }) {
  const [deleting, startDeleting] = useTransition();
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white dark:bg-navy-700">
        <Landmark className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
          {account.bank_name} {!account.is_active && <Badge tone="neutral">Inactive</Badge>}
        </p>
        <p className="text-sm text-muted">
          <span className="font-mono text-foreground">{account.account_number}</span> · {account.account_name}
        </p>
      </div>
      <Button variant="ghost" size="icon" className="size-9" onClick={onEdit} aria-label={`Edit ${account.bank_name} account`}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 hover:bg-danger-soft hover:text-danger"
        disabled={deleting}
        aria-label={`Remove ${account.bank_name} account`}
        onClick={() => {
          if (!window.confirm(`Remove the ${account.bank_name} account ending ${account.account_number.slice(-4)}?`)) return;
          startDeleting(async () => {
            const result = await deleteBankAccount(account.id);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message ?? "Couldn't remove this account.");
          });
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

function AccountForm({ account, onDone }: { account?: BankAccount; onDone: () => void }) {
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [accountName, setAccountName] = useState(account?.account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.account_number ?? "");
  const [isActive, setIsActive] = useState(account?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  function submit() {
    startSaving(async () => {
      const result = await saveBankAccount(account?.id ?? null, {
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber.replace(/\s/g, ""),
        is_active: isActive,
      });
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else {
        toast.error(result.message ?? "Please check the highlighted fields.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Bank" name="bank_name" list="nigerian-banks" value={bankName} onChange={(event) => setBankName(event.target.value)} error={errors.bank_name} autoFocus />
        <datalist id="nigerian-banks">
          {NIGERIAN_BANKS.map((bank) => (
            <option key={bank} value={bank} />
          ))}
        </datalist>
        <TextField
          label="Account number"
          name="account_number"
          inputMode="numeric"
          maxLength={10}
          inputClassName="font-mono"
          value={accountNumber}
          onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
          error={errors.account_number}
        />
      </div>
      <TextField label="Account name" name="account_name" value={accountName} onChange={(event) => setAccountName(event.target.value)} error={errors.account_name} placeholder="e.g. Reenite Limited" />
      <SwitchField name="is_active" label="Show to customers" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? <DotLoader className="text-current" /> : account ? "Save account" : "Add account"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
