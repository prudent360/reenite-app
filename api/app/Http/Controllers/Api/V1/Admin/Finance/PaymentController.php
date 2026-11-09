<?php

namespace App\Http\Controllers\Api\V1\Admin\Finance;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Payments\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PaymentController extends Controller
{
    public function __construct(private PaymentService $payments) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::enum(PaymentStatus::class)],
            'gateway' => ['nullable', 'string', 'max:20'],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $payments = Payment::query()
            ->with(['invoice', 'user'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('gateway'), fn ($query) => $query->where('gateway', $request->string('gateway')))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('reference', 'like', $term)
                    ->orWhere('receipt_number', 'like', $term)
                    ->orWhereHas('invoice', fn ($invoice) => $invoice->where('number', 'like', $term))
                    ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $term)->orWhere('email', 'like', $term)));
            })
            ->when($request->filled('from'), fn ($query) => $query->whereDate('created_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('created_at', '<=', $request->date('to')))
            ->latest('id')
            ->paginate(25);

        return PaymentResource::collection($payments);
    }

    public function show(Payment $payment): PaymentResource
    {
        return new PaymentResource($payment->load(['invoice', 'user', 'reviewer', 'refunds']));
    }

    public function proof(Payment $payment): StreamedResponse
    {
        abort_unless($payment->proof_path && Storage::disk('local')->exists($payment->proof_path), 404);

        return Storage::disk('local')->response($payment->proof_path, $payment->proof_name);
    }

    public function approve(Request $request, Payment $payment): PaymentResource
    {
        $validated = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        return new PaymentResource($this->payments->approveTransfer($payment, $request->user(), $validated['note'] ?? null)->load(['invoice', 'user', 'reviewer']));
    }

    public function reject(Request $request, Payment $payment): PaymentResource
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        return new PaymentResource($this->payments->rejectTransfer($payment, $request->user(), $validated['reason'])->load(['invoice', 'user', 'reviewer']));
    }

    public function refund(Request $request, Payment $payment): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:500'],
            'method' => ['required', Rule::in(['gateway', 'manual'])],
        ]);

        $this->payments->refund($payment, $validated['amount'], $validated['reason'], $validated['method'], $request->user());

        return response()->json([
            'data' => new PaymentResource($payment->refresh()->load(['invoice', 'user', 'reviewer', 'refunds'])),
            'message' => 'Refund recorded.',
        ]);
    }
}
