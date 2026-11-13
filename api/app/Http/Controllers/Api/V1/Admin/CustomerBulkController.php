<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\EmailTemplateKey;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\User;
use App\Notifications\CustomerMessageNotification;
use App\Support\WhatsApp;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

/**
 * Actions on several customers at once from the Customers page: message, suspend or reactivate,
 * and delete. Staff accounts are never touched, even if their ids are sent.
 */
class CustomerBulkController extends Controller
{
    public const MAX = 100;

    public function status(Request $request): JsonResponse
    {
        $validated = $request->validate($this->idRules() + [
            'status' => ['required', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED])],
        ]);
        $customers = $this->customers($validated['ids'])->where('status', '!=', $validated['status']);

        foreach ($customers as $customer) {
            $customer->update(['status' => $validated['status']]);
            if ($validated['status'] === User::STATUS_SUSPENDED) {
                $customer->tokens()->delete();
            }
        }

        $count = $customers->count();
        $people = $count === 1 ? '1 customer' : "{$count} customers";

        return response()->json([
            'updated' => $count,
            'message' => $validated['status'] === User::STATUS_SUSPENDED ? "{$people} suspended and signed out." : "{$people} reactivated.",
        ]);
    }

    /**
     * Deletes customers with no history. Anyone with bookings, orders, payments or other records
     * is kept (suspend them instead), so financial and legal records stay intact.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate($this->idRules());
        $deleted = 0;
        $kept = [];

        foreach ($this->customers($validated['ids']) as $customer) {
            if ($this->hasHistory($customer)) {
                $kept[] = $customer->name;

                continue;
            }
            try {
                $customer->tokens()->delete();
                $customer->delete();
                $deleted++;
            } catch (QueryException) {
                $kept[] = $customer->name;
            }
        }

        $message = $deleted === 1 ? '1 customer deleted.' : "{$deleted} customers deleted.";
        if ($kept !== []) {
            $message .= ' '.(count($kept) === 1 ? '1 was' : count($kept).' were').' kept because they have bookings, orders or payments on record ('
                .implode(', ', array_slice($kept, 0, 5)).(count($kept) > 5 ? ' and others' : '').'). Suspend them instead.';
        }

        return response()->json(['deleted' => $deleted, 'kept' => count($kept), 'message' => $message]);
    }

    public function message(Request $request, WhatsApp $whatsApp): JsonResponse
    {
        $validated = $request->validate($this->idRules() + [
            'subject' => ['required', 'string', 'max:150'],
            'message' => ['required', 'string', 'max:2000'],
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => ['string', Rule::in([CustomerMessageNotification::EMAIL, CustomerMessageNotification::WHATSAPP])],
        ]);
        $customers = $this->customers($validated['ids'])->where('status', User::STATUS_ACTIVE);
        $channels = array_values(array_unique($validated['channels']));

        $byWhatsApp = 0;
        if (in_array(CustomerMessageNotification::WHATSAPP, $channels, true)) {
            if (! $whatsApp->isConfigured() || ! $whatsApp->templateFor(EmailTemplateKey::CustomerMessage)) {
                abort_if($channels === [CustomerMessageNotification::WHATSAPP], 422, 'WhatsApp isn\'t ready for messages yet. In Settings, WhatsApp, add your approved template for "Message from the team".');
            } else {
                $byWhatsApp = $customers->filter(fn (User $customer) => $customer->wantsWhatsApp())->count();
            }
        }

        Notification::send($customers, new CustomerMessageNotification($validated['subject'], $validated['message'], $channels));

        $count = $customers->count();
        $parts = [];
        if (in_array(CustomerMessageNotification::EMAIL, $channels, true)) {
            $parts[] = "email to {$count}";
        }
        if (in_array(CustomerMessageNotification::WHATSAPP, $channels, true)) {
            $parts[] = "WhatsApp to {$byWhatsApp} who opted in";
        }

        return response()->json([
            'recipients' => $count,
            'whatsapp' => $byWhatsApp,
            'message' => $count === 0 ? 'No active customers selected, so nothing was sent.' : 'Sending '.implode(' and ', $parts).'. It can take a minute or two to arrive.',
        ]);
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function idRules(): array
    {
        return ['ids' => ['required', 'array', 'min:1', 'max:'.self::MAX], 'ids.*' => ['integer', 'distinct']];
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, User>
     */
    private function customers(array $ids): Collection
    {
        return User::query()->where('type', User::TYPE_CUSTOMER)->whereIn('id', $ids)->get();
    }

    private function hasHistory(User $customer): bool
    {
        foreach (['bookings', 'orders', 'invoices', 'payments', 'passes', 'memberships', 'consultations', 'businesses', 'mailboxes', 'documentSignatures'] as $relation) {
            if ($customer->{$relation}()->exists()) {
                return true;
            }
        }

        return Appointment::where('user_id', $customer->id)->exists();
    }
}
