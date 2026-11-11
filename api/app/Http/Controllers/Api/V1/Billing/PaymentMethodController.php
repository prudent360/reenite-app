<?php

namespace App\Http\Controllers\Api\V1\Billing;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * The customer's saved cards: see them, choose the one renewals use, or remove one.
 * Removing a card only forgets it here; nothing is sent to the gateway.
 */
class PaymentMethodController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->paymentMethods()->orderByDesc('is_default')->latest('id')->get()->map(fn (PaymentMethod $card) => [
            'id' => $card->id,
            'label' => $card->label(),
            'brand' => $card->brand,
            'last4' => $card->last4,
            'expires' => $card->exp_month && $card->exp_year ? sprintf('%02d/%s', (int) $card->exp_month, substr($card->exp_year, -2)) : null,
            'is_expired' => $card->isExpired(),
            'bank' => $card->bank,
            'is_default' => $card->is_default,
            'test_mode' => $card->mode === 'test',
            'last_used_at' => $card->last_used_at?->toIso8601String(),
        ])]);
    }

    public function makeDefault(Request $request, PaymentMethod $card): JsonResponse
    {
        abort_unless($card->user_id === $request->user()->id, 404);
        DB::transaction(function () use ($request, $card) {
            $request->user()->paymentMethods()->update(['is_default' => false]);
            $card->update(['is_default' => true]);
        });

        return response()->json(['message' => "Renewals will use your {$card->label()}."]);
    }

    public function destroy(Request $request, PaymentMethod $card): Response
    {
        abort_unless($card->user_id === $request->user()->id, 404);
        $wasDefault = $card->is_default;
        $card->delete();
        if ($wasDefault) {
            $request->user()->paymentMethods()->latest('id')->first()?->update(['is_default' => true]);
        }

        return response()->noContent();
    }
}
