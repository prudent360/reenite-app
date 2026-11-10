<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Space;
use App\Models\SpaceRate;
use App\Models\User;
use App\Payments\CouponService;
use App\Payments\GatewayException;
use App\Payments\PaymentService;
use App\Support\FrontendLinks;
use App\Uploads\UploadLimit;
use App\Workspace\BookingService;
use App\Workspace\GuestCustomers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Booking a space, for signed-in customers and guests. Guests reach their booking with the
 * private token from their confirmation link; signed-in owners don't need it.
 */
class BookingController extends Controller
{
    public function __construct(private BookingService $bookings, private PaymentService $payments) {}

    /**
     * Prices a booking so the form can show the total before anything is held.
     */
    public function quote(Request $request): JsonResponse
    {
        $validated = $request->validate($this->bookingRules());
        $space = $this->findSpace($validated['space']);

        $quote = $this->bookings->quote($space, $validated, $this->customer($request));

        return response()->json(['data' => [
            'starts_at' => $quote['starts_at']->toIso8601String(),
            'ends_at' => $quote['ends_at']->toIso8601String(),
            'lines' => $quote['lines'],
            'subtotal' => $quote['subtotal'],
            'addons_total' => $quote['addons_total'],
            'discount' => $quote['discount'],
            'discount_label' => $quote['discount_label'],
            'total' => $quote['total'],
            'eligible_pass' => $quote['eligible_pass'],
            'requires_approval' => $quote['requires_approval'],
            'hold_minutes' => BookingService::HOLD_MINUTES,
        ]]);
    }

    /**
     * Holds the slot. Guests give their name and email; signed-in customers book as themselves.
     */
    public function store(Request $request, GuestCustomers $guests): JsonResponse
    {
        $this->bookings->assertOpen();
        $customer = $this->customer($request);
        abort_if($customer?->isStaff(), 403, 'Staff accounts cannot book spaces. Please use a customer account.');
        abort_if($customer && ! $customer->isActive(), 403, 'This account has been suspended. Please contact Reenite support.');

        $validated = $request->validate($this->bookingRules() + [
            'notes' => ['nullable', 'string', 'max:1000'],
            'name' => [Rule::requiredIf(! $customer), 'nullable', 'string', 'max:120'],
            'email' => [Rule::requiredIf(! $customer), 'nullable', 'string', 'email', 'max:255'],
            'phone' => [Rule::requiredIf(! $customer), 'nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s-]{7,20}$/'],
        ], ['phone.regex' => 'Enter a valid phone number.']);

        $space = $this->findSpace($validated['space']);
        $customer ??= $guests->resolve($validated);
        $booking = $this->bookings->create($space, $validated, $customer);

        return response()->json([
            'data' => new BookingResource($booking->load(['space.location', 'addons', 'invoice.payments'])),
            // The guest's key to this booking; signed-in customers can ignore it.
            'token' => $booking->manage_token,
        ], Response::HTTP_CREATED);
    }

    /**
     * The signed-in customer's bookings, upcoming first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $bookings = $request->user()->bookings()
            ->whereNotIn('status', [BookingStatus::Expired->value])
            ->with(['space.location', 'invoice'])
            ->orderByRaw('case when ends_at >= ? then 0 else 1 end', [now()])
            ->orderByRaw('case when ends_at >= ? then starts_at end asc', [now()])
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->paginate(20);

        return BookingResource::collection($bookings);
    }

    public function show(Request $request, Booking $booking): BookingResource
    {
        $this->authorizeBooking($request, $booking);

        return $this->present($booking);
    }

    public function cancel(Request $request, Booking $booking): BookingResource
    {
        $this->authorizeBooking($request, $booking);
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        $booking = $this->bookings->cancel($booking, null, $validated['reason'] ?? 'Cancelled by the customer');

        return $this->present($booking);
    }

    /**
     * Applies a discount code to a held booking's invoice. A code covering the whole amount
     * confirms the booking straight away.
     */
    public function applyCoupon(Request $request, Booking $booking, CouponService $coupons): BookingResource
    {
        $this->authorizeBooking($request, $booking);
        $validated = $request->validate(['code' => ['required', 'string', 'max:40']], ['code.required' => 'Enter a discount code.']);
        $this->assertAwaitingPayment($booking);

        $booking->loadMissing(['invoice', 'user']);
        $coupons->apply($booking->invoice, $validated['code'], $booking->user);

        return $this->present($booking->refresh());
    }

    public function removeCoupon(Request $request, Booking $booking, CouponService $coupons): BookingResource
    {
        $this->authorizeBooking($request, $booking);
        $this->assertAwaitingPayment($booking);

        $booking->loadMissing('invoice');
        $coupons->remove($booking->invoice);

        return $this->present($booking->refresh());
    }

