<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Booking;
use App\Models\Consultation;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Models\Mailbox;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $customers = User::query()
            ->where('type', User::TYPE_CUSTOMER)
            ->with('roles')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term));
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return UserResource::collection($customers);
    }

    /**
     * A customer's profile, with what they have done with the business: totals, and their
     * latest bookings, orders, invoices, consultations, passes, memberships, businesses and mailboxes.
     */
    public function show(User $user): UserResource
    {
        abort_if($user->isStaff(), 404);

        $invoices = $user->invoices()->where('status', '!=', InvoiceStatus::Void->value);
        $latest = fn (string $relation, string $column = 'created_at') => $user->{$relation}()->latest($column)->limit(5)->get();

        return (new UserResource($user->load('roles')))->additional(['overview' => [
            'totals' => [
                'bookings' => $user->bookings()->count(),
                'orders' => $user->orders()->count(),
                'consultations' => $user->consultations()->count(),
                // Each column is summed on its own and subtracted here: the columns are unsigned, and
                // MySQL refuses "a - b" in SQL whenever one row would go below zero.
                'paid' => max(0, (int) (clone $invoices)->sum('amount_paid') - (int) (clone $invoices)->sum('amount_refunded')),
                'outstanding' => (int) (clone $invoices)->where('status', InvoiceStatus::Unpaid->value)->get(['total', 'amount_paid'])
                    ->sum(fn (Invoice $invoice) => max(0, $invoice->total - $invoice->amount_paid)),
            ],
            'bookings' => $latest('bookings', 'starts_at')->map(fn (Booking $booking) => [
                'reference' => $booking->reference,
                'space_name' => $booking->space_name,
                'location_name' => $booking->location_name,
                'starts_at' => $booking->starts_at?->toIso8601String(),
                'ends_at' => $booking->ends_at?->toIso8601String(),
                'status' => $booking->status->value,
                'status_label' => $booking->status->label(),
                'total' => (int) $booking->total,
            ]),
            'orders' => $latest('orders')->map(fn (Order $order) => [
                'reference' => $order->reference,
                'service_name' => $order->service_name,
                'status' => $order->status->value,
                'status_label' => $order->status->label(),
                'created_at' => $order->created_at?->toIso8601String(),
            ]),
            'invoices' => $latest('invoices')->map(fn (Invoice $invoice) => [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'status' => $invoice->status->value,
                'status_label' => $invoice->status->label(),
                'total' => $invoice->total,
                'amount_paid' => $invoice->amount_paid,
                'due_at' => $invoice->due_at?->toDateString(),
                'created_at' => $invoice->created_at?->toIso8601String(),
            ]),
            'consultations' => $latest('consultations', 'starts_at')->map(fn (Consultation $consultation) => [
                'reference' => $consultation->reference,
                'name' => $consultation->name,
                'starts_at' => $consultation->starts_at?->toIso8601String(),
                'status' => (string) $consultation->status,
                'status_label' => Str::headline((string) $consultation->status),
            ]),
            'plans' => $user->passes()->latest('ends_at')->limit(5)->get()
                ->map(fn (CustomerPass $pass) => ['kind' => 'Pass', 'name' => $pass->name, 'status' => (string) $pass->status, 'starts_at' => $pass->starts_at?->toIso8601String(), 'ends_at' => $pass->ends_at?->toIso8601String()])
                ->concat($user->memberships()->latest('ends_at')->limit(5)->get()
                    ->map(fn (CustomerMembership $membership) => ['kind' => 'Membership', 'name' => $membership->name, 'status' => (string) $membership->status, 'starts_at' => $membership->starts_at?->toIso8601String(), 'ends_at' => $membership->ends_at?->toIso8601String()]))
                ->sortByDesc('ends_at')->values(),
            'businesses' => $user->businesses()->orderBy('name')->get(['id', 'name', 'entity_type', 'registration_number']),
            'mailboxes' => $user->mailboxes()->latest()->get(['id', 'number', 'business_name', 'status', 'active_until'])
                ->map(fn (Mailbox $mailbox) => [
                    'id' => $mailbox->id,
                    'number' => $mailbox->number,
                    'business_name' => $mailbox->business_name,
                    'status' => (string) $mailbox->status,
                    'active_until' => $mailbox->active_until?->toDateString(),
                ]),
        ]]);
    }

    public function updateStatus(Request $request, User $user): UserResource
    {
        abort_if($user->isStaff(), 404);

        $validated = $request->validate([
            'status' => ['required', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED])],
        ]);

        $user->update($validated);

        if ($user->status === User::STATUS_SUSPENDED) {
            $user->tokens()->delete();
        }

        return new UserResource($user->load('roles'));
    }
}
