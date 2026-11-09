<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\BundleResource;
use App\Http\Resources\ServiceCategoryResource;
use App\Http\Resources\ServiceResource;
use App\Models\Bundle;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Http\JsonResponse;

class CatalogueController extends Controller
{
    /**
     * Everything customers can order: active categories with their active services, plus bundles.
     */
    public function index(): JsonResponse
    {
        $categories = ServiceCategory::active()
            ->ordered()
            ->with(['services' => fn ($query) => $query->active()])
            ->get()
            ->filter(fn (ServiceCategory $category) => $category->services->isNotEmpty())
            ->values();

        // A bundle is only offered while every service in it can be ordered.
        $bundles = Bundle::active()
            ->with('services.category')
            ->orderBy('sort_order')
            ->get()
            ->filter(fn (Bundle $bundle) => $bundle->services->every(
                fn (Service $service) => $service->is_active && $service->category->is_active,
            ))
            ->values();

        return response()->json([
            'categories' => ServiceCategoryResource::collection($categories),
            'bundles' => BundleResource::collection($bundles),
        ]);
    }

    /**
     * Public detail for one service, including what the customer will need and the steps we take.
     */
    public function show(string $slug): ServiceResource
    {
        $service = Service::active()
            ->where('slug', $slug)
            ->whereHas('category', fn ($query) => $query->active())
            ->with(['category', 'formFields', 'documentRequirements', 'stages'])
            ->firstOrFail();

        return new ServiceResource($service);
    }
}