    /**
     * Starts an online payment for a held booking; the gateway brings the customer back to the booking.
     */
    public function pay(Request $request, Booking $booking): JsonResponse
    {
        $this->authorizeBooking($request, $booking);
        $validated = $request->validate(['gateway' => ['required', 'string', Rule::in(['paystack', 'flutterwave', 'stripe'])]]);
        $this->assertAwaitingPayment($booking);

        $booking->loadMissing(['invoice', 'user']);
        $result = $this->payments->startOnlinePayment(
            $booking->invoice,
            $validated['gateway'],
            $booking->user,
            fn (Payment $payment) => FrontendLinks::bookingPaymentReturn($booking, $payment->reference),
            FrontendLinks::booking($booking),
        );

        return response()->json(['reference' => $result['payment']->reference, 'redirect_url' => $result['redirect_url']], Response::HTTP_CREATED);
    }

    public function bankTransfer(Request $request, Booking $booking): JsonResponse
    {
        $this->authorizeBooking($request, $booking);
        $validated = $request->validate([
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', UploadLimit::rule()],
            'sender_name' => ['required', 'string', 'max:150'],
            'transferred_on' => ['required', 'date', 'before_or_equal:today', 'after:-60 days'],
        ], [
            'proof.mimes' => 'Upload a photo (JPG, PNG, WebP) or PDF of your transfer receipt.',
            'proof.max' => UploadLimit::message('The file'),
        ]);
        $this->assertAwaitingPayment($booking);

        $booking->loadMissing(['invoice', 'user']);
        $payment = $this->payments->submitBankTransfer($booking->invoice, $booking->user, $request->file('proof'), $validated['sender_name'], $validated['transferred_on']);

        return (new PaymentResource($payment))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Called when the customer comes back from the gateway. Re-checks with the gateway itself.
     */
    public function verifyPayment(Request $request, Booking $booking, Payment $payment): JsonResponse
    {
        $this->authorizeBooking($request, $booking);
        abort_unless($payment->invoice_id !== null && $payment->invoice_id === $booking->invoice_id, 404);

        $message = null;
        try {
            $payment = $this->payments->confirm($payment);
        } catch (GatewayException $exception) {
            $message = $exception->getMessage();
        }

        return response()->json([
            'payment' => new PaymentResource($payment),
            'booking' => $this->present($booking->refresh()),
            'message' => $message,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function bookingRules(): array
    {
        return [
            'space' => ['required', 'string', 'max:120'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'rate_unit' => ['required', 'string', Rule::in(SpaceRate::UNITS)],
            'quantity' => ['required', 'integer', 'min:1', 'max:90'],
            'seats' => ['required', 'integer', 'min:1', 'max:1000'],
            'addons' => ['nullable', 'array', 'max:20'],
            'addons.*.id' => ['required', 'integer'],
            'addons.*.quantity' => ['required', 'integer', 'min:0', 'max:100'],
            'use_pass' => ['nullable', 'boolean'],
        ];
    }

    private function findSpace(string $slug): Space
    {
        return Space::active()
            ->where('slug', $slug)
            ->whereHas('location', fn ($query) => $query->where('is_active', true))
            ->with(['location', 'type', 'cancellationPolicy', 'rates', 'addons'])
            ->firstOrFail();
    }

    /**
     * The signed-in user on routes that also allow guests.
     */
    private function customer(Request $request): ?User
    {
        $user = $request->user('sanctum');

        return $user instanceof User ? $user : null;
    }

    /**
     * The booking's owner (signed in) or anyone holding its private token. Others get 404,
     * so references can't be probed.
     */
    private function authorizeBooking(Request $request, Booking $booking): void
    {
        if ($this->customer($request)?->id === $booking->user_id) {
            return;
        }

        abort_unless($booking->matchesManageToken($request->string('token')->toString() ?: null), 404);
    }

    private function assertAwaitingPayment(Booking $booking): void
    {
        abort_unless($booking->status === BookingStatus::Held && $booking->invoice_id, 422, match ($booking->status) {
            BookingStatus::Expired => 'This hold has ended. Please book again.',
            BookingStatus::PendingApproval => "We're reviewing your request. You can pay once it's approved.",
            BookingStatus::Confirmed, BookingStatus::CheckedIn, BookingStatus::Completed => 'This booking is already paid.',
            default => 'This booking can no longer be paid.',
        });
    }

    private function present(Booking $booking): BookingResource
    {
        $booking->loadMissing(['space.location', 'addons', 'invoice.payments']);
        $resource = new BookingResource($booking);
        if ($booking->status->isCancellable()) {
            $paid = $booking->invoice ? max(0, $booking->invoice->amount_paid - $booking->invoice->amount_refunded) : 0;
            $resource->refundPreview = intdiv($paid * $this->bookings->policyRefundPercent($booking), 100);
        }

        return $resource;
    }
}
