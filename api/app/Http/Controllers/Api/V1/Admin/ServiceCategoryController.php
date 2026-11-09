<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ServiceCategoryRequest;
use App\Http\Resources\ServiceCategoryResource;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ServiceCategoryController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ServiceCategoryResource::collection(ServiceCategory::ordered()->withCount('services')->get());
    }

    public function store(ServiceCategoryRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(ServiceCategory::class, $data['slug'] ?? $data['name']);

        $category = ServiceCategory::create($data)->loadCount('services');

        return (new ServiceCategoryResource($category))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(ServiceCategoryRequest $request, ServiceCategory $category): ServiceCategoryResource
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(ServiceCategory::class, $data['slug'] ?? $data['name'], $category->id);

        $category->update($data);

        return new ServiceCategoryResource($category->loadCount('services'));
    }

    /**
     * Categories that hold services (including archived ones) can't be deleted; hide them instead.
     */
    public function destroy(ServiceCategory $category): Response
    {
        abort_if(
            Service::withTrashed()->where('service_category_id', $category->id)->exists(),
            422,
            'Move or delete the services in this category first, or hide the category instead.',
        );

        $category->delete();

        return response()->noContent();
    }
}
