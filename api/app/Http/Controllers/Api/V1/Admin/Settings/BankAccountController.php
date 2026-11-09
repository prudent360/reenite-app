<?php

namespace App\Http\Controllers\Api\V1\Admin\Settings;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class BankAccountController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $account = BankAccount::create($this->validated($request) + ['sort_order' => BankAccount::count()]);

        return response()->json(['data' => $account], Response::HTTP_CREATED);
    }

    public function update(Request $request, BankAccount $bankAccount, Settings $settings): JsonResponse
    {
        $bankAccount->fill($this->validated($request));
        $this->guardLastActiveAccount($bankAccount, $settings, deactivating: ! $bankAccount->is_active);
        $bankAccount->save();

        return response()->json(['data' => $bankAccount]);
    }

    public function destroy(BankAccount $bankAccount, Settings $settings): Response
    {
        $this->guardLastActiveAccount($bankAccount, $settings, deactivating: true);
        $bankAccount->delete();

        return response()->noContent();
    }

    /**
     * @return array{bank_name: string, account_name: string, account_number: string, is_active: bool}
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'bank_name' => ['required', 'string', 'max:100'],
            'account_name' => ['required', 'string', 'max:150'],
            'account_number' => ['required', 'string', 'regex:/^\d{10}$/'],
            'is_active' => ['boolean'],
        ], [
            'account_number.regex' => 'Nigerian account numbers (NUBAN) are 10 digits.',
        ]);
    }

    /**
     * While bank transfer is on, customers must always have an account to pay into.
     */
    private function guardLastActiveAccount(BankAccount $account, Settings $settings, bool $deactivating): void
    {
        $othersActive = BankAccount::active()->whereKeyNot($account->id)->exists();

        abort_if(
            $deactivating && $settings->get('bank_transfer.enabled', false) && ! $othersActive,
            422,
            'This is the only active account while bank transfer is on. Turn bank transfer off first, or add another account.',
        );
    }
}
