<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Api\V1\OrderController as CustomerOrderController;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\User;
use App\Orders\OrderService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The order pipeline. Filing officers see only orders assigned to them;
 * managers (orders.view_all) see everything.
 */
class OrderController extends Controller
{
    public function __construct(private OrderService $orders) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', 'string'],
            'assigned' => ['nullable', 'string'], // me | unassigned | <user id>
            'search' => ['nullable', 'string', 'max:100'],
            'overdue' => ['nullable', 'boolean'],
        ]);

        $statuses = array_filter(explode(',', (string) $request->input('status')));

        $orders = $this->visibleTo($request->user())
            ->with(['user', 'assignee', 'invoice'])
            ->when($statuses, fn ($query) => $query->whereIn('status', $statuses))
            ->when($request->input('assigned') === 'me', fn ($query) => $query->where('assigned_to', $request->user()->id))
            ->when($request->input('assigned') === 'unassigned', fn ($query) => $query->whereNull('assigned_to'))
            ->when(is_numeric($request->input('assigned')), fn ($query) => $query->where('assigned_to', $request->integer('assigned')))
            ->when($request->boolean('overdue'), fn ($query) => $query
                ->whereIn('status', [OrderStatus::Received->value, OrderStatus::InProgress->value, OrderStatus::AwaitingClient->value])
                ->where('due_at', '<', now()))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('reference', 'like', $term)
                    ->orWhere('service_name', 'like', $term)
                    ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $term)->orWhere('email', 'like', $term)));
            })
            ->orderByRaw('case when due_at is null then 1 else 0 end')
            ->orderBy('due_at')
            ->latest('id')
            ->paginate(100);

        $resources = OrderResource::collection($orders);
        $resources->collection->each(fn (OrderResource $resource) => $resource->forStaff());

        return $resources;
    }

    /**
     * Pipeline counts for dashboards.
     */
    public function summary(Request $request): JsonResponse
    {
        $visible = fn () => $this->visibleTo($request->user());

        return response()->json([
            'by_status' => collect(OrderStatus::cases())->mapWithKeys(fn (OrderStatus $status) => [$status->value => $visible()->where('status', $status->value)->count()]),
            'overdue' => $visible()->whereIn('status', [OrderStatus::Received->value, OrderStatus::InProgress->value, OrderStatus::AwaitingClient->value])->where('due_at', '<', now())->count(),
            'mine' => $visible()->where('assigned_to', $request->user()->id)->whereIn('status', [OrderStatus::Received->value, OrderStatus::InProgress->value, OrderStatus::AwaitingClient->value])->count(),
            'unassigned' => $visible()->whereNull('assigned_to')->whereIn('status', [OrderStatus::Received->value, OrderStatus::InProgress->value])->count(),
        ]);
    }

    public function show(Request $request, Order $order): OrderResource
    {
        $this->authorizeWork($request, $order);

        return (new OrderResource($this->loadForView($order)))->forStaff();
    }

    /**
     * Staff who can be given orders.
     */
    public function assignees(): JsonResponse
    {
        $staff = User::where('type', User::TYPE_STAFF)
            ->where('status', User::STATUS_ACTIVE)
            ->get()
            ->filter(fn (User $user) => $user->can('orders.view_assigned') || $user->can('orders.view_all'))
            ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name, 'role' => $user->getRoleNames()->first()])
            ->values();

        return response()->json(['data' => $staff]);
    }

    public function assign(Request $request, Order $order): OrderResource
    {
        abort_unless($request->user()->can('orders.assign'), 403);
        $validated = $request->validate(['user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('type', User::TYPE_STAFF)]]);

        $this->orders->assign($order, $request->user(), isset($validated['user_id']) ? User::find($validated['user_id']) : null);

        return $this->respond($order);
    }

    public function start(Request $request, Order $order): OrderResource
    {
        $this->authorizeWork($request, $order);
        $this->orders->start($order, $request->user());

        return $this->respond($order);
    }

    public function stage(Request $request, Order $order): OrderResource
    {
        $this->authorizeWork($request, $order);
        $validated = $request->validate(['index' => ['required', 'integer', 'min:0']]);

        $this->orders->setStage($order, $request->user(), $validated['index']);

        return $this->respond($order);
    }

    public function requestInfo(Request $request, Order $order): OrderResource
    {
        $this->authorizeWork($request, $order);
        $validated = $request->validate(['message' => ['required', 'string', 'max:2000']]);

        $this->orders->requestInfo($order, $request->user(), $validated['message']);

        return $this->respond($order);
    }

    public function complete(Request $request, Order $order): OrderResource
    {
        $this->authorizeWork($request, $order);
        $validated = $request->validate(['note' => ['nullable', 'string', 'max:1000']]);

        $this->orders->complete($order, $request->user(), $validated['note'] ?? null);

        return $this->respond($order);
    }

    public function cancel(Request $request, Order $order): OrderResource
    {
        abort_unless($request->user()->can('orders.manage'), 403);
        $validated = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $this->orders->cancel($order, $request->user(), $validated['reason']);

        return $this->respond($order);
    }

    /**
     * Uploads a deliverable (e.g. the CAC certificate) for the customer.
     */
    public function upload(Request $request, Order $order): OrderResource
    {
        $this->authorizeWork($request, $order);
        $request->validate(['file' => CustomerOrderController::FILE_RULES]);

        $this->orders->attachFile($order, $request->user(), $request->file('file'), OrderFile::DELIVERABLE);

        return $this->respond($order);
    }

    public function reviewFile(Request $request, Order $order, OrderFile $file): OrderResource
    {
        $this->authorizeWork($request, $order);
        abort_unless($file->order_id === $order->id, 404);
        $validated = $request->validate([
            'status' => ['required', Rule::in(['accepted', 'rejected'])],
            'note' => ['required_if:status,rejected', 'nullable', 'string', 'max:500'],
        ], ['note.required_if' => 'Tell the customer what needs to change.']);

        $this->orders->reviewFile($file, $request->user(), $validated['status'], $validated['note'] ?? null);

        return $this->respond($order);
    }

    public function download(Request $request, Order $order, OrderFile $file): StreamedResponse
    {
        $this->authorizeWork($request, $order);
        abort_unless($file->order_id === $order->id && Storage::disk('local')->exists($file->path), 404);

        return Storage::disk('local')->response($file->path, $file->original_name);
    }

    public function message(Request $request, Order $order): OrderResource
    {
        $this->authorizeWork($request, $order);
        $validated = $request->validate(['body' => ['required', 'string', 'max:5000'], 'internal' => ['boolean']]);

        $this->orders->postMessage($order, $request->user(), $validated['body'], $validated['internal'] ?? false);

        return $this->respond($order);
    }

    /**
     * @return Builder<Order>
     */
    private function visibleTo(User $user): Builder
    {
        return Order::query()->when(! $user->can('orders.view_all'), fn ($query) => $query->where('assigned_to', $user->id));
    }

    private function authorizeWork(Request $request, Order $order): void
    {
        abort_unless($order->isWorkableBy($request->user()), 404);
    }

    private function loadForView(Order $order): Order
    {
        return $order->load(['user', 'invoice', 'assignee', 'files', 'events.user', 'messages.user', 'service']);
    }

    private function respond(Order $order): OrderResource
    {
        return (new OrderResource($this->loadForView($order->refresh())))->forStaff();
    }
}
