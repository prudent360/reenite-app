<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\MailItem;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Virtual office emails to the customer: new mail arrived, or a scan is ready.
 */
class MailNotification extends TemplatedNotification
{
    public function __construct(public EmailTemplateKey $key, public MailItem $item) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return self::mailVariables($this->item);
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::mailbox();
    }

    /**
     * Placeholders shared with the staff alert.
     *
     * @return array<string, string>
     */
    public static function mailVariables(MailItem $item): array
    {
        $item->loadMissing('mailbox');

        return [
            'mailbox_number' => (string) $item->mailbox->number,
            'business_name' => $item->mailbox->business_name,
            'mail_kind' => strtolower(MailItem::KINDS[$item->kind] ?? 'item'),
            'sender' => $item->sender ?: 'an unknown sender',
            'received_date' => $item->received_at->timezone((string) config('app.display_timezone'))->format('j M Y'),
        ];
    }
}
