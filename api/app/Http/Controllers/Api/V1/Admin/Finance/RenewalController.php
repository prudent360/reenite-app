<?php

namespace App\Http\Controllers\Api\V1\Admin\Finance;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Payments\PaymentReminders;
use App\Workspace\RenewalService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

/**
 * Money coming up and money owed: plans ending in the next two weeks (and how they'll renew),
 * renewals that failed, and overdue invoices.
 */
class RenewalController extends Controller
{
    public function __invoke(RenewalService $renewals): JsonResponse
    {
        $upcoming = $this->plans(fn (Builder $query) => $query->where('status', CustomerPass::ACTIVE)->whereBetween('ends_at', [now(), now()->addDays(14)])
            ->whereDoesntHave('renewal', fn (Builder $renewal) => $renewal->where('status', CustomerPass::ACTIVE)))
            ->sortBy('ends_at')->values();
        $failed = $this->plans(fn (Builder $query) => $query->whereNotNull('renewal_failure')->where('ends_at', '>', now()->subDays(RenewalService::ABANDON_DAYS))
            ->whereDoesntHave('renewal', fn (Builder $renewal) => $renewal->where('status', CustomerPass::ACTIVE)))
            ->sortByDesc('last_renewal_attempt_at')->values();

        $cards = [];
        $row = function (CustomerPass|CustomerMembership $plan) use ($renewals, &$cards) {
            $cards[$plan->user_id] ??= $renewals->cardFor($plan->user);

            return [
                'kind' => $plan instanceof CustomerPass ? 'pass' : 'membership',
                'id' => $plan->id,
                'name' => $plan->name,
                'customer' => ['id' => $plan->user->id, 'name' => $plan->user->name, 'email' => $plan->user->email],
                'status' => $plan->status,
                'ends_at' => $plan->ends_at?->toIso8601String(),
                'price' => $plan->plan?->price,
                'auto_renew' => $plan->auto_renew,
                'card' => $cards[$plan->user_id]?->label(),
                'attempts' => $plan->renewal_attempts,
                'last_attempt_at' => $plan->last_renewal_attempt_at?->toIso8601String(),
                'failure' => $plan->renewal_failure,
                'renewal_invoice_id' => $plan->renewal?->invoice_id,
            ];
        };

        $overdue = Invoice::query()
            ->where('status', InvoiceStatus::Unpaid->value)
            ->whereColumn('amount_paid', '<', 'total')
            ->whereDate('due_at', '<', now((string) config('app.display_timezone'))->toDateString())
            ->where(fn (Builder $query) => PaymentReminders::owed($query))
            ->with('user')
            ->orderBy('due_at')
            ->limit(50)
            ->get();

        return response()->json([
            'upcoming' => $upcoming->map($row),
            'failed' => $failed->map($row),
            'overdue' => $overdue->map(fn (Invoice $invoice) => [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'customer' => ['id' => $invoice->user->id, 'name' => $invoice->user->name, 'email' => $invoice->user->email],
                'balance' => $invoice->balance(),
                'due_at' => $invoice->due_at?->toDateString(),
                'reminders_sent' => count($invoice->reminders_sent ?? []),
            ]),
            'stats' => [
                'renewing_14_days' => $upcoming->sum(fn ($plan) => (int) ($plan->plan?->price ?? 0)),
                'auto_renew_share' => $upcoming->isEmpty() ? null : (int) round($upcoming->where('auto_renew', true)->count() / $upcoming->count() * 100),
                'overdue_total' => $overdue->sum(fn (Invoice $invoice) => $invoice->balance()),
            ],
        ]);
    }

    /**
     * @return Collection<int, CustomerPass|CustomerMembership>
     */
    private function plans(callable $scope): Collection
    {
        return collect([CustomerPass::class, CustomerMembership::class])
            ->flatMap(fn (string $model) => $model::query()->where($scope)->with(['user', 'plan', 'renewal'])->limit(100)->get());
    }
}
