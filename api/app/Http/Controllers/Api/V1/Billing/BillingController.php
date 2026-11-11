<?php

namespace App\Http\Controllers\Api\V1\Billing;

use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\PaymentResource;
use App\Models\BankAccount;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentGateway;
use App\Payments\CouponService;
use App\Payments\GatewayException;
use App\Payments\PaymentService;
use App\Support\Settings;
use App\Uploads\UploadLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The signed-in customer's invoices and payments. Other people's records return 404.
 */
class BillingController extends Controller
{
    public function __construct(private PaymentService $payments) {}

    /**
     * Payment methods the customer can choose right now.
     */
    public function options(Settings $settings): JsonResponse
    {
        $bankTransfer = (bool) $settings->get('bank_transfer.enabled', false);

        return response()->json([
            'gateways' => PaymentGateway::where('is_enabled', true)->orderBy('sort_order')->get()
                ->filter(fn (PaymentGateway $gateway) => $gateway->isConfigured())
                ->map(fn (PaymentGateway $gateway) => [
                    'code' => $gateway->code->value,
                    'label' => $gateway->code->label(),
                    'description' => $gateway->code->description(),
                    'mode' => $gateway->mode,
                ])->values(),
            'bank_transfer' => [
                'enabled' => $bankTransfer,
                'instructions' => $bankTransfer ? $settings->get('bank_transfer.instructions') : null,
                'accounts' => $bankTransfer ? BankAccount::active()->orderBy('sort_order')->get(['bank_name', 'account_name', 'account_number']) : [],
            ],
        ]);
    }

    public function invoices(Request $request): AnonymousResourceCollection
    {
        $invoices = $request->user()->invoices()
            ->orderByRaw("case status when 'unpaid' then 0 when 'paid' then 1 else 2 end")
            ->latest('id')
            ->paginate(20);

        return InvoiceResource::collection($invoices);
    }

    public function invoice(Request $request, Invoice $invoice): InvoiceResource
    {
        $this->authorizeOwner($request, $invoice->user_id);

        return new InvoiceResource($invoice->load(['items', 'payments']));
    }

    /**
     * Applies a discount code to the invoice (replacing any code already on it).
     */
    public function applyCoupon(Request $request, Invoice $invoice, CouponService $coupons): InvoiceResource
    {
        $this->authorizeOwner($request, $invoice->user_id);
        $validated = $request->validate(['code' => ['required', 'string', 'max:40']], ['code.required' => 'Enter a discount code.']);

        return new InvoiceResource($coupons->apply($invoice, $validated['code'], $request->user())->load(['items', 'payments']));
    }

    public function removeCoupon(Request $request, Invoice $invoice, CouponService $coupons): InvoiceResource
    {
        $this->authorizeOwner($request, $invoice->user_id);

        return new InvoiceResource($coupons->remove($invoice)->load(['items', 'payments']));
    }

    /**
     * Starts an online payment and returns the gateway checkout URL to redirect to.
     */
    public function pay(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizeOwner($request, $invoice->user_id);
        $validated = $request->validate([
            'gateway' => ['required', 'string', Rule::in(['paystack', 'flutterwave', 'stripe'])],
            'save_card' => ['sometimes', 'boolean'],
        ]);

        $result = $this->payments->startOnlinePayment($invoice, $validated['gateway'], $request->user(), saveCard: (bool) ($validated['save_card'] ?? false));

        return response()->json([
            'reference' => $result['payment']->reference,
            'redirect_url' => $result['redirect_url'],
        ], Response::HTTP_CREATED);
    }

    public function bankTransfer(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizeOwner($request, $invoice->user_id);
        $validated = $request->validate([
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', UploadLimit::rule()],
            'sender_name' => ['required', 'string', 'max:150'],
            'transferred_on' => ['required', 'date', 'before_or_equal:today', 'after:-60 days'],
        ], [
            'proof.mimes' => 'Upload a photo (JPG, PNG, WebP) or PDF of your transfer receipt.',
            'proof.max' => UploadLimit::message('The file'),
        ]);

        $payment = $this->payments->submitBankTransfer($invoice, $request->user(), $request->file('proof'), $validated['sender_name'], $validated['transferred_on']);

        return (new PaymentResource($payment))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function payments(Request $request): AnonymousResourceCollection
    {
        return PaymentResource::collection($request->user()->payments()->with('invoice')->latest('id')->paginate(20));
    }

    public function payment(Request $request, Payment $payment): PaymentResource
    {
        $this->authorizeOwner($request, $payment->user_id);

        return new PaymentResource($payment->load('invoice'));
    }

    /**
     * Called when the customer returns from the gateway. Re-checks with the gateway itself.
     */
    public function verify(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeOwner($request, $payment->user_id);

        $message = null;
        try {
            $payment = $this->payments->confirm($payment);
        } catch (GatewayException $exception) {
            $message = $exception->getMessage();
        }

        return response()->json(['data' => new PaymentResource($payment->load('invoice')), 'message' => $message]);
    }

    /**
     * Everything needed to print a receipt for a successful payment.
     */
    public function receipt(Request $request, Payment $payment, Settings $settings): JsonResponse
    {
        $this->authorizeOwner($request, $payment->user_id);
        abort_unless($payment->status->isSettled(), 404);

        return response()->json([
            'payment' => new PaymentResource($payment->load('refunds')),
            'invoice' => new InvoiceResource($payment->invoice->load('items')),
            'customer' => ['name' => $payment->user->name, 'email' => $payment->user->email, 'phone' => $payment->user->phone],
            'issuer' => [
                'name' => config('app.name'),
                'address' => 'Uyo, Akwa Ibom State, Nigeria',
                'email' => $settings->get('mail.from_address') ?: config('mail.from.address'),
            ],
        ]);
    }

    public function proof(Request $request, Payment $payment): StreamedResponse
    {
        $this->authorizeOwner($request, $payment->user_id);
        abort_unless($payment->proof_path && Storage::disk('local')->exists($payment->proof_path), 404);

        return Storage::disk('local')->response($payment->proof_path, $payment->proof_name);
    }

    private function authorizeOwner(Request $request, int $ownerId): void
    {
        abort_unless($request->user()->id === $ownerId, 404);
    }
}
