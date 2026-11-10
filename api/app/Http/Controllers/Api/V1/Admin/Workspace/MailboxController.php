<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Resources\MailboxResource;
use App\Http\Resources\MailItemResource;
use App\Models\Location;
use App\Models\Mailbox;
use App\Models\MailItem;
use App\Models\User;
use App\Uploads\UploadLimit;
use App\Workspace\MailboxService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Virtual office for the front desk: mailboxes, logging mail, and doing what customers ask.
 */
class MailboxController extends Controller
{
    public function __construct(private MailboxService $mailboxes) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', Rule::in(['active', 'lapsed', 'closed'])],
        ]);
        $search = $request->string('search')->trim()->toString();

        $mailboxes = Mailbox::query()
            ->with(['user', 'location'])
            ->withCount(['waitingItems', 'requestedItems'])
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->where('number', 'like', '%'.strtoupper($search).'%')
                ->orWhere('business_name', 'like', "%{$search}%")
                ->orWhereHas('user', fn (Builder $user) => $user->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))))
            ->when($request->input('state'), fn (Builder $query, string $state) => match ($state) {
                'closed' => $query->where('status', Mailbox::CLOSED),
                'active' => $query->where('status', Mailbox::ACTIVE)->where(fn (Builder $query) => $query->whereNull('active_until')->orWhere('active_until', '>', now())),
                default => $query->where('status', Mailbox::ACTIVE)->where('active_until', '<=', now()),
            })
            ->orderByDesc('requested_items_count')
            ->orderBy('number')
            ->paginate(25);

        return MailboxResource::collection($mailboxes);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')->where('type', User::TYPE_CUSTOMER)->where('status', User::STATUS_ACTIVE)],
            'location_id' => ['required', 'integer', Rule::exists('locations', 'id')],
            'business_name' => ['required', 'string', 'max:150'],
            'active_until' => ['nullable', 'date', 'after_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], ['user_id.exists' => 'Choose an active customer account.']);

        $mailbox = $this->mailboxes->open(
            User::findOrFail($validated['user_id']),
            Location::findOrFail($validated['location_id']),
            $validated['business_name'],
            $validated['active_until'] ?? null,
            $validated['notes'] ?? null,
            $request->user(),
        );

        return (new MailboxResource($this->detail($mailbox)))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Mailbox $mailbox): MailboxResource
    {
        return new MailboxResource($this->detail($mailbox));
    }

    public function update(Request $request, Mailbox $mailbox): MailboxResource
    {
        $validated = $request->validate([
            'business_name' => ['required', 'string', 'max:150'],
            'status' => ['required', Rule::in([Mailbox::ACTIVE, Mailbox::CLOSED])],
            'active_until' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);
        if (isset($validated['active_until'])) {
            $validated['active_until'] = Carbon::parse($validated['active_until'])->endOfDay();
        }

        $mailbox->update($validated);

        return new MailboxResource($this->detail($mailbox));
    }

    /**
     * Mail at the front desk across all mailboxes; customer requests first.
     */
    public function queue(Request $request): AnonymousResourceCollection
    {
        $request->validate(['filter' => ['nullable', Rule::in(['requests', 'waiting'])]]);

        $items = MailItem::query()
            ->where('status', MailItem::WAITING)
            ->when($request->input('filter') === 'requests', fn (Builder $query) => $query->whereNotNull('requested_action'))
            ->with(['mailbox.user', 'logger'])
            ->orderByRaw('case when requested_action is null then 1 else 0 end')
            ->orderBy('requested_at')
            ->latest('received_at')
            ->paginate(50);

        return MailItemResource::collection($items);
    }

    public function logMail(Request $request, Mailbox $mailbox): JsonResponse
    {
        $validated = $request->validate([
            'kind' => ['required', Rule::in(array_keys(MailItem::KINDS))],
            'sender' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:500'],
            'received_at' => ['nullable', 'date', 'before_or_equal:now'],
            'scan' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', UploadLimit::rule()],
        ], [
            'scan.mimes' => 'Upload the scan as a PDF or photo (JPG, PNG, WebP).',
            'scan.max' => UploadLimit::message('The scan'),
        ]);

        $item = $this->mailboxes->logMail($mailbox, $validated, $request->file('scan'), $request->user());

        return (new MailItemResource($item))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function uploadScan(Request $request, MailItem $item): MailItemResource
    {
        $request->validate(
            ['scan' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', UploadLimit::rule()]],
            ['scan.mimes' => 'Upload the scan as a PDF or photo (JPG, PNG, WebP).', 'scan.max' => UploadLimit::message('The scan')],
        );

        return new MailItemResource($this->mailboxes->attachScan($item, $request->file('scan')));
    }

    public function scan(MailItem $item): StreamedResponse
    {
        abort_unless($item->scan_path && Storage::disk('local')->exists($item->scan_path), 404);

        return Storage::disk('local')->response($item->scan_path, $item->scan_name);
    }

    public function handle(Request $request, MailItem $item): MailItemResource
    {
        $validated = $request->validate([
            'outcome' => ['required', Rule::in(array_keys(MailItem::OUTCOMES))],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        return new MailItemResource($this->mailboxes->handle($item, $validated['outcome'], $validated['note'] ?? null, $request->user())->load('handler'));
    }

    /**
     * Locations a mailbox can be at.
     */
    public function locations(): JsonResponse
    {
        return response()->json(['data' => Location::query()->orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'address', 'city', 'state'])]);
    }

    /**
     * Customers to choose from when opening a mailbox.
     */
    public function customers(Request $request): JsonResponse
    {
        $search = $request->string('search')->trim()->toString();

        return response()->json(['data' => User::query()
            ->where('type', User::TYPE_CUSTOMER)
            ->where('status', User::STATUS_ACTIVE)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")))
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'email'])]);
    }

    private function detail(Mailbox $mailbox): Mailbox
    {
        return $mailbox->load(['user', 'location', 'membership', 'items.handler', 'items.logger'])->loadCount(['waitingItems', 'requestedItems']);
    }
}
