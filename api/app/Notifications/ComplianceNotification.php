<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\ComplianceItem;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Compliance calendar reminders: a deadline is coming up, or was missed.
 */
class ComplianceNotification extends TemplatedNotification
{
    public function __construct(public EmailTemplateKey $key, public ComplianceItem $item) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        $this->item->loadMissing('business');
        $days = $this->item->daysLeft();

        return [
            'business_name' => $this->item->business->name,
            'deadline' => $this->item->title,
            'period' => $this->item->period_label ?: $this->item->due_on->format('Y'),
            'due_date' => $this->item->due_on->format('l j F Y'),
            'days_left' => match (true) {
                $days === 0 => 'today',
                $days === 1 => 'tomorrow',
                $days > 1 => "in {$days} days",
                $days === -1 => 'yesterday',
                default => abs($days).' days ago',
            },
            'authority' => ComplianceItem::KINDS[$this->item->kind]['authority'] ?: 'relevant authority',
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::compliance($this->item->business_id);
    }
}
