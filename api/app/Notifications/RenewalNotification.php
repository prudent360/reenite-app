<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Renewal emails for passes and memberships: due, coming up automatically, or failed.
 */
class RenewalNotification extends TemplatedNotification
{
    /**
     * @param  array<string, string>  $values  plan_name, renews_on, amount, card, and reason/next_try for failures
     */
    public function __construct(public EmailTemplateKey $key, public CustomerPass|CustomerMembership $plan, public array $values, public ?int $invoiceId = null) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return $this->values;
    }

    protected function actionUrl(User $notifiable): string
    {
        return $this->invoiceId ? FrontendLinks::invoice($this->invoiceId) : FrontendLinks::workspacePlans();
    }
}
