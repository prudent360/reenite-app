<?php

namespace App\Http\Controllers\Api\V1\Admin\Finance;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Refund;
use Illuminate\Http\JsonResponse;

class SummaryController extends Controller
{
    /**
     * Headline numbers and the monthly revenue chart. Amounts in kobo.
     */
    public function __invoke(): JsonResponse
    {
        $settled = fn () => Payment::whereIn('status', [PaymentStatus::Success->value, PaymentStatus::PartiallyRefunded->value, PaymentStatus::Refunded->value]);

        return response()->json([
            'collected_30d' => (int) $settled()->where('paid_at', '>=', now()->subDays(30))->sum('amount'),
            'refunded_30d' => (int) Refund::where('created_at', '>=', now()->subDays(30))->sum('amount'),
            'outstanding' => (int) Invoice::where('status', InvoiceStatus::Unpaid->value)->selectRaw('coalesce(sum(total - amount_paid), 0) as balance')->value('balance'),
            'unpaid_invoices' => Invoice::where('status', InvoiceStatus::Unpaid->value)->count(),
            'awaiting_review' => Payment::where('status', PaymentStatus::AwaitingReview->value)->count(),
            'revenue_by_month' => self::revenueByMonth(),
        ]);
    }

    /**
     * Money received per month (by payment date) for the current month and the five before it.
     *
     * @return list<array{month: string, label: string, value: int}>
     */
    public static function revenueByMonth(): array
    {
        $timezone = (string) config('app.display_timezone');

        return collect(range(5, 0))->map(function (int $monthsAgo) use ($timezone) {
            $start = now($timezone)->startOfMonth()->subMonthsNoOverflow($monthsAgo);

            return [
                'month' => $start->format('Y-m'),
                'label' => $start->format('M'),
                'value' => (int) Payment::whereIn('status', [PaymentStatus::Success->value, PaymentStatus::PartiallyRefunded->value, PaymentStatus::Refunded->value])
                    ->where('paid_at', '>=', $start->copy()->utc())
                    ->where('paid_at', '<', $start->copy()->addMonthNoOverflow()->utc())
                    ->sum('amount'),
            ];
        })->all();
    }
}
