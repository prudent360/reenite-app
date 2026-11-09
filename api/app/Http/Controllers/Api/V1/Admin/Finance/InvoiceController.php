<?php

namespace App\Http\Controllers\Api\V1\Admin\Finance;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\User;
use App\Payments\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceService $invoices) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::enum(InvoiceStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $invoices = Invoice::query()
            ->with('user')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('number', 'like', $term)
                    ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $term)->orWhere('email', 'like', $term)));
            })
            ->latest('id')
            ->paginate(25);

        return InvoiceResource::collection($invoices);
    }

    /**
     * Raises an invoice for a customer. Line amounts arrive in kobo.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', Rule::exists('users', 'id')->where('type', User::TYPE_CUSTOMER)],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000'],
            'items.*.unit_amount' => ['required', 'integer', 'min:1', 'max:10000000000'],
            'items.*.service_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date', 'after_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'notify' => ['boolean'],
        ], [], [
            'items.*.description' => 'description',
            'items.*.quantity' => 'quantity',
            'items.*.unit_amount' => 'price',
        ]);

        $invoice = $this->invoices->create(
            User::findOrFail($validated['customer_id']),
            $validated['items'],
            $validated['due_at'] ?? null,
            $validated['notes'] ?? null,
            $request->user(),
            $validated['notify'] ?? true,
        );

        return (new InvoiceResource($invoice->load(['items', 'user', 'payments', 'creator'])))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        return new InvoiceResource($invoice->load(['items', 'user', 'creator', 'payments.refunds']));
    }

    public function void(Invoice $invoice): InvoiceResource
    {
        return new InvoiceResource($this->invoices->void($invoice)->load(['items', 'user', 'creator', 'payments']));
    }
}
