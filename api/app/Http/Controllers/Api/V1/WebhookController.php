<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentGatewayCode;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PaymentGateway;
use App\Models\WebhookEvent;
use App\Payments\GatewayException;
use App\Payments\GatewayManager;
use App\Payments\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Receives gateway notifications. The signature is checked first, each event is
 * stored once (repeats are ignored), and the payment is re-verified with the gateway's API.
 */
class WebhookController extends Controller
{
    public function __invoke(Request $request, string $gateway, GatewayManager $gateways, PaymentService $payments): JsonResponse
    {
        abort_unless(PaymentGatewayCode::tryFrom($gateway), 404);

        $driver = $gateways->driver(PaymentGateway::where('code', $gateway)->firstOrFail());

        if (! $driver->hasValidWebhookSignature($request)) {
            Log::warning('Rejected webhook with invalid signature', ['gateway' => $gateway, 'ip' => $request->ip()]);

            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $notice = $driver->webhookNotice($request);
        if (! $notice) {
            return response()->json(['message' => 'Ignored.']);
        }

        $event = WebhookEvent::firstOrCreate(
            ['gateway' => $gateway, 'event_key' => $notice->key],
            ['type' => $notice->type, 'payment_reference' => $notice->reference, 'payload' => $request->all()],
        );

        if ($event->processed_at) {
            return response()->json(['message' => 'Already processed.']);
        }

        $payment = $notice->reference ? Payment::where('reference', $notice->reference)->where('gateway', $gateway)->first() : null;

        try {
            if ($payment) {
                $payments->confirm($payment);
            }
            $event->update(['processed_at' => now(), 'error' => $payment ? null : 'No matching payment.']);
        } catch (GatewayException $exception) {
            // Leave unprocessed so the gateway's retry gets another chance.
            $event->update(['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Temporarily unable to verify.'], 503);
        }

        return response()->json(['message' => 'OK']);
    }
}
