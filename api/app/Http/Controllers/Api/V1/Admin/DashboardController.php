<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Admin\Finance\SummaryController;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Headline numbers for the admin overview. Order and booking figures join in later milestones.
     */
    public function summary(Request $request): JsonResponse
    {
        $customers = fn (): Builder => User::where('type', User::TYPE_CUSTOMER);

        return response()->json([
            'stats' => [
                'customers' => $customers()->count(),
                'new_customers_7d' => $customers()->where('created_at', '>=', now()->subDays(7))->count(),
                'new_customers_30d' => $customers()->where('created_at', '>=', now()->subDays(30))->count(),
                'unverified_customers' => $customers()->whereNull('email_verified_at')->count(),
                'staff' => User::where('type', User::TYPE_STAFF)->count(),
            ],
            'signups_by_month' => $this->signupsByMonth($customers),
            // Revenue is only shown to roles that can see payments.
            'revenue_by_month' => $request->user()->can('payments.view') ? SummaryController::revenueByMonth() : null,
            'recent_customers' => UserResource::collection(
                $customers()->with('roles')->latest()->limit(5)->get()
            ),
        ]);
    }

    /**
     * Customer sign-ups for the current month and the five before it, oldest first.
     * Counted per month in PHP-built ranges so it works the same on SQLite and MySQL.
     *
     * @param  callable(): Builder  $customers
     * @return list<array{month: string, label: string, value: int}>
     */
    private function signupsByMonth(callable $customers): array
    {
        $timezone = config('app.display_timezone');

        return collect(range(5, 0))
            ->map(function (int $monthsAgo) use ($customers, $timezone) {
                $start = now($timezone)->startOfMonth()->subMonthsNoOverflow($monthsAgo);

                return [
                    'month' => $start->format('Y-m'),
                    'label' => $start->format('M'),
                    'value' => $customers()
                        ->where('created_at', '>=', $start->copy()->utc())
                        ->where('created_at', '<', $start->copy()->addMonthNoOverflow()->utc())
                        ->count(),
                ];
            })
            ->all();
    }
}
