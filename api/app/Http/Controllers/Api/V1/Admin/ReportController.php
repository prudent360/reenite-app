<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Space;
use App\Models\User;
use App\Workspace\Availability;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Business reports for a date range: money in, bookings and space use, services sold and new
 * customers. Totals are worked out in PHP over the range, so they match on SQLite and MySQL.
 */
class ReportController extends Controller
{
    /**
     * Payments that brought money in (refunds are counted separately).
     *
     * @var list<string>
     */
    private const COLLECTED = ['success', 'partially_refunded', 'refunded'];

    /**
     * Bookings that actually used the space.
     *
     * @var list<string>
     */
    private const USED = ['confirmed', 'checked_in', 'completed'];

    public function summary(Request $request, Availability $availability): JsonResponse
    {
        [$from, $to] = $this->range($request);
        $previous = [$from->sub($to->diffAsCarbonInterval($from)), $from];

        $payments = $this->payments($from, $to);
        $refunded = (int) Refund::whereBetween('created_at', [$from, $to])->sum('amount');
        $collected = (int) $payments->sum('amount');
        $previousCollected = (int) Payment::whereIn('status', self::COLLECTED)->whereBetween('paid_at', $previous)->sum('amount');

        $bookings = Booking::query()
            ->whereIn('status', self::USED)
            ->where('starts_at', '>=', $from)
            ->where('starts_at', '<', $to)
            ->get(['id', 'space_id', 'starts_at', 'ends_at', 'seats', 'total']);
        $cancelled = Booking::where('status', BookingStatus::Cancelled->value)->whereBetween('cancelled_at', [$from, $to])->count();

        $orders = Order::query()
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from, $to])
            ->with('invoice:id,total')
            ->get(['id', 'service_name', 'invoice_id']);

        $customers = User::where('type', User::TYPE_CUSTOMER)->whereBetween('created_at', [$from, $to]);

        return response()->json([
            'from' => $from->setTimezone($this->timezone())->toDateString(),
            'to' => $to->subSecond()->setTimezone($this->timezone())->toDateString(),
            'totals' => [
                'collected' => $collected,
                'refunded' => $refunded,
                'net' => $collected - $refunded,
                'previous_collected' => $previousCollected,
                'payments' => $payments->count(),
                'bookings' => $bookings->count(),
                'booked_hours' => round($bookings->sum(fn (Booking $booking) => $booking->starts_at->diffInMinutes($booking->ends_at) / 60), 1),
                'cancelled_bookings' => $cancelled,
                'orders' => $orders->count(),
                'new_customers' => (clone $customers)->where('status', '!=', User::STATUS_GUEST)->count(),
                'new_guests' => (clone $customers)->where('status', User::STATUS_GUEST)->count(),
            ],
            'revenue_interval' => $from->diffInDays($to) > 62 ? 'week' : 'day',
            'revenue_series' => $this->series($payments, $from, $to),
            'revenue_by_source' => $payments
                ->groupBy(fn (Payment $payment) => $this->source($payment))
                ->map(fn (Collection $group, string $source) => ['source' => $source, 'amount' => (int) $group->sum('amount'), 'count' => $group->count()])
                ->sortByDesc('amount')
                ->values(),
            'payment_methods' => $payments
                ->groupBy('gateway')
                ->map(fn (Collection $group, string $gateway) => [
                    'method' => $gateway === Payment::BANK_TRANSFER ? 'Bank transfer' : ucfirst($gateway),
                    'amount' => (int) $group->sum('amount'),
                    'count' => $group->count(),
                ])
                ->sortByDesc('amount')
                ->values(),
            'spaces' => $this->spaces($bookings, $from, $to, $availability),
            'services' => $orders
                ->groupBy('service_name')
                ->map(fn (Collection $group, string $name) => ['service' => $name, 'orders' => $group->count(), 'amount' => (int) $group->sum(fn (Order $order) => $order->invoice?->total ?? 0)])
                ->sortByDesc('orders')
                ->values()
                ->take(10),
            'plans' => [
                'passes_sold' => CustomerPass::whereNotNull('starts_at')->whereBetween('starts_at', [$from, $to])->count(),
                'memberships_sold' => CustomerMembership::whereNotNull('starts_at')->whereBetween('starts_at', [$from, $to])->count(),
                'active_memberships' => CustomerMembership::where('status', CustomerMembership::ACTIVE)->count(),
            ],
        ]);
    }

    /**
     * Every payment in the range as a spreadsheet, for accounting.
     */
    public function paymentsCsv(Request $request): StreamedResponse
    {
        [$from, $to] = $this->range($request);
        $payments = $this->payments($from, $to);
        $timezone = $this->timezone();
        $filename = 'reenite-payments-'.$from->setTimezone($timezone)->toDateString().'-to-'.$to->subSecond()->setTimezone($timezone)->toDateString().'.csv';

        return response()->streamDownload(function () use ($payments, $timezone) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date', 'Receipt', 'Reference', 'Customer', 'Email', 'For', 'Method', 'Amount (NGN)', 'Refunded (NGN)', 'Invoice']);
            foreach ($payments as $payment) {
                fputcsv($out, [
                    $payment->paid_at?->setTimezone($timezone)->format('Y-m-d H:i'),
                    $payment->receipt_number,
                    $payment->reference,
                    $payment->user?->name,
                    $payment->user?->email,
                    $this->source($payment),
                    $payment->gateway === Payment::BANK_TRANSFER ? 'Bank transfer' : ucfirst($payment->gateway),
                    number_format($payment->amount / 100, 2, '.', ''),
                    number_format($payment->amount_refunded / 100, 2, '.', ''),
                    $payment->invoice?->number,
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * The requested range as UTC instants: from the start of `from` to the end of `to`, in Uyo time.
     * A `preset` (7d, 30d, 90d or ytd) counts back from today instead. Defaults to the last 30 days.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function range(Request $request): array
    {
        $validated = $request->validate([
            'preset' => ['nullable', 'in:7d,30d,90d,ytd'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $timezone = $this->timezone();
        $today = CarbonImmutable::now($timezone)->startOfDay();
        $to = isset($validated['to']) && ! isset($validated['preset']) ? CarbonImmutable::createFromFormat('!Y-m-d', $validated['to'], $timezone) : $today;
        $from = match ($validated['preset'] ?? null) {
            '7d' => $today->subDays(6),
            '90d' => $today->subDays(89),
            'ytd' => $today->startOfYear(),
            '30d' => $today->subDays(29),
            default => isset($validated['from']) ? CarbonImmutable::createFromFormat('!Y-m-d', $validated['from'], $timezone) : $to->subDays(29),
        };
        abort_if($from->diffInDays($to) > 366, 422, 'Choose a range of a year or less.');

        return [$from->utc(), $to->addDay()->utc()];
    }

    /**
     * @return Collection<int, Payment>
     */
    private function payments(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return Payment::query()
            ->whereIn('status', self::COLLECTED)
            ->whereBetween('paid_at', [$from, $to])
            ->with(['invoice:id,number,source_type,source_id', 'user:id,name,email'])
            ->orderBy('paid_at')
            ->get();
    }

    /**
     * What a payment was for, from the invoice's source.
     */
    private function source(Payment $payment): string
    {
        return match ($payment->invoice?->source_type) {
            Order::class => 'Business services',
            Booking::class => 'Space bookings',
            CustomerPass::class, CustomerMembership::class => 'Passes and memberships',
            default => 'Other invoices',
        };
    }

    /**
     * Money collected per day (ranges up to two months) or per week, with empty periods kept.
     *
     * @param  Collection<int, Payment>  $payments
     * @return list<array{key: string, label: string, amount: int}>
     */
    private function series(Collection $payments, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $timezone = $this->timezone();
        $weekly = $from->diffInDays($to) > 62;
        $buckets = [];
        for ($cursor = $from->setTimezone($timezone); $cursor->lessThan($to); $cursor = $weekly ? $cursor->addWeek() : $cursor->addDay()) {
            $start = $weekly ? $cursor->startOfWeek() : $cursor;
            $buckets[$start->toDateString()] ??= ['key' => $start->toDateString(), 'label' => $weekly ? 'w/c '.$start->format('j M') : $start->format('j M'), 'amount' => 0];
        }
        foreach ($payments as $payment) {
            $local = $payment->paid_at->setTimezone($timezone);
            $key = ($weekly ? $local->startOfWeek() : $local->startOfDay())->toDateString();
            if (isset($buckets[$key])) {
                $buckets[$key]['amount'] += $payment->amount;
            }
        }

        return array_values($buckets);
    }

    /**
     * Each space's bookings, hours, takings and how full it was: booked hours (seat-hours for
     * shared spaces) against the hours it was open in the range.
     *
     * @param  Collection<int, Booking>  $bookings
     * @return list<array<string, mixed>>
     */
    private function spaces(Collection $bookings, CarbonImmutable $from, CarbonImmutable $to, Availability $availability): array
    {
        $spaces = Space::with(['location', 'type'])->orderBy('sort_order')->orderBy('name')->get();
        $timezone = $this->timezone();

        return $spaces->map(function (Space $space) use ($bookings, $from, $to, $availability, $timezone) {
            $mine = $bookings->where('space_id', $space->id);
            $openHours = 0.0;
            for ($day = $from->setTimezone($timezone)->startOfDay(); $day->lessThan($to); $day = $day->addDay()) {
                $hours = $availability->hoursFor($space, $day);
                if ($hours) {
                    $openHours += CarbonImmutable::createFromFormat('H:i', $hours['opens'])->diffInMinutes(CarbonImmutable::createFromFormat('H:i', $hours['closes'])) / 60;
                }
            }
            $bookedHours = $mine->sum(fn (Booking $booking) => $booking->starts_at->diffInMinutes($booking->ends_at) / 60 * ($space->isShared() ? $booking->seats : 1));
            $capacityHours = $openHours * ($space->isShared() ? $space->capacity : 1);

            return [
                'space' => $space->name,
                'location' => $space->location->name,
                'is_shared' => $space->isShared(),
                'bookings' => $mine->count(),
                'hours' => round($mine->sum(fn (Booking $booking) => $booking->starts_at->diffInMinutes($booking->ends_at) / 60), 1),
                'amount' => (int) $mine->sum('total'),
                'occupancy' => $capacityHours > 0 ? (int) round(min(100, $bookedHours / $capacityHours * 100)) : 0,
            ];
        })->all();
    }

    private function timezone(): string
    {
        return (string) config('app.display_timezone');
    }
}
