<?php

namespace App\Workspace;

use App\Enums\EmailTemplateKey;
use App\Models\CustomerMembership;
use App\Models\Location;
use App\Models\Mailbox;
use App\Models\MailItem;
use App\Models\User;
use App\Notifications\MailNotification;
use App\Notifications\StaffAlertNotification;
use App\Support\FrontendLinks;
use App\Support\StaffAlerts;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Virtual office: mailboxes and the mail the front desk receives for them.
 */
class MailboxService
{
    /**
     * A membership that includes a mailbox was paid: open the mailbox, or extend it to the end
     * of the new period. Renewing keeps the same mailbox number.
     */
    public function openForMembership(CustomerMembership $membership): ?Mailbox
    {
        $membership->loadMissing(['plan', 'user']);
        $locationId = $membership->plan?->mailbox_location_id;
        if (! $locationId) {
            return null;
        }

        return DB::transaction(function () use ($membership, $locationId) {
            $mailbox = Mailbox::where('user_id', $membership->user_id)->where('location_id', $locationId)->lockForUpdate()->first();
            $until = $membership->ends_at;
            if ($mailbox?->active_until && $until && $mailbox->active_until->greaterThan($until)) {
                $until = $mailbox->active_until;
            }

            if ($mailbox) {
                // A mailbox staff opened with no end date stays open-ended.
                $mailbox->update([
                    'status' => Mailbox::ACTIVE,
                    'customer_membership_id' => $membership->id,
                    'active_until' => $mailbox->status === Mailbox::ACTIVE && $mailbox->active_until === null ? null : $until,
                ]);

                return $mailbox;
            }

            return Mailbox::create([
                'user_id' => $membership->user_id,
                'location_id' => $locationId,
                'customer_membership_id' => $membership->id,
                'business_name' => $membership->user->name,
                'status' => Mailbox::ACTIVE,
                'active_until' => $until,
            ]);
        });
    }

    /**
     * Staff open a mailbox by hand, e.g. for a customer who paid at the desk.
     */
    public function open(User $customer, Location $location, string $businessName, ?string $activeUntil, ?string $notes, User $staff): Mailbox
    {
        if (Mailbox::where('user_id', $customer->id)->where('location_id', $location->id)->exists()) {
            throw ValidationException::withMessages(['user_id' => 'This customer already has a mailbox at '.$location->name.'. Open it from the list to change it.']);
        }

        return Mailbox::create([
            'user_id' => $customer->id,
            'location_id' => $location->id,
            'business_name' => $businessName,
            'status' => Mailbox::ACTIVE,
            'active_until' => $activeUntil ? Carbon::parse($activeUntil)->endOfDay() : null,
            'notes' => $notes,
            'opened_by' => $staff->id,
        ]);
    }

    /**
     * The front desk records something that arrived, optionally with a scan, and the customer is emailed.
     *
     * @param  array{kind: string, sender?: string|null, description?: string|null, received_at?: string|null}  $data
     */
    public function logMail(Mailbox $mailbox, array $data, ?UploadedFile $scan, User $staff): MailItem
    {
        abort_if($mailbox->status === Mailbox::CLOSED, 422, 'This mailbox is closed. Reopen it before logging mail.');

        $item = $mailbox->items()->create([
            'kind' => $data['kind'],
            'sender' => $data['sender'] ?? null,
            'description' => $data['description'] ?? null,
            'received_at' => isset($data['received_at']) ? Carbon::parse($data['received_at']) : now(),
            'status' => MailItem::WAITING,
            'logged_by' => $staff->id,
        ]);

        if ($scan) {
            $this->storeScan($item, $scan);
        }

        $mailbox->loadMissing('user');
        $mailbox->user->notify(new MailNotification(EmailTemplateKey::MailReceived, $item));

        return $item;
    }

    /**
     * The customer tells us what to do with a waiting item.
     */
    public function request(MailItem $item, string $action, ?string $note, User $customer): MailItem
    {
        $item->loadMissing('mailbox');
        abort_unless($item->isWaiting(), 422, 'We have already dealt with this item.');
        abort_if($item->mailbox->status === Mailbox::CLOSED, 422, 'This mailbox is closed. Please contact us about your mail.');
        abort_if($action === 'scan' && $item->scan_path, 422, 'This item has already been scanned.');
        if ($action === 'forward' && blank($note)) {
            throw ValidationException::withMessages(['note' => 'Tell us the address to forward it to.']);
        }

        $item->update(['requested_action' => $action, 'request_note' => $note, 'requested_at' => now()]);

        Notification::send(StaffAlerts::recipients('mail.manage'), new StaffAlertNotification(
            EmailTemplateKey::StaffMailRequest,
            MailNotification::mailVariables($item) + [
                'customer_name' => $customer->name,
                'request' => MailItem::ACTIONS[$action],
                'request_note' => $note ?: 'None',
            ],
            FrontendLinks::adminMail(),
        ));

        return $item;
    }

    public function cancelRequest(MailItem $item): MailItem
    {
        abort_unless($item->isWaiting() && $item->requested_action, 422, 'There is no request to cancel.');
        $item->update(['requested_action' => null, 'request_note' => null, 'requested_at' => null]);

        return $item;
    }

    /**
     * Staff add a scan. It answers a scan request, and the customer is emailed.
     */
    public function attachScan(MailItem $item, UploadedFile $scan): MailItem
    {
        abort_unless($item->isWaiting(), 422, 'This item has already left the front desk.');
        $this->storeScan($item, $scan);
        if ($item->requested_action === 'scan') {
            $item->update(['requested_action' => null, 'request_note' => null, 'requested_at' => null]);
        }

        $item->loadMissing('mailbox.user');
        $item->mailbox->user->notify(new MailNotification(EmailTemplateKey::MailScanned, $item));

        return $item;
    }

    /**
     * The item left the front desk: collected, forwarded or shredded.
     */
    public function handle(MailItem $item, string $outcome, ?string $note, User $staff): MailItem
    {
        abort_unless($item->isWaiting(), 422, 'This item has already been dealt with.');

        $item->update([
            'status' => $outcome,
            'requested_action' => null,
            'handled_note' => $note,
            'handled_at' => now(),
            'handled_by' => $staff->id,
        ]);

        return $item;
    }

    private function storeScan(MailItem $item, UploadedFile $scan): void
    {
        $old = $item->scan_path;
        $item->update([
            'scan_path' => $scan->storeAs('mail-scans', 'mail-'.$item->id.'-'.now()->format('YmdHis').'.'.$scan->extension(), 'local'),
            'scan_name' => $scan->getClientOriginalName(),
            'scanned_at' => now(),
        ]);
        if ($old) {
            Storage::disk('local')->delete($old);
        }
    }
}
