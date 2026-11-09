<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\User;
use App\Support\FrontendLinks;
use App\Support\Money;

/**
 * Pass and membership emails.
 */
class PlanNotification extends TemplatedNotification
{
    public function __construct(public EmailTemplateKey $key, public CustomerPass|CustomerMembership $plan) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        $this->plan->loadMissing('invoice');
        $until = $this->plan->ends_at?->timezone((string) config('app.display_timezone'))->format('j M Y') ?? '';
        $amount = Money::format($this->plan->invoice->total ?? 0);

        if ($this->plan instanceof CustomerPass) {
            $unit = $this->plan->credit_type === 'hours' ? 'hour' : 'visit';

            return [
                'pass_name' => $this->plan->name,
                'allowance' => $this->plan->credits.' '.str($unit)->plural($this->plan->credits).' a '.$this->plan->period,
                'credits_left' => (string) $this->plan->creditsLeft(),
                'valid_until' => $until,
                'amount' => $amount,
            ];
        }

        return [
            'plan_name' => $this->plan->name,
            'discount' => $this->plan->discount_percent.'%',
            'renews_on' => $until,
            'amount' => $amount,
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::workspacePlans();
    }
}
