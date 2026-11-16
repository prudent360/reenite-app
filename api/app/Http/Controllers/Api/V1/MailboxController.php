<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MailboxResource;
use App\Http\Resources\MailItemResource;
use App\Models\Mailbox;
use App\Models\MailItem;
use App\Models\MembershipPlan;
use App\Support\FrontendLinks;
use App\Support\Signatory;
use App\Workspace\MailboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
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

    /**
     * Plans a customer can apply for to get a virtual address, with the address each one gives.
     */
    public function plans(): JsonResponse
    {
        $plans = MembershipPlan::ordered()->where('is_active', true)->whereNotNull('mailbox_location_id')->with('mailboxLocation')->get();

        return response()->json(['data' => $plans->map(fn (MembershipPlan $plan) => [
            'id' => $plan->id,
            'name' => $plan->name,
            'description' => $plan->description,
            'price' => $plan->price,
            'billing_period' => $plan->billing_period,
            'perks' => $plan->perks ?? [],
            'location' => [
                'name' => $plan->mailboxLocation->name,
                'address' => $plan->mailboxLocation->address,
                'city' => $plan->mailboxLocation->city,
                'state' => $plan->mailboxLocation->state,
            ],
        ])]);
    }

    /**
     * Applies for a virtual address. Returns the invoice to pay; the address is issued once it is paid.
     */
    public function apply(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'membership_plan_id' => ['required', 'integer', Rule::exists('membership_plans', 'id')->where('is_active', true)->whereNotNull('mailbox_location_id')],
            'business_name' => ['required', 'string', 'min:2', 'max:150'],
        ], ['membership_plan_id.exists' => 'Choose one of the virtual address plans.']);

        $membership = $this->mailboxes->apply($request->user(), MembershipPlan::findOrFail($validated['membership_plan_id']), trim($validated['business_name']));

        return response()->json(['invoice_id' => $membership->invoice_id], Response::HTTP_CREATED);
    }

    /**
     * Everything printed on the proof-of-address letter. Only while the address is active.
     */
    public function certificate(Request $request, Mailbox $mailbox, Signatory $signatory): JsonResponse
    {
        abort_unless($mailbox->user_id === $request->user()->id, 404);
        abort_unless($mailbox->isActive(), 422, 'This address is not active. Renew your plan to get a proof of address.');
        $mailbox->load('location');
        $signer = $signatory->details();

        return response()->json(['data' => [
            'certificate_number' => $mailbox->certificateNumber(),
            'holder' => $mailbox->business_name,
            'account_holder' => $request->user()->name,
            'mailbox_number' => $mailbox->number,
            'address_lines' => $mailbox->addressLines(),
            'issued_on' => now()->toIso8601String(),
            'valid_from' => $mailbox->created_at?->toIso8601String(),
            'valid_until' => $mailbox->active_until?->toIso8601String(),
            'verification_code' => $mailbox->verification_code,
            'verify_url' => FrontendLinks::addressVerification($mailbox->verification_code),
            'issuer' => [
                'name' => (string) config('app.legal_name'),
                'address' => trim($mailbox->location->address.', '.$mailbox->location->city.', '.$mailbox->location->state, ', '),
                'phone' => $mailbox->location->phone,
                'email' => $mailbox->location->email,
            ],
            'signatory' => $signer ? ['name' => $signer['name'], 'title' => $signer['title'], 'signature' => Signatory::dataUri($signer['signature_path'])] : null,
        ]]);
    }

    /**
     * Public: confirms what a proof-of-address letter says, from the code printed on it.
     * Shows only what the letter itself shows, and whether the address is still active.
     */
    public function verify(string $code): JsonResponse
    {
        $mailbox = Mailbox::where('verification_code', strtoupper($code))->with('location')->firstOrFail();

        return response()->json(['data' => [
            'state' => $mailbox->state(),
            'certificate_number' => $mailbox->certificateNumber(),
            'holder' => $mailbox->business_name,
            'address_lines' => $mailbox->addressLines(),
            'valid_from' => $mailbox->created_at?->toIso8601String(),
            'valid_until' => $mailbox->active_until?->toIso8601String(),
            'issuer' => (string) config('app.legal_name'),
        ]]);
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
