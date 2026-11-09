<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ServiceRequest;
use App\Http\Resources\ServiceResource;
use App\Models\Service;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ServiceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'category_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['active', 'hidden'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $services = Service::query()
            ->with('category')
            ->withCount(['formFields', 'documentRequirements', 'stages'])
            ->when($request->filled('category_id'), fn ($query) => $query->where('service_category_id', $request->integer('category_id')))
            ->when($request->input('status') === 'active', fn ($query) => $query->where('is_active', true))
            ->when($request->input('status') === 'hidden', fn ($query) => $query->where('is_active', false))
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('service_category_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return ServiceResource::collection($services);
    }

    /**
     * New services start with a sensible default timeline that admins can edit.
     */
    public function store(ServiceRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(Service::class, $data['slug'] ?? $data['name']);

        $service = DB::transaction(function () use ($data) {
            $service = Service::create($data);
            $service->stages()->createMany([
                ['name' => 'Order received', 'sort_order' => 0],
                ['name' => 'In progress', 'sort_order' => 1],
                ['name' => 'Completed', 'sort_order' => 2],
            ]);

            return $service;
        });

        return (new ServiceResource($this->loadForEditor($service)))->forStaff()->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Service $service): ServiceResource
    {
        return (new ServiceResource($this->loadForEditor($service)))->forStaff();
    }

    public function update(ServiceRequest $request, Service $service): ServiceResource
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(Service::class, $data['slug'] ?? $data['name'], $service->id);

        $service->update($data);

        return (new ServiceResource($this->loadForEditor($service)))->forStaff();
    }

    /**
     * Archives the service (soft delete) so future orders keep their history.
     */
    public function destroy(Service $service): Response
    {
        $service->delete();

        return response()->noContent();
    }

    private function loadForEditor(Service $service): Service
    {
        return $service->load(['category', 'formFields', 'documentRequirements', 'stages']);
    }
}
