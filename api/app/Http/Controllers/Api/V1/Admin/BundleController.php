<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BundleRequest;
use App\Http\Resources\BundleResource;
use App\Models\Bundle;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class BundleController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return BundleResource::collection(Bundle::with('services')->orderBy('sort_order')->orderBy('name')->get());
    }

    public function store(BundleRequest $request): JsonResponse
    {
        $bundle = DB::transaction(function () use ($request) {
            $data = Arr::except($request->validated(), 'service_ids');
            $data['slug'] = Slug::unique(Bundle::class, $data['slug'] ?? $data['name']);

            $bundle = Bundle::create($data);
            $this->syncServices($bundle, $request->validated('service_ids'));

            return $bundle;
        });

        return (new BundleResource($bundle->load('services')))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(BundleRequest $request, Bundle $bundle): BundleResource
    {
        DB::transaction(function () use ($request, $bundle) {
            $data = Arr::except($request->validated(), 'service_ids');
            $data['slug'] = Slug::unique(Bundle::class, $data['slug'] ?? $data['name'], $bundle->id);

            $bundle->update($data);
            $this->syncServices($bundle, $request->validated('service_ids'));
        });

        return new BundleResource($bundle->load('services'));
    }

    public function destroy(Bundle $bundle): Response
    {
        $bundle->delete();

        return response()->noContent();
    }

    /**
     * @param  list<int>  $serviceIds  in display order
     */
    private function syncServices(Bundle $bundle, array $serviceIds): void
    {
        $bundle->services()->sync(
            collect($serviceIds)->values()->mapWithKeys(fn (int $id, int $position) => [$id => ['sort_order' => $position]])->all()
        );
    }
}
