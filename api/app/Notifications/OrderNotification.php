<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\Order;
use App\Models\User;
use App\Support\FrontendLinks;
use Illuminate\Support\Str;

/**
 * Order emails. One class serves every order template; the template decides the wording.
 */
class OrderNotification extends TemplatedNotification
{
    /**
     * @param  array<string, string>  $extra  e.g. stage_name, message, officer_name
     */
    public function __construct(public EmailTemplateKey $key, public Order $order, public array $extra = []) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return $this->extra + [
            'order_reference' => (string) $this->order->reference,
            'service_name' => $this->order->service_name,
            'due_date' => $this->order->due_at?->timezone((string) config('app.display_timezone'))->format('j M Y') ?? 'soon',
            'officer_name' => $this->order->assignee ? Str::before($this->order->assignee->name, ' ') : 'Your Reenite officer',
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::order((string) $this->order->reference);
    }
}
