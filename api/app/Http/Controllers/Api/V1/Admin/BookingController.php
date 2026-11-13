<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Location;
use App\Models\Space;
use App\Workspace\BookingService;
use App\Workspace\SeatPlanner;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Front desk and operations: the day's bookings, check-in, approvals and cancellations.
 */
class BookingController extends Controller
{
    public function __construct(private BookingService $bookings) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', 'string'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'space_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $statuses = array_filter(explode(',', (string) $request->input('status')));

        $bookings = Booking::query()
            ->with(['user', 'space.location', 'invoice'])
            ->when($statuses, fn ($query) => $query->whereIn('status', $statuses))
            ->when($request->filled('space_id'), fn ($query) => $query->where('space_id', $request->integer('space_id')))
            ->when($request->filled('date'), function ($query) use ($request) {
                [$from, $to] = $this->dayRange((string) $request->input('date'));
                $query->where('starts_at', '<', $to)->where('ends_at', '>', $from);
            })
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($inner) => $inner
                    ->where('reference', 'like', $term)
                    ->orWhere('check_in_code', 'like', $term)
                    ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $term)->orWhere('email', 'like', $term)->orWhere('phone', 'like', $term)));
            })
            ->when($request->filled('date'), fn ($query) => $query->orderBy('starts_at'), fn ($query) => $query->orderByDesc('starts_at'))
            ->orderByDesc('id')
            ->paginate(25);

        return BookingResource::collection($bookings);
    }

    /**
     * Everything for the front desk's day view: each space's bookings on that date, plus counts.
     */
    public function day(Request $request): JsonResponse
    {
        $validated = $request->validate(['date' => ['nullable', 'date_format:Y-m-d']]);
        $date = $validated['date'] ?? now()->timezone((string) config('app.display_timezone'))->toDateString();
        [$from, $to] = $this->dayRange($date);

        $bookings = Booking::query()
            ->whereIn('status', [BookingStatus::Held->value, BookingStatus::PendingApproval->value, BookingStatus::Confirmed->value, BookingStatus::CheckedIn->value, BookingStatus::Completed->value])
            ->where('starts_at', '<', $to)
            ->where('ends_at', '>', $from)
            ->with(['user', 'assignedSeats'])
            ->orderBy('starts_at')
            ->get()
            ->filter(fn (Booking $booking) => $booking->status !== BookingStatus::Held || $booking->isOccupying());

        $locations = Location::active()->ordered()
            ->with(['spaces' => fn ($query) => $query->active()->ordered()->with('type')])
            ->get();

        return response()->json([
            'date' => $date,
            'counts' => [
                'bookings' => $bookings->count(),
                'arrivals' => $bookings->where('status', BookingStatus::Confirmed)->count(),
                'checked_in' => $bookings->where('status', BookingStatus::CheckedIn)->count(),
                'awaiting_approval' => Booking::where('status', BookingStatus::PendingApproval->value)->count(),
            ],
            'locations' => $locations->map(fn (Location $location) => [
                'id' => $location->id,
                'name' => $location->name,
                'timezone' => $location->timezone,
                'hours' => $location->hours,
                'spaces' => $location->spaces->map(fn (Space $space) => [
                    'id' => $space->id,
                    'name' => $space->name,
                    'capacity' => $space->capacity,
                    'is_shared' => $space->isShared(),
                    'bookings' => $bookings->where('space_id', $space->id)->values()->map(fn (Booking $booking) => [
                        'reference' => $booking->reference,
                        'status' => $booking->status->value,
                        'status_label' => $booking->status->label(),
                        'starts_at' => $booking->starts_at->toIso8601String(),
                        'ends_at' => $booking->ends_at->toIso8601String(),
                        'seats' => $booking->seats,
                        'seat_labels' => $booking->seatLabels(),
                        'customer' => $booking->user->name,
                    ]),
                ]),
            ]),
        ]);
    }

    /**
     * Sessions not checked in this long after they started count as "not arrived".
     */
    public const NOT_ARRIVED_AFTER_MINUTES = 30;

    /**
     * The session monitor: everyone in a space right now, and everyone still due today.
     */
    public function monitor(): JsonResponse
    {
        $timezone = (string) config('app.display_timezone');
        $endOfToday = now()->setTimezone($timezone)->endOfDay()->utc();

        $sessions = Booking::query()
            ->whereIn('status', [BookingStatus::Confirmed->value, BookingStatus::CheckedIn->value])
            ->where('ends_at', '>', now())
            ->where('starts_at', '<=', $endOfToday)
            ->with(['user', 'assignedSeats', 'customerPass.plan'])
            ->orderBy('ends_at')
            ->get()
            ->map(function (Booking $booking) {
                $active = $booking->starts_at->lessThanOrEqualTo(now());
                $lengthMinutes = $booking->starts_at->diffInMinutes($booking->ends_at, true);

                return [
                    'reference' => $booking->reference,
                    'status' => $booking->status->value,
                    'phase' => $active ? 'active' : 'upcoming',
                    'customer' => ['name' => $booking->user->name, 'email' => $booking->user->email, 'phone' => $booking->user->phone],
                    'space_name' => $booking->space_name,
                    'location_name' => $booking->location_name,
                    'seat_labels' => $booking->seatLabels(),
                    'people' => $booking->seats,
                    'length_label' => $this->lengthLabel($booking),
                    'starts_at' => $booking->starts_at->toIso8601String(),
                    'ends_at' => $booking->ends_at->toIso8601String(),
                    'checked_in_at' => $booking->checked_in_at?->toIso8601String(),
                    'ending_soon' => $active && BookingService::isEndingSoon($booking),
                    // Day-or-shorter sessions only: long bookings check in once and come and go.
                    'not_arrived' => $active && $booking->status === BookingStatus::Confirmed && $lengthMinutes <= 24 * 60
                        && $booking->starts_at->lessThanOrEqualTo(now()->subMinutes(self::NOT_ARRIVED_AFTER_MINUTES)),
                    'can_check_in' => $booking->status === BookingStatus::Confirmed && $booking->starts_at->lessThanOrEqualTo(now()->addHours(2)),
                ];
            });

        $active = $sessions->where('phase', 'active');

        return response()->json([
            'data' => [
                'generated_at' => now()->toIso8601String(),
                'counts' => [
                    'active' => $active->count(),
                    'ending_soon' => $active->where('ending_soon', true)->count(),
                    'not_arrived' => $active->where('not_arrived', true)->count(),
                    'upcoming' => $sessions->where('phase', 'upcoming')->count(),
                    'checked_in' => $active->where('status', BookingStatus::CheckedIn->value)->count(),
                ],
                'sessions' => $sessions->values(),
            ],
        ]);
    }

    /**
     * Ends a session in progress now, freeing the rest of its time.
     */
    public function end(Request $request, Booking $booking): BookingResource
    {
        $this->bookings->endEarly($booking, $request->user());

        return $this->show($booking->refresh());
    }

    /**
     * "3 hours", "1 day", "1 month", or the pass it was booked with.
     */
    private function lengthLabel(Booking $booking): string
    {
        if ($booking->paid_via === 'pass' && $booking->customerPass?->plan) {
            return $booking->customerPass->plan->name;
        }
        $quantity = max(1, (int) $booking->quantity);

        return $quantity.' '.$booking->rate_unit.($quantity === 1 ? '' : 's');
    }

    public function show(Booking $booking): BookingResource
    {
        $booking->load(['user', 'space.location', 'addons', 'assignedSeats', 'invoice.payments', 'checkedInBy']);
        $resource = new BookingResource($booking);
        if ($booking->status->isCancellable()) {
            $paid = $booking->invoice ? max(0, $booking->invoice->amount_paid - $booking->invoice->amount_refunded) : 0;
            $resource->refundPreview = intdiv($paid * $this->bookings->policyRefundPercent($booking), 100);
        }

        return $resource;
    }

    /**
     * The space's seats for this booking's time, so staff can move the booking to other free seats.
     */
    public function seats(SeatPlanner $seatPlanner, Booking $booking): JsonResponse
    {
        $space = $booking->space()->with('type')->firstOrFail();

        return response()->json([
            'data' => $seatPlanner->seatMap($space, CarbonImmutable::instance($booking->starts_at), CarbonImmutable::instance($booking->ends_at), $booking->id)
                + ['current' => $booking->assignedSeats()->pluck('space_seats.id')],
        ]);
    }

    public function moveSeats(Request $request, SeatPlanner $seatPlanner, Booking $booking): BookingResource
    {
        abort_unless($booking->status->isCancellable() && $booking->ends_at->isFuture(), 422, 'Only upcoming bookings can be moved to other seats.');
        $validated = $request->validate(['seat_ids' => ['required', 'array', 'min:1', 'max:50'], 'seat_ids.*' => ['integer', 'distinct']]);

        $seatPlanner->move($booking, $validated['seat_ids']);

        return $this->show($booking->refresh());
    }

    public function checkIn(Request $request, Booking $booking): BookingResource
    {
        return new BookingResource($this->bookings->checkIn($booking, $request->user())->load(['user', 'space.location', 'assignedSeats']));
    }

    /**
     * Check-in from the code a customer shows at the desk.
     */
    public function checkInByCode(Request $request): BookingResource
    {
        $validated = $request->validate(['code' => ['required', 'string', 'max:12']]);
        $booking = Booking::where('check_in_code', mb_strtoupper(trim($validated['code'])))->first();
        abort_unless($booking, 404, 'No booking has that code. Check it and try again.');

        return $this->checkIn($request, $booking);
    }

    public function cancel(Request $request, Booking $booking): BookingResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
            'refund_percent' => ['required', 'integer', Rule::in([0, 25, 50, 75, 100])],
        ]);

        $this->bookings->cancel($booking, $request->user(), $validated['reason'], (int) $validated['refund_percent']);

        return $this->show($booking->refresh());
    }

    public function approve(Booking $booking): BookingResource
    {
        $this->bookings->approve($booking);

        return $this->show($booking->refresh());
    }

    public function decline(Request $request, Booking $booking): BookingResource
    {
        abort_unless($booking->status === BookingStatus::PendingApproval, 422, 'Only bookings awaiting approval can be declined.');
        $validated = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $this->bookings->cancel($booking, $request->user(), $validated['reason'], 100);

        return $this->show($booking->refresh());
    }

    /**
     * A calendar date at the main location, as a UTC range.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function dayRange(string $date): array
    {
        $start = CarbonImmutable::createFromFormat('!Y-m-d', $date, (string) config('app.display_timezone'));

        return [$start->utc(), $start->addDay()->utc()];
    }
}
