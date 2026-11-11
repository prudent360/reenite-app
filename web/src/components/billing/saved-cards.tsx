"use client";

import { useTransition } from "react";
import { CreditCard, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { makeDefaultCard, removeCard } from "@/lib/actions/billing";
import type { SavedCard } from "@/lib/types";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { formatDate } from "@/lib/utils";

/** Cards saved for automatic renewals. The default one is charged; customers can switch or remove. */
export function SavedCards({ cards }: { cards: SavedCard[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Saved cards"
        description={
          cards.length === 0
            ? 'Tick "Save this card" when you pay by card, and passes and memberships can renew on their own.'
            : "Automatic renewals use your default card. Paystack keeps the card; we only keep the last 4 digits."
        }
      />
      {cards.length > 0 && (
        <ul className="divide-y divide-border">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function CardRow({ card }: { card: SavedCard }) {
  const [pending, startTransition] = useTransition();

  function act(call: () => Promise<{ ok?: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await call();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "That didn't work.");
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
      <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white">
        <CreditCard className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
          {card.label}
          {card.is_default && <Badge tone="success">Default</Badge>}
          {card.is_expired && <Badge tone="danger">Expired</Badge>}
          {card.test_mode && <Badge tone="warning">Test</Badge>}
        </p>
        <p className="text-xs text-muted">
          {[card.bank, card.expires ? `Expires ${card.expires}` : null, card.last_used_at ? `Last used ${formatDate(card.last_used_at)}` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      {pending ? (
        <DotLoader className="text-navy-300" label="Saving" />
      ) : (
        <div className="flex gap-2">
          {!card.is_default && !card.is_expired && (
            <Button size="sm" variant="outline" onClick={() => act(() => makeDefaultCard(card.id))}>
              <Star className="size-4" /> Make default
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-9 text-danger" aria-label={`Remove ${card.label}`} onClick={() => act(() => removeCard(card.id))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </li>
  );
}
