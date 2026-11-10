<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\Service;
use App\Orders\OrderService;
use App\Uploads\UploadLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The signed-in customer's service orders. Other people's orders return 404.
 */
class OrderController extends Controller
{
    /**
     * Accepted upload types for documents.
     */
    public const FILE_RULES = ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf,doc,docx', 'max:'.UploadLimit::KILOBYTES];

    public function __construct(private OrderService $orders) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = $request->user()->orders()->with(['invoice', 'assignee', 'files'])->latest('id')->paginate(20);

        return OrderResource::collection($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service' => ['required', 'string'],
            'answers' => ['present', 'array'],
        ]);

        abort_unless($request->user()->hasVerifiedEmail(), 403, 'Please verify your email address before ordering.');

        $service = Service::where('slug', $validated['service'])->with('category')->firstOrFail();
        $order = $this->orders->create($request->user(), $service, $validated['answers']);

        return (new OrderResource($this->loadForView($order)))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Request $request, Order $order): OrderResource
    {
        $this->authorizeOwner($request, $order);

        return new OrderResource($this->loadForView($order));
    }

    /**
     * Upload for a required document (requirement_id) or a file question (field_key).
     */
    public function upload(Request $request, Order $order): JsonResponse
    {
        $this->authorizeOwner($request, $order);
        $validated = $request->validate([
            'file' => self::FILE_RULES,
            'requirement_id' => ['required_without:field_key', 'nullable', 'integer'],
            'field_key' => ['required_without:requirement_id', 'nullable', 'string', 'max:60'],
        ], ['file.mimes' => 'Upload a PDF, Word document or image (JPG, PNG, WebP).', 'file.max' => UploadLimit::message()]);

        $this->orders->attachFile(
            $order,
            $request->user(),
            $request->file('file'),
            isset($validated['requirement_id']) ? OrderFile::REQUIREMENT : OrderFile::FIELD,
            $validated['requirement_id'] ?? null,
            $validated['field_key'] ?? null,
        );

        return (new OrderResource($this->loadForView($order)))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function download(Request $request, Order $order, OrderFile $file): StreamedResponse
    {
        $this->authorizeOwner($request, $order);
        abort_unless($file->order_id === $order->id && Storage::disk('local')->exists($file->path), 404);

        return Storage::disk('local')->response($file->path, $file->original_name);
    }

    public function message(Request $request, Order $order): OrderResource
    {
        $this->authorizeOwner($request, $order);
        $validated = $request->validate(['body' => ['required', 'string', 'max:5000']]);
        abort_if($order->status->value === 'cancelled', 422, 'This order was cancelled.');

        $this->orders->postMessage($order, $request->user(), $validated['body']);

        return new OrderResource($this->loadForView($order));
    }

    public function cancel(Request $request, Order $order): OrderResource
    {
        $this->authorizeOwner($request, $order);
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        $this->orders->cancel($order, $request->user(), $validated['reason'] ?? 'Cancelled by customer before payment.');

        return new OrderResource($this->loadForView($order));
    }

    /**
     * Every file across the customer's orders, for the Documents vault.
     */
    public function documents(Request $request): JsonResponse
    {
        $files = OrderFile::query()
            ->whereHas('order', fn ($query) => $query->where('user_id', $request->user()->id))
            ->with('order:id,reference,service_name')
            ->latest('id')
            ->get();

        return response()->json(['data' => $files->map(fn (OrderFile $file) => [
            'id' => $file->id,
            'kind' => $file->kind,
            'label' => $file->label,
            'name' => $file->original_name,
            'mime' => $file->mime,
            'size' => $file->size,
            'status' => $file->status,
            'order_reference' => $file->order->reference,
            'service_name' => $file->order->service_name,
            'created_at' => $file->created_at?->toIso8601String(),
        ])]);
    }

    private function loadForView(Order $order): Order
    {
        return $order->load(['invoice', 'assignee', 'files', 'events.user', 'messages.user', 'service']);
    }

    private function authorizeOwner(Request $request, Order $order): void
    {
        abort_unless($order->user_id === $request->user()->id, 404);
    }
}
