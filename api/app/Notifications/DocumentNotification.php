<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\LegalDocument;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Asks a customer to read and sign a legal document.
 */
class DocumentNotification extends TemplatedNotification
{
    public function __construct(public LegalDocument $document) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::DocumentToSign;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return ['document_title' => $this->document->title];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::agreement($this->document->id);
    }
}
