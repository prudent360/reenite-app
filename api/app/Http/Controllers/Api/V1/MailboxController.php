<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MailboxResource;
use App\Http\Resources\MailItemResource;
use App\Models\MailItem;
use App\Workspace\MailboxService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Virtual office for the signed-in customer: their mailbox address and mail.
 * Other people's mail returns 404.
 */
class MailboxController extends Controller
{
    public function __construct(private MailboxService $mailboxes) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $mailboxes = $request->user()->mailboxes()
            ->with(['location', 'membership', 'items' => fn ($query) => $query->limit(200)])
            ->withCount('waitingItems')
            ->orderByRaw("case status when 'active' then 0 else 1 end")
            ->latest('id')
            ->get();

        return MailboxResource::collection($mailboxes);
    }

    public function scan(Request $request, MailItem $item): StreamedResponse
    {
        $this->authorizeOwner($request, $item);
        abort_unless($item->scan_path && Storage::disk('local')->exists($item->scan_path), 404);

        return Storage::disk('local')->response($item->scan_path, $item->scan_name);
    }

    public function request(Request $request, MailItem $item): MailItemResource
    {
        $this->authorizeOwner($request, $item);
        $validated = $request->validate([
            'action' => ['required', Rule::in(array_keys(MailItem::ACTIONS))],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        return new MailItemResource($this->mailboxes->request($item, $validated['action'], $validated['note'] ?? null, $request->user()));
    }

    public function cancelRequest(Request $request, MailItem $item): MailItemResource
    {
        $this->authorizeOwner($request, $item);

        return new MailItemResource($this->mailboxes->cancelRequest($item));
    }

    private function authorizeOwner(Request $request, MailItem $item): void
    {
        $item->loadMissing('mailbox');
        abort_unless($item->mailbox->user_id === $request->user()->id, 404);
    }
}
