<?php

namespace App\Compliance;

use App\Enums\EmailTemplateKey;
use App\Models\Business;
use App\Models\ComplianceItem;
use App\Notifications\ComplianceNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Works out a business's filing deadlines from what it is and which taxes it pays, keeps the
 * calendar topped up, and emails reminders as deadlines approach.
 *
 * The dates follow the usual Nigerian rules. They are estimates: the customer's officer can
 * confirm the exact date, and customers can dismiss anything that doesn't apply to them.
 */
class ComplianceCalendar
{
    /** Monthly returns are shown this many months ahead. */
    public const MONTHS_AHEAD = 3;

    /** Reminder stages: days before the due date. */
    public const REMIND_DAYS = ['14d' => 14, '3d' => 3];

    /**
     * Brings the business's calendar up to date: adds deadlines that apply and are missing, and
     * removes future ones that no longer apply (for example, after VAT registration is turned off).
     * Deadlines already done or dismissed, and custom reminders, are never touched.
     */
    public function refresh(Business $business): void
    {
        $today = ComplianceItem::today();
        $wanted = collect($this->deadlines($business, $today))->keyBy(fn (array $deadline) => $deadline['kind'].'|'.$deadline['due_on']->toDateString());

        DB::transaction(function () use ($business, $today, $wanted) {
            $existing = $business->complianceItems()->where('is_custom', false)->get();

            foreach ($existing as $item) {
                $key = $item->kind.'|'.$item->due_on->toDateString();
                if ($wanted->has($key)) {
                    $wanted->forget($key);

                    continue;
                }
                if ($item->status === ComplianceItem::OPEN && $item->due_on->toDateString() >= $today->toDateString()) {
                    $item->delete();
                }
            }

            foreach ($wanted as $deadline) {
                $business->complianceItems()->create([
                    'kind' => $deadline['kind'],
                    'title' => $deadline['title'],
                    'period_label' => $deadline['period'],
                    'due_on' => $deadline['due_on']->toDateString(),
                    'status' => ComplianceItem::OPEN,
                ]);
            }
        });
    }

    /**
     * The deadlines from today onwards that apply to this business.
     *
     * @return list<array{kind: string, title: string, period: string|null, due_on: CarbonImmutable}>
     */
    public function deadlines(Business $business, CarbonImmutable $today): array
    {
        $deadlines = [];
        $yearEnd = $today->addMonths(13);

        // CAC annual returns: a company's first is due 18 months after incorporation, then yearly.
        // Business names and incorporated trustees file every year from the first anniversary.
        if ($business->registered_on) {
            $registered = CarbonImmutable::parse($business->registered_on->toDateString());
            $first = $business->entity_type === Business::COMPANY ? $registered->addMonthsNoOverflow(18) : $registered->addYearNoOverflow();
            $due = $first;
            while ($due->lessThan($today)) {
                $due = $due->addYearNoOverflow();
            }
            if ($due->lessThanOrEqualTo($yearEnd)) {
                $deadlines[] = ['kind' => 'annual_returns', 'title' => 'File CAC annual returns', 'period' => (string) $due->year, 'due_on' => $due];
            }
        }

        // Monthly returns are due for the month just gone: VAT by the 21st, PAYE by the 10th.
        foreach (['vat' => [$business->vat_registered, 21, 'File VAT return'], 'paye' => [$business->has_employees, 10, 'Remit PAYE for your staff']] as $kind => [$applies, $day, $title]) {
            if (! $applies) {
                continue;
            }
            $month = $today->startOfMonth()->subMonth();
            $added = 0;
            while ($added < self::MONTHS_AHEAD) {
                $due = $month->addMonth()->setDay($day);
                if ($due->greaterThanOrEqualTo($today)) {
                    $deadlines[] = ['kind' => $kind, 'title' => $title, 'period' => $month->format('F Y'), 'due_on' => $due];
                    $added++;
                }
                $month = $month->addMonth();
            }
        }

        // Company income tax: the return is due six months after the financial year ends.
        if ($business->entity_type === Business::COMPANY) {
            $yearEndMonth = max(1, min(12, $business->financial_year_end_month ?: 12));
            $financialYearEnd = $today->setDate($today->year - 1, $yearEndMonth, 1)->endOfMonth()->startOfDay();
            $due = $financialYearEnd->addMonthsNoOverflow(6)->endOfMonth()->startOfDay();
            while ($due->lessThan($today)) {
                $financialYearEnd = $financialYearEnd->addYearNoOverflow()->endOfMonth()->startOfDay();
                $due = $financialYearEnd->addMonthsNoOverflow(6)->endOfMonth()->startOfDay();
            }
            $deadlines[] = ['kind' => 'cit', 'title' => 'File company income tax return', 'period' => 'Year ended '.$financialYearEnd->format('j M Y'), 'due_on' => $due];
        }

        // A business name's owner files personal income tax by 31 March.
        if ($business->entity_type === Business::BUSINESS_NAME) {
            $due = $today->setDate($today->year, 3, 31);
            if ($due->lessThan($today)) {
                $due = $due->addYear();
            }
            $deadlines[] = ['kind' => 'personal_tax', 'title' => "File the owner's personal income tax return", 'period' => (string) ($due->year - 1), 'due_on' => $due];
        }

        // A tax clearance certificate runs to 31 December, so renew it before then.
        if (filled($business->tin)) {
            $due = $today->setDate($today->year, 12, 31);
            $deadlines[] = ['kind' => 'tcc', 'title' => 'Renew your tax clearance certificate', 'period' => (string) ($due->year + 1), 'due_on' => $due];
        }

        return $deadlines;
    }

    /**
     * Refreshes every business's calendar (run daily, so monthly deadlines roll forward).
     */
    public function refreshAll(): int
    {
        $count = 0;
        Business::query()->lazyById()->each(function (Business $business) use (&$count) {
            $this->refresh($business);
            $count++;
        });

        return $count;
    }

    /**
     * Emails the owner 14 days and 3 days before a deadline, and once the day after it's missed.
     * Each reminder goes once; if a deadline is added late, only the most urgent one is sent.
     */
    public function sendReminders(): int
    {
        $today = ComplianceItem::today();
        $sent = 0;

        ComplianceItem::query()
            ->where('status', ComplianceItem::OPEN)
            ->whereDate('due_on', '<=', $today->addDays(self::REMIND_DAYS['14d'])->toDateString())
            ->with('business.user')
            ->lazyById()
            ->each(function (ComplianceItem $item) use (&$sent) {
                $days = $item->daysLeft();
                $stage = match (true) {
                    $days < 0 => 'overdue',
                    $days <= self::REMIND_DAYS['3d'] => '3d',
                    default => '14d',
                };
                if ($item->wasReminded($stage)) {
                    return;
                }

                // Earlier stages count as covered, so a late-added deadline gets one reminder, not three.
                $covered = array_slice(['14d', '3d', 'overdue'], 0, array_search($stage, ['14d', '3d', 'overdue'], true) + 1);
                $item->update(['reminders_sent' => array_values(array_unique([...($item->reminders_sent ?? []), ...$covered]))]);

                $owner = $item->business->user;
                if ($owner->isActive()) {
                    $owner->notify(new ComplianceNotification($stage === 'overdue' ? EmailTemplateKey::ComplianceOverdue : EmailTemplateKey::ComplianceDueSoon, $item));
                    $sent++;
                }
            });

        return $sent;
    }
}
