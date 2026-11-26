<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\InvoiceStatus;
use App\Enums\Role;
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
use App\Notifications\CustomerAddedNotification;
use App\Support\Impersonation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
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

    /**
     * Adds one customer, e.g. a walk-in at the front desk. The account gets a random password and the
     * customer is emailed a link to set their own, so staff never handle it. Someone who booked as a
     * guest with the same email becomes a full account and keeps their bookings.
     */
    public function store(Request $request): JsonResponse
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);
        $guest = User::query()->where('email', $request->input('email'))->where('status', User::STATUS_GUEST)->first();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($guest?->id)],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s-]{7,20}$/', Rule::unique('users', 'phone')->ignore($guest?->id)],
        ], [
            'email.unique' => 'There is already an account with this email. Search for it in the customer list.',
            'phone.unique' => 'Another account already uses this phone number.',
            'phone.regex' => 'Enter a phone number with digits only, for example 08012345678.',
        ]);

        $customer = DB::transaction(function () use ($validated, $guest) {
            $customer = $guest ?? new User(['email' => $validated['email'], 'type' => User::TYPE_CUSTOMER]);
            $customer->forceFill([
                'name' => $validated['name'],
                'phone' => $validated['phone'] ?? $customer->phone,
                'password' => Str::password(32),
                'status' => User::STATUS_ACTIVE,
                'must_change_password' => false,
                // Staff took the address from the customer, and the link only works from that inbox.
                'email_verified_at' => $customer->email_verified_at ?? now(),
            ])->save();

            if (! $customer->hasRole(Role::Customer->value)) {
                $customer->assignRole(Role::Customer->value);
            }

            return $customer;
        });

        $customer->notify(new CustomerAddedNotification(Password::broker()->createToken($customer), $request->user()->name));

        return (new UserResource($customer->load('roles')))
            ->additional(['message' => "{$customer->name} has been added. We've emailed {$customer->email} a link to set their password."])
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Signs the staff member in as this customer, e.g. to book a space for them. Returns a token for
     * the customer that expires after a few hours and remembers who opened it; the web app keeps the
     * staff member's own session aside and goes back to it afterwards.
     */
    public function impersonate(Request $request, User $user): JsonResponse
    {
        abort_if($user->isStaff(), 404);
        abort_unless($user->isActive(), 422, $user->isGuest()
            ? "{$user->name} booked as a guest and has no account yet. Add them as a customer first."
            : "{$user->name}'s account is suspended. Reactivate it first.");

        $token = $user->createToken(Impersonation::TOKEN_NAME, ['*'], now()->addHours(Impersonation::HOURS));
        $token->accessToken->forceFill(['impersonator_id' => $request->user()->id])->save();

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => new UserResource($user),
            'expires_at' => $token->accessToken->expires_at->toIso8601String(),
        ]);
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
