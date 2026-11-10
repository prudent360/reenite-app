<?php

namespace App\Http\Controllers\Api\V1\Admin\Finance;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Finance\CouponRequest;
use App\Http\Resources\CouponResource;
use App\Models\Coupon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Discount codes. Customers enter them when paying; see App\Payments\CouponService.
 */
class CouponController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['search' => ['nullable', 'string', 'max:100']]);

        $coupons = $this->withUsage(Coupon::query())
            ->with('creator')
            ->when($request->string('search')->trim()->toString(), fn (Builder $query, string $search) => $query->where(
                fn (Builder $query) => $query->where('code', 'like', '%'.strtoupper($search).'%')->orWhere('description', 'like', "%{$search}%"),
            ))
            ->latest('id')
            ->paginate(25);

        return CouponResource::collection($coupons);
    }

    public function store(CouponRequest $request): JsonResponse
    {
        $coupon = Coupon::create($this->attributes($request) + ['created_by' => $request->user()->id]);

        return (new CouponResource($this->fresh($coupon)))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Coupon $coupon): CouponResource
    {
        return new CouponResource($this->fresh($coupon));
    }

    public function update(CouponRequest $request, Coupon $coupon): CouponResource
    {
        $coupon->update($this->attributes($request));

        return new CouponResource($this->fresh($coupon));
    }

    /**
     * A code that has been used stays on record (invoices refer to it); turn it off instead.
     */
    public function destroy(Coupon $coupon): Response
    {
        abort_if($coupon->redemptions()->exists(), 422, 'This code has been used, so it stays on record. Turn it off instead.');
        $coupon->delete();

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function attributes(CouponRequest $request): array
    {
        $data = $request->validated();
        if ($data['discount_type'] === Coupon::FIXED) {
            // A cap only means something for a percentage.
            $data['max_discount'] = null;
        }

        return $data;
    }

    private function fresh(Coupon $coupon): Coupon
    {
        return $this->withUsage(Coupon::whereKey($coupon->id))->with('creator')->firstOrFail();
    }

    /**
     * @param  Builder<Coupon>  $query
     * @return Builder<Coupon>
     */
    private function withUsage(Builder $query): Builder
    {
        $notVoid = fn (Builder $invoice) => $invoice->where('status', '!=', InvoiceStatus::Void->value);
        $paid = fn (Builder $invoice) => $invoice->where('status', InvoiceStatus::Paid->value);

        return $query
            ->withCount(['redemptions as uses_count' => fn (Builder $redemption) => $redemption->whereHas('invoice', $notVoid)])
            ->withCount(['redemptions as paid_uses_count' => fn (Builder $redemption) => $redemption->whereHas('invoice', $paid)])
            ->withSum(['redemptions as discount_given' => fn (Builder $redemption) => $redemption->whereHas('invoice', $paid)], 'amount');
    }
}
